/**
 * PHASE 10.7: Importance Classification API
 * Classifies entity importance using LLM
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { entity } = req.body;

  if (!entity || !entity.name) {
    return res.status(400).json({ error: 'Entity required' });
  }

  const prompt = `Classify the importance of this entity to the user based on available context.

Entity: ${entity.name}
Type: ${entity.entity_type || 'unknown'}
Relationship: ${entity.relationship || 'unknown'}
Mentioned: ${entity.mention_count || 1} times
Context: ${(entity.context_notes || []).slice(-3).join(' | ')}

Importance levels:
- critical: Immediate family, partners, best friends, self, critical work relationships
- high: Close friends, important colleagues, significant projects, pets
- medium: Regular contacts, ongoing projects, recurring topics
- low: Acquaintances, one-time mentions, background people
- trivial: Random names, places mentioned in passing, unlikely to matter again

Return JSON only:
{
  "importance": "critical|high|medium|low|trivial",
  "importance_score": 0.0-1.0,
  "reasoning": "brief explanation",
  "signals": ["list", "of", "importance", "signals"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('[Importance API] Parse error:', parseErr);
      return res.status(200).json({
        importance: 'medium',
        importance_score: 0.5,
        reasoning: 'Parse failed, defaulting to medium'
      });
    }

    console.log(`[Importance API] ${entity.name}: ${result.importance} (${result.importance_score})`);

    return res.status(200).json(result);

  } catch (err) {
    console.error('[Importance API] Error:', err);
    return res.status(500).json({ error: 'Classification failed' });
  }
}
