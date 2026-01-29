/**
 * INSCRIPT: Context Fetch API (Edge Runtime)
 *
 * Phase 16 - Enhancement System
 * Fetches user context for enhancement:
 * - Attendee meeting history
 * - Relevant patterns
 * - Open loops
 * - Related notes (semantic search)
 *
 * Target: < 500ms
 */

import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, handlePreflightEdge } from './lib/cors-edge.js';
import { requireAuthEdge } from './lib/auth-edge.js';

export const config = { runtime: 'edge' };

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req) {
  // CORS headers (restricted to allowed origins)
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight
  const preflightResponse = handlePreflightEdge(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
      }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Auth check - verify token and get userId
  const { user, errorResponse } = await requireAuthEdge(req, corsHeaders);
  if (errorResponse) return errorResponse;

  const userId = user.id;

  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const attendeesParam = searchParams.get('attendees');
    const attendees = attendeesParam ? attendeesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const content = searchParams.get('content') || '';
      );
    }

    console.log('[inscript-context] Fetching context for user:', userId);
    console.log('[inscript-context] Attendees:', attendees);
    console.log('[inscript-context] Content length:', content.length);

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Parallel fetch all context
    const [attendeeContext, patterns, openLoops, relatedNotes] = await Promise.all([
      fetchAttendeeContext(supabase, userId, attendees),
      fetchRelevantPatterns(supabase, userId, content),
      fetchOpenLoops(supabase, userId, content),
      fetchRelatedNotes(supabase, userId, content),
    ]);

    const processingTime = Date.now() - startTime;
    console.log(`[inscript-context] Complete in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        attendeeContext,
        patterns,
        openLoops,
        relatedNotes,
        processingTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('[inscript-context] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'CONTEXT_FETCH_FAILED', message: 'Failed to fetch context' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch meeting history context for attendees
 */
async function fetchAttendeeContext(supabase, userId, attendeeNames) {
  if (!attendeeNames.length) return [];

  try {
    // Use the database function we created
    const { data, error } = await supabase.rpc('get_entity_meeting_context', {
      p_user_id: userId,
      p_entity_names: attendeeNames,
    });

    if (error) {
      console.warn('[inscript-context] Attendee context error:', error.message);
      return [];
    }

    return (data || []).map(entity => ({
      entityId: entity.entity_id,
      name: entity.entity_name,
      meetingCount: entity.meeting_count || 0,
      firstMeeting: formatDate(entity.first_meeting),
      lastMeeting: formatRelativeDate(entity.last_meeting),
      daysSinceLast: entity.days_since_last,
      recentTopics: entity.recent_topics || [],
      lastSentiment: entity.last_sentiment,
    }));

  } catch (error) {
    console.warn('[inscript-context] Attendee context fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch relevant patterns for user
 */
async function fetchRelevantPatterns(supabase, userId, content) {
  try {
    const { data: patterns, error } = await supabase
      .from('user_patterns')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('confidence', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[inscript-context] Patterns error:', error.message);
      return [];
    }

    // Filter to patterns relevant to the content
    const relevantPatterns = (patterns || [])
      .filter(p => isRelevantToContent(p.keywords || [], content))
      .slice(0, 5)
      .map(p => ({
        type: p.pattern_type,
        description: p.description,
        frequency: p.frequency || `${p.occurrence_count || 0} times`,
        severity: p.confidence > 0.8 ? 'warning' : 'info',
        keywords: p.keywords || [],
      }));

    return relevantPatterns;

  } catch (error) {
    console.warn('[inscript-context] Patterns fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch open loops (unresolved recurring topics)
 */
async function fetchOpenLoops(supabase, userId, content) {
  try {
    // Use the database function we created
    const { data, error } = await supabase.rpc('get_open_loops_context', {
      p_user_id: userId,
      p_keywords: null, // Get all open loops
    });

    if (error) {
      console.warn('[inscript-context] Open loops error:', error.message);
      return [];
    }

    // Filter to loops relevant to content
    const relevantLoops = (data || [])
      .filter(loop => isRelevantToContent(loop.keywords || [], content))
      .slice(0, 5)
      .map(loop => ({
        id: loop.id,
        description: loop.description,
        firstMentioned: formatDate(loop.first_noted_at),
        mentionCount: loop.mention_count,
        daysOpen: loop.days_open,
        status: 'unresolved',
        keywords: loop.keywords || [],
      }));

    return relevantLoops;

  } catch (error) {
    console.warn('[inscript-context] Open loops fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch semantically related notes
 * TODO: Integrate with existing semantic search system
 */
async function fetchRelatedNotes(supabase, userId, content) {
  if (!content || content.length < 20) return [];

  try {
    // For now, return recent notes that might be related
    // TODO: Use proper semantic search with embeddings
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, content, created_at, note_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[inscript-context] Related notes error:', error.message);
      return [];
    }

    // Simple keyword matching for now
    const contentWords = extractKeywords(content);

    const relatedNotes = (notes || [])
      .map(note => {
        const noteWords = extractKeywords(note.content || '');
        const overlap = contentWords.filter(w => noteWords.includes(w));
        return {
          ...note,
          relevanceScore: overlap.length,
          matchingWords: overlap,
        };
      })
      .filter(note => note.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3)
      .map(note => ({
        noteId: note.id,
        title: extractTitle(note.content),
        date: formatRelativeDate(note.created_at),
        relevance: `Shares ${note.relevanceScore} topic${note.relevanceScore > 1 ? 's' : ''}`,
        snippet: truncateSnippet(note.content, 100),
        noteType: note.note_type,
      }));

    return relatedNotes;

  } catch (error) {
    console.warn('[inscript-context] Related notes fetch failed:', error.message);
    return [];
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format date as "Month Year"
 */
function formatDate(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Format date as relative time
 */
function formatRelativeDate(date) {
  if (!date) return null;
  try {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
    return formatDate(date);
  } catch {
    return null;
  }
}

/**
 * Check if keywords are relevant to content
 */
function isRelevantToContent(keywords, content) {
  if (!keywords || !keywords.length || !content) return false;
  const lowerContent = content.toLowerCase();
  return keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  if (!text) return [];

  // Common words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'this', 'that', 'these', 'those', 'am', 'can', 'just', 'so', 'than',
    'too', 'very', 'now', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
}

/**
 * Extract title from note content
 */
function extractTitle(content) {
  if (!content) return 'Untitled';
  const firstLine = content.trim().split('\n')[0];
  const cleanLine = firstLine.replace(/^[-•*#]\s*/, '').trim();
  if (cleanLine.length > 50) {
    return cleanLine.slice(0, 47) + '...';
  }
  return cleanLine || 'Untitled';
}

/**
 * Truncate text to snippet
 */
function truncateSnippet(text, maxLength) {
  if (!text) return '';
  const cleaned = text.replace(/\n+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}
