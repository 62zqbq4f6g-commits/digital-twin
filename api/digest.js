// api/digest.js — Vercel Serverless Function for Weekly Digest
// Generates AI-powered weekly summary of notes with contradiction detection

const { createClient } = require('@supabase/supabase-js');
const { detectContradictions, formatForContext } = require('../lib/contradiction-detection');
const { setCorsHeaders, handlePreflight } = require('./lib/cors.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    // Use authenticated user ID (ignore user_id from body)
    const { notes, weekStart, weekEnd } = req.body;
    const user_id = user.id;

    if (!notes || notes.length === 0) {
      return res.status(400).json({ error: 'No notes provided' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    // Detect weekly contradictions/evolutions if user_id provided
    let contradictions = { contradictions: [], sentimentShifts: [], evolutions: [] };
    if (user_id) {
      try {
        contradictions = await detectContradictions(user_id, { scope: 'weekly' });
      } catch (err) {
        console.warn('[Digest] Contradiction detection failed:', err.message);
      }
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return res.status(500).json({ error: 'API not configured' });
    }

    // Build evolution context if any detected
    const evolutionContext = formatForContext(contradictions);
    const evolutionPrompt = evolutionContext
      ? `\n\nEVOLUTIONS DETECTED THIS WEEK:\n${evolutionContext}\nInclude relevant evolutions in the "evolutions" field.`
      : '';

    const prompt = `Generate a weekly digest from these notes. Be concise and insightful.

Notes from ${weekStart} to ${weekEnd}:

${JSON.stringify(notes, null, 2)}${evolutionPrompt}

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "overview": "2-3 sentence overview of the week. Mention total notes and general themes.",
  "categories": [
    {
      "name": "work",
      "count": 5,
      "themes": "Main themes (comma separated)",
      "highlights": ["Key highlight 1", "Key highlight 2"]
    },
    {
      "name": "health",
      "count": 3,
      "mood": "Overall mood trend (Positive/Neutral/Negative)"
    },
    {
      "name": "personal",
      "count": 2,
      "highlights": ["Highlight 1"]
    },
    {
      "name": "ideas",
      "count": 1,
      "highlights": ["Idea 1"]
    }
  ],
  "action_items": ["All open action items from the week"],
  "insights": "Optional: Any patterns or insights noticed (1-2 sentences)",
  "evolutions": ["Optional: Any changes in opinion, sentiment shifts, or contradictions noticed this week vs last week"]
}

Only include categories that have notes. Be specific to the actual content.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return res.status(500).json({ error: 'Digest generation failed' });
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Parse JSON
    let digest;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      digest = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback digest
      digest = {
        overview: `You captured ${notes.length} notes this week.`,
        categories: [],
        action_items: notes.flatMap(n => n.action_items || []),
        insights: ''
      };
    }

    return res.status(200).json(digest);

  } catch (error) {
    console.error('Digest handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
