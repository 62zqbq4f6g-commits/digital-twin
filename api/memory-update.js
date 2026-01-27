/**
 * MEM0 BUILD 3: Memory Update API
 * Core Mem0 innovation - LLM decides ADD/UPDATE/DELETE/NOOP via tool calling
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

// Tools for Claude to select memory operations
const MEMORY_UPDATE_TOOLS = [
  {
    name: "add_memory",
    description: "Add a new memory when no semantically equivalent memory exists. Use for genuinely new information that provides unique value.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The memory content to store, written clearly and concisely"
        },
        memory_type: {
          type: "string",
          enum: ["entity", "fact", "preference", "event", "goal", "procedure", "decision", "action"],
          description: "The type of memory"
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this is a new memory worth storing"
        }
      },
      required: ["content", "memory_type", "reasoning"]
    }
  },
  {
    name: "update_memory",
    description: "Update an existing memory with new, more detailed, or corrected information",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the existing memory to update"
        },
        new_content: {
          type: "string",
          description: "The updated memory content"
        },
        merge_strategy: {
          type: "string",
          enum: ["replace", "append", "supersede"],
          description: "How to merge: 'replace' overwrites completely (corrections, job changes), 'append' adds detail (more info about same thing), 'supersede' marks old as historical and creates new (life changes)"
        },
        reasoning: {
          type: "string",
          description: "Why this memory needs updating and what changed"
        }
      },
      required: ["memory_id", "new_content", "merge_strategy", "reasoning"]
    }
  },
  {
    name: "delete_memory",
    description: "Delete a memory that is contradicted by new information or explicitly requested to be forgotten",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to delete"
        },
        hard_delete: {
          type: "boolean",
          description: "True ONLY if user explicitly said 'forget', 'don't remember', 'delete'. False for contradiction-based removal (archives instead)"
        },
        reasoning: {
          type: "string",
          description: "Why this memory should be removed"
        }
      },
      required: ["memory_id", "hard_delete", "reasoning"]
    }
  },
  {
    name: "no_operation",
    description: "No change needed - the information already exists in equivalent form, is too trivial, or is conversational noise",
    input_schema: {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Why no operation is needed"
        },
        existing_memory_id: {
          type: "string",
          description: "If info already exists, the ID of that memory"
        }
      },
      required: ["reasoning"]
    }
  }
];

// System prompt for memory manager LLM
const UPDATE_SYSTEM_PROMPT = `You are a memory manager for a personal AI assistant called Inscript.

Your job is to decide how to handle a new piece of information by comparing it to existing memories.

## DECISION FRAMEWORK

### ADD - Use when:
- No similar memory exists (similarity < 50%)
- Information is genuinely new and worth remembering
- The fact provides unique value for future personalization

### UPDATE - Use when similar memory exists:
- **replace**: Direct correction or complete change
  - Name misspelling: "Mike" → "Michael"
  - Job change: "works at Google" → "works at Notion"
  - Factual correction: "born in March" → "born in May"

- **append**: Adding detail to existing memory
  - "likes coffee" → "likes coffee, especially cold brew from Blue Bottle"
  - "has a dog" → "has a golden retriever named Max"

- **supersede**: Life change that makes old info historical (not wrong, just past)
  - "lives in NYC" + "moved to SF" → mark NYC as historical, create SF as current
  - "dating Sarah" + "engaged to Sarah" → supersede with new relationship status

### DELETE - Use when:
- New information directly contradicts existing memory
- User explicitly says "forget", "don't remember", "delete this"
- **hard_delete=true** ONLY for explicit user deletion requests
- **hard_delete=false** for contradiction (archives instead of permanent delete)

### NOOP - Use when:
- Information already exists in equivalent form
- Information is too trivial (greetings, acknowledgments, "okay", "thanks")
- It's general knowledge not specific to the user
- Confidence is too low (<50%)

## CRITICAL RULES

1. **NEVER store**: passwords, SSNs, credit card numbers, API keys
2. **Be conservative with DELETE**: Prefer UPDATE with supersede
3. **Detect temporal context**: "used to work at" = historical, not delete
4. **Handle recurrence**: "every Monday" = recurring event pattern
5. **Respect sensitivity**: Health, death, finances need sensitivity_level
6. **Preserve history**: Supersede creates audit trail, don't lose information
7. **Consider importance**: Critical/high importance memories need stronger evidence to change

## OUTPUT

Call exactly ONE tool based on your decision. Include clear reasoning.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, candidateFact, similarMemories, sourceNoteId, jobId } = req.body;
  const startTime = Date.now();

  if (!userId || !candidateFact) {
    return res.status(400).json({ error: 'userId and candidateFact required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Build prompt with context
  const userPrompt = buildUpdatePrompt(candidateFact, similarMemories);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: UPDATE_SYSTEM_PROMPT,
      tools: MEMORY_UPDATE_TOOLS,
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Extract tool use
    const toolUse = response.content.find(c => c.type === 'tool_use');

    if (!toolUse) {
      // Default to NOOP
      await logOperation(supabase, userId, 'NOOP', candidateFact, similarMemories,
        { reasoning: 'No tool called by LLM' }, null, jobId, sourceNoteId, Date.now() - startTime);

      return res.json({
        operation: 'NOOP',
        reasoning: 'No clear action determined',
        processing_time_ms: Date.now() - startTime
      });
    }

    // Execute the operation
    const result = await executeOperation(
      supabase,
      userId,
      toolUse.name,
      toolUse.input,
      candidateFact,
      jobId,
      sourceNoteId,
      similarMemories,
      startTime
    );

    return res.json(result);

  } catch (error) {
    console.error('Memory update error:', error);
    return res.status(500).json({ error: 'Memory update failed' });
  }
}

function buildUpdatePrompt(fact, similarMemories) {
  let prompt = `## NEW INFORMATION TO PROCESS

**Content**: "${fact.content || fact.summary || fact.name}"
**Type**: ${fact.memory_type || 'unknown'}
**Entity**: ${fact.name || 'N/A'}
**Sentiment**: ${fact.sentiment ?? 'neutral'}
**Importance**: ${fact.importance || 'medium'}
**Confidence**: ${fact.confidence ?? 0.8}
`;

  if (fact.is_historical) prompt += `**Historical**: Yes (past information)\n`;
  if (fact.effective_from) prompt += `**Starts**: ${fact.effective_from}\n`;
  if (fact.expires_at) prompt += `**Expires**: ${fact.expires_at}\n`;
  if (fact.recurrence_pattern) prompt += `**Recurrence**: ${JSON.stringify(fact.recurrence_pattern)}\n`;
  if (fact.sensitivity_level && fact.sensitivity_level !== 'normal') {
    prompt += `**Sensitivity**: ${fact.sensitivity_level}\n`;
  }

  prompt += `\n## EXISTING SIMILAR MEMORIES\n\n`;

  if (similarMemories && similarMemories.length > 0) {
    similarMemories.forEach((mem, i) => {
      prompt += `### Memory ${i + 1}
- **ID**: ${mem.id}
- **Content**: "${mem.summary || mem.name}"
- **Type**: ${mem.memory_type || mem.entity_type || 'entity'}
- **Importance**: ${mem.importance || 'medium'}
- **Last Updated**: ${mem.updated_at || 'unknown'}
- **Similarity**: ${((mem.similarity || 0) * 100).toFixed(1)}%
${mem.is_historical ? '- **Historical**: Yes\n' : ''}
`;
    });
  } else {
    prompt += `No similar existing memories found.\n`;
  }

  prompt += `\n## YOUR TASK

Analyze the new information against existing memories and decide the appropriate operation.
Call exactly ONE tool: add_memory, update_memory, delete_memory, or no_operation.`;

  return prompt;
}

async function executeOperation(supabase, userId, operation, input, candidateFact, jobId, sourceNoteId, similarMemories, startTime) {
  let result;

  switch (operation) {
    case 'add_memory':
      result = await addMemory(supabase, userId, candidateFact, input);
      break;

    case 'update_memory':
      result = await updateMemory(supabase, userId, input, candidateFact);
      break;

    case 'delete_memory':
      result = await deleteMemory(supabase, userId, input);
      break;

    case 'no_operation':
      result = {
        operation: 'NOOP',
        reasoning: input.reasoning,
        existing_memory_id: input.existing_memory_id
      };
      break;

    default:
      result = { operation: 'NOOP', reasoning: 'Unknown operation type' };
  }

  // Log to audit trail
  const processingTime = Date.now() - startTime;
  await logOperation(
    supabase,
    userId,
    result.operation || operation.replace('_memory', '').toUpperCase(),
    candidateFact,
    similarMemories,
    input,
    result.entity_id || result.new_id,
    jobId,
    sourceNoteId,
    processingTime,
    result
  );

  // Update sentiment history if entity involved
  if (result.entity_id && candidateFact.sentiment !== undefined) {
    await updateSentimentHistory(supabase, result.entity_id, candidateFact.sentiment, sourceNoteId);
  }

  result.processing_time_ms = processingTime;
  return result;
}

async function addMemory(supabase, userId, fact, input) {
  const { data, error } = await supabase
    .from('user_entities')
    .insert({
      user_id: userId,
      name: fact.name || input.content.slice(0, 100),
      entity_type: fact.entity_type || 'other',
      memory_type: input.memory_type,
      summary: input.content,
      context_notes: [fact.context || input.content],
      importance: fact.importance || 'medium',
      importance_score: getImportanceScore(fact.importance || 'medium'),
      sentiment_average: fact.sentiment || 0,
      is_historical: fact.is_historical || false,
      effective_from: fact.effective_from || null,
      expires_at: fact.expires_at || null,
      recurrence_pattern: fact.recurrence_pattern || null,
      sensitivity_level: fact.sensitivity_level || 'normal',
      status: 'active',
      version: 1,
      confidence: fact.confidence || 0.8
    })
    .select()
    .single();

  if (error) throw error;

  return {
    operation: 'ADD',
    entity_id: data.id,
    content: input.content,
    memory_type: input.memory_type,
    reasoning: input.reasoning
  };
}

async function updateMemory(supabase, userId, input, candidateFact) {
  const { memory_id, new_content, merge_strategy, reasoning } = input;

  // Fetch existing memory
  const { data: existing, error: fetchError } = await supabase
    .from('user_entities')
    .select('*')
    .eq('id', memory_id)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Memory not found: ${memory_id}`);
  }

  const oldContent = existing.summary;
  const oldVersion = existing.version || 1;

  if (merge_strategy === 'supersede') {
    // Mark old as historical, create new
    await supabase
      .from('user_entities')
      .update({
        is_historical: true,
        status: 'superseded',
        updated_at: new Date().toISOString()
      })
      .eq('id', memory_id);

    // Create new version
    const { data: newEntity, error: insertError } = await supabase
      .from('user_entities')
      .insert({
        user_id: userId,
        name: existing.name,
        entity_type: existing.entity_type,
        memory_type: existing.memory_type,
        summary: new_content,
        context_notes: [...(existing.context_notes || []), new_content].slice(-10),
        importance: existing.importance,
        importance_score: existing.importance_score,
        sentiment_average: candidateFact.sentiment ?? existing.sentiment_average,
        supersedes_id: memory_id,
        is_historical: false,
        effective_from: candidateFact.effective_from,
        expires_at: candidateFact.expires_at,
        recurrence_pattern: candidateFact.recurrence_pattern,
        sensitivity_level: candidateFact.sensitivity_level || existing.sensitivity_level,
        status: 'active',
        version: oldVersion + 1
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update back-reference
    await supabase
      .from('user_entities')
      .update({ superseded_by: newEntity.id })
      .eq('id', memory_id);

    return {
      operation: 'UPDATE',
      strategy: 'supersede',
      old_id: memory_id,
      new_id: newEntity.id,
      entity_id: newEntity.id,
      old_content: oldContent,
      new_content,
      old_version: oldVersion,
      new_version: oldVersion + 1,
      reasoning
    };

  } else if (merge_strategy === 'append') {
    // Add detail to existing
    const mergedContent = `${existing.summary}. ${new_content}`;

    const { error: updateError } = await supabase
      .from('user_entities')
      .update({
        summary: mergedContent,
        context_notes: [...(existing.context_notes || []), new_content].slice(-10),
        version: oldVersion + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', memory_id);

    if (updateError) throw updateError;

    return {
      operation: 'UPDATE',
      strategy: 'append',
      entity_id: memory_id,
      old_content: oldContent,
      new_content: mergedContent,
      old_version: oldVersion,
      new_version: oldVersion + 1,
      reasoning
    };

  } else {
    // Replace completely
    const { error: updateError } = await supabase
      .from('user_entities')
      .update({
        summary: new_content,
        context_notes: [...(existing.context_notes || []), new_content].slice(-10),
        version: oldVersion + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', memory_id);

    if (updateError) throw updateError;

    return {
      operation: 'UPDATE',
      strategy: 'replace',
      entity_id: memory_id,
      old_content: oldContent,
      new_content,
      old_version: oldVersion,
      new_version: oldVersion + 1,
      reasoning
    };
  }
}

async function deleteMemory(supabase, userId, input) {
  const { memory_id, hard_delete, reasoning } = input;

  // Fetch for audit
  const { data: existing } = await supabase
    .from('user_entities')
    .select('*')
    .eq('id', memory_id)
    .single();

  if (!existing) {
    throw new Error(`Memory not found: ${memory_id}`);
  }

  if (hard_delete) {
    // Permanent deletion (user explicitly requested)
    await supabase
      .from('user_entities')
      .delete()
      .eq('id', memory_id);
  } else {
    // Soft delete (archive) - preserves history
    await supabase
      .from('user_entities')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', memory_id);
  }

  return {
    operation: 'DELETE',
    entity_id: memory_id,
    hard_delete,
    deleted_content: existing.summary,
    deleted_snapshot: existing,
    reasoning
  };
}

async function logOperation(supabase, userId, operation, fact, similarMemories, input, entityId, jobId, sourceNoteId, processingTime, result = {}) {
  try {
    await supabase
      .from('memory_operations')
      .insert({
        user_id: userId,
        operation,
        candidate_fact: typeof fact === 'string' ? fact : (fact.content || fact.summary || fact.name),
        candidate_memory_type: fact.memory_type,
        similar_memories: similarMemories?.map(m => ({
          id: m.id,
          content: m.summary,
          similarity: m.similarity
        })),
        llm_reasoning: input.reasoning,
        entity_id: entityId,
        merge_strategy: result.strategy,
        old_content: result.old_content,
        new_content: result.new_content || input.content,
        old_version: result.old_version,
        new_version: result.new_version,
        hard_delete: input.hard_delete,
        deleted_entity_snapshot: result.deleted_snapshot,
        job_id: jobId,
        source_note_id: sourceNoteId,
        processing_time_ms: processingTime
      });
  } catch (error) {
    console.error('Error logging operation:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

async function updateSentimentHistory(supabase, entityId, sentiment, sourceNoteId) {
  try {
    await supabase
      .from('entity_sentiment_history')
      .insert({
        entity_id: entityId,
        sentiment,
        source_note_id: sourceNoteId
      });

    // Update average on entity
    const { data: history } = await supabase
      .from('entity_sentiment_history')
      .select('sentiment')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (history?.length) {
      const avg = history.reduce((sum, h) => sum + h.sentiment, 0) / history.length;
      await supabase
        .from('user_entities')
        .update({ sentiment_average: avg })
        .eq('id', entityId);
    }
  } catch (error) {
    console.error('Error updating sentiment history:', error);
    // Don't throw - sentiment update failure shouldn't break the main operation
  }
}

function getImportanceScore(importance) {
  const scores = {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
    trivial: 0.1
  };
  return scores[importance] || 0.5;
}

// ============================================
// SPRINT 2: Structured Facts Storage
// ============================================

/**
 * Save structured facts to entity_facts table
 * Called after entity extraction with facts array
 *
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {Array} facts - Array of facts from extraction
 * @param {Object} entityMap - Map of entity names to entity IDs
 * @param {string} sourceNoteId - Source note ID (optional)
 */
export async function saveFacts(supabase, userId, facts, entityMap, sourceNoteId = null) {
  if (!facts || facts.length === 0) {
    return { saved: 0, skipped: 0, errors: [] };
  }

  const results = { saved: 0, skipped: 0, errors: [] };

  for (const fact of facts) {
    try {
      // Find entity ID for this fact
      const entityId = entityMap[fact.entity_name] || entityMap[fact.entity_name?.toLowerCase()];

      if (!entityId) {
        console.warn(`[SaveFacts] No entity found for fact: ${fact.entity_name}`);
        results.skipped++;
        continue;
      }

      // Check if fact already exists (avoid duplicates)
      const { data: existing } = await supabase
        .from('entity_facts')
        .select('id, confidence')
        .eq('entity_id', entityId)
        .eq('predicate', fact.predicate)
        .eq('object_text', fact.object)
        .maybeSingle();

      if (existing) {
        // Update confidence if new confidence is higher
        if (fact.confidence > existing.confidence) {
          await supabase
            .from('entity_facts')
            .update({
              confidence: fact.confidence,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          console.log(`[SaveFacts] Updated confidence for existing fact: ${fact.entity_name} ${fact.predicate} ${fact.object}`);
        }
        results.skipped++;
        continue;
      }

      // Check if object is another entity
      let objectEntityId = null;
      if (fact.object_is_entity && fact.object) {
        objectEntityId = entityMap[fact.object] || entityMap[fact.object?.toLowerCase()];
      }

      // Insert new fact
      const { error: insertError } = await supabase
        .from('entity_facts')
        .insert({
          user_id: userId,
          entity_id: entityId,
          predicate: fact.predicate,
          object_text: fact.object,
          object_entity_id: objectEntityId,
          confidence: fact.confidence || 0.8,
          source_note_id: sourceNoteId
        });

      if (insertError) {
        console.error(`[SaveFacts] Error inserting fact:`, insertError);
        results.errors.push({ fact, error: insertError.message });
        continue;
      }

      results.saved++;
      console.log(`[SaveFacts] Saved fact: ${fact.entity_name} ${fact.predicate} ${fact.object}`);

    } catch (error) {
      console.error(`[SaveFacts] Error processing fact:`, error);
      results.errors.push({ fact, error: error.message });
    }
  }

  console.log(`[SaveFacts] Complete: ${results.saved} saved, ${results.skipped} skipped, ${results.errors.length} errors`);
  return results;
}

/**
 * Get all facts for an entity
 */
export async function getEntityFacts(supabase, entityId) {
  const { data, error } = await supabase
    .from('entity_facts')
    .select(`
      id,
      predicate,
      object_text,
      object_entity_id,
      confidence,
      created_at,
      updated_at
    `)
    .eq('entity_id', entityId)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[GetEntityFacts] Error:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all facts for a user (for export)
 */
export async function getUserFacts(supabase, userId) {
  const { data, error } = await supabase
    .from('entity_facts')
    .select(`
      id,
      entity_id,
      predicate,
      object_text,
      object_entity_id,
      confidence,
      source_note_id,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GetUserFacts] Error:', error);
    return [];
  }

  return data || [];
}
