// /api/save-facts.js
// OWNER: T1
// Sprint 2: Save structured facts to entity_facts table

/**
 * INSCRIPT: Save Extracted Facts API
 *
 * Sprint 2 - Structured Facts
 * Saves extracted facts to the entity_facts table.
 *
 * Endpoint: POST /api/save-facts
 * Body: { userId, facts, entityMap, sourceNoteId }
 *
 * Called after entity extraction to persist structured facts.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth token and extract user_id
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { facts, entityMap, sourceNoteId } = req.body;

  // Use authenticated user's ID, not body parameter
  const userId = user.id;

  if (!facts || !Array.isArray(facts)) {
    return res.status(400).json({ error: 'facts array required' });
  }

  if (!entityMap || typeof entityMap !== 'object') {
    return res.status(400).json({ error: 'entityMap required (object mapping entity names to IDs)' });
  }

  console.log(`[SaveFacts] Processing ${facts.length} facts for user: ${userId}`);
  const startTime = Date.now();

  const results = { saved: 0, skipped: 0, errors: [] };

  for (const fact of facts) {
    try {
      // Find entity ID for this fact (case-insensitive lookup)
      const entityId = entityMap[fact.entity_name] ||
                       entityMap[fact.entity_name?.toLowerCase()] ||
                       Object.entries(entityMap).find(([k]) =>
                         k.toLowerCase() === fact.entity_name?.toLowerCase()
                       )?.[1];

      if (!entityId) {
        console.warn(`[SaveFacts] No entity found for fact: ${fact.entity_name}`);
        results.skipped++;
        results.errors.push({
          fact: `${fact.entity_name} ${fact.predicate} ${fact.object}`,
          error: 'Entity not found in entityMap'
        });
        continue;
      }

      // Check if fact already exists (avoid duplicates)
      const { data: existing } = await supabase
        .from('entity_facts')
        .select('id, confidence')
        .eq('entity_id', entityId)
        .eq('predicate', fact.predicate)
        .eq('object_text', fact.object)
        .maybeSingle();

      if (existing) {
        // Update confidence if new confidence is higher
        if ((fact.confidence || 0.8) > existing.confidence) {
          await supabase
            .from('entity_facts')
            .update({
              confidence: fact.confidence || 0.8,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          console.log(`[SaveFacts] Updated confidence: ${fact.entity_name} ${fact.predicate}`);
        }
        results.skipped++;
        continue;
      }

      // Check if object is another entity
      let objectEntityId = null;
      if (fact.object_is_entity && fact.object) {
        objectEntityId = entityMap[fact.object] ||
                         entityMap[fact.object?.toLowerCase()] ||
                         Object.entries(entityMap).find(([k]) =>
                           k.toLowerCase() === fact.object?.toLowerCase()
                         )?.[1];
      }

      // Insert new fact
      const { error: insertError } = await supabase
        .from('entity_facts')
        .insert({
          user_id: userId,
          entity_id: entityId,
          predicate: fact.predicate,
          object_text: fact.object,
          object_entity_id: objectEntityId,
          confidence: fact.confidence || 0.8,
          source_note_id: sourceNoteId || null
        });

      if (insertError) {
        console.error(`[SaveFacts] Insert error:`, insertError);
        results.errors.push({
          fact: `${fact.entity_name} ${fact.predicate} ${fact.object}`,
          error: insertError.message
        });
        continue;
      }

      results.saved++;
      console.log(`[SaveFacts] Saved: ${fact.entity_name} ${fact.predicate} ${fact.object}`);

    } catch (error) {
      console.error(`[SaveFacts] Error:`, error);
      results.errors.push({
        fact: `${fact.entity_name} ${fact.predicate} ${fact.object}`,
        error: error.message
      });
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`[SaveFacts] Complete in ${processingTime}ms: ${results.saved} saved, ${results.skipped} skipped`);

  return res.status(200).json({
    success: true,
    saved: results.saved,
    skipped: results.skipped,
    errors: results.errors.length > 0 ? results.errors : undefined,
    processingTime
  });
}
