/**
 * MEM0 BUILD 1: Enhanced LLM Entity Extraction API
 * Extracts memories with type classification, temporal markers, and sensitivity detection
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Enhanced extraction system prompt with memory types and temporal detection
const EXTRACTION_SYSTEM_PROMPT = `You are a Personal Information Organizer extracting memories from notes.

Your job is to extract CRUCIAL, NEW, ACTIONABLE information for memory storage.

## MEMORY TYPE CLASSIFICATION

For each piece of information, classify its memory_type:

| Type | Use When | Examples |
|------|----------|----------|
| entity | A person, place, project, pet, or thing | "Marcus", "Tokyo", "Project Alpha" |
| fact | Objective information about an entity | "Marcus works at Notion", "Tokyo has 14M people" |
| preference | A like, dislike, or preference | "Prefers cold brew", "Hates meetings before 10am" |
| event | Something with a specific time/date | "Wedding on June 15", "Conference next week" |
| goal | An objective or desired outcome | "Wants to launch by Q2", "Aiming for 10k users" |
| procedure | Step-by-step knowledge or processes | "Deploy process: commit, push, verify" |
| decision | A decision the user made | "Decided to take the job", "Chose React over Vue" |
| action | An action completed or outcome | "Shipped the feature", "Closed the deal" |

## TEMPORAL DETECTION

Detect these temporal markers:

1. **is_historical** = true when you see:
   - "used to", "previously", "no longer", "back when", "in the past"
   - Past tense changes: "worked at" (vs "works at")

2. **effective_from** = future date when you see:
   - "starting next month", "beginning January", "from Monday"
   - "will be", "going to", "plans to"

3. **expires_at** = end date when you see:
   - "until Friday", "for the next week", "through December"
   - "temporary", "for now"

4. **recurrence_pattern** = JSON when you see:
   - "every Monday" → {"type": "weekly", "day": "Monday"}
   - "daily standup at 9am" → {"type": "daily", "time": "09:00"}
   - "monthly review" → {"type": "monthly"}
   - "yearly anniversary June 15" → {"type": "yearly", "month": 6, "day": 15}

## SENSITIVITY DETECTION

Set sensitivity_level:
- "sensitive": health conditions, medical info, death, loss, grief, breakups, mental health, therapy
- "private": financial details, salary, passwords, SSN (should rarely store these)
- "normal": everything else

## DO NOT EXTRACT

- Conversational filler: "Hi", "Thanks", "Got it", "Okay"
- General knowledge: "What's the capital of France?"
- Already known information (check context)
- Passwords, SSNs, credit card numbers (NEVER store)

## OUTPUT FORMAT

Return JSON only, no markdown code blocks.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, knownEntities = [], userContext = {} } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  // Build context about known entities
  const knownContext = knownEntities.length > 0
    ? `\nKnown entities (reference these if mentioned, detect changes): ${knownEntities.map(e => {
        if (typeof e === 'string') return e;
        return `${e.name}${e.summary ? ` (${e.summary})` : ''}`;
      }).join(', ')}`
    : '';

  // Build user context for better extraction
  const userContextPrompt = userContext.name
    ? `\nUser context: ${userContext.name}${userContext.lifeSeason ? ` - ${userContext.lifeSeason}` : ''}`
    : '';

  const prompt = `${EXTRACTION_SYSTEM_PROMPT}

${knownContext}${userContextPrompt}

Note to analyze: "${text}"

Return JSON:
{
  "memories": [
    {
      "name": "entity or fact name",
      "memory_type": "entity|fact|preference|event|goal|procedure|decision|action",
      "content": "the extracted information in clear language",
      "entity_type": "person|project|place|pet|organization|concept|other",
      "relationship": "relationship to user if person (friend, coworker, family, etc.)",
      "sentiment": -1.0 to 1.0 (negative to positive),
      "importance": "critical|high|medium|low|trivial",
      "is_historical": false,
      "effective_from": null or "ISO date string",
      "expires_at": null or "ISO date string",
      "recurrence_pattern": null or {"type": "daily|weekly|monthly|yearly", "day"?: "string", "time"?: "HH:MM", "month"?: number},
      "sensitivity_level": "normal|sensitive|private",
      "confidence": 0.0 to 1.0
    }
  ],
  "relationships": [
    {
      "subject": "entity name",
      "predicate": "works_at|knows|reports_to|lives_in|partner_of|friends_with|manages|left|joined|owns|created|colleague_of|married_to|related_to",
      "object": "entity name or value",
      "role": "optional role/title if mentioned",
      "strength": 0.0 to 1.0
    }
  ],
  "changes_detected": [
    {
      "entity": "entity name",
      "change_type": "job|location|relationship|status|preference|goal|name_correction",
      "old_value": "previous value if known from context",
      "new_value": "new value",
      "is_correction": false
    }
  ],
  "decisions": [
    {
      "decision": "what was decided",
      "context": "why/when",
      "alternatives_considered": ["option A", "option B"]
    }
  ],
  "actions": [
    {
      "action": "what was done",
      "outcome": "result if mentioned",
      "outcome_sentiment": -1.0 to 1.0 if outcome mentioned
    }
  ]
}

Rules:
- Only extract named entities (people, companies, places with proper names)
- Do not extract generic terms like "the meeting" or "my work"
- For people, include first names even without last names (e.g., "Sarah", "Marcus")
- Detect changes like "Sarah left Google" or "moved to Brooklyn"
- Detect temporal markers for future/past events
- Mark sensitive topics appropriately (health, death, finances)
- If unsure about a relationship, use "mentioned" as the predicate
- Empty arrays are fine if nothing is detected`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    // Parse JSON from response
    let result;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('[Extract API] Parse error:', parseErr.message);
      console.error('[Extract API] Raw content:', content.substring(0, 500));
      return res.status(200).json({
        memories: [],
        entities: [],
        relationships: [],
        changes_detected: [],
        decisions: [],
        actions: []
      });
    }

    // Normalize response - support both old and new format
    const memories = result.memories || [];

    // Convert memories to entities format for backward compatibility
    const entities = memories.map(m => ({
      name: m.name,
      type: m.entity_type || 'other',
      relationship: m.relationship || null,
      context: m.content,
      sentiment: typeof m.sentiment === 'number'
        ? (m.sentiment > 0.3 ? 'positive' : m.sentiment < -0.3 ? 'negative' : 'neutral')
        : 'neutral',
      sentiment_score: m.sentiment,
      importance: m.importance || 'medium',
      // New Mem0 fields
      memory_type: m.memory_type || 'entity',
      is_historical: m.is_historical || false,
      effective_from: m.effective_from || null,
      expires_at: m.expires_at || null,
      recurrence_pattern: m.recurrence_pattern || null,
      sensitivity_level: m.sensitivity_level || 'normal',
      confidence: m.confidence || 0.8
    }));

    // Ensure all arrays exist
    const relationships = result.relationships || [];
    const changes_detected = result.changes_detected || [];
    const decisions = result.decisions || [];
    const actions = result.actions || [];

    console.log('[Extract API] Extracted:', {
      memories: memories.length,
      entities: entities.length,
      relationships: relationships.length,
      changes: changes_detected.length,
      decisions: decisions.length,
      actions: actions.length
    });

    return res.status(200).json({
      // New format
      memories,
      decisions,
      actions,
      // Backward compatible format
      entities,
      relationships,
      changes_detected
    });

  } catch (err) {
    console.error('[Extract API] Error:', err);
    return res.status(500).json({ error: 'Extraction failed', details: err.message });
  }
}
