/**
 * Profile API
 *
 * Returns structured user profile with:
 * - Top entities (people, places, topics)
 * - User behaviors (trusts, seeks_advice, etc.)
 * - Detected patterns
 * - Topics of interest
 *
 * GET /api/profile - Get user's knowledge graph profile
 *
 * @module api/profile
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

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
    const startTime = Date.now();

    // Fetch all profile data in parallel
    const [
      entitiesResult,
      topicsResult,
      behaviorsResult,
      patternsResult,
      onboardingResult,
      statsResult
    ] = await Promise.all([
      // Top entities with facts
      supabase
        .from('user_entities')
        .select(`
          id, name, entity_type, subtype, summary,
          importance, privacy_level,
          entity_facts (predicate, object_text, confidence)
        `)
        .eq('user_id', userId)
        .order('importance', { ascending: false, nullsFirst: false })
        .limit(25),

      // Topics of interest
      supabase
        .from('user_topics')
        .select('id, name, description, importance_score, mention_count')
        .eq('user_id', userId)
        .order('importance_score', { ascending: false, nullsFirst: false })
        .limit(15),

      // User behaviors
      supabase
        .from('user_behaviors')
        .select(`
          id, predicate, entity_name, topic, sentiment,
          confidence, reinforcement_count,
          subject_entity:entity_id (name, entity_type)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('confidence', 0.5)
        .order('confidence', { ascending: false })
        .limit(15),

      // Detected patterns
      supabase
        .from('user_patterns')
        .select('id, pattern_type, description, short_description, confidence, category')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('confidence', 0.6)
        .order('confidence', { ascending: false })
        .limit(10),

      // Onboarding data (static profile)
      supabase
        .from('onboarding_data')
        .select('name, role_type, life_seasons, goals, depth_question, depth_answer')
        .eq('user_id', userId)
        .maybeSingle(),

      // Stats
      Promise.all([
        supabase.from('user_entities').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('mirror_conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      ])
    ]);

    // Process entities
    const topEntities = (entitiesResult.data || []).map(e => ({
      id: e.id,
      name: e.name,
      type: e.entity_type,
      subtype: e.subtype,
      summary: e.summary,
      importance: e.importance || 0,
      privacyLevel: e.privacy_level,
      facts: (e.entity_facts || []).map(f => ({
        predicate: f.predicate,
        value: f.object_text,
        confidence: f.confidence
      }))
    }));

    // Process topics
    const topics = (topicsResult.data || []).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      importance: t.importance_score || 0,
      mentions: t.mention_count || 0
    }));

    // Process behaviors
    const behaviors = (behaviorsResult.data || []).map(b => ({
      id: b.id,
      type: b.predicate,
      entity: b.entity_name || b.subject_entity?.name,
      entityType: b.subject_entity?.entity_type,
      topic: b.topic,
      sentiment: b.sentiment,
      confidence: b.confidence,
      reinforcements: b.reinforcement_count
    }));

    // Process patterns
    const patterns = (patternsResult.data || []).map(p => ({
      id: p.id,
      type: p.pattern_type,
      description: p.short_description || p.description,
      fullDescription: p.description,
      category: p.category,
      confidence: p.confidence
    }));

    // Static profile from onboarding
    const onboarding = onboardingResult.data;
    const staticProfile = {
      name: onboarding?.name || null,
      role: onboarding?.role_type || null,
      lifeSeasons: onboarding?.life_seasons || [],
      goals: onboarding?.goals || [],
      depthQuestion: onboarding?.depth_question || null,
      depthAnswer: onboarding?.depth_answer || null
    };

    // Stats
    const stats = {
      totalEntities: statsResult[0].count || 0,
      totalNotes: statsResult[1].count || 0,
      totalConversations: statsResult[2].count || 0
    };

    const loadTime = Date.now() - startTime;

    return res.status(200).json({
      static: staticProfile,
      topEntities,
      topics,
      behaviors,
      patterns,
      stats,
      meta: {
        loadTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[profile] Error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
