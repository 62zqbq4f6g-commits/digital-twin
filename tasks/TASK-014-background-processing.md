# TASK-014: Background Entity Extraction

## Overview
After enhancement completes, extract entities and update memory system in background.

## Priority
P0 — Week 3, Day 4-5

## Dependencies
- TASK-002 (Enhancement API)
- TASK-010 (Database schema)
- Existing entity extraction system

## Outputs
- Modifications to `/api/enhance-meeting.js`
- Background processing functions

## Acceptance Criteria

### Background Processing
- [ ] Runs AFTER response sent to user (ctx.waitUntil)
- [ ] Extracts entities from enhanced content
- [ ] Updates attendee meeting history
- [ ] Saves note to database
- [ ] Generates embeddings for semantic search
- [ ] Does NOT block the response

### Entity Extraction
- [ ] People mentioned in content
- [ ] Topics/themes discussed
- [ ] Projects referenced
- [ ] Decisions made

### Meeting History
- [ ] Creates meeting_history record for each attendee
- [ ] Stores topics discussed
- [ ] Stores meeting date

### Note Storage
- [ ] Saves raw_input
- [ ] Saves enhanced_content
- [ ] Sets note_type = 'meeting'
- [ ] Stores meeting_metadata

## Implementation

```javascript
// In api/enhance-meeting.js

// After streaming response completes, trigger background processing
// Using Vercel Edge Runtime's waitUntil pattern

export default async function handler(req, context) {
  // ... existing code to stream response ...

  // After response is ready to return, queue background work
  context.waitUntil(
    processInBackground({
      rawInput,
      enhancedContent,
      attendees,
      title,
      userId,
      noteId,
    })
  );

  return response;
}

async function processInBackground(data) {
  const { rawInput, enhancedContent, attendees, title, userId, noteId } = data;

  try {
    // 1. Save note to database
    await saveNote({
      id: noteId,
      userId,
      content: enhancedContent,
      rawInput,
      noteType: 'meeting',
      meetingMetadata: {
        title,
        attendees,
        meetingDate: new Date().toISOString(),
      },
      enhancementMetadata: {
        enhanced: true,
        enhancedAt: new Date().toISOString(),
        promptVersion: '1.0',
      },
    });

    // 2. Extract entities from enhanced content
    const entities = await extractEntities(enhancedContent, userId);

    // 3. Update meeting history for attendees
    await updateMeetingHistory(userId, noteId, attendees, entities.topics);

    // 4. Generate embeddings for semantic search
    await generateEmbeddings(noteId, enhancedContent);

    // 5. Check for open loops
    await detectOpenLoops(userId, enhancedContent, noteId);

    console.log(`Background processing complete for note ${noteId}`);
  } catch (error) {
    console.error('Background processing error:', error);
    // Don't throw - this is background, user already got response
  }
}

async function saveNote(noteData) {
  const { data, error } = await supabase
    .from('notes')
    .upsert({
      id: noteData.id,
      user_id: noteData.userId,
      content: noteData.content,
      raw_input: noteData.rawInput,
      note_type: noteData.noteType,
      meeting_metadata: noteData.meetingMetadata,
      enhancement_metadata: noteData.enhancementMetadata,
      created_at: new Date().toISOString(),
    });

  if (error) throw error;
  return data;
}

async function extractEntities(content, userId) {
  // Call existing entity extraction
  const response = await fetch(`${process.env.API_URL}/api/extract-entities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, userId }),
  });

  return response.json();
}

async function updateMeetingHistory(userId, noteId, attendeeNames, topics) {
  // Find entity IDs for attendees
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name')
    .eq('user_id', userId)
    .in('name', attendeeNames);

  if (!entities?.length) return;

  // Create meeting history records
  const records = entities.map((entity) => ({
    user_id: userId,
    entity_id: entity.id,
    note_id: noteId,
    meeting_date: new Date().toISOString(),
    topics: topics || [],
  }));

  await supabase.from('meeting_history').upsert(records, {
    onConflict: 'user_id,entity_id,note_id',
  });
}

async function generateEmbeddings(noteId, content) {
  // Call existing embeddings API
  await fetch(`${process.env.API_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteId, content }),
  });
}

async function detectOpenLoops(userId, content, noteId) {
  // Simple keyword detection for common open loop phrases
  const openLoopIndicators = [
    'forgot to',
    'need to follow up',
    'still waiting',
    'haven\'t heard back',
    'didn\'t get to',
    'postponed',
    'pushed back',
    'blocked',
    'pending',
  ];

  const contentLower = content.toLowerCase();
  
  for (const indicator of openLoopIndicators) {
    if (contentLower.includes(indicator)) {
      // Extract the context around the indicator
      const index = contentLower.indexOf(indicator);
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + indicator.length + 50);
      const context = content.slice(start, end);

      // Check if this open loop already exists
      const { data: existing } = await supabase
        .from('open_loops')
        .select('id, mention_count')
        .eq('user_id', userId)
        .ilike('description', `%${indicator}%`)
        .single();

      if (existing) {
        // Update existing
        await supabase
          .from('open_loops')
          .update({
            mention_count: existing.mention_count + 1,
            last_mentioned_at: new Date().toISOString(),
            last_note_id: noteId,
          })
          .eq('id', existing.id);
      } else {
        // Create new
        await supabase.from('open_loops').insert({
          user_id: userId,
          description: context.trim(),
          first_noted_at: new Date().toISOString(),
          first_note_id: noteId,
          mention_count: 1,
          last_mentioned_at: new Date().toISOString(),
          last_note_id: noteId,
          status: 'open',
          keywords: [indicator],
        });
      }
    }
  }
}
```

## Test Checklist

- [ ] Response returns before background processing completes
- [ ] Note saved to database with correct structure
- [ ] Entities extracted from content
- [ ] Meeting history created for attendees
- [ ] Embeddings generated
- [ ] Open loops detected
- [ ] Errors in background don't affect response
- [ ] Can verify data in Supabase after enhancement
