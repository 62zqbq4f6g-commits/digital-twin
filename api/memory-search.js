/**
 * MEM0 BUILD 6: Memory Search API
 * Special query handlers + standard semantic search
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, query, options = {} } = req.body;

  if (!userId || !query) {
    return res.status(400).json({ error: 'userId and query required' });
  }

  // Support both env var naming conventions
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[memory-search] Missing Supabase credentials');
    return res.status(500).json({ error: 'Database not configured' });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[memory-search] Missing OPENAI_API_KEY');
    return res.status(500).json({ error: 'Embedding service not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Detect special query patterns
    const specialQuery = detectSpecialQuery(query);

    if (specialQuery) {
      const result = await handleSpecialQuery(supabase, userId, specialQuery, query, options);
      return res.json(result);
    }

    // Standard semantic search
    const result = await standardSearch(supabase, userId, query, options);
    return res.json(result);
  } catch (error) {
    console.error('Memory search error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
}

// =====================================================
// Special Query Detection
// =====================================================

function detectSpecialQuery(query) {
  const normalized = query.toLowerCase().trim();

  // Self-summary queries
  if (
    normalized.includes('what do you know about me') ||
    normalized.includes('what have you learned about me') ||
    normalized.includes('summarize what you know') ||
    normalized.includes('tell me about myself') ||
    normalized.includes('what do you remember about me')
  ) {
    return { type: 'self_summary' };
  }

  // Entity-specific queries
  const entityMatch = normalized.match(/what do you (?:know|remember) about (\w+(?:\s+\w+)?)/);
  if (entityMatch) {
    return { type: 'entity_summary', entity: entityMatch[1] };
  }

  // Relationship queries
  if (
    normalized.includes('who knows') ||
    (normalized.includes('how is') && normalized.includes('connected to')) ||
    normalized.includes('relationship between')
  ) {
    const entities = extractEntitiesFromQuery(normalized);
    return { type: 'relationship_query', entities };
  }

  // Temporal queries
  if (
    normalized.includes('yesterday') ||
    normalized.includes('last week') ||
    normalized.includes('last month') ||
    normalized.includes('recently') ||
    normalized.includes('this week')
  ) {
    return { type: 'temporal', timeframe: extractTimeframe(normalized) };
  }

  // Historical queries
  if (
    normalized.includes('used to') ||
    normalized.includes('previously') ||
    normalized.includes('in the past') ||
    normalized.includes('history of') ||
    (normalized.includes('how has') && normalized.includes('changed'))
  ) {
    return { type: 'historical' };
  }

  // Negation queries
  const negationMatch = normalized.match(/(?:not|don't|except|excluding|without)\s+(\w+)/);
  if (negationMatch) {
    return { type: 'negation', exclude: negationMatch[1] };
  }

  // Sentiment/trend queries
  if (
    normalized.includes('how do i feel about') ||
    normalized.includes('sentiment') ||
    normalized.includes('getting better') ||
    normalized.includes('getting worse')
  ) {
    return { type: 'sentiment_trend' };
  }

  // Decision history queries
  if (
    normalized.includes('decisions i made') ||
    normalized.includes('what did i decide') ||
    normalized.includes('choices i made')
  ) {
    return { type: 'decisions' };
  }

  // Goal progress queries
  if (
    normalized.includes('my goals') ||
    normalized.includes('what am i working toward') ||
    normalized.includes('progress on')
  ) {
    return { type: 'goals' };
  }

  return null;
}

// =====================================================
// Special Query Handlers
// =====================================================

async function handleSpecialQuery(supabase, userId, specialQuery, originalQuery, options) {
  switch (specialQuery.type) {
    case 'self_summary':
      return await generateSelfSummary(supabase, userId);

    case 'entity_summary':
      return await generateEntitySummary(supabase, userId, specialQuery.entity);

    case 'relationship_query':
      return await queryRelationships(supabase, userId, specialQuery.entities);

    case 'temporal':
      return await searchByTimeframe(supabase, userId, originalQuery, specialQuery.timeframe);

    case 'historical':
      return await searchHistorical(supabase, userId, originalQuery);

    case 'negation':
      return await searchWithExclusion(supabase, userId, originalQuery, specialQuery.exclude);

    case 'sentiment_trend':
      return await querySentimentTrends(supabase, userId, originalQuery);

    case 'decisions':
      return await queryDecisions(supabase, userId);

    case 'goals':
      return await queryGoals(supabase, userId);

    default:
      return await standardSearch(supabase, userId, originalQuery, options);
  }
}

async function generateSelfSummary(supabase, userId) {
  // Fetch all active memories grouped by type
  const { data: memories } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('importance_score', { ascending: false })
    .limit(200);

  if (!memories?.length) {
    return {
      type: 'self_summary',
      found: false,
      message: "I don't have any memories about you yet. As we chat more, I'll learn about you!"
    };
  }

  // Group by type
  const byType = {};
  memories.forEach(m => {
    const type = m.memory_type || 'entity';
    if (!byType[type]) byType[type] = [];
    byType[type].push(m);
  });

  // Get top entities (people, places, projects)
  const topEntities = memories
    .filter(m => m.memory_type === 'entity' || !m.memory_type)
    .slice(0, 10);

  // Get preferences
  const preferences = byType['preference'] || [];

  // Get active goals
  const goals = (byType['goal'] || []).filter(g => !g.is_historical);

  // Get recent decisions
  const decisions = (byType['decision'] || []).slice(0, 5);

  // Generate summary with Claude
  const summaryPrompt = `Based on these memories about a user, write a warm, personal summary (2-3 paragraphs) of what you know about them. Be conversational, not clinical.

**People in their life (${topEntities.length}):**
${topEntities.map(e => `- ${e.name}: ${e.summary || e.relationship || 'known person'}`).join('\n')}

**Their preferences (${preferences.length}):**
${preferences.map(p => `- ${p.summary}`).join('\n') || 'None recorded yet'}

**Their goals (${goals.length}):**
${goals.map(g => `- ${g.summary}`).join('\n') || 'None recorded yet'}

**Recent decisions (${decisions.length}):**
${decisions.map(d => `- ${d.summary}`).join('\n') || 'None recorded yet'}

Write a summary that feels personal and shows you actually know them.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: summaryPrompt }]
  });

  const summary = response.content[0]?.text || '';

  return {
    type: 'self_summary',
    found: true,
    summary,
    stats: {
      total_memories: memories.length,
      by_type: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, v.length])
      ),
      top_people: topEntities.filter(e => e.entity_type === 'person').slice(0, 5).map(e => e.name),
      active_goals: goals.length,
      preference_count: preferences.length
    }
  };
}

async function generateEntitySummary(supabase, userId, entityName) {
  // Find the entity (fuzzy match)
  const { data: entities } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${entityName}%`)
    .order('importance_score', { ascending: false });

  if (!entities?.length) {
    return {
      type: 'entity_summary',
      found: false,
      entity: entityName,
      message: `I don't have any memories about "${entityName}".`
    };
  }

  const primary = entities[0];

  // Get historical versions
  const { data: historical } = await supabase
    .from('user_entities')
    .select('*')
    .eq('superseded_by', primary.id);

  // Get relationships
  const { data: relationships } = await supabase
    .from('entity_relationships')
    .select('*')
    .or(`source_entity_id.eq.${primary.id},target_entity_id.eq.${primary.id}`)
    .eq('is_active', true);

  // Get sentiment trajectory
  const { data: sentimentHistory } = await supabase
    .from('entity_sentiment_history')
    .select('sentiment, created_at')
    .eq('entity_id', primary.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    type: 'entity_summary',
    found: true,
    entity: {
      id: primary.id,
      name: primary.name,
      type: primary.entity_type,
      memory_type: primary.memory_type,
      summary: primary.summary,
      relationship: primary.relationship,
      importance: primary.importance,
      sentiment: primary.sentiment_average,
      first_mentioned: primary.first_mentioned_at,
      last_mentioned: primary.last_mentioned_at,
      mention_count: primary.mention_count
    },
    history: (historical || []).map(h => ({
      summary: h.summary,
      date: h.updated_at,
      was_superseded: true
    })),
    relationships: (relationships || []).map(r => ({
      type: r.relationship_type,
      strength: r.strength,
      started: r.started_at
    })),
    sentiment_trend: sentimentHistory?.length > 1 ? {
      current: sentimentHistory[0]?.sentiment,
      trend: sentimentHistory[0]?.sentiment > sentimentHistory[sentimentHistory.length - 1]?.sentiment
        ? 'improving' : 'stable'
    } : null,
    recent_context: (primary.context_notes || []).slice(-5)
  };
}

async function queryRelationships(supabase, userId, entities) {
  if (!entities || entities.length < 1) {
    return { type: 'relationship_query', error: 'No entities specified' };
  }

  // Find the entities
  const { data: foundEntities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('name', entities.map(e => e.toLowerCase()));

  if (!foundEntities?.length) {
    return {
      type: 'relationship_query',
      found: false,
      message: `I don't know about ${entities.join(' or ')}.`
    };
  }

  // Get relationships from the first entity
  const primaryId = foundEntities[0].id;

  const { data: graph } = await supabase.rpc('traverse_entity_graph', {
    p_entity_id: primaryId,
    p_user_id: userId,
    p_max_depth: 2,
    p_min_strength: 0.2
  });

  return {
    type: 'relationship_query',
    found: true,
    primary_entity: foundEntities[0].name,
    connections: graph?.map(g => ({
      entity: g.entity_name,
      type: g.entity_type,
      path: g.relationship_path,
      relationships: g.relationship_types,
      strength: g.total_strength,
      depth: g.depth
    })) || []
  };
}

async function searchByTimeframe(supabase, userId, query, timeframe) {
  const { data: memories } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('updated_at', timeframe.start.toISOString())
    .lte('updated_at', timeframe.end.toISOString())
    .order('updated_at', { ascending: false })
    .limit(20);

  return {
    type: 'temporal',
    timeframe: {
      start: timeframe.start.toISOString(),
      end: timeframe.end.toISOString()
    },
    memories: memories?.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      date: m.updated_at
    })) || [],
    count: memories?.length || 0
  };
}

async function searchHistorical(supabase, userId, query) {
  // Include historical memories
  const embedding = await generateEmbedding(query);

  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: 20,
    p_user_id: userId,
    p_include_historical: true,
    p_exclude_expired: false
  });

  // Separate current vs historical
  const current = memories?.filter(m => !m.is_historical) || [];
  const historical = memories?.filter(m => m.is_historical) || [];

  return {
    type: 'historical',
    current: current.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type
    })),
    historical: historical.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      superseded_at: m.updated_at
    })),
    timeline: [...current, ...historical].sort((a, b) =>
      new Date(b.updated_at) - new Date(a.updated_at)
    )
  };
}

async function searchWithExclusion(supabase, userId, query, excludeTerm) {
  const embedding = await generateEmbedding(query);

  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: 30,
    p_user_id: userId
  });

  // Filter out excluded term
  const filtered = memories?.filter(m =>
    !m.name?.toLowerCase().includes(excludeTerm.toLowerCase()) &&
    !m.summary?.toLowerCase().includes(excludeTerm.toLowerCase())
  ) || [];

  return {
    type: 'negation',
    excluded: excludeTerm,
    results: filtered.slice(0, 15).map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      similarity: m.similarity
    })),
    total_before_exclusion: memories?.length || 0,
    total_after_exclusion: filtered.length
  };
}

async function querySentimentTrends(supabase, userId, query) {
  // Get entities with sentiment history
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, sentiment_average')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('entity_type', 'person')
    .order('mention_count', { ascending: false })
    .limit(10);

  const trendsPromises = entities?.map(async (entity) => {
    const { data: trend } = await supabase.rpc('get_sentiment_trend', {
      p_entity_id: entity.id,
      p_days: 14
    });
    return {
      entity: entity.name,
      current_sentiment: entity.sentiment_average,
      ...trend?.[0]
    };
  }) || [];

  const trends = await Promise.all(trendsPromises);

  return {
    type: 'sentiment_trend',
    trends: trends.filter(t => t.trend),
    improving: trends.filter(t => t.trend === 'improving').map(t => t.entity),
    declining: trends.filter(t => t.trend === 'declining').map(t => t.entity),
    stable: trends.filter(t => t.trend === 'stable').map(t => t.entity)
  };
}

async function queryDecisions(supabase, userId) {
  const { data: decisions } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('memory_type', 'decision')
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    type: 'decisions',
    decisions: decisions?.map(d => ({
      id: d.id,
      decision: d.summary,
      date: d.created_at,
      outcome: d.outcome,
      outcome_sentiment: d.outcome_sentiment,
      importance: d.importance
    })) || [],
    total: decisions?.length || 0,
    with_outcomes: decisions?.filter(d => d.outcome).length || 0
  };
}

async function queryGoals(supabase, userId) {
  const { data: goals } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('memory_type', 'goal')
    .order('importance_score', { ascending: false });

  const active = goals?.filter(g => !g.is_historical) || [];
  const achieved = goals?.filter(g => g.is_historical) || [];

  return {
    type: 'goals',
    active: active.map(g => ({
      id: g.id,
      goal: g.summary,
      importance: g.importance,
      created: g.created_at,
      deadline: g.expires_at
    })),
    achieved: achieved.map(g => ({
      id: g.id,
      goal: g.summary,
      achieved_date: g.updated_at
    })),
    total_active: active.length,
    total_achieved: achieved.length
  };
}

// =====================================================
// Standard Search
// =====================================================

async function standardSearch(supabase, userId, query, options) {
  const embedding = await generateEmbedding(query);

  // Get user preferences
  const { data: prefs } = await supabase
    .from('memory_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: options.threshold || 0.4,
    match_count: options.limit || 15,
    p_user_id: userId,
    p_memory_types: options.memoryTypes || null,
    p_include_historical: options.includeHistorical ?? prefs?.include_historical_by_default ?? false,
    p_exclude_expired: options.excludeExpired ?? true,
    p_min_importance: options.minImportance || null,
    p_sensitivity_max: options.sensitivityMax || prefs?.default_sensitivity_level || 'normal'
  });

  // Update access tracking
  if (memories?.length) {
    await supabase.rpc('update_memory_access', {
      p_memory_ids: memories.map(m => m.id)
    });
  }

  return {
    type: 'standard',
    query,
    results: memories?.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      entity_type: m.entity_type,
      importance: m.importance,
      similarity: m.similarity,
      final_score: m.final_score,
      is_historical: m.is_historical,
      sentiment: m.sentiment_average
    })) || [],
    count: memories?.length || 0
  };
}

// =====================================================
// Helpers
// =====================================================

function extractTimeframe(query) {
  const now = new Date();

  if (query.includes('yesterday')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (query.includes('last week') || query.includes('this week')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start, end: now };
  }

  if (query.includes('last month')) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return { start, end: now };
  }

  if (query.includes('recently')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 3);
    return { start, end: now };
  }

  // Default: last 7 days
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start, end: now };
}

function extractEntitiesFromQuery(query) {
  // Simple extraction - capitalize words that might be names
  const words = query.split(/\s+/);
  const potentialEntities = words.filter(w =>
    w.length > 2 &&
    /^[A-Z]/.test(w) &&
    !['How', 'What', 'Who', 'The', 'And', 'But'].includes(w)
  );
  return potentialEntities;
}

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000) // Max 8k chars for safety
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[memory-search] OpenAI embedding error:', errorText);
    throw new Error('Embedding generation failed');
  }

  const data = await response.json();
  if (!data.data?.[0]?.embedding) {
    throw new Error('Invalid embedding response');
  }
  return data.data[0].embedding;
}
