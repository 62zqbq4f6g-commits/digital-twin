/**
 * MEMORY MAINTENANCE CRON JOB
 * Runs daily to keep the memory system healthy
 *
 * Philosophy:
 * - Memories strengthen when mentioned (handled at write-time)
 * - Memories fade naturally when not accessed (handled here + read-time)
 * - Very old, low-importance memories get archived
 *
 * Tasks:
 * 1. Apply decay to STALE entities only (not mentioned in 30+ days)
 * 2. Archive ABANDONED entities (not mentioned in 180+ days + low importance)
 * 3. Log maintenance results
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration
const CONFIG = {
  // Only decay entities not mentioned in this many days
  STALE_THRESHOLD_DAYS: 30,

  // Archive entities not mentioned in this many days (with low importance)
  ARCHIVE_THRESHOLD_DAYS: 180,

  // Only archive if importance_score below this
  ARCHIVE_IMPORTANCE_THRESHOLD: 0.2,

  // Daily decay rate for stale entities (2% per day)
  DAILY_DECAY_RATE: 0.98,

  // Floor - never decay below this
  MIN_IMPORTANCE: 0.1,
};

export default async function handler(req, res) {
  // Verify request is from Vercel Cron (or allow in development)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isDev = process.env.VERCEL_ENV === 'development' || !process.env.VERCEL;
  const hasCronSecret = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isDev && !hasCronSecret) {
    console.warn('[Memory Cron] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Memory Cron] Starting memory maintenance...');
  const startTime = Date.now();
  const results = {
    staleEntitiesDecayed: 0,
    entitiesArchived: 0,
    expiredEntitiesArchived: 0,
    errors: []
  };

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const staleDate = new Date(now - CONFIG.STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const archiveDate = new Date(now - CONFIG.ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // ========================================
    // TASK 1: Decay STALE Entities Only
    // ========================================
    // Only apply decay to entities not mentioned in 30+ days
    // This allows recently-mentioned entities to stay strong

    console.log('[Memory Cron] Finding stale entities (not mentioned since', staleDate.toISOString().split('T')[0], ')...');

    const { data: staleEntities, error: staleError } = await supabase
      .from('user_entities')
      .select('id, name, importance_score, last_mentioned_at')
      .eq('status', 'active')
      .gt('importance_score', CONFIG.MIN_IMPORTANCE)
      .lt('last_mentioned_at', staleDate.toISOString());

    if (staleError) {
      results.errors.push(`Stale fetch error: ${staleError.message}`);
    } else if (staleEntities?.length > 0) {
      console.log(`[Memory Cron] Found ${staleEntities.length} stale entities to decay`);

      for (const entity of staleEntities) {
        // Calculate days since last mention
        const lastMention = new Date(entity.last_mentioned_at);
        const daysSinceLastMention = Math.floor((now - lastMention) / (1000 * 60 * 60 * 24));
        const daysOfDecay = daysSinceLastMention - CONFIG.STALE_THRESHOLD_DAYS;

        // Apply decay for each day past the threshold
        const decayFactor = Math.pow(CONFIG.DAILY_DECAY_RATE, daysOfDecay);
        const newScore = Math.max(CONFIG.MIN_IMPORTANCE, entity.importance_score * decayFactor);

        // Only update if there's meaningful change
        if (entity.importance_score - newScore > 0.01) {
          const { error: updateError } = await supabase
            .from('user_entities')
            .update({ importance_score: newScore })
            .eq('id', entity.id);

          if (!updateError) {
            results.staleEntitiesDecayed++;
          }
        }
      }
      console.log(`[Memory Cron] Decayed ${results.staleEntitiesDecayed} stale entities`);
    } else {
      console.log('[Memory Cron] No stale entities to decay');
    }

    // ========================================
    // TASK 2: Archive ABANDONED Entities
    // ========================================
    // Entities not mentioned in 180+ days with low importance

    console.log('[Memory Cron] Finding abandoned entities (not mentioned since', archiveDate.toISOString().split('T')[0], ')...');

    const { data: abandonedEntities, error: abandonedError } = await supabase
      .from('user_entities')
      .select('id, name')
      .eq('status', 'active')
      .lt('importance_score', CONFIG.ARCHIVE_IMPORTANCE_THRESHOLD)
      .lt('last_mentioned_at', archiveDate.toISOString());

    if (abandonedError) {
      results.errors.push(`Abandoned fetch error: ${abandonedError.message}`);
    } else if (abandonedEntities?.length > 0) {
      console.log(`[Memory Cron] Found ${abandonedEntities.length} abandoned entities to archive`);

      const { error: archiveError } = await supabase
        .from('user_entities')
        .update({ status: 'archived' })
        .in('id', abandonedEntities.map(e => e.id));

      if (archiveError) {
        results.errors.push(`Archive error: ${archiveError.message}`);
      } else {
        results.entitiesArchived = abandonedEntities.length;
        console.log(`[Memory Cron] Archived ${results.entitiesArchived} abandoned entities`);
      }
    } else {
      console.log('[Memory Cron] No abandoned entities to archive');
    }

    // ========================================
    // TASK 3: Archive Explicitly Expired Entities
    // ========================================

    const { data: expiredEntities, error: expiredError } = await supabase
      .from('user_entities')
      .select('id')
      .eq('status', 'active')
      .lt('expires_at', now.toISOString());

    if (expiredError) {
      results.errors.push(`Expired fetch error: ${expiredError.message}`);
    } else if (expiredEntities?.length > 0) {
      const { error: archiveExpiredError } = await supabase
        .from('user_entities')
        .update({ status: 'archived' })
        .in('id', expiredEntities.map(e => e.id));

      if (!archiveExpiredError) {
        results.expiredEntitiesArchived = expiredEntities.length;
        console.log(`[Memory Cron] Archived ${results.expiredEntitiesArchived} expired entities`);
      }
    }

    // ========================================
    // TASK 4: Log Maintenance Results
    // ========================================
    const duration = Date.now() - startTime;

    const { error: logError } = await supabase
      .from('memory_jobs')
      .insert({
        job_type: 'daily_maintenance',
        status: results.errors.length > 0 ? 'partial' : 'completed',
        result: {
          ...results,
          config: CONFIG,
          durationMs: duration
        }
      });

    if (logError) {
      console.warn('[Memory Cron] Could not log job result:', logError.message);
    }

    console.log(`[Memory Cron] Maintenance complete in ${duration}ms:`, results);

    return res.status(200).json({
      success: true,
      ...results,
      durationMs: duration
    });

  } catch (err) {
    console.error('[Memory Cron] Fatal error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      results
    });
  }
}
