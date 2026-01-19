/**
 * PHASE 10.6: Cross-Memory Reasoning API
 * Infers connections between entities based on context
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { entities, relationships, recentNotes } = req.body;

  if (!entities || entities.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 entities to infer connections' });
  }

  const entitiesContext = entities.map(e =>
    `- ${e.name} (${e.entity_type}): ${e.summary || e.context_notes?.slice(-2).join(' ') || 'No context'}`
  ).join('\n');

  const relationshipsContext = relationships?.length > 0
    ? `\nKnown relationships:\n${relationships.map(r => `- ${r.subject_name} ${r.predicate} ${r.object_name}`).join('\n')}`
    : '';

  const notesContext = recentNotes?.length > 0
    ? `\nRecent notes:\n${recentNotes.slice(0, 5).map((n, i) => `${i + 1}. ${n.content?.substring(0, 200)}`).join('\n')}`
    : '';

  const prompt = `Analyze these entities from a user's personal notes and infer any connections or patterns that aren't explicitly stated.

Entities:
${entitiesContext}
${relationshipsContext}
${notesContext}

Look for:
1. Implicit connections (e.g., two people who might know each other based on context)
2. Shared attributes (e.g., both work in tech, both mentioned in work contexts)
3. Patterns (e.g., user mentions this person when stressed)
4. Predictions (e.g., these two might be introduced soon based on context)

Return JSON only, no markdown:
{
  "inferences": [
    {
      "type": "connection|pattern|prediction",
      "entities": ["entity1", "entity2"],
      "inference": "clear statement of what you inferred",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}

Only include high-confidence (>0.6) inferences. Be conservative - don't make wild guesses.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('[Infer API] Parse error:', parseErr);
      return res.status(200).json({ inferences: [] });
    }

    // Filter low confidence
    result.inferences = (result.inferences || []).filter(i => i.confidence >= 0.6);

    console.log('[Infer API] Generated', result.inferences.length, 'inferences');

    return res.status(200).json(result);

  } catch (err) {
    console.error('[Infer API] Error:', err);
    return res.status(500).json({ error: 'Inference failed' });
  }
}
