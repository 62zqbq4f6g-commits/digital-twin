/**
 * MEM0 GAP 6: Unified Memory Retrieval API
 * Single entry point that orchestrates the entire retrieval pipeline:
 * 1. Query Synthesis → 2. Tiered Retrieval → 3. Context Assembly
 *
 * This is THE function to call for memory-augmented responses.
 */

import { createClient } from '@supabase/supabase-js';

// Import pipeline components
import { synthesizeQueries, synthesizeQueryFast } from './synthesize-query.js';
import { tieredRetrieve, tieredRetrieveFast } from './tiered-retrieval.js';
import { assembleContext, buildUserContextPrompt, assembleQuickContext } from './assemble-context.js';

/**
 * Full memory retrieval pipeline
 * Use this for chat/reflection where quality matters
 */
async function fullRetrieve(supabase, userId, userMessage, options = {}) {
  const {
    conversationContext = [],
    onboardingData = null,
    maxTokens = 4000,
    includeOnboarding = true
  } = options;

  const startTime = Date.now();
  const stats = { steps: {} };

  // STEP 1: Synthesize query
  const step1Start = Date.now();
  let knownEntities = [];

  // Get user's known entities for better query synthesis
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, relationship')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(50);

  knownEntities = entities || [];

  const synthesizedQuery = await synthesizeQueries(
    userMessage,
    conversationContext,
    knownEntities
  );

  stats.steps.synthesis = {
    time_ms: Date.now() - step1Start,
    query_type: synthesizedQuery.query_type,
    entities_found: synthesizedQuery.entity_names?.length || 0
  };

  // STEP 2: Tiered retrieval
  const step2Start = Date.now();
  const tieredResult = await tieredRetrieve(
    supabase,
    userId,
    userMessage,
    synthesizedQuery,
    { fast: false } // Use full retrieval with sufficiency checks
  );

  stats.steps.retrieval = {
    time_ms: Date.now() - step2Start,
    tier_used: tieredResult.tier_used,
    summaries: tieredResult.summaries?.length || 0,
    entities: tieredResult.entities?.length || 0,
    full_results: tieredResult.full_results?.results?.length || 0
  };

  // STEP 3: Assemble context
  const step3Start = Date.now();
  const assembled = assembleContext(tieredResult, {
    maxTokens,
    includeSummaries: true,
    includeEntities: true,
    includeFullResults: true
  });

  // Build final prompt context
  const promptContext = buildUserContextPrompt(
    assembled,
    includeOnboarding ? onboardingData : null
  );

  stats.steps.assembly = {
    time_ms: Date.now() - step3Start,
    sections: assembled.sections.length,
    total_tokens: assembled.total_tokens
  };

  stats.total_time_ms = Date.now() - startTime;

  return {
    context: promptContext,
    assembled,
    synthesizedQuery,
    tieredResult,
    stats
  };
}

/**
 * Fast memory retrieval pipeline
 * Use this for quick lookups or high-volume scenarios
 */
async function fastRetrieve(supabase, userId, userMessage, options = {}) {
  const {
    onboardingData = null,
    maxTokens = 2000,
    includeOnboarding = true
  } = options;

  const startTime = Date.now();

  // STEP 1: Fast query synthesis (no LLM)
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(30);

  const synthesizedQuery = synthesizeQueryFast(userMessage, entities || []);

  // STEP 2: Fast tiered retrieval
  const tieredResult = await tieredRetrieveFast(
    supabase,
    userId,
    userMessage,
    synthesizedQuery,
    {}
  );

  // STEP 3: Quick context assembly
  let context = '';

  if (tieredResult.tier_used === 1 && tieredResult.summaries?.length > 0) {
    // Tier 1: Use summaries
    context = tieredResult.summaries.map(s =>
      `[${s.category.replace('_', ' ').toUpperCase()}]: ${s.summary}`
    ).join('\n');
  } else if (tieredResult.tier_used === 2 && tieredResult.entities?.length > 0) {
    // Tier 2: Use entities
    const { context: entityContext } = assembleQuickContext(tieredResult.entities, maxTokens);
    context = entityContext;
  } else if (tieredResult.full_results?.results?.length > 0) {
    // Tier 3: Use full results
    const { context: fullContext } = assembleQuickContext(tieredResult.full_results.results, maxTokens);
    context = fullContext;
  }

  // Build prompt context
  const parts = ['<user_context>'];
  if (includeOnboarding && onboardingData?.name) {
    parts.push(`User's name: ${onboardingData.name}`);
    if (onboardingData.life_seasons?.length > 0) {
      parts.push(`Life season: ${onboardingData.life_seasons.join(', ')}`);
    }
    parts.push('');
  }
  if (context) {
    parts.push(context);
  }
  parts.push('</user_context>');

  const promptContext = parts.join('\n');

  return {
    context: promptContext,
    tier_used: tieredResult.tier_used,
    stats: {
      total_time_ms: Date.now() - startTime,
      query_type: synthesizedQuery.query_type,
      items_retrieved: tieredResult.summaries?.length ||
                       tieredResult.entities?.length ||
                       tieredResult.full_results?.results?.length || 0
    }
  };
}

/**
 * Get user's FULL onboarding data for context (all fields for personalization)
 */
async function getOnboardingData(supabase, userId) {
  const { data, error } = await supabase
    .from('onboarding_data')
    .select('name, life_seasons, mental_focus, seeded_people, depth_question, depth_answer')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    message,
    conversationContext,
    options = {}
  } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get onboarding data
    const onboardingData = await getOnboardingData(supabase, userId);

    const retrieveOptions = {
      conversationContext: conversationContext || [],
      onboardingData,
      maxTokens: options.maxTokens || 4000,
      includeOnboarding: options.includeOnboarding !== false
    };

    let result;

    if (options.fast) {
      // Fast mode - minimal LLM calls
      result = await fastRetrieve(supabase, userId, message, retrieveOptions);
    } else {
      // Full mode - better quality
      result = await fullRetrieve(supabase, userId, message, retrieveOptions);
    }

    console.log('[memory-retrieve] Complete:', {
      mode: options.fast ? 'fast' : 'full',
      tier_used: result.tier_used || result.tieredResult?.tier_used,
      context_length: result.context?.length || 0,
      ...(result.stats || {})
    });

    return res.json(result);

  } catch (error) {
    console.error('[memory-retrieve] Handler error:', error);
    return res.status(500).json({ error: 'Memory retrieval failed' });
  }
}

// Export the main retrieval functions for use in other modules
export { fullRetrieve, fastRetrieve, getOnboardingData };
