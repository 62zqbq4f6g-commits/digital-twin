/**
 * INSCRIPT: Query Meetings API (Edge Runtime)
 *
 * Phase 16 - Enhancement System (TASK-027)
 * Natural language queries across all meeting notes.
 *
 * GET /api/query-meetings?q=...&userId=...
 *
 * Target: < 2 second response time
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

// Static system prompt for query answering (cacheable)
const QUERY_SYSTEM_PROMPT = `You are answering questions about a user's meeting notes. Be concise, specific, and helpful.

RULES:
1. Answer ONLY based on the meeting notes provided
2. If the information isn't in the notes, say "I couldn't find that in your meetings"
3. Be specific about which meeting(s) the information comes from
4. Use natural language, not bullet points unless listing multiple items
5. Keep answers to 2-3 sentences unless more detail is needed
6. Cite meetings by title and date when referencing them

EXAMPLES:
Q: "What did Sarah say about the budget?"
A: "In your 1:1 with Sarah on Jan 24, she mentioned Q2 budget is tight and the team needs to prioritize mobile features over new initiatives."

Q: "When is the product launch?"
A: "Based on your Product Review meeting on Jan 22, the launch was delayed by 2 weeks and is now targeting early February."`;

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } }),
      { status: 405, headers: corsHeaders }
    );
  }

  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const userId = searchParams.get('userId');

  // Validation
  if (!query || query.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: { code: 'EMPTY_QUERY', message: 'Query too short' } }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'userId required' } }),
      { status: 401, headers: corsHeaders }
    );
  }

  console.log(`[query-meetings] Query: "${query}" for user ${userId}`);

  try {
    // Initialize clients
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // 1. Generate embedding for the query (parallel with entity extraction)
    const [queryEmbedding, entities] = await Promise.all([
      generateEmbedding(query),
      extractEntitiesFromQuery(query),
    ]);

    console.log(`[query-meetings] Embedding generated, entities: ${JSON.stringify(entities)}`);
    console.log(`[PERF] Embedding: ${Date.now() - startTime}ms`);

    // 2. Find relevant meetings via semantic search
    const relevantMeetings = await findRelevantMeetings(supabase, userId, queryEmbedding, entities);
    console.log(`[PERF] Search: ${Date.now() - startTime}ms, found ${relevantMeetings.length} meetings`);

    if (relevantMeetings.length === 0) {
      return new Response(
        JSON.stringify({
          type: 'no_results',
          answer: "I couldn't find any meetings related to your question. Try asking about specific people or topics from your recent meetings.",
          sources: [],
          processingTime: Date.now() - startTime,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Build context from relevant meetings
    const context = buildMeetingContext(relevantMeetings);

    // 4. Generate answer using Claude with prompt caching
    const answer = await generateAnswer(anthropic, query, context);
    console.log(`[PERF] Answer generated: ${Date.now() - startTime}ms`);

    // 5. Extract sources from relevant meetings
    const sources = relevantMeetings.slice(0, 5).map(m => ({
      noteId: m.id,
      title: m.meeting_metadata?.title || m.title || 'Untitled Meeting',
      date: formatDate(m.created_at),
      snippet: extractRelevantSnippet(m, query),
      attendees: m.meeting_metadata?.attendees || [],
    }));

    const processingTime = Date.now() - startTime;
    console.log(`[query-meetings] Complete in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        type: 'ai_answer',
        answer,
        sources,
        processingTime,
        _debug: {
          meetingsFound: relevantMeetings.length,
          entitiesExtracted: entities,
        },
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[query-meetings] Error:', error);
    return new Response(
      JSON.stringify({
        error: { code: 'QUERY_FAILED', message: error.message },
        processingTime: Date.now() - startTime,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateEmbedding(text) {
  try {
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

    if (!response.ok) {
      console.error('[query-meetings] Embedding API error:', response.status);
      throw new Error('Embedding generation failed');
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[query-meetings] Embedding error:', error);
    throw error;
  }
}

// ============================================
// ENTITY EXTRACTION
// ============================================

function extractEntitiesFromQuery(query) {
  const people = [];
  const topics = [];
  const timeframes = [];

  // Match capitalized names (simple NER)
  // "What did Sarah say" / "meetings with John" / "from Marcus"
  const personPatterns = [
    /(?:with|from|about|did|and|,)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|mentioned|talked|asked|told|suggested)/g,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s/g, // Name at start
  ];

  for (const pattern of personPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(query)) !== null) {
      const name = match[1]?.trim();
      // Filter out common false positives
      const falsePositives = ['What', 'When', 'Where', 'How', 'Why', 'Who', 'Did', 'Does', 'Is', 'Are', 'The', 'This', 'That', 'I', 'My', 'We', 'In', 'Last', 'Next'];
      if (name && !falsePositives.includes(name) && !people.includes(name)) {
        people.push(name);
      }
    }
  }

  // Match time references
  const timePatterns = [
    /last\s+(week|month|year)/gi,
    /this\s+(week|month|year)/gi,
    /(january|february|march|april|may|june|july|august|september|october|november|december)/gi,
    /(today|yesterday|recently)/gi,
  ];

  for (const pattern of timePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(query)) !== null) {
      timeframes.push(match[0].toLowerCase());
    }
  }

  // Extract topic keywords (nouns after certain prepositions)
  const topicPatterns = [
    /about\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)/gi,
    /regarding\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)/gi,
    /(?:budget|launch|roadmap|project|decision|plan)/gi,
  ];

  for (const pattern of topicPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(query)) !== null) {
      const topic = (match[1] || match[0])?.toLowerCase().trim();
      if (topic && topic.length > 2 && !topics.includes(topic)) {
        topics.push(topic);
      }
    }
  }

  return { people, topics, timeframes };
}

// ============================================
// MEETING SEARCH
// ============================================

async function findRelevantMeetings(supabase, userId, queryEmbedding, entities) {
  // Try RPC function first (semantic search)
  try {
    const { data: meetings, error } = await supabase.rpc('match_meeting_notes', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 10,
      p_user_id: userId,
    });

    if (!error && meetings?.length > 0) {
      console.log(`[query-meetings] RPC found ${meetings.length} meetings`);
      return filterByEntities(meetings, entities);
    }

    // If RPC doesn't exist or returns empty, fall back to direct query
    if (error) {
      console.warn('[query-meetings] RPC error, using fallback:', error.message);
    }
  } catch (rpcError) {
    console.warn('[query-meetings] RPC not available:', rpcError.message);
  }

  // Fallback: Join note_embeddings with notes
  const { data: embeddings, error: embError } = await supabase
    .from('note_embeddings')
    .select(`
      note_id,
      embedding,
      notes!inner (
        id,
        content,
        enhanced_content,
        meeting_metadata,
        created_at,
        note_type
      )
    `)
    .eq('user_id', userId)
    .eq('notes.note_type', 'meeting')
    .limit(50);

  if (embError) {
    console.error('[query-meetings] Embedding query error:', embError);
    // Last resort: just get recent meetings
    return getRecentMeetings(supabase, userId, entities);
  }

  if (!embeddings?.length) {
    return getRecentMeetings(supabase, userId, entities);
  }

  // Calculate similarity manually
  const withSimilarity = embeddings
    .filter(e => e.notes && e.embedding)
    .map(e => ({
      ...e.notes,
      similarity: cosineSimilarity(queryEmbedding, e.embedding),
    }))
    .filter(m => m.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  return filterByEntities(withSimilarity, entities);
}

async function getRecentMeetings(supabase, userId, entities) {
  // Get recent meeting notes without embeddings
  const { data: meetings, error } = await supabase
    .from('notes')
    .select('id, content, enhanced_content, meeting_metadata, created_at')
    .eq('user_id', userId)
    .eq('note_type', 'meeting')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[query-meetings] Recent meetings error:', error);
    return [];
  }

  return filterByEntities(meetings || [], entities);
}

function filterByEntities(meetings, entities) {
  if (!entities.people?.length && !entities.topics?.length) {
    return meetings;
  }

  // Boost meetings that match extracted entities
  return meetings
    .map(m => {
      let boost = 0;
      const attendees = m.meeting_metadata?.attendees || [];
      const content = (m.enhanced_content || m.content || '').toLowerCase();
      const title = (m.meeting_metadata?.title || '').toLowerCase();

      // Boost for matching attendees
      for (const person of entities.people) {
        const personLower = person.toLowerCase();
        if (attendees.some(a => a.toLowerCase().includes(personLower))) {
          boost += 0.3;
        }
        if (content.includes(personLower) || title.includes(personLower)) {
          boost += 0.1;
        }
      }

      // Boost for matching topics
      for (const topic of entities.topics) {
        if (content.includes(topic) || title.includes(topic)) {
          boost += 0.2;
        }
      }

      return { ...m, similarity: (m.similarity || 0.5) + boost };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================
// CONTEXT BUILDING
// ============================================

function buildMeetingContext(meetings) {
  return meetings.slice(0, 5).map(m => {
    const title = m.meeting_metadata?.title || 'Meeting';
    const date = formatDate(m.created_at);
    const attendees = m.meeting_metadata?.attendees?.join(', ') || '';
    const content = m.enhanced_content || m.content || '';

    // Truncate content to keep context reasonable
    const truncatedContent = content.length > 2000
      ? content.substring(0, 2000) + '...'
      : content;

    return `
## ${title} (${date})${attendees ? `\nAttendees: ${attendees}` : ''}

${truncatedContent}
    `.trim();
  }).join('\n\n---\n\n');
}

// ============================================
// ANSWER GENERATION
// ============================================

async function generateAnswer(anthropic, query, context) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      // Use prompt caching for the static system prompt
      system: [
        {
          type: 'text',
          text: QUERY_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `MEETING NOTES:\n${context}\n\nQUESTION: ${query}`,
        },
      ],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[query-meetings] Claude error:', error);
    throw new Error('Failed to generate answer');
  }
}

// ============================================
// UTILITIES
// ============================================

function extractRelevantSnippet(meeting, query) {
  const content = meeting.enhanced_content || meeting.content || '';
  if (!content) return '';

  // Get query keywords (filter out stop words)
  const stopWords = new Set(['what', 'when', 'where', 'how', 'why', 'who', 'did', 'does', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'about', 'from', 'say', 'said', 'tell', 'told']);
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  // Split into sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return content.substring(0, 150) + '...';

  // Score each sentence by query word matches
  let bestSentence = sentences[0];
  let bestScore = 0;

  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const score = queryWords.filter(w => sentenceLower.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  // Clean up and truncate
  const snippet = bestSentence.trim();
  if (snippet.length > 150) {
    return snippet.substring(0, 147) + '...';
  }
  return snippet;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
