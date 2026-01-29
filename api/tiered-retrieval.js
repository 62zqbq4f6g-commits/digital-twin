/**
 * MEM0 GAP 4: Tiered Retrieval
 * Start with category summaries, drill down ONLY if needed
 * Key optimization: Avoid loading all memories when summaries suffice
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Category relevance keywords for quick matching
const CATEGORY_RELEVANCE = {
  work_life: ['work', 'job', 'office', 'meeting', 'project', 'boss', 'colleague', 'career', 'company', 'startup'],
  personal_life: ['home', 'weekend', 'hobby', 'vacation', 'relax', 'fun', 'house', 'apartment'],
  health_wellness: ['health', 'exercise', 'workout', 'gym', 'sleep', 'diet', 'stress', 'therapy', 'doctor'],
  relationships: ['friend', 'family', 'partner', 'spouse', 'dating', 'marriage', 'parent', 'child', 'relationship'],
  goals_aspirations: ['goal', 'dream', 'aspiration', 'plan', 'future', 'ambition', 'want', 'achieve'],
  preferences: ['like', 'love', 'prefer', 'favorite', 'enjoy', 'hate', 'dislike'],
  beliefs_values: ['believe', 'think', 'value', 'important', 'principle', 'moral'],
  skills_expertise: ['skill', 'expert', 'learn', 'know', 'experience', 'talent'],
  projects: ['project', 'build', 'create', 'develop', 'launch', 'ship', 'product', 'app'],
  challenges: ['challenge', 'problem', 'struggle', 'difficulty', 'obstacle', 'worry', 'stuck']
};

/**
 * Identify relevant categories for a query
 */
function identifyRelevantCategories(query) {
  const queryLower = query.toLowerCase();
  const relevantCategories = [];

  for (const [category, keywords] of Object.entries(CATEGORY_RELEVANCE)) {
    const matchCount = keywords.filter(kw => queryLower.includes(kw)).length;
    if (matchCount > 0) {
      relevantCategories.push({ category, score: matchCount });
    }
  }

  // Sort by relevance score and return top categories
  return relevantCategories
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.category);
}

/**
 * TIER 1: Get category summaries
 * Fast, pre-computed summaries that may be sufficient
 */
async function getTier1Summaries(supabase, userId, categories = null) {
  let query = supabase
    .from('category_summaries')
    .select('category, summary, entity_count, updated_at')
    .eq('user_id', userId);

  if (categories && categories.length > 0) {
    query = query.in('category', categories);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    console.error('[tiered-retrieval] Tier 1 error:', error);
    return [];
  }

  return data || [];
}

/**
 * TIER 2: Get top entities by importance
 * More specific than summaries, less than full memory load
 */
async function getTier2Entities(supabase, userId, categories = null, limit = 10) {
  let query = supabase
    .from('user_entities')
    .select('id, name, entity_type, summary, importance, importance_score, context_notes, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('importance_score', { ascending: false })
    .order('mention_count', { ascending: false })
    .limit(limit);

  // Filter by categories if provided (would need category field on entities)
  // For now, we'll return top entities regardless of category

  const { data, error } = await query;

  if (error) {
    console.error('[tiered-retrieval] Tier 2 error:', error);
    return [];
  }

  return data || [];
}

/**
 * TIER 3: Full hybrid retrieval
 * Only used when tiers 1-2 are insufficient
 */
async function getTier3FullRetrieval(supabase, userId, synthesizedQuery, options = {}) {
  // Import hybrid retrieval function
  const { hybridRetrieve } = await import('./hybrid-retrieval.js');
  return await hybridRetrieve(supabase, userId, synthesizedQuery, options);
}

/**
 * Check if tier 1 summaries are sufficient for the query
 * Uses LLM to assess sufficiency
 */
async function checkTier1Sufficiency(query, summaries) {
  if (!summaries || summaries.length === 0) {
    return { sufficient: false, reason: 'no_summaries' };
  }

  const summaryContext = summaries.map(s =>
    `[${s.category.replace('_', ' ').toUpperCase()}]: ${s.summary}`
  ).join('\n\n');

  const prompt = `Given this user query and available context summaries, determine if the summaries provide ENOUGH information to give a helpful response.

USER QUERY: "${query}"

AVAILABLE SUMMARIES:
${summaryContext}

Answer with JSON:
{
  "sufficient": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "needs_specifics": ["list", "of", "specific", "things", "needed"] or []
}

Be conservative - if the query asks about specific people, dates, or details not in summaries, mark as insufficient.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { sufficient: false, reason: 'parse_error', confidence: 0 };
  } catch (error) {
    console.error('[tiered-retrieval] Sufficiency check error:', error);
    return { sufficient: false, reason: 'error', confidence: 0 };
  }
}

/**
 * Check if tier 2 entities are sufficient
 * Simpler check - do we have entities matching the query's needs?
 */
function checkTier2Sufficiency(query, entities, synthesizedQuery) {
  const { entity_names = [] } = synthesizedQuery;

  // If query mentions specific entities, check if we have them
  if (entity_names.length > 0) {
    const entityNamesLower = entities.map(e => e.name.toLowerCase());
    const matchedEntities = entity_names.filter(name =>
      entityNamesLower.some(en => en.includes(name.toLowerCase()))
    );

    const matchRatio = matchedEntities.length / entity_names.length;

    return {
      sufficient: matchRatio >= 0.7,
      confidence: matchRatio,
      matched: matchedEntities,
      missing: entity_names.filter(n => !matchedEntities.includes(n))
    };
  }

  // If no specific entities mentioned, tier 2 is sufficient if we have relevant entities
  return {
    sufficient: entities.length >= 3,
    confidence: Math.min(entities.length / 5, 1.0),
    matched: entities.map(e => e.name),
    missing: []
  };
}

/**
 * Main tiered retrieval function
 * Progressively retrieves more context as needed
 */
async function tieredRetrieve(supabase, userId, query, synthesizedQuery, options = {}) {
  const {
    skipTier1 = false,
    skipTier2 = false,
    forceTier3 = false,
    tier1Categories = null,
    tier2Limit = 10
  } = options;

  const result = {
    tier_used: 0,
    summaries: [],
    entities: [],
    full_results: null,
    sufficiency_checks: []
  };

  // Identify relevant categories for the query
  const relevantCategories = tier1Categories || identifyRelevantCategories(query);

  // TIER 1: Category summaries
  if (!skipTier1 && !forceTier3) {
    result.summaries = await getTier1Summaries(supabase, userId, relevantCategories);

    if (result.summaries.length > 0) {
      const tier1Check = await checkTier1Sufficiency(query, result.summaries);
      result.sufficiency_checks.push({ tier: 1, ...tier1Check });

      if (tier1Check.sufficient && tier1Check.confidence >= 0.7) {
        result.tier_used = 1;
        console.log('[tiered-retrieval] Tier 1 sufficient');
        return result;
      }
    }
  }

  // TIER 2: Top entities
  if (!skipTier2 && !forceTier3) {
    result.entities = await getTier2Entities(supabase, userId, relevantCategories, tier2Limit);

    if (result.entities.length > 0) {
      const tier2Check = checkTier2Sufficiency(query, result.entities, synthesizedQuery);
      result.sufficiency_checks.push({ tier: 2, ...tier2Check });

      if (tier2Check.sufficient && tier2Check.confidence >= 0.6) {
        result.tier_used = 2;
        console.log('[tiered-retrieval] Tier 2 sufficient');
        return result;
      }
    }
  }

  // TIER 3: Full hybrid retrieval
  const tier3Result = await getTier3FullRetrieval(supabase, userId, synthesizedQuery, options);
  result.full_results = tier3Result;
  result.tier_used = 3;

  console.log('[tiered-retrieval] Used Tier 3 (full retrieval)');
  return result;
}

/**
 * Fast tiered retrieval without LLM sufficiency checks
 * Uses heuristics only - faster but less accurate
 */
async function tieredRetrieveFast(supabase, userId, query, synthesizedQuery, options = {}) {
  const { entity_names = [] } = synthesizedQuery;
  const relevantCategories = identifyRelevantCategories(query);

  const result = {
    tier_used: 0,
    summaries: [],
    entities: [],
    full_results: null
  };

  // Quick decision tree:
  // - If query mentions specific entity names -> go to tier 3
  // - If query is broad/general -> try tier 1 first
  // - Otherwise -> tier 2

  if (entity_names.length > 0) {
    // Specific entity query - need full retrieval
    const tier3Result = await getTier3FullRetrieval(supabase, userId, synthesizedQuery, options);
    result.full_results = tier3Result;
    result.tier_used = 3;
    return result;
  }

  // Try tier 1 for general queries
  result.summaries = await getTier1Summaries(supabase, userId, relevantCategories);

  if (result.summaries.length > 0 && relevantCategories.length > 0) {
    // We have relevant summaries - use tier 1
    result.tier_used = 1;
    return result;
  }

  // Fall back to tier 2
  result.entities = await getTier2Entities(supabase, userId, null, 15);

  if (result.entities.length >= 5) {
    result.tier_used = 2;
    return result;
  }

  // Not enough context - use tier 3
  const tier3Result = await getTier3FullRetrieval(supabase, userId, synthesizedQuery, options);
  result.full_results = tier3Result;
  result.tier_used = 3;
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - require Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify token and get user
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Use authenticated user's ID (ignore userId from body)
  const userId = user.id;
  const { query, synthesizedQuery, options = {} } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query required' });
  }

  try {
    const startTime = Date.now();

    // Use fast mode by default, full mode if specified
    const result = options.fast !== false
      ? await tieredRetrieveFast(supabase, userId, query, synthesizedQuery || { vector_query: query }, options)
      : await tieredRetrieve(supabase, userId, query, synthesizedQuery || { vector_query: query }, options);

    console.log('[tiered-retrieval] Complete:', {
      tier_used: result.tier_used,
      summaries: result.summaries.length,
      entities: result.entities.length,
      full_results: result.full_results?.results?.length || 0,
      processing_time_ms: Date.now() - startTime
    });

    return res.json({
      ...result,
      processing_time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('[tiered-retrieval] Handler error:', error);
    return res.status(500).json({ error: 'Retrieval failed' });
  }
}

// Export utilities
export {
  tieredRetrieve,
  tieredRetrieveFast,
  getTier1Summaries,
  getTier2Entities,
  identifyRelevantCategories,
  checkTier1Sufficiency,
  checkTier2Sufficiency
};
