/**
 * /api/whisper-reflect - Batch reflection for whispers
 * Phase 15: Quick Capture
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, whisper_ids, decrypted_contents } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  if (!whisper_ids || !Array.isArray(whisper_ids) || whisper_ids.length === 0) {
    return res.status(400).json({ error: 'whisper_ids array required' });
  }

  if (!decrypted_contents || !Array.isArray(decrypted_contents)) {
    return res.status(400).json({
      error: 'decrypted_contents array required (client must decrypt whispers)'
    });
  }

  console.log(`[whisper-reflect] Batch reflect on ${whisper_ids.length} whispers for user ${user_id}`);

  try {
    // Verify whispers belong to user
    const { data: whispers, error: fetchError } = await supabase
      .from('whispers')
      .select('id')
      .eq('user_id', user_id)
      .in('id', whisper_ids);

    if (fetchError) {
      console.error('[whisper-reflect] Fetch error:', fetchError);
      return res.status(500).json({ error: 'Failed to verify whispers' });
    }

    if (!whispers || whispers.length !== whisper_ids.length) {
      return res.status(400).json({ error: 'Some whisper_ids not found or not owned by user' });
    }

    // Get user context for reflection
    const [onboardingResult, keyPeopleResult] = await Promise.all([
      supabase.from('onboarding_data').select('name').eq('user_id', user_id).maybeSingle(),
      supabase.from('user_key_people').select('name, relationship').eq('user_id', user_id)
    ]);

    const userName = onboardingResult.data?.name || '';
    const keyPeople = keyPeopleResult.data || [];

    // Combine whispers for reflection
    const combinedContent = decrypted_contents.join('\n\n---\n\n');

    // Build key people context
    let keyPeopleContext = '';
    if (keyPeople.length > 0) {
      keyPeopleContext = '\n\nKEY PEOPLE (user explicitly told you about these):\n' +
        keyPeople.map(p => `- ${p.name}: ${p.relationship}`).join('\n');
    }

    // Generate reflection using LLM
    const prompt = `You are Inscript, a thoughtful AI companion. The user has captured several quick thoughts (whispers) they'd like you to reflect on together.

${userName ? `The user's name is ${userName}.` : ''}${keyPeopleContext}

WHISPERS:
${combinedContent}

---

Provide a warm, insightful reflection that:
1. HEARD: Acknowledge what they shared across these whispers
2. NOTICED: Find connections or themes between the whispers
3. OFFERED: One gentle observation or question

Keep it concise (3-4 sentences). Be warm and specific, not clinical.
Do not use phrases like "I can see..." or "Based on my analysis...".
If any names match KEY PEOPLE, acknowledge that relationship naturally.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const reflection = response.content[0].text;
    console.log('[whisper-reflect] Generated batch reflection');

    // Mark whispers as processed
    const { error: updateError } = await supabase
      .from('whispers')
      .update({ processed: true })
      .in('id', whisper_ids);

    if (updateError) {
      console.warn('[whisper-reflect] Could not mark whispers as processed:', updateError);
    }

    return res.status(200).json({
      reflection,
      whisper_count: whisper_ids.length,
      processed: true
    });

  } catch (error) {
    console.error('[whisper-reflect] Error:', error);
    return res.status(500).json({ error: 'Failed to generate reflection' });
  }
};
