/**
 * User Settings API
 *
 * Simple key-value store for user preferences.
 * Uses the user_settings table.
 *
 * GET /api/user-settings?key=setting_name - Get a setting
 * POST /api/user-settings - Set a setting { key, value }
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

  // Auth check
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

    const user_id = user.id;

    // GET - Retrieve a setting
    if (req.method === 'GET') {
      const key = req.query.key;

      if (!key) {
        return res.status(400).json({ error: 'Key parameter required' });
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', user_id)
        .eq('key', key)
        .maybeSingle();

      if (error) {
        console.error('[user-settings] GET error:', error);
        return res.status(500).json({ error: 'Failed to get setting' });
      }

      return res.status(200).json({
        key,
        value: data?.value || null
      });
    }

    // POST - Set a setting
    if (req.method === 'POST') {
      const { key, value } = req.body;

      if (!key) {
        return res.status(400).json({ error: 'Key is required' });
      }

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id,
          key,
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        });

      if (error) {
        console.error('[user-settings] POST error:', error);
        return res.status(500).json({ error: 'Failed to save setting' });
      }

      return res.status(200).json({
        success: true,
        key,
        value
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[user-settings] Error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
