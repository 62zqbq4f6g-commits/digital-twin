/**
 * /api/whisper-reflect - Batch reflection for whispers
 * Phase 15: Quick Capture
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const { setCorsHeaders, handlePreflight } = require('./lib/cors.js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

module.exports = async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

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

    // Get user context for reflection (use FULL onboarding data for personalization)
    const [onboardingResult, keyPeopleResult] = await Promise.all([
      supabase.from('onboarding_data').select('name, life_seasons, mental_focus, depth_answer').eq('user_id', user_id).maybeSingle(),
      supabase.from('user_key_people').select('name, relationship').eq('user_id', user_id)
    ]);

    const onboarding = onboardingResult.data || {};
    const userName = onboarding.name || '';
    const keyPeople = keyPeopleResult.data || [];

    // Combine whispers for reflection
    const combinedContent = decrypted_contents.join('\n\n---\n\n');

    // Build key people context
    let keyPeopleContext = '';
    if (keyPeople.length > 0) {
      keyPeopleContext = '\n\nKEY PEOPLE (user explicitly told you about these):\n' +
        keyPeople.map(p => `- ${p.name}: ${p.relationship}`).join('\n');
    }

    // Build onboarding context for personalized reflection
    let onboardingContext = '';
    if (onboarding.life_seasons?.length > 0) {
      onboardingContext += `\nLife season: ${onboarding.life_seasons.join(', ')}`;
    }
    if (onboarding.mental_focus?.length > 0) {
      onboardingContext += `\nFocused on: ${onboarding.mental_focus.join(', ')}`;
    }
    if (onboarding.depth_answer) {
      onboardingContext += `\nContext they shared: "${onboarding.depth_answer}"`;
    }

    // Generate reflection using LLM
    const prompt = `You are Inscript, a thoughtful AI companion. The user has captured several quick thoughts (whispers) they'd like you to reflect on together.

${userName ? `The user's name is ${userName}.` : ''}${onboardingContext}${keyPeopleContext}

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
