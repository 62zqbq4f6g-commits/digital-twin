/**
 * INSCRIPT: Update Privacy API
 *
 * T3 Frontend Lead - Sprint 2
 *
 * Updates privacy_level for an entity, note, or pattern.
 * Validates inputs and ensures user ownership.
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const ALLOWED_TABLES = ['user_entities', 'notes', 'user_patterns'];
const ALLOWED_LEVELS = ['private', 'internal', 'shared'];

export default async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { table, id, privacy_level } = req.body;

    // Validate inputs
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }
    if (!ALLOWED_LEVELS.includes(privacy_level)) {
      return res.status(400).json({ error: 'Invalid privacy level' });
    }
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }

    // Update with user_id check for security
    const { error } = await supabase
      .from(table)
      .update({ privacy_level, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[UpdatePrivacy] Failed:', error);
      // Check if error is due to missing column
      if (error.message?.includes('privacy_level')) {
        return res.status(400).json({
          error: 'Privacy columns not yet available. Please wait for database migration.'
        });
      }
      return res.status(500).json({ error: 'Update failed' });
    }

    return res.status(200).json({ success: true, privacy_level });

  } catch (error) {
    console.error('[UpdatePrivacy] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
