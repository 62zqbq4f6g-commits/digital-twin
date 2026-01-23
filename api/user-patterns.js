/**
 * /api/user-patterns - Phase 13A: Pattern CRUD and Verification
 *
 * Endpoints:
 * GET  /api/user-patterns - List all patterns for user
 * GET  /api/user-patterns?surfaceable=true - Get pattern eligible to show
 * POST /api/user-patterns - Verify a pattern (confirm/reject)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

// Frequency limits
const MIN_DAYS_BETWEEN_SURFACE = 7;
const MAX_PATTERNS_PER_WEEK = 3;
const MIN_CONFIDENCE_TO_SURFACE = 0.75;
const DISMISS_COOLDOWN_DAYS = 14;
const MAX_DISMISSALS_BEFORE_COOLDOWN = 3;

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract user_id from query or body
  const user_id = req.query.user_id || req.body?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res, user_id);
    } else if (req.method === 'POST') {
      return await handlePost(req, res, user_id);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[user-patterns] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET - List patterns or get surfaceable pattern
 */
async function handleGet(req, res, user_id) {
  const { surfaceable, context } = req.query;

  if (surfaceable === 'true') {
    // Get a pattern eligible to show (for reflection or MIRROR)
    const pattern = await getSurfaceablePattern(user_id, context);
    return res.status(200).json({ pattern });
  }

  // List all patterns for user (exclude rejected/dismissed patterns)
  const { data: patterns, error } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', user_id)
    .neq('status', 'rejected')
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[user-patterns] Error fetching patterns:', error);
    return res.status(500).json({ error: 'Failed to fetch patterns' });
  }

  return res.status(200).json({
    patterns: patterns.map(p => ({
      id: p.id,
      type: p.pattern_type,
      description: p.description,
      shortDescription: p.short_description,
      confidence: p.confidence,
      status: p.status,
      evidenceCount: p.evidence?.occurrences || 0,
      surfacedCount: p.surfaced_count,
      confirmedAt: p.confirmed_at,
      rejectedAt: p.rejected_at
    }))
  });
}

/**
 * POST - Verify a pattern (confirm or reject)
 */
async function handlePost(req, res, user_id) {
  const { pattern_id, action, feedback } = req.body;

  if (!pattern_id || !action) {
    return res.status(400).json({ error: 'pattern_id and action required' });
  }

  if (!['confirm', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "confirm" or "reject"' });
  }

  // Verify pattern belongs to user
  const { data: pattern, error: fetchError } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('id', pattern_id)
    .eq('user_id', user_id)
    .single();

  if (fetchError || !pattern) {
    return res.status(404).json({ error: 'Pattern not found' });
  }

  const now = new Date().toISOString();
  let updateData = { updated_at: now };

  if (action === 'confirm') {
    updateData = {
      ...updateData,
      status: 'confirmed',
      confirmed_at: now,
      // Boost confidence on confirmation
      confidence: Math.min(0.99, pattern.confidence + 0.1)
    };
  } else {
    updateData = {
      ...updateData,
      status: 'rejected',
      rejected_at: now,
      rejection_reason: feedback || null,
      // Lower confidence on rejection
      confidence: Math.max(0.3, pattern.confidence - 0.2)
    };
  }

  const { error: updateError } = await supabase
    .from('user_patterns')
    .update(updateData)
    .eq('id', pattern_id);

  if (updateError) {
    console.error('[user-patterns] Error updating pattern:', updateError);
    return res.status(500).json({ error: 'Failed to update pattern' });
  }

  return res.status(200).json({
    success: true,
    message: action === 'confirm' ? 'Pattern confirmed' : 'Pattern rejected',
    pattern_id
  });
}

/**
 * Get a pattern eligible to be surfaced
 * Respects frequency limits and confidence thresholds
 */
async function getSurfaceablePattern(user_id, context) {
  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Check if user is in cooldown (3 dismissals in a row)
  const { data: recentRejections } = await supabase
    .from('user_patterns')
    .select('id')
    .eq('user_id', user_id)
    .eq('status', 'rejected')
    .gte('rejected_at', new Date(now - DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString())
    .order('rejected_at', { ascending: false })
    .limit(MAX_DISMISSALS_BEFORE_COOLDOWN);

  if (recentRejections && recentRejections.length >= MAX_DISMISSALS_BEFORE_COOLDOWN) {
    console.log('[user-patterns] User in cooldown period');
    return null;
  }

  // Check weekly limit
  const { data: surfacedThisWeek } = await supabase
    .from('user_patterns')
    .select('id')
    .eq('user_id', user_id)
    .gte('last_surfaced_at', oneWeekAgo);

  if (surfacedThisWeek && surfacedThisWeek.length >= MAX_PATTERNS_PER_WEEK) {
    console.log('[user-patterns] Weekly pattern limit reached');
    return null;
  }

  // Get eligible patterns
  const minLastSurfaced = new Date(now - MIN_DAYS_BETWEEN_SURFACE * 24 * 60 * 60 * 1000).toISOString();

  const { data: patterns, error } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'detected') // Only detected (not confirmed/rejected)
    .gte('confidence', MIN_CONFIDENCE_TO_SURFACE)
    .or(`last_surfaced_at.is.null,last_surfaced_at.lt.${minLastSurfaced}`)
    .order('confidence', { ascending: false })
    .limit(1);

  if (error || !patterns || patterns.length === 0) {
    return null;
  }

  const pattern = patterns[0];

  // Mark as surfaced
  await supabase
    .from('user_patterns')
    .update({
      status: 'surfaced',
      surfaced_count: pattern.surfaced_count + 1,
      last_surfaced_at: now.toISOString()
    })
    .eq('id', pattern.id);

  return {
    id: pattern.id,
    type: pattern.pattern_type,
    description: pattern.description,
    shortDescription: pattern.short_description,
    confidence: pattern.confidence,
    prompt: generatePatternPrompt(pattern)
  };
}

/**
 * Generate a friendly prompt for pattern verification
 */
function generatePatternPrompt(pattern) {
  // Use warm, friendly language - never clinical
  const prompts = {
    temporal: [
      `I've noticed ${pattern.short_description.toLowerCase()}. Does that resonate?`,
      `There seems to be a pattern: ${pattern.short_description.toLowerCase()}. Does that feel right?`
    ]
  };

  const typePrompts = prompts[pattern.pattern_type] || prompts.temporal;
  return typePrompts[Math.floor(Math.random() * typePrompts.length)];
}
