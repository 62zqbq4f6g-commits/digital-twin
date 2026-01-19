/**
 * PHASE 10.4: LLM Entity Extraction API
 * Replaces regex patterns with Claude for intelligent extraction
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, knownEntities = [] } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  // Build context about known entities
  const knownContext = knownEntities.length > 0
    ? `\nKnown entities (reference these if mentioned): ${knownEntities.map(e => e.name || e).join(', ')}`
    : '';

  const prompt = `Extract entities and relationships from this personal note. Be thorough but accurate. Only extract what is clearly stated or strongly implied.
${knownContext}

Note: "${text}"

Return JSON only, no markdown code blocks:
{
  "entities": [
    {
      "name": "string (proper name, capitalized)",
      "type": "person|company|place|project|pet|event|other",
      "relationship": "string describing relationship to the note author (e.g., 'coworker', 'friend', 'client', 'my dog')",
      "context": "relevant context from this specific note",
      "sentiment": "positive|neutral|negative|mixed",
      "importance": "high|medium|low"
    }
  ],
  "relationships": [
    {
      "subject": "entity name",
      "predicate": "works_at|knows|reports_to|lives_in|partner_of|friends_with|manages|left|joined|owns|created",
      "object": "entity name or value",
      "role": "optional role/title if mentioned"
    }
  ],
  "changes_detected": [
    {
      "entity": "name of entity that changed",
      "change_type": "job|location|relationship|status",
      "old_value": "previous value if known from context",
      "new_value": "new value from this note"
    }
  ]
}

Rules:
- Only extract named entities (people, companies, places with proper names)
- Do not extract generic terms like "the meeting" or "my work"
- For people, include first names even without last names (e.g., "Sarah", "Marcus")
- Detect changes like "Sarah left Google" or "moved to Brooklyn"
- If unsure about a relationship, use "mentioned" as the predicate
- Empty arrays are fine if nothing is detected`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    // Parse JSON from response
    let result;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('[Extract API] Parse error:', parseErr.message);
      console.error('[Extract API] Raw content:', content.substring(0, 200));
      return res.status(200).json({ entities: [], relationships: [], changes_detected: [] });
    }

    // Ensure all arrays exist
    result.entities = result.entities || [];
    result.relationships = result.relationships || [];
    result.changes_detected = result.changes_detected || [];

    console.log('[Extract API] Extracted:', {
      entities: result.entities.length,
      relationships: result.relationships.length,
      changes: result.changes_detected.length
    });

    return res.status(200).json(result);

  } catch (err) {
    console.error('[Extract API] Error:', err);
    return res.status(500).json({ error: 'Extraction failed' });
  }
}
