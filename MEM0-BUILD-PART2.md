# MEM0 BUILD - PART 2: BUILDS 3-4
## BUILD 3: UPDATE PHASE (CORE MEM0 INNOVATION)

### 3.1 Memory Update Tools

```javascript
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
```

### 3.2 Update System Prompt

```javascript
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
```

### 3.3 Memory Update API

```javascript
// api/memory-update.js

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, candidateFact, similarMemories, sourceNoteId, jobId } = req.body;
  const startTime = Date.now();

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
    return res.status(500).json({ error: error.message });
  }
}

function buildUpdatePrompt(fact, similarMemories) {
  let prompt = `## NEW INFORMATION TO PROCESS

**Content**: "${fact.content}"
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
        status: 'superseded'
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
  await supabase
    .from('memory_operations')
    .insert({
      user_id: userId,
      operation,
      candidate_fact: typeof fact === 'string' ? fact : fact.content,
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
}

async function updateSentimentHistory(supabase, entityId, sentiment, sourceNoteId) {
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
```

### 3.4 Integration with analyze.js

```javascript
// Add to api/analyze.js after entity extraction

// After existing entity extraction...
const extractedEntities = await extractEntities(noteContent, userContext);

// Check if UPDATE phase should run
const shouldRunUpdatePhase = extractedEntities && extractedEntities.length > 0;

if (shouldRunUpdatePhase) {
  // Generate embeddings for extracted facts
  const factsWithEmbeddings = await Promise.all(
    extractedEntities.map(async (entity) => {
      const textToEmbed = entity.summary || entity.content || entity.name;
      const embedding = await generateEmbedding(textToEmbed);
      return { ...entity, embedding };
    })
  );

  // Process each fact through UPDATE phase
  const updateResults = await Promise.all(
    factsWithEmbeddings.map(async (fact) => {
      // Find similar existing memories (K=10)
      const { data: similar } = await supabase.rpc('match_entities', {
        query_embedding: fact.embedding,
        match_threshold: 0.5,
        match_count: 10,
        p_user_id: userId
      });

      // Decide: async or sync processing
      if (process.env.ASYNC_MEMORY_UPDATES === 'true') {
        // Queue for async processing
        return queueMemoryJob(supabase, userId, 'update', {
          fact,
          similar_memories: similar || [],
          source_note_id: noteId
        }, { priority: 3 });
      } else {
        // Process synchronously
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/memory-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              candidateFact: fact,
              similarMemories: similar || [],
              sourceNoteId: noteId
            })
          });
          return response.json();
        } catch (error) {
          console.error('Memory update error:', error);
          return { operation: 'ERROR', error: error.message };
        }
      }
    })
  );

  // Log summary of update results
  const summary = {
    total: updateResults.length,
    added: updateResults.filter(r => r.operation === 'ADD').length,
    updated: updateResults.filter(r => r.operation === 'UPDATE').length,
    deleted: updateResults.filter(r => r.operation === 'DELETE').length,
    noop: updateResults.filter(r => r.operation === 'NOOP').length
  };
  
  console.log('Memory update summary:', summary);
}

// Continue with rest of analyze.js...
```

---

## BUILD 4: GRAPH RELATIONSHIPS ENHANCEMENT

### 4.1 Enhance entity_relationships Table

```sql
-- =====================================================
-- Enhance entity_relationships for graph memory
-- =====================================================

-- Add temporal tracking to relationships
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Add relationship strength (0-1)
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS strength FLOAT DEFAULT 0.5 
CHECK (strength >= 0 AND strength <= 1);

-- Add active flag for temporal reasoning
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add relationship metadata
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add confidence score
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.8
CHECK (confidence >= 0 AND confidence <= 1);

-- Unique constraint for relationship type between entities
ALTER TABLE entity_relationships
ADD CONSTRAINT unique_relationship 
UNIQUE (source_entity_id, target_entity_id, relationship_type);

-- =====================================================
-- Indexes for graph traversal
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_relationships_source 
ON entity_relationships(source_entity_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_target 
ON entity_relationships(target_entity_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_type 
ON entity_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_strength 
ON entity_relationships(strength DESC) 
WHERE is_active = true;
```

### 4.2 Entity Sentiment History Table

```sql
-- =====================================================
-- Track sentiment changes over time per entity
-- =====================================================

CREATE TABLE IF NOT EXISTS entity_sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  
  -- Sentiment value (-1 to 1)
  sentiment FLOAT NOT NULL CHECK (sentiment >= -1 AND sentiment <= 1),
  
  -- Context for this sentiment reading
  context TEXT,
  
  -- Source note that triggered this
  source_note_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_entity 
ON entity_sentiment_history(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_time 
ON entity_sentiment_history(created_at DESC);

-- =====================================================
-- Function to get sentiment trajectory
-- =====================================================

CREATE OR REPLACE FUNCTION get_sentiment_trajectory(
  p_entity_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  avg_sentiment FLOAT,
  min_sentiment FLOAT,
  max_sentiment FLOAT,
  reading_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    AVG(sentiment)::FLOAT as avg_sentiment,
    MIN(sentiment)::FLOAT as min_sentiment,
    MAX(sentiment)::FLOAT as max_sentiment,
    COUNT(*)::INTEGER as reading_count
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function to detect sentiment trends
-- =====================================================

CREATE OR REPLACE FUNCTION get_sentiment_trend(
  p_entity_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  trend TEXT,
  change_percent FLOAT,
  current_avg FLOAT,
  previous_avg FLOAT
) AS $$
DECLARE
  v_current FLOAT;
  v_previous FLOAT;
  v_change FLOAT;
BEGIN
  -- Current period average
  SELECT AVG(sentiment) INTO v_current
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;

  -- Previous period average
  SELECT AVG(sentiment) INTO v_previous
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days * 2 || ' days')::INTERVAL
    AND created_at <= NOW() - (p_days || ' days')::INTERVAL;

  -- Calculate change
  IF v_previous IS NOT NULL AND v_previous != 0 THEN
    v_change := ((v_current - v_previous) / ABS(v_previous)) * 100;
  ELSE
    v_change := 0;
  END IF;

  RETURN QUERY SELECT
    CASE
      WHEN v_change > 10 THEN 'improving'
      WHEN v_change < -10 THEN 'declining'
      ELSE 'stable'
    END as trend,
    v_change as change_percent,
    v_current as current_avg,
    v_previous as previous_avg;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Graph Traversal Function

```sql
-- =====================================================
-- Traverse entity graph to find connections
-- =====================================================

CREATE OR REPLACE FUNCTION traverse_entity_graph(
  p_entity_id UUID,
  p_user_id UUID,
  p_max_depth INTEGER DEFAULT 2,
  p_min_strength FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  relationship_path TEXT[],
  relationship_types TEXT[],
  total_strength FLOAT,
  depth INTEGER
) AS $$
WITH RECURSIVE graph_traversal AS (
  -- Base case: start entity
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.entity_type,
    ARRAY[]::TEXT[] as relationship_path,
    ARRAY[]::TEXT[] as relationship_types,
    1.0::FLOAT as total_strength,
    0 as depth
  FROM user_entities e
  WHERE e.id = p_entity_id
    AND e.user_id = p_user_id
    AND e.status = 'active'

  UNION ALL

  -- Recursive case: follow relationships
  SELECT 
    CASE 
      WHEN r.source_entity_id = gt.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END as entity_id,
    e.name as entity_name,
    e.entity_type,
    gt.relationship_path || e.name,
    gt.relationship_types || r.relationship_type,
    gt.total_strength * r.strength,
    gt.depth + 1
  FROM graph_traversal gt
  JOIN entity_relationships r ON (
    r.source_entity_id = gt.entity_id OR r.target_entity_id = gt.entity_id
  )
  JOIN user_entities e ON (
    e.id = CASE 
      WHEN r.source_entity_id = gt.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END
  )
  WHERE gt.depth < p_max_depth
    AND r.is_active = true
    AND r.strength >= p_min_strength
    AND e.status = 'active'
    AND e.user_id = p_user_id
    AND NOT (e.id = ANY(
      SELECT unnest(
        ARRAY(SELECT id FROM user_entities WHERE name = ANY(gt.relationship_path))
      )
    )) -- Prevent cycles
)
SELECT DISTINCT ON (entity_id)
  entity_id,
  entity_name,
  entity_type,
  relationship_path,
  relationship_types,
  total_strength,
  depth
FROM graph_traversal
WHERE depth > 0 -- Exclude start entity
ORDER BY entity_id, total_strength DESC;
$$ LANGUAGE sql;
```

---

