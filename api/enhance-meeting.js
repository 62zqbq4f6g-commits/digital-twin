/**
 * INSCRIPT: Meeting Enhancement API (Edge Runtime)
 *
 * Phase 16 - Enhancement System
 * Transforms raw meeting notes into structured output.
 *
 * Target: < 3 seconds (p95)
 *
 * Streaming SSE Response:
 * - data: {"type":"metadata",...}
 * - data: {"type":"content","text":"..."}
 * - data: {"type":"done","noteId":"..."}
 * - data: {"type":"error",...}
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildMeetingEnhancePrompt, MEETING_ENHANCE_VERSION } from '../prompts/meeting-enhance.js';

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

    console.log('[enhance-meeting] Starting enhancement for user:', userId);
    console.log('[enhance-meeting] Input length:', rawInput.length);
    console.log('[enhance-meeting] Attendees:', attendees?.length || 0);

    // ============================================
    // STREAMING RESPONSE
    // ============================================

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process in background (non-blocking for Edge)
    const processAsync = async () => {
      const startTime = Date.now();

      try {
        // Send metadata first
        const inferredTitle = title || inferTitle(rawInput, attendees);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'metadata',
              metadata: {
                title: inferredTitle,
                date: new Date().toISOString().split('T')[0],
                attendees: attendees || [],
                attendeeEntities: [], // TODO: Fetch from DB in TASK-011
              },
            })}\n\n`
          )
        );

        // Initialize Anthropic
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        // Build enhancement prompt (v1.0)
        const prompt = buildMeetingEnhancePrompt({
          rawInput,
          title: inferredTitle,
          attendees,
        });

        // Stream from Claude
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        });

        // Stream content chunks
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
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

        // Send completion
        const processingTime = Date.now() - startTime;
        const noteId = crypto.randomUUID(); // TODO: Save to DB in TASK-014

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              noteId,
              processingTime,
              promptVersion: MEETING_ENHANCE_VERSION,
            })}\n\n`
          )
        );

        console.log(`[enhance-meeting] Complete in ${processingTime}ms`);

        // TODO: Background processing in TASK-014
        // if (ctx?.waitUntil) {
        //   ctx.waitUntil(processBackground(rawInput, attendees, userId, noteId));
        // }

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

