/**
 * /api/analyze - Phase 5E: 3-Stage Processing Pipeline
 * STAGE 1: Clean transcript (dedicated)
 * STAGE 2: Classify (work / personal_task / personal_reflection)
 * STAGE 3: Analyze with appropriate prompt
 * Returns: cleaned, core, entities, actions, decision
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for fetching user context
// Try both common env variable naming conventions
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('[Analyze] Supabase client initialized');
} else {
  console.warn('[Analyze] Supabase not initialized - missing URL:', !!supabaseUrl, 'KEY:', !!supabaseServiceKey);
}

/**
 * Phase 11: Fetch user's onboarding data for personalization
 * This is CRITICAL for the core value prop - the AI must know who the user is
 */
async function getUserOnboardingContext(userId) {
  if (!supabase || !userId) {
    console.log('[Analyze] No supabase or userId - skipping onboarding context');
    return null;
  }

  try {
    const { data: onboarding, error } = await supabase
      .from('onboarding_data')
      .select('name, life_seasons, mental_focus, depth_question, depth_answer, seeded_people')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('[Analyze] Error fetching onboarding data:', error.message);
      return null;
    }

    console.log('[Analyze] Fetched onboarding data for user:', onboarding?.name || 'unknown');
    return onboarding;
  } catch (err) {
    console.error('[Analyze] Exception fetching onboarding:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// MEM0 BUILD 7: INTELLIGENT MEMORY INTEGRATION
// Enhanced extraction + UPDATE PHASE (ADD/UPDATE/DELETE/NOOP)
// ═══════════════════════════════════════════════════════════

/**
 * Generate embedding using OpenAI text-embedding-3-small
 * @param {string} text - Text to embed
 * @returns {number[]|null} 1536-dimension embedding vector or null on error
 */
async function generateEmbedding(text) {
  if (!text || !process.env.OPENAI_API_KEY) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000)
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error('[Analyze] Embedding error:', err.message);
    return null;
  }
}

/**
 * Enhanced memory extraction with Mem0 memory types
 * @param {string} text - Note content
 * @param {Anthropic} client - Anthropic client instance
 * @param {Array} knownEntities - Known entities for context
 * @returns {Object} Extracted memories, relationships, changes
 */
async function extractEnhancedMemories(text, client, knownEntities = []) {
  const knownContext = knownEntities.length > 0
    ? `\nKnown entities: ${knownEntities.map(e => typeof e === 'string' ? e : e.name).slice(0, 20).join(', ')}`
    : '';

  const prompt = `You are a Personal Information Organizer extracting memories from notes.

Extract CRUCIAL, NEW, ACTIONABLE information for memory storage.

## MEMORY TYPE CLASSIFICATION
| Type | Use When | Examples |
|------|----------|----------|
| entity | A person, place, project, pet, or thing | "Marcus", "Anthropic", "Project Alpha" |
| fact | Objective information about an entity | "Marcus works at Notion", "based in SF" |
| preference | A like, dislike, or preference | "Prefers async communication", "Hates meetings" |
| event | Something with a specific time/date | "Wedding on June 15", "standup every Monday" |
| goal | An objective or desired outcome | "Wants to ship by March", "Aiming for 10k users" |
| procedure | Step-by-step knowledge | "Deploy process: commit, push, verify" |
| decision | A decision made | "Decided to take the job", "Chose React" |
| action | An action completed | "Shipped the feature", "Left Google" |

## TEMPORAL DETECTION
- **is_historical** = true: "used to", "previously", "no longer", "left", past tense changes
- **recurrence_pattern**: "every Monday" → {"type": "weekly", "day": "Monday"}
- **effective_from**: "starting next month" → future date
- **expires_at**: "until Friday" → end date

## SENSITIVITY DETECTION
- "sensitive": health, medical, death, grief, mental health, therapy
- "private": financial, salary (rarely store)
- "normal": everything else

${knownContext}

Note to analyze: "${text}"

Return JSON only (no markdown):
{
  "memories": [
    {
      "name": "entity or fact name",
      "memory_type": "entity|fact|preference|event|goal|procedure|decision|action",
      "content": "the extracted information",
      "entity_type": "person|project|place|pet|organization|concept|other",
      "importance": "critical|high|medium|low|trivial",
      "is_historical": false,
      "recurrence_pattern": null,
      "sensitivity_level": "normal|sensitive|private",
      "sentiment": 0.0,
      "confidence": 0.8
    }
  ]
}

Sentiment guidelines:
- Range: -1.0 (very negative) to 1.0 (very positive)
- 0.0 = neutral/factual
- Examples: "lost job" = -0.8, "got promoted" = 0.8, "meeting scheduled" = 0.0

Rules:
- Extract named entities (people, companies, places with proper names)
- Detect temporal markers and recurrence patterns
- Mark sensitive topics appropriately
- Empty array is fine if nothing is extracted`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);

    console.log('[Analyze] Mem0 - Extracted', result.memories?.length || 0, 'memories');
    return result;
  } catch (err) {
    console.error('[Analyze] Mem0 extraction error:', err.message);
    return { memories: [] };
  }
}

/**
 * Mem0 UPDATE PHASE - LLM decides ADD/UPDATE/DELETE/NOOP
 * @param {Object} fact - Candidate fact to process
 * @param {Array} similarMemories - Similar existing memories
 * @param {Anthropic} client - Anthropic client instance
 * @returns {Object} Decision with operation and reasoning
 */
async function runUpdatePhase(fact, similarMemories, client) {
  const TOOLS = [
    {
      name: "add_memory",
      description: "Add a new memory when no semantically equivalent memory exists",
      input_schema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Memory content to store" },
          memory_type: { type: "string", enum: ["entity", "fact", "preference", "event", "goal", "procedure", "decision", "action"] },
          reasoning: { type: "string", description: "Why this is a new memory worth storing" }
        },
        required: ["content", "memory_type", "reasoning"]
      }
    },
    {
      name: "update_memory",
      description: "Update an existing memory with new or corrected information",
      input_schema: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "UUID of memory to update" },
          new_content: { type: "string", description: "Updated memory content" },
          merge_strategy: { type: "string", enum: ["replace", "append", "supersede"] },
          reasoning: { type: "string", description: "Why and what changed" }
        },
        required: ["memory_id", "new_content", "merge_strategy", "reasoning"]
      }
    },
    {
      name: "delete_memory",
      description: "Delete a memory contradicted by new info or user request",
      input_schema: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "UUID to delete" },
          hard_delete: { type: "boolean", description: "True only for explicit user deletion requests" },
          reasoning: { type: "string", description: "Why delete" }
        },
        required: ["memory_id", "hard_delete", "reasoning"]
      }
    },
    {
      name: "no_operation",
      description: "No change - info already exists, is trivial, or conversational noise",
      input_schema: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Why no operation needed" },
          existing_memory_id: { type: "string", description: "ID if info already exists" }
        },
        required: ["reasoning"]
      }
    }
  ];

  let prompt = `## NEW INFORMATION TO PROCESS
**Content**: "${fact.content || fact.name}"
**Type**: ${fact.memory_type || 'unknown'}
**Importance**: ${fact.importance || 'medium'}
${fact.is_historical ? '**Historical**: Yes\n' : ''}
${fact.recurrence_pattern ? `**Recurrence**: ${JSON.stringify(fact.recurrence_pattern)}\n` : ''}

## EXISTING SIMILAR MEMORIES
`;

  if (similarMemories && similarMemories.length > 0) {
    similarMemories.forEach((mem, i) => {
      prompt += `### Memory ${i + 1}
- **ID**: ${mem.id}
- **Content**: "${mem.summary || mem.name}"
- **Similarity**: ${((mem.similarity || 0) * 100).toFixed(1)}%
`;
    });
  } else {
    prompt += `No similar existing memories found.\n`;
  }

  prompt += `\nDecide: add_memory, update_memory, delete_memory, or no_operation. Call exactly ONE tool.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a memory manager deciding how to handle new information.
- ADD: No similar memory exists and info is worth storing
- UPDATE: Similar memory exists and needs updating (replace/append/supersede)
- DELETE: Info contradicts existing memory
- NOOP: Info already exists or is trivial`,
      tools: TOOLS,
      messages: [{ role: 'user', content: prompt }]
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (!toolUse) {
      return { operation: 'NOOP', reasoning: 'No tool called' };
    }

    return {
      operation: toolUse.name.replace('_memory', '').toUpperCase().replace('NO_OPERATION', 'NOOP'),
      input: toolUse.input,
      reasoning: toolUse.input.reasoning
    };
  } catch (err) {
    console.error('[Analyze] Mem0 UPDATE PHASE error:', err.message);
    return { operation: 'NOOP', reasoning: 'Error in UPDATE PHASE' };
  }
}

/**
 * Execute Mem0 memory operation (ADD/UPDATE/DELETE)
 */
async function executeMemoryOperation(supabaseClient, userId, operation, input, fact, sourceNoteId) {
  console.log('[Analyze] executeMemoryOperation called:', { operation, userId: !!userId, supabaseClient: !!supabaseClient });

  if (!supabaseClient || !userId) {
    console.log('[Analyze] executeMemoryOperation: missing supabaseClient or userId');
    return { skipped: true, reason: `missing: supabaseClient=${!!supabaseClient}, userId=${!!userId}` };
  }

  const startTime = Date.now();

  try {
    if (operation === 'ADD') {
      // Generate embedding for the new memory
      const embedding = await generateEmbedding(input.content || fact.content || fact.name);
      console.log('[Analyze] Mem0 ADD - embedding generated:', !!embedding);

      // Map entity_type to valid database values: person, project, place, pet, organization, concept
      const validEntityTypes = ['person', 'project', 'place', 'pet', 'organization', 'concept'];
      const entityType = validEntityTypes.includes(fact.entity_type) ? fact.entity_type : 'concept';

      const insertData = {
        user_id: userId,
        name: fact.name || input.content?.slice(0, 100) || 'Memory',
        entity_type: entityType,
        memory_type: input.memory_type || fact.memory_type || 'fact',
        summary: input.content || fact.content,
        importance: fact.importance || 'medium',
        importance_score: { critical: 1.0, high: 0.8, medium: 0.5, low: 0.3, trivial: 0.1 }[fact.importance] || 0.5,
        is_historical: fact.is_historical || false,
        recurrence_pattern: fact.recurrence_pattern || null,
        sensitivity_level: fact.sensitivity_level || 'normal',
        sentiment_average: fact.sentiment ?? 0.0,
        embedding: embedding,
        status: 'active',
        version: 1,
        mention_count: 1,
        first_mentioned_at: new Date().toISOString(),
        last_mentioned_at: new Date().toISOString()
      };

      console.log('[Analyze] Mem0 ADD - inserting:', insertData.name);
      const { data, error } = await supabaseClient
        .from('user_entities')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[Analyze] Mem0 ADD - insert error:', error.message, error.code, error.details);
        throw error;
      }

      // Log to audit trail
      await logMemoryOperation(supabaseClient, userId, 'ADD', fact, input, data.id, sourceNoteId, Date.now() - startTime);

      console.log('[Analyze] Mem0 ADD:', input.content?.slice(0, 50) || fact.name);
      return { operation: 'ADD', entity_id: data.id };

    } else if (operation === 'UPDATE') {
      const { memory_id, new_content, merge_strategy } = input;

      // Fetch existing
      const { data: existing } = await supabaseClient
        .from('user_entities')
        .select('*')
        .eq('id', memory_id)
        .single();

      if (!existing) return null;

      const oldVersion = existing.version || 1;
      const newEmbedding = await generateEmbedding(new_content);

      if (merge_strategy === 'supersede') {
        // Mark old as historical, create new
        await supabaseClient
          .from('user_entities')
          .update({ is_historical: true, status: 'superseded' })
          .eq('id', memory_id);

        // Compute updated sentiment average (exponential moving average)
        const oldSentiment = existing.sentiment_average ?? 0;
        const newSentiment = fact.sentiment ?? 0;
        const updatedSentiment = oldSentiment * 0.7 + newSentiment * 0.3;

        const { data: newEntity } = await supabaseClient
          .from('user_entities')
          .insert({
            ...existing,
            id: undefined,
            summary: new_content,
            embedding: newEmbedding,
            sentiment_average: updatedSentiment,
            is_historical: false,
            status: 'active',
            version: oldVersion + 1,
            supersedes_id: memory_id
          })
          .select()
          .single();

        await logMemoryOperation(supabaseClient, userId, 'UPDATE', fact, input, newEntity.id, sourceNoteId, Date.now() - startTime, { strategy: 'supersede', old_id: memory_id });
        return { operation: 'UPDATE', strategy: 'supersede', new_id: newEntity.id };

      } else {
        // Replace or append
        const finalContent = merge_strategy === 'append'
          ? `${existing.summary}. ${new_content}`
          : new_content;

        // Update sentiment average with exponential moving average
        const oldSentiment = existing.sentiment_average ?? 0;
        const newSentiment = fact.sentiment ?? 0;
        const updatedSentiment = oldSentiment * 0.7 + newSentiment * 0.3;

        await supabaseClient
          .from('user_entities')
          .update({
            summary: finalContent,
            embedding: newEmbedding,
            sentiment_average: updatedSentiment,
            version: oldVersion + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', memory_id);

        await logMemoryOperation(supabaseClient, userId, 'UPDATE', fact, input, memory_id, sourceNoteId, Date.now() - startTime, { strategy: merge_strategy });
        return { operation: 'UPDATE', strategy: merge_strategy, entity_id: memory_id };
      }

    } else if (operation === 'DELETE') {
      const { memory_id, hard_delete } = input;

      if (hard_delete) {
        await supabaseClient.from('user_entities').delete().eq('id', memory_id);
      } else {
        await supabaseClient.from('user_entities').update({ status: 'archived' }).eq('id', memory_id);
      }

      await logMemoryOperation(supabaseClient, userId, 'DELETE', fact, input, memory_id, sourceNoteId, Date.now() - startTime, { hard_delete });
      return { operation: 'DELETE', entity_id: memory_id };
    }

    return null;
  } catch (err) {
    console.error('[Analyze] Mem0 execute error:', err.message);
    // Re-throw so caller can capture the error
    throw err;
  }
}

/**
 * Log memory operation to audit trail
 */
async function logMemoryOperation(supabaseClient, userId, operation, fact, input, entityId, sourceNoteId, processingTime, extra = {}) {
  try {
    await supabaseClient.from('memory_operations').insert({
      user_id: userId,
      operation,
      candidate_fact: fact.content || fact.name,
      candidate_memory_type: fact.memory_type,
      llm_reasoning: input.reasoning,
      entity_id: entityId,
      merge_strategy: extra.strategy,
      source_note_id: sourceNoteId,
      processing_time_ms: processingTime
    });
  } catch (err) {
    console.warn('[Analyze] Mem0 audit log error:', err.message);
  }
}

/**
 * Run full Mem0 pipeline: Extract → Find Similar → UPDATE PHASE → Execute
 */
async function runMem0Pipeline(noteContent, userId, client, supabaseClient, knownEntities = [], sourceNoteId = null) {
  if (!userId || !supabaseClient) {
    console.log('[Analyze] Mem0 - Skipping (no userId or supabase)');
    return { processed: 0, results: [] };
  }

  console.log('[Analyze] Mem0 - Starting enhanced memory pipeline');
  const results = [];

  try {
    // Step 1: Enhanced extraction
    const extraction = await extractEnhancedMemories(noteContent, client, knownEntities);
    const memories = extraction.memories || [];

    if (memories.length === 0) {
      console.log('[Analyze] Mem0 - No memories extracted');
      return { processed: 0, results: [] };
    }

    // Step 2: Process each memory through UPDATE PHASE
    for (const fact of memories) {
      try {
        // Generate embedding for similarity search
        const factContent = fact.content || fact.name;
        const embedding = await generateEmbedding(factContent);

        // Find similar memories
        let similarMemories = [];
        if (embedding) {
          const { data } = await supabaseClient.rpc('match_entities', {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: 5,
            p_user_id: userId
          });
          similarMemories = data || [];
        }

        // Run UPDATE PHASE
        const decision = await runUpdatePhase(fact, similarMemories, client);
        console.log('[Analyze] Mem0 decision for', fact.name, ':', decision.operation);

        // Execute the operation
        if (decision.operation !== 'NOOP') {
          try {
            const execResult = await executeMemoryOperation(
              supabaseClient, userId, decision.operation, decision.input, fact, sourceNoteId
            );
            results.push({ fact: fact.name, operation: decision.operation, executed: !!execResult });
          } catch (execErr) {
            console.error('[Analyze] Mem0 exec error:', execErr.message);
            results.push({ fact: fact.name, operation: decision.operation, executed: false });
          }
        } else {
          results.push({ fact: fact.name, ...decision, executed: false });
          // Log NOOP to audit trail
          await logMemoryOperation(supabaseClient, userId, 'NOOP', fact, { reasoning: decision.reasoning }, null, sourceNoteId, 0);
        }

      } catch (factErr) {
        console.error('[Analyze] Mem0 fact processing error:', factErr.message);
        results.push({ fact: fact.name, operation: 'ERROR', error: factErr.message });
      }
    }

    console.log('[Analyze] Mem0 - Processed', results.length, 'memories');
    return { processed: results.length, results };

  } catch (err) {
    console.error('[Analyze] Mem0 pipeline error:', err.message);
    return { processed: 0, results: [], error: err.message };
  }
}

/**
 * Phase 11: Build personalization context string from onboarding data
 * This gets injected into the Claude prompt so the AI knows the user
 */
function buildOnboardingContextPrompt(onboarding) {
  if (!onboarding) return '';

  let context = `<user_context>\n`;

  // User's name - CRITICAL for personalization
  if (onboarding.name) {
    context += `User's name: ${onboarding.name}\n`;
  }

  // Life season - what phase they're in
  if (onboarding.life_seasons?.length > 0) {
    context += `Life season: ${onboarding.life_seasons.join(', ')}\n`;
  }

  // What's weighing on them
  if (onboarding.mental_focus?.length > 0) {
    context += `Currently focused on: ${onboarding.mental_focus.join(', ')}\n`;
  }

  // Their depth answer - important personal context
  if (onboarding.depth_answer) {
    context += `Shared context: "${onboarding.depth_answer}"\n`;
  }

  // Known people from onboarding - CRITICAL for entity recognition
  if (onboarding.seeded_people?.length > 0) {
    context += `\nPeople in their world:\n`;
    onboarding.seeded_people.forEach(person => {
      const relationship = person.context || person.relationship || '';
      context += `- ${person.name}${relationship ? ` (${relationship})` : ''}\n`;
    });
  }

  context += `</user_context>`;
  return context;
}

// Visual entity extraction instruction (added to prompt when image present)
// CRITICAL LANGUAGE RULE - Enforces second-person language in all outputs
const CRITICAL_LANGUAGE_RULE = `
## CRITICAL LANGUAGE RULE — READ THIS FIRST

You ARE the user's digital twin. You KNOW them personally.

ALL output text MUST use SECOND-PERSON language. This is non-negotiable.

ALWAYS USE:
- "you" and "your" (e.g., "your dog Seri", "your meeting", "your co-founder")
- "you mentioned", "you need to", "you shared"
- "you're", "you've", "you'll"
- If the user shares their name, use it naturally: "You introduced yourself, Elroy"

NEVER USE (BANNED PATTERNS):
- "the user" or "the user's"
- "they", "them", "their" (when referring to the note author)
- "one's" or "one"
- "someone named [Name]" — NEVER use this pattern
- "Brief introduction from someone..." — NEVER start titles this way
- "Introduction from [Name]" — NEVER use this pattern
- "[Name] mentioned..." — NEVER start with third-person name references
- "A person named..." — NEVER use this pattern
- "Captured for future reference" — NEVER use this phrase
- "User has..." — NEVER start with this
- "The individual..." — NEVER use this
- "This person..." — NEVER use this
- Any title or summary that treats the note author as a third party

FORBIDDEN PHRASES (never use these):
- "Captured for future reference"
- "Noted for later"
- "This has been recorded"
- "Entry logged"
- "Worth tracking"
- "Good to document"
- "Interesting thought"
- "Worth considering"
- "Important to remember"
- Any language that sounds like a database, not a friend

EXAMPLES:
❌ WRONG: "Brief introduction from someone named Elroy"
✅ RIGHT: "First Hello" or "Meeting Your Twin" or "Your Introduction"

❌ WRONG: "Introduction from Elroy"
✅ RIGHT: "You introduced yourself, Elroy"

❌ WRONG: "Someone named Sarah wants to..."
✅ RIGHT: "You mentioned wanting to..."

❌ WRONG: "The user's French Bulldog needs a vet appointment"
✅ RIGHT: "Your French Bulldog needs a vet appointment"

❌ WRONG: "The user mentioned they want to call their mom"
✅ RIGHT: "You mentioned you want to call your mom"

❌ WRONG: "Captured for future reference"
✅ RIGHT: (Don't say anything like this. Just provide the insight.)

## IMPORTANT: ENTITY POSSESSIVE PRESERVATION

When eliminating third-person language, only change references to the USER themselves.
Keep entity names and their possessives unchanged.

EXAMPLES:
- "Sarah's dog" stays "Sarah's dog" (Sarah's possession, not the user's)
- "John's project" stays "John's project" (John's possession, not the user's)
- "The user's meeting" becomes "your meeting" (the user's possession)
- "Their dog Seri" becomes "your dog Seri" (the user's possession)

This rule applies to: title, summary, actions, core.intent, and ALL text output.
`;

// Phase 10.1: Build pattern awareness prompt for frequently mentioned entities
function buildPatternAwarenessPrompt(entities) {
  if (!entities || entities.length === 0) return '';

  // Find frequently mentioned entities (3+ mentions)
  const frequent = entities.filter(e => (e.mention_count || e.mentionCount || 1) >= 3);

  if (frequent.length === 0) return '';

  return `
<pattern_awareness>
IMPORTANT: The user has mentioned these people/things multiple times. Acknowledge patterns naturally.

${frequent.map(e => `- ${e.name}: mentioned ${e.mention_count || e.mentionCount} times
  Recent context: ${Array.isArray(e.context_notes) ? e.context_notes.slice(-2).join(' | ') : e.context || 'N/A'}`).join('\n')}

When responding:
- If relevant, acknowledge you've noticed this person/topic comes up often
- Reference previous context naturally: "Last time you mentioned [name], you said..."
- For 3+ mentions: "You've been thinking about [name] a lot lately"
- For 5+ mentions: "[name] seems important to you - they keep coming up"
- Don't be creepy. Be a thoughtful friend who remembers.
</pattern_awareness>
`;
}

// ═══════════════════════════════════════════
// PHASE 10.2: Proactive Relevance Functions
// ═══════════════════════════════════════════

/**
 * Build relationship context for known entities
 * @param {Array} relationships - Array of entity relationships
 * @param {Array} entities - Known entities
 * @returns {string} Formatted relationship context for prompt
 */
function buildRelationshipContext(relationships, entities) {
  if (!relationships || relationships.length === 0) return '';

  const relationshipLines = relationships.map(r => {
    const subjectEntity = entities?.find(e =>
      e.name?.toLowerCase() === r.subject_name?.toLowerCase()
    );
    const objectEntity = entities?.find(e =>
      e.name?.toLowerCase() === r.object_name?.toLowerCase()
    );

    // Format: "Sarah works_at Stripe (high confidence)"
    const confidence = r.confidence >= 0.8 ? 'high' : r.confidence >= 0.5 ? 'medium' : 'low';
    return `  - ${r.subject_name} ${r.predicate.replace(/_/g, ' ')} ${r.object_name} (${confidence} confidence)`;
  }).join('\n');

  return `
<relationship_graph>
KNOWN RELATIONSHIPS between entities in your world:
${relationshipLines}

USE these relationships when responding:
- If discussing Sarah and you know "Sarah works_at Stripe", reference it naturally
- Update superseded relationships if new info contradicts (e.g., "Sarah left Stripe" → mark old as superseded)
- Suggest connections: "This reminds me - didn't Sarah work with John at Stripe?"
</relationship_graph>
`;
}

/**
 * Build proactive context by surfacing related entities by topic
 * @param {string} noteText - The note text being analyzed
 * @param {Array} entities - All known entities with topics
 * @returns {string} Proactive context section for prompt
 */
function buildProactiveContext(noteText, entities) {
  if (!noteText || !entities || entities.length === 0) return '';

  // Extract topics from current note
  const noteTopics = extractTopicsFromText(noteText);
  if (noteTopics.length === 0) return '';

  // Find entities with overlapping topics
  const relatedEntities = [];
  for (const entity of entities) {
    if (!entity.topics || entity.topics.length === 0) continue;

    const overlappingTopics = entity.topics.filter(t => noteTopics.includes(t));
    if (overlappingTopics.length > 0) {
      relatedEntities.push({
        name: entity.name,
        type: entity.entity_type,
        topics: overlappingTopics,
        summary: entity.summary
      });
    }
  }

  if (relatedEntities.length === 0) return '';

  const relatedLines = relatedEntities.slice(0, 5).map(e => {
    const topicStr = e.topics.join(', ');
    return `  - ${e.name} (${e.type}): also tagged with [${topicStr}]${e.summary ? ` - ${e.summary.substring(0, 80)}` : ''}`;
  }).join('\n');

  return `
<proactive_connections>
RELATED ENTITIES you might want to mention:
${relatedLines}

Based on the topics in this note, these people/things might be relevant.
If naturally fitting, suggest connections:
- "This reminds me - you've mentioned [name] before in similar contexts"
- "Have you considered involving [name]? They're connected to this topic."
Don't force it. Only mention if genuinely relevant.
</proactive_connections>
`;
}

/**
 * Extract topics from note text (simple keyword matching)
 * @param {string} text - Note text
 * @returns {Array} Extracted topics
 */
function extractTopicsFromText(text) {
  if (!text) return [];

  const topicKeywords = {
    'startup': ['startup', 'founder', 'founding', 'venture', 'seed', 'series', 'pitch'],
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'gpt', 'claude'],
    'engineering': ['code', 'coding', 'engineering', 'developer', 'software', 'tech', 'programming', 'bug'],
    'design': ['design', 'designer', 'ui', 'ux', 'user experience', 'figma', 'mockup'],
    'business': ['business', 'revenue', 'growth', 'strategy', 'market', 'sales'],
    'product': ['product', 'feature', 'roadmap', 'launch', 'release', 'ship'],
    'investment': ['investor', 'investment', 'funding', 'raise', 'valuation', 'deck'],
    'health': ['health', 'fitness', 'workout', 'diet', 'wellness', 'doctor'],
    'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'airport'],
    'family': ['family', 'kids', 'children', 'parents', 'wife', 'husband', 'mom', 'dad'],
    'work': ['work', 'job', 'office', 'meeting', 'project', 'deadline', 'client']
  };

  const textLower = text.toLowerCase();
  const foundTopics = [];

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      foundTopics.push(topic);
    }
  }

  return foundTopics;
}

const VISUAL_ENTITY_INSTRUCTION = `
If this note contains an image with visible people, pets, or identifiable places/objects, extract visual descriptions.

## RELATIONSHIP EXTRACTION (CRITICAL)
When the user uses possessive language like "my dog", "my mom", "my co-founder", ALWAYS capture this relationship.
This is how we remember relationships between the user and their entities.

Examples of possessive patterns to capture:
- "my dog Seri" → relationship_to_user: "my dog"
- "my co-founder John" → relationship_to_user: "my co-founder"
- "my sister Sarah" → relationship_to_user: "my sister"
- "my car" → relationship_to_user: "my car"
- "my house" → relationship_to_user: "my house"

Return visual descriptions in this XML format at the END of your JSON response (outside the JSON block):

<visual_entities>
  <entity name="[Name]" type="[person|pet|place|object]" visual="[Brief visual description]" relationship="[possessive phrase from user's input, e.g. 'my dog']"/>
</visual_entities>

Examples:
<visual_entities>
  <entity name="Seri" type="pet" visual="Golden retriever with fluffy fur, wearing a red collar" relationship="my dog"/>
  <entity name="Sarah" type="person" visual="Woman with shoulder-length dark hair, wearing glasses" relationship="my sister"/>
  <entity name="Home Office" type="place" visual="Desk with dual monitors, plants on windowsill" relationship="my office"/>
</visual_entities>

RULES:
- Only include entities that are clearly visible in the image
- Keep descriptions concise (under 20 words each)
- For people: describe clothing, accessories, context - NOT physical judgments
- Use names mentioned in the note text to identify entities
- ALWAYS capture the possessive phrase (my dog, my mom, etc.) in the relationship attribute
- If user uses first-person language (I, me, my) with an image of a person, that's likely the user - do NOT extract as unknown person
`;

// ═══════════════════════════════════════════
// PHASE 8.7: ANALYSIS VALIDATION SYSTEM
// Prevents garbage output from reaching users
// ═══════════════════════════════════════════

const VALIDATION_BANNED_PHRASES = [
  // Insight bans
  'captured for future reference',
  'noted for later',
  'saved for later',
  'will remember this',
  'recorded for reference',
  'logged for future',
  'stored for reference',
  'worth tracking',
  'worth considering',
  'worth thinking about',
  'interesting thought',
  'good to track',
  'good to document',
  'important to remember',
  'these insights compound',
  'this is valuable',
  'good to recognize',
  'reflection noted',
  // Summary bans (third-person)
  'user has',
  'user is',
  'the user',
  'user wants',
  'user needs',
  'user shared',
  'user mentioned',
  'user expressed',
  'the individual',
  'this person',
  'someone named',
  // Generic title bans
  'brief introduction from'
];

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
}

/**
 * Validate analysis output - Phase 8.7
 */
function validateAnalysisOutput(input, analysis) {
  const issues = [];
  const summary = analysis.summary || analysis.insight || analysis.whatThisReveals || '';
  const insight = analysis.insight || analysis.whatThisReveals || '';
  const title = analysis.title || '';

  // Check summary doesn't echo input (>70% similarity = fail)
  if (summary) {
    const similarity = calculateSimilarity(input, summary);
    if (similarity > 0.7) {
      issues.push(`Summary echoes input (${Math.round(similarity * 100)}% similar)`);
    }
  }

  // Check for banned phrases
  const lowerSummary = summary.toLowerCase();
  const lowerInsight = insight.toLowerCase();
  const lowerTitle = title.toLowerCase();

  for (const phrase of VALIDATION_BANNED_PHRASES) {
    if (lowerSummary.includes(phrase)) issues.push('Summary contains banned phrase: ' + phrase);
    if (lowerInsight.includes(phrase)) issues.push('Insight contains banned phrase: ' + phrase);
    if (lowerTitle.includes(phrase)) issues.push('Title contains banned phrase: ' + phrase);
  }

  // Check insight isn't too short
  if (insight && insight.length < 20 && insight.length > 0) {
    issues.push('Insight too short');
  }

  // Check summary uses "you" language
  if (summary && summary.length > 30) {
    if (!lowerSummary.includes('you') && !lowerSummary.includes("you're") && !lowerSummary.includes("your")) {
      issues.push('Summary missing "you" language');
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Generate fallback when validation fails - Phase 8.7
 */
function generateValidationFallback(input, category) {
  const lower = input.toLowerCase();

  // Generate evocative title
  let title = 'A Moment';
  if (lower.includes('content') || lower.includes('engagement') || lower.includes('audience')) title = 'Growing Your Reach';
  else if (lower.includes('work') || lower.includes('job') || lower.includes('career')) title = 'Work Thoughts';
  else if (lower.includes('love') || lower.includes('feel')) title = 'On Your Heart';
  else if (lower.includes('idea') || lower.includes('thinking')) title = 'A Thought';
  else if (lower.includes('?')) title = 'A Question';

  // Generate category-appropriate summary
  const summaries = {
    'work': "You're working through something important.",
    'personal_task': "You have something to take care of.",
    'personal_reflection': "You opened up about something meaningful.",
    'personal': "You shared something personal.",
    'default': "You shared a thought."
  };

  const insights = {
    'work': "What's the next step you're considering?",
    'personal_task': "What would help you move forward?",
    'personal_reflection': "Your Twin is listening.",
    'personal': "Your Twin is here, no judgment.",
    'default': "Sometimes it helps just to say it out loud."
  };

  return {
    title,
    summary: summaries[category] || summaries['default'],
    insight: insights[category] || insights['default']
  };
}

// ═══════════════════════════════════════════
// PHASE 8.8: TIERED RESPONSE SYSTEM
// Proportional depth based on input analysis
// ═══════════════════════════════════════════

// Emotional markers indicating deeper processing needed
const EMOTIONAL_MARKERS = /\b(feel|feeling|felt|scared|afraid|angry|furious|sad|depressed|hurt|love|hate|can't|cannot|won't|overwhelmed|exhausted|anxious|worried|confused|lost|stuck|hopeless|excited|thrilled|devastated|heartbroken|terrified)\b/i;

// Relational stakes that warrant deeper engagement
const STAKES_MARKERS = /\b(cofounder|co-founder|partner|marriage|married|wife|husband|boyfriend|girlfriend|friend|friendship|mom|mother|dad|father|parent|boss|manager|team|employee|relationship|divorce|breakup|fired|quit|pregnant|baby|death|died|cancer|sick|illness)\b/i;

// Urgency/avoidance signals
const URGENCY_MARKERS = /\b(can't stop|keep putting|keep avoiding|stuck on|don't know how|need to|have to|must|scared to|afraid to|avoiding|procrastinating|running out of time|deadline|urgent)\b/i;

// Explicit help requests - expanded to catch more seeking-help patterns
const HELP_REQUEST_MARKERS = /\b(how do i|how can i|what should|should i|any ideas|help me|where do i start|what do you think|advice|suggest|recommend|trying to figure|not sure|figure out how|wondering how|struggling with|need guidance|where to start|don't know where|don't know how)\b/i;

/**
 * Phase 8.8: Detect response tier based on input
 */
function detectTier(input) {
  const text = (input || '').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const signals = [];

  const hasEmotion = EMOTIONAL_MARKERS.test(text);
  if (hasEmotion) signals.push('emotional_content');

  const hasStakes = STAKES_MARKERS.test(text);
  if (hasStakes) signals.push('relational_stakes');

  const hasUrgency = URGENCY_MARKERS.test(text);
  if (hasUrgency) signals.push('urgency_avoidance');

  const hasHelpRequest = HELP_REQUEST_MARKERS.test(text);
  if (hasHelpRequest) signals.push('help_request');

  const punctuationMatches = text.match(/!{2,}|\.{3,}/g) || [];
  const hasPunctuationIntensity = punctuationMatches.length >= 2;
  if (hasPunctuationIntensity) signals.push('punctuation_intensity');

  const isEmotionallyLoaded = hasEmotion || hasStakes || hasUrgency || hasPunctuationIntensity;
  const isHighLoad = (hasEmotion && hasStakes) || (hasUrgency && hasStakes) || wordCount > 100;

  let tier;
  if (isHighLoad) {
    tier = 'deep';
  } else if (wordCount > 100) {
    tier = 'deep';
  } else if (isEmotionallyLoaded || hasHelpRequest || wordCount > 30) {
    tier = 'standard';
  } else {
    tier = 'quick';
  }

  return { tier, signals, wordCount };
}

/**
 * Phase 8.8: UNIFIED ANALYSIS PROMPT
 */
const UNIFIED_ANALYSIS_PROMPT = `You are Inscript—a perceptive, warm AI that helps the user understand themselves.

## CRITICAL RULES — VIOLATION CAUSES REJECTION

1. ALWAYS use "you/your" language. NEVER say "user", "they", "the person"
2. "heard" MUST quote the user's exact words
3. "noticed" MUST be NON-OBVIOUS insight, NOT a summary or restatement
4. "hidden_assumption" MUST use hypothesis language (might/could/wonder) AND end with "?"
5. Titles must be 2-4 evocative words. NEVER use: strategy, planning, development, assessment, management, analysis, optimization, framework, implementation

## PERSONALIZATION — USE THE USER CONTEXT

If you receive a <user_context> block, use it naturally:
- Use the user's NAME occasionally (not every response, but when it feels natural)
- When they mention someone from "People in their world", ACKNOWLEDGE THE RELATIONSHIP
  - Example: If Marcus is listed as "close friend", say "Marcus—your close friend" or "that's a lot to navigate with someone you're close to like Marcus"
- Connect to their LIFE SEASON when relevant
  - Example: If they're "Building something new", you might say "Building something new means these crossroads come with the territory"
- Don't force it—only use context when it genuinely adds depth
- NEVER say "based on my records" or "according to what you told me"—just KNOW it naturally, like a friend would

## RESPONSE FORMAT

You will receive a tier (quick/standard/deep). Return ONLY the JSON for that tier.

### QUICK TIER
{
  "tier": "quick",
  "title": "2-4 evocative words",
  "heard": "You're '[quote their exact words]'",
  "question": "Open-ended question that invites reflection",
  "invite": "Share more if you'd like me to dig deeper."
}

### STANDARD TIER
{
  "tier": "standard",
  "title": "2-4 evocative words",
  "heard": "You're '[quote their exact words]'—acknowledge the weight",
  "noticed": "I noticed [NON-OBVIOUS pattern/insight with evidence from their words]",
  "question": "Socratic question that creates pause",
  "experiment": "Specific 10-15 minute action tailored to their situation"
}

### DEEP TIER
{
  "tier": "deep",
  "title": "2-4 evocative words matching emotional weight",
  "heard": "You said '[quote key phrases]'—acknowledge the full weight",
  "noticed": "I noticed [pattern/tension with specific evidence from their words]",
  "hidden_assumption": "You might be assuming [hypothesis about unstated belief]. Is that what's underneath?",
  "question": "Deep Socratic question that creates real pause",
  "experiment": "Meaningful action specific to their situation"
}

## EXAMPLES

### QUICK EXAMPLE
Input: "Thinking about content today"
Tier: quick
{
  "tier": "quick",
  "title": "On Your Mind",
  "heard": "You're 'thinking about content today'",
  "question": "What's pulling at you about it?",
  "invite": "Share more if you'd like me to dig deeper."
}

### STANDARD EXAMPLE
Input: "I'm trying to figure out how to grow my audience. Not sure where to start."
Tier: standard
{
  "tier": "standard",
  "title": "Finding Your Voice",
  "heard": "You're 'trying to figure out' how to grow but 'not sure where to start'",
  "noticed": "The uncertainty might be the real thing here—tactics are everywhere, but knowing YOUR right path takes more than research.",
  "question": "What would success actually look like for you in 6 months?",
  "experiment": "List 3 creators you admire. What do they do that you don't yet?"
}

### DEEP EXAMPLE
Input: "I keep putting off the hard conversation with my cofounder. I know I need to have it but I just can't. Every time I think about it I feel this pit in my stomach."
Tier: deep
{
  "tier": "deep",
  "title": "The Conversation You're Circling",
  "heard": "You 'keep putting off' the conversation and feel 'this pit in your stomach' every time you think about it",
  "noticed": "The word 'can't'—not 'won't' or 'haven't'—suggests this feels impossible rather than just difficult.",
  "hidden_assumption": "You might be assuming that honesty and this relationship can't coexist. But avoiding it is also a choice with consequences. Is that what's underneath?",
  "question": "What's the cost of another month of carrying this?",
  "experiment": "Write the opening sentence you'd say. Just see how it feels to make it real."
}

## BANNED PATTERNS — WILL BE REJECTED

- "User is...", "User has...", "The user..." (use "You're", "You've")
- "Captured for future reference", "Noted for later"
- Titles with: strategy, planning, development, assessment, management
- "noticed" that just restates "heard" in different words
- Yes/no questions (use open-ended)
- Generic advice like "Research best practices" or "Think about..."

Return ONLY valid JSON. No markdown, no explanation.`;

/**
 * Phase 8.8: Build tier-aware user prompt for reflection analysis
 * Phase 9: Includes personalization context from user_profiles
 */
function buildTieredUserPrompt(input, tier, context = {}) {
  // Phase 9: Add personalization context if available
  const personalizationSection = context.personalizationContext
    ? `\n---\n${context.personalizationContext}\n---\n`
    : '';

  return `${personalizationSection}Tier: ${tier}

User input: "${input}"

Return JSON for ${tier} tier. Follow the format exactly.`;
}

/**
 * Phase 8.8: Validate tiered analysis output (server-side version)
 */
function validateTieredOutput(input, analysis, tier) {
  const issues = [];

  // Check heard exists and references input
  if (!analysis.heard || analysis.heard.length < 10) {
    issues.push('heard field missing or too short');
  } else {
    // Specificity check: heard should reference user's words
    const inputWords = (input || '').toLowerCase().split(/\s+/)
      .map(w => w.replace(/[^a-z]/g, ''))
      .filter(w => w.length >= 4);
    const heardLower = (analysis.heard || '').toLowerCase();
    const matchedWords = inputWords.filter(word => heardLower.includes(word));
    if (matchedWords.length < 2 && inputWords.length >= 2) {
      issues.push('heard does not reference user words');
    }
  }

  // Check for banned phrases
  const bannedCheck = (text) => {
    const lower = (text || '').toLowerCase();
    return VALIDATION_BANNED_PHRASES.some(phrase => lower.includes(phrase));
  };

  // Check for banned title words (corporate language ONLY - not content words)
  // Only ban true corporate jargon, NOT content words like "growth" or "audience"
  const BANNED_TITLE_WORDS = ['strategy', 'planning', 'development', 'assessment', 'management', 'analysis', 'optimization', 'framework', 'structure', 'implementation'];
  const titleLower = (analysis.title || '').toLowerCase();
  const hasBannedTitleWord = BANNED_TITLE_WORDS.some(word => titleLower.includes(word));
  if (hasBannedTitleWord) {
    issues.push('title contains corporate/banned word: ' + BANNED_TITLE_WORDS.filter(w => titleLower.includes(w)).join(', '));
  }

  if (bannedCheck(analysis.heard)) issues.push('heard contains banned phrase');
  if (bannedCheck(analysis.noticed)) issues.push('noticed contains banned phrase');
  if (bannedCheck(analysis.title)) issues.push('title contains banned phrase');

  // Check question is open-ended
  if (analysis.question) {
    const yesNoPattern = /^(do you|are you|is it|was it|did you|have you|can you|will you|would you)\b/i;
    if (yesNoPattern.test(analysis.question)) {
      issues.push('question should be open-ended, not yes/no');
    }
  }

  // Tier-specific validation
  if (tier === 'quick') {
    if (analysis.hidden_assumption) issues.push('quick tier should not have hidden_assumption');
    if (analysis.experiment) issues.push('quick tier should not have experiment');
    if (analysis.noticed) issues.push('quick tier should not have noticed');
    if (!analysis.invite) issues.push('quick tier must have invite field');
  }

  if (tier === 'standard') {
    // Standard tier MUST have noticed and experiment, but NOT invite or hidden_assumption
    if (!analysis.noticed || analysis.noticed.length < 20) {
      issues.push('noticed field missing or too short for standard tier');
    }
    if (!analysis.experiment || analysis.experiment.length < 15) {
      issues.push('experiment field missing or too short for standard tier');
    }
    if (analysis.invite) issues.push('standard tier should not have invite');
    if (analysis.hidden_assumption) issues.push('standard tier should not have hidden_assumption');
    // Check noticed is different from heard
    if (analysis.heard && analysis.noticed) {
      const heardNorm = (analysis.heard || '').toLowerCase().replace(/[^a-z\s]/g, '');
      const noticedNorm = (analysis.noticed || '').toLowerCase().replace(/[^a-z\s]/g, '');
      if (heardNorm === noticedNorm || noticedNorm.includes(heardNorm) || heardNorm.includes(noticedNorm)) {
        issues.push('noticed is too similar to heard - must add new insight');
      }
    }
  }

  if (tier === 'deep') {
    // Deep tier MUST have noticed, hidden_assumption, and experiment
    if (!analysis.noticed || analysis.noticed.length < 20) {
      issues.push('noticed field missing or too short for deep tier');
    }
    if (!analysis.hidden_assumption || analysis.hidden_assumption.length < 20) {
      issues.push('hidden_assumption field missing or too short for deep tier');
    }
    if (!analysis.experiment || analysis.experiment.length < 15) {
      issues.push('experiment field missing or too short for deep tier');
    }
    if (analysis.invite) issues.push('deep tier should not have invite');
    // Check noticed is different from heard
    if (analysis.heard && analysis.noticed) {
      const heardNorm = (analysis.heard || '').toLowerCase().replace(/[^a-z\s]/g, '');
      const noticedNorm = (analysis.noticed || '').toLowerCase().replace(/[^a-z\s]/g, '');
      if (heardNorm === noticedNorm || noticedNorm.includes(heardNorm) || heardNorm.includes(noticedNorm)) {
        issues.push('noticed is too similar to heard - must add new insight');
      }
    }
  }

  if (tier === 'deep') {
    // Check hidden_assumption uses hypothesis language
    if (analysis.hidden_assumption) {
      const hasHypothesis = /\b(might|could|may|wonder|perhaps|possibly|seems like|it sounds like)\b/i.test(analysis.hidden_assumption);
      if (!hasHypothesis) {
        issues.push('hidden_assumption lacks hypothesis framing');
      }
      const hasCalibration = /\?[\s]*$/.test((analysis.hidden_assumption || '').trim());
      if (!hasCalibration) {
        issues.push('hidden_assumption missing calibration question');
      }
    }
  }

  // Check for "You are..." personality labels
  const youArePattern = /\byou are (a |an |the )?(very |quite |really )?\w+\b/i;
  if (analysis.heard && youArePattern.test(analysis.heard)) {
    issues.push('heard contains "You are..." personality label');
  }
  if (analysis.noticed && youArePattern.test(analysis.noticed)) {
    issues.push('noticed contains "You are..." personality label');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Phase 8.8: Generate tiered fallback when validation fails
 */
function generateTieredFallback(input, tier) {
  const lower = (input || '').toLowerCase();

  // Generate evocative title based on content signals
  let title = 'A Moment';
  let noticed = 'Something is stirring here that deserves attention.';
  let experiment = 'Take 5 minutes to write what feels most important about this.';

  if (lower.includes('grow') || lower.includes('audience') || lower.includes('content')) {
    title = 'Finding Your Voice';
    noticed = 'The desire to be heard often carries more weight than tactics—it might be about being seen and valued.';
    experiment = 'List 3 creators you admire. What do they do that resonates with you?';
  } else if (lower.includes('figure') || lower.includes('start') || lower.includes('where')) {
    title = 'Finding Your Path';
    noticed = 'Not knowing where to start might be protecting you from committing to one path.';
    experiment = 'Write down 3 possible first steps. Which one feels most exciting?';
  } else if (lower.includes('love') || lower.includes('feel')) {
    title = 'On Your Heart';
    noticed = 'This seems to carry emotional weight beyond the surface.';
  } else if (lower.includes('work') || lower.includes('job')) {
    title = 'Work Thoughts';
    noticed = 'There may be something deeper here about what this work means to you.';
  } else if (lower.includes('worry') || lower.includes('anxious') || lower.includes('scared')) {
    title = 'Something Heavy';
    noticed = 'The worry might be pointing to something you care deeply about.';
  } else if (lower.includes('stuck') || lower.includes('block') || lower.includes('can\'t')) {
    title = 'A Crossroads';
    noticed = 'Being stuck often means there\'s a choice you\'re not ready to make yet.';
  } else if (lower.includes('?')) {
    title = 'A Question';
    noticed = 'The question itself reveals what matters to you.';
  }

  // Extract key phrases from input for heard field
  const words = (input || '').split(/\s+/).filter(w => w.length > 3);
  const keyPhrase = words.slice(0, 4).join(' ') || "what's on your mind";

  const base = {
    title,
    heard: `You mentioned "${keyPhrase}"—that stands out.`,
    question: "What would feel like real progress on this?"
  };

  if (tier === 'quick') {
    return {
      ...base,
      invite: "Share more if you'd like me to dig deeper."
    };
  }

  if (tier === 'standard') {
    return {
      ...base,
      noticed,
      experiment
    };
  }

  // Deep tier
  return {
    ...base,
    noticed,
    hidden_assumption: "There might be something underneath this worth exploring. What feels most true to you?",
    experiment: "Take 5 minutes to write what you'd want someone to understand about this."
  };
}

/**
 * Parse visual entities from response text
 * @param {string} responseText - Full response from Claude
 * @returns {Array} Array of visual entity objects
 */
function parseVisualEntities(responseText) {
  const visualEntities = [];

  // Match <visual_entities> block
  const visualMatch = responseText.match(/<visual_entities>([\s\S]*?)<\/visual_entities>/);

  if (!visualMatch) return visualEntities;

  // Extract each <entity .../> element
  const entityMatches = visualMatch[1].match(/<entity[^>]+\/>/g) || [];

  for (const entityTag of entityMatches) {
    // Extract attributes from each entity tag
    const nameMatch = entityTag.match(/name="([^"]+)"/);
    const typeMatch = entityTag.match(/type="([^"]+)"/);
    const visualMatch = entityTag.match(/visual="([^"]+)"/);
    const relationshipMatch = entityTag.match(/relationship="([^"]+)"/);

    const name = nameMatch ? nameMatch[1].trim() : '';
    const type = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
    const visual = visualMatch ? visualMatch[1].trim() : '';
    const relationship = relationshipMatch ? relationshipMatch[1].trim() : null;

    if (name && type && visual) {
      const entity = {
        name,
        type,
        visual
      };
      // Add relationship_to_user if present
      if (relationship) {
        entity.relationship_to_user = relationship;
      }
      visualEntities.push(entity);
    }
  }

  console.log(`[Analyze] Parsed ${visualEntities.length} visual entities`);
  return visualEntities;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input, context = {}, mode, noteType, preferencesXML, hasPersonalization, hasImage, isFirstNote, userId } = req.body;
  console.log('[Analyze] Received knownEntities:', JSON.stringify(context.knownEntities || []));
  console.log('[Analyze] Phase 7 - hasPersonalization:', hasPersonalization, 'preferencesXML length:', preferencesXML?.length || 0);
  console.log('[Analyze] Phase 8 - userProfile:', context.userProfile ? `${context.userProfile.userName}` : 'none');
  console.log('[Analyze] Visual Learning - hasImage:', hasImage || false);
  console.log('[Analyze] First Note Detection - isFirstNote:', isFirstNote || false);
  console.log('[Analyze] Phase 11 - userId:', userId || 'not provided');

  // ═══════════════════════════════════════════
  // PHASE 11: FETCH ONBOARDING CONTEXT
  // This is CRITICAL for personalization
  // ═══════════════════════════════════════════
  let onboardingContext = '';
  if (userId) {
    const onboarding = await getUserOnboardingContext(userId);
    if (onboarding) {
      onboardingContext = buildOnboardingContextPrompt(onboarding);
      console.log('[Analyze] Phase 11 - Built onboarding context:', onboardingContext.substring(0, 200));
      // Inject into context for downstream use
      context.personalizationContext = onboardingContext;
      context.onboardingData = onboarding;
    }
  }

  // Handle refine mode (Phase 3c)
  if (mode === 'refine') {
    return handleRefine(req, res);
  }

  // Handle reflect mode - tier upgrade with user reflection
  if (mode === 'reflect') {
    return handleReflection(req, res);
  }

  if (!input?.content || input.content.trim().length < 10) {
    return res.status(400).json({ error: 'Content too short' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // ═══════════════════════════════════════════
    // STAGE 1: CLEAN TRANSCRIPT (dedicated step)
    // ═══════════════════════════════════════════
    const cleanedInput = await cleanTranscript(input.content, client);
    console.log('[Analyze] Stage 1 - Cleaned transcript:', cleanedInput);

    // ═══════════════════════════════════════════
    // STAGE 2: CLASSIFY NOTE
    // ═══════════════════════════════════════════
    // Use provided noteType or auto-classify
    let category = noteType;
    if (!noteType || noteType === 'auto' || noteType === 'productive') {
      category = await classifyNote(cleanedInput, client);
      console.log('[Analyze] Stage 2 - Classified as:', category);
    }

    // Determine processing mode
    // Phase 8.8: ALL notes use tiered analysis for quality insights
    const useTieredSystem = true;
    const isPersonalCategory = category === 'personal_reflection' || category === 'personal';
    const shouldExtractActions = !isPersonalCategory; // Only extract actions for work/task notes

    console.log('[Analyze] Processing mode - useTieredSystem:', useTieredSystem, 'category:', category, 'isPersonal:', isPersonalCategory);

    // ═══════════════════════════════════════════
    // PHASE 8.8: TIERED RESPONSE FOR ALL NOTES
    // ═══════════════════════════════════════════
    let tier = null;
    let tierSignals = [];

    if (useTieredSystem) {
      // Phase 8.8: Detect appropriate response tier for ALL notes
      const tierResult = detectTier(cleanedInput);
      tier = tierResult.tier;
      tierSignals = tierResult.signals;
      console.log(`[Analyze] Phase 8.8 - Tier detected: ${tier} (words: ${tierResult.wordCount}, signals: ${tierSignals.join(', ')})`);
    }

    // ═══════════════════════════════════════════
    // STAGE 3: ANALYZE
    // ═══════════════════════════════════════════
    let systemPrompt, userPrompt;

    if (useTieredSystem) {
      // Phase 8.8: Use tiered analysis prompt for ALL notes
      systemPrompt = UNIFIED_ANALYSIS_PROMPT;
      userPrompt = buildTieredUserPrompt(cleanedInput, tier, context);
      console.log('[Analyze] Phase 8.8 DEBUG - Using TIERED prompt');
      console.log('[Analyze] Phase 8.8 DEBUG - Tier:', tier, 'Category:', category, 'Signals:', tierSignals);
      console.log('[Analyze] Phase 8.8 DEBUG - User prompt:', userPrompt.substring(0, 200));
    } else {
      // Legacy mode - only used if tiered system disabled
      systemPrompt = buildTaskSystemPrompt(context, category, preferencesXML, hasImage, isFirstNote);
      userPrompt = buildTaskUserPrompt({ ...input, content: cleanedInput }, category);
    }

    // Phase 8.8: Use consistent temperature for tiered analysis
    const temperature = useTieredSystem ? 0.5 : 0.3;

    // ═══════════════════════════════════════════
    // PHASE 8.7: VALIDATION + RETRY LOGIC
    // Ensures analysis quality, retries once if invalid
    // ═══════════════════════════════════════════
    const MAX_RETRIES = 2;
    let result = null;
    let responseText = '';
    let validationPassed = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Build prompt - on retry, add explicit instruction to avoid issues
      let attemptUserPrompt = userPrompt;
      if (attempt > 0) {
        attemptUserPrompt = `${userPrompt}

CRITICAL RETRY INSTRUCTION:
Your previous response was rejected because it echoed the input or used banned phrases.
DO NOT repeat the user's words back to them.
DO NOT use phrases like "Captured for future reference" or "Noted for later".
SHOW understanding, don't just REPEAT.

❌ WRONG Summary: "${cleanedInput}"
✅ RIGHT Summary: Show what this MEANS, use "you" language, be insightful`;
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: attemptUserPrompt }]
      });

      // Parse response
      responseText = message.content[0].text.trim();

      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
        result = JSON.parse(jsonMatch[1].trim());

        // Phase 8.8 DEBUG: Log raw parsed result
        if (useTieredSystem && tier) {
          console.log('[Analyze] Phase 8.8 DEBUG - Raw LLM response (first 500 chars):', responseText.substring(0, 500));
          console.log('[Analyze] Phase 8.8 DEBUG - Parsed result keys:', Object.keys(result));
          console.log('[Analyze] Phase 8.8 DEBUG - Result:', JSON.stringify(result, null, 2).substring(0, 800));
        }
      } catch (parseError) {
        console.error('Failed to parse Claude response:', responseText);
        result = getFallbackAnalysis(cleanedInput, isPersonalCategory ? 'personal' : category);
        break; // Parse error, use fallback
      }

      // Inject the cleaned transcript
      result.cleaned = result.cleaned || cleanedInput;
      result.cleanedInput = result.cleanedInput || cleanedInput;

      // Phase 5F.2: Strip emotional content from task notes (skip for personal notes)
      if (!isPersonalCategory) {
        result = stripEmotionalContent(result, cleanedInput);
      }

      // Phase 8.8: Use tiered validation for ALL notes now
      let validation;
      if (useTieredSystem && tier) {
        validation = validateTieredOutput(cleanedInput, result, tier);
        console.log(`[Analyze] Phase 8.8 - Tiered validation (${tier}):`, validation.valid ? 'PASSED' : validation.issues);
      } else {
        validation = validateAnalysisOutput(cleanedInput, result);
      }

      if (validation.valid) {
        console.log(`[Analyze] Validation passed on attempt ${attempt + 1}`);
        validationPassed = true;
        break;
      } else {
        console.warn(`[Analyze] Validation failed (attempt ${attempt + 1}):`, validation.issues);

        if (attempt < MAX_RETRIES - 1) {
          console.log('[Analyze] Retrying with explicit instructions...');
        }
      }
    }

    // If validation still failed after retries, apply fallback values
    if (!validationPassed && result) {
      console.warn('[Analyze] All attempts failed validation. Applying fallback.');

      if (useTieredSystem && tier) {
        // Phase 8.8: Use tiered fallback for ALL notes
        const tieredFallback = generateTieredFallback(cleanedInput, tier);
        result = { ...result, ...tieredFallback };
        console.log(`[Analyze] Phase 8.8 - Applied tiered fallback for ${tier} tier`);
      } else {
        // Standard fallback (legacy)
        const fallback = generateValidationFallback(cleanedInput, category);
        result.title = fallback.title;
        result.summary = fallback.summary;
        result.insight = fallback.insight;
        if (result.whatThisReveals) {
          result.whatThisReveals = fallback.insight;
        }
      }
    }

    // SAFETY NET: Always sanitize titles
    // Catches: banned words, raw input as title, titles too long
    if (result && result.title) {
      const BANNED_TITLE_WORDS_LIST = ['strategy', 'planning', 'development', 'assessment', 'management', 'analysis', 'optimization', 'framework', 'structure', 'implementation'];

      let needsFallback = false;
      let titleWords = result.title.split(/\s+/);

      // Check 1: Title is too long (more than 5 words = not evocative)
      if (titleWords.length > 5) {
        console.log('[Analyze] Title too long, needs fallback:', result.title);
        needsFallback = true;
      }

      // Check 2: Title matches input (LLM returned raw input as title)
      const titleNorm = result.title.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      const inputNorm = cleanedInput.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      if (titleNorm === inputNorm || inputNorm.startsWith(titleNorm) || titleNorm.length > 50) {
        console.log('[Analyze] Title matches input or too long, needs fallback');
        needsFallback = true;
      }

      // Check 3: Contains banned words
      const cleanedTitleWords = titleWords.filter(word => {
        const lowerWord = word.toLowerCase().replace(/[^a-z]/g, '');
        return !BANNED_TITLE_WORDS_LIST.some(banned => lowerWord.includes(banned));
      });

      if (cleanedTitleWords.length < titleWords.length) {
        console.log('[Analyze] Title has banned words:', titleWords.filter(w => !cleanedTitleWords.includes(w)));
        titleWords = cleanedTitleWords;
        if (titleWords.length < 2) {
          needsFallback = true;
        }
      }

      // Generate fallback if needed
      if (needsFallback) {
        const lower = cleanedInput.toLowerCase();
        if (lower.includes('cofounder') || lower.includes('co-founder') || lower.includes('conversation')) {
          result.title = 'The Conversation Ahead';
        } else if (lower.includes('grow') || lower.includes('audience') || lower.includes('content')) {
          result.title = 'Finding Your Voice';
        } else if (lower.includes('figure') || lower.includes('start') || lower.includes('where')) {
          result.title = 'Finding Your Path';
        } else if (lower.includes('employee') || lower.includes('team') || lower.includes('hire') || lower.includes('fire') || lower.includes('let go')) {
          result.title = 'A Hard Decision';
        } else if (lower.includes('work') || lower.includes('job') || lower.includes('project')) {
          result.title = 'Work on Your Mind';
        } else if (lower.includes('feel') || lower.includes('emotion') || lower.includes('scared') || lower.includes('anxious')) {
          result.title = 'What You\'re Carrying';
        } else if (lower.includes('?')) {
          result.title = 'A Question';
        } else {
          result.title = 'A Moment';
        }
        console.log('[Analyze] Title sanitization - using fallback:', result.title);
      } else if (cleanedTitleWords.length < result.title.split(/\s+/).length) {
        // Just had banned words removed, use cleaned version
        result.title = cleanedTitleWords.join(' ');
        console.log('[Analyze] Title sanitization - removed banned words:', result.title);
      }
    }

    // Quality gate (skip when using tiered system - it has its own validation)
    if (!useTieredSystem && isLowQuality(result)) {
      console.log('[Analyze] Low quality detected, regenerating...');
      result = await regenerateWithFeedback(client, systemPrompt, { ...input, content: cleanedInput }, result);
    }

    // Normalize the response structure
    const finalCategory = isPersonalCategory ? 'personal' : (category === 'personal_task' ? 'personal' : category);

    // Phase 8.8: For tiered system, preserve new schema and add compatibility fields
    if (useTieredSystem && tier) {
      // Keep the new tiered schema fields (heard, noticed, hidden_assumption, question, experiment, invite)
      // Add compatibility fields for UI
      result.cleanedInput = result.cleaned || cleanedInput;
      result.category = finalCategory;
      result.noteType = isPersonalCategory ? 'personal' : 'productive';
      result.tier = tier;

      // Map new fields to legacy for backward compatibility
      result.summary = result.heard || '';
      result.insight = result.noticed || result.heard || '';
      result.whatThisReveals = result.noticed || result.heard || '';
      result.questionToSitWith = result.question || null;

      // CRITICAL FIX: Extract actions for work notes even with tiered system
      if (isPersonalCategory) {
        result.actions = [];
        console.log('[Analyze] Personal note - no actions');
      } else {
        // Extract actions for work notes using the fallback extractor
        result.actions = ensureActionsExtracted(result.actions || [], cleanedInput);
        result.actionDetails = result.actions;
        console.log('[Analyze] Work note - extracted actions:', result.actions?.length || 0);
      }

      // CRITICAL: Remove invite for non-quick tiers (shouldn't be there anyway)
      if (tier !== 'quick') {
        delete result.invite;
      }

      console.log(`[Analyze] Phase 8.8 - Tiered response (${tier}):`, {
        title: result.title,
        heard: result.heard?.substring(0, 50),
        noticed: result.noticed?.substring(0, 50),
        question: result.question?.substring(0, 50),
        actionsCount: result.actions?.length || 0
      });
    } else {
      result = normalizeResponse(result, cleanedInput, isPersonalCategory ? 'personal' : null, shouldExtractActions);
    }

    // Override category to match classification
    result.category = finalCategory;
    result.noteType = isPersonalCategory ? 'personal' : 'productive';

    // Phase 7: Include flag for preferences applied
    result.preferencesApplied = hasPersonalization || false;

    // Visual Learning: Parse visual entities if image was present
    let visualEntities = [];
    if (hasImage) {
      visualEntities = parseVisualEntities(responseText);
      if (visualEntities.length > 0) {
        console.log('[Analyze] Visual entities extracted:', JSON.stringify(visualEntities));
      }
    }
    result.visualEntities = visualEntities;

    // Phase 8.8 DEBUG: Log final result
    if (useTieredSystem && tier) {
      console.log('[Analyze] Phase 8.8 DEBUG - FINAL RESULT KEYS:', Object.keys(result));
      console.log('[Analyze] Phase 8.8 DEBUG - FINAL heard:', result.heard);
      console.log('[Analyze] Phase 8.8 DEBUG - FINAL noticed:', result.noticed);
      console.log('[Analyze] Phase 8.8 DEBUG - FINAL question:', result.question);
      console.log('[Analyze] Phase 8.8 DEBUG - FINAL tier:', result.tier);
    }

    // Phase 12: Build learning data for Knowledge Pulse
    const learning = {
      entities_extracted: [],
      themes_detected: [],
      similar_notes: []
    };

    // Extract entities from people mentioned
    if (result.entities?.people?.length > 0) {
      for (const person of result.entities.people) {
        learning.entities_extracted.push({
          name: typeof person === 'string' ? person : person.name || person,
          type: 'person',
          relationship: null,
          is_new: true  // Assume new for now, UI can verify
        });
      }
    }

    // Add visual entities if present
    if (visualEntities && visualEntities.length > 0) {
      for (const ve of visualEntities) {
        learning.entities_extracted.push({
          name: ve.name,
          type: ve.type || 'person',
          relationship: ve.relationship || null,
          is_new: true
        });
      }
    }

    // Extract themes from noticed/heard or category
    if (result.noticed) {
      // Try to extract a theme from the noticed text
      const noticedLower = result.noticed.toLowerCase();
      if (noticedLower.includes('stress') || noticedLower.includes('pressure') || noticedLower.includes('overwhelm')) {
        learning.themes_detected.push('stress');
      }
      if (noticedLower.includes('decision') || noticedLower.includes('choice') || noticedLower.includes('crossroad')) {
        learning.themes_detected.push('decision-making');
      }
      if (noticedLower.includes('relationship') || noticedLower.includes('friend') || noticedLower.includes('family')) {
        learning.themes_detected.push('relationships');
      }
      if (noticedLower.includes('work') || noticedLower.includes('career') || noticedLower.includes('job')) {
        learning.themes_detected.push('work');
      }
      if (noticedLower.includes('growth') || noticedLower.includes('learn') || noticedLower.includes('improve')) {
        learning.themes_detected.push('personal growth');
      }
    }

    // Add category as a theme if no themes detected
    if (learning.themes_detected.length === 0 && finalCategory) {
      learning.themes_detected.push(finalCategory);
    }

    result.learning = learning;
    console.log('[Analyze] Phase 12 - Learning data:', JSON.stringify(learning));

    // ═══════════════════════════════════════════
    // MEM0 MEMORY PIPELINE
    // Must await because Vercel kills serverless
    // functions after response is sent
    // ═══════════════════════════════════════════
    console.log('[Analyze] Mem0 - Pre-check: userId=', userId, 'supabase=', !!supabase);
    if (userId && supabase) {
      console.log('[Analyze] Mem0 - Starting pipeline for user:', userId);
      try {
        const pipelineResult = await runMem0Pipeline(cleanedInput, userId, client, supabase, context.knownEntities || []);
        console.log('[Analyze] Mem0 pipeline completed:', JSON.stringify(pipelineResult));
        result.mem0 = pipelineResult;
      } catch (err) {
        console.error('[Analyze] Mem0 pipeline error:', err.message, err.stack);
        result.mem0 = { error: err.message };
      }
    } else {
      console.log('[Analyze] Mem0 - Skipped: no userId or supabase client');
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Analyze API error:', error);
    return res.status(200).json(getFallbackAnalysis(input.content, noteType));
  }
};

/**
 * Phase 5F.2: Strip emotional content from task note responses
 * Detects and replaces poetic/emotional summaries with practical ones
 */
function stripEmotionalContent(result, cleanedInput) {
  // Banned emotional phrases
  const emotionalPatterns = [
    /tenderness/gi,
    /wellbeing/gi,
    /well-being/gi,
    /your care for/gi,
    /those who depend/gi,
    /weight of/gi,
    /holding.*responsibility/gi,
    /carry.*responsibility/gi,
    /beautiful/gi,
    /poetic/gi,
    /there's something/gi,
    /reveals about/gi,
    /shows how/gi,
    /speaks to/gi,
    /your relationship/gi,
    /emotional/gi,
    /in how you/gi,
    /the way you/gi,
  ];

  // Check if summary contains emotional content
  const summary = result.summary || result.insight || '';
  const hasEmotionalContent = emotionalPatterns.some(pattern => pattern.test(summary));

  if (hasEmotionalContent) {
    console.log('[Analyze] Detected emotional content, replacing with practical summary');

    // Generate practical summary based on actions
    const action = result.actions?.[0]?.action || '';
    let practicalSummary;

    if (action) {
      practicalSummary = `Task: ${action}`;
    } else {
      // Extract key nouns from cleaned input
      const lower = cleanedInput.toLowerCase();
      if (lower.includes('vet')) {
        practicalSummary = 'Vet appointment needed.';
      } else if (lower.includes('call')) {
        practicalSummary = 'Phone call to make.';
      } else if (lower.includes('email') || lower.includes('send')) {
        practicalSummary = 'Message to send.';
      } else if (lower.includes('finish') || lower.includes('complete')) {
        practicalSummary = 'Task to complete.';
      } else if (lower.includes('buy') || lower.includes('order')) {
        practicalSummary = 'Item to purchase.';
      } else if (lower.includes('schedule') || lower.includes('book')) {
        practicalSummary = 'Appointment to schedule.';
      } else {
        practicalSummary = 'Task reminder.';
      }
    }

    result.summary = practicalSummary;
    result.insight = practicalSummary;
  }

  // Also check and fix the title
  const title = result.title || '';
  const hasEmotionalTitle = emotionalPatterns.some(pattern => pattern.test(title));

  if (hasEmotionalTitle || title.length > 40) {
    // Generate practical title from action or input
    const action = result.actions?.[0]?.action || '';
    if (action) {
      result.title = action.length > 30 ? action.substring(0, 27) + '...' : action;
    } else {
      const words = cleanedInput.split(' ').slice(0, 4).join(' ');
      result.title = words.length > 30 ? words.substring(0, 27) + '...' : words;
    }
  }

  // Fix core.intent if emotional
  if (result.core?.intent) {
    const intentHasEmotion = emotionalPatterns.some(pattern => pattern.test(result.core.intent));
    if (intentHasEmotion) {
      const action = result.actions?.[0]?.action || 'Complete task';
      result.core.intent = action;
    }
  }

  return result;
}

/**
 * Phase 5E: Stage 1 - Clean and refine raw transcript
 * Dedicated step for transcript polishing before classification/analysis
 */
async function cleanTranscript(rawText, client) {
  const cleanPrompt = `You are a transcript cleaner. Your ONLY job is to polish raw speech into clean written text.

INPUT: "${rawText}"

RULES:
1. REMOVE all filler words: um, uh, mmm, hmm, like (when used as filler), you know, I mean, so (at start), well (at start), basically, actually (when filler), right, yeah, okay (when filler)

2. FIX punctuation:
   - Add periods at sentence ends
   - Add commas where natural pauses occur
   - Add question marks for questions
   - Capitalize first word of sentences

3. FIX grammar:
   - "i" → "I"
   - "dont" → "don't"
   - "cant" → "can't"
   - "im" → "I'm"
   - "ive" → "I've"
   - "its" when meaning "it is" → "it's"
   - "shes" → "she's"
   - "hes" → "he's"

4. CAPITALIZE proper nouns:
   - Names (seri → Seri, sarah → Sarah)
   - Places
   - Days of week (friday → Friday)

5. PRESERVE meaning:
   - Don't add words that weren't said
   - Don't change the intent
   - Keep the speaker's voice/tone

6. REMOVE false starts:
   - "I was... I mean, I need to" → "I need to"
   - "So like, um, basically" → remove entirely

OUTPUT: Return ONLY the cleaned text. No explanation, no quotes, no "Here is the cleaned text:". Just the polished text.

EXAMPLES:
Input: "um so like i need to call the vet for my dog seri"
Output: I need to call the vet for my dog Seri.

Input: "i was thinking about maybe um calling sarah you know about the meeting"
Output: I was thinking about calling Sarah about the meeting.

Input: "so basically i have to mmm finish the investor deck by friday"
Output: I have to finish the investor deck by Friday.

Input: "need to call vet for my dog seri shes not feeling well"
Output: Need to call the vet for my dog Seri. She's not feeling well.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3, // Low temperature for consistent cleaning
      messages: [{ role: 'user', content: cleanPrompt }]
    });

    let cleanedText = response.content[0]?.text?.trim();

    // Fallback: if response looks like an explanation, extract just the text
    if (cleanedText && cleanedText.includes(':') && cleanedText.length > rawText.length * 2) {
      const lines = cleanedText.split('\n');
      cleanedText = lines[lines.length - 1].trim();
    }

    // Basic validation
    if (!cleanedText || cleanedText.length < 5) {
      return basicClean(rawText);
    }

    return cleanedText;
  } catch (error) {
    console.error('Transcript cleaning failed:', error);
    return basicClean(rawText); // Fallback to basic cleaning
  }
}

/**
 * Basic transcript cleaning fallback
 */
function basicClean(text) {
  let cleaned = text
    .replace(/\b(um|uh|mmm|hmm|like|you know|so yeah|basically|literally)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Add period if missing
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

/**
 * Phase 5E: Stage 2 - Classify note type
 * Three-way classification: work / personal_task / personal_reflection
 */
async function classifyNote(cleanedText, client) {
  const classifyPrompt = `Classify this text into ONE category:

TEXT: "${cleanedText}"

CATEGORIES:

1. "work" — Work, business, professional tasks
   Examples: "finish investor deck", "meeting with team", "send proposal", "email client"

2. "personal_task" — Personal life WITH a clear action/task
   Examples: "call vet for dog", "book dentist", "call mom", "buy groceries", "schedule doctor"
   KEY: Has something TO DO, even if it's personal/family related

3. "personal_reflection" — Emotional, reflective, no clear task
   Examples: "feeling down today", "thinking about life", "grateful for family", "missing my childhood"
   KEY: Processing feelings, NOT a to-do item

RULES:
- If there's ANY actionable task (call, book, send, buy, finish, schedule, email, write, create, etc.) → "work" or "personal_task"
- "personal_reflection" is ONLY for pure emotional processing with NO task
- Pet/family/health tasks with clear actions → "personal_task" (NOT "personal_reflection")
- When in doubt between task and reflection → choose task

OUTPUT: Return ONLY one word: "work", "personal_task", or "personal_reflection"`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 20,
      temperature: 0.1, // Very low for consistent classification
      messages: [{ role: 'user', content: classifyPrompt }]
    });

    const rawCategory = response.content[0]?.text?.trim().toLowerCase();

    // Extract just the category word
    const category = rawCategory.replace(/[^a-z_]/g, '');

    // Validate response
    if (['work', 'personal_task', 'personal_reflection'].includes(category)) {
      return category;
    }

    // Fallback: check for action words
    return classifyByKeywords(cleanedText);

  } catch (error) {
    console.error('Classification failed:', error);
    return classifyByKeywords(cleanedText);
  }
}

/**
 * Keyword-based classification fallback
 */
function classifyByKeywords(text) {
  const lower = text.toLowerCase();

  // Check for action verbs
  const hasActionWords = /\b(call|email|send|finish|complete|book|schedule|buy|get|make|write|prepare|meet|contact|text|message|create|build|plan|research|review|check|fix|resolve|update)\b/i.test(lower);

  if (!hasActionWords) {
    // Check for reflection patterns
    const isReflection = /\b(feeling|felt|thinking about|grateful|miss|remember|wondering|reflecting|nostalgic)\b/i.test(lower);
    if (isReflection) {
      return 'personal_reflection';
    }
  }

  // Check for work context
  const isWork = /\b(work|project|meeting|team|business|client|investor|proposal|deck|report|deadline|office|boss|colleague)\b/i.test(lower);
  if (isWork) {
    return 'work';
  }

  // Default: if has action words, it's a personal task
  if (hasActionWords) {
    return 'personal_task';
  }

  return 'personal_reflection';
}

/**
 * Phase 8: Build user profile context for prompt injection
 * Helps Twin know who the user is (self-awareness)
 */
function buildUserContext(userProfile) {
  if (!userProfile || !userProfile.userName) {
    return '';
  }

  const descriptors = userProfile.descriptors && userProfile.descriptors.length > 0
    ? userProfile.descriptors.join(', ')
    : 'Not provided';

  return `
<user_profile>
  <name>${userProfile.userName}</name>
  <about>${userProfile.aboutMe || 'Not provided'}</about>
  <descriptors>${descriptors}</descriptors>
</user_profile>

CRITICAL SELF-AWARENESS INSTRUCTION:
This note is from ${userProfile.userName}. When they say "I" or "me", they mean themselves.
- If an image shows a person AND the note uses first-person language (I, me, my, myself), that person is likely ${userProfile.userName} - do NOT extract as "unknown person"
- When referencing the user, use their name "${userProfile.userName}" or "you" appropriately
- The descriptors tell you about the user: ${descriptors}
`;
}

/**
 * Phase 5F.2 + Phase 6 + Phase 7 + Visual Learning: Task-focused system prompt with memory context and user preferences
 * Zero tolerance for emotional/poetic language
 */
function buildTaskSystemPrompt(context, category, preferencesXML = '', hasImage = false, isFirstNote = false) {
  // Phase 8: Build user profile context
  const userProfileSection = buildUserContext(context.userProfile);

  // First note special handling
  let firstNoteSection = '';
  if (isFirstNote) {
    console.log('[Analyze] First note detected - adding warm welcome context');
    firstNoteSection = `
## FIRST NOTE CONTEXT — THIS IS SPECIAL

This is the user's VERY FIRST note to their Inscript. Make this response warm and personal.

REQUIRED FOR FIRST NOTE:
- Title should be welcoming: "First Hello", "Meeting Your Twin", "Your Introduction", "Getting Started", or similar
- Summary should acknowledge the beginning: "This is the start of your journey with your Twin..."
- DO NOT use "Brief introduction from someone named..." — that's cold and impersonal
- This is a RELATIONSHIP beginning, not a database entry
- Be warm but not sappy — sophisticated and personal

EXAMPLE FIRST NOTE TITLES:
✅ "First Hello"
✅ "Meeting Your Twin"
✅ "Your Introduction"
✅ "Getting Started Together"
❌ "Brief introduction from someone named Elroy"
❌ "Introduction from User"
❌ "Someone named Elroy"
`;
  }

  // Phase 6: Build memory context section if known entities exist
  let memorySection = '';
  // Phase 10.2: Extract relationships for proactive relevance
  const knownRelationships = context.knownRelationships || [];
  const text = context.text || context.input || '';
  console.log('[Analyze] buildTaskSystemPrompt - knownEntities count:', context.knownEntities?.length || 0);
  console.log('[Analyze] buildTaskSystemPrompt - knownRelationships count:', knownRelationships.length);
  console.log('[Analyze] buildTaskSystemPrompt - preferencesXML length:', preferencesXML?.length || 0);
  console.log('[Analyze] buildTaskSystemPrompt - userProfile:', context.userProfile?.userName || 'none');

  if (context.knownEntities && context.knownEntities.length > 0) {
    console.log('[Analyze] Building memory section with entities:', JSON.stringify(context.knownEntities));

    // Phase 6.1: Deduplicate and clean entities
    const entityMap = new Map();
    for (const e of context.knownEntities) {
      // Skip corrupted entries
      if (!e.name || e.name === '[Unknown]' || e.name.includes('[Unknown]')) {
        continue;
      }
      const key = e.name.toLowerCase();
      const existing = entityMap.get(key);
      // Keep the one with better details
      if (!existing || (e.details && e.details.length > (existing.details?.length || 0))) {
        entityMap.set(key, e);
      }
    }
    const cleanedEntities = Array.from(entityMap.values());
    console.log('[Analyze] Cleaned entities count:', cleanedEntities.length);

    if (cleanedEntities.length > 0) {
      // Phase 8: Build XML-formatted entity memory with relationship context
      const entityXml = cleanedEntities.map(e => {
        const attrs = [`name="${e.name}"`, `type="${e.type}"`];
        if (e.relationship) attrs.push(`relationship="${e.relationship}"`);
        if (e.userCorrected) attrs.push(`verified="true"`);

        let description;
        if (e.type === 'pet') {
          description = e.relationship
            ? `Your ${e.relationship} (${e.details || 'pet'}) named ${e.name}`
            : `Your ${e.details || 'pet'} named ${e.name}`;
        } else if (e.relationship) {
          description = `Your ${e.relationship} named ${e.name}`;
        } else {
          description = `${e.name}, a ${e.type} you know`;
        }

        return `  <entity ${attrs.join(' ')}>${description}</entity>`;
      }).join('\n');

      // Phase 10: Build conflict detection facts
      const conflictFacts = cleanedEntities.map(e => {
        const fact = e.relationship ? `${e.name}: ${e.relationship}` : `${e.name}: ${e.type}`;
        const context = e.details ? ` (${e.details})` : '';
        return `- ${fact}${context}`;
      }).join('\n');

      memorySection = `
<known_entities>
${entityXml}
</known_entities>

CRITICAL RELATIONSHIP-AWARE INSTRUCTIONS:
- When referencing entities, USE relationship context
- If relationship="co-founder", say "your co-founder Sarah" not just "Sarah"
- If type="pet" with relationship, say "your dog Seri" not just "Seri"
- If verified="true", this was explicitly confirmed by user - ALWAYS use this info
- Example: "Seri" → "your dog Seri" in actions/summaries

<conflict_detection>
CHECK FOR CONTRADICTIONS with known information:

KNOWN FACTS:
${conflictFacts}

CONTRADICTION SIGNALS to watch for:
- "new job" / "started at" / "left [company]" → job change
- "broke up" / "ex" / "ended things" → relationship change
- "moved to" / "new place" / "relocated" → location change
- "sold my" / "got rid of" / "no longer have" → possession change

If you detect a contradiction between user's NEW input and KNOWN FACTS above, include this in your response:
<memory_update>
  <type>supersede</type>
  <old_fact>previous information</old_fact>
  <new_fact>new information from current input</new_fact>
  <entity_name>name of entity being updated</entity_name>
</memory_update>
</conflict_detection>

${buildPatternAwarenessPrompt(cleanedEntities)}
${buildRelationshipContext(knownRelationships, cleanedEntities)}
${buildProactiveContext(text, cleanedEntities)}
`;
      console.log('[Analyze] Memory section added to prompt (with relationships + conflict detection + pattern awareness + Phase 10.2 proactive relevance)');
    } else {
      console.log('[Analyze] All entities filtered out during cleaning');
    }
  } else {
    console.log('[Analyze] No memory section - knownEntities empty or missing');
  }

  return `You are an intelligent task extraction system that understands WHY things matter.
${userProfileSection}${memorySection}${firstNoteSection}
${CRITICAL_LANGUAGE_RULE}

## YOUR ROLE
You extract tasks AND understand their strategic importance. You're not a dumb todo list. You understand context, priorities, and what matters.

INPUT TYPE: ${category === 'work' ? 'WORK/FUNCTIONAL' : 'PERSONAL TASK'}

## TITLE RULES
- For WORK: Title should be SPECIFIC to the task/project (e.g., "Q4 Deck for Investors", "Sarah Follow-up")
- For PERSONAL TASKS: Title should capture the practical goal (e.g., "Vet for Seri", "Mom Birthday Call")
- 3-6 words maximum
- Never generic ("Task", "Meeting", "Thing to do")

## SUMMARY RULES
The summary should show you UNDERSTOOD what matters:
- Capture the strategic value or practical importance
- Be concise but insightful (2-3 sentences)
- Never robotic ("Task recorded", "Noted for future reference")
- Show you get the context

## EXAMPLE 1: WORK
INPUT: "Need to finish the investor deck by Friday. Sarah's waiting for it."

CORRECT OUTPUT:
{
  "title": "Investor Deck for Sarah",
  "cleaned": "Need to finish the investor deck by Friday. Sarah's waiting for it.",
  "summary": "High-priority deliverable. Sarah is blocked until this is done.",
  "core": {
    "topic": "Investor deck deadline",
    "emotion": "focused",
    "intent": "Deliver the deck to unblock Sarah"
  },
  "actions": [{
    "action": "Finish investor deck",
    "effort": "deep",
    "deadline": "Friday",
    "why": "Sarah is waiting",
    "future_state": "→ Deck delivered, Sarah unblocked",
    "waiting_on": "Sarah asked for this",
    "is_big_task": true
  }],
  "category": "work"
}

## EXAMPLE 2: PERSONAL TASK
INPUT: "Take Seri to the vet, she hasn't been eating well"

CORRECT OUTPUT:
{
  "title": "Vet for Seri",
  "cleaned": "Take Seri to the vet. She hasn't been eating well.",
  "summary": "Your dog needs attention. Something's off with her appetite.",
  "core": {
    "topic": "Seri's health",
    "emotion": "concerned",
    "intent": "Get Seri checked out"
  },
  "actions": [{
    "action": "Schedule vet appointment for Seri",
    "effort": "quick",
    "why": "She's not eating well",
    "future_state": "→ Seri gets care"
  }],
  "category": "personal"
}

## BANNED PATTERNS
Never use these in any output:
- "Captured for future reference"
- "User has..."
- "The user mentioned..."
- "Worth tracking"
- "Noted for later"
- "Important to remember"
- Anything that sounds like a database log

## OUTPUT FORMAT (JSON only)
{
  "title": "Specific, practical title (3-6 words)",
  "cleaned": "Polished transcript",
  "summary": "2-3 sentences that show you understood WHY this matters",
  "core": {
    "topic": "2-4 words, the subject",
    "emotion": "appropriate emotion (focused, concerned, urgent, etc.)",
    "intent": "What you're trying to accomplish"
  },
  "entities": { "people": [], "dates": [], "places": [] },
  "actions": [{ "action": "Verb + task", "effort": "quick|medium|deep", "deadline": null, "commitment": null, "waiting_on": null, "is_big_task": false, "why": "Short reason", "future_state": "→ Outcome" }],
  "decision": { "exists": false, "question": null, "options": null },
  "category": "${category === 'work' ? 'work' : 'personal'}"
}

Extract ALL actionable items. Show you understood the context.${preferencesXML ? `

## PHASE 7: USER PREFERENCES
The following reflects what this user likes and dislikes in outputs. ADAPT your style accordingly.

${preferencesXML}

IMPORTANT: If preferences indicate the user wants concise outputs, keep summary under 50 words.
If bad_examples show verbose/emotional outputs the user disliked, AVOID that style entirely.
Match the tone and style of good_examples when possible.` : ''}${hasImage ? `

## VISUAL LEARNING (IMAGE PRESENT)
${VISUAL_ENTITY_INSTRUCTION}` : ''}`;
}

/**
 * Phase 5E: Task-focused user prompt
 */
function buildTaskUserPrompt(input, category) {
  return `Analyze this ${category === 'work' ? 'work' : 'personal'} note and extract actions:

"""
${input.content}
"""

REMEMBER: This is a TASK note. Extract ALL actionable items.
Return ONLY valid JSON, no markdown.`;
}

/**
 * Build system prompt - Phase 5D: Precision Processing + Smarter Extraction
 */
function buildSystemPrompt(context) {
  let prompt = `You are processing a voice note to extract PRECISE signal from noise.

Your job is NOT to summarize. Your job is to UNDERSTAND.

Process in three stages:

## STAGE 1: CLEAN (TRANSCRIPT REFINEMENT)
The "cleaned" field must be a POLISHED version of what the user said.

DO:
- Add proper punctuation (periods, commas, question marks)
- Fix grammar and sentence structure
- Remove filler words ("um", "uh", "like", "you know", "so like", "basically", "literally")
- Remove false starts ("I was... I mean, I need to...")
- Capitalize properly (including names like "Seri" for a pet)
- Make it readable as written text
- Create paragraph breaks at topic shifts

DO NOT:
- Change the meaning
- Add information they didn't say
- Remove important context
- Make it overly formal if they were casual
- Lose their voice/tone

Examples:
INPUT: "um so like I was thinking about maybe calling my mom because you know she mentioned something about Sunday dinner"
CLEANED: "I was thinking about calling my mom. She mentioned something about Sunday dinner."

INPUT: "need to call vet for my dog seri shes not feeling well"
CLEANED: "Need to call the vet for my dog Seri. She's not feeling well."

INPUT: "i have to uh finish the investor deck by friday its really important"
CLEANED: "I have to finish the investor deck by Friday. It's really important."

## STAGE 2: EXTRACT SIGNAL
- Core topic (one phrase)
- Emotional undertone (not what they said, what they FEEL)
- Intent (what they're trying to process or resolve)
- Entities: people, dates, places mentioned
- Actions: specific, doable commitments (not vague wishes)
- Decision: genuine pending choice (not rhetorical)

## STAGE 3: OUTPUT
Return JSON that passes the precision test:
- "cleaned" reads like POLISHED written text, not raw speech
- "emotion" captures subtext, not surface
- "actions" can be done WITHOUT more context
- "decision" is something they're actually wrestling with

## ACTION EXTRACTION RULES (CRITICAL)

Extract actions from ANY of these patterns:

### Explicit Intent (with "I")
- "I need to call the vet"
- "I should finish the deck"
- "I have to send the email"
- "I want to research competitors"
- "I must prepare the agenda"

### Implicit Intent (without "I")
- "need to call vet" → Action: "Call vet"
- "should probably check on that" → Action: "Check on that"
- "have to send it by Friday" → Action: "Send it by Friday"

### Imperative Phrases
- "call mom tomorrow" → Action: "Call mom"
- "finish the investor deck" → Action: "Finish investor deck"
- "send the contract" → Action: "Send contract"
- "book dentist appointment" → Action: "Book dentist appointment"
- "email Sarah about the proposal" → Action: "Email Sarah about proposal"

### Task-like Nouns
- "dentist appointment" → Action: "Schedule dentist appointment"
- "vet for Seri" → Action: "Take Seri to vet" or "Call vet for Seri"
- "meeting with investors" → Action: "Prepare for investor meeting"

### Obligation/Expectation
- "Sarah's waiting for my response" → Action: "Respond to Sarah"
- "they asked twice" → Action: "Respond to their request"
- "deadline is Friday" → Action: "[related task] by Friday"

### DO NOT Extract Actions From:
- Pure reflection: "thinking about life"
- Questions without intent: "what should I do?"
- Past events: "I called mom yesterday"
- Observations: "the weather is nice"

CRITICAL: Extract actions even from short, casual inputs. "need to call vet" IS an action. When in doubt, extract the action.

Effort levels:
- quick: Under 15 minutes, single task
- medium: 15-60 minutes or requires coordination
- deep: Multi-hour or complex dependencies

## SMART NUDGE EXTRACTION
For EACH action, also detect and extract:

A) COMMITMENT - Did they say "I need to", "I should", "I must", "I have to", "my priority is", "I want to", "I've been meaning to"?
   → Extract their exact commitment phrase (e.g., "I really need to finish this")

B) WHY - The unspoken reason behind their desire (complete the sentence they didn't finish)
   → Start with "So you can...", "Because...", or "To...". Keep it under 8 words. Make it personal and human.
   → Examples: "Because the relationship matters", "So you can stop carrying it", "To see if the idea holds up"

C) FUTURE_STATE - What life looks like after completing this
   → 2-5 words with "→" prefix. Focus on relief, progress, or closure.
   → Examples: "→ Reconnected", "→ Sent. Off your plate", "→ Draft done"

D) WAITING_ON - Is someone waiting? Look for: "she asked", "he's waiting", "they followed up", "waiting for my response", "they replied", "needs my answer"
   → Describe who and what (e.g., "Sarah asked twice", "Client waiting since Tuesday")

E) DEADLINE - Did they mention when? Look for: "by Friday", "before the meeting", "this week", "tomorrow", "end of month", "today"
   → Extract the deadline phrase

F) IS_BIG_TASK - Does the action involve: write, create, build, plan, design, develop, prepare, draft, outline, research, complete?
   → Set to true if it's a substantial task requiring creative effort

IMPORTANT for why and future_state:
- Make them feel human, not robotic
- They should resonate emotionally
- Keep them SHORT - brevity is power
- Don't be preachy or motivational-speaker-ish
- Sound like a wise friend, not a productivity app

## DECISION RULES
Only include a decision if they're genuinely weighing options:
❌ "Should I eat lunch?" (trivial)
❌ "I wonder if..." (rhetorical)
✅ "Torn between HK trip or Tokyo conference" (genuine choice)
✅ "Not sure whether to hire a VA or keep doing it myself" (real tradeoff)

## OUTPUT FORMAT
{
  "cleaned": "Their words, cleaned up but preserving voice",
  "title": "2-6 word title",
  "core": {
    "topic": "One phrase describing the core subject",
    "emotion": "The undertone (anxious, hopeful, uncertain, relieved, stretched, etc.)",
    "intent": "What they're trying to figure out or process"
  },
  "entities": {
    "people": [],
    "dates": [],
    "places": []
  },
  "actions": [
    {
      "action": "VERB + NOUN + CONTEXT",
      "effort": "quick|medium|deep",
      "deadline": null,
      "commitment": "Their exact words if they made a commitment, or null",
      "why": "The unspoken reason (So you can... / Because... / To...)",
      "future_state": "→ Brief outcome (2-5 words)",
      "waiting_on": "Who is waiting and why, or null",
      "is_big_task": false
    }
  ],
  "decision": {
    "exists": true,
    "question": "The decision in question form",
    "options": ["Option A", "Option B"]
  },
  "category": "work|personal|ideas"
}

If no actions, empty array. If no decision, exists: false with null question and options.

## EXAMPLE

Input: "um so like I was thinking about maybe calling my mom because you know she mentioned something about Sunday dinner and I should probably figure that out but also I have that meeting with investors on Monday that I'm kind of nervous about"

Output:
{
  "cleaned": "I was thinking about calling my mom. She mentioned something about Sunday dinner and I should probably figure that out. I also have a meeting with investors on Monday that I'm nervous about.",
  "title": "Family and Investor Prep",
  "core": {
    "topic": "Balancing family and work pressure",
    "emotion": "anxious, stretched",
    "intent": "Processing competing demands"
  },
  "entities": {
    "people": ["mom", "investors"],
    "dates": ["Sunday", "Monday"],
    "places": []
  },
  "actions": [
    {
      "action": "Call mom about Sunday dinner plans",
      "effort": "quick",
      "deadline": null,
      "commitment": "I should probably figure that out",
      "why": "Because the connection matters",
      "future_state": "→ Plans set",
      "waiting_on": null,
      "is_big_task": false
    }
  ],
  "decision": {
    "exists": false,
    "question": null,
    "options": null
  },
  "category": "personal"
}`;

  // Add user's learned preferences if available
  if (context.preferences) {
    const { topLikes, topDislikes } = context.preferences;
    if (topLikes?.length > 0 || topDislikes?.length > 0) {
      prompt += `\n\n## USER'S PREFERENCES\n`;
      if (topLikes?.length > 0) {
        prompt += `Prefers: ${topLikes.join(', ')}\n`;
      }
      if (topDislikes?.length > 0) {
        prompt += `Dislikes: ${topDislikes.join(', ')}\n`;
      }
    }
  }

  return prompt;
}

/**
 * Build user prompt - Phase 5A
 */
function buildUserPrompt(input) {
  return `Process this ${input.type || 'text'} note:

"""
${input.content}
"""

Return ONLY valid JSON, no markdown:
{
  "cleaned": "...",
  "title": "...",
  "core": { "topic": "...", "emotion": "...", "intent": "..." },
  "entities": { "people": [], "dates": [], "places": [] },
  "actions": [{
    "action": "...",
    "effort": "quick|medium|deep",
    "deadline": null,
    "commitment": "exact words or null",
    "why": "So you can.../Because.../To...",
    "future_state": "→ Brief outcome",
    "waiting_on": "who is waiting or null",
    "is_big_task": false
  }],
  "decision": { "exists": false, "question": null, "options": null },
  "category": "work|personal|ideas"
}`;
}

/**
 * Build personal system prompt (Phase 4A + Phase 6 + Phase 7 + Phase 8 + Visual Learning)
 * For emotional/reflective notes - warm, insightful, not functional
 */
function buildPersonalSystemPrompt(context, preferencesXML = '', hasImage = false, isFirstNote = false) {
  // Phase 8: Build user profile context
  const userProfileSection = buildUserContext(context.userProfile);

  // First note special handling
  let firstNoteSection = '';
  if (isFirstNote) {
    console.log('[Analyze] First note (PERSONAL) detected - adding warm welcome context');
    firstNoteSection = `
## FIRST NOTE CONTEXT — THIS IS SPECIAL

This is the user's VERY FIRST note to their Inscript. This moment is the beginning of a relationship.

REQUIRED FOR FIRST NOTE:
- Title should be warm and welcoming: "First Hello", "Meeting Your Twin", "The Beginning", "A New Chapter"
- whatThisReveals should acknowledge the significance: "This is where your journey with your Twin begins..."
- Be warm, personal, and meaningful — this is a relationship beginning
- DO NOT be generic or clinical

EXAMPLE FIRST NOTE TITLES:
✅ "First Hello"
✅ "The Beginning"
✅ "Meeting Your Twin"
❌ "Brief introduction from someone..."
❌ "User Introduction"
`;
  }

  // Phase 6: Build memory context section if known entities exist
  let memorySection = '';
  // Phase 10.2: Extract relationships for proactive relevance
  const knownRelationships = context.knownRelationships || [];
  const text = context.text || context.input || '';
  console.log('[Analyze] buildPersonalSystemPrompt - knownEntities count:', context.knownEntities?.length || 0);
  console.log('[Analyze] buildPersonalSystemPrompt - knownRelationships count:', knownRelationships.length);
  console.log('[Analyze] buildPersonalSystemPrompt - preferencesXML length:', preferencesXML?.length || 0);
  console.log('[Analyze] buildPersonalSystemPrompt - userProfile:', context.userProfile?.userName || 'none');

  if (context.knownEntities && context.knownEntities.length > 0) {
    console.log('[Analyze] Building PERSONAL memory section with entities:', JSON.stringify(context.knownEntities));

    // Phase 6.1: Deduplicate and clean entities
    const entityMap = new Map();
    for (const e of context.knownEntities) {
      // Skip corrupted entries
      if (!e.name || e.name === '[Unknown]' || e.name.includes('[Unknown]')) {
        continue;
      }
      const key = e.name.toLowerCase();
      const existing = entityMap.get(key);
      // Keep the one with better details
      if (!existing || (e.details && e.details.length > (existing.details?.length || 0))) {
        entityMap.set(key, e);
      }
    }
    const cleanedEntities = Array.from(entityMap.values());
    console.log('[Analyze] Cleaned entities count:', cleanedEntities.length);

    if (cleanedEntities.length > 0) {
      // Phase 8: Build XML-formatted entity memory with relationship context
      const entityXml = cleanedEntities.map(e => {
        const attrs = [`name="${e.name}"`, `type="${e.type}"`];
        if (e.relationship) attrs.push(`relationship="${e.relationship}"`);
        if (e.userCorrected) attrs.push(`verified="true"`);

        let description;
        if (e.type === 'pet') {
          description = e.relationship
            ? `Your ${e.relationship} (${e.details || 'pet'}) named ${e.name}`
            : `Your ${e.details || 'pet'} named ${e.name}`;
        } else if (e.relationship) {
          description = `Your ${e.relationship} named ${e.name}`;
        } else {
          description = `${e.name}, a ${e.type} you know`;
        }

        return `  <entity ${attrs.join(' ')}>${description}</entity>`;
      }).join('\n');

      // Phase 10: Build conflict detection facts
      const conflictFacts = cleanedEntities.map(e => {
        const fact = e.relationship ? `${e.name}: ${e.relationship}` : `${e.name}: ${e.type}`;
        const context = e.details ? ` (${e.details})` : '';
        return `- ${fact}${context}`;
      }).join('\n');

      memorySection = `

<known_entities>
${entityXml}
</known_entities>

CRITICAL MEMORY INSTRUCTION: When the user mentions ANY name from <known_entities>, you MUST use relationship context:
- If relationship="co-founder", say "your co-founder Sarah" not just "Sarah"
- If type="pet", say "your dog Seri" not "Seri" or "they"
- If verified="true", this was explicitly confirmed by user - ALWAYS use this info
- This memory is YOUR knowledge of the user's life - USE IT

<conflict_detection>
CHECK FOR CONTRADICTIONS with known information:

KNOWN FACTS:
${conflictFacts}

CONTRADICTION SIGNALS to watch for:
- "new job" / "started at" / "left [company]" → job change
- "broke up" / "ex" / "ended things" → relationship change
- "moved to" / "new place" / "relocated" → location change
- "sold my" / "got rid of" / "no longer have" → possession change

If you detect a contradiction between user's NEW input and KNOWN FACTS above, include this in your response:
<memory_update>
  <type>supersede</type>
  <old_fact>previous information</old_fact>
  <new_fact>new information from current input</new_fact>
  <entity_name>name of entity being updated</entity_name>
</memory_update>
</conflict_detection>

${buildPatternAwarenessPrompt(cleanedEntities)}
${buildRelationshipContext(knownRelationships, cleanedEntities)}
${buildProactiveContext(text, cleanedEntities)}
`;
      console.log('[Analyze] PERSONAL memory section created (with conflict detection + pattern awareness + Phase 10.2 proactive relevance), length:', memorySection.length);
    } else {
      console.log('[Analyze] All entities filtered out during cleaning');
    }
  } else {
    console.log('[Analyze] No PERSONAL memory section - knownEntities empty or missing');
  }

  let prompt = `You are a thoughtful companion helping someone process personal moments, memories, and feelings.
${userProfileSection}${memorySection}${firstNoteSection}
${CRITICAL_LANGUAGE_RULE}
CRITICAL: You are a MIRROR, not an advisor. Your job is to reflect what the user shared and help them see it more clearly.

## ABSOLUTELY DO NOT:
- Generate any actions or to-do items
- Suggest therapy, counseling, or support groups
- Give advice of any kind
- Tell them what to do
- Include an "actions" field in your response

This is REFLECTION, not intervention. The output JSON should have NO actions field.

Analyze this personal note and return JSON with these fields:

1. title: 2-6 words that are EVOCATIVE, not functional.
   ❌ "Care Bear Memory" (functional, boring)
   ✅ "A Piece of Childhood" (evocative, meaningful)
   ❌ "School Drive-By" (functional)
   ✅ "Passing Through the Past" (evocative)

2. mood: Detect the emotional tone. Examples: nostalgic, grateful, anxious, hopeful, reflective, bittersweet, warm, melancholic, peaceful

3. whatYouShared: Cleaned transcript preserving emotional tone. Fix punctuation, capitalization, grammar. Remove filler words (um, uh, like, you know). PRESERVE the emotional tone and voice. Do NOT summarize.

4. whatThisReveals: NOT a summary. A 2-4 sentence reflection that shows the user something about themselves.
   - Must be specific to THIS note, not generic
   - Tone: warm and thoughtful, like a close friend noticing something meaningful
   - Can reference what the content might mean emotionally
   - NEVER suggest actions, therapy, or what they "should" do

5. questionToSitWith: A Socratic question based on THIS specific note. Must prompt genuine reflection.
   ❌ "How does this make you feel?" (generic)
   ❌ "What do you think this means?" (generic)
   ❌ "Have you considered talking to someone?" (advice)
   ✅ "What were you feeling right before this memory surfaced?" (specific)
   ✅ "If that version of you could see your life now, what would surprise them most?" (specific)

6. memoryTags: Array of relevant tags (people mentioned, places, time periods, themes). Max 5.

7. category: Always "personal" for personal mode.

## BANNED PHRASES — Never use these:
- "That's a beautiful memory"
- "It's important to cherish..."
- "Take time to reflect on..."
- "This shows your growth"
- "You should feel proud"
- "This is valuable to document"
- "Consider reaching out to..."
- "You might want to talk to..."
- "Seeking support could help..."
- Generic affirmations
- Any suggestion of therapy, counseling, or professional help

## EXAMPLES

### Example 1: Childhood Memory
Input: "I've loved carebears since I was a child"

Output:
{
  "title": "A Piece of Childhood",
  "mood": "nostalgic, warm",
  "whatYouShared": "I've loved Care Bears since I was a child.",
  "whatThisReveals": "Nostalgia often surfaces when we need comfort or reconnection with simpler times. Care Bears specifically represent unconditional care and emotional safety — you're drawn to symbols that remind you that warmth exists in the world.",
  "questionToSitWith": "What were you feeling right before this memory surfaced? Sometimes our minds reach for comfort objects when processing something we haven't fully named yet.",
  "memoryTags": ["childhood", "comfort", "Care Bears"],
  "category": "personal"
}

### Example 2: Place Memory
Input: "Drove past my old school today, felt weird"

Output:
{
  "title": "Passing Through the Past",
  "mood": "reflective, bittersweet",
  "whatYouShared": "Drove past my old school today. Felt weird.",
  "whatThisReveals": "'Weird' often masks more specific emotions we're not ready to name — nostalgia mixed with relief that chapter is over, or perhaps grief for who you were then. Physical places hold emotional timestamps.",
  "questionToSitWith": "If that version of you could see your life now, what would surprise them most?",
  "memoryTags": ["school", "past self", "place memory"],
  "category": "personal"
}`;

  // Phase 7: Add user preferences if available
  if (preferencesXML) {
    prompt += `

## PHASE 7: USER PREFERENCES
The following reflects what this user likes and dislikes in outputs. ADAPT your style accordingly.

${preferencesXML}

Apply these preferences to your whatThisReveals and questionToSitWith sections.
Match the depth and tone the user prefers based on their feedback history.`;
  }

  // Visual Learning: Add visual entity extraction if image present
  if (hasImage) {
    prompt += `

## VISUAL LEARNING (IMAGE PRESENT)
${VISUAL_ENTITY_INSTRUCTION}`;
  }

  return prompt;
}

/**
 * Build personal user prompt (Phase 4A)
 */
function buildPersonalUserPrompt(input) {
  return `Analyze this personal note with warmth and insight:

"""
${input.content}
"""

Input type: ${input.type || 'text'}

Return ONLY valid JSON, no markdown:
{
  "title": "...",
  "mood": "...",
  "whatYouShared": "...",
  "whatThisReveals": "...",
  "questionToSitWith": "...",
  "memoryTags": [],
  "category": "personal"
}`;
}

/**
 * Phase 5C.3: Check if action is a big task based on keywords
 */
function isBigTask(text) {
  const lower = (text || '').toLowerCase();
  const bigTaskWords = ['write', 'create', 'build', 'plan', 'design', 'develop', 'prepare', 'draft', 'research', 'outline', 'complete'];
  return bigTaskWords.some(word => lower.includes(word));
}

/**
 * Phase 5E: Get default "why" text based on action keywords
 */
function getDefaultWhy(actionText) {
  const lower = (actionText || '').toLowerCase();

  // Pet/family care - specific handling
  if (lower.match(/\bvet\b/)) return 'Because they depend on you';
  if (lower.match(/\b(dog|cat|pet)\b/)) return 'Because they depend on you';
  if (lower.match(/\b(mom|dad|parent|family)\b/)) return 'Because the connection matters';

  // Communication
  if (lower.match(/\b(call|contact|reach out|text|message|email)\b/)) return 'Because the connection matters';

  // Creating
  if (lower.match(/\b(write|draft)\b/)) return 'To get it out of your head';
  if (lower.match(/\b(create|build|make|design)\b/)) return 'To make it real';

  // Completing
  if (lower.match(/\b(complete|finish|finalize)\b/)) return 'So you can let it go';
  if (lower.match(/\b(send|submit|deliver)\b/)) return 'To move it forward';

  // Planning
  if (lower.match(/\b(plan|prepare|organize)\b/)) return 'To feel ready';
  if (lower.match(/\b(research|explore|investigate|look into)\b/)) return 'So you know where you stand';

  // Deciding
  if (lower.match(/\b(decide|choose|pick)\b/)) return 'To stop circling';

  // Checking
  if (lower.match(/\b(review|check|verify|confirm)\b/)) return 'To be sure';

  // Meetings
  if (lower.match(/\b(meet|discuss|talk|chat)\b/)) return 'To get aligned';

  // Scheduling
  if (lower.match(/\b(schedule|book|set up|appointment)\b/)) return 'To make it happen';

  // Buying
  if (lower.match(/\b(buy|order|get|purchase)\b/)) return 'One less thing to think about';

  // Fixing
  if (lower.match(/\b(fix|resolve|solve|address)\b/)) return 'To clear the blocker';

  // Following up
  if (lower.match(/\b(follow up|follow-up|ping|remind)\b/)) return 'To keep it moving';

  return 'To move forward';
}

/**
 * Phase 5E: Get default future state based on action keywords
 */
function getDefaultFutureState(actionText) {
  const lower = (actionText || '').toLowerCase();

  // Pet/vet specific
  if (lower.match(/\bvet\b/)) return '→ Appointment booked';

  // Communication
  if (lower.match(/\b(call|contact|reach out)\b/)) return '→ Connected';
  if (lower.match(/\b(email|message|text)\b/)) return '→ Sent';

  // Creating
  if (lower.match(/\b(write|draft)\b/)) return '→ Draft done';
  if (lower.match(/\b(create|build|make)\b/)) return '→ It exists';

  // Completing
  if (lower.match(/\b(complete|finish)\b/)) return '→ Done';
  if (lower.match(/\b(send|submit)\b/)) return '→ In their hands';

  // Planning
  if (lower.match(/\b(plan|prepare)\b/)) return '→ Ready';
  if (lower.match(/\b(research|explore)\b/)) return '→ Clarity';

  // Deciding
  if (lower.match(/\b(decide|choose)\b/)) return '→ Decided';

  // Checking
  if (lower.match(/\b(review|check)\b/)) return '→ Verified';

  // Meetings
  if (lower.match(/\b(meet|discuss)\b/)) return '→ Aligned';

  // Scheduling
  if (lower.match(/\b(schedule|book|appointment)\b/)) return '→ Scheduled';

  // Buying
  if (lower.match(/\b(buy|order)\b/)) return '→ Ordered';

  // Fixing
  if (lower.match(/\b(fix|resolve)\b/)) return '→ Fixed';

  return '→ Done';
}

/**
 * Phase 5E: Improved fallback action extraction
 * Extracts actions from text patterns when AI misses obvious actions
 */
function extractFallbackActions(text) {
  const actions = [];
  const seen = new Set(); // Prevent duplicates

  // Patterns that indicate actions (ordered by specificity)
  const patterns = [
    // With "I" prefix
    { regex: /\bi need to ([^.!?]+)/gi },
    { regex: /\bi have to ([^.!?]+)/gi },
    { regex: /\bi should ([^.!?]+)/gi },
    { regex: /\bi want to ([^.!?]+)/gi },
    { regex: /\bi must ([^.!?]+)/gi },

    // Without "I" prefix
    { regex: /\bneed to ([^.!?]+)/gi },
    { regex: /\bhave to ([^.!?]+)/gi },
    { regex: /\bshould ([^.!?]+)/gi },
    { regex: /\bgotta ([^.!?]+)/gi },

    // Imperative verbs at start of sentence or after punctuation
    { regex: /(?:^|[.!?]\s*)(call|email|send|finish|complete|schedule|book|prepare|write|review|check|contact|meet|discuss|fix|resolve|update|create|build|plan|research|buy|order|get|make)\s+([^.!?]+)/gim, group: 2, verbGroup: 1 },

    // "vet for X" pattern - specific handling
    { regex: /(?:call\s+)?(?:the\s+)?vet\s+for\s+(?:my\s+)?(?:dog\s+)?(\w+)/gi, prefix: 'Call vet for ' },

    // "vet" alone with context
    { regex: /\bvet\b(?!\s+for)/gi, fullMatch: 'Call the vet' },

    // "X appointment" pattern
    { regex: /\b(dentist|doctor|vet)\s*(?:appointment)?/gi, prefix: 'Book ', suffix: ' appointment' },
  ];

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(text)) !== null) {
      let actionText;

      if (pattern.fullMatch) {
        // Use the full match string directly
        actionText = pattern.fullMatch;
      } else if (pattern.verbGroup) {
        // Imperative verb pattern - combine verb + rest
        const verb = match[pattern.verbGroup];
        const rest = match[pattern.group || 2];
        actionText = `${capitalizeFirst(verb)} ${rest.trim()}`;
      } else {
        // Standard pattern with optional prefix/suffix
        const captured = match[1] || match[0];
        actionText = (pattern.prefix || '') + captured.trim() + (pattern.suffix || '');
      }

      // Clean up the action text
      actionText = actionText
        .replace(/\s+/g, ' ')
        .replace(/[,;:]+$/, '')
        .trim();

      // Capitalize first letter
      actionText = capitalizeFirst(actionText);

      // Skip if too short or already seen
      const normalizedKey = actionText.toLowerCase();
      if (actionText.length >= 5 && !seen.has(normalizedKey)) {
        // Check for duplicates with similar meaning
        const isDuplicate = Array.from(seen).some(existing =>
          existing.includes(normalizedKey) || normalizedKey.includes(existing)
        );

        if (!isDuplicate) {
          seen.add(normalizedKey);
          actions.push(normalizeAction(actionText));
        }
      }
    }
  }

  return actions.slice(0, 5); // Limit to 5 actions
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Phase 5D: Ensure actions are extracted, using fallback if AI missed them
 */
function ensureActionsExtracted(aiActions, originalText) {
  // If AI found actions, normalize and return them
  if (aiActions && Array.isArray(aiActions) && aiActions.length > 0) {
    return aiActions.map(normalizeAction);
  }

  // Otherwise, try fallback extraction
  const fallbackActions = extractFallbackActions(originalText);

  if (fallbackActions.length > 0) {
    console.log('[Analyze] AI missed actions, fallback extracted:', fallbackActions.length);
  }

  return fallbackActions;
}

/**
 * Phase 5C.5: Normalize a single action with all nudge fields
 */
function normalizeAction(action) {
  if (typeof action === 'string') {
    return {
      action: action,
      effort: 'medium',
      deadline: null,
      commitment: null,
      waiting_on: null,
      is_big_task: isBigTask(action),
      why: getDefaultWhy(action),
      future_state: getDefaultFutureState(action)
    };
  }

  const actionText = action.action || action.text || String(action);
  return {
    action: actionText,
    effort: action.effort || 'medium',
    deadline: action.deadline || null,
    commitment: action.commitment || null,
    waiting_on: action.waiting_on || null,
    is_big_task: action.is_big_task ?? isBigTask(actionText),
    why: action.why || getDefaultWhy(actionText),
    future_state: action.future_state || getDefaultFutureState(actionText)
  };
}

/**
 * Normalize response to ensure consistent structure
 * Phase 5E: Added shouldExtractActions parameter
 */
function normalizeResponse(result, rawInput, noteType, shouldExtractActions = true) {
  // Phase 5A: Handle new precision format with 'cleaned' and 'core'
  const isPrecisionFormat = result.cleaned && result.core;

  // Base response structure
  const normalized = {
    // Phase 5A: Support both 'cleaned' (new) and 'cleanedInput' (legacy)
    cleanedInput: result.cleaned || result.cleanedInput || rawInput,
    title: result.title || 'Untitled Note',
    category: result.category || 'personal',
    // Keep legacy fields for compatibility
    type: result.decision?.exists || result.decision?.isDecision ? 'decision' : 'observation',
    confidence: result.confidence || 0.7,
    // Phase 4A: Note type indicator
    noteType: noteType || 'productive'
  };

  // Personal mode fields (Phase 4A)
  if (noteType === 'personal' || result.whatThisReveals) {
    normalized.mood = result.mood || null;
    // whatYouShared is the cleaned transcript preserving emotional tone
    normalized.whatYouShared = result.whatYouShared || result.cleaned || result.cleanedInput || rawInput;
    normalized.whatThisReveals = result.whatThisReveals || null;
    normalized.questionToSitWith = result.questionToSitWith || null;
    normalized.memoryTags = Array.isArray(result.memoryTags) ? result.memoryTags : [];
    // Personal notes use whatThisReveals as summary for display
    normalized.summary = result.whatThisReveals || result.summary || '';
    normalized.insight = result.whatThisReveals || result.insight || '';
    normalized.question = result.questionToSitWith || result.question || null;
    // CRITICAL: Personal notes NEVER have actions (Phase 4 Fix)
    normalized.actions = [];
  } else if (isPrecisionFormat) {
    // Phase 5A: Precision format fields
    normalized.core = result.core;
    normalized.entities = result.entities || { people: [], dates: [], places: [] };

    // Map core fields to legacy fields for UI compatibility
    normalized.summary = result.core?.intent || '';
    normalized.insight = `${result.core?.topic || ''}. ${result.core?.emotion ? `Feeling: ${result.core.emotion}` : ''}`.trim();
    normalized.question = null; // Phase 5A doesn't have standalone question

    // Phase 5E: Only extract actions if shouldExtractActions is true
    if (shouldExtractActions) {
      normalized.actions = ensureActionsExtracted(result.actions, rawInput);
      normalized.actionDetails = normalized.actions;
    } else {
      normalized.actions = [];
      normalized.actionDetails = [];
    }
  } else {
    // Legacy productive mode fields
    normalized.summary = result.summary || '';
    normalized.insight = result.insight || '';
    normalized.question = result.question || null;
    // Phase 5E: Only extract actions if shouldExtractActions is true
    if (shouldExtractActions) {
      normalized.actions = ensureActionsExtracted(result.actions, rawInput);
      normalized.actionDetails = normalized.actions;
    } else {
      normalized.actions = [];
      normalized.actionDetails = [];
    }
  }

  // Common fields - Phase 5A decision format
  if (isPrecisionFormat && result.decision) {
    normalized.decision = {
      isDecision: result.decision.exists ?? false,
      type: null, // Phase 5A doesn't classify type
      options: result.decision.options || null,
      question: result.decision.question || null,
      hiddenAssumption: null,
      insight: null,
      resolved: false,
      resolvedAt: null
    };
  } else {
    normalized.decision = {
      isDecision: result.decision?.isDecision ?? false,
      type: result.decision?.type || null,
      options: result.decision?.options || null,
      hiddenAssumption: result.decision?.hiddenAssumption || null,
      insight: result.decision?.insight || null,
      resolved: false,
      resolvedAt: null
    };
  }

  // Shareability - derive from content if not present
  normalized.shareability = {
    ready: result.shareability?.ready ?? (normalized.category === 'work'),
    reason: result.shareability?.reason || ''
  };

  return normalized;
}

/**
 * Check if output is low quality - Phase 5A
 */
function isLowQuality(result) {
  // Phase 5A: Check for precision format
  if (result.cleaned && result.core) {
    // Check core fields are populated
    if (!result.core.topic || !result.core.emotion || !result.core.intent) {
      console.log('[Quality] Missing core fields');
      return true;
    }
    // Check cleaned text is meaningful
    if (!result.cleaned || result.cleaned.length < 20) {
      console.log('[Quality] Cleaned text too short');
      return true;
    }
    return false;
  }

  // Legacy format quality check
  if (!result || !result.insight) return true;

  const insight = result.insight.toLowerCase();

  const garbagePhrases = [
    'worth considering',
    'reflection noted',
    'interesting thought',
    'good to track',
    'these insights compound',
    'makes sense',
    'important to think about',
    'this is valuable',
    'good to recognize',
    'worth thinking about',
    'captured for future',
    'noted for reference',
    'interesting to note',
    'you might want to consider',
    'it\'s worth exploring',
    'this could be significant',
    'take some time to reflect'
  ];

  for (const phrase of garbagePhrases) {
    if (insight.includes(phrase)) {
      console.log(`[Quality] Garbage phrase detected: "${phrase}"`);
      return true;
    }
  }

  if (result.insight.length < 30) {
    console.log('[Quality] Insight too short');
    return true;
  }

  return false;
}

/**
 * Regenerate with critique
 */
async function regenerateWithFeedback(client, systemPrompt, input, badResult) {
  const critiquePrompt = `Your previous output was rejected for being too generic.

Previous insight: "${badResult.insight}"

PROBLEMS:
- The insight could apply to almost any note
- It doesn't reveal anything specific

REGENERATE with a much more specific response for this input:
"""
${input.content}
"""

Return ONLY valid JSON with the same structure.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: 'user', content: critiquePrompt }]
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
    return JSON.parse(jsonMatch[1].trim());
  } catch (error) {
    console.error('Regeneration failed:', error);
    return badResult;
  }
}

/**
 * Fallback analysis when API fails (Phase 4A: supports personal mode)
 */
function getFallbackAnalysis(content, noteType) {
  const text = content.trim();
  const lower = text.toLowerCase();

  // Decision detection
  const isDecision = lower.includes('whether') || lower.includes('deciding') ||
    lower.includes('should i') || lower.includes('torn between') ||
    (lower.includes(' or ') && (lower.includes('thinking') || lower.includes('considering')));

  // Category detection
  let category = 'personal';
  if (lower.includes('work') || lower.includes('project') || lower.includes('meeting') ||
      lower.includes('team') || lower.includes('business') || lower.includes('client')) {
    category = 'work';
  } else if (lower.includes('idea') || lower.includes('what if') || lower.includes('concept')) {
    category = 'ideas';
  }

  // Clean the input (basic)
  let cleanedInput = text
    .replace(/\b(um|uh|like|you know|so yeah|basically)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  cleanedInput = cleanedInput.charAt(0).toUpperCase() + cleanedInput.slice(1);
  if (!cleanedInput.endsWith('.') && !cleanedInput.endsWith('!') && !cleanedInput.endsWith('?')) {
    cleanedInput += '.';
  }

  // Generate title (first few words)
  const words = cleanedInput.split(' ').slice(0, 5).join(' ');
  const title = words.length > 40 ? words.substring(0, 37) + '...' : words;

  // Phase 4A: Personal mode fallback - NO actions, NO advice
  if (noteType === 'personal') {
    return {
      cleanedInput,
      title,
      category: 'personal',
      noteType: 'personal',
      mood: 'reflective',
      whatYouShared: cleanedInput, // Cleaned transcript preserving emotional tone
      whatThisReveals: 'This moment was worth capturing. There may be more beneath the surface worth exploring.',
      questionToSitWith: 'What prompted you to voice this thought right now?',
      memoryTags: [],
      summary: cleanedInput,
      insight: 'This moment was worth capturing.',
      question: 'What prompted you to voice this thought right now?',
      actions: [], // CRITICAL: Personal notes NEVER have actions
      shareability: { ready: false, reason: 'Personal reflection' },
      decision: { isDecision: false, type: null, options: null, hiddenAssumption: null, insight: null, resolved: false, resolvedAt: null },
      type: 'observation',
      confidence: 0.5
    };
  }

  // Extract actions (basic) - productive mode with Phase 5A format
  const actions = [];
  const actionPatterns = [
    /need to ([^.!?]+)/gi,
    /should ([^.!?]+)/gi,
    /have to ([^.!?]+)/gi,
    /going to ([^.!?]+)/gi
  ];
  // Phase 5C.5: Use normalizeAction() for complete action objects
  actionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const action = match[1].trim();
      if (action.length > 3 && action.length < 100) {
        const actionText = action.charAt(0).toUpperCase() + action.slice(1);
        actions.push(normalizeAction(actionText));
      }
    }
  });

  // Phase 5A: Return precision format for productive mode
  return {
    cleaned: cleanedInput,
    cleanedInput, // Legacy compatibility
    title,
    core: {
      topic: title,
      emotion: isDecision ? 'uncertain' : 'neutral',
      intent: isDecision ? 'Making a decision' : 'Processing thoughts'
    },
    entities: {
      people: [],
      dates: [],
      places: []
    },
    actions: [...new Set(actions.map(a => a.action))].slice(0, 5).map(action => ({
      action,
      effort: 'medium',
      deadline: null
    })),
    actionDetails: actions,
    decision: {
      exists: isDecision,
      question: isDecision ? 'What would you regret more: choosing wrong, or not choosing at all?' : null,
      options: null
    },
    category,
    noteType: 'productive',
    // Legacy fields for UI compatibility
    summary: cleanedInput,
    insight: isDecision
      ? "There's a tradeoff here you haven't fully articulated."
      : "There's something beneath this that prompted you to voice it now.",
    question: isDecision
      ? "What would you regret more: choosing wrong, or not choosing at all?"
      : "What does this tell you about what you should do next?",
    shareability: {
      ready: !isDecision && category === 'work',
      reason: isDecision ? 'Personal deliberation' : 'Ready for sharing'
    },
    type: isDecision ? 'decision' : 'observation',
    confidence: 0.5
  };
}

/**
 * Handle refine mode - re-analyze with user's answer (Phase 3c)
 */
async function handleRefine(req, res) {
  const { input, context } = req.body;
  const { question, answer } = context || {};

  if (!input?.content || !question || !answer) {
    return res.status(400).json({ error: 'Missing required fields for refine' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const prompt = `You previously analyzed a note and asked a clarifying question. The user has now answered.

ORIGINAL NOTE:
"${input.content}"

YOUR QUESTION:
"${question}"

USER'S ANSWER:
"${answer}"

Now refine the analysis with this new information:

1. UPDATE SUMMARY: Incorporate the specific details from their answer into a cleaner summary.

2. UPDATE ACTIONS: Make actions specific using the new information.
   - Before: "Send back response (by Friday)"
   - After: "Send Q4 projections deck to Sarah (by Friday)"

3. Keep the same format and tone.

Return ONLY valid JSON (no markdown):
{
  "summary": "updated summary with specific details from the answer",
  "actions": ["specific action 1", "specific action 2"]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();

    try {
      // Parse JSON response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
      const refined = JSON.parse(jsonMatch[1].trim());

      return res.status(200).json({
        summary: refined.summary || '',
        actions: Array.isArray(refined.actions) ? refined.actions : []
      });
    } catch (parseError) {
      console.error('Failed to parse refine response:', responseText);
      return res.status(500).json({ error: 'Failed to parse refinement response' });
    }

  } catch (error) {
    console.error('Refine API error:', error);
    return res.status(500).json({ error: 'Refinement failed' });
  }
}

/**
 * Handle reflect mode - re-analyze with tier upgrade (REFLECT feature)
 * Combines original content with user's reflection, upgrades tier
 */
async function handleReflection(req, res) {
  const { input, context } = req.body;
  const { reflection, originalTier, question } = context || {};

  if (!input?.content || !reflection) {
    return res.status(400).json({ error: 'Missing required fields for reflection' });
  }

  console.log('[Analyze] REFLECT mode - originalTier:', originalTier, 'reflection:', reflection.substring(0, 50));

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Determine upgraded tier
    let upgradedTier = 'standard';
    if (originalTier === 'standard' || originalTier === 'deep') {
      upgradedTier = 'deep';
    }
    console.log('[Analyze] REFLECT - Upgrading from', originalTier, 'to', upgradedTier);

    // Combine original content with reflection
    const combinedContent = `${input.content}

[User reflected on the question "${question || 'What does this mean to you?'}"]
"${reflection}"`;

    // Use the tiered system prompt with reflection context
    const reflectionPrompt = `${UNIFIED_ANALYSIS_PROMPT}

## SPECIAL CONTEXT: USER REFLECTION

The user initially shared a brief thought, then answered your follow-up question.
This indicates they WANT to go deeper. Provide RICHER insight than the first pass.

Your task:
1. Connect what they originally said to what they reflected
2. Find the THREAD between the original note and their reflection
3. Surface something they might not have seen themselves
4. The reflection reveals what matters most - honor that

DO NOT just summarize what they said. INTERPRET it.`;

    const userPrompt = buildTieredUserPrompt(combinedContent, upgradedTier, context);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.6,
      system: reflectionPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const responseText = message.content[0].text.trim();
    console.log('[Analyze] REFLECT - Raw response:', responseText.substring(0, 300));

    try {
      // Parse JSON response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
      let jsonStr = jsonMatch[1].trim();

      // Clean up JSON if needed
      if (!jsonStr.startsWith('{')) {
        const startIdx = jsonStr.indexOf('{');
        if (startIdx !== -1) {
          jsonStr = jsonStr.substring(startIdx);
        }
      }
      if (!jsonStr.endsWith('}')) {
        const endIdx = jsonStr.lastIndexOf('}');
        if (endIdx !== -1) {
          jsonStr = jsonStr.substring(0, endIdx + 1);
        }
      }

      const analysis = JSON.parse(jsonStr);

      // Force the upgraded tier
      analysis.tier = upgradedTier;
      analysis.upgradedFromReflection = true;

      console.log('[Analyze] REFLECT - Parsed analysis, tier:', analysis.tier, 'heard:', analysis.heard?.substring(0, 50));

      return res.status(200).json(analysis);

    } catch (parseError) {
      console.error('[Analyze] REFLECT - Failed to parse response:', responseText.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse reflection response' });
    }

  } catch (error) {
    console.error('[Analyze] REFLECT API error:', error);
    return res.status(500).json({ error: 'Reflection analysis failed' });
  }
}
