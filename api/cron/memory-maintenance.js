/**
 * MEMORY MAINTENANCE CRON JOB
 * Runs daily to keep the memory system healthy
 *
 * Tasks:
 * 1. Apply time decay to importance_score
 * 2. Archive expired entities
 * 3. Merge duplicate entities (future)
 * 4. Compress old memories into summaries (future)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    decayApplied: 0,
    entitiesArchived: 0,
    errors: []
  };

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================
    // TASK 1: Apply Time Decay to importance_score
    // ========================================
    // Decay formula: new_score = old_score * decay_factor
    // decay_factor = 0.99 per day (1% decay daily)
    // After 30 days: score * 0.99^30 = score * 0.74
    // After 90 days: score * 0.99^90 = score * 0.41

    console.log('[Memory Cron] Applying time decay...');

    const { data: decayResult, error: decayError } = await supabase.rpc('apply_memory_decay');

    if (decayError) {
      // RPC doesn't exist yet, use manual update
      console.log('[Memory Cron] RPC not available, using manual decay...');

      // Get all active entities with importance_score > 0.1
      const { data: entities, error: fetchError } = await supabase
        .from('user_entities')
        .select('id, importance_score')
        .eq('status', 'active')
        .gt('importance_score', 0.1);

      if (fetchError) {
        results.errors.push(`Decay fetch error: ${fetchError.message}`);
      } else if (entities?.length > 0) {
        // Apply 1% daily decay
        // Formula: new_score = old_score * 0.99
        // After 30 days: 0.74 of original
        // After 90 days: 0.41 of original
        const DAILY_DECAY = 0.99;
        const MIN_SCORE = 0.1; // Floor to prevent going to zero

        for (const entity of entities) {
          const newScore = Math.max(MIN_SCORE, (entity.importance_score || 0.5) * DAILY_DECAY);

          const { error: updateError } = await supabase
            .from('user_entities')
            .update({ importance_score: newScore })
            .eq('id', entity.id);

          if (!updateError) {
            results.decayApplied++;
          }
        }
        console.log(`[Memory Cron] Applied decay to ${results.decayApplied} entities`);
      }
    } else {
      results.decayApplied = decayResult?.count || 0;
    }

    // ========================================
    // TASK 2: Archive Expired Entities
    // ========================================
    console.log('[Memory Cron] Checking for expired entities...');

    const { data: archived, error: archiveError } = await supabase
      .from('user_entities')
      .update({ status: 'archived' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active')
      .select('id');

    if (archiveError) {
      results.errors.push(`Archive error: ${archiveError.message}`);
    } else {
      results.entitiesArchived = archived?.length || 0;
      if (results.entitiesArchived > 0) {
        console.log(`[Memory Cron] Archived ${results.entitiesArchived} expired entities`);
      }
    }

    // ========================================
    // TASK 3: Log Maintenance Results
    // ========================================
    const { error: logError } = await supabase
      .from('memory_jobs')
      .insert({
        job_type: 'daily_maintenance',
        status: results.errors.length > 0 ? 'partial' : 'completed',
        result: {
          decayApplied: results.decayApplied,
          entitiesArchived: results.entitiesArchived,
          errors: results.errors,
          durationMs: Date.now() - startTime
        }
      });

    if (logError) {
      console.warn('[Memory Cron] Could not log job result:', logError.message);
    }

    console.log(`[Memory Cron] Maintenance complete in ${Date.now() - startTime}ms`);

    return res.status(200).json({
      success: true,
      ...results,
      durationMs: Date.now() - startTime
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
