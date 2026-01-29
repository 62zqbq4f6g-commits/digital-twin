/**
 * INSCRIPT: Personal Note Enhancement API (Edge Runtime)
 *
 * Phase 17 - Personal Note Enhancement
 * Subtly enhances notes while preserving user's voice.
 * Includes THREADS section for connections to past notes.
 *
 * Target: < 3 seconds (p95)
 *
 * Streaming SSE Response:
 * - data: {"type":"metadata",...}
 * - data: {"type":"content","text":"..."}
 * - data: {"type":"threads","items":[...]}
 * - data: {"type":"reflect","question":"..."}
 * - data: {"type":"done","noteId":"...","processingTime":...}
 * - data: {"type":"error",...}
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonalEnhancePrompt, NOTE_ENHANCE_VERSION } from '../prompts/note-enhance.js';
import { getCorsHeaders, handlePreflightEdge } from './lib/cors-edge.js';
import { requireAuthEdge } from './lib/auth-edge.js';

export const config = { runtime: 'edge' };

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, ctx) {
  // CORS headers (restricted to allowed origins)
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight
  const preflightResponse = handlePreflightEdge(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Auth check - verify token and get userId
  const { user, errorResponse } = await requireAuthEdge(req, corsHeaders);
  if (errorResponse) return errorResponse;

  const userId = user.id;

  try {
    const body = await req.json();
    const { noteId, content, noteType } = body;

    // ============================================
    // VALIDATION
    // ============================================

    if (!content?.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_CONTENT', message: 'Note content cannot be empty' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('[enhance-note] Starting enhancement for user:', userId);
    console.log('[enhance-note] Content length:', content.length);
    console.log('[enhance-note] Note type:', noteType || 'note');

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
        // Initialize Supabase for context fetching
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );

        // Fetch context in parallel
        console.log(`[PERF] Starting context fetch: ${Date.now() - t0}ms`);
        const [relatedNotes, patterns] = await Promise.all([
          fetchRelatedNotes(supabase, userId, content),
          fetchRelevantPatterns(supabase, userId, content),
        ]);
        console.log(`[PERF] Context fetch complete: ${Date.now() - t0}ms`);

        // Generate note ID if not provided
        const finalNoteId = noteId || crypto.randomUUID();

        // Send metadata first
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'metadata',
              noteType: noteType || 'note',
              noteId: finalNoteId,
              enhanced: true,
              hasRelatedNotes: relatedNotes.length > 0,
              hasPatterns: patterns.length > 0,
            })}\n\n`
          )
        );

        console.log(`[PERF] Metadata sent: ${Date.now() - t0}ms`);

        // Build enhancement prompt
        const prompt = buildPersonalEnhancePrompt({
          content,
          noteType: noteType || 'note',
          relatedNotes,
          patterns,
        });

        // Initialize Anthropic and stream
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        console.log(`[PERF] Claude API call start: ${Date.now() - t0}ms`);
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        });

        // Stream content and accumulate for parsing
        let fullContent = '';
        let firstChunkLogged = false;

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            if (!firstChunkLogged) {
              console.log(`[PERF] First content chunk: ${Date.now() - t0}ms`);
              firstChunkLogged = true;
            }
            fullContent += event.delta.text;
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

        // Parse threads from response
        const threads = parseThreadsFromContent(fullContent, relatedNotes);
        if (threads.length > 0) {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'threads',
                items: threads,
              })}\n\n`
            )
          );
        }

        // Parse reflect question from response
        const reflectQuestion = parseReflectFromContent(fullContent);
        if (reflectQuestion) {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'reflect',
                question: reflectQuestion,
              })}\n\n`
            )
          );
        }

        // Send completion
        const processingTime = Date.now() - t0;
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              noteId: finalNoteId,
              processingTime,
              promptVersion: NOTE_ENHANCE_VERSION,
              threadCount: threads.length,
              hasReflect: !!reflectQuestion,
            })}\n\n`
          )
        );

        console.log(`[PERF] Total: ${processingTime}ms`);
        console.log(`[enhance-note] Complete in ${processingTime}ms, ${threads.length} threads`);

        // Background processing
        if (ctx?.waitUntil) {
          ctx.waitUntil(
            processInBackground({
              noteId: finalNoteId,
              userId,
              rawContent: content,
              enhancedContent: fullContent,
              noteType: noteType || 'note',
              threads,
              promptVersion: NOTE_ENHANCE_VERSION,
            })
          );
        }

      } catch (error) {
        console.error('[enhance-note] Enhancement error:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: {
                code: 'ENHANCEMENT_FAILED',
                message: 'Failed to enhance note. Your content has been preserved.',
                rawContent: content,
              },
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    };

    // Start processing
    processAsync();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('[enhance-note] Request error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================
// CONTEXT FETCHING
// ============================================

/**
 * Fetch semantically related notes for THREADS
 */
async function fetchRelatedNotes(supabase, userId, content) {
  try {
    // Simple keyword-based search for now
    // TODO: Integrate with semantic search via embeddings
    const keywords = extractKeywords(content);
    if (keywords.length === 0) return [];

    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.warn('[enhance-note] Related notes error:', error.message);
      return [];
    }

    // Score notes by keyword overlap
    const scored = (notes || [])
      .map(note => {
        const noteKeywords = extractKeywords(note.content || '');
        const overlap = keywords.filter(kw => noteKeywords.includes(kw)).length;
        return { ...note, score: overlap };
      })
      .filter(note => note.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return scored.map(note => ({
      id: note.id,
      content: truncate(note.content, 200),
      date: note.created_at,
      relevance: note.score,
    }));

  } catch (error) {
    console.warn('[enhance-note] Related notes fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch relevant user patterns
 */
async function fetchRelevantPatterns(supabase, userId, content) {
  try {
    const { data: patterns, error } = await supabase
      .from('user_patterns')
      .select('id, description, keywords, confidence')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('confidence', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[enhance-note] Patterns error:', error.message);
      return [];
    }

    const contentLower = content.toLowerCase();

    // Filter to patterns relevant to content
    return (patterns || [])
      .filter(p => {
        const keywords = p.keywords || [];
        return keywords.some(kw => contentLower.includes(kw.toLowerCase()));
      })
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        description: p.description,
        confidence: p.confidence,
      }));

  } catch (error) {
    console.warn('[enhance-note] Patterns fetch failed:', error.message);
    return [];
  }
}

// ============================================
// CONTENT PARSING
// ============================================

/**
 * Parse THREADS section from Claude response
 */
function parseThreadsFromContent(content, relatedNotes) {
  const threads = [];

  // Look for THREADS section
  const threadsMatch = content.match(/###?\s*THREADS\s*\n([\s\S]*?)(?=###|$)/i);
  if (!threadsMatch) return threads;

  // Extract bullet points
  const lines = threadsMatch[1].split('\n');
  for (const line of lines) {
    const bulletMatch = line.match(/^[-•*]\s*["""](.+?)["""].*?(?:—|-)(.+)/);
    if (bulletMatch) {
      const quote = bulletMatch[1].trim();
      const connection = bulletMatch[2].trim();

      // Try to match with a related note
      const matchedNote = relatedNotes.find(note =>
        note.content?.toLowerCase().includes(quote.toLowerCase().slice(0, 30))
      );

      threads.push({
        text: quote,
        connection,
        noteId: matchedNote?.id || null,
        date: matchedNote?.date || null,
      });
    }
  }

  return threads.slice(0, 3);
}

/**
 * Parse REFLECT question from Claude response
 */
function parseReflectFromContent(content) {
  const reflectMatch = content.match(/###?\s*REFLECT(?:\s*\(Optional\))?\s*\n([\s\S]*?)(?=###|$)/i);
  if (!reflectMatch) return null;

  const question = reflectMatch[1].trim();
  // Only return if it's actually a question
  if (question && question.includes('?') && question.length > 10 && question.length < 200) {
    return question;
  }

  return null;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  if (!text) return [];

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its',
    'about', 'just', 'like', 'really', 'very', 'much', 'more', 'some',
    'what', 'when', 'where', 'which', 'who', 'how', 'why', 'all', 'been',
    'being', 'going', 'need', 'want', 'think', 'know', 'feel', 'today',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
}

/**
 * Truncate text with ellipsis
 */
function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================
// BACKGROUND PROCESSING
// ============================================

/**
 * Process note data in background after response is sent
 */
async function processInBackground(data) {
  const {
    noteId,
    userId,
    rawContent,
    enhancedContent,
    noteType,
    threads,
    promptVersion,
  } = data;

  console.log(`[background] Starting processing for note ${noteId}`);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Extract just the enhanced note (before THREADS section)
    const cleanEnhanced = extractEnhancedNote(enhancedContent);

    // Update note with enhancement
    const { error } = await supabase
      .from('notes')
      .update({
        enhanced_content: cleanEnhanced,
        raw_input: rawContent,
        note_type: noteType,
        enhancement_metadata: {
          enhanced: true,
          enhancedAt: new Date().toISOString(),
          mode: 'personal',
          promptVersion,
          threadCount: threads.length,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) {
      console.warn('[background] Note update error:', error.message);
    } else {
      console.log(`[background] Note updated: ${noteId}`);
    }

  } catch (error) {
    console.error(`[background] Error processing note ${noteId}:`, error.message);
  }
}

/**
 * Extract the enhanced note content (before THREADS/REFLECT sections)
 */
function extractEnhancedNote(content) {
  // Find where THREADS or REFLECT starts
  const threadsIndex = content.search(/###?\s*THREADS/i);
  const reflectIndex = content.search(/###?\s*REFLECT/i);

  let endIndex = content.length;
  if (threadsIndex > 0) endIndex = Math.min(endIndex, threadsIndex);
  if (reflectIndex > 0) endIndex = Math.min(endIndex, reflectIndex);

  // Also remove the "### Enhanced Note" header if present
  let enhanced = content.slice(0, endIndex).trim();
  enhanced = enhanced.replace(/^###?\s*Enhanced\s*Note\s*/i, '').trim();

  return enhanced;
}
