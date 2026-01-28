/**
 * INSCRIPT: Get User Notes API
 *
 * T3 Frontend Lead - Sprint 2
 *
 * Returns user notes for privacy management.
 * Note: Content is NOT returned for privacy - only metadata.
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

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

    const limit = parseInt(req.query.limit) || 50;

    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, title, category, privacy_level, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Notes] Query failed:', error);
      return res.status(500).json({ error: 'Failed to fetch notes' });
    }

    // Map to expected format (use title as name for display)
    const formattedNotes = (notes || []).map(note => ({
      id: note.id,
      name: note.title || 'Untitled Note',
      category: note.category,
      privacy_level: note.privacy_level,
      created_at: note.created_at
    }));

    return res.status(200).json(formattedNotes);

  } catch (error) {
    console.error('[Notes] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
