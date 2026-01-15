/**
 * /api/classify-feedback - Classifies why user liked/disliked output
 */

const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { input, output, rating, comment } = req.body;

  if (!output || !rating) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const prompt = `A user gave feedback on an AI-generated insight.

INPUT NOTE:
"${input || 'Not provided'}"

OUTPUT THAT RECEIVED ${rating.toUpperCase()}:
- Summary: "${output.summary || ''}"
- Insight: "${output.insight || ''}"
- Question: "${output.question || 'null'}"

USER COMMENT: ${comment || 'None provided'}

Why did the user ${rating === 'liked' ? 'LIKE' : 'DISLIKE'} this output?

Choose the SINGLE most likely reason:

${rating === 'liked' ? `
POSITIVE REASONS:
- pattern_connection: Connected insight to their patterns/history
- specific_question: Asked a concrete, actionable question
- tension_surfacing: Named a tradeoff they hadn't articulated
- non_obvious_insight: Revealed something they hadn't considered
- systems_thinking: Framed as system/structure, not just motivation
- concise: Got to the point efficiently
` : `
NEGATIVE REASONS:
- too_generic: Could apply to almost anyone/any note
- obvious_observation: They already knew this
- vague_question: Question wasn't specific or actionable
- missed_point: Didn't understand what they meant
- too_verbose: Used too many words
- wrong_tone: Felt robotic, preachy, or condescending
`}

Respond with ONLY the reason code (e.g., "pattern_connection" or "too_generic").`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const reason = message.content[0].text.trim().toLowerCase().replace(/[^a-z_]/g, '');

    // Validate reason
    const validReasons = [
      'pattern_connection', 'specific_question', 'tension_surfacing',
      'non_obvious_insight', 'systems_thinking', 'concise',
      'too_generic', 'obvious_observation', 'vague_question',
      'missed_point', 'too_verbose', 'wrong_tone'
    ];

    const finalReason = validReasons.includes(reason)
      ? reason
      : (rating === 'liked' ? 'non_obvious_insight' : 'too_generic');

    return res.status(200).json({ reason: finalReason });

  } catch (error) {
    console.error('Classify feedback error:', error);
    // Fallback
    return res.status(200).json({
      reason: rating === 'liked' ? 'non_obvious_insight' : 'too_generic'
    });
  }
};
