/**
 * MEM0 BUILD 6: Memory Consolidation API
 * Finds and merges duplicate memories
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, force = false, threshold = 0.85 } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Find all active entities with embeddings
    const { data: entities, error } = await supabase
      .from('user_entities')
      .select('id, name, summary, embedding, memory_type, importance_score, mention_count, created_at, version')
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('embedding', 'is', null);

    if (error || !entities?.length) {
      return res.json({ consolidated: 0, candidates: 0, message: 'No entities to consolidate' });
    }

    // Find similar pairs
    const candidates = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = cosineSimilarity(entities[i].embedding, entities[j].embedding);

        if (similarity >= threshold) {
          candidates.push({
            entity1: entities[i],
            entity2: entities[j],
            similarity
          });
        }
      }
    }

    if (candidates.length === 0) {
      return res.json({ consolidated: 0, candidates: 0, message: 'No duplicate memories found' });
    }

    if (!force) {
      // Return candidates for review
      return res.json({
        consolidated: 0,
        candidates: candidates.length,
        preview: candidates.slice(0, 10).map(c => ({
          entity1: { id: c.entity1.id, name: c.entity1.name, summary: c.entity1.summary },
          entity2: { id: c.entity2.id, name: c.entity2.name, summary: c.entity2.summary },
          similarity: (c.similarity * 100).toFixed(1) + '%'
        })),
        message: 'Run with force=true to consolidate'
      });
    }

    // Consolidate
    const results = [];

    for (const candidate of candidates) {
      try {
        // Determine which to keep (higher importance + more mentions + older)
        const score1 = (candidate.entity1.importance_score || 0.5) +
                       (candidate.entity1.mention_count || 0) * 0.01 +
                       (new Date() - new Date(candidate.entity1.created_at)) / (1000 * 60 * 60 * 24 * 365);
        const score2 = (candidate.entity2.importance_score || 0.5) +
                       (candidate.entity2.mention_count || 0) * 0.01 +
                       (new Date() - new Date(candidate.entity2.created_at)) / (1000 * 60 * 60 * 24 * 365);

        const keeper = score1 >= score2 ? candidate.entity1 : candidate.entity2;
        const merged = score1 >= score2 ? candidate.entity2 : candidate.entity1;

        // Use Claude to merge the summaries intelligently
        const mergeResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Merge these two memory entries about the same thing into one concise summary:

Memory 1: "${keeper.summary}"
Memory 2: "${merged.summary}"

Write a single merged summary that preserves all unique information. Keep it concise (1-2 sentences).`
          }]
        });

        const mergedSummary = mergeResponse.content[0]?.text || keeper.summary;

        // Update keeper
        await supabase
          .from('user_entities')
          .update({
            summary: mergedSummary,
            importance_score: Math.max(keeper.importance_score || 0.5, merged.importance_score || 0.5),
            mention_count: (keeper.mention_count || 0) + (merged.mention_count || 0),
            version: (keeper.version || 1) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', keeper.id);

        // Archive merged entity
        await supabase
          .from('user_entities')
          .update({
            status: 'archived',
            superseded_by: keeper.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', merged.id);

        // Log operation
        await supabase
          .from('memory_operations')
          .insert({
            user_id: userId,
            operation: 'CONSOLIDATE',
            candidate_fact: merged.summary,
            llm_reasoning: `Merged with ${keeper.name} (${(candidate.similarity * 100).toFixed(1)}% similar)`,
            entity_id: keeper.id,
            merged_entity_ids: [merged.id],
            kept_entity_id: keeper.id,
            old_content: merged.summary,
            new_content: mergedSummary
          });

        results.push({
          kept: keeper.id,
          merged: merged.id,
          similarity: candidate.similarity,
          new_summary: mergedSummary
        });

      } catch (err) {
        console.error('Consolidation error:', err);
        results.push({
          error: err.message,
          entity1: candidate.entity1.id,
          entity2: candidate.entity2.id
        });
      }
    }

    return res.json({
      consolidated: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results
    });

  } catch (error) {
    console.error('Consolidation error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
