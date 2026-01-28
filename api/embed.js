/**
 * DEPRECATED: Embedding Generation API
 *
 * Phase 19 - Post-RAG Architecture
 *
 * This endpoint is DEPRECATED as of v9.12.0.
 * Inscript now uses full context loading instead of RAG/embeddings.
 *
 * The endpoint still works for backward compatibility but:
 * - Logs deprecation warnings
 * - Will be removed in a future version
 * - New features should NOT use embeddings
 *
 * Migration path: Use /api/context/full for full context loading
 */

// Feature flag to completely disable embedding generation
const EMBEDDINGS_DISABLED = process.env.DISABLE_EMBEDDINGS === 'true';

export default async function handler(req, res) {
  // Log deprecation warning
  console.warn('[Embed API] DEPRECATED: This endpoint is deprecated. Use /api/context/full instead.');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // If embeddings are completely disabled, return gracefully
  if (EMBEDDINGS_DISABLED) {
    console.warn('[Embed API] Embeddings are disabled. Returning empty embedding.');
    return res.status(200).json({
      embedding: new Array(1536).fill(0),
      deprecated: true,
      message: 'Embeddings are deprecated. Use /api/context/full for full context loading.'
    });
  }

  const { text } = req.body;

  if (!text || text.trim().length < 3) {
    return res.status(400).json({ error: 'Text required (min 3 characters)' });
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('[Embed API] OPENAI_API_KEY not configured');
    // In deprecated mode, return zero vector instead of error
    return res.status(200).json({
      embedding: new Array(1536).fill(0),
      deprecated: true,
      message: 'Embedding service not configured. Embeddings are deprecated.'
    });
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
      // In deprecated mode, return zero vector instead of error
      return res.status(200).json({
        embedding: new Array(1536).fill(0),
        deprecated: true,
        message: 'Embedding generation failed. Embeddings are deprecated.'
      });
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    console.log(`[Embed API] DEPRECATED: Generated embedding`, { inputLength: text.length, dims: embedding.length });

    return res.status(200).json({
      embedding,
      deprecated: true,
      message: 'This endpoint is deprecated. Migrate to /api/context/full.'
    });

  } catch (err) {
    console.error('[Embed API] Error:', err);
    // In deprecated mode, return zero vector instead of error
    return res.status(200).json({
      embedding: new Array(1536).fill(0),
      deprecated: true,
      message: 'Internal error. Embeddings are deprecated.'
    });
  }
}
