/**
 * PHASE 10.3: Embedding Generation API
 * Uses OpenAI text-embedding-3-small for 1536-dimension vectors
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || text.trim().length < 3) {
    return res.status(400).json({ error: 'Text required (min 3 characters)' });
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('[Embed API] OPENAI_API_KEY not configured');
    return res.status(500).json({ error: 'Embedding service not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // Max 8k chars for safety
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Embed API] OpenAI error:', error);
      return res.status(500).json({ error: 'Embedding generation failed' });
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    console.log(`[Embed API] Generated embedding for ${text.substring(0, 30)}... (${embedding.length} dims)`);

    return res.status(200).json({ embedding });

  } catch (err) {
    console.error('[Embed API] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
