/**
 * INSCRIPT: Privacy Summary API
 *
 * T3 Frontend Lead - Sprint 2
 *
 * Returns counts of private items for the current user.
 * Used by ExportUI to show privacy indicator.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

    const user_id = user.id;

    // Count private items in parallel
    // Note: These queries require privacy_level column to exist (T1 dependency)
    const [entitiesResult, notesResult, patternsResult] = await Promise.all([
      supabase
        .from('user_entities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('privacy_level', 'private'),
      supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('privacy_level', 'private'),
      supabase
        .from('user_patterns')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('privacy_level', 'private')
    ]);

    // Handle errors gracefully (columns may not exist yet)
    const privateEntities = entitiesResult.error ? 0 : (entitiesResult.count || 0);
    const privateNotes = notesResult.error ? 0 : (notesResult.count || 0);
    const privatePatterns = patternsResult.error ? 0 : (patternsResult.count || 0);

    return res.status(200).json({
      private_entities: privateEntities,
      private_notes: privateNotes,
      private_patterns: privatePatterns
    });

  } catch (error) {
    console.error('[PrivacySummary] Failed:', error);
    return res.status(500).json({ error: 'Failed to get privacy summary' });
  }
}
