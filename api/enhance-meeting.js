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

        // Build enhancement prompt
        const prompt = buildEnhancementPrompt(rawInput, inferredTitle, attendees);

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

/**
 * Build the enhancement prompt
 * Placeholder - will be replaced with full prompt from TASK-003
 */
function buildEnhancementPrompt(rawInput, title, attendees) {
  const attendeeList = attendees?.length ? attendees.join(', ') : 'Not specified';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `You are an AI assistant that transforms raw meeting notes into clean, structured meeting minutes.

## RAW NOTES
${rawInput}

## MEETING CONTEXT
- Title: ${title}
- Attendees: ${attendeeList}
- Date: ${today}

## OUTPUT FORMAT

Transform the raw notes into this format:

## DISCUSSED
- [Bullet points of topics covered]

## ACTION ITEMS
${attendees?.length ? attendees.map(a => `→ @${a}: [Actions for this person]`).join('\n') : '→ [Actions with owners if specified]'}

## NOTED
[Important observations, warnings, or concerns - only if present in notes]

## RULES
1. NEVER invent information not in the raw notes
2. Preserve exact quotes in "quotation marks"
3. Preserve exact numbers, dates, and figures
4. Fix typos and expand abbreviations (q2→Q2, eng→engineering, mtg→meeting)
5. Keep scannable with bullets, not paragraphs
6. Skip sections with no content (don't include empty sections)
7. If attendees mentioned, attribute action items to them
8. Use → for action items, - for discussion points

Generate the enhanced meeting minutes now.`;
}
