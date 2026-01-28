/**
 * INSCRIPT: Memory Import API
 *
 * Phase 19 - PAMP v2.0 (Portable AI Memory Protocol)
 * Imports PAMP v2.0 compliant documents into Inscript.
 *
 * Endpoint: POST /api/import
 * Auth: Bearer token required
 * Body: PAMP v2.0 JSON document
 *
 * Query params:
 *   mode: 'merge' (default) | 'replace' - How to handle existing data
 *   dry_run: 'true' | 'false' - Preview without importing (default: false)
 *
 * Returns: Import summary with counts and any errors
 */

import { createClient } from '@supabase/supabase-js';
import { validatePAMP, isEncrypted, getEncryptedFields } from '../lib/pamp/index.js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Import] Auth error:', authError?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user_id = user.id;
    const mode = req.query.mode || 'merge';
    const dryRun = req.query.dry_run === 'true';

    console.log(`[Import] Starting for user: ${user_id}, mode: ${mode}, dry_run: ${dryRun}`);
    const startTime = Date.now();

    // Parse body
    const doc = req.body;

    if (!doc || typeof doc !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    // Validate PAMP document
    const validation = validatePAMP(doc);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid PAMP document',
        validationErrors: validation.errors.map(e => ({
          path: e.path,
          message: e.message
        }))
      });
    }

    // Check for encrypted content
    if (isEncrypted(doc)) {
      const encryptedFields = getEncryptedFields(doc);
      return res.status(400).json({
        error: 'Document contains encrypted content',
        message: 'Please decrypt the document before importing',
        encryptedFields
      });
    }

    // Track import results
    const results = {
      mode,
      dryRun,
      imported: {
        keyPeople: 0,
        entities: 0,
        facts: 0,
        notes: 0,
        patterns: 0
      },
      skipped: {
        keyPeople: 0,
        entities: 0,
        facts: 0,
        notes: 0,
        patterns: 0
      },
      errors: []
    };

    // ============================================
    // IMPORT IDENTITY
    // ============================================

    if (doc.identity) {
      // Import key people
      if (doc.identity.keyPeople?.length > 0) {
        for (const person of doc.identity.keyPeople) {
          try {
            if (dryRun) {
              results.imported.keyPeople++;
              continue;
            }

            // Check if already exists
            const { data: existing } = await supabase
              .from('user_key_people')
              .select('id')
              .eq('user_id', user_id)
              .eq('name', person.name)
              .maybeSingle();

            if (existing && mode === 'merge') {
              results.skipped.keyPeople++;
              continue;
            }

            // Upsert
            const { error } = await supabase
              .from('user_key_people')
              .upsert({
                user_id,
                name: person.name,
                relationship: person.relationship
              }, {
                onConflict: 'user_id,name'
              });

            if (error) throw error;
            results.imported.keyPeople++;
          } catch (e) {
            results.errors.push(`Key person "${person.name}": ${e.message}`);
          }
        }
      }

      // Update profile if provided
      if (doc.identity.profile && !dryRun) {
        const profile = doc.identity.profile;
        try {
          await supabase
            .from('onboarding_data')
            .upsert({
              user_id,
              name: profile.name,
              goals: profile.goals,
              life_seasons: profile.lifeContext,
              boundaries: profile.boundaries,
              depth_answer: profile.selfDescription,
              role_type: profile.role
            }, {
              onConflict: 'user_id'
            });
        } catch (e) {
          results.errors.push(`Profile update: ${e.message}`);
        }
      }
    }

    // ============================================
    // IMPORT KNOWLEDGE GRAPH
    // ============================================

    if (doc.knowledgeGraph) {
      // Create entity ID mapping (external ID -> internal ID)
      const entityIdMap = new Map();

      // Import entities
      if (doc.knowledgeGraph.entities?.length > 0) {
        for (const entity of doc.knowledgeGraph.entities) {
          try {
            if (dryRun) {
              results.imported.entities++;
              entityIdMap.set(entity.id, 'dry-run-id');
              continue;
            }

            // Check if entity with same name exists
            const { data: existing } = await supabase
              .from('user_entities')
              .select('id')
              .eq('user_id', user_id)
              .eq('name', entity.name)
              .maybeSingle();

            if (existing && mode === 'merge') {
              entityIdMap.set(entity.id, existing.id);
              results.skipped.entities++;
              continue;
            }

            // Insert or update entity
            const { data: inserted, error } = await supabase
              .from('user_entities')
              .upsert({
                user_id,
                name: entity.name,
                entity_type: entity.type,
                summary: entity.summary,
                importance_score: entity.scores?.importance || 0.5,
                sentiment_average: entity.scores?.sentiment || 0,
                mention_count: entity.scores?.mentionCount || 1,
                sensitivity_level: mapPrivacyToSensitivity(entity.privacyLevel)
              }, {
                onConflict: 'user_id,name'
              })
              .select('id')
              .single();

            if (error) throw error;

            entityIdMap.set(entity.id, inserted.id);
            results.imported.entities++;

            // Import facts for this entity
            if (entity.facts?.length > 0) {
              for (const fact of entity.facts) {
                try {
                  const { error: factError } = await supabase
                    .from('entity_facts')
                    .upsert({
                      user_id,
                      entity_id: inserted.id,
                      predicate: fact.predicate,
                      object_text: fact.object,
                      confidence: fact.confidence || 0.8
                    }, {
                      onConflict: 'user_id,entity_id,predicate,object_text'
                    });

                  if (factError) throw factError;
                  results.imported.facts++;
                } catch (e) {
                  results.errors.push(`Fact for "${entity.name}": ${e.message}`);
                }
              }
            }
          } catch (e) {
            results.errors.push(`Entity "${entity.name}": ${e.message}`);
          }
        }
      }
    }

    // ============================================
    // IMPORT EPISODES
    // ============================================

    if (doc.episodes) {
      // Import notes
      if (doc.episodes.notes?.length > 0) {
        for (const note of doc.episodes.notes) {
          try {
            // Skip encrypted notes
            if (note.contentEncrypted && !note.content) {
              results.skipped.notes++;
              continue;
            }

            if (dryRun) {
              results.imported.notes++;
              continue;
            }

            // Insert note (always create new to avoid conflicts)
            const { error } = await supabase
              .from('notes')
              .insert({
                user_id,
                content: note.content,
                category: note.category || 'imported',
                note_type: note.source === 'meeting' ? 'meeting' : 'standard',
                sentiment: note.sentiment || 0,
                is_distilled: note.isDistilled || false,
                distilled_summary: note.distilledSummary,
                created_at: note.timestamp
              });

            if (error) throw error;
            results.imported.notes++;
          } catch (e) {
            results.errors.push(`Note: ${e.message}`);
          }
        }
      }
    }

    // ============================================
    // IMPORT PATTERNS
    // ============================================

    if (doc.patterns?.length > 0) {
      for (const pattern of doc.patterns) {
        try {
          if (dryRun) {
            results.imported.patterns++;
            continue;
          }

          // Check for duplicate description
          const { data: existing } = await supabase
            .from('user_patterns')
            .select('id')
            .eq('user_id', user_id)
            .eq('description', pattern.description)
            .maybeSingle();

          if (existing && mode === 'merge') {
            results.skipped.patterns++;
            continue;
          }

          const { error } = await supabase
            .from('user_patterns')
            .insert({
              user_id,
              pattern_type: pattern.type,
              description: pattern.description,
              confidence: pattern.confidence,
              status: pattern.status || 'active'
            });

          if (error) throw error;
          results.imported.patterns++;
        } catch (e) {
          results.errors.push(`Pattern: ${e.message}`);
        }
      }
    }

    // ============================================
    // SUMMARY
    // ============================================

    const duration = Date.now() - startTime;
    console.log(`[Import] Completed in ${duration}ms`);
    console.log(`[Import] Results:`, results);

    const totalImported = Object.values(results.imported).reduce((a, b) => a + b, 0);
    const totalSkipped = Object.values(results.skipped).reduce((a, b) => a + b, 0);

    return res.status(200).json({
      success: true,
      message: dryRun
        ? `Dry run complete. Would import ${totalImported} items, skip ${totalSkipped} items.`
        : `Import complete. Imported ${totalImported} items, skipped ${totalSkipped} items.`,
      results,
      duration: `${duration}ms`,
      source: doc.meta?.source?.application || 'unknown',
      warnings: validation.warnings.map(w => w.message)
    });

  } catch (error) {
    console.error('[Import] Failed:', error);
    return res.status(500).json({ error: 'Import failed', message: error.message });
  }
}

/**
 * Map PAMP privacy level to Inscript sensitivity level
 */
function mapPrivacyToSensitivity(privacy) {
  const map = {
    'public': 'low',
    'private': 'medium',
    'sensitive': 'high'
  };
  return map[privacy] || 'medium';
}
