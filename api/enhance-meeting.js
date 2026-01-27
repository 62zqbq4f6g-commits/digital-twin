/**
 * INSCRIPT: Meeting Enhancement API (Edge Runtime)
 *
 * Phase 16 - Enhancement System
 * Transforms raw meeting notes into structured output.
 * Integrates Inscript Context for attendee history, patterns, and open loops.
 *
 * Target: < 3 seconds (p95)
 *
 * Streaming SSE Response:
 * - data: {"type":"metadata",...}
 * - data: {"type":"content","text":"..."}
 * - data: {"type":"context","item":{...}}  (context insights)
 * - data: {"type":"done","noteId":"..."}
 * - data: {"type":"error",...}
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  buildMeetingUserMessage,
  buildSystemPrompt,
  detectMeetingType,
  getMeetingTypeLabel,
  MEETING_ENHANCE_VERSION
} from '../prompts/meeting-enhance.js';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, ctx) {
  // CORS headers for preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Encryption-Key',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const body = await req.json();
    const { rawInput, title, attendees, userId } = body;

    // ============================================
    // VALIDATION
    // ============================================

    if (!rawInput?.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_INPUT', message: 'Input cannot be empty' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Detect meeting type for type-specific prompts
    const meetingType = detectMeetingType(rawInput, title);
    const meetingTypeLabel = getMeetingTypeLabel(meetingType);

    console.log('[enhance-meeting] Starting enhancement for user:', userId);
    console.log('[enhance-meeting] Input length:', rawInput.length);
    console.log('[enhance-meeting] Attendees:', attendees?.length || 0);
    console.log('[enhance-meeting] Detected meeting type:', meetingType);

    // ============================================
    // STREAMING RESPONSE
    // ============================================

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process in background (non-blocking for Edge)
    const processAsync = async () => {
      const t0 = Date.now();

      try {
        const inferredTitle = title || inferTitle(rawInput, attendees);

        // Fetch Inscript Context in parallel with other setup
        const [context] = await Promise.all([
          fetchInscriptContext(attendees, rawInput, userId),
        ]);

        console.log(`[PERF] Context fetch: ${Date.now() - t0}ms`);
        console.log('[enhance-meeting] Context fetched:', {
          attendeeCount: context?.attendeeContext?.length || 0,
          patternCount: context?.patterns?.length || 0,
          openLoopCount: context?.openLoops?.length || 0,
        });

        // Send metadata first (now includes context summary and meeting type)
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'metadata',
              metadata: {
                title: inferredTitle,
                date: new Date().toISOString().split('T')[0],
                attendees: attendees || [],
                meetingType,
                meetingTypeLabel,
                attendeeEntities: context?.attendeeContext?.map(a => ({
                  name: a.name,
                  entityId: a.entityId,
                  meetingCount: a.meetingCount,
                })) || [],
                hasContext: !!(context?.attendeeContext?.length || context?.patterns?.length || context?.openLoops?.length),
              },
            })}\n\n`
          )
        );

        console.log(`[PERF] Metadata sent: ${Date.now() - t0}ms`);

        // Initialize Anthropic
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        // Build user message with dynamic content (v2.0 - type-aware)
        const userMessage = buildMeetingUserMessage({
          rawInput,
          title: inferredTitle,
          attendees,
          context,
          meetingType,
        });

        // Build type-specific system prompt (v2.0)
        const systemPrompt = buildSystemPrompt(meetingType);

        // Stream from Claude with prompt caching
        console.log(`[PERF] Claude API call start: ${Date.now() - t0}ms`);
        console.log(`[enhance-meeting] Using ${meetingType} prompt template`);
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          stream: true,
          // System prompt with cache_control for prompt caching (~50% cost reduction on cache hits)
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' }
            }
          ],
          messages: [{ role: 'user', content: userMessage }],
        });

        // Stream content chunks and accumulate for background processing
        let enhancedContent = '';
        let firstChunkLogged = false;
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            if (!firstChunkLogged) {
              console.log(`[PERF] First content chunk: ${Date.now() - t0}ms`);
              firstChunkLogged = true;
            }
            enhancedContent += event.delta.text;
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'content',
                  text: event.delta.text,
                })}\n\n`
              )
            );
          }
        }

        // Stream context items (after content)
        const contextItems = generateContextItems(context);
        for (const item of contextItems) {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'context',
                item,
              })}\n\n`
            )
          );
        }

        // Send completion
        const processingTime = Date.now() - t0;
        const noteId = crypto.randomUUID(); // TODO: Save to DB in TASK-014

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              noteId,
              processingTime,
              promptVersion: MEETING_ENHANCE_VERSION,
              contextItemCount: contextItems.length,
            })}\n\n`
          )
        );

        console.log(`[PERF] Total: ${processingTime}ms`);
        console.log(`[enhance-meeting] Complete in ${processingTime}ms, ${contextItems.length} context items`);

        // Background processing (TASK-014)
        // Extract topics from enhanced content for meeting history
        const topics = extractTopicsFromContent(enhancedContent);

        // Queue background work - runs after response is sent
        if (ctx?.waitUntil) {
          ctx.waitUntil(
            processInBackground({
              noteId,
              userId,
              rawInput,
              enhancedContent,
              title: inferredTitle,
              attendees: attendees || [],
              topics,
              promptVersion: MEETING_ENHANCE_VERSION,
            })
          );
        } else {
          // Fallback: run inline if waitUntil not available (local dev)
          processInBackground({
            noteId,
            userId,
            rawInput,
            enhancedContent,
            title: inferredTitle,
            attendees: attendees || [],
            topics,
            promptVersion: MEETING_ENHANCE_VERSION,
          }).catch(err => console.error('[enhance-meeting] Background error:', err));
        }

      } catch (error) {
        console.error('[enhance-meeting] Enhancement error:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: {
                code: 'ENHANCEMENT_FAILED',
                message: 'Failed to enhance notes. Your input has been preserved.',
                rawInput: rawInput, // Return raw input so user doesn't lose data
              },
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    };

    // Start processing (fire and forget)
    processAsync();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('[enhance-meeting] Request error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Infer a title from raw input and attendees
 */
function inferTitle(rawInput, attendees) {
  // If attendees provided, use them
  if (attendees?.length) {
    const names = attendees.slice(0, 3).join(', ');
    const suffix = attendees.length > 3 ? ` +${attendees.length - 3}` : '';
    return `Meeting with ${names}${suffix}`;
  }

  // Try to extract a meaningful first line
  const firstLine = rawInput.trim().split('\n')[0];
  const cleanLine = firstLine.replace(/^[-•*]\s*/, '').trim();

  // Truncate if too long
  if (cleanLine.length > 40) {
    return cleanLine.slice(0, 37) + '...';
  }

  return cleanLine || 'Meeting Notes';
}

/**
 * Fetch Inscript Context for attendees and content
 * @param {string[]} attendees - List of attendee names
 * @param {string} content - Raw meeting content
 * @param {string} userId - User ID
 * @returns {Object} Context data
 */
async function fetchInscriptContext(attendees, content, userId) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Fetch all context in parallel
    const [attendeeContext, patterns, openLoops] = await Promise.all([
      fetchAttendeeContext(supabase, userId, attendees || []),
      fetchRelevantPatterns(supabase, userId, content),
      fetchOpenLoops(supabase, userId, content),
    ]);

    return {
      attendeeContext,
      patterns,
      openLoops,
      relatedNotes: [], // TODO: Add semantic search in future
    };

  } catch (error) {
    console.warn('[enhance-meeting] Context fetch failed:', error.message);
    return {
      attendeeContext: [],
      patterns: [],
      openLoops: [],
      relatedNotes: [],
    };
  }
}

/**
 * Fetch meeting history context for attendees
 */
async function fetchAttendeeContext(supabase, userId, attendeeNames) {
  if (!attendeeNames.length) return [];

  try {
    const { data, error } = await supabase.rpc('get_entity_meeting_context', {
      p_user_id: userId,
      p_entity_names: attendeeNames,
    });

    if (error) {
      console.warn('[enhance-meeting] Attendee context error:', error.message);
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
    console.warn('[enhance-meeting] Attendee context failed:', error.message);
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
      console.warn('[enhance-meeting] Patterns error:', error.message);
      return [];
    }

    // Filter to patterns relevant to the content
    return (patterns || [])
      .filter(p => isRelevantToContent(p.keywords || [], content))
      .slice(0, 5)
      .map(p => ({
        type: p.pattern_type,
        description: p.description,
        frequency: p.frequency || `${p.occurrence_count || 0} times`,
        severity: p.confidence > 0.8 ? 'warning' : 'info',
        keywords: p.keywords || [],
      }));

  } catch (error) {
    console.warn('[enhance-meeting] Patterns fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch open loops (unresolved recurring topics)
 */
async function fetchOpenLoops(supabase, userId, content) {
  try {
    const { data, error } = await supabase.rpc('get_open_loops_context', {
      p_user_id: userId,
      p_keywords: null,
    });

    if (error) {
      console.warn('[enhance-meeting] Open loops error:', error.message);
      return [];
    }

    // Filter to loops relevant to content
    return (data || [])
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

  } catch (error) {
    console.warn('[enhance-meeting] Open loops fetch failed:', error.message);
    return [];
  }
}

/**
 * Generate context items for streaming to client
 */
function generateContextItems(context) {
  if (!context) return [];

  const items = [];

  // Add attendee info items
  for (const a of context.attendeeContext || []) {
    if (a.meetingCount > 0) {
      items.push({
        type: 'info',
        icon: 'ℹ️',
        text: `${getOrdinal(a.meetingCount + 1)} meeting with ${a.name}`,
        subtext: a.lastMeeting ? `Last: ${a.lastMeeting}` : `First: ${a.firstMeeting}`,
      });
    }
  }

  // Add pattern warnings
  for (const p of context.patterns || []) {
    items.push({
      type: p.severity || 'info',
      icon: p.severity === 'warning' ? '⚠️' : 'ℹ️',
      text: p.description,
      subtext: `Frequency: ${p.frequency}`,
    });
  }

  // Add open loops
  for (const l of context.openLoops || []) {
    items.push({
      type: 'warning',
      icon: '🔄',
      text: l.description,
      subtext: `Mentioned ${l.mentionCount}x since ${l.firstMentioned}`,
    });
  }

  return items.slice(0, 5); // Max 5 items
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
 * Get ordinal string (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================
// BACKGROUND PROCESSING (TASK-014)
// ============================================

/**
 * Extract topics from enhanced content
 * @param {string} content - Enhanced meeting content
 * @returns {string[]} List of topics
 */
function extractTopicsFromContent(content) {
  const topics = [];

  // Look for DISCUSSED section and extract bullet points
  const discussedMatch = content.match(/##\s*DISCUSSED\s*\n([\s\S]*?)(?=##|$)/i);
  if (discussedMatch) {
    const bullets = discussedMatch[1].match(/[-•]\s*([^\n]+)/g);
    if (bullets) {
      for (const bullet of bullets.slice(0, 5)) {
        const topic = bullet.replace(/^[-•]\s*/, '').trim();
        if (topic.length > 3 && topic.length < 100) {
          // Extract first meaningful phrase (before " — " or " - ")
          const shortTopic = topic.split(/\s*[—-]\s*/)[0].trim();
          topics.push(shortTopic);
        }
      }
    }
  }

  return topics;
}

/**
 * Process meeting data in background after response is sent
 * @param {Object} data - Meeting data to process
 */
async function processInBackground(data) {
  const {
    noteId,
    userId,
    rawInput,
    enhancedContent,
    title,
    attendees,
    topics,
    promptVersion,
  } = data;

  console.log(`[background] Starting processing for note ${noteId}`);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // 1. Save note to database
    await saveNote(supabase, {
      id: noteId,
      userId,
      content: enhancedContent,
      rawInput,
      title,
      attendees,
      promptVersion,
    });
    console.log(`[background] Note saved: ${noteId}`);

    // 2. Update meeting history for attendees (in parallel with entity extraction)
    const [meetingHistoryResult, entitiesResult] = await Promise.all([
      updateMeetingHistory(supabase, userId, noteId, attendees, topics),
      extractAndSaveEntities(userId, enhancedContent),
    ]);
    console.log(`[background] Meeting history: ${meetingHistoryResult} records`);
    console.log(`[background] Entities extracted: ${entitiesResult?.entities?.length || 0}`);

    // 3. Generate embeddings for semantic search
    await generateEmbeddings(noteId, enhancedContent);
    console.log(`[background] Embeddings generated`);

    // 4. Detect and track open loops
    const openLoopsFound = await detectOpenLoops(supabase, userId, enhancedContent, noteId);
    console.log(`[background] Open loops detected: ${openLoopsFound}`);

    console.log(`[background] Complete for note ${noteId}`);

  } catch (error) {
    // Don't throw - this is background processing, user already got response
    console.error(`[background] Error processing note ${noteId}:`, error.message);
  }
}

/**
 * Save note to database
 */
async function saveNote(supabase, noteData) {
  const { id, userId, content, rawInput, title, attendees, promptVersion } = noteData;

  const { error } = await supabase
    .from('notes')
    .upsert({
      id,
      user_id: userId,
      content: content,
      raw_input: rawInput,
      note_type: 'meeting',
      meeting_metadata: {
        title,
        attendees,
        meetingDate: new Date().toISOString(),
      },
      enhancement_metadata: {
        enhanced: true,
        enhancedAt: new Date().toISOString(),
        mode: 'meeting',
        promptVersion,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('[background] Save note error:', error.message);
    throw error;
  }
}

/**
 * Update meeting history for attendees
 */
async function updateMeetingHistory(supabase, userId, noteId, attendeeNames, topics) {
  if (!attendeeNames?.length) return 0;

  // Find entity IDs for attendees
  const { data: entities, error: entityError } = await supabase
    .from('user_entities')
    .select('id, name')
    .eq('user_id', userId)
    .eq('entity_type', 'person')
    .in('name', attendeeNames);

  if (entityError) {
    console.warn('[background] Entity lookup error:', entityError.message);
    return 0;
  }

  if (!entities?.length) {
    console.log('[background] No matching entities found for attendees');
    return 0;
  }

  // Create meeting history records
  const records = entities.map(entity => ({
    user_id: userId,
    entity_id: entity.id,
    note_id: noteId,
    meeting_date: new Date().toISOString(),
    topics: topics || [],
    sentiment: null, // Could be extracted from content in future
    key_points: [],
    action_items: [],
  }));

  const { error: insertError } = await supabase
    .from('meeting_history')
    .upsert(records, {
      onConflict: 'user_id,entity_id,note_id',
    });

  if (insertError) {
    console.warn('[background] Meeting history insert error:', insertError.message);
    return 0;
  }

  return records.length;
}

/**
 * Extract entities and save them
 */
async function extractAndSaveEntities(userId, content) {
  try {
    // Call existing entity extraction API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.API_URL || 'http://localhost:3001';

    const response = await fetch(`${baseUrl}/api/extract-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, userId }),
    });

    if (!response.ok) {
      console.warn('[background] Entity extraction API error:', response.status);
      return { entities: [] };
    }

    return await response.json();

  } catch (error) {
    console.warn('[background] Entity extraction error:', error.message);
    return { entities: [] };
  }
}

/**
 * Generate embeddings for semantic search
 */
async function generateEmbeddings(noteId, content) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.API_URL || 'http://localhost:3001';

    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, content }),
    });

    if (!response.ok) {
      console.warn('[background] Embeddings API error:', response.status);
    }

  } catch (error) {
    console.warn('[background] Embeddings error:', error.message);
  }
}

/**
 * Detect and track open loops (unresolved recurring topics)
 */
async function detectOpenLoops(supabase, userId, content, noteId) {
  const openLoopIndicators = [
    { phrase: 'forgot to', keyword: 'forgot' },
    { phrase: 'need to follow up', keyword: 'follow-up' },
    { phrase: 'still waiting', keyword: 'waiting' },
    { phrase: "haven't heard back", keyword: 'pending-response' },
    { phrase: "didn't get to", keyword: 'deferred' },
    { phrase: 'postponed', keyword: 'postponed' },
    { phrase: 'pushed back', keyword: 'delayed' },
    { phrase: 'blocked', keyword: 'blocked' },
    { phrase: 'pending', keyword: 'pending' },
    { phrase: 'still unresolved', keyword: 'unresolved' },
    { phrase: 'keep meaning to', keyword: 'deferred' },
    { phrase: 'should have', keyword: 'missed' },
  ];

  const contentLower = content.toLowerCase();
  let loopsFound = 0;

  for (const { phrase, keyword } of openLoopIndicators) {
    if (contentLower.includes(phrase)) {
      // Extract context around the indicator
      const index = contentLower.indexOf(phrase);
      const lineStart = content.lastIndexOf('\n', index) + 1;
      const lineEnd = content.indexOf('\n', index + phrase.length);
      const contextLine = content.slice(
        lineStart,
        lineEnd > 0 ? lineEnd : content.length
      ).trim();

      // Clean up the context
      const cleanContext = contextLine
        .replace(/^[-•*]\s*/, '')
        .replace(/^⚠️\s*/, '')
        .trim();

      if (cleanContext.length < 10 || cleanContext.length > 200) continue;

      try {
        // Check if similar open loop already exists
        const { data: existing } = await supabase
          .from('open_loops')
          .select('id, mention_count, keywords')
          .eq('user_id', userId)
          .eq('status', 'open')
          .contains('keywords', [keyword])
          .limit(1)
          .single();

        if (existing) {
          // Update existing loop using the RPC function
          await supabase.rpc('update_open_loop_mention', {
            p_loop_id: existing.id,
            p_note_id: noteId,
            p_context_snippet: cleanContext,
          });
          loopsFound++;
        } else {
          // Create new open loop
          const { error } = await supabase.from('open_loops').insert({
            user_id: userId,
            description: cleanContext,
            first_noted_at: new Date().toISOString(),
            first_note_id: noteId,
            mention_count: 1,
            last_mentioned_at: new Date().toISOString(),
            last_note_id: noteId,
            status: 'open',
            keywords: [keyword, ...extractKeywordsFromText(cleanContext)],
            context_snippets: [cleanContext],
          });

          if (!error) loopsFound++;
        }
      } catch (loopError) {
        console.warn('[background] Open loop error:', loopError.message);
      }
    }
  }

  return loopsFound;
}

/**
 * Extract keywords from text for open loop matching
 */
function extractKeywordsFromText(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'this', 'that', 'these', 'those', 'still', 'need', 'get', 'got',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5);
}

