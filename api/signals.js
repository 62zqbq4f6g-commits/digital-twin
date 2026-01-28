/**
 * api/signals.js - Phase 13C: Signal Tracking API
 * Stores and retrieves user activity signals for MIRROR intelligence
 */

const { createClient } = require('@supabase/supabase-js');
const { setCorsHeaders, handlePreflight } = require('./lib/cors.js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

module.exports = async (req, res) => {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Store authenticated user_id for use in handlers
  req.authenticatedUserId = user.id;

  try {
    if (req.method === 'POST') {
      return await handleBatchInsert(req, res);
    } else if (req.method === 'GET') {
      return await handleGetSignals(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Signals API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle batch signal insert
 */
async function handleBatchInsert(req, res) {
  // Use authenticated user ID to prevent IDOR
  const user_id = req.authenticatedUserId;
  const { signals } = req.body;

  if (!signals || !Array.isArray(signals)) {
    return res.status(400).json({ error: 'Missing signals array' });
  }

  // Prepare signals for insert
  const signalsToInsert = signals.map(s => ({
    user_id: user_id,
    signal_type: s.signal_type,
    signal_data: s.signal_data,
    created_at: s.signal_data?.timestamp || new Date().toISOString()
  }));

  const { error } = await supabase
    .from('user_activity_signals')
    .insert(signalsToInsert);

  if (error) {
    console.error('[Signals API] Insert error:', error);
    return res.status(500).json({ error: 'Failed to store signals' });
  }

  return res.status(200).json({ success: true, count: signals.length });
}

/**
 * Handle get signals request
 */
async function handleGetSignals(req, res) {
  const { user_id, summary, days = 7, signal_type } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

  if (summary === 'true') {
    return await handleGetSummary(res, user_id, cutoffDate);
  }

  // Get raw signals
  let query = supabase
    .from('user_activity_signals')
    .select('*')
    .eq('user_id', user_id)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (signal_type) {
    query = query.eq('signal_type', signal_type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Signals API] Query error:', error);
    return res.status(500).json({ error: 'Failed to get signals' });
  }

  return res.status(200).json({ signals: data });
}

/**
 * Get signals summary for MIRROR context
 */
async function handleGetSummary(res, userId, cutoffDate) {
  // Get signal counts by type
  const { data: signals, error } = await supabase
    .from('user_activity_signals')
    .select('signal_type, signal_data, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Signals API] Summary query error:', error);
    return res.status(500).json({ error: 'Failed to get summary' });
  }

  // Compute summary
  const summary = computeSignalsSummary(signals);

  return res.status(200).json(summary);
}

/**
 * Compute summary statistics from signals
 */
function computeSignalsSummary(signals) {
  const summary = {
    total_signals: signals.length,
    last_activity: signals[0]?.created_at || null,

    // Counts by type
    notes_created: 0,
    entities_clicked: [],
    patterns_confirmed: 0,
    patterns_rejected: 0,
    mirror_conversations: 0,

    // Activity patterns
    active_hours: {},
    active_days: {},

    // Engagement
    avg_session_length: 0,
    total_sessions: new Set(),

    // Emotional signals (from reflection feedback)
    positive_feedback: 0,
    negative_feedback: 0
  };

  const sessionDurations = {};

  for (const signal of signals) {
    const data = signal.signal_data || {};

    // Session tracking
    if (data.session_id) {
      summary.total_sessions.add(data.session_id);
    }

    switch (signal.signal_type) {
      case 'note_created':
        summary.notes_created++;
        if (data.hour_of_day !== undefined) {
          summary.active_hours[data.hour_of_day] =
            (summary.active_hours[data.hour_of_day] || 0) + 1;
        }
        if (data.day_of_week !== undefined) {
          summary.active_days[data.day_of_week] =
            (summary.active_days[data.day_of_week] || 0) + 1;
        }
        break;

      case 'entity_clicked':
        summary.entities_clicked.push({
          name: data.entity_name,
          type: data.entity_type,
          timestamp: signal.created_at
        });
        break;

      case 'pattern_confirmed':
        summary.patterns_confirmed++;
        break;

      case 'pattern_rejected':
        summary.patterns_rejected++;
        break;

      case 'mirror_opened':
        summary.mirror_conversations++;
        break;

      case 'reflection_feedback':
        if (data.feedback_type === 'thumbs_up') {
          summary.positive_feedback++;
        } else if (data.feedback_type === 'thumbs_down') {
          summary.negative_feedback++;
        }
        break;
    }
  }

  // Convert session Set to count
  summary.total_sessions = summary.total_sessions.size;

  // Get most active time
  let maxHour = 0, maxHourCount = 0;
  for (const [hour, count] of Object.entries(summary.active_hours)) {
    if (count > maxHourCount) {
      maxHour = parseInt(hour);
      maxHourCount = count;
    }
  }
  summary.most_active_hour = maxHour;

  // Get most active day
  let maxDay = 0, maxDayCount = 0;
  for (const [day, count] of Object.entries(summary.active_days)) {
    if (count > maxDayCount) {
      maxDay = parseInt(day);
      maxDayCount = count;
    }
  }
  summary.most_active_day = maxDay;

  // Top entities (by click count)
  const entityCounts = {};
  for (const entity of summary.entities_clicked) {
    entityCounts[entity.name] = (entityCounts[entity.name] || 0) + 1;
  }
  summary.top_entities = Object.entries(entityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return summary;
}
