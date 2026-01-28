/**
 * Inscript API: Morning Pulse
 * Generates a daily briefing with context for the user
 *
 * Note: Uses unencrypted metadata tables since notes are E2E encrypted
 *
 * POST /api/pulse
 * Body: { user_id: string }
 *
 * Returns:
 * - greeting: Time-appropriate greeting
 * - themes: Top entities/topics by mention count
 * - openActions: Incomplete action items from action_signals
 * - commitments: User commitments from action_signals
 * - people: Recently mentioned people
 */

import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, handlePreflight } from './lib/cors.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers (restricted to allowed origins)
  setCorsHeaders(req, res);

  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - verify user owns the data they're requesting
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Use authenticated user's ID (ignore user_id from body to prevent IDOR)
  const user_id = user.id;

  try {
    // Get user's name from onboarding
    const { data: onboarding } = await supabase
      .from('onboarding_data')
      .select('name')
      .eq('user_id', user_id)
      .maybeSingle();

    const userName = onboarding?.name || '';

    // Get open actions from action_signals table
    const { data: actionSignals, error: actionsError } = await supabase
      .from('action_signals')
      .select('id, signal_type, action_text, effort, context, created_at, note_id')
      .eq('user_id', user_id)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (actionsError) {
      console.error('[Pulse] Action signals error:', actionsError);
    }

    // Format open actions
    const openActions = (actionSignals || [])
      .filter(a => a.signal_type === 'action' || !a.signal_type)
      .slice(0, 5)
      .map(a => ({
        text: a.action_text || a.context,
        effort: a.effort || 'medium',
        noteId: a.note_id,
        noteDate: a.created_at
      }));

    // Format commitments
    const commitments = (actionSignals || [])
      .filter(a => a.signal_type === 'commitment')
      .slice(0, 5)
      .map(a => ({
        text: a.action_text || a.context,
        noteDate: a.created_at,
        noteId: a.note_id
      }));

    // Get themes from top entities (not people)
    const { data: themeEntities } = await supabase
      .from('user_entities')
      .select('name, entity_type, mention_count')
      .eq('user_id', user_id)
      .neq('entity_type', 'person')
      .eq('status', 'active')
      .order('mention_count', { ascending: false })
      .limit(10);

    const themes = (themeEntities || []).map(e => ({
      word: e.name,
      count: e.mention_count || 1
    }));

    // Get recent people from entities
    const { data: entities } = await supabase
      .from('user_entities')
      .select('name, context_summary, relationship, updated_at')
      .eq('user_id', user_id)
      .eq('entity_type', 'person')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5);

    const people = (entities || []).map(e => ({
      name: e.name,
      context: e.context_summary || e.relationship || '',
      lastMentioned: e.updated_at
    }));

    // Build response
    const greeting = getGreeting(userName);

    return res.status(200).json({
      greeting,
      themes: themes.slice(0, 5),
      openActions: openActions.slice(0, 5),
      commitments: commitments.slice(0, 5),
      people: people.slice(0, 3)
    });

  } catch (error) {
    console.error('[Pulse] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate pulse'
    });
  }
}

/**
 * Get time-appropriate greeting
 */
function getGreeting(name) {
  const hour = new Date().getHours();
  let timeGreeting;

  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';

  return name ? `${timeGreeting}, ${name}.` : `${timeGreeting}.`;
}
