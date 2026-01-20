/**
 * MEM0 GAP 2: Query Synthesis
 * Transforms user messages into optimized search queries for vector retrieval
 * Key innovation: Extract search intent, not just keywords
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Query type patterns for fast classification
const QUERY_PATTERNS = {
  entity_lookup: [
    /who is (\w+)/i,
    /tell me about (\w+)/i,
    /what do you know about (\w+)/i,
    /what's (\w+)'s/i,
    /(\w+)'s (\w+)/i
  ],
  temporal: [
    /last (week|month|year)/i,
    /recently/i,
    /when did/i,
    /how long/i,
    /since when/i
  ],
  relationship: [
    /how does (\w+) relate to/i,
    /connection between/i,
    /relationship with/i,
    /who knows/i
  ],
  sentiment: [
    /how do (I|you) feel about/i,
    /what do (I|you) think of/i,
    /opinion on/i,
    /feelings about/i
  ],
  factual: [
    /what is/i,
    /where does/i,
    /why did/i,
    /how does/i
  ]
};

/**
 * Quick query type classification using patterns
 */
function classifyQueryType(text) {
  for (const [type, patterns] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type;
      }
    }
  }
  return 'general';
}

/**
 * Extract entity names mentioned in the query
 */
function extractMentionedEntities(text, knownEntities = []) {
  const mentioned = [];
  const textLower = text.toLowerCase();

  for (const entity of knownEntities) {
    const nameLower = entity.name?.toLowerCase();
    if (nameLower && textLower.includes(nameLower)) {
      mentioned.push(entity);
    }
  }

  return mentioned;
}

/**
 * Synthesize optimized search queries from user input
 * Returns multiple queries optimized for different retrieval strategies
 */
async function synthesizeQueries(userMessage, conversationContext = [], knownEntities = []) {
  // Quick classification
  const queryType = classifyQueryType(userMessage);
  const mentionedEntities = extractMentionedEntities(userMessage, knownEntities);

  // Build context from recent conversation
  const recentContext = conversationContext
    .slice(-3)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `Analyze this user message and generate optimized search queries for a personal memory system.

USER MESSAGE: "${userMessage}"

${recentContext ? `RECENT CONVERSATION:\n${recentContext}\n` : ''}
${mentionedEntities.length > 0 ? `MENTIONED ENTITIES: ${mentionedEntities.map(e => e.name).join(', ')}\n` : ''}
DETECTED QUERY TYPE: ${queryType}

Generate search queries optimized for:
1. VECTOR SEARCH: A semantic query that captures the meaning/intent (not just keywords)
2. ENTITY NAMES: Specific entity names to look up (people, places, projects)
3. TOPICS: Abstract topics/themes to search for
4. TIME FILTER: Any temporal constraints (null if none)

Respond in JSON format:
{
  "vector_query": "semantic search query here",
  "entity_names": ["name1", "name2"],
  "topics": ["topic1", "topic2"],
  "time_filter": { "after": "ISO date or null", "before": "ISO date or null" },
  "query_type": "${queryType}",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        original_message: userMessage,
        mentioned_entities: mentionedEntities
      };
    }

    // Fallback: use the original message as vector query
    return {
      vector_query: userMessage,
      entity_names: mentionedEntities.map(e => e.name),
      topics: [],
      time_filter: null,
      query_type: queryType,
      confidence: 0.5,
      original_message: userMessage,
      mentioned_entities: mentionedEntities
    };

  } catch (error) {
    console.error('[synthesize-query] Claude error:', error);

    // Fallback response
    return {
      vector_query: userMessage,
      entity_names: mentionedEntities.map(e => e.name),
      topics: [],
      time_filter: null,
      query_type: queryType,
      confidence: 0.3,
      original_message: userMessage,
      mentioned_entities: mentionedEntities,
      error: error.message
    };
  }
}

/**
 * Fast query synthesis without LLM (for simple queries)
 */
function synthesizeQueryFast(userMessage, knownEntities = []) {
  const queryType = classifyQueryType(userMessage);
  const mentionedEntities = extractMentionedEntities(userMessage, knownEntities);

  // Extract potential topics from common words
  const words = userMessage.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with',
    'at', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'beneath', 'under', 'above',
    'what', 'who', 'when', 'where', 'why', 'how', 'which', 'whom', 'whose', 'i', 'me', 'my',
    'you', 'your', 'he', 'she', 'it', 'we', 'they', 'them', 'this', 'that', 'these', 'those']);

  const topics = words
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 5);

  // Detect time filters
  let timeFilter = null;
  if (/last\s+week/i.test(userMessage)) {
    timeFilter = { after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() };
  } else if (/last\s+month/i.test(userMessage)) {
    timeFilter = { after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };
  } else if (/recently/i.test(userMessage)) {
    timeFilter = { after: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() };
  }

  return {
    vector_query: userMessage,
    entity_names: mentionedEntities.map(e => e.name),
    topics,
    time_filter: timeFilter,
    query_type: queryType,
    confidence: 0.6,
    original_message: userMessage,
    mentioned_entities: mentionedEntities,
    fast_mode: true
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, conversationContext, knownEntities, fast } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  try {
    let result;

    if (fast) {
      // Use fast mode without LLM
      result = synthesizeQueryFast(message, knownEntities || []);
    } else {
      // Use LLM for better query synthesis
      result = await synthesizeQueries(message, conversationContext || [], knownEntities || []);
    }

    console.log('[synthesize-query] Synthesized:', {
      original: message.substring(0, 50) + '...',
      vector_query: result.vector_query.substring(0, 50) + '...',
      entities: result.entity_names.length,
      type: result.query_type
    });

    return res.json(result);

  } catch (error) {
    console.error('[synthesize-query] Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Export utilities
export { synthesizeQueries, synthesizeQueryFast, classifyQueryType, extractMentionedEntities, QUERY_PATTERNS };
