# MEM0 BUILD - PART 3: BUILDS 5-7 + VERIFICATION
## BUILD 5: RERANKING + TIME-BOUND

### 5.1 Enhanced Search Function

```sql
-- =====================================================
-- Enhanced entity matching with full features
-- =====================================================

CREATE OR REPLACE FUNCTION match_entities_enhanced(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INTEGER,
  p_user_id UUID,
  p_memory_types TEXT[] DEFAULT NULL,
  p_include_historical BOOLEAN DEFAULT FALSE,
  p_exclude_expired BOOLEAN DEFAULT TRUE,
  p_min_importance TEXT DEFAULT NULL,
  p_sensitivity_max TEXT DEFAULT 'normal'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  entity_type TEXT,
  memory_type TEXT,
  summary TEXT,
  importance TEXT,
  importance_score FLOAT,
  sentiment_average FLOAT,
  is_historical BOOLEAN,
  effective_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  recurrence_pattern JSONB,
  sensitivity_level TEXT,
  similarity FLOAT,
  recency_boost FLOAT,
  access_boost FLOAT,
  final_score FLOAT
) AS $$
DECLARE
  importance_values TEXT[] := ARRAY['critical', 'high', 'medium', 'low', 'trivial'];
  min_importance_idx INTEGER;
BEGIN
  -- Get minimum importance index if specified
  IF p_min_importance IS NOT NULL THEN
    min_importance_idx := array_position(importance_values, p_min_importance);
  ELSE
    min_importance_idx := 5; -- Include all
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.entity_type,
    e.memory_type,
    e.summary,
    e.importance,
    e.importance_score,
    e.sentiment_average,
    e.is_historical,
    e.effective_from,
    e.expires_at,
    e.recurrence_pattern,
    e.sensitivity_level,
    -- Raw similarity
    (1 - (e.embedding <=> query_embedding))::FLOAT as similarity,
    -- Recency boost: exponential decay over weeks (0.95^weeks)
    POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800)::FLOAT as recency_boost,
    -- Access frequency boost (log scale, capped)
    LEAST(1.0, 0.5 + (LN(GREATEST(1, e.access_count)) / 10))::FLOAT as access_boost,
    -- Final composite score
    (
      (1 - (e.embedding <=> query_embedding)) * 0.50 +  -- 50% semantic similarity
      COALESCE(e.importance_score, 0.5) * 0.20 +        -- 20% importance
      POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800) * 0.15 +  -- 15% recency
      LEAST(1.0, 0.5 + (LN(GREATEST(1, e.access_count)) / 10)) * 0.15  -- 15% access frequency
    )::FLOAT as final_score
  FROM user_entities e
  WHERE e.user_id = p_user_id
    AND e.status = 'active'
    -- Similarity threshold
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    -- Memory type filter
    AND (p_memory_types IS NULL OR e.memory_type = ANY(p_memory_types))
    -- Historical filter
    AND (p_include_historical OR e.is_historical = FALSE)
    -- Expiration filter
    AND (NOT p_exclude_expired OR e.expires_at IS NULL OR e.expires_at > NOW())
    -- Effective date filter (don't return future-dated memories before their time)
    AND (e.effective_from IS NULL OR e.effective_from <= NOW())
    -- Importance filter
    AND (p_min_importance IS NULL OR array_position(importance_values, e.importance) <= min_importance_idx)
    -- Sensitivity filter
    AND (
      p_sensitivity_max = 'private' OR
      (p_sensitivity_max = 'sensitive' AND e.sensitivity_level IN ('normal', 'sensitive')) OR
      (p_sensitivity_max = 'normal' AND e.sensitivity_level = 'normal')
    )
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Update access tracking when memories are retrieved
CREATE OR REPLACE FUNCTION update_memory_access(p_memory_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE user_entities
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(p_memory_ids);
END;
$$ LANGUAGE plpgsql;
```

### 5.2 Cleanup and Decay Cron Jobs

```sql
-- =====================================================
-- Enable pg_cron extension
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- Daily cleanup function
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS TABLE (
  expired_count INTEGER,
  decayed_count INTEGER
) AS $$
DECLARE
  v_expired INTEGER;
  v_decayed INTEGER;
BEGIN
  -- Archive expired memories
  WITH archived AS (
    UPDATE user_entities
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired FROM archived;

  -- Archive very low importance memories older than 90 days with no recent access
  WITH decayed AS (
    UPDATE user_entities
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'active'
      AND importance = 'trivial'
      AND importance_score < 0.1
      AND updated_at < NOW() - INTERVAL '90 days'
      AND last_accessed_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_decayed FROM decayed;

  RETURN QUERY SELECT v_expired, v_decayed;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 3 AM UTC
SELECT cron.schedule('cleanup-memories', '0 3 * * *', 'SELECT * FROM cleanup_expired_memories()');

-- =====================================================
-- Weekly decay function
-- =====================================================

CREATE OR REPLACE FUNCTION apply_memory_decay()
RETURNS TABLE (
  decayed_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE user_entities
    SET importance_score = GREATEST(0.05, importance_score * 
      CASE
        -- Critical: never decay
        WHEN importance = 'critical' THEN 1.0
        -- High: start after 90 days, -5% per week
        WHEN importance = 'high' AND updated_at < NOW() - INTERVAL '90 days' THEN 0.95
        -- Medium: start after 30 days, -10% per week
        WHEN importance = 'medium' AND updated_at < NOW() - INTERVAL '30 days' THEN 0.90
        -- Low: start after 14 days, -15% per week
        WHEN importance = 'low' AND updated_at < NOW() - INTERVAL '14 days' THEN 0.85
        -- Trivial: start after 7 days, -20% per week
        WHEN importance = 'trivial' AND updated_at < NOW() - INTERVAL '7 days' THEN 0.80
        ELSE 1.0
      END
    )
    WHERE status = 'active'
      AND importance != 'critical'
      AND last_accessed_at < NOW() - INTERVAL '7 days' -- Don't decay recently accessed
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM decayed;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly on Sunday at 4 AM UTC
SELECT cron.schedule('decay-memories', '0 4 * * 0', 'SELECT * FROM apply_memory_decay()');

-- =====================================================
-- Per-user decay function (for async jobs)
-- =====================================================

CREATE OR REPLACE FUNCTION apply_memory_decay_for_user(p_user_id UUID)
RETURNS TABLE (count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE user_entities
    SET importance_score = GREATEST(0.05, importance_score * 
      CASE
        WHEN importance = 'critical' THEN 1.0
        WHEN importance = 'high' AND updated_at < NOW() - INTERVAL '90 days' THEN 0.95
        WHEN importance = 'medium' AND updated_at < NOW() - INTERVAL '30 days' THEN 0.90
        WHEN importance = 'low' AND updated_at < NOW() - INTERVAL '14 days' THEN 0.85
        WHEN importance = 'trivial' AND updated_at < NOW() - INTERVAL '7 days' THEN 0.80
        ELSE 1.0
      END
    )
    WHERE user_id = p_user_id
      AND status = 'active'
      AND importance != 'critical'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM decayed;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;
```

---

## BUILD 6: CUSTOM PROMPTS + SEARCH HANDLERS

### 6.1 Memory Preferences Table

```sql
-- =====================================================
-- User-configurable memory preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Custom extraction instructions
  custom_instructions TEXT,
  -- Example: "Focus on my fitness goals and ignore casual work chat"
  
  -- Enabled memory categories
  enabled_categories TEXT[] DEFAULT ARRAY['entity', 'fact', 'preference', 'event', 'goal', 'procedure', 'decision', 'action'],
  
  -- Topics to auto-mark as sensitive
  auto_mark_sensitive TEXT[] DEFAULT ARRAY['health', 'medical', 'financial', 'death', 'mental health', 'therapy'],
  
  -- Topics to never store
  never_store TEXT[] DEFAULT ARRAY[],
  -- Example: ['work meetings', 'client names']
  
  -- Default expiry for certain memory types (days, null = never)
  default_expiry_days INTEGER,
  
  -- Event memories auto-expire after the event
  events_auto_expire BOOLEAN DEFAULT TRUE,
  
  -- Retrieval preferences
  prefer_recent BOOLEAN DEFAULT TRUE,
  include_historical_by_default BOOLEAN DEFAULT FALSE,
  default_sensitivity_level TEXT DEFAULT 'normal' 
    CHECK (default_sensitivity_level IN ('normal', 'sensitive', 'private')),
  
  -- Minimum confidence to store
  min_confidence FLOAT DEFAULT 0.6 CHECK (min_confidence >= 0 AND min_confidence <= 1),
  
  -- Notification preferences
  notify_on_consolidation BOOLEAN DEFAULT FALSE,
  notify_on_conflict BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_memory_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_preferences_updated
BEFORE UPDATE ON memory_preferences
FOR EACH ROW EXECUTE FUNCTION update_memory_preferences_timestamp();
```

### 6.2 Memory Search API with Special Query Handlers

```javascript
// api/memory-search.js

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  const { userId, query, options = {} } = req.body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Detect special query patterns
  const specialQuery = detectSpecialQuery(query);

  if (specialQuery) {
    const result = await handleSpecialQuery(supabase, userId, specialQuery, query, options);
    return res.json(result);
  }

  // Standard semantic search
  const result = await standardSearch(supabase, userId, query, options);
  return res.json(result);
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
    normalized.includes('how is') && normalized.includes('connected to') ||
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
    normalized.includes('how has') && normalized.includes('changed')
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
    .select(`
      *,
      source:source_entity_id(name, entity_type),
      target:target_entity_id(name, entity_type)
    `)
    .or(`source_entity_id.eq.${primary.id},target_entity_id.eq.${primary.id}`)
    .eq('is_active', true);

  // Get sentiment trajectory
  const { data: sentimentHistory } = await supabase
    .from('entity_sentiment_history')
    .select('sentiment, created_at')
    .eq('entity_id', primary.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get related notes (context)
  const contextNotes = primary.context_notes || [];

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
      with: r.source_entity_id === primary.id ? r.target?.name : r.source?.name,
      strength: r.strength,
      started: r.started_at
    })),
    sentiment_trend: sentimentHistory?.length > 1 ? {
      current: sentimentHistory[0]?.sentiment,
      trend: sentimentHistory[0]?.sentiment > sentimentHistory[sentimentHistory.length - 1]?.sentiment 
        ? 'improving' : 'stable'
    } : null,
    recent_context: contextNotes.slice(-5)
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

  // Get relationships between them or from the first entity
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
      input: text
    })
  });
  const data = await response.json();
  return data.data[0].embedding;
}
```

### 6.3 Memory Consolidation API

```javascript
// api/memory-consolidate.js

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  const { userId, force = false, threshold = 0.85 } = req.body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Find all active entities with embeddings
  const { data: entities, error } = await supabase
    .from('user_entities')
    .select('id, name, summary, embedding, memory_type, importance_score, mention_count, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('embedding', 'is', null);

  if (error || !entities?.length) {
    return res.json({ consolidated: 0, candidates: 0, message: 'No entities to consolidate' });
  }

  // Find similar pairs
  const candidates = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const similarity = cosineSimilarity(entities[i].embedding, entities[j].embedding);
      
      if (similarity >= threshold) {
        candidates.push({
          entity1: entities[i],
          entity2: entities[j],
          similarity
        });
      }
    }
  }

  if (candidates.length === 0) {
    return res.json({ consolidated: 0, candidates: 0, message: 'No duplicate memories found' });
  }

  if (!force) {
    // Return candidates for review
    return res.json({
      consolidated: 0,
      candidates: candidates.length,
      preview: candidates.slice(0, 10).map(c => ({
        entity1: { id: c.entity1.id, name: c.entity1.name, summary: c.entity1.summary },
        entity2: { id: c.entity2.id, name: c.entity2.name, summary: c.entity2.summary },
        similarity: (c.similarity * 100).toFixed(1) + '%'
      })),
      message: 'Run with force=true to consolidate'
    });
  }

  // Consolidate
  const results = [];

  for (const candidate of candidates) {
    try {
      // Determine which to keep (higher importance + more mentions + older)
      const score1 = (candidate.entity1.importance_score || 0.5) + 
                     (candidate.entity1.mention_count || 0) * 0.01 +
                     (new Date() - new Date(candidate.entity1.created_at)) / (1000 * 60 * 60 * 24 * 365);
      const score2 = (candidate.entity2.importance_score || 0.5) + 
                     (candidate.entity2.mention_count || 0) * 0.01 +
                     (new Date() - new Date(candidate.entity2.created_at)) / (1000 * 60 * 60 * 24 * 365);

      const keeper = score1 >= score2 ? candidate.entity1 : candidate.entity2;
      const merged = score1 >= score2 ? candidate.entity2 : candidate.entity1;

      // Use Claude to merge the summaries intelligently
      const mergeResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Merge these two memory entries about the same thing into one concise summary:

Memory 1: "${keeper.summary}"
Memory 2: "${merged.summary}"

Write a single merged summary that preserves all unique information. Keep it concise (1-2 sentences).`
        }]
      });

      const mergedSummary = mergeResponse.content[0]?.text || keeper.summary;

      // Update keeper
      await supabase
        .from('user_entities')
        .update({
          summary: mergedSummary,
          importance_score: Math.max(keeper.importance_score || 0.5, merged.importance_score || 0.5),
          mention_count: (keeper.mention_count || 0) + (merged.mention_count || 0),
          context_notes: [
            ...(keeper.context_notes || []),
            ...(merged.context_notes || [])
          ].slice(-10),
          version: (keeper.version || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', keeper.id);

      // Archive merged entity
      await supabase
        .from('user_entities')
        .update({
          status: 'archived',
          superseded_by: keeper.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', merged.id);

      // Log operation
      await supabase
        .from('memory_operations')
        .insert({
          user_id: userId,
          operation: 'CONSOLIDATE',
          candidate_fact: merged.summary,
          llm_reasoning: `Merged with ${keeper.name} (${(candidate.similarity * 100).toFixed(1)}% similar)`,
          entity_id: keeper.id,
          merged_entity_ids: [merged.id],
          kept_entity_id: keeper.id,
          old_content: merged.summary,
          new_content: mergedSummary
        });

      results.push({
        kept: keeper.id,
        merged: merged.id,
        similarity: candidate.similarity,
        new_summary: mergedSummary
      });

    } catch (err) {
      console.error('Consolidation error:', err);
      results.push({
        error: err.message,
        entity1: candidate.entity1.id,
        entity2: candidate.entity2.id
      });
    }
  }

  return res.json({
    consolidated: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    results
  });
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

## BUILD 7: MIRROR INTEGRATION

### 7.1 Type-Aware Context for Mirror

```javascript
// Enhancement for api/mirror.js

async function buildMirrorContext(supabase, userId, query) {
  // Generate embedding for the query
  const embedding = await generateEmbedding(query);
  
  // Get user preferences
  const { data: prefs } = await supabase
    .from('memory_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Detect if query asks about history/past
  const includeHistorical = /used to|previously|in the past|history|changed/.test(query.toLowerCase());

  // Get relevant memories with enhanced search
  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: 0.35,
    match_count: 20,
    p_user_id: userId,
    p_include_historical: includeHistorical,
    p_exclude_expired: true,
    p_sensitivity_max: prefs?.default_sensitivity_level || 'normal'
  });

  if (!memories?.length) {
    return { context: '', memories: [] };
  }

  // Prioritize by type for better context
  const prioritized = {
    preferences: memories.filter(m => m.memory_type === 'preference'),
    goals: memories.filter(m => m.memory_type === 'goal' && !m.is_historical),
    facts: memories.filter(m => m.memory_type === 'fact'),
    entities: memories.filter(m => m.memory_type === 'entity' || !m.memory_type),
    events: memories.filter(m => m.memory_type === 'event'),
    decisions: memories.filter(m => m.memory_type === 'decision'),
    historical: memories.filter(m => m.is_historical)
  };

  // Build context sections
  let context = '';

  if (prioritized.preferences.length) {
    context += `\n<user_preferences>\n`;
    prioritized.preferences.forEach(p => {
      context += `- ${p.summary}\n`;
    });
    context += `</user_preferences>\n`;
  }

  if (prioritized.goals.length) {
    context += `\n<active_goals>\n`;
    prioritized.goals.forEach(g => {
      context += `- ${g.summary}${g.expires_at ? ` (deadline: ${new Date(g.expires_at).toLocaleDateString()})` : ''}\n`;
    });
    context += `</active_goals>\n`;
  }

  if (prioritized.entities.length) {
    context += `\n<relevant_context>\n`;
    prioritized.entities.forEach(e => {
      const sentiment = e.sentiment_average > 0.3 ? '(positive)' : 
                       e.sentiment_average < -0.3 ? '(negative)' : '';
      context += `- ${e.name}: ${e.summary} ${sentiment}\n`;
    });
    context += `</relevant_context>\n`;
  }

  if (prioritized.facts.length) {
    context += `\n<known_facts>\n`;
    prioritized.facts.forEach(f => {
      context += `- ${f.summary}\n`;
    });
    context += `</known_facts>\n`;
  }

  if (prioritized.events.length) {
    context += `\n<upcoming_events>\n`;
    prioritized.events.forEach(e => {
      const dateStr = e.effective_from ? new Date(e.effective_from).toLocaleDateString() : '';
      context += `- ${e.summary}${dateStr ? ` (${dateStr})` : ''}\n`;
    });
    context += `</upcoming_events>\n`;
  }

  if (includeHistorical && prioritized.historical.length) {
    context += `\n<historical_context>\n`;
    prioritized.historical.forEach(h => {
      context += `- Previously: ${h.summary}\n`;
    });
    context += `</historical_context>\n`;
  }

  // Get related entities via graph if main entity detected
  const mainEntity = memories.find(m => m.entity_type === 'person' && m.similarity > 0.6);
  if (mainEntity) {
    const { data: connections } = await supabase.rpc('traverse_entity_graph', {
      p_entity_id: mainEntity.id,
      p_user_id: userId,
      p_max_depth: 1,
      p_min_strength: 0.4
    });

    if (connections?.length) {
      context += `\n<related_context>\n`;
      context += `${mainEntity.name}'s connections:\n`;
      connections.forEach(c => {
        context += `- ${c.relationship_types.join(' → ')} ${c.entity_name}\n`;
      });
      context += `</related_context>\n`;
    }
  }

  return {
    context,
    memories: memories.map(m => m.id),
    stats: {
      total: memories.length,
      by_type: Object.fromEntries(
        Object.entries(prioritized).map(([k, v]) => [k, v.length]).filter(([, v]) => v > 0)
      )
    }
  };
}
```

---

## VERIFICATION CHECKLIST

### Database Verification

```sql
-- Run these queries to verify schema

-- 1. Check user_entities columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_entities'
ORDER BY ordinal_position;

-- Expected new columns:
-- memory_type, is_historical, effective_from, expires_at, 
-- recurrence_pattern, sensitivity_level, version, access_count,
-- last_accessed_at, outcome, outcome_sentiment, outcome_recorded_at

-- 2. Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('memory_jobs', 'memory_operations', 'memory_preferences', 'entity_sentiment_history');

-- 3. Check entity_relationships enhancements
SELECT column_name FROM information_schema.columns
WHERE table_name = 'entity_relationships';

-- Expected: started_at, ended_at, strength, is_active, metadata, confidence

-- 4. Check functions exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'match_entities_enhanced',
  'traverse_entity_graph',
  'get_sentiment_trajectory',
  'get_sentiment_trend',
  'apply_memory_decay',
  'cleanup_expired_memories',
  'update_memory_access'
);

-- 5. Check cron jobs
SELECT * FROM cron.job;
-- Expected: cleanup-memories (daily 3am), decay-memories (weekly Sunday 4am)
```

### API Verification

```bash
# Test memory-update API
curl -X POST https://your-app.vercel.app/api/memory-update \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "candidateFact": {
      "content": "Marcus joined Notion as a product manager",
      "memory_type": "fact",
      "name": "Marcus",
      "importance": "high"
    },
    "similarMemories": []
  }'
# Expected: {"operation": "ADD", "entity_id": "...", ...}

# Test memory-search special queries
curl -X POST https://your-app.vercel.app/api/memory-search \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-id", "query": "What do you know about me?"}'
# Expected: {"type": "self_summary", "summary": "...", ...}

# Test consolidation preview
curl -X POST https://your-app.vercel.app/api/memory-consolidate \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-id", "force": false}'
# Expected: {"candidates": N, "preview": [...]}
```

---

## EDGE CASES REFERENCE

| Edge Case | Detection | Handler | Implementation |
|-----------|-----------|---------|----------------|
| Job change | "left X", "joined Y", change_type: job | UPDATE supersede | Creates new entity, marks old as historical |
| Name correction | "actually spelled", is_correction: true | UPDATE replace | Direct replacement, logs correction |
| Duplicate entities | Similarity > 85% | consolidate.js | LLM-merged summary, archive duplicate |
| Relationship change | "broke up", "got married" | UPDATE supersede | Relationship as historical, new current |
| Death/loss | Keywords: died, passed, loss | sensitivity: sensitive | Flag for careful retrieval |
| "I used to" | is_historical: true | Extraction | Mark as historical, don't supersede current |
| "Starting next month" | effective_from detected | Extraction | Set effective_from, exclude from retrieval until date |
| "Every Monday" | recurrence_pattern detected | Extraction | Store pattern JSON, special event handling |
| Medical/financial | Keywords detected | sensitivity: sensitive/private | Filter in retrieval based on user prefs |
| "Don't remember" | Explicit deletion request | DELETE hard_delete: true | Permanent removal |
| "What do you know about me?" | Query pattern | Special handler | Self-summary generation |
| Negation queries | "not", "except", "without" | Special handler | Exclusion filter |
| Expired memories | expires_at < NOW() | Cleanup cron | Daily archival at 3am |
| Low importance decay | importance_score < 0.1 | Decay cron | Weekly decay at 4am Sunday |

---

## FILE STRUCTURE SUMMARY

```
api/
  memory-update.js        ← NEW: Core UPDATE phase (ADD/UPDATE/DELETE/NOOP)
  memory-search.js        ← NEW: Special query handlers + standard search
  memory-consolidate.js   ← NEW: Duplicate detection and merging
  analyze.js              ← MODIFY: Add UPDATE phase integration
  extract-entities.js     ← MODIFY: Enhanced extraction with types
  mirror.js               ← MODIFY: Type-aware context building

supabase/
  functions/
    memory-worker/
      index.ts            ← NEW: Async job processor

lib/
  memory-queue.js         ← NEW: Job scheduling utilities
```

---

**END OF COMPLETE SPECIFICATION**
