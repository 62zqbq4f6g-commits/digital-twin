/**
 * PHASE 10.5: LLM Memory Compression API
 * Generates intelligent summaries for entities with multiple mentions
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - require Bearer token to prevent API credit abuse
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const { entityName, entityType, contextNotes, relationships } = req.body;

  if (!entityName || !contextNotes || contextNotes.length < 2) {
    return res.status(400).json({ error: 'Insufficient data for compression (need entityName and at least 2 contextNotes)' });
  }

  // Build relationship context
  const relationshipText = relationships?.length > 0
    ? `\nKnown relationships:\n${relationships.map(r => `- ${r.predicate}: ${r.object_name}${r.role ? ` (${r.role})` : ''}`).join('\n')}`
    : '';

  const prompt = `Create a concise, insightful summary of what the user knows about ${entityName}.

Entity type: ${entityType || 'unknown'}
${relationshipText}

Context from user's notes (chronological order, oldest first):
${contextNotes.slice(0, 10).map((note, i) => `${i + 1}. ${note}`).join('\n')}

Write a 2-3 sentence summary that:
1. Captures who/what ${entityName} is to the user (their relationship)
2. Notes any significant changes or evolution over time
3. Highlights what seems most important or memorable

Guidelines:
- Be specific, not generic
- Write as if describing to the user what they know about this ${entityType || 'entity'}
- Use "your" language (e.g., "Your coworker Sarah..." not "Sarah is a coworker...")
- If there are changes (job change, moved, etc.), mention the progression
- Keep it natural and conversational

Summary:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const summary = response.content[0].text.trim();

    console.log(`[Compress API] Generated summary for entity`, { summaryLength: summary.length });

    return res.status(200).json({ summary });

  } catch (err) {
    console.error('[Compress API] Error:', err);
    return res.status(500).json({ error: 'Compression failed' });
  }
}
