# TASK-027: Query Meetings API

## Overview
Create API endpoint for natural language queries across all meetings.

## Priority
P1 — Week 3, Day 3-4

## Dependencies
- TASK-024 (Meetings tab UI)
- Meeting notes in database with embeddings

## Outputs
- `/api/query-meetings.js` — New file

## Acceptance Criteria

### Endpoint
- [ ] GET /api/query-meetings
- [ ] Query param: q (question), userId
- [ ] Returns AI-generated answer with sources
- [ ] < 2 second response time

### Query Understanding
- [ ] Extracts entities from question (people, topics, dates)
- [ ] Determines query type (who/what/when/how many)
- [ ] Finds relevant meetings via semantic search

### Response
```json
{
  "type": "ai_answer",
  "answer": "Sarah mentioned budget concerns in 2 meetings...",
  "sources": [
    {
      "noteId": "uuid",
      "title": "1:1 with Sarah",
      "date": "Jan 24",
      "snippet": "Q2 budget is tight, need to prioritize..."
    }
  ],
  "processingTime": 1200
}
```

## Implementation

```javascript
// api/query-meetings.js

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const userId = searchParams.get('userId');

  if (!query) {
    return new Response(
      JSON.stringify({ error: { code: 'EMPTY_QUERY' } }),
      { status: 400 }
    );
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
      { status: 401 }
    );
  }

  try {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Find relevant meetings via semantic search
    const relevantMeetings = await findRelevantMeetings(userId, queryEmbedding, query);

    if (relevantMeetings.length === 0) {
      return new Response(
        JSON.stringify({
          type: 'no_results',
          answer: "I couldn't find any meetings related to your question.",
          sources: [],
          processingTime: Date.now() - startTime,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Build context from relevant meetings
    const context = buildMeetingContext(relevantMeetings);

    // 4. Generate answer using Claude
    const answer = await generateAnswer(query, context);

    // 5. Extract sources from relevant meetings
    const sources = relevantMeetings.slice(0, 3).map(m => ({
      noteId: m.id,
      title: m.meeting_metadata?.title || 'Untitled Meeting',
      date: formatDate(m.created_at),
      snippet: extractRelevantSnippet(m, query),
    }));

    return new Response(
      JSON.stringify({
        type: 'ai_answer',
        answer,
        sources,
        processingTime: Date.now() - startTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Query error:', error);
    return new Response(
      JSON.stringify({ error: { code: 'QUERY_FAILED', message: error.message } }),
      { status: 500 }
    );
  }
}

async function generateEmbedding(text) {
  // Use existing embedding API or OpenAI embeddings
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

async function findRelevantMeetings(userId, queryEmbedding, query) {
  // Extract entities for additional filtering
  const entities = extractEntitiesFromQuery(query);
  
  // Semantic search using pgvector
  const { data: meetings, error } = await supabase.rpc('match_meeting_notes', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 10,
    p_user_id: userId,
  });

  if (error) throw error;

  // Additional filtering by entities if present
  if (entities.people.length > 0) {
    return meetings.filter(m => {
      const attendees = m.meeting_metadata?.attendees || [];
      return entities.people.some(person => 
        attendees.some(a => a.toLowerCase().includes(person.toLowerCase()))
      );
    });
  }

  return meetings || [];
}

function extractEntitiesFromQuery(query) {
  // Simple extraction - could be enhanced with NER
  const people = [];
  const topics = [];

  // Match "Sarah", "with John", etc.
  const personPatterns = [
    /(?:with|from|about|did)\s+([A-Z][a-z]+)/g,
    /([A-Z][a-z]+)\s+(?:said|mentioned|talked)/g,
  ];

  for (const pattern of personPatterns) {
    const matches = query.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) people.push(match[1]);
    }
  }

  return { people, topics };
}

function buildMeetingContext(meetings) {
  return meetings.map(m => {
    const title = m.meeting_metadata?.title || 'Meeting';
    const date = formatDate(m.created_at);
    const content = m.enhanced_content || m.content || '';
    
    return `
## ${title} (${date})
${content.substring(0, 1500)}
    `.trim();
  }).join('\n\n---\n\n');
}

async function generateAnswer(query, context) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are answering questions about a user's meeting notes. Be concise and specific.

MEETING NOTES:
${context}

QUESTION: ${query}

Answer the question based only on the meeting notes above. If the information isn't in the notes, say so. Be specific about which meeting(s) the information comes from.`
    }],
  });

  return response.content[0].text;
}

function extractRelevantSnippet(meeting, query) {
  const content = meeting.enhanced_content || meeting.content || '';
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  // Find sentence containing most query words
  const sentences = content.split(/[.!?]+/);
  let bestSentence = sentences[0];
  let bestScore = 0;

  for (const sentence of sentences) {
    const score = queryWords.filter(w => sentence.toLowerCase().includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  return bestSentence.trim().substring(0, 150) + '...';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

## Database Function

```sql
-- Add to Supabase if not exists
CREATE OR REPLACE FUNCTION match_meeting_notes(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id text,
  content text,
  enhanced_content text,
  meeting_metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.content,
    n.enhanced_content,
    n.meeting_metadata,
    n.created_at,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM notes n
  WHERE n.user_id = p_user_id
    AND n.note_type = 'meeting'
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Test Checklist

- [ ] Empty query returns 400
- [ ] Missing userId returns 401
- [ ] Question about person filters correctly
- [ ] Returns relevant meeting sources
- [ ] AI answer is concise and accurate
- [ ] Response time < 2 seconds
- [ ] Handles "no results" gracefully
- [ ] Snippets are relevant to query
