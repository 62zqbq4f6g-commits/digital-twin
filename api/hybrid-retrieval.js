/**
 * MEM0 GAP 3: Hybrid Retrieval
 *
 * Phase 19: Post-RAG Architecture
 *
 * DEPRECATED: Vector search is being phased out in favor of full context loading.
 * Graph traversal remains the primary retrieval method.
 *
 * As of v9.12.0:
 * - Vector weight is set to 0 by default
 * - Graph and direct lookup are primary
 * - Use /api/context/full for full context loading (preferred)
 *
 * Migration: Set MIRROR_FULL_CONTEXT=true to bypass retrieval entirely.
 */

import { createClient } from '@supabase/supabase-js';

// Feature flag to skip vector search entirely
const SKIP_VECTOR_SEARCH = process.env.SKIP_VECTOR_SEARCH === 'true' || true; // Default: skip

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000)
    })
  });

  if (!response.ok) {
    throw new Error('Embedding generation failed');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Vector search using embeddings
 *
 * DEPRECATED: Vector search is being phased out.
 * Set SKIP_VECTOR_SEARCH=true (default) to skip.
 */
async function vectorSearch(supabase, userId, query, options = {}) {
  // Skip vector search if disabled (default in Post-RAG architecture)
  if (SKIP_VECTOR_SEARCH) {
    console.log('[hybrid-retrieval] Vector search skipped (DEPRECATED)');
    return [];
  }

  console.warn('[hybrid-retrieval] DEPRECATED: Vector search is deprecated. Consider using full context loading.');

  const {
    threshold = 0.4,
    limit = 15,
    includeHistorical = false,
    memoryTypes = null,
    minImportance = null
  } = options;

  try {
    const embedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_entities_enhanced', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      p_user_id: userId,
      p_memory_types: memoryTypes,
      p_include_historical: includeHistorical,
      p_exclude_expired: true,
      p_min_importance: minImportance
    });

    if (error) {
      console.error('[hybrid-retrieval] Vector search error:', error);
      return [];
    }

    return (data || []).map(m => ({
      ...m,
      retrieval_source: 'vector',
      retrieval_score: m.similarity || m.final_score || 0.5
    }));

  } catch (err) {
    console.error('[hybrid-retrieval] Vector search failed:', err);
    return [];
  }
}

/**
 * Graph traversal to find connected entities
 */
async function graphTraversal(supabase, userId, seedEntityIds, options = {}) {
  const {
    maxDepth = 2,
    minStrength = 0.3
  } = options;

  if (!seedEntityIds || seedEntityIds.length === 0) {
    return [];
  }

  const allConnections = [];

  // Traverse from each seed entity
  for (const entityId of seedEntityIds.slice(0, 3)) { // Limit seed entities
    try {
      const { data, error } = await supabase.rpc('traverse_entity_graph', {
        p_entity_id: entityId,
        p_user_id: userId,
        p_max_depth: maxDepth,
        p_min_strength: minStrength
      });

      if (error) {
        console.error('[hybrid-retrieval] Graph traversal error:', error);
        continue;
      }

      if (data) {
        allConnections.push(...data.map(conn => ({
          id: conn.entity_id,
          name: conn.entity_name,
          entity_type: conn.entity_type,
          relationship_path: conn.relationship_path,
          relationship_types: conn.relationship_types,
          retrieval_source: 'graph',
          retrieval_score: conn.total_strength || 0.5,
          graph_depth: conn.depth,
          seed_entity_id: entityId
        })));
      }
    } catch (err) {
      console.error('[hybrid-retrieval] Graph traversal failed for entity:', entityId, err);
    }
  }

  // Deduplicate by entity ID
  const seen = new Set();
  return allConnections.filter(conn => {
    if (seen.has(conn.id)) return false;
    seen.add(conn.id);
    return true;
  });
}

/**
 * Direct entity lookup by name
 */
async function entityLookup(supabase, userId, entityNames) {
  if (!entityNames || entityNames.length === 0) {
    return [];
  }

  const results = [];

  for (const name of entityNames) {
    const { data, error } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .ilike('name', `%${name}%`)
      .order('importance_score', { ascending: false })
      .limit(3);

    if (!error && data) {
      results.push(...data.map(e => ({
        ...e,
        retrieval_source: 'direct',
        retrieval_score: 1.0, // Direct matches get highest score
        matched_query: name
      })));
    }
  }

  // Deduplicate
  const seen = new Set();
  return results.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

/**
 * Merge and rank results from multiple sources
 */
function mergeAndRank(vectorResults, graphResults, directResults, weights = {}) {
  // Phase 19: Vector weight set to 0 by default (Post-RAG architecture)
  const {
    vectorWeight = 0,      // DEPRECATED: Was 0.4, now 0
    graphWeight = 0.5,     // Increased from 0.3
    directWeight = 0.5     // Increased from 0.3
  } = weights;

  // Create a map to track combined scores
  const scoreMap = new Map();

  // Process direct lookups (highest priority)
  for (const result of directResults) {
    scoreMap.set(result.id, {
      ...result,
      combined_score: result.retrieval_score * directWeight,
      sources: ['direct']
    });
  }

  // Process vector results
  for (const result of vectorResults) {
    if (scoreMap.has(result.id)) {
      const existing = scoreMap.get(result.id);
      existing.combined_score += result.retrieval_score * vectorWeight;
      existing.sources.push('vector');
      existing.vector_score = result.retrieval_score;
    } else {
      scoreMap.set(result.id, {
        ...result,
        combined_score: result.retrieval_score * vectorWeight,
        sources: ['vector'],
        vector_score: result.retrieval_score
      });
    }
  }

  // Process graph results
  for (const result of graphResults) {
    if (scoreMap.has(result.id)) {
      const existing = scoreMap.get(result.id);
      existing.combined_score += result.retrieval_score * graphWeight;
      existing.sources.push('graph');
      existing.graph_score = result.retrieval_score;
      existing.relationship_path = result.relationship_path;
      existing.relationship_types = result.relationship_types;
    } else {
      scoreMap.set(result.id, {
        ...result,
        combined_score: result.retrieval_score * graphWeight,
        sources: ['graph'],
        graph_score: result.retrieval_score
      });
    }
  }

  // Convert to array and sort by combined score
  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.combined_score - a.combined_score);

  return merged;
}

/**
 * Main hybrid retrieval function
 * Runs all retrieval methods in parallel
 */
async function hybridRetrieve(supabase, userId, synthesizedQuery, options = {}) {
  const {
    vectorLimit = 15,
    graphDepth = 2,
    graphMinStrength = 0.3,
    vectorThreshold = 0.4,
    includeHistorical = false
  } = options;

  const {
    vector_query,
    entity_names = [],
    mentioned_entities = []
  } = synthesizedQuery;

  // Run all retrieval methods in parallel
  const [directResults, vectorResults] = await Promise.all([
    // Direct entity lookup
    entityLookup(supabase, userId, entity_names),

    // Vector semantic search
    vectorSearch(supabase, userId, vector_query, {
      threshold: vectorThreshold,
      limit: vectorLimit,
      includeHistorical
    })
  ]);

  // Get seed entities for graph traversal (from direct + top vector results)
  const seedEntityIds = [
    ...directResults.map(e => e.id),
    ...vectorResults.slice(0, 3).map(e => e.id)
  ].filter(Boolean);

  // Graph traversal (depends on seed entities)
  const graphResults = await graphTraversal(supabase, userId, seedEntityIds, {
    maxDepth: graphDepth,
    minStrength: graphMinStrength
  });

  // Merge and rank all results
  const merged = mergeAndRank(vectorResults, graphResults, directResults);

  // Fetch full entity data for graph results that only have IDs
  const needsFullData = merged.filter(m =>
    m.retrieval_source === 'graph' && !m.summary
  );

  if (needsFullData.length > 0) {
    const ids = needsFullData.map(m => m.id);
    const { data: fullEntities } = await supabase
      .from('user_entities')
      .select('*')
      .in('id', ids);

    if (fullEntities) {
      const entityMap = new Map(fullEntities.map(e => [e.id, e]));
      merged.forEach(m => {
        if (entityMap.has(m.id)) {
          const full = entityMap.get(m.id);
          m.summary = full.summary;
          m.context_notes = full.context_notes;
          m.importance = full.importance;
          m.importance_score = full.importance_score;
          m.memory_type = full.memory_type;
          m.sentiment_average = full.sentiment_average;
        }
      });
    }
  }

  return {
    results: merged,
    stats: {
      direct_count: directResults.length,
      vector_count: vectorResults.length,
      graph_count: graphResults.length,
      merged_count: merged.length,
      multi_source_count: merged.filter(m => m.sources.length > 1).length
    }
  };
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

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Embedding service not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify token and get user
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Use authenticated user's ID
  const userId = user.id;
  const { synthesizedQuery, options = {} } = req.body;

  if (!synthesizedQuery) {
    return res.status(400).json({ error: 'synthesizedQuery required' });
  }

  try {
    const startTime = Date.now();
    const result = await hybridRetrieve(supabase, userId, synthesizedQuery, options);

    console.log('[hybrid-retrieval] Complete:', {
      ...result.stats,
      processing_time_ms: Date.now() - startTime
    });

    return res.json({
      ...result,
      processing_time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('[hybrid-retrieval] Handler error:', error);
    return res.status(500).json({ error: 'Retrieval failed' });
  }
}

// Export utilities for use in other modules
export {
  hybridRetrieve,
  vectorSearch,
  graphTraversal,
  entityLookup,
  mergeAndRank
};
