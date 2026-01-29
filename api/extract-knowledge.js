/**
 * UNIFIED KNOWLEDGE EXTRACTION API
 *
 * Single endpoint for all knowledge extraction requests.
 * Routes inputs through the unified extraction pipeline.
 *
 * POST /api/extract-knowledge
 * Body: { type: 'note'|'profile'|'key_person'|..., data: {...} }
 *
 * @module api/extract-knowledge
 */

import { createClient } from '@supabase/supabase-js';
import { routeInput, INPUT_TYPES } from '../lib/extraction/input-router.js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
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
    const { type, data, async = true } = req.body;

    // Validate input type
    if (!type || !Object.values(INPUT_TYPES).includes(type)) {
      return res.status(400).json({
        error: 'Invalid input type',
        validTypes: Object.values(INPUT_TYPES)
      });
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Data object required' });
    }

    console.log(`[extract-knowledge] Processing ${type} for user ${userId}`);

    if (async) {
      // Fire and forget - return immediately
      routeInput(userId, type, data, { supabase })
        .catch(err => console.error('[extract-knowledge] Background error:', err.message));

      return res.status(202).json({
        status: 'queued',
        message: 'Extraction queued for processing',
        type
      });
    } else {
      // Wait for result
      const results = await routeInput(userId, type, data, { supabase });

      return res.status(200).json({
        status: 'complete',
        results: results || { message: 'No knowledge extracted' },
        type
      });
    }

  } catch (error) {
    console.error('[extract-knowledge] Error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Edge runtime config for faster cold starts
 */
export const config = {
  runtime: 'edge',
  regions: ['iad1'] // US East for lower latency
};
