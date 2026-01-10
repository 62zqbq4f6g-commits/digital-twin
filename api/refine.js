// api/refine.js — Vercel Serverless Function
// This keeps your API key secure on the server

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { rawText, inputType } = req.body;

  if (!rawText || rawText.trim().length === 0) {
    return res.status(400).json({ error: 'No input text provided' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  const systemPrompt = `You are a professional note processor for a Digital Twin app. Your job is to transform raw voice/text input into clean, structured, professional notes.

RULES:
1. Analyze the input and determine the category: personal, work, health, or ideas
2. Extract a clear, professional title (max 50 characters)
3. Write a 2-3 sentence executive summary
4. Extract key points (bullet points, max 6)
5. Extract action items (tasks the user needs to do, max 6)
6. Extract ONLY real people names mentioned (not places, companies, or common words)
7. Determine sentiment: positive, negative, or neutral
8. Remove filler words (um, uh, like, so yeah) from all output

OUTPUT FORMAT (respond with ONLY this JSON, no other text):
{
  "category": "work|personal|health|ideas",
  "confidence": 0.0-1.0,
  "title": "Clean Professional Title",
  "summary": "2-3 sentence professional summary.",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "action_items": ["Action 1", "Action 2"],
  "people": ["Real Person Name"],
  "sentiment": "positive|negative|neutral",
  "topics": ["topic1", "topic2"]
}

IMPORTANT:
- For "people", only include actual human names (e.g., "Mario Ho", "John Smith"), NOT places like "Hong Kong", NOT words like "Context" or "Trust"
- Keep action items clean and actionable, not messy fragments
- The summary should be professional enough to share with a team
- If the input is about a meeting, focus on outcomes and next steps`;

  const userPrompt = `Process this ${inputType || 'text'} input into a structured note:

---
${rawText}
---

Remember: Output ONLY valid JSON, no markdown, no explanation.`;

  try {
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
          {
            role: 'user',
            content: userPrompt
          }
        ],
        system: systemPrompt
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', errorData);
      return res.status(500).json({ error: 'AI processing failed' });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response
    let parsed;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('API call failed:', error);
    return res.status(500).json({ error: 'Processing failed' });
  }
}
