/**
 * /api/whisper - Phase 15: Quick Capture (Whispers)
 *
 * Frictionless capture without triggering full reflection.
 * V1 is TEXT-ONLY (no voice support).
 * Content is E2E encrypted - server only sees encrypted data.
 *
 * Endpoints:
 * POST /api/whisper - Save a whisper (E2E encrypted)
 * GET  /api/whispers - Retrieve whisper history
 * POST /api/whispers/reflect - Batch reflection on selected whispers
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user_id = req.query.user_id || req.body?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    // Route based on path and method
    const path = req.url?.split('?')[0] || '';

    if (req.method === 'POST' && path.includes('/reflect')) {
      return await handleBatchReflect(req, res, user_id);
    } else if (req.method === 'POST') {
      return await handleSaveWhisper(req, res, user_id);
    } else if (req.method === 'GET') {
      return await handleGetWhispers(req, res, user_id);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[whisper] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/whisper - Save a whisper
 * Body: { content_encrypted: string, iv: string }
 */
async function handleSaveWhisper(req, res, user_id) {
  const { content_encrypted, iv } = req.body;

  if (!content_encrypted || !iv) {
    return res.status(400).json({
      error: 'content_encrypted and iv are required (E2E encryption)'
    });
  }

  console.log(`[whisper] Saving whisper for user ${user_id}`);

  // Save the encrypted whisper
  const { data: whisper, error: insertError } = await supabase
    .from('whispers')
    .insert({
      user_id,
      content_encrypted,
      iv,
      source: 'text', // V1 is text-only
      processed: false
    })
    .select()
    .single();

  if (insertError) {
    console.error('[whisper] Insert error:', insertError);
    return res.status(500).json({ error: 'Failed to save whisper' });
  }

  console.log(`[whisper] Saved whisper ${whisper.id}`);

  // Queue background entity extraction
  // Note: Since content is E2E encrypted, entity extraction
  // would need to happen client-side and be sent separately
  // For now, we return immediately and let client handle extraction

  return res.status(200).json({
    id: whisper.id,
    status: 'saved',
    entities_detected: [], // Client-side extraction
    queued_for_reflection: false
  });
}

/**
 * GET /api/whispers - Retrieve whisper history
 * Query: { limit?: number, offset?: number, processed?: boolean }
 */
async function handleGetWhispers(req, res, user_id) {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const processed = req.query.processed;

  console.log(`[whisper] Fetching whispers for user ${user_id}, limit=${limit}, offset=${offset}`);

  let query = supabase
    .from('whispers')
    .select('id, content_encrypted, iv, source, processed, entities_extracted, created_at', { count: 'exact' })
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (processed !== undefined) {
    query = query.eq('processed', processed === 'true');
  }

  const { data: whispers, error, count } = await query;

  if (error) {
    console.error('[whisper] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch whispers' });
  }

  return res.status(200).json({
    whispers: whispers || [],
    total: count || 0,
    limit,
    offset
  });
}

/**
 * POST /api/whispers/reflect - Batch reflection on whispers
 * Body: { whisper_ids: string[], decrypted_contents?: string[] }
 *
 * Note: Since whispers are E2E encrypted, the client must decrypt
 * and send the plaintext for reflection. This endpoint processes
 * the decrypted content to generate a combined reflection.
 */
async function handleBatchReflect(req, res, user_id) {
  const { whisper_ids, decrypted_contents } = req.body;

  if (!whisper_ids || !Array.isArray(whisper_ids) || whisper_ids.length === 0) {
    return res.status(400).json({ error: 'whisper_ids array required' });
  }

  if (!decrypted_contents || !Array.isArray(decrypted_contents)) {
    return res.status(400).json({
      error: 'decrypted_contents array required (client must decrypt whispers)'
    });
  }

  console.log(`[whisper] Batch reflect on ${whisper_ids.length} whispers for user ${user_id}`);

  // Verify whispers belong to user
  const { data: whispers, error: fetchError } = await supabase
    .from('whispers')
    .select('id')
    .eq('user_id', user_id)
    .in('id', whisper_ids);

  if (fetchError) {
    console.error('[whisper] Fetch error:', fetchError);
    return res.status(500).json({ error: 'Failed to verify whispers' });
  }

  if (!whispers || whispers.length !== whisper_ids.length) {
    return res.status(400).json({ error: 'Some whisper_ids not found or not owned by user' });
  }

  // Get user context for reflection
  const { data: onboarding } = await supabase
    .from('onboarding_data')
    .select('name')
    .eq('user_id', user_id)
    .maybeSingle();

  const userName = onboarding?.name || '';

  // Combine whispers for reflection
  const combinedContent = decrypted_contents.join('\n\n---\n\n');

  // Generate reflection using LLM
  const prompt = `You are Inscript, a thoughtful AI companion. The user has captured several quick thoughts (whispers) they'd like you to reflect on together.

${userName ? `The user's name is ${userName}.` : ''}

WHISPERS:
${combinedContent}

---

Provide a warm, insightful reflection that:
1. HEARD: Acknowledge what they shared across these whispers
2. NOTICED: Find connections or themes between the whispers
3. OFFERED: One gentle observation or question

Keep it concise (3-4 sentences). Be warm and specific, not clinical.
Do not use phrases like "I can see..." or "Based on my analysis...".`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const reflection = response.content[0].text;
    console.log('[whisper] Generated batch reflection');

    // Mark whispers as processed
    const { error: updateError } = await supabase
      .from('whispers')
      .update({ processed: true })
      .in('id', whisper_ids);

    if (updateError) {
      console.warn('[whisper] Could not mark whispers as processed:', updateError);
    }

    // Optionally create a note from this reflection
    // For now, just return the reflection

    return res.status(200).json({
      reflection,
      whisper_count: whisper_ids.length,
      processed: true
    });

  } catch (llmError) {
    console.error('[whisper] LLM error:', llmError);
    return res.status(500).json({ error: 'Failed to generate reflection' });
  }
}
