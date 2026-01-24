/**
 * /api/memory-moments - Phase 15: Proactive Memory Surfacing
 *
 * Transforms Inscript from reactive to proactive companion.
 * Surfaces relevant memories, anniversaries, and patterns.
 *
 * Endpoints:
 * GET  /api/memory-moments - Fetch pending moments
 * POST /api/memory-moments/:id/engage - Mark moment as engaged
 * POST /api/memory-moments/:id/dismiss - Dismiss a moment
 * GET  /api/memory-moments/preferences - Get notification preferences
 * PUT  /api/memory-moments/preferences - Update notification preferences
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user_id = req.query.user_id || req.body?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    // Route based on path and method
    const path = req.url?.split('?')[0] || '';

    if (path.includes('/preferences')) {
      if (req.method === 'GET') {
        return await handleGetPreferences(req, res, user_id);
      } else if (req.method === 'PUT') {
        return await handleUpdatePreferences(req, res, user_id);
      }
    } else if (path.includes('/engage')) {
      return await handleEngage(req, res, user_id);
    } else if (path.includes('/dismiss')) {
      return await handleDismiss(req, res, user_id);
    } else if (req.method === 'GET') {
      return await handleGetMoments(req, res, user_id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[memory-moments] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/memory-moments - Fetch pending moments
 * Query: { status?: 'pending' | 'shown' | 'all', limit?: number }
 */
async function handleGetMoments(req, res, user_id) {
  const status = req.query.status || 'pending';
  const limit = parseInt(req.query.limit) || 10;

  console.log(`[memory-moments] Fetching ${status} moments for user ${user_id}`);

  let query = supabase
    .from('memory_moments')
    .select(`
      id,
      moment_type,
      title,
      content,
      related_entity_id,
      related_note_ids,
      priority,
      shown_at,
      dismissed_at,
      engaged_at,
      created_at
    `)
    .eq('user_id', user_id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'pending') {
    // Not yet shown or dismissed
    query = query.is('shown_at', null).is('dismissed_at', null);
  } else if (status === 'shown') {
    // Shown but not engaged or dismissed
    query = query.not('shown_at', 'is', null).is('dismissed_at', null).is('engaged_at', null);
  }

  const { data: moments, error } = await query;

  if (error) {
    console.error('[memory-moments] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch moments' });
  }

  // Enrich moments with related entity data
  const enrichedMoments = await enrichMoments(moments || []);

  // Mark as shown
  if (enrichedMoments.length > 0) {
    const momentIds = enrichedMoments.filter(m => !m.shown_at).map(m => m.id);
    if (momentIds.length > 0) {
      await supabase
        .from('memory_moments')
        .update({ shown_at: new Date().toISOString() })
        .in('id', momentIds);
    }
  }

  return res.status(200).json({
    moments: enrichedMoments
  });
}

/**
 * POST /api/memory-moments/:id/engage - Mark moment as engaged
 */
async function handleEngage(req, res, user_id) {
  // Extract moment ID from path
  const path = req.url?.split('?')[0] || '';
  const match = path.match(/\/memory-moments\/([^\/]+)\/engage/);
  const moment_id = match ? match[1] : req.body?.moment_id;

  if (!moment_id) {
    return res.status(400).json({ error: 'moment_id required' });
  }

  console.log(`[memory-moments] Engaging moment ${moment_id} for user ${user_id}`);

  // Verify moment belongs to user
  const { data: moment, error: fetchError } = await supabase
    .from('memory_moments')
    .select('id')
    .eq('id', moment_id)
    .eq('user_id', user_id)
    .single();

  if (fetchError || !moment) {
    return res.status(404).json({ error: 'Moment not found' });
  }

  const { error: updateError } = await supabase
    .from('memory_moments')
    .update({ engaged_at: new Date().toISOString() })
    .eq('id', moment_id);

  if (updateError) {
    console.error('[memory-moments] Update error:', updateError);
    return res.status(500).json({ error: 'Failed to update moment' });
  }

  return res.status(200).json({ success: true });
}

/**
 * POST /api/memory-moments/:id/dismiss - Dismiss a moment
 */
async function handleDismiss(req, res, user_id) {
  // Extract moment ID from path
  const path = req.url?.split('?')[0] || '';
  const match = path.match(/\/memory-moments\/([^\/]+)\/dismiss/);
  const moment_id = match ? match[1] : req.body?.moment_id;

  if (!moment_id) {
    return res.status(400).json({ error: 'moment_id required' });
  }

  console.log(`[memory-moments] Dismissing moment ${moment_id} for user ${user_id}`);

  // Verify moment belongs to user
  const { data: moment, error: fetchError } = await supabase
    .from('memory_moments')
    .select('id')
    .eq('id', moment_id)
    .eq('user_id', user_id)
    .single();

  if (fetchError || !moment) {
    return res.status(404).json({ error: 'Moment not found' });
  }

  const { error: updateError } = await supabase
    .from('memory_moments')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', moment_id);

  if (updateError) {
    console.error('[memory-moments] Update error:', updateError);
    return res.status(500).json({ error: 'Failed to update moment' });
  }

  return res.status(200).json({ success: true });
}

/**
 * GET /api/memory-moments/preferences - Get notification preferences
 */
async function handleGetPreferences(req, res, user_id) {
  console.log(`[memory-moments] Getting preferences for user ${user_id}`);

  const { data: prefs, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) {
    console.error('[memory-moments] Preferences fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch preferences' });
  }

  // Return defaults if no preferences exist
  if (!prefs) {
    return res.status(200).json({
      preferences: {
        timezone: 'UTC',
        memory_moments_enabled: true,
        monthly_report_enabled: true,
        monthly_report_day: 1,
        quiet_hours_start: null,
        quiet_hours_end: null
      }
    });
  }

  return res.status(200).json({
    preferences: {
      timezone: prefs.timezone,
      memory_moments_enabled: prefs.memory_moments_enabled,
      monthly_report_enabled: prefs.monthly_report_enabled,
      monthly_report_day: prefs.monthly_report_day,
      quiet_hours_start: prefs.quiet_hours_start,
      quiet_hours_end: prefs.quiet_hours_end
    }
  });
}

/**
 * PUT /api/memory-moments/preferences - Update notification preferences
 */
async function handleUpdatePreferences(req, res, user_id) {
  const {
    timezone,
    memory_moments_enabled,
    monthly_report_enabled,
    monthly_report_day,
    quiet_hours_start,
    quiet_hours_end
  } = req.body;

  console.log(`[memory-moments] Updating preferences for user ${user_id}`);

  // Build update object with only provided fields
  const updates = {};
  if (timezone !== undefined) updates.timezone = timezone;
  if (memory_moments_enabled !== undefined) updates.memory_moments_enabled = memory_moments_enabled;
  if (monthly_report_enabled !== undefined) updates.monthly_report_enabled = monthly_report_enabled;
  if (monthly_report_day !== undefined) updates.monthly_report_day = monthly_report_day;
  if (quiet_hours_start !== undefined) updates.quiet_hours_start = quiet_hours_start;
  if (quiet_hours_end !== undefined) updates.quiet_hours_end = quiet_hours_end;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  // Upsert preferences
  const { data: prefs, error } = await supabase
    .from('user_notification_preferences')
    .upsert({
      user_id,
      ...updates,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('[memory-moments] Preferences update error:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }

  return res.status(200).json({
    preferences: {
      timezone: prefs.timezone,
      memory_moments_enabled: prefs.memory_moments_enabled,
      monthly_report_enabled: prefs.monthly_report_enabled,
      monthly_report_day: prefs.monthly_report_day,
      quiet_hours_start: prefs.quiet_hours_start,
      quiet_hours_end: prefs.quiet_hours_end
    }
  });
}

/**
 * Enrich moments with related entity data
 */
async function enrichMoments(moments) {
  if (moments.length === 0) return [];

  // Get unique entity IDs
  const entityIds = moments
    .filter(m => m.related_entity_id)
    .map(m => m.related_entity_id);

  if (entityIds.length === 0) return moments;

  // Fetch entities
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, relationship')
    .in('id', entityIds);

  const entityMap = new Map((entities || []).map(e => [e.id, e]));

  // Enrich moments
  return moments.map(m => {
    if (m.related_entity_id && entityMap.has(m.related_entity_id)) {
      const entity = entityMap.get(m.related_entity_id);
      return {
        ...m,
        related_entity: {
          name: entity.name,
          type: entity.entity_type,
          relationship: entity.relationship
        }
      };
    }
    return m;
  });
}
