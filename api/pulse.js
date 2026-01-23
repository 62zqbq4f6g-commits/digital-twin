/**
 * Inscript API: Morning Pulse
 * Generates a daily briefing with context for the user
 *
 * POST /api/pulse
 * Body: { user_id: string }
 *
 * Returns:
 * - greeting: Time-appropriate greeting
 * - themes: Frequently mentioned topics this week
 * - openActions: Incomplete action items
 * - commitments: Things user said they'd do
 * - people: Recently mentioned people
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    // Get user's name from onboarding
    const { data: onboarding } = await supabase
      .from('onboarding_data')
      .select('name')
      .eq('user_id', user_id)
      .single();

    const userName = onboarding?.name || '';

    // Get recent notes (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, content, analysis, created_at')
      .eq('user_id', user_id)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('[Pulse] Notes query error:', notesError);
      throw notesError;
    }

    // Get all notes for actions/commitments (not just recent)
    const { data: allNotes } = await supabase
      .from('notes')
      .select('id, content, analysis, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(100);

    // Extract open actions
    const openActions = [];
    (allNotes || []).forEach(note => {
      try {
        const analysis = typeof note.analysis === 'string'
          ? JSON.parse(note.analysis)
          : note.analysis;

        const actions = analysis?.actions || [];
        const completed = analysis?.actionsCompleted || [];

        actions.forEach((action, idx) => {
          if (!completed.includes(idx)) {
            const text = typeof action === 'string' ? action : action.action || action.text;
            if (text) {
              openActions.push({
                text,
                effort: action?.effort || 'medium',
                noteId: note.id,
                noteDate: note.created_at
              });
            }
          }
        });
      } catch (e) {
        // Skip malformed analysis
      }
    });

    // Extract commitments
    const commitments = [];
    (allNotes || []).forEach(note => {
      try {
        const analysis = typeof note.analysis === 'string'
          ? JSON.parse(note.analysis)
          : note.analysis;

        const actions = analysis?.actions || [];
        const completed = analysis?.actionsCompleted || [];

        actions.forEach((action, idx) => {
          if (action?.commitment && !completed.includes(idx)) {
            commitments.push({
              text: action.commitment,
              noteDate: note.created_at,
              noteId: note.id
            });
          }
        });
      } catch (e) {
        // Skip malformed analysis
      }
    });

    // Extract themes from recent notes (simple word frequency)
    const themes = extractThemes(notes || []);

    // Get recent people from entities
    const { data: entities } = await supabase
      .from('user_entities')
      .select('name, context_summary, relationship, updated_at')
      .eq('user_id', user_id)
      .eq('entity_type', 'person')
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
      error: 'Failed to generate pulse',
      details: error.message
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

/**
 * Extract common themes from notes
 */
function extractThemes(notes) {
  const wordCounts = {};
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'i', 'me', 'my',
    'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'him', 'his',
    'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'and', 'but',
    'if', 'or', 'because', 'as', 'until', 'while', 'just', 'also', 'than',
    'so', 'very', 'really', 'think', 'feel', 'like', 'want', 'know', 'get',
    'got', 'make', 'made', 'going', 'been', 'being', 'today', 'yesterday',
    'tomorrow', 'now', 'then', 'here', 'there', 'when', 'where', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'than', 'too'
  ]);

  notes.forEach(note => {
    const text = (note.content || '').toLowerCase();
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });

  return Object.entries(wordCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}
