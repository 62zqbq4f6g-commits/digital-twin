/**
 * /api/save-behaviors.js
 * Phase 19: Intent-Aware Extraction — Save User Behaviors
 *
 * Saves extracted behaviors and relationship qualities to the database.
 * Behaviors are the user's relationship TO entities (trust, reliance, etc.)
 * Relationship qualities are how entities relate TO the user (helps, challenges, etc.)
 *
 * POST /api/save-behaviors
 * Body: { behaviors, relationshipQualities, entityMap, sourceNoteId, sourceType }
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const {
    behaviors = [],
    relationshipQualities = [],
    entityMap = {},
    sourceNoteId,
    sourceType = 'note'
  } = req.body;

  const userId = user.id;
  const startTime = Date.now();

  console.log(`[SaveBehaviors] Processing for user: ${userId}`);
  console.log(`[SaveBehaviors] Input: ${behaviors.length} behaviors, ${relationshipQualities.length} qualities`);

  const results = {
    behaviors: { saved: 0, updated: 0, skipped: 0, errors: [] },
    qualities: { saved: 0, updated: 0, skipped: 0, errors: [] }
  };

  // ========== Save Behaviors ==========
  for (const behavior of behaviors) {
    try {
      // Find entity ID (case-insensitive lookup)
      const entityId = findEntityId(entityMap, behavior.entity_name);

      // Check if this behavior already exists
      const { data: existing } = await supabase
        .from('user_behaviors')
        .select('id, confidence, reinforcement_count')
        .eq('user_id', userId)
        .eq('predicate', behavior.predicate)
        .ilike('entity_name', behavior.entity_name)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        // Update: increment reinforcement count, update confidence if higher
        const newConfidence = Math.max(existing.confidence, behavior.confidence || 0.8);
        await supabase
          .from('user_behaviors')
          .update({
            confidence: newConfidence,
            reinforcement_count: existing.reinforcement_count + 1,
            last_reinforced_at: new Date().toISOString(),
            topic: behavior.topic || null, // Update topic if provided
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        results.behaviors.updated++;
        console.log(`[SaveBehaviors] Reinforced: ${behavior.predicate} → ${behavior.entity_name}`);
      } else {
        // Insert new behavior
        const { error: insertError } = await supabase
          .from('user_behaviors')
          .insert({
            user_id: userId,
            predicate: behavior.predicate,
            entity_id: entityId,
            entity_name: behavior.entity_name,
            topic: behavior.topic || null,
            sentiment: behavior.sentiment || null,
            evidence: behavior.evidence || null,
            confidence: behavior.confidence || 0.8,
            source_note_id: sourceNoteId || null,
            source_type: sourceType
          });

        if (insertError) {
          console.error(`[SaveBehaviors] Insert error:`, insertError);
          results.behaviors.errors.push({
            behavior: `${behavior.predicate} → ${behavior.entity_name}`,
            error: insertError.message
          });
          continue;
        }

        results.behaviors.saved++;
        console.log(`[SaveBehaviors] New: ${behavior.predicate} → ${behavior.entity_name} (topic: ${behavior.topic || 'none'})`);
      }
    } catch (error) {
      console.error(`[SaveBehaviors] Error:`, error);
      results.behaviors.errors.push({
        behavior: `${behavior.predicate} → ${behavior.entity_name}`,
        error: error.message
      });
    }
  }

  // ========== Save Relationship Qualities ==========
  for (const quality of relationshipQualities) {
    try {
      const entityId = findEntityId(entityMap, quality.entity_name);

      // Check if this quality already exists
      const { data: existing } = await supabase
        .from('entity_qualities')
        .select('id, confidence, reinforcement_count')
        .eq('user_id', userId)
        .eq('predicate', quality.predicate)
        .ilike('entity_name', quality.entity_name)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        // Update
        const newConfidence = Math.max(existing.confidence, quality.confidence || 0.8);
        await supabase
          .from('entity_qualities')
          .update({
            confidence: newConfidence,
            reinforcement_count: existing.reinforcement_count + 1,
            last_reinforced_at: new Date().toISOString(),
            object: quality.object, // Update object if changed
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        results.qualities.updated++;
        console.log(`[SaveBehaviors] Reinforced quality: ${quality.entity_name} ${quality.predicate} ${quality.object}`);
      } else {
        // Insert new quality
        const { error: insertError } = await supabase
          .from('entity_qualities')
          .insert({
            user_id: userId,
            entity_id: entityId,
            entity_name: quality.entity_name,
            predicate: quality.predicate,
            object: quality.object,
            confidence: quality.confidence || 0.8,
            source_note_id: sourceNoteId || null
          });

        if (insertError) {
          console.error(`[SaveBehaviors] Quality insert error:`, insertError);
          results.qualities.errors.push({
            quality: `${quality.entity_name} ${quality.predicate} ${quality.object}`,
            error: insertError.message
          });
          continue;
        }

        results.qualities.saved++;
        console.log(`[SaveBehaviors] New quality: ${quality.entity_name} ${quality.predicate} ${quality.object}`);
      }
    } catch (error) {
      console.error(`[SaveBehaviors] Quality error:`, error);
      results.qualities.errors.push({
        quality: `${quality.entity_name} ${quality.predicate} ${quality.object}`,
        error: error.message
      });
    }
  }

  const processingTime = Date.now() - startTime;

  console.log(`[SaveBehaviors] Complete in ${processingTime}ms:`, {
    behaviors: `${results.behaviors.saved} new, ${results.behaviors.updated} reinforced`,
    qualities: `${results.qualities.saved} new, ${results.qualities.updated} reinforced`
  });

  return res.status(200).json({
    success: true,
    behaviors: {
      saved: results.behaviors.saved,
      updated: results.behaviors.updated,
      errors: results.behaviors.errors.length > 0 ? results.behaviors.errors : undefined
    },
    relationshipQualities: {
      saved: results.qualities.saved,
      updated: results.qualities.updated,
      errors: results.qualities.errors.length > 0 ? results.qualities.errors : undefined
    },
    processingTime
  });
}

/**
 * Find entity ID from entityMap (case-insensitive)
 */
function findEntityId(entityMap, entityName) {
  if (!entityMap || !entityName) return null;

  return entityMap[entityName] ||
         entityMap[entityName.toLowerCase()] ||
         Object.entries(entityMap).find(([k]) =>
           k.toLowerCase() === entityName.toLowerCase()
         )?.[1] ||
         null;
}
