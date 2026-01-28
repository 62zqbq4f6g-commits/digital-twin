/**
 * INSCRIPT: Ambient Recording Processing API (Edge Runtime)
 *
 * Phase 17 - Ambient Listening (TASK-022)
 * Finalizes ambient recording session: combine transcripts → enhance → save.
 *
 * Target: < 5 seconds total (depends on content length)
 *
 * Flow:
 * 1. Client calls this after all chunks uploaded
 * 2. Combines all chunk transcripts in order
 * 3. Merges with user's inline notes
 * 4. Calls enhancement API for structured output
 * 5. Saves as meeting note
 * 6. Background: entities, embeddings
 *
 * Streaming SSE Response:
 * - data: {"type":"status","message":"..."}
 * - data: {"type":"transcript","text":"..."}
 * - data: {"type":"enhancing","progress":...}
 * - data: {"type":"content","text":"..."}  // Streamed enhancement
 * - data: {"type":"done","noteId":"...","processingTime":...}
 * - data: {"type":"error",...}
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { MEETING_ENHANCE_SYSTEM_PROMPT, buildMeetingUserMessage, MEETING_ENHANCE_VERSION } from '../prompts/meeting-enhance.js';

export const config = { runtime: 'edge' };

export default async function handler(req, ctx) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
      }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const body = await req.json();
    const { sessionId, userId, userNotes, meetingTitle, attendees } = body;

    // ============================================
    // VALIDATION
    // ============================================

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'MISSING_SESSION', message: 'sessionId required' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`[process-ambient] === REQUEST START ===`);
    console.log(`[process-ambient] Session: ${sessionId}`);
    console.log(`[process-ambient] User: ${userId}`);
    console.log(`[process-ambient] Title: ${meetingTitle || '(none)'}`);
    console.log(`[process-ambient] Has userNotes: ${!!userNotes}`);

    // ============================================
    // STREAMING RESPONSE
    // ============================================

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (data) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // Process in background
    const processAsync = async () => {
      const t0 = Date.now();

      try {
        await sendEvent({ type: 'status', message: 'Fetching recording session...' });

        // Check environment variables
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
          console.error('[process-ambient] Missing Supabase environment variables!');
          await sendEvent({
            type: 'error',
            error: { code: 'CONFIG_ERROR', message: 'Server configuration error (Supabase)' },
          });
          await writer.close();
          return;
        }

        if (!process.env.ANTHROPIC_API_KEY) {
          console.error('[process-ambient] Missing ANTHROPIC_API_KEY!');
          await sendEvent({
            type: 'error',
            error: { code: 'CONFIG_ERROR', message: 'Server configuration error (Anthropic)' },
          });
          await writer.close();
          return;
        }

        // Initialize Supabase
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
        console.log(`[process-ambient] Supabase client initialized`);

        // ============================================
        // FETCH SESSION
        // ============================================

        console.log(`[process-ambient] Fetching session from ambient_recordings...`);
        console.log(`[process-ambient] Query: id=${sessionId}, user_id=${userId}`);

        const { data: session, error: fetchError } = await supabase
          .from('ambient_recordings')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .single();

        console.log(`[process-ambient] Fetch result: session=${!!session}, error=${fetchError?.message || 'none'}`);
        if (session) {
          console.log(`[process-ambient] Session found: status=${session.status}, chunks=${session.chunks_received}/${session.total_chunks}`);
        }

        if (fetchError || !session) {
          console.error(`[process-ambient] Session not found! Error: ${fetchError?.message}, Code: ${fetchError?.code}`);
          await sendEvent({
            type: 'error',
            error: {
              code: 'SESSION_NOT_FOUND',
              message: `Recording session not found: ${fetchError?.message || 'no session data'}`,
            },
          });
          await writer.close();
          return;
        }

        // Verify all chunks received
        if (session.status === 'uploading' && session.chunks_received < session.total_chunks) {
          await sendEvent({
            type: 'error',
            error: {
              code: 'INCOMPLETE_UPLOAD',
              message: `Only ${session.chunks_received}/${session.total_chunks} chunks received`,
            },
          });
          await writer.close();
          return;
        }

        // Update status to processing
        await supabase
          .from('ambient_recordings')
          .update({ status: 'processing' })
          .eq('id', sessionId);

        // ============================================
        // COMBINE TRANSCRIPTS
        // ============================================

        await sendEvent({ type: 'status', message: 'Combining transcripts...' });

        const transcripts = session.transcripts || {};
        const sortedIndices = Object.keys(transcripts)
          .map(k => parseInt(k, 10))
          .sort((a, b) => a - b);

        const combinedTranscript = sortedIndices
          .map(idx => transcripts[idx]?.text || '')
          .filter(t => t && t !== '[Transcription failed for this chunk]')
          .join('\n\n');

        const totalDuration = sortedIndices.reduce(
          (sum, idx) => sum + (transcripts[idx]?.duration || 0),
          0
        );

        console.log(`[process-ambient] Combined ${sortedIndices.length} chunks, ${combinedTranscript.length} chars, ${totalDuration.toFixed(0)}s duration`);

        if (!combinedTranscript.trim()) {
          await sendEvent({
            type: 'error',
            error: { code: 'EMPTY_TRANSCRIPT', message: 'No transcript content found' },
          });
          await writer.close();
          return;
        }

        // Send transcript preview
        await sendEvent({
          type: 'transcript',
          text: combinedTranscript.slice(0, 500) + (combinedTranscript.length > 500 ? '...' : ''),
          totalLength: combinedTranscript.length,
          duration: totalDuration,
        });

        // ============================================
        // FETCH USER CONTEXT
        // ============================================

        await sendEvent({ type: 'status', message: 'Loading your context...' });

        // Fetch FULL onboarding data and recent context for personalization
        const [onboardingResult, recentNotesResult] = await Promise.all([
          supabase
            .from('onboarding_data')
            .select('name, life_seasons, mental_focus, seeded_people, depth_answer')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('notes')
            .select('id, content, created_at, note_type')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const onboarding = onboardingResult.data;
        const recentNotes = recentNotesResult.data || [];

        // Build context for enhancement
        const contextItems = [];
        if (onboarding?.seeded_people) {
          const people = onboarding.seeded_people;
          if (Array.isArray(people)) {
            people.forEach(p => {
              if (p.name && combinedTranscript.toLowerCase().includes(p.name.toLowerCase())) {
                contextItems.push({
                  type: 'person',
                  name: p.name,
                  relationship: p.context || p.relationship || 'known person',
                });
              }
            });
          }
        }

        // ============================================
        // ENHANCE WITH CLAUDE
        // ============================================

        await sendEvent({ type: 'status', message: 'Enhancing meeting notes...' });
        await sendEvent({ type: 'enhancing', progress: 0 });

        // Build meeting content (transcript + user notes)
        const meetingContent = userNotes
          ? `TRANSCRIPT:\n${combinedTranscript}\n\nUSER NOTES:\n${userNotes}`
          : combinedTranscript;

        // Build context in expected format
        const context = contextItems.length > 0 ? {
          attendeeContext: contextItems
            .filter(c => c.type === 'person')
            .map(c => ({
              name: c.name,
              meetingCount: 0,
              relationship: c.relationship,
            })),
        } : null;

        const userMessage = buildMeetingUserMessage({
          rawInput: meetingContent,
          title: meetingTitle || 'Ambient Recording',
          attendees: attendees || [],
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          context,
        });

        // Initialize Claude
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        console.log(`[PERF] Claude API call start: ${Date.now() - t0}ms`);

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2500,
          stream: true,
          system: [
            {
              type: 'text',
              text: MEETING_ENHANCE_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userMessage }],
        });

        // Stream enhanced content
        let fullContent = '';
        let tokenCount = 0;
        let firstChunkLogged = false;

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            if (!firstChunkLogged) {
              console.log(`[PERF] First content chunk: ${Date.now() - t0}ms`);
              firstChunkLogged = true;
            }
            fullContent += event.delta.text;
            tokenCount++;

            await sendEvent({
              type: 'content',
              text: event.delta.text,
            });

            // Update progress periodically
            if (tokenCount % 50 === 0) {
              await sendEvent({
                type: 'enhancing',
                progress: Math.min(90, Math.floor(tokenCount / 10)),
              });
            }
          }
        }

        await sendEvent({ type: 'enhancing', progress: 100 });

        // ============================================
        // SAVE AS MEETING NOTE
        // ============================================

        await sendEvent({ type: 'status', message: 'Saving meeting note...' });

        const noteId = crypto.randomUUID();
        const now = new Date().toISOString();

        const { error: noteError } = await supabase.from('notes').insert({
          id: noteId,
          user_id: userId,
          content: fullContent,
          raw_input: combinedTranscript,
          note_type: 'meeting',
          source: 'ambient',
          is_encrypted: false,
          enhancement_metadata: {
            enhanced: true,
            enhancedAt: now,
            mode: 'ambient',
            promptVersion: MEETING_ENHANCE_VERSION,
            sessionId: sessionId,
            duration: totalDuration,
            chunkCount: sortedIndices.length,
            hasUserNotes: !!userNotes,
          },
          created_at: now,
          updated_at: now,
        });

        if (noteError) {
          console.error('[process-ambient] Note save error:', noteError);
          await sendEvent({
            type: 'error',
            error: { code: 'SAVE_FAILED', message: 'Failed to save meeting note' },
          });
          await writer.close();
          return;
        }

        // Update session with completed status and note link
        await supabase
          .from('ambient_recordings')
          .update({
            status: 'completed',
            note_id: noteId,
            transcript: combinedTranscript,
            user_notes: userNotes || null,
            duration_seconds: Math.round(totalDuration),
            completed_at: now,
          })
          .eq('id', sessionId);

        const processingTime = Date.now() - t0;

        console.log(`[process-ambient] Complete in ${processingTime}ms, noteId: ${noteId}`);

        await sendEvent({
          type: 'done',
          noteId,
          sessionId,
          processingTime,
          duration: totalDuration,
          transcriptLength: combinedTranscript.length,
          promptVersion: MEETING_ENHANCE_VERSION,
        });

        // ============================================
        // BACKGROUND PROCESSING
        // ============================================

        if (ctx?.waitUntil) {
          ctx.waitUntil(
            processInBackground({
              noteId,
              userId,
              content: fullContent,
              rawTranscript: combinedTranscript,
              supabase,
            })
          );
        }

      } catch (error) {
        console.error('[process-ambient] Error:', error);
        await sendEvent({
          type: 'error',
          error: { code: 'PROCESSING_FAILED', message: error.message || 'Processing failed' },
        });
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
    console.error('[process-ambient] Request error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * Background processing after response is sent
 */
async function processInBackground({ noteId, userId, content, rawTranscript, supabase }) {
  console.log(`[background] Starting processing for ambient note ${noteId}`);

  try {
    // Extract entities from content
    const entities = extractEntitiesSimple(content);

    if (entities.length > 0) {
      // Store entities
      const entityRows = entities.map(e => ({
        user_id: userId,
        name: e.name,
        entity_type: e.type,
        source_note_id: noteId,
        mention_count: 1,
        created_at: new Date().toISOString(),
      }));

      const { error: entityError } = await supabase
        .from('user_entities')
        .upsert(entityRows, { onConflict: 'user_id,name' });

      if (entityError) {
        console.warn('[background] Entity upsert error:', entityError.message);
      } else {
        console.log(`[background] Extracted ${entities.length} entities`);
      }
    }

    console.log(`[background] Complete for note ${noteId}`);
  } catch (error) {
    console.error(`[background] Error for note ${noteId}:`, error.message);
  }
}

/**
 * Simple entity extraction (names, organizations)
 */
function extractEntitiesSimple(text) {
  const entities = [];
  const seen = new Set();

  // Extract capitalized names (simple heuristic)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  let match;

  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1];
    const lower = name.toLowerCase();

    // Skip common words that are capitalized
    const skipWords = new Set([
      'the', 'this', 'that', 'these', 'those', 'monday', 'tuesday', 'wednesday',
      'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march',
      'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november',
      'december', 'action', 'items', 'discussed', 'context', 'meeting', 'notes',
    ]);

    if (!seen.has(lower) && !skipWords.has(lower) && name.length > 2) {
      seen.add(lower);
      entities.push({
        name,
        type: name.includes(' ') ? 'person' : 'unknown',
      });
    }
  }

  return entities.slice(0, 20); // Limit to 20 entities
}
