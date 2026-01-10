// api/digest.js — Vercel Serverless Function for Weekly Digest
// Generates AI-powered weekly summary of notes

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { notes, weekStart, weekEnd } = req.body;

    if (!notes || notes.length === 0) {
      return res.status(400).json({ error: 'No notes provided' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return res.status(500).json({ error: 'API not configured' });
    }

    const prompt = `Generate a weekly digest from these notes. Be concise and insightful.

Notes from ${weekStart} to ${weekEnd}:

${JSON.stringify(notes, null, 2)}

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
  "insights": "Optional: Any patterns or insights noticed (1-2 sentences)"
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
