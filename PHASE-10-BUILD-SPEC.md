# PHASE 10: MEMORY ARCHITECTURE BUILD SPECIFICATION
## Digital Twin — The "Aha" Moment Build
## Version 7.4.0 → 7.5.0

---

# EXECUTIVE SUMMARY

**Objective:** Fix broken memory sync and implement conflict resolution to create the "aha" moment that drives PMF.

**Current State:**
- `user_entities` table: 0 rows (BUG — entities not syncing)
- `user_feedback` table: 0 rows (BUG — feedback not syncing)
- Legacy `entities` table: ~9 rows (working)
- Legacy `output_feedback` table: ~12 rows (working)

**Target State:**
- All new entities sync to `user_entities`
- All feedback syncs to `user_feedback`
- Conflict resolution detects contradictions and archives old facts
- Time decay weights recent memories higher
- Users experience "aha" moment: "It actually remembers me"

**Success Metric:** After 10 notes, user thinks "Holy shit, it actually knows me."

---

# PART 1: DIAGNOSIS

## 1.1 Database Audit

**Run in Supabase SQL Editor:**

```sql
-- Table row counts
SELECT 'entities' as table_name, COUNT(*) as rows FROM entities
UNION ALL SELECT 'user_entities', COUNT(*) FROM user_entities
UNION ALL SELECT 'user_feedback', COUNT(*) FROM user_feedback
UNION ALL SELECT 'output_feedback', COUNT(*) FROM output_feedback
UNION ALL SELECT 'user_learning_profile', COUNT(*) FROM user_learning_profile;
```

**Expected buggy state:**
| Table | Expected Rows | Status |
|-------|---------------|--------|
| entities | ~9 | ✅ Legacy working |
| user_entities | 0 | ❌ BUG |
| user_feedback | 0 | ❌ BUG |
| output_feedback | ~12 | ✅ Legacy working |

## 1.2 Schema Verification

```sql
-- Check user_entities schema
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_entities'
ORDER BY ordinal_position;

-- Check user_feedback schema
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_feedback'
ORDER BY ordinal_position;
```

## 1.3 Codebase Audit

```bash
# Find entity storage paths
grep -rn "\.from('entities')\|\.from('user_entities')" js/*.js api/*.js

# Find feedback storage paths
grep -rn "\.from('output_feedback')\|\.from('user_feedback')" js/*.js api/*.js

# Find storage functions
grep -rn "storeEntities\|recordFeedback\|saveFeedback" js/*.js
```

**Document:**
1. Which functions write to which tables
2. Why Phase 9 tables aren't being populated
3. Root cause hypothesis

---

# PART 2: DATABASE SCHEMA FIXES

## 2.1 Create/Update user_entities Table

```sql
-- Create table if not exists with full Phase 10 schema
CREATE TABLE IF NOT EXISTS user_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'person',
  relationship TEXT,
  context TEXT,
  visual_description TEXT,
  
  -- Memory intelligence fields
  mention_count INTEGER DEFAULT 1,
  first_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Conflict resolution fields
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'superseded')),
  superseded_by UUID REFERENCES user_entities(id),
  
  verified BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for upsert (ignore if exists)
DO $$ 
BEGIN
  ALTER TABLE user_entities 
  ADD CONSTRAINT user_entities_unique_name_type 
  UNIQUE (user_id, name, type);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE user_entities ENABLE ROW LEVEL SECURITY;

-- Create policy (drop first if exists)
DROP POLICY IF EXISTS "Users manage own entities" ON user_entities;
CREATE POLICY "Users manage own entities" ON user_entities
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_entities_lookup 
ON user_entities(user_id, status, last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_entities_name 
ON user_entities(user_id, name);
```

## 2.2 Create/Update user_feedback Table

```sql
-- Create table if not exists
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('approve', 'reject', 'edit', 'comment')),
  original_content TEXT,
  edited_content TEXT,
  insight_type TEXT,
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Users manage own feedback" ON user_feedback;
CREATE POLICY "Users manage own feedback" ON user_feedback
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_feedback_user 
ON user_feedback(user_id, created_at DESC);
```

## 2.3 Verify Schema

```sql
-- Confirm both tables have correct columns
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('user_entities', 'user_feedback')
ORDER BY table_name, ordinal_position;
```

---

# PART 3: CODE FIXES

## 3.1 Fix Entity Storage (entity-memory.js)

**Location:** `js/entity-memory.js`

**Find the storeEntities function:**
```bash
grep -n "async.*storeEntities\|async.*saveEntit" js/entity-memory.js
```

**Required change:** The function must write to `user_entities` table.

**Target implementation:**

```javascript
// In the storeEntities function, after any existing entity storage logic:

// Sync to user_entities (Phase 10 intelligent memory)
async syncToUserEntities(userId, entity, supabase) {
  try {
    const { error } = await supabase
      .from('user_entities')
      .upsert({
        user_id: userId,
        name: entity.name,
        type: entity.type || 'person',
        relationship: entity.relationship || null,
        context: entity.context || entity.details || null,
        mention_count: 1,
        status: 'active',
        last_mentioned_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,name,type'
      });

    if (error) {
      console.error('[EntityMemory] user_entities sync failed:', error);
    } else {
      console.log('[EntityMemory] ✓ Synced to user_entities:', entity.name);
    }
  } catch (err) {
    console.error('[EntityMemory] Sync error:', err);
  }
}
```

**Integration point:** Call `syncToUserEntities()` for each entity in `storeEntities()`.

## 3.2 Fix Feedback Storage (feedback.js)

**Location:** `js/feedback.js` or `js/context.js`

**Find the feedback recording function:**
```bash
grep -rn "handleApprove\|handleReject\|recordFeedback" js/feedback.js js/ui.js js/context.js
```

**Required change:** Must write to `user_feedback` table.

**Target implementation:**

```javascript
// Add to feedback recording logic:

async syncToUserFeedback(feedbackData, supabase) {
  const { user_id, note_id, feedback_type, original_content, insight_type } = feedbackData;
  
  try {
    const { error } = await supabase
      .from('user_feedback')
      .insert({
        user_id,
        note_id,
        feedback_type,
        original_content,
        insight_type,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[Feedback] user_feedback insert failed:', error);
    } else {
      console.log('[Feedback] ✓ Recorded to user_feedback:', feedback_type);
    }
  } catch (err) {
    console.error('[Feedback] Sync error:', err);
  }
}
```

**Integration point:** Call after existing feedback logic in approve/reject handlers.

## 3.3 Verify Code Changes

```bash
# After making changes, verify references
grep -n "user_entities" js/entity-memory.js
grep -n "user_feedback" js/feedback.js js/context.js
```

---

# PART 4: CONFLICT RESOLUTION

## 4.1 Conflict Detection Prompt (api/analyze.js)

**Location:** `api/analyze.js` — find where known entities are injected into the prompt.

```bash
grep -n "known_entities\|knownEntities\|<entity" api/analyze.js | head -20
```

**Add conflict detection to the analysis prompt:**

```javascript
// Build conflict detection prompt when entities exist
function buildConflictDetectionPrompt(knownEntities) {
  if (!knownEntities || knownEntities.length === 0) return '';
  
  return `
<conflict_detection>
CHECK FOR CONTRADICTIONS with known information:

KNOWN FACTS:
${knownEntities.map(e => `- ${e.name}: ${e.context || e.relationship || e.type}`).join('\n')}

CONTRADICTION SIGNALS:
- "new job" / "started at" / "left [company]" → job change
- "broke up" / "ex" / "ended things" → relationship change  
- "moved to" / "new place" / "relocated" → location change
- "sold my" / "got rid of" / "no longer have" → possession change

If contradiction detected, include:
<memory_update>
  <type>supersede</type>
  <old_fact>previous information</old_fact>
  <new_fact>new information</new_fact>
  <entity_name>entity being updated</entity_name>
</memory_update>
</conflict_detection>
`;
}
```

**Integration:** Add `${buildConflictDetectionPrompt(knownEntities)}` to the system prompt.

## 4.2 Conflict Handler (entity-memory.js)

**Add new function to entity-memory.js:**

```javascript
// Handle detected memory conflicts
async handleConflict(userId, update, supabase) {
  if (!update || !update.entity_name) return;
  
  console.log('[EntityMemory] Handling conflict:', update);
  
  try {
    // Find existing entity to archive
    const { data: existing } = await supabase
      .from('user_entities')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`name.ilike.%${update.entity_name}%,context.ilike.%${update.old_fact}%`)
      .limit(1)
      .single();
    
    if (existing) {
      // Create new entity
      const { data: newEntity } = await supabase
        .from('user_entities')
        .insert({
          user_id: userId,
          name: update.entity_name,
          type: 'fact',
          context: update.new_fact,
          status: 'active',
          mention_count: 1
        })
        .select()
        .single();
      
      // Archive old entity
      await supabase
        .from('user_entities')
        .update({ 
          status: 'superseded',
          superseded_by: newEntity?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      console.log('[EntityMemory] ✓ Conflict resolved:', update.old_fact, '→', update.new_fact);
      return { resolved: true, archived: existing.id, created: newEntity?.id };
    }
  } catch (err) {
    console.error('[EntityMemory] Conflict handling error:', err);
  }
  
  return { resolved: false };
}
```

## 4.3 Parse Memory Updates (analyzer.js)

**Add to analyzer.js or where API response is processed:**

```javascript
// Parse memory update from analysis response
function parseMemoryUpdate(response) {
  if (!response) return null;
  
  const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
  const match = responseStr.match(/<memory_update>([\s\S]*?)<\/memory_update>/);
  if (!match) return null;
  
  const xml = match[1];
  return {
    type: xml.match(/<type>(.*?)<\/type>/)?.[1],
    old_fact: xml.match(/<old_fact>(.*?)<\/old_fact>/)?.[1],
    new_fact: xml.match(/<new_fact>(.*?)<\/new_fact>/)?.[1],
    entity_name: xml.match(/<entity_name>(.*?)<\/entity_name>/)?.[1]
  };
}

// Call after receiving analysis
async function processAnalysisResponse(response, userId, supabase) {
  const memoryUpdate = parseMemoryUpdate(response);
  
  if (memoryUpdate && memoryUpdate.entity_name) {
    const result = await EntityMemory.handleConflict(userId, memoryUpdate, supabase);
    
    if (result.resolved) {
      // Optionally show toast to user
      console.log('[Analyzer] Memory updated:', memoryUpdate.new_fact);
    }
  }
  
  return response;
}
```

---

# PART 5: TIME DECAY

## 5.1 Relevance Scoring (entity-memory.js)

**Add scoring function:**

```javascript
// Calculate entity relevance with time decay
calculateRelevanceScore(entity) {
  const now = Date.now();
  const lastAccessed = new Date(entity.last_accessed_at || entity.created_at).getTime();
  const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
  
  // Time decay: relevance halves every 14 days
  const recencyScore = 1 / (1 + daysSinceAccess / 14);
  
  // Frequency boost: cap at 2x for 10+ mentions
  const frequencyScore = Math.min(2, 1 + (entity.mention_count || 1) / 10);
  
  // Verified entities get boost
  const verifiedBoost = entity.verified ? 1.3 : 1.0;
  
  return recencyScore * frequencyScore * verifiedBoost;
}
```

## 5.2 Updated Context Retrieval

**Update getContextForAnalysis or equivalent:**

```javascript
async getEntitiesForContext(userId, supabase, limit = 15) {
  // Try new table first
  const { data: entities } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_accessed_at', { ascending: false })
    .limit(50);
  
  if (!entities || entities.length === 0) {
    // Fallback to legacy table
    const { data: legacy } = await supabase
      .from('entities')
      .select('*')
      .eq('user_id', userId)
      .limit(limit);
    return legacy || [];
  }
  
  // Score and sort by relevance
  const scored = entities.map(e => ({
    ...e,
    _score: this.calculateRelevanceScore(e)
  }));
  
  scored.sort((a, b) => b._score - a._score);
  
  // Update last_accessed for top entities (async, don't await)
  const topIds = scored.slice(0, limit).map(e => e.id);
  this.updateLastAccessed(topIds, supabase);
  
  return scored.slice(0, limit);
}

async updateLastAccessed(entityIds, supabase) {
  if (!entityIds || entityIds.length === 0) return;
  
  supabase
    .from('user_entities')
    .update({ last_accessed_at: new Date().toISOString() })
    .in('id', entityIds)
    .then(() => console.log('[EntityMemory] Updated last_accessed for', entityIds.length, 'entities'))
    .catch(err => console.error('[EntityMemory] last_accessed update failed:', err));
}
```

---

# PART 6: DATA MIGRATION

## 6.1 Migrate Legacy Entities

**Run in Supabase SQL Editor:**

```sql
-- Migrate from entities to user_entities
INSERT INTO user_entities (
  user_id, name, type, relationship, context,
  mention_count, verified, status,
  first_mentioned_at, last_mentioned_at, last_accessed_at,
  created_at, updated_at
)
SELECT 
  user_id,
  name,
  COALESCE(type, 'person'),
  relationship,
  COALESCE(details, context),
  COALESCE((metadata->>'mention_count')::int, 1),
  COALESCE(verified, false),
  'active',
  created_at,
  COALESCE(updated_at, created_at),
  COALESCE(updated_at, created_at),
  created_at,
  COALESCE(updated_at, created_at)
FROM entities e
WHERE NOT EXISTS (
  SELECT 1 FROM user_entities ue 
  WHERE ue.user_id = e.user_id 
  AND ue.name = e.name
)
ON CONFLICT (user_id, name, type) DO NOTHING;
```

## 6.2 Verify Migration

```sql
SELECT 
  (SELECT COUNT(*) FROM entities) as legacy_count,
  (SELECT COUNT(*) FROM user_entities) as migrated_count;
```

---

# PART 7: TESTING

## 7.1 Test Entity Sync

1. Create note: "Had coffee with Marcus today, he's thinking about leaving Stripe"
2. Wait for analysis
3. Query:
```sql
SELECT name, type, context, status, mention_count 
FROM user_entities 
WHERE name ILIKE '%marcus%' OR context ILIKE '%marcus%'
ORDER BY created_at DESC;
```
4. **Expected:** Row for Marcus exists

## 7.2 Test Feedback Sync

1. Click thumbs up on any note
2. Query:
```sql
SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;
```
3. **Expected:** Row with feedback_type = 'approve'

## 7.3 Test Conflict Resolution

1. Create note: "Marcus told me he accepted the offer at Notion"
2. Query:
```sql
SELECT name, context, status, superseded_by 
FROM user_entities 
WHERE name ILIKE '%marcus%' OR context ILIKE '%stripe%' OR context ILIKE '%notion%'
ORDER BY created_at DESC;
```
3. **Expected:**
   - Old "Stripe" entry: status = 'superseded'
   - New "Notion" entry: status = 'active'

## 7.4 Test "Aha" Moment

1. Create 3 notes mentioning "Sarah" 
2. On 4th note, analysis should reference pattern
3. **Expected:** "Sarah has been on your mind lately" or similar

---

# PART 8: DEPLOYMENT

## 8.1 Update Version

```javascript
// js/app.js (or wherever APP_VERSION is defined)
const APP_VERSION = '7.5.0'; // Phase 10: Memory Architecture
```

## 8.2 Deploy

```bash
vercel --prod
```

## 8.3 Production Verification

1. Hard refresh production app
2. Create test note with entity
3. Verify in Supabase that `user_entities` has new row
4. Give feedback, verify `user_feedback` has new row

---

# SUCCESS CRITERIA CHECKLIST

| # | Criteria | Verification | Status |
|---|----------|--------------|--------|
| 1 | `user_entities` schema correct | SQL schema query | ⬜ |
| 2 | `user_feedback` schema correct | SQL schema query | ⬜ |
| 3 | Entities sync on note create | Create note → query | ⬜ |
| 4 | Feedback syncs on approve/reject | Click → query | ⬜ |
| 5 | Legacy data migrated | Count comparison | ⬜ |
| 6 | Conflict detection in prompt | Code review | ⬜ |
| 7 | Conflict resolution works | Test with contradiction | ⬜ |
| 8 | Time decay scoring works | Code review | ⬜ |
| 9 | No console errors | DevTools check | ⬜ |
| 10 | Version = 7.5.0 | APP_VERSION check | ⬜ |
| 11 | Production deployed | vercel --prod | ⬜ |
| 12 | "Aha" moment achieved | 4th mention test | ⬜ |

---

# FILES TO MODIFY

| File | Changes |
|------|---------|
| `js/entity-memory.js` | Add user_entities sync, conflict handler, time decay |
| `js/feedback.js` | Add user_feedback sync |
| `js/analyzer.js` | Add memory update parsing |
| `api/analyze.js` | Add conflict detection prompt |
| `js/app.js` | Update APP_VERSION to 7.5.0 |

---

# CHROME MCP USAGE

All Supabase operations should be done via Chrome MCP:

1. Navigate to Supabase SQL Editor tab
2. Enter SQL queries
3. Execute and verify results
4. Screenshot evidence

**Required browser tabs:**
- Digital Twin app (https://digital-twin-ecru.vercel.app)
- Supabase SQL Editor
- Supabase Table Editor
- Vercel deployment logs

---

*Build Specification Version: 1.0*
*Target App Version: 7.5.0*
*Date: January 19, 2026*
*Estimated Time: 4 hours*
