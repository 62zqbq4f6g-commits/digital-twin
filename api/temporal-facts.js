/**
 * TEMPORAL FACTS API
 *
 * Bi-temporal knowledge queries:
 * - GET /api/temporal-facts?entityId=X&asOf=DATE - Facts at point in time
 * - GET /api/temporal-facts?entityId=X&predicate=Y&history=true - Fact history
 * - GET /api/temporal-facts?entityId=X&timeline=true - Entity timeline
 * - POST /api/temporal-facts/invalidate - Manually invalidate a fact
 *
 * @module api/temporal-facts
 */

import { createClient } from '@supabase/supabase-js';
import {
  getFactsAtTime,
  getFactHistory,
  getCurrentFacts,
  getEntityTimeline,
  compareKnowledgeAtTimes,
  invalidateFact
} from '../lib/knowledge/temporal-facts.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Verify token
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = user.id;

  try {
    // POST: Invalidate a fact
    if (req.method === 'POST') {
      const { action, factId, reason, validTo } = req.body;

      if (action === 'invalidate') {
        if (!factId) {
          return res.status(400).json({ error: 'factId required' });
        }

        // Verify the fact belongs to this user
        const { data: fact } = await supabase
          .from('entity_facts')
          .select('id, user_id')
          .eq('id', factId)
          .single();

        if (!fact || fact.user_id !== userId) {
          return res.status(404).json({ error: 'Fact not found' });
        }

        const success = await invalidateFact(factId, reason || 'user_corrected', validTo);
        return res.json({ success, factId });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    // GET: Query facts
    if (req.method === 'GET') {
      const { entityId, asOf, predicate, history, timeline, compare, time1, time2 } = req.query;

      if (!entityId) {
        return res.status(400).json({ error: 'entityId required' });
      }

      // Verify entity belongs to user
      const { data: entity } = await supabase
        .from('user_entities')
        .select('id, name')
        .eq('id', entityId)
        .eq('user_id', userId)
        .single();

      if (!entity) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Point-in-time query
      if (asOf) {
        const facts = await getFactsAtTime(userId, entityId, asOf);
        return res.json({
          entity: entity.name,
          asOf,
          facts,
          count: facts.length
        });
      }

      // Fact history for a specific predicate
      if (history && predicate) {
        const historyData = await getFactHistory(userId, entityId, predicate);
        return res.json({
          entity: entity.name,
          predicate,
          history: historyData,
          versionCount: historyData.length
        });
      }

      // Entity timeline
      if (timeline) {
        const timelineData = await getEntityTimeline(userId, entityId);
        return res.json({
          entity: entity.name,
          timeline: timelineData,
          eventCount: timelineData.length
        });
      }

      // Compare two points in time
      if (compare && time1 && time2) {
        const diff = await compareKnowledgeAtTimes(userId, entityId, time1, time2);
        return res.json({
          entity: entity.name,
          comparison: diff
        });
      }

      // Default: get current facts
      const facts = await getCurrentFacts(userId, entityId);
      return res.json({
        entity: entity.name,
        facts,
        count: facts.length
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[temporal-facts] Error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
