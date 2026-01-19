# Phase 10.6-10.8: Complete Mem0 Parity

## Objective
Close the final Mem0 gaps:
1. **Cross-Memory Reasoning** — Infer connections between entities
2. **Importance Classification** — Rank memories by significance
3. **Automatic Forgetting** — Decay irrelevant memories over time

All builds are ADDITIVE. Chrome MCP handles all testing.

## Required Browser Tabs
1. Digital Twin app: https://digital-twin-ecru.vercel.app
2. Supabase SQL Editor
3. Vercel Logs

---

# PART 1: DATABASE SCHEMA UPDATES

Run in Supabase SQL Editor:

```sql
-- Add importance and decay fields to user_entities
ALTER TABLE user_entities 
ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'medium' CHECK (importance IN ('critical', 'high', 'medium', 'low', 'trivial')),
ADD COLUMN IF NOT EXISTS importance_score DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS decay_rate DECIMAL(3,2) DEFAULT 0.1,
ADD COLUMN IF NOT EXISTS last_decay_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS inferred_connections JSONB DEFAULT '[]';

-- Add importance to entity_relationships
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'medium' CHECK (importance IN ('critical', 'high', 'medium', 'low', 'trivial')),
ADD COLUMN IF NOT EXISTS inferred BOOLEAN DEFAULT FALSE;

-- Create table for cross-memory inferences
CREATE TABLE IF NOT EXISTS memory_inferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inference_type TEXT NOT NULL, -- 'connection', 'pattern', 'prediction'
  subject_entities TEXT[] NOT NULL, -- entities involved
  inference TEXT NOT NULL, -- the inferred fact
  confidence DECIMAL(3,2) DEFAULT 0.7,
  supporting_evidence JSONB DEFAULT '[]', -- note IDs or context that supports this
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- RLS for memory_inferences
ALTER TABLE memory_inferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own inferences" ON memory_inferences;
CREATE POLICY "Users manage own inferences" ON memory_inferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_inferences_user ON memory_inferences(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inferences_entities ON memory_inferences USING GIN(subject_entities);

-- Verify schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_entities' 
AND column_name IN ('importance', 'importance_score', 'decay_rate', 'last_decay_at', 'inferred_connections');
```

Screenshot the result.

---

# PART 2: BUILD 10.6 — Cross-Memory Reasoning

## 2.1 Create Inference API Endpoint

Create new file: `api/infer-connections.js`

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { entities, relationships, recentNotes } = req.body;
  
  if (!entities || entities.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 entities to infer connections' });
  }
  
  const entitiesContext = entities.map(e => 
    `- ${e.name} (${e.entity_type}): ${e.summary || e.context_notes?.slice(-2).join(' ') || 'No context'}`
  ).join('\n');
  
  const relationshipsContext = relationships?.length > 0
    ? `\nKnown relationships:\n${relationships.map(r => `- ${r.subject_name} ${r.predicate} ${r.object_name}`).join('\n')}`
    : '';
  
  const notesContext = recentNotes?.length > 0
    ? `\nRecent notes:\n${recentNotes.slice(0, 5).map((n, i) => `${i + 1}. ${n.content?.substring(0, 200)}`).join('\n')}`
    : '';
  
  const prompt = `Analyze these entities from a user's personal notes and infer any connections or patterns that aren't explicitly stated.

Entities:
${entitiesContext}
${relationshipsContext}
${notesContext}

Look for:
1. Implicit connections (e.g., two people who might know each other based on context)
2. Shared attributes (e.g., both work in tech, both mentioned in work contexts)
3. Patterns (e.g., user mentions this person when stressed)
4. Predictions (e.g., these two might be introduced soon based on context)

Return JSON only, no markdown:
{
  "inferences": [
    {
      "type": "connection|pattern|prediction",
      "entities": ["entity1", "entity2"],
      "inference": "clear statement of what you inferred",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}

Only include high-confidence (>0.6) inferences. Be conservative - don't make wild guesses.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0].text;
    
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('[Infer API] Parse error:', parseErr);
      return res.status(200).json({ inferences: [] });
    }
    
    // Filter low confidence
    result.inferences = (result.inferences || []).filter(i => i.confidence >= 0.6);
    
    console.log('[Infer API] Generated', result.inferences.length, 'inferences');
    
    return res.status(200).json(result);
    
  } catch (err) {
    console.error('[Infer API] Error:', err);
    return res.status(500).json({ error: 'Inference failed' });
  }
}
```

## 2.2 Add Cross-Memory Reasoning to entities.js

```javascript
// ============================================
// PHASE 10.6: Cross-Memory Reasoning
// ============================================

// Infer connections between entities
async function inferEntityConnections(userId, supabase) {
  // Get entities with enough context
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, summary, context_notes, mention_count')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('mention_count', 2)
    .order('mention_count', { ascending: false })
    .limit(20);
  
  if (!entities || entities.length < 2) {
    console.log('[Entities] Not enough entities for inference');
    return [];
  }
  
  // Get existing relationships
  const { data: relationships } = await supabase
    .from('entity_relationships')
    .select('subject_name, predicate, object_name')
    .eq('user_id', userId)
    .eq('status', 'active');
  
  // Get recent notes for context
  const { data: recentNotes } = await supabase
    .from('notes')
    .select('content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  try {
    const response = await fetch('/api/infer-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities,
        relationships: relationships || [],
        recentNotes: recentNotes || []
      })
    });
    
    if (!response.ok) {
      console.error('[Entities] Inference API failed:', response.status);
      return [];
    }
    
    const { inferences } = await response.json();
    
    // Store inferences
    for (const inference of inferences) {
      await storeInference(userId, inference, supabase);
    }
    
    console.log(`[Entities] Stored ${inferences.length} new inferences`);
    return inferences;
    
  } catch (err) {
    console.error('[Entities] Inference error:', err);
    return [];
  }
}

// Store an inference
async function storeInference(userId, inference, supabase) {
  // Check for duplicate
  const { data: existing } = await supabase
    .from('memory_inferences')
    .select('id')
    .eq('user_id', userId)
    .eq('inference', inference.inference)
    .eq('status', 'active')
    .maybeSingle();
  
  if (existing) {
    console.log('[Entities] Inference already exists, skipping');
    return null;
  }
  
  const { data, error } = await supabase
    .from('memory_inferences')
    .insert({
      user_id: userId,
      inference_type: inference.type,
      subject_entities: inference.entities,
      inference: inference.inference,
      confidence: inference.confidence,
      supporting_evidence: [{ reasoning: inference.reasoning }],
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Entities] Store inference error:', error);
    return null;
  }
  
  console.log(`[Entities] Stored inference: ${inference.inference.substring(0, 50)}...`);
  return data;
}

// Get active inferences for context injection
async function getInferencesForContext(userId, entityNames, supabase) {
  if (!entityNames || entityNames.length === 0) return [];
  
  const { data: inferences } = await supabase
    .from('memory_inferences')
    .select('inference_type, subject_entities, inference, confidence')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .overlaps('subject_entities', entityNames)
    .order('confidence', { ascending: false })
    .limit(5);
  
  return inferences || [];
}

window.Entities.inferEntityConnections = inferEntityConnections;
window.Entities.storeInference = storeInference;
window.Entities.getInferencesForContext = getInferencesForContext;
```

## 2.3 Add Inferences to Analysis Prompt

In `api/analyze.js`, add this function and integrate it:

```javascript
// Build inference context for prompt
function buildInferenceContext(inferences) {
  if (!inferences || inferences.length === 0) return '';
  
  return `
<inferred_connections>
Based on patterns in your notes, I've noticed:
${inferences.map(i => `- ${i.inference} (${Math.round(i.confidence * 100)}% confident)`).join('\n')}

These are inferences, not stated facts. Reference them naturally if relevant.
</inferred_connections>
`;
}
```

Add to the prompt builder:
```javascript
// Get inferences for mentioned entities
const entityNames = (knownEntities || []).map(e => e.name);
const inferences = await getInferencesForContext(userId, entityNames, supabase);
const inferenceContext = buildInferenceContext(inferences);

// Add to system prompt
const systemPrompt = `
${basePrompt}
${memoryContext}
${inferenceContext}
${userContext}
`;
```

---

# PART 3: BUILD 10.7 — Importance Classification

## 3.1 Create Importance Classification Endpoint

Create new file: `api/classify-importance.js`

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { entity } = req.body;
  
  if (!entity || !entity.name) {
    return res.status(400).json({ error: 'Entity required' });
  }
  
  const prompt = `Classify the importance of this entity to the user based on available context.

Entity: ${entity.name}
Type: ${entity.entity_type || 'unknown'}
Relationship: ${entity.relationship || 'unknown'}
Mentioned: ${entity.mention_count || 1} times
Context: ${(entity.context_notes || []).slice(-3).join(' | ')}

Importance levels:
- critical: Immediate family, partners, best friends, self, critical work relationships
- high: Close friends, important colleagues, significant projects, pets
- medium: Regular contacts, ongoing projects, recurring topics
- low: Acquaintances, one-time mentions, background people
- trivial: Random names, places mentioned in passing, unlikely to matter again

Return JSON only:
{
  "importance": "critical|high|medium|low|trivial",
  "importance_score": 0.0-1.0,
  "reasoning": "brief explanation",
  "signals": ["list", "of", "importance", "signals"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0].text;
    
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('[Importance API] Parse error:', parseErr);
      return res.status(200).json({ 
        importance: 'medium', 
        importance_score: 0.5,
        reasoning: 'Parse failed, defaulting to medium'
      });
    }
    
    console.log(`[Importance API] ${entity.name}: ${result.importance} (${result.importance_score})`);
    
    return res.status(200).json(result);
    
  } catch (err) {
    console.error('[Importance API] Error:', err);
    return res.status(500).json({ error: 'Classification failed' });
  }
}
```

## 3.2 Add Importance Classification to entities.js

```javascript
// ============================================
// PHASE 10.7: Importance Classification
// ============================================

const IMPORTANCE_SCORES = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
  trivial: 0.1
};

// Classify importance of an entity
async function classifyEntityImportance(userId, entityId, supabase) {
  const { data: entity } = await supabase
    .from('user_entities')
    .select('name, entity_type, relationship, context_notes, mention_count')
    .eq('id', entityId)
    .single();
  
  if (!entity) {
    console.log('[Entities] Entity not found for importance classification');
    return null;
  }
  
  // Quick heuristic for obvious cases
  const quickImportance = getQuickImportance(entity);
  if (quickImportance) {
    await updateEntityImportance(entityId, quickImportance, supabase);
    return quickImportance;
  }
  
  // Use LLM for nuanced classification
  try {
    const response = await fetch('/api/classify-importance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity })
    });
    
    if (!response.ok) {
      console.error('[Entities] Importance API failed:', response.status);
      return null;
    }
    
    const result = await response.json();
    await updateEntityImportance(entityId, result, supabase);
    
    console.log(`[Entities] Classified ${entity.name}: ${result.importance}`);
    return result;
    
  } catch (err) {
    console.error('[Entities] Importance classification error:', err);
    return null;
  }
}

// Quick heuristic for obvious importance levels
function getQuickImportance(entity) {
  const name = entity.name.toLowerCase();
  const relationship = (entity.relationship || '').toLowerCase();
  const context = (entity.context_notes || []).join(' ').toLowerCase();
  
  // Critical: family, partner
  if (relationship.match(/mom|dad|mother|father|parent|wife|husband|partner|spouse|child|son|daughter/)) {
    return { importance: 'critical', importance_score: 1.0, reasoning: 'Family member' };
  }
  
  // Critical: self-references
  if (name === 'me' || name === 'i' || name === 'myself') {
    return { importance: 'critical', importance_score: 1.0, reasoning: 'Self-reference' };
  }
  
  // High: pets
  if (entity.entity_type === 'pet' || relationship.match(/pet|dog|cat/)) {
    return { importance: 'high', importance_score: 0.8, reasoning: 'Pet' };
  }
  
  // High: best friend, close friend
  if (relationship.match(/best friend|close friend|bff/)) {
    return { importance: 'high', importance_score: 0.8, reasoning: 'Close friend' };
  }
  
  // High frequency = higher importance
  if (entity.mention_count >= 10) {
    return { importance: 'high', importance_score: 0.8, reasoning: 'Frequently mentioned' };
  }
  
  // Low frequency = lower importance
  if (entity.mention_count <= 1) {
    return { importance: 'low', importance_score: 0.3, reasoning: 'Single mention' };
  }
  
  return null; // Use LLM for nuanced cases
}

// Update entity importance in database
async function updateEntityImportance(entityId, classification, supabase) {
  const { error } = await supabase
    .from('user_entities')
    .update({
      importance: classification.importance,
      importance_score: classification.importance_score,
      updated_at: new Date().toISOString()
    })
    .eq('id', entityId);
  
  if (error) {
    console.error('[Entities] Update importance error:', error);
  }
}

// Batch classify entities that haven't been classified
async function batchClassifyImportance(userId, supabase) {
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name')
    .eq('user_id', userId)
    .eq('status', 'active')
    .or('importance.is.null,importance.eq.medium')
    .order('mention_count', { ascending: false })
    .limit(10);
  
  if (!entities || entities.length === 0) {
    console.log('[Entities] No entities need importance classification');
    return 0;
  }
  
  console.log(`[Entities] Classifying importance for ${entities.length} entities`);
  
  let count = 0;
  for (const entity of entities) {
    await classifyEntityImportance(userId, entity.id, supabase);
    count++;
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
  
  return count;
}

// Get entities sorted by importance for context
async function getEntitiesByImportance(userId, supabase, limit = 15) {
  const { data: entities } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('importance_score', { ascending: false })
    .order('mention_count', { ascending: false })
    .limit(limit);
  
  return entities || [];
}

window.Entities.classifyEntityImportance = classifyEntityImportance;
window.Entities.batchClassifyImportance = batchClassifyImportance;
window.Entities.getEntitiesByImportance = getEntitiesByImportance;
window.Entities.IMPORTANCE_SCORES = IMPORTANCE_SCORES;
```

---

# PART 4: BUILD 10.8 — Automatic Forgetting

## 4.1 Add Decay Functions to entities.js

```javascript
// ============================================
// PHASE 10.8: Automatic Forgetting
// ============================================

const DECAY_CONFIG = {
  // Days until importance starts decaying
  gracePeriosByImportance: {
    critical: Infinity, // Never decay
    high: 90,
    medium: 30,
    low: 14,
    trivial: 7
  },
  // How much to reduce importance_score per decay cycle
  decayRates: {
    critical: 0,
    high: 0.05,
    medium: 0.1,
    low: 0.15,
    trivial: 0.2
  },
  // Minimum score before archiving
  archiveThreshold: 0.1,
  // Days between decay cycles
  decayCyclesDays: 7
};

// Apply decay to stale entities
async function applyMemoryDecay(userId, supabase) {
  const decayCutoff = new Date(Date.now() - DECAY_CONFIG.decayCyclesDays * 24 * 60 * 60 * 1000).toISOString();
  
  // Get entities due for decay
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, importance, importance_score, last_mentioned_at, last_decay_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('importance', 'critical') // Never decay critical
    .lt('last_decay_at', decayCutoff);
  
  if (!entities || entities.length === 0) {
    console.log('[Entities] No entities need decay');
    return { decayed: 0, archived: 0 };
  }
  
  console.log(`[Entities] Processing decay for ${entities.length} entities`);
  
  let decayed = 0;
  let archived = 0;
  
  for (const entity of entities) {
    const result = await decayEntity(entity, supabase);
    if (result === 'decayed') decayed++;
    if (result === 'archived') archived++;
  }
  
  console.log(`[Entities] Decay complete: ${decayed} decayed, ${archived} archived`);
  return { decayed, archived };
}

// Decay a single entity
async function decayEntity(entity, supabase) {
  const importance = entity.importance || 'medium';
  const gracePeriod = DECAY_CONFIG.gracePeriosByImportance[importance];
  const decayRate = DECAY_CONFIG.decayRates[importance];
  
  // Check if entity is within grace period
  const lastMentioned = new Date(entity.last_mentioned_at || entity.created_at);
  const daysSinceMention = (Date.now() - lastMentioned.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceMention < gracePeriod) {
    // Update last_decay_at but don't decay
    await supabase
      .from('user_entities')
      .update({ last_decay_at: new Date().toISOString() })
      .eq('id', entity.id);
    return 'skipped';
  }
  
  // Apply decay
  const currentScore = entity.importance_score || 0.5;
  const newScore = Math.max(0, currentScore - decayRate);
  
  // Check if should archive
  if (newScore < DECAY_CONFIG.archiveThreshold) {
    await supabase
      .from('user_entities')
      .update({
        status: 'archived',
        importance_score: newScore,
        last_decay_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', entity.id);
    
    console.log(`[Entities] Archived ${entity.name} (score: ${newScore.toFixed(2)})`);
    return 'archived';
  }
  
  // Update with decayed score
  await supabase
    .from('user_entities')
    .update({
      importance_score: newScore,
      last_decay_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', entity.id);
  
  console.log(`[Entities] Decayed ${entity.name}: ${currentScore.toFixed(2)} → ${newScore.toFixed(2)}`);
  return 'decayed';
}

// Refresh entity (reset decay when mentioned)
async function refreshEntity(entityId, supabase) {
  const { data: entity } = await supabase
    .from('user_entities')
    .select('importance, importance_score')
    .eq('id', entityId)
    .single();
  
  if (!entity) return;
  
  // Restore score based on importance
  const baseScore = IMPORTANCE_SCORES[entity.importance] || 0.5;
  const newScore = Math.max(entity.importance_score || 0.5, baseScore);
  
  await supabase
    .from('user_entities')
    .update({
      importance_score: newScore,
      last_mentioned_at: new Date().toISOString(),
      last_decay_at: new Date().toISOString()
    })
    .eq('id', entityId);
  
  console.log(`[Entities] Refreshed entity ${entityId}: score → ${newScore.toFixed(2)}`);
}

// Clean up expired inferences
async function cleanupExpiredInferences(userId, supabase) {
  const { data, error } = await supabase
    .from('memory_inferences')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());
  
  if (error) {
    console.error('[Entities] Cleanup inferences error:', error);
    return 0;
  }
  
  console.log('[Entities] Expired inferences cleaned up');
  return data?.length || 0;
}

// Run full memory maintenance
async function runMemoryMaintenance(userId, supabase) {
  console.log('[Entities] Starting memory maintenance...');
  
  const results = {
    decay: await applyMemoryDecay(userId, supabase),
    inferencesExpired: await cleanupExpiredInferences(userId, supabase),
    importanceClassified: await batchClassifyImportance(userId, supabase),
    inferencesGenerated: (await inferEntityConnections(userId, supabase)).length
  };
  
  console.log('[Entities] Memory maintenance complete:', results);
  return results;
}

window.Entities.applyMemoryDecay = applyMemoryDecay;
window.Entities.decayEntity = decayEntity;
window.Entities.refreshEntity = refreshEntity;
window.Entities.runMemoryMaintenance = runMemoryMaintenance;
window.Entities.DECAY_CONFIG = DECAY_CONFIG;
```

## 4.2 Integrate Refresh into Entity Sync

Update entity sync to refresh on mention:

```javascript
// In syncEntityWithLLMData or equivalent, after updating an entity:
if (existing) {
  // ... existing update code ...
  
  // Refresh decay (Phase 10.8)
  await refreshEntity(existing.id, supabase);
}
```

---

# PART 5: VERSION UPDATE

In js/app.js:

```javascript
const APP_VERSION = '7.8.0'; // Phase 10.6-10.8: Complete Mem0 Parity
```

---

# PART 6: DEPLOY

```bash
vercel --prod
```

---

# PART 7: COMPREHENSIVE TESTING

## Test 7.1: Database Schema

```sql
-- Verify new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_entities' 
AND column_name IN ('importance', 'importance_score', 'decay_rate', 'last_decay_at', 'inferred_connections');

-- Verify memory_inferences table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memory_inferences';
```

## Test 7.2: Cross-Memory Reasoning

1. Ensure you have at least 2-3 entities with mentions (Marcus, Sarah, etc.)

2. Trigger inference generation in browser console:
```javascript
const userId = (await window.supabase.auth.getUser()).data.user.id;
const inferences = await window.Entities.inferEntityConnections(userId, window.supabase);
console.log('Generated inferences:', inferences);
```

3. Check database:
```sql
SELECT inference_type, subject_entities, inference, confidence, status
FROM memory_inferences 
ORDER BY created_at DESC LIMIT 10;
```

**Expected:** At least 1 inference connecting entities (e.g., "Marcus and Sarah both work in tech")

## Test 7.3: Importance Classification

1. Trigger batch classification:
```javascript
const userId = (await window.supabase.auth.getUser()).data.user.id;
const count = await window.Entities.batchClassifyImportance(userId, window.supabase);
console.log('Classified:', count);
```

2. Check classifications:
```sql
SELECT name, entity_type, mention_count, importance, importance_score
FROM user_entities 
WHERE status = 'active'
ORDER BY importance_score DESC;
```

**Expected:** Entities have varied importance levels based on context

## Test 7.4: Automatic Forgetting (Decay)

1. First, manually set an entity to low importance with old last_mentioned_at:
```sql
UPDATE user_entities 
SET importance = 'low', 
    importance_score = 0.3,
    last_mentioned_at = NOW() - INTERVAL '30 days',
    last_decay_at = NOW() - INTERVAL '14 days'
WHERE name ILIKE '%zara%' OR name ILIKE '%kevin%'
LIMIT 1;
```

2. Run decay:
```javascript
const userId = (await window.supabase.auth.getUser()).data.user.id;
const result = await window.Entities.applyMemoryDecay(userId, window.supabase);
console.log('Decay result:', result);
```

3. Check the entity:
```sql
SELECT name, importance, importance_score, last_decay_at, status
FROM user_entities 
WHERE name ILIKE '%zara%' OR name ILIKE '%kevin%';
```

**Expected:** importance_score decreased, or entity archived if below threshold

## Test 7.5: Entity Refresh on Mention

1. Create note mentioning an existing entity: "Zara sent me an interesting article about AI agents today."

2. Check if entity was refreshed:
```sql
SELECT name, importance_score, last_mentioned_at, last_decay_at
FROM user_entities 
WHERE name ILIKE '%zara%';
```

**Expected:** last_mentioned_at updated, importance_score restored

## Test 7.6: Full Memory Maintenance

1. Run full maintenance:
```javascript
const userId = (await window.supabase.auth.getUser()).data.user.id;
const results = await window.Entities.runMemoryMaintenance(userId, window.supabase);
console.log('Maintenance results:', results);
```

**Expected:** Returns object with decay, classification, and inference counts

## Test 7.7: No Regressions

1. Create new note: "Met Jordan at the startup meetup. She's working on something in climate tech."

2. Verify full flow:
```sql
SELECT name, entity_type, importance, importance_score, status
FROM user_entities WHERE name ILIKE '%jordan%';
```

**Expected:** Jordan created with default medium importance

---

# PART 8: FINAL REPORT

| Feature | Test | Result |
|---------|------|--------|
| Schema updates | 7.1 | ✅/❌ |
| Cross-memory reasoning | 7.2 | ✅/❌ |
| Importance classification | 7.3 | ✅/❌ |
| Automatic decay | 7.4 | ✅/❌ |
| Entity refresh | 7.5 | ✅/❌ |
| Full maintenance | 7.6 | ✅/❌ |
| No regressions | 7.7 | ✅/❌ |

**Phase 10.6-10.8 Status:** PASS / PARTIAL / FAIL

---

# FILES CREATED/MODIFIED SUMMARY

## New Files
- `api/infer-connections.js` — Cross-memory inference endpoint
- `api/classify-importance.js` — Importance classification endpoint

## Modified Files
- `js/entities.js` — Added ~400 lines for inference, classification, decay
- `js/app.js` — Version 7.8.0

## Database Changes
- `user_entities` — Added importance, importance_score, decay_rate, last_decay_at, inferred_connections
- `entity_relationships` — Added importance, inferred columns
- `memory_inferences` — New table for storing inferences

---

Start with PART 1. Execute all parts sequentially. Report results after PART 8.
