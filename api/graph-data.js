/**
 * Graph Data API
 *
 * Returns nodes and edges for knowledge graph visualization.
 *
 * GET /api/graph-data - Get graph data
 * GET /api/graph-data?filter=person - Filter by entity type
 * GET /api/graph-data?limit=50 - Limit number of nodes
 *
 * @module api/graph-data
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';
import { getColorForType, ENTITY_TYPES } from '../lib/extraction/entity-types.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;

    // Parse query params
    const { filter, limit = '100' } = req.query;
    const nodeLimit = Math.min(200, Math.max(10, parseInt(limit) || 100));

    // Build entity query
    let entityQuery = supabase
      .from('user_entities')
      .select(`
        id, name, entity_type, subtype,
        importance_score, mention_count, sentiment_average,
        entity_facts (predicate, object_text)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('importance_score', { ascending: false, nullsFirst: false })
      .limit(nodeLimit);

    // Apply type filter if specified
    if (filter && filter !== 'all' && ENTITY_TYPES[filter]) {
      entityQuery = entityQuery.eq('entity_type', filter);
    }

    // Fetch entities and links in parallel
    const [entitiesResult, linksResult, behaviorsResult] = await Promise.all([
      entityQuery,

      // Get entity links (co-occurrences and relationships)
      supabase
        .from('entity_links')
        .select('id, entity_a, entity_b, relationship_type, strength, context')
        .eq('user_id', userId)
        .order('strength', { ascending: false })
        .limit(300),

      // Get behaviors to create user->entity edges
      supabase
        .from('user_behaviors')
        .select('id, predicate, entity_id, entity_name, confidence')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('confidence', 0.6)
        .limit(50)
    ]);

    const entities = entitiesResult.data || [];
    const links = linksResult.data || [];
    const behaviors = behaviorsResult.data || [];

    // Build nodes
    const nodes = entities.map(e => {
      // Calculate node size based on importance and mentions
      const baseSize = 15;
      const importanceBonus = (e.importance_score || 0.5) * 20;
      const mentionBonus = Math.min(15, (e.mention_count || 0) * 0.5);
      const size = baseSize + importanceBonus + mentionBonus;

      return {
        id: e.id,
        label: e.name,
        type: e.entity_type,
        subtype: e.subtype,
        size: Math.round(size),
        color: getColorForType(e.entity_type),
        importance: e.importance_score || 0,
        mentions: e.mention_count || 0,
        sentiment: e.sentiment_average,
        facts: (e.entity_facts || []).slice(0, 5).map(f => ({
          predicate: f.predicate,
          value: f.object_text
        }))
      };
    });

    // Build set of node IDs for filtering edges
    const nodeIds = new Set(nodes.map(n => n.id));

    // Build edges from entity links
    const edges = [];
    const edgeSet = new Set(); // Prevent duplicates

    for (const link of links) {
      // Only include edges where both nodes are in our node set
      if (!nodeIds.has(link.entity_a) || !nodeIds.has(link.entity_b)) {
        continue;
      }

      const edgeKey = `${link.entity_a}-${link.entity_b}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      edges.push({
        id: link.id,
        source: link.entity_a,
        target: link.entity_b,
        type: link.relationship_type || 'co_occurred',
        weight: link.strength || 1,
        label: formatRelationshipLabel(link.relationship_type),
        context: link.context
      });
    }

    // Add behavior edges (user -> entity)
    // Use a special "user" node ID
    const USER_NODE_ID = 'user-center';
    const userBehaviorEdges = [];

    for (const behavior of behaviors) {
      if (!behavior.entity_id || !nodeIds.has(behavior.entity_id)) {
        continue;
      }

      userBehaviorEdges.push({
        id: `behavior-${behavior.id}`,
        source: USER_NODE_ID,
        target: behavior.entity_id,
        type: behavior.predicate,
        weight: Math.round(behavior.confidence * 3),
        label: formatBehaviorLabel(behavior.predicate),
        isBehavior: true
      });
    }

    // Add user node if we have behavior edges
    if (userBehaviorEdges.length > 0) {
      nodes.unshift({
        id: USER_NODE_ID,
        label: 'You',
        type: 'user',
        size: 40,
        color: '#FFD700',
        isUserNode: true
      });

      edges.push(...userBehaviorEdges);
    }

    // Calculate graph stats
    const meta = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      entityTypes: countByType(nodes),
      edgeTypes: countByType(edges, 'type'),
      avgImportance: calculateAverage(nodes, 'importance'),
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      nodes,
      edges,
      meta
    });

  } catch (error) {
    console.error('[graph-data] Error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Format relationship type for display
 */
function formatRelationshipLabel(type) {
  if (!type) return '';
  return type.replace(/_/g, ' ');
}

/**
 * Format behavior type for display
 */
function formatBehaviorLabel(predicate) {
  const labels = {
    trusts_opinion: 'trusts',
    seeks_advice: 'seeks advice from',
    inspired_by: 'inspired by',
    relies_on: 'relies on',
    avoids: 'avoids',
    prefers: 'prefers',
    struggles_with: 'struggles with',
    excited_about: 'excited about',
    worried_about: 'worried about'
  };

  return labels[predicate] || predicate.replace(/_/g, ' ');
}

/**
 * Count items by a field
 */
function countByType(items, field = 'type') {
  const counts = {};
  for (const item of items) {
    const type = item[field] || 'unknown';
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

/**
 * Calculate average of a numeric field
 */
function calculateAverage(items, field) {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
  return Math.round((sum / items.length) * 100) / 100;
}
