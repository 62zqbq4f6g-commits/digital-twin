/**
 * SEMANTIC DISTILLATION API
 *
 * Phase 19 - Post-RAG Architecture
 *
 * PURPOSE: Convert old episodes (notes) into permanent SPO triples
 * before archiving. This preserves the KNOWLEDGE without the raw text.
 *
 * EXAMPLE:
 * OLD EPISODE: "Had a great call with Marcus about the Anthropic partnership.
 *              He thinks we should focus on enterprise first."
 *
 * DISTILLED TO:
 * - Marcus → advises → "focus on enterprise first" (confidence: 0.9)
 * - Marcus → has_opinion → "enterprise-first strategy"
 * - User → trusts_opinion_of → Marcus (topic: AI strategy)
 *
 * WHY:
 * - Old notes become permanent knowledge, not discarded history
 * - Token budget stays manageable
 * - Patterns survive beyond the recency window
 * - "What happened" becomes "what we learned"
 *
 * OWNER: T1 (Extraction)
 * CONSUMERS: Background jobs, manual archive triggers
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

/**
 * Distill an episode (note) into structured knowledge
 * @param {string} content - The note content
 * @param {object} existingEntities - Known entities for context
 * @returns {Promise<object>} Distilled knowledge
 */
async function distillEpisode(content, existingEntities = []) {
  const entityContext = existingEntities.length > 0
    ? `Known entities: ${existingEntities.map(e => e.name).join(', ')}`
    : 'No known entities';

  const prompt = `You are extracting permanent knowledge from a personal note/episode.

${entityContext}

NOTE CONTENT:
${content}

Extract KNOWLEDGE that should persist even after the raw text is archived:

1. ENTITY_FACTS: What do we learn ABOUT entities mentioned?
   Format: { entity_name, predicate, object, confidence }
   Predicates: works_at, lives_in, has_opinion, knows, relationship_to, role_is, etc.

2. USER_BEHAVIORS: How does the USER relate to entities?
   Format: { predicate, entity_name, topic, sentiment }
   Predicates: trusts_opinion_of, seeks_advice_from, relies_on, learns_from, inspired_by, feels_about, conflicted_about

3. ENTITY_QUALITIES: How do entities relate to/affect the USER?
   Format: { entity_name, predicate, object }
   Predicates: helps_with, supports, mentors, challenges, energizes, drains

4. PATTERNS: What recurring patterns or insights emerge?
   Format: { pattern_type, description, confidence }
   Types: decision, emotional, behavioral, relational

5. SUMMARY: One sentence capturing the key insight from this episode.

Return JSON:
{
  "entity_facts": [...],
  "user_behaviors": [...],
  "entity_qualities": [...],
  "patterns": [...],
  "summary": "..."
}

Extract meaningful knowledge only. Skip trivial details. Focus on insights that would help understand this person better over time.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0]?.text || '{}';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[distill-episode] No JSON found in response');
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[distill-episode] Distillation error:', error.message);
    return null;
  }
}

/**
 * Save distilled knowledge to database
 */
async function saveDistilledKnowledge(userId, noteId, distilled) {
  const results = {
    factsCreated: 0,
    behaviorsCreated: 0,
    qualitiesCreated: 0,
    patternsCreated: 0,
    errors: []
  };

  // Save entity facts
  for (const fact of (distilled.entity_facts || [])) {
    try {
      // Find or create entity
      let entityId = null;
      const { data: existingEntity } = await supabase
        .from('user_entities')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', fact.entity_name)
        .single();

      if (existingEntity) {
        entityId = existingEntity.id;
      } else {
        const { data: newEntity } = await supabase
          .from('user_entities')
          .insert({
            user_id: userId,
            name: fact.entity_name,
            entity_type: 'person', // Default, can be updated
            source: 'distillation'
          })
          .select('id')
          .single();
        entityId = newEntity?.id;
      }

      if (entityId) {
        await supabase
          .from('entity_facts')
          .upsert({
            user_id: userId,
            entity_id: entityId,
            predicate: fact.predicate,
            object_text: fact.object,
            confidence: fact.confidence || 0.8,
            source_note_id: noteId,
            source_type: 'distillation'
          }, { onConflict: 'user_id,entity_id,predicate,object_text' });
        results.factsCreated++;
      }
    } catch (err) {
      results.errors.push({ type: 'fact', error: err.message });
    }
  }

  // Save user behaviors
  for (const behavior of (distilled.user_behaviors || [])) {
    try {
      // Find entity if exists
      const { data: entity } = await supabase
        .from('user_entities')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', behavior.entity_name)
        .single();

      await supabase
        .from('user_behaviors')
        .upsert({
          user_id: userId,
          predicate: behavior.predicate,
          entity_id: entity?.id || null,
          entity_name: behavior.entity_name,
          topic: behavior.topic || null,
          sentiment: behavior.sentiment || 0,
          confidence: 0.8,
          source_note_id: noteId,
          source_type: 'distillation',
          status: 'active',
          reinforcement_count: 1,
          first_detected_at: new Date().toISOString(),
          last_reinforced_at: new Date().toISOString()
        }, { onConflict: 'user_id,predicate,entity_name' });
      results.behaviorsCreated++;
    } catch (err) {
      results.errors.push({ type: 'behavior', error: err.message });
    }
  }

  // Save entity qualities
  for (const quality of (distilled.entity_qualities || [])) {
    try {
      const { data: entity } = await supabase
        .from('user_entities')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', quality.entity_name)
        .single();

      await supabase
        .from('entity_qualities')
        .upsert({
          user_id: userId,
          entity_id: entity?.id || null,
          entity_name: quality.entity_name,
          predicate: quality.predicate,
          object: quality.object,
          confidence: 0.8,
          source_note_id: noteId,
          status: 'active',
          reinforcement_count: 1,
          first_detected_at: new Date().toISOString(),
          last_reinforced_at: new Date().toISOString()
        }, { onConflict: 'user_id,entity_name,predicate' });
      results.qualitiesCreated++;
    } catch (err) {
      results.errors.push({ type: 'quality', error: err.message });
    }
  }

  // Save patterns
  for (const pattern of (distilled.patterns || [])) {
    try {
      await supabase
        .from('user_patterns')
        .insert({
          user_id: userId,
          pattern_type: pattern.pattern_type,
          description: pattern.description,
          short_description: pattern.description.substring(0, 100),
          confidence: pattern.confidence || 0.7,
          status: 'active',
          evidence: { source_note_id: noteId, source_type: 'distillation' }
        });
      results.patternsCreated++;
    } catch (err) {
      // Patterns might already exist, which is fine
      if (!err.message.includes('duplicate')) {
        results.errors.push({ type: 'pattern', error: err.message });
      }
    }
  }

  return results;
}

/**
 * Mark a note as distilled (archived)
 */
async function markNoteAsDistilled(noteId, distilledSummary) {
  try {
    await supabase
      .from('notes')
      .update({
        is_distilled: true,
        distilled_summary: distilledSummary,
        distilled_at: new Date().toISOString()
      })
      .eq('id', noteId);
    return true;
  } catch (error) {
    console.error('[distill-episode] Error marking note as distilled:', error.message);
    return false;
  }
}

/**
 * Get notes eligible for distillation
 * Criteria: older than threshold, not already distilled
 */
async function getNotesForDistillation(userId, ageInDays = 30, limit = 10) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ageInDays);

  const { data, error } = await supabase
    .from('notes')
    .select('id, content, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or('is_distilled.is.null,is_distilled.eq.false')
    .lt('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[distill-episode] Error fetching notes:', error.code);
    return [];
  }

  return data || [];
}

/**
 * API Handler
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;
    const { action, noteId, content, ageInDays = 30, limit = 10 } = req.body;

    // Action: List notes eligible for distillation
    if (action === 'list') {
      const notes = await getNotesForDistillation(userId, ageInDays, limit);
      return res.json({
        notes: notes.map(n => ({
          id: n.id,
          created_at: n.created_at,
          preview: n.content?.substring(0, 100) + '...'
        })),
        count: notes.length
      });
    }

    // Action: Distill a single note by ID
    if (action === 'distill_note' && noteId) {
      // Get the note
      const { data: note, error: noteError } = await supabase
        .from('notes')
        .select('id, content')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (noteError || !note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Get existing entities for context
      const { data: entities } = await supabase
        .from('user_entities')
        .select('id, name, entity_type')
        .eq('user_id', userId)
        .limit(50);

      // Distill the note
      const distilled = await distillEpisode(note.content, entities || []);
      if (!distilled) {
        return res.status(500).json({ error: 'Distillation failed' });
      }

      // Save the knowledge
      const saveResults = await saveDistilledKnowledge(userId, noteId, distilled);

      // Mark as distilled
      await markNoteAsDistilled(noteId, distilled.summary);

      return res.json({
        success: true,
        noteId,
        distilled,
        saved: saveResults
      });
    }

    // Action: Batch distill old notes
    if (action === 'batch') {
      const notes = await getNotesForDistillation(userId, ageInDays, limit);

      if (notes.length === 0) {
        return res.json({
          success: true,
          message: 'No notes eligible for distillation',
          processed: 0
        });
      }

      // Get existing entities for context
      const { data: entities } = await supabase
        .from('user_entities')
        .select('id, name, entity_type')
        .eq('user_id', userId)
        .limit(50);

      const results = {
        processed: 0,
        factsTotal: 0,
        behaviorsTotal: 0,
        qualitiesTotal: 0,
        patternsTotal: 0,
        errors: []
      };

      for (const note of notes) {
        try {
          const distilled = await distillEpisode(note.content, entities || []);
          if (distilled) {
            const saveResults = await saveDistilledKnowledge(userId, note.id, distilled);
            await markNoteAsDistilled(note.id, distilled.summary);

            results.processed++;
            results.factsTotal += saveResults.factsCreated;
            results.behaviorsTotal += saveResults.behaviorsCreated;
            results.qualitiesTotal += saveResults.qualitiesCreated;
            results.patternsTotal += saveResults.patternsCreated;
          }
        } catch (err) {
          results.errors.push({ noteId: note.id, error: err.message });
        }
      }

      console.log('[distill-episode] Batch complete:', results);
      return res.json({ success: true, ...results });
    }

    // Action: Preview distillation without saving (for testing)
    if (action === 'preview' && content) {
      const { data: entities } = await supabase
        .from('user_entities')
        .select('id, name, entity_type')
        .eq('user_id', userId)
        .limit(50);

      const distilled = await distillEpisode(content, entities || []);
      return res.json({ distilled });
    }

    return res.status(400).json({ error: 'Invalid action. Use: list, distill_note, batch, or preview' });

  } catch (error) {
    console.error('[distill-episode] Handler error:', error);
    return res.status(500).json({ error: 'Distillation failed' });
  }
}

// Export for use in background jobs
export { distillEpisode, saveDistilledKnowledge, markNoteAsDistilled, getNotesForDistillation };
