# TASK-015: Personal Note Enhancement API

## Overview
Create API endpoint that enhances personal notes with a subtle, voice-preserving approach.

## Priority
P0 — Week 1, Day 1-2

## Dependencies
- Existing enhancement infrastructure from Phase 16

## Outputs
- `/api/enhance-note.js` — New file

## Acceptance Criteria

### Endpoint
- [ ] POST /api/enhance-note
- [ ] Edge Runtime
- [ ] Streaming SSE response
- [ ] < 3 second total time

### Request
```json
{
  "noteId": "uuid",
  "content": "raw note text",
  "noteType": "note|idea|reflection",
  "userId": "uuid"
}
```

### Response (SSE)
```
data: {"type":"metadata","noteType":"note","enhanced":true}
data: {"type":"content","text":"..."}
data: {"type":"threads","items":[{"text":"...","noteId":"...","date":"..."}]}
data: {"type":"reflect","question":"..."}  // Optional
data: {"type":"done","noteId":"...","processingTime":...}
```

### Enhancement Rules
- [ ] Preserve user's voice and tone
- [ ] Clean up grammar without changing meaning
- [ ] Keep similar length (±20%)
- [ ] Add THREADS section (connections to past notes)
- [ ] Optionally add reflective question
- [ ] Never restructure into bullets unless user used them

## Implementation

```javascript
// api/enhance-note.js

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonalEnhancePrompt } from '../prompts/note-enhance.js';

export const config = { runtime: 'edge' };

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  const startTime = Date.now();
  
  try {
    const { noteId, content, noteType, userId } = await req.json();

    if (!content?.trim()) {
      return new Response(
        JSON.stringify({ error: { code: 'EMPTY_CONTENT' } }),
        { status: 400 }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
        { status: 401 }
      );
    }

    // Fetch related notes for threads
    const relatedNotes = await fetchRelatedNotes(userId, content);
    const patterns = await fetchRelevantPatterns(userId, content);

    // Build prompt
    const prompt = buildPersonalEnhancePrompt({
      content,
      noteType,
      relatedNotes,
      patterns,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Send metadata
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({
        type: 'metadata',
        noteType,
        noteId,
        enhanced: true
      })}\n\n`)
    );

    // Stream from Claude
    const response = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let fullContent = '';
    
    // Process stream
    (async () => {
      try {
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullContent += event.delta.text;
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                text: event.delta.text
              })}\n\n`)
            );
          }
        }

        // Parse and send threads
        const threads = parseThreadsFromContent(fullContent, relatedNotes);
        if (threads.length > 0) {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({
              type: 'threads',
              items: threads
            })}\n\n`)
          );
        }

        // Send done
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            noteId,
            processingTime: Date.now() - startTime
          })}\n\n`)
        );

        await writer.close();

        // Background: update note with enhanced content
        context.waitUntil(
          updateNoteWithEnhancement(noteId, fullContent, userId)
        );

      } catch (error) {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error.message
          })}\n\n`)
        );
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: { code: 'SERVER_ERROR', message: error.message } }),
      { status: 500 }
    );
  }
}

async function fetchRelatedNotes(userId, content) {
  // Use semantic search to find related notes
  // Limit to 3 most relevant
  return [];
}

async function fetchRelevantPatterns(userId, content) {
  // Fetch patterns that match keywords in content
  return [];
}

function parseThreadsFromContent(content, relatedNotes) {
  // Extract THREADS section from response
  // Match with actual note IDs
  return [];
}

async function updateNoteWithEnhancement(noteId, enhancedContent, userId) {
  await supabase
    .from('notes')
    .update({
      enhanced_content: enhancedContent,
      auto_enhanced: true,
      enhancement_version: '2.0',
    })
    .eq('id', noteId)
    .eq('user_id', userId);
}
```

## Test Checklist

- [ ] Empty content returns 400
- [ ] Missing userId returns 401
- [ ] Streams enhanced content
- [ ] Threads section included when relevant
- [ ] Processing time < 3 seconds
- [ ] Background update completes
- [ ] Tone preserved in output
