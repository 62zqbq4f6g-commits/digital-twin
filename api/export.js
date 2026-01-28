// /api/export.js
// OWNER: T1
// STATUS: Complete
// DEPENDS ON: /lib/export/* (T2)

/**
 * INSCRIPT: Data Export API
 *
 * Phase 19 - PAMP v2.0 (Portable AI Memory Protocol)
 * Exports user data in PAMP v2.0 compliant JSON format.
 *
 * Endpoint: GET /api/export
 * Auth: Bearer token required
 * Returns: JSON file download
 *
 * Query params:
 *   format: 'pamp' (default) | 'legacy' - Export format
 *   validate: 'true' | 'false' - Validate PAMP output (default: true)
 *
 * Privacy: User can only export their own data.
 * All data is user-owned and portable per PAMP principles.
 */

import { createClient } from '@supabase/supabase-js';

// T2's data layer
import {
  getProfile,
  getKeyPeople,
  getEntities,
  getEntityFacts,
  getEntityLinks,
  getEntityRelationships,
  getNotes,
  getMeetings,
  getConversations,
  getPatterns,
  getUserBehaviors,
  getEntityQualities,
  getCategorySummaries
} from '../lib/export/queries.js';

import {
  buildIdentity,
  transformEntity,
  transformNote,
  transformMeeting,
  transformConversation,
  transformPattern,
  transformBehavior,
  transformEntityQuality,
  transformEntityLink,
  buildMeta,
  buildPAMPDocument
} from '../lib/export/transforms.js';

import { filterByPrivacy } from '../lib/export/privacy.js';
import { validatePAMP, PAMP_VERSION } from '../lib/pamp/index.js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - get user from session/token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Log request info
  console.log(`[Export] Request from ${req.headers['x-forwarded-for'] || 'unknown'}`);
  console.log(`[Export] User-Agent: ${req.headers['user-agent']}`);

  try {
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Export] Auth error:', authError?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user_id = user.id;
    const format = req.query.format || 'pamp';
    const shouldValidate = req.query.validate !== 'false';

    console.log(`[Export] Starting for user: ${user_id}, format: ${format}`);
    const startTime = Date.now();

    // ============================================
    // GATHER DATA (T2's query layer)
    // ============================================

    // Query timing helper
    const timings = {};
    const timeQuery = async (name, fn) => {
      const start = Date.now();
      const result = await fn();
      timings[name] = Date.now() - start;
      return result;
    };

    // Gather all data in parallel using T2's functions
    const [profile, keyPeople, entities, facts, entityLinks, relationships, notes, meetings, conversations, patterns, behaviors, entityQualities, categorySummaries] =
      await Promise.all([
        timeQuery('profile', () => getProfile(user_id)),
        timeQuery('keyPeople', () => getKeyPeople(user_id)),
        timeQuery('entities', () => getEntities(user_id)),
        timeQuery('facts', () => getEntityFacts(user_id)),
        timeQuery('entityLinks', () => getEntityLinks(user_id)),
        timeQuery('relationships', () => getEntityRelationships(user_id)),
        timeQuery('notes', () => getNotes(user_id)),
        timeQuery('meetings', () => getMeetings(user_id)),
        timeQuery('conversations', () => getConversations(user_id)),
        timeQuery('patterns', () => getPatterns(user_id)),
        timeQuery('behaviors', () => getUserBehaviors(user_id)),
        timeQuery('entityQualities', () => getEntityQualities(user_id)),
        timeQuery('categorySummaries', () => getCategorySummaries(user_id))
      ]);

    console.log(`[Export] Query timings:`, timings);
    console.log(`[Export] Data gathered: ${entities.length} entities, ${facts.length} facts, ${behaviors.length} behaviors, ${notes.length} notes, ${patterns.length} patterns`);

    // ============================================
    // PRIVACY FILTERING (T2's privacy layer)
    // ============================================

    const publicEntities = filterByPrivacy(entities);
    const publicNotes = filterByPrivacy(notes);
    const publicPatterns = filterByPrivacy(patterns);

    console.log(`[Export] After privacy filter: ${publicEntities.length} entities, ${publicNotes.length} notes, ${publicPatterns.length} patterns`);

    // ============================================
    // HANDLE EDGE CASES
    // ============================================

    // Empty account handling
    if (!publicNotes.length && !publicEntities.length) {
      console.log(`[Export] Empty account for user: ${user_id}`);
      // Still return valid structure, just empty
    }

    // Large export handling (>1000 notes)
    if (publicNotes.length > 1000) {
      console.log(`[Export] Large export: ${publicNotes.length} notes`);
      // For v1, proceed but log warning
    }

    // ============================================
    // BUILD EXPORT STRUCTURE (T2's transform layer)
    // ============================================

    let exportData;
    let filename;

    if (format === 'pamp') {
      // PAMP v2.0 compliant export
      exportData = buildPAMPDocument({
        profile,
        keyPeople,
        entities: publicEntities,
        facts,
        relationships,
        notes: publicNotes,
        conversations,
        meetings,
        patterns: publicPatterns,
        behaviors,
        entityQualities,
        entityLinks,
        categorySummaries
      });

      // Validate if requested
      if (shouldValidate) {
        const validation = validatePAMP(exportData);
        if (!validation.valid) {
          console.error('[Export] PAMP validation failed:', validation.errors.map(e => e.message));
          // Continue anyway but log warnings
          console.warn('[Export] Exporting despite validation errors');
        }
        if (validation.warnings.length > 0) {
          console.warn('[Export] PAMP validation warnings:', validation.warnings);
        }
      }

      filename = `inscript-pamp-${new Date().toISOString().split('T')[0]}.json`;

      // Add PAMP version header
      res.setHeader('X-PAMP-Version', PAMP_VERSION);

    } else {
      // Legacy format for backward compatibility
      exportData = {
        inscript_export: {
          identity: buildIdentity(profile, keyPeople),

          // Knowledge Graph (PAMP v2.0 Layer 2)
          knowledgeGraph: {
            entities: publicEntities.map(e => transformEntity(e, facts)),
            relationships: entityLinks.map(transformEntityLink),
            coOccurrences: entityLinks.map(transformEntityLink)
          },

          // Episodes (PAMP v2.0 Layer 3)
          episodes: {
            notes: publicNotes.map(transformNote),
            meetings: meetings.map(transformMeeting),
            conversations: conversations.map(transformConversation)
          },

          // Behavioral Profile (PAMP v2.0 Layer 4 - Phase 19)
          behaviors: {
            userBehaviors: behaviors.map(transformBehavior),
            entityQualities: entityQualities.map(transformEntityQuality)
          },

          // Patterns (PAMP v2.0 Layer 4)
          patterns: publicPatterns.map(transformPattern),

          // Legacy: Keep entities at root for backward compatibility
          entities: publicEntities.map(e => transformEntity(e, facts)),

          meta: buildMeta({
            entities: publicEntities,
            notes: publicNotes,
            patterns: publicPatterns,
            facts,
            conversations,
            behaviors,
            entityQualities,
            entityLinks
          })
        }
      };

      filename = `inscript-export-${new Date().toISOString().split('T')[0]}.json`;
    }

    const duration = Date.now() - startTime;
    console.log(`[Export] Completed in ${duration}ms, format: ${format}`);

    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).json(exportData);

  } catch (error) {
    console.error('[Export] Failed:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}
