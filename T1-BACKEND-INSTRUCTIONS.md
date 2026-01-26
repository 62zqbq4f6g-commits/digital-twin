# Terminal 1: Backend Lead — Export API

**Role:** Build the `/api/export.js` endpoint  
**Task ID:** `export-build-t1`

---

## Your Ownership

**Files you OWN (only you touch these):**
```
/api/export.js
```

**Files you CONSUME (read-only, T2 builds these):**
```
/lib/export/queries.js
/lib/export/transforms.js
/lib/export/privacy.js
```

**Files you may EDIT (coordinate, mark with `// EXPORT - T1`):**
```
/api/ (any shared utilities)
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/export-api
export CLAUDE_CODE_TASK_LIST_ID=export-build-t1
```

---

## Task 1: Create API Skeleton (Do First)

Create `/api/export.js`:

```javascript
// /api/export.js
// OWNER: T1
// STATUS: Building
// DEPENDS ON: /lib/export/* (T2 building)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - get user from session/token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user_id = user.id;
    console.log(`[Export] Starting export for user: ${user_id}`);
    const startTime = Date.now();

    // TODO: Import from T2's lib/export once ready
    // For now, build placeholder structure
    const exportData = {
      inscript_export: {
        identity: {},
        entities: [],
        episodes: {
          notes: [],
          meetings: [],
          conversations: []
        },
        patterns: [],
        meta: {
          version: "1.0.0",
          exported_at: new Date().toISOString(),
          source: "Inscript",
          note: "Full implementation pending T2 data layer"
        }
      }
    };

    const duration = Date.now() - startTime;
    console.log(`[Export] Completed in ${duration}ms`);

    // Return as downloadable JSON
    const filename = `inscript-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).json(exportData);

  } catch (error) {
    console.error('[Export] Failed:', error);
    return res.status(500).json({ error: 'Export failed', details: error.message });
  }
}
```

**Checkpoint:** API returns placeholder JSON with auth check working.

---

## Task 2: Wire T2's Data Layer (After T2 Ready)

Once T2 signals `/lib/export/queries.js` is ready, update the API:

```javascript
// /api/export.js - UPDATED
import { createClient } from '@supabase/supabase-js';
import { 
  getProfile, 
  getKeyPeople,
  getEntities, 
  getNotes, 
  getMeetings,
  getConversations,
  getPatterns 
} from '../lib/export/queries.js';
import { 
  buildIdentity, 
  transformEntity, 
  transformNote,
  transformMeeting,
  transformConversation,
  transformPattern, 
  buildMeta 
} from '../lib/export/transforms.js';
import { filterByPrivacy } from '../lib/export/privacy.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user_id = user.id;
    console.log(`[Export] Starting for user: ${user_id}`);
    const startTime = Date.now();

    // Gather all data in parallel
    const [profile, keyPeople, entities, notes, meetings, conversations, patterns] = 
      await Promise.all([
        getProfile(user_id),
        getKeyPeople(user_id),
        getEntities(user_id),
        getNotes(user_id),
        getMeetings(user_id),
        getConversations(user_id),
        getPatterns(user_id)
      ]);

    console.log(`[Export] Data gathered: ${entities.length} entities, ${notes.length} notes, ${patterns.length} patterns`);

    // Filter out private items
    const publicEntities = filterByPrivacy(entities);
    const publicNotes = filterByPrivacy(notes);
    const publicPatterns = filterByPrivacy(patterns);

    // Build export structure
    const exportData = {
      inscript_export: {
        identity: buildIdentity(profile, keyPeople),
        entities: publicEntities.map(transformEntity),
        episodes: {
          notes: publicNotes.map(transformNote),
          meetings: meetings.map(transformMeeting),
          conversations: conversations.map(transformConversation)
        },
        patterns: publicPatterns.map(transformPattern),
        meta: buildMeta({
          entities: publicEntities,
          notes: publicNotes,
          patterns: publicPatterns
        })
      }
    };

    const duration = Date.now() - startTime;
    console.log(`[Export] Completed in ${duration}ms`);

    const filename = `inscript-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).json(exportData);

  } catch (error) {
    console.error('[Export] Failed:', error);
    return res.status(500).json({ error: 'Export failed', details: error.message });
  }
}
```

---

## Task 3: Handle Edge Cases

Add handling for:

```javascript
// Empty account handling
if (!notes.length && !entities.length) {
  console.log(`[Export] Empty account for user: ${user_id}`);
  // Still return valid structure, just empty
}

// Large export handling (>1000 notes)
if (notes.length > 1000) {
  console.log(`[Export] Large export: ${notes.length} notes`);
  // Consider: streaming, pagination, or background job
  // For v1, proceed but log warning
}
```

---

## Task 4: Add Request Logging

```javascript
// At start of handler
console.log(`[Export] Request from ${req.headers['x-forwarded-for'] || 'unknown'}`);
console.log(`[Export] User-Agent: ${req.headers['user-agent']}`);

// Add timing for each query (for debugging)
const timings = {};
const timeQuery = async (name, fn) => {
  const start = Date.now();
  const result = await fn();
  timings[name] = Date.now() - start;
  return result;
};

// Usage
const profile = await timeQuery('profile', () => getProfile(user_id));
// ... etc

console.log(`[Export] Query timings:`, timings);
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| Auth works | Call without token → 401 | ☐ |
| Auth works | Call with valid token → 200 | ☐ |
| Returns JSON | Response is valid JSON | ☐ |
| Has structure | Contains identity, entities, episodes, patterns, meta | ☐ |
| Downloads | Browser triggers file download | ☐ |

---

## Handoff Signals

**You're waiting for:**
- T2: `/lib/export/queries.js` ready → then wire real queries

**You signal when:**
- API returns real data → tell T3 and T4 to test

**Signal format:**
```
T1 → T3, T4: API READY
Endpoint: GET /api/export
Auth: Bearer token required
Returns: JSON file download
Test it!
```

---

## Definition of Done

- [ ] `/api/export.js` exists and handles GET requests
- [ ] Returns 401 without auth
- [ ] Returns valid JSON with correct structure
- [ ] Triggers file download in browser
- [ ] Logs timing information
- [ ] Handles empty accounts gracefully
- [ ] Privacy filtering excludes private items

---

## Quick Reference

```bash
# Test endpoint locally
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/export

# Check for errors
vercel dev --listen 3001 2>&1 | grep -i export

# Validate JSON output
curl ... | jq .
```
