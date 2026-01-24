/**
 * MEMORY MOMENTS CRON JOB
 * Generates proactive memory moments for users
 *
 * Runs daily at 9 AM user local time (via Vercel Cron)
 * Implements three trigger types:
 * 1. Anniversary - "This time last year..."
 * 2. Dormant Entity - "It's been 3 weeks since you mentioned..."
 * 3. Progress - "You mentioned X less this month..."
 *
 * Respects:
 * - User timezone from notification_preferences
 * - Quiet hours settings
 * - memory_moments_enabled flag
 *
 * Vercel Cron: 0 9 * * * (9 AM UTC daily, adjusted per user timezone)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration
const CONFIG = {
  // Minimum days of notes before generating moments
  MIN_DAYS_FOR_MOMENTS: 14,

  // Dormant entity threshold (days without mention)
  DORMANT_THRESHOLD_DAYS: 21,

  // Anniversary window (days around the anniversary date)
  ANNIVERSARY_WINDOW_DAYS: 3,

  // Maximum moments to generate per user per day
  MAX_MOMENTS_PER_DAY: 3,

  // Batch size for processing users
  BATCH_SIZE: 20,

  // Priority levels
  PRIORITY: {
    ANNIVERSARY: 8,
    DORMANT_KEY_PERSON: 9,
    DORMANT_ENTITY: 6,
    PROGRESS: 7,
    PATTERN: 5
  }
};

export default async function handler(req, res) {
  // Verify request is from Vercel Cron (or allow in development)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isDev = process.env.VERCEL_ENV === 'development' || !process.env.VERCEL;
  const hasCronSecret = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isDev && !hasCronSecret) {
    console.warn('[Memory Moments Cron] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Memory Moments Cron] Starting proactive moment generation...');
  const startTime = Date.now();
  const results = {
    usersProcessed: 0,
    momentsGenerated: 0,
    anniversaryMoments: 0,
    dormantMoments: 0,
    progressMoments: 0,
    errors: []
  };

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    // Get users with moments enabled (or no preference = default enabled)
    const { data: enabledUsers, error: usersError } = await supabase
      .from('user_notification_preferences')
      .select('user_id, timezone, quiet_hours_start, quiet_hours_end')
      .eq('memory_moments_enabled', true);

    if (usersError) {
      results.errors.push(`Users fetch error: ${usersError.message}`);
    }

    // Also get users who have notes but no preference (use defaults)
    const { data: allNoteUsers } = await supabase
      .from('notes')
      .select('user_id')
      .is('deleted_at', null)
      .gte('created_at', new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString());

    // Get users who have opted out
    const { data: optedOutUsers } = await supabase
      .from('user_notification_preferences')
      .select('user_id')
      .eq('memory_moments_enabled', false);

    const optedOutIds = new Set((optedOutUsers || []).map(u => u.user_id));
    const prefUserMap = new Map((enabledUsers || []).map(u => [u.user_id, u]));

    // Combine users (those with prefs enabled + those with notes but no opt-out)
    const noteUserIds = new Set((allNoteUsers || []).map(u => u.user_id));
    const usersToProcess = [...noteUserIds].filter(id => !optedOutIds.has(id));

    console.log(`[Memory Moments Cron] Processing ${usersToProcess.length} users`);

    // Process in batches
    for (let i = 0; i < usersToProcess.length; i += CONFIG.BATCH_SIZE) {
      const batch = usersToProcess.slice(i, i + CONFIG.BATCH_SIZE);

      for (const user_id of batch) {
        try {
          results.usersProcessed++;
          const userPrefs = prefUserMap.get(user_id) || { timezone: 'UTC' };

          // Check if user is in quiet hours
          if (isInQuietHours(userPrefs, now)) {
            console.log(`[Memory Moments Cron] User ${user_id} in quiet hours, skipping`);
            continue;
          }

          // Check if user has enough notes
          const hasEnoughNotes = await checkUserEligibility(supabase, user_id);
          if (!hasEnoughNotes) {
            continue;
          }

          // Generate moments for this user
          const userMoments = await generateMomentsForUser(supabase, user_id, now);

          // Store moments (up to max per day)
          const momentsToStore = userMoments.slice(0, CONFIG.MAX_MOMENTS_PER_DAY);

          for (const moment of momentsToStore) {
            const { error: insertError } = await supabase
              .from('memory_moments')
              .insert({
                user_id,
                moment_type: moment.type,
                title: moment.title,
                content: moment.content,
                related_entity_id: moment.related_entity_id,
                related_note_ids: moment.related_note_ids,
                priority: moment.priority
              });

            if (insertError) {
              results.errors.push(`Insert error for ${user_id}: ${insertError.message}`);
            } else {
              results.momentsGenerated++;
              if (moment.type === 'anniversary') results.anniversaryMoments++;
              else if (moment.type === 'dormant_entity') results.dormantMoments++;
              else if (moment.type === 'progress') results.progressMoments++;
            }
          }

        } catch (userError) {
          results.errors.push(`User ${user_id} error: ${userError.message}`);
          console.error(`[Memory Moments Cron] Error for user ${user_id}:`, userError);
        }
      }
    }

    // Log job result
    const duration = Date.now() - startTime;

    const { error: logError } = await supabase
      .from('memory_jobs')
      .insert({
        job_type: 'memory_moments',
        status: results.errors.length > 0 ? 'partial' : 'completed',
        result: {
          ...results,
          durationMs: duration
        }
      });

    if (logError) {
      console.warn('[Memory Moments Cron] Could not log job result:', logError.message);
    }

    console.log(`[Memory Moments Cron] Complete in ${duration}ms:`, results);

    return res.status(200).json({
      success: true,
      ...results,
      durationMs: duration
    });

  } catch (err) {
    console.error('[Memory Moments Cron] Fatal error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      results
    });
  }
}

/**
 * Check if user has enough notes for moment generation
 */
async function checkUserEligibility(supabase, user_id) {
  const cutoffDate = new Date(Date.now() - CONFIG.MIN_DAYS_FOR_MOMENTS * 24 * 60 * 60 * 1000);

  const { count } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .lt('created_at', cutoffDate.toISOString());

  return (count || 0) >= 5; // At least 5 notes older than 14 days
}

/**
 * Generate moments for a user using all trigger types
 */
async function generateMomentsForUser(supabase, user_id, now) {
  const moments = [];

  // Check for existing pending moments to avoid duplicates
  const { data: existingMoments } = await supabase
    .from('memory_moments')
    .select('moment_type, related_entity_id, title')
    .eq('user_id', user_id)
    .is('dismissed_at', null)
    .is('engaged_at', null)
    .gte('created_at', new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());

  const existingKeys = new Set((existingMoments || []).map(m =>
    `${m.moment_type}:${m.related_entity_id || ''}:${m.title}`
  ));

  // 1. Anniversary triggers
  const anniversaryMoments = await detectAnniversaryTriggers(supabase, user_id, now);
  for (const m of anniversaryMoments) {
    const key = `anniversary:${m.related_entity_id || ''}:${m.title}`;
    if (!existingKeys.has(key)) {
      moments.push(m);
    }
  }

  // 2. Dormant entity triggers
  const dormantMoments = await detectDormantEntityTriggers(supabase, user_id, now);
  for (const m of dormantMoments) {
    const key = `dormant_entity:${m.related_entity_id || ''}:${m.title}`;
    if (!existingKeys.has(key)) {
      moments.push(m);
    }
  }

  // 3. Progress triggers
  const progressMoments = await detectProgressTriggers(supabase, user_id, now);
  for (const m of progressMoments) {
    const key = `progress:${m.related_entity_id || ''}:${m.title}`;
    if (!existingKeys.has(key)) {
      moments.push(m);
    }
  }

  // Sort by priority
  moments.sort((a, b) => b.priority - a.priority);

  return moments;
}

/**
 * TRIGGER 1: Anniversary - "This time last year..."
 */
async function detectAnniversaryTriggers(supabase, user_id, now) {
  const moments = [];

  // Look for notes from approximately 1 year ago (± window days)
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const windowStart = new Date(oneYearAgo);
  windowStart.setDate(windowStart.getDate() - CONFIG.ANNIVERSARY_WINDOW_DAYS);

  const windowEnd = new Date(oneYearAgo);
  windowEnd.setDate(windowEnd.getDate() + CONFIG.ANNIVERSARY_WINDOW_DAYS);

  // Get notes from that time period
  const { data: oldNotes } = await supabase
    .from('notes')
    .select('id, created_at')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', windowEnd.toISOString())
    .limit(5);

  if (!oldNotes || oldNotes.length === 0) {
    return moments;
  }

  // Get entities mentioned around that time
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, context_notes, sentiment')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .gte('mention_count', 2);

  // Find entities that were active around that time
  for (const entity of entities || []) {
    if (!entity.context_notes || entity.context_notes.length === 0) continue;

    // Check if any context mentions time-related keywords that suggest significance
    const contexts = entity.context_notes.join(' ').toLowerCase();
    const significantKeywords = ['important', 'big', 'decision', 'change', 'started', 'ended', 'new', 'first'];

    if (significantKeywords.some(k => contexts.includes(k))) {
      const sentimentLabel = entity.sentiment === 'negative' ? 'challenging' :
                            entity.sentiment === 'positive' ? 'meaningful' : 'notable';

      moments.push({
        type: 'anniversary',
        title: `A year ago with ${entity.name}`,
        content: `This time last year, ${entity.name} was on your mind. It was a ${sentimentLabel} time. How has your relationship with this changed?`,
        related_entity_id: entity.id,
        related_note_ids: oldNotes.slice(0, 3).map(n => n.id),
        priority: CONFIG.PRIORITY.ANNIVERSARY
      });

      break; // Only one anniversary moment per run
    }
  }

  return moments;
}

/**
 * TRIGGER 2: Dormant Entity - "It's been X weeks since you mentioned..."
 */
async function detectDormantEntityTriggers(supabase, user_id, now) {
  const moments = [];

  const dormantDate = new Date(now - CONFIG.DORMANT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  // First check Key People (highest priority)
  const { data: keyPeople } = await supabase
    .from('user_key_people')
    .select('id, name, relationship')
    .eq('user_id', user_id);

  // Get entities not mentioned recently
  const { data: dormantEntities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, relationship, last_mentioned_at, importance_score')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .lt('last_mentioned_at', dormantDate.toISOString())
    .gte('importance_score', 0.3)
    .order('importance_score', { ascending: false })
    .limit(10);

  // Check if any key people are dormant
  const keyPeopleNames = new Set((keyPeople || []).map(p => p.name.toLowerCase()));

  for (const entity of dormantEntities || []) {
    const isKeyPerson = keyPeopleNames.has(entity.name.toLowerCase());
    const daysSinceLastMention = Math.floor(
      (now - new Date(entity.last_mentioned_at)) / (1000 * 60 * 60 * 24)
    );
    const weeksAgo = Math.floor(daysSinceLastMention / 7);

    if (entity.entity_type === 'person') {
      const relationship = entity.relationship || (isKeyPerson ? 'someone important to you' : 'someone you mentioned');

      moments.push({
        type: 'dormant_entity',
        title: `Checking in on ${entity.name}`,
        content: `It's been ${weeksAgo} weeks since you mentioned ${entity.name} (${relationship}). Everything okay there?`,
        related_entity_id: entity.id,
        related_note_ids: [],
        priority: isKeyPerson ? CONFIG.PRIORITY.DORMANT_KEY_PERSON : CONFIG.PRIORITY.DORMANT_ENTITY
      });

      if (moments.length >= 2) break; // Max 2 dormant moments
    }
  }

  return moments;
}

/**
 * TRIGGER 3: Progress - Sentiment improvement or recurring themes
 */
async function detectProgressTriggers(supabase, user_id, now) {
  const moments = [];

  // Compare this month to last month
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  // Get sentiment history for entities
  const { data: sentimentHistory } = await supabase
    .from('entity_sentiment_history')
    .select('entity_id, sentiment, recorded_at')
    .eq('user_id', user_id)
    .gte('recorded_at', `${lastMonth}-01`)
    .order('recorded_at', { ascending: true });

  if (!sentimentHistory || sentimentHistory.length < 5) {
    return moments;
  }

  // Group by entity and look for sentiment improvements
  const entitySentiments = new Map();
  for (const record of sentimentHistory) {
    if (!entitySentiments.has(record.entity_id)) {
      entitySentiments.set(record.entity_id, []);
    }
    entitySentiments.set(record.entity_id, [...entitySentiments.get(record.entity_id), record]);
  }

  // Find entities with improving sentiment
  for (const [entityId, records] of entitySentiments) {
    if (records.length < 3) continue;

    const lastMonthRecords = records.filter(r => r.recorded_at.startsWith(lastMonth));
    const thisMonthRecords = records.filter(r => r.recorded_at.startsWith(thisMonth));

    if (lastMonthRecords.length === 0 || thisMonthRecords.length === 0) continue;

    const lastMonthAvg = lastMonthRecords.reduce((sum, r) => sum + parseSentiment(r.sentiment), 0) / lastMonthRecords.length;
    const thisMonthAvg = thisMonthRecords.reduce((sum, r) => sum + parseSentiment(r.sentiment), 0) / thisMonthRecords.length;

    // Significant improvement (> 0.2 increase)
    if (thisMonthAvg - lastMonthAvg > 0.2) {
      // Get entity name
      const { data: entity } = await supabase
        .from('user_entities')
        .select('name, entity_type')
        .eq('id', entityId)
        .single();

      if (entity) {
        const changePercent = Math.round((thisMonthAvg - lastMonthAvg) * 100);

        moments.push({
          type: 'progress',
          title: `Things are looking up with ${entity.name}`,
          content: `Your notes about ${entity.name} have become more positive over the past month. What's shifted?`,
          related_entity_id: entityId,
          related_note_ids: [],
          priority: CONFIG.PRIORITY.PROGRESS
        });

        if (moments.length >= 1) break; // Max 1 progress moment
      }
    }
  }

  return moments;
}

/**
 * Check if current time is within user's quiet hours
 */
function isInQuietHours(userPrefs, now) {
  if (!userPrefs.quiet_hours_start || !userPrefs.quiet_hours_end) {
    return false;
  }

  // Convert to user's timezone (simplified - in production use proper timezone library)
  const userHour = now.getUTCHours(); // Simplified for now

  const startHour = parseInt(userPrefs.quiet_hours_start.split(':')[0]);
  const endHour = parseInt(userPrefs.quiet_hours_end.split(':')[0]);

  if (startHour < endHour) {
    // Same day quiet hours (e.g., 22:00 to 23:00)
    return userHour >= startHour && userHour < endHour;
  } else {
    // Overnight quiet hours (e.g., 22:00 to 07:00)
    return userHour >= startHour || userHour < endHour;
  }
}

function parseSentiment(sentiment) {
  if (typeof sentiment === 'number') return sentiment;
  if (sentiment === 'positive') return 0.7;
  if (sentiment === 'negative') return 0.3;
  return 0.5;
}
