/**
 * /api/analytics - Phase 15: Product Analytics
 *
 * Tracks user engagement events for product analytics.
 * Respects user privacy - no PII in events.
 *
 * Events tracked:
 * - report_viewed: User opens State of You report
 * - report_shared: User shares report
 * - whisper_created: User saves a whisper
 * - whisper_reflected: User reflects on whispers
 * - moment_engaged: User engages with memory moment
 * - moment_dismissed: User dismisses memory moment
 *
 * POST /api/analytics
 * Body: { event: string, properties: object }
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

// Valid event types
const VALID_EVENTS = [
  'report_viewed',
  'report_shared',
  'whisper_created',
  'whisper_reflected',
  'moment_engaged',
  'moment_dismissed',
  'onboarding_completed',
  'note_created',
  'reflection_viewed',
  'mirror_opened',
  'pattern_confirmed',
  'pattern_rejected'
];

// Properties that contain PII and should be stripped
const PII_PROPERTIES = [
  'email',
  'name',
  'phone',
  'address',
  'ip_address',
  'user_agent',
  'content',
  'text',
  'message'
];

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_id = req.query.user_id || req.body?.user_id;
  const { event, properties } = req.body;

  if (!event) {
    return res.status(400).json({ error: 'event is required' });
  }

  // Validate event type
  if (!VALID_EVENTS.includes(event)) {
    console.warn(`[analytics] Unknown event type: ${event}`);
    // Still track it, but log warning
  }

  try {
    // Strip PII from properties
    const safeProperties = sanitizeProperties(properties || {});

    // Add metadata
    const analyticsData = {
      event,
      user_id: user_id || null,
      properties: safeProperties,
      timestamp: new Date().toISOString(),
      context: {
        page_url: req.headers.referer || null,
        platform: detectPlatform(req.headers['user-agent'] || '')
      }
    };

    console.log(`[analytics] Tracking event: ${event}`, {
      user_id: user_id ? 'set' : 'anonymous',
      properties: Object.keys(safeProperties)
    });

    // Store in analytics table (create if not exists)
    // For now, we'll use memory_jobs as a general log
    // In production, you'd use a dedicated analytics table or service
    const { error: insertError } = await supabase
      .from('memory_jobs')
      .insert({
        job_type: 'analytics_event',
        status: 'completed',
        result: analyticsData
      });

    if (insertError) {
      // Don't fail the request if analytics storage fails
      console.warn('[analytics] Storage error:', insertError.message);
    }

    // In production, you might also send to:
    // - Amplitude
    // - Mixpanel
    // - PostHog
    // - Custom analytics service

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[analytics] Error:', error);
    // Don't fail the request for analytics errors
    return res.status(200).json({ success: true });
  }
};

/**
 * Remove PII from properties
 */
function sanitizeProperties(properties) {
  const safe = {};

  for (const [key, value] of Object.entries(properties)) {
    // Skip PII fields
    if (PII_PROPERTIES.includes(key.toLowerCase())) {
      continue;
    }

    // Sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      safe[key] = sanitizeProperties(value);
    } else if (Array.isArray(value)) {
      // For arrays, just include counts not values (privacy)
      safe[key] = value.length;
    } else if (typeof value === 'string' && value.length > 100) {
      // Truncate long strings (might contain PII)
      safe[key] = '[truncated]';
    } else {
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Detect platform from user agent
 */
function detectPlatform(userAgent) {
  const ua = userAgent.toLowerCase();

  if (ua.includes('iphone') || ua.includes('ipad')) {
    return 'ios';
  } else if (ua.includes('android')) {
    return 'android';
  } else if (ua.includes('mac')) {
    return 'macos';
  } else if (ua.includes('windows')) {
    return 'windows';
  } else if (ua.includes('linux')) {
    return 'linux';
  }

  return 'unknown';
}
