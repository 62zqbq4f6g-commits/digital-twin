# TASK-002: Meeting Enhancement API Endpoint

## Overview
Create the Edge Runtime API endpoint that enhances raw meeting notes into structured output.

## Priority
P0 — Week 1, Day 1-2

## Dependencies
- TASK-003 (Enhancement Prompt) — can develop in parallel, use placeholder prompt

## Inputs
- API spec from INSCRIPT-ENHANCEMENT-MASTER-SPEC.md Section 9.1

## Outputs
- `/api/enhance-meeting.js` — New file (Edge Runtime)

## Acceptance Criteria

### Endpoint Spec
- [ ] POST /api/enhance-meeting
- [ ] Edge Runtime (export const config = { runtime: 'edge' })
- [ ] Accepts: { rawInput, title?, attendees?, userId }
- [ ] Returns: Streaming SSE response
- [ ] Completes in < 3 seconds (p95)

### Request Validation
- [ ] Reject empty rawInput
- [ ] userId required (from auth)
- [ ] title and attendees optional

### Response Format (Streaming SSE)
- [ ] `data: {"type":"metadata",...}`
- [ ] `data: {"type":"content","text":"..."}`
- [ ] `data: {"type":"done","noteId":"..."}`
- [ ] `data: {"type":"error",...}` on failure

### Error Handling
- [ ] EMPTY_INPUT error for empty content
- [ ] ENHANCEMENT_FAILED for Claude API errors
- [ ] UNAUTHORIZED for missing/invalid auth
- [ ] Graceful degradation — never lose user input

## Implementation

```javascript
// api/enhance-meeting.js

import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { rawInput, title, attendees, userId } = await req.json();

    // Validation
    if (!rawInput?.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'EMPTY_INPUT', message: 'Input cannot be empty' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process in background
    (async () => {
      const startTime = Date.now();

      try {
        // Send metadata first
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'metadata',
              metadata: {
                title: title || inferTitle(rawInput, attendees),
                date: new Date().toISOString().split('T')[0],
                attendeeEntities: [], // TODO: Fetch from DB in TASK-011
              },
            })}\n\n`
          )
        );

        // Build prompt
        const prompt = buildEnhancementPrompt(rawInput, title, attendees);

        // Stream from Claude
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        });

        // Stream content chunks
        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
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
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              noteId: crypto.randomUUID(), // TODO: Save to DB
              processingTime,
            })}\n\n`
          )
        );

        // TODO: Background processing in TASK-014
        // ctx.waitUntil(processBackground(rawInput, attendees, userId));

      } catch (error) {
        console.error('Enhancement error:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: {
                code: 'ENHANCEMENT_FAILED',
                message: 'Failed to enhance notes',
              },
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function inferTitle(rawInput, attendees) {
  // Simple title inference
  if (attendees?.length) {
    return `Meeting with ${attendees.join(', ')}`;
  }
  // Extract first few words
  const words = rawInput.trim().split(/\s+/).slice(0, 5).join(' ');
  return words.length > 30 ? words.slice(0, 30) + '...' : words;
}

function buildEnhancementPrompt(rawInput, title, attendees) {
  // Placeholder prompt — will be replaced with full prompt from TASK-003
  return `You are an AI assistant that transforms raw meeting notes into clean, structured meeting minutes.

## RAW NOTES
${rawInput}

## MEETING CONTEXT
- Title: ${title || 'Untitled Meeting'}
- Attendees: ${attendees?.join(', ') || 'Not specified'}
- Date: ${new Date().toLocaleDateString()}

## OUTPUT FORMAT

Transform the raw notes into this format:

## DISCUSSED
• [Bullet points of topics covered]

## ACTION ITEMS (only if actions mentioned)
→ [Actions with owners if specified]

## NOTED (only if important observations)
⚠️ [Warnings or concerns flagged]

## RULES
1. Never invent information not in the raw notes
2. Preserve exact quotes in "quotation marks"
3. Preserve exact numbers and figures
4. Fix typos and expand abbreviations (q2→Q2, eng→engineering)
5. Keep scannable with bullets, not paragraphs
6. Skip sections with no content

Generate the enhanced meeting minutes now.`;
}
```

## Testing

### Unit Tests

```javascript
// tests/enhance-meeting.test.js

describe('POST /api/enhance-meeting', () => {
  test('rejects empty input', async () => {
    const response = await fetch('/api/enhance-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: '', userId: 'test' }),
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('EMPTY_INPUT');
  });

  test('rejects missing userId', async () => {
    const response = await fetch('/api/enhance-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'test content' }),
    });
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  test('returns streaming response for valid input', async () => {
    const response = await fetch('/api/enhance-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawInput: 'talked about project timeline',
        userId: 'test-user',
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  test('completes within 3 seconds', async () => {
    const start = Date.now();
    const response = await fetch('/api/enhance-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawInput: 'quick meeting about roadmap',
        userId: 'test-user',
      }),
    });
    
    // Consume stream
    const reader = response.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
    
    expect(Date.now() - start).toBeLessThan(3000);
  });
});
```

### Manual Testing

```bash
# Test with curl
curl -X POST http://localhost:3000/api/enhance-meeting \
  -H "Content-Type: application/json" \
  -d '{"rawInput": "sarah 1:1, talked roadmap, q2 budget stress, mobile blocked", "attendees": ["Sarah"], "userId": "test"}' \
  --no-buffer
```

## Test Checklist

- [ ] Empty input returns 400 with EMPTY_INPUT
- [ ] Missing userId returns 401 with UNAUTHORIZED
- [ ] Valid request returns streaming response
- [ ] Metadata event sent first
- [ ] Content events stream correctly
- [ ] Done event sent at end
- [ ] Errors handled gracefully
- [ ] Response time < 3 seconds

## Notes

- Full enhancement prompt in TASK-003
- Inscript Context added in TASK-011/012
- Background processing in TASK-014
- Authentication integration with existing auth system
