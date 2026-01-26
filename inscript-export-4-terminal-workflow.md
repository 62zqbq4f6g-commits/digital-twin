# Inscript Export Build: 4-Terminal Workflow

**Role:** Senior CTO Build Orchestration  
**Objective:** Ship portable memory export in 1 week (Sprint 1)  
**Resources:** 4 parallel Claude Code terminals

---

## Strategic Overview

### Why 4 Terminals?

Parallel execution with clear ownership prevents:
- Merge conflicts
- Duplicated work
- Blocking dependencies
- Context switching overhead

### Terminal Assignments

| Terminal | Role | Primary Ownership |
|----------|------|-------------------|
| **T1** | Backend Lead | `/api/export.js`, API logic, database queries |
| **T2** | Data Layer | `/lib/export/*`, transforms, data structures |
| **T3** | Frontend Lead | Settings UI, export button, user feedback |
| **T4** | QA & Integration | Testing, documentation, integration, edge cases |

---

## File Ownership Map (CRITICAL)

**No terminal touches another terminal's files without coordination.**

```
/api
  └── export.js                    ← T1 OWNS

/lib/export
  ├── transforms.js                ← T2 OWNS
  ├── queries.js                   ← T2 OWNS (T1 consumes)
  ├── privacy.js                   ← T2 OWNS
  └── types.js                     ← T2 OWNS

/js
  └── settings-export.js           ← T3 OWNS

/css
  └── settings-export.css          ← T3 OWNS

/tests
  └── export/                      ← T4 OWNS
      ├── export.test.js
      ├── transforms.test.js
      └── fixtures/

/docs
  └── EXPORT.md                    ← T4 OWNS

SHARED FILES (Coordinate First):
  - /js/ui.js                      ← Add hooks only, mark with // EXPORT - T[n]
  - /js/app.js                     ← Add imports only, mark with // EXPORT - T[n]
  - index.html                     ← Add sections only, mark with <!-- EXPORT - T[n] -->
```

---

## Phase 1: Foundation (Day 1)

### Morning — Setup & Scaffolding

**All terminals start simultaneously**

#### T1: Backend API Skeleton

```bash
# Terminal 1 starts with:
export CLAUDE_CODE_TASK_LIST_ID=export-build-t1
claude

# Tasks:
# 1. Create /api/export.js skeleton
# 2. Set up authentication check
# 3. Define response structure
# 4. Add basic error handling
# 5. Create placeholder for data gathering
```

**T1 Deliverable (Morning):**
```javascript
// /api/export.js - SKELETON
export default async function handler(req, res) {
  // Auth check
  const user_id = req.user?.id;
  if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    // TODO: Import from lib/export/queries.js (T2 building)
    const exportData = {
      inscript_export: {
        identity: {},      // T2 will provide
        entities: [],      // T2 will provide
        episodes: {},      // T2 will provide
        patterns: [],      // T2 will provide
        meta: {}           // T2 will provide
      }
    };
    
    const filename = `inscript-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.json(exportData);
  } catch (error) {
    console.error('Export failed:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}
```

---

#### T2: Data Layer Setup

```bash
# Terminal 2 starts with:
export CLAUDE_CODE_TASK_LIST_ID=export-build-t2
claude

# Tasks:
# 1. Create /lib/export/ directory structure
# 2. Create types.js with export data structures
# 3. Create queries.js skeleton for database queries
# 4. Create transforms.js skeleton for data transformation
# 5. Create privacy.js skeleton for filtering
```

**T2 Deliverable (Morning):**
```javascript
// /lib/export/types.js
export const ExportSchema = {
  version: "1.0.0",
  layers: ['identity', 'entities', 'episodes', 'patterns', 'meta']
};

// /lib/export/queries.js - SKELETON
export async function getProfile(user_id) { /* TODO */ }
export async function getKeyPeople(user_id) { /* TODO */ }
export async function getEntities(user_id) { /* TODO */ }
export async function getNotes(user_id) { /* TODO */ }
export async function getMeetings(user_id) { /* TODO */ }
export async function getConversations(user_id) { /* TODO */ }
export async function getPatterns(user_id) { /* TODO */ }

// /lib/export/transforms.js - SKELETON  
export function buildIdentity(profile, keyPeople) { /* TODO */ }
export function transformEntity(entity) { /* TODO */ }
export function transformNote(note) { /* TODO */ }
export function transformMeeting(meeting) { /* TODO */ }
export function transformConversation(conv) { /* TODO */ }
export function transformPattern(pattern) { /* TODO */ }
export function buildMeta(data) { /* TODO */ }

// /lib/export/privacy.js - SKELETON
export function filterByPrivacy(items, excludePrivate = true) { /* TODO */ }
```

---

#### T3: Frontend UI Setup

```bash
# Terminal 3 starts with:
export CLAUDE_CODE_TASK_LIST_ID=export-build-t3
claude

# Tasks:
# 1. Create /js/settings-export.js
# 2. Create /css/settings-export.css
# 3. Add export section to Settings UI
# 4. Create mock export function (until API ready)
# 5. Design loading and success states
```

**T3 Deliverable (Morning):**
```javascript
// /js/settings-export.js
const ExportUI = {
  init() {
    this.injectExportSection();
    this.bindEvents();
  },
  
  injectExportSection() {
    const settingsContainer = document.querySelector('.settings-content');
    if (!settingsContainer) return;
    
    const section = document.createElement('div');
    section.className = 'settings-section export-section';
    section.innerHTML = `
      <h3>Your Data</h3>
      <p class="settings-description">
        Export everything Inscript knows about you. 
        Take it to ChatGPT, Claude, or any AI.
      </p>
      <button id="export-btn" class="settings-button export-button">
        <span class="export-icon">↓</span>
        <span class="export-label">Export My Memory</span>
      </button>
      <p class="settings-note">
        Private items are excluded. File contains personal information.
      </p>
    `;
    settingsContainer.appendChild(section);
  },
  
  bindEvents() {
    document.getElementById('export-btn')?.addEventListener('click', () => this.handleExport());
  },
  
  async handleExport() {
    const btn = document.getElementById('export-btn');
    const label = btn.querySelector('.export-label');
    
    btn.disabled = true;
    label.textContent = 'Preparing export...';
    
    try {
      // TODO: Replace with real API call when T1 ready
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      this.downloadBlob(blob);
      this.showSuccess();
    } catch (err) {
      this.showError(err.message);
    } finally {
      btn.disabled = false;
      label.textContent = 'Export My Memory';
    }
  },
  
  downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscript-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  showSuccess() {
    // TODO: Use app's toast system
    console.log('Export complete');
  },
  
  showError(message) {
    // TODO: Use app's toast system
    console.error('Export failed:', message);
  }
};

// Initialize when settings page loads
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => ExportUI.init());
}

export default ExportUI;
```

---

#### T4: Test Infrastructure Setup

```bash
# Terminal 4 starts with:
export CLAUDE_CODE_TASK_LIST_ID=export-build-t4
claude

# Tasks:
# 1. Create /tests/export/ directory
# 2. Create test fixtures (mock user data)
# 3. Set up test framework for export
# 4. Create initial test skeletons
# 5. Document testing approach
```

**T4 Deliverable (Morning):**
```javascript
// /tests/export/fixtures/mock-user.js
export const mockUser = {
  id: 'test-user-001',
  profile: {
    name: 'Test User',
    role_type: 'Product Manager',
    goals: ['Ship v1', 'Get feedback'],
    tone: 'warm',
    custom_instructions: 'Be concise'
  },
  keyPeople: [
    { name: 'Alice', relationship: 'colleague' },
    { name: 'Bob', relationship: 'friend' }
  ],
  entities: [
    { id: 'ent-1', name: 'Alice', entity_type: 'person', importance_score: 0.9, privacy_level: 'internal' },
    { id: 'ent-2', name: 'Project X', entity_type: 'project', importance_score: 0.8, privacy_level: 'internal' },
    { id: 'ent-3', name: 'Secret', entity_type: 'concept', importance_score: 0.5, privacy_level: 'private' }
  ],
  notes: [
    { id: 'note-1', content: 'Met with Alice about Project X', category: 'work', privacy_level: 'internal' },
    { id: 'note-2', content: 'Private thought', category: 'personal', privacy_level: 'private' }
  ],
  patterns: [
    { pattern_type: 'temporal', description: 'Works best in morning', confidence: 0.8 }
  ]
};

// /tests/export/export.test.js
import { mockUser } from './fixtures/mock-user.js';

describe('Export API', () => {
  test('returns 401 without auth', async () => {
    // TODO: Implement when API ready
  });
  
  test('returns valid export structure', async () => {
    // TODO: Implement when API ready
  });
  
  test('excludes private items', async () => {
    // TODO: Implement when API ready
  });
  
  test('includes all public entities', async () => {
    // TODO: Implement when API ready
  });
});

// /tests/export/transforms.test.js
describe('Transform Functions', () => {
  test('buildIdentity creates valid structure', () => {
    // TODO: Implement when transforms ready
  });
  
  test('transformEntity handles all entity types', () => {
    // TODO: Implement when transforms ready
  });
  
  test('filterByPrivacy excludes private items', () => {
    // TODO: Implement when transforms ready
  });
});
```

---

### Afternoon — Core Implementation

**Sync Point: 12:00 PM**
All terminals confirm scaffolding complete before proceeding.

#### T1: Complete API Endpoint

```bash
# T1 Afternoon Tasks:
# 1. Import queries from T2's /lib/export/queries.js
# 2. Import transforms from T2's /lib/export/transforms.js
# 3. Wire up full data gathering
# 4. Add comprehensive error handling
# 5. Add request logging
```

**T1 Dependency:** Waits for T2 to complete queries.js exports

---

#### T2: Complete Data Layer

```bash
# T2 Afternoon Tasks:
# 1. Implement all query functions (getProfile, getEntities, etc.)
# 2. Implement all transform functions
# 3. Implement privacy filtering
# 4. Handle note decryption
# 5. Test each function in isolation
```

**T2 Priority Order:**
1. `queries.js` — T1 is blocked on this
2. `privacy.js` — Simple, unblocks filtering
3. `transforms.js` — Can work in parallel with T1

---

#### T3: Wire UI to API

```bash
# T3 Afternoon Tasks:
# 1. Test export button with real API (once T1 ready)
# 2. Implement proper loading states
# 3. Implement success toast
# 4. Implement error handling UI
# 5. Add keyboard accessibility
```

**T3 Dependency:** Waits for T1 API to return real data

---

#### T4: Integration Testing

```bash
# T4 Afternoon Tasks:
# 1. Test API endpoint with mock auth
# 2. Test transform functions with fixtures
# 3. Test privacy filtering
# 4. Document any bugs found
# 5. Create manual test checklist
```

---

## Phase 2: Integration (Day 2)

### Morning — Wire Everything Together

**Sync Point: 9:00 AM**
Review Day 1 progress, identify blockers.

#### T1: API Refinement

```bash
# T1 Day 2 Morning:
# 1. Integrate T2's completed queries and transforms
# 2. Add performance logging (time each query)
# 3. Handle large exports (streaming if needed)
# 4. Add rate limiting
```

---

#### T2: Transform Edge Cases

```bash
# T2 Day 2 Morning:
# 1. Handle null/undefined fields gracefully
# 2. Handle entities with no facts
# 3. Handle notes with no extracted entities
# 4. Handle patterns with no evidence
# 5. Ensure consistent date formatting (ISO 8601)
```

---

#### T3: UI Polish

```bash
# T3 Day 2 Morning:
# 1. Add progress indicator for large exports
# 2. Style export section (match design system)
# 3. Add "What's included" expandable section
# 4. Mobile responsive testing
# 5. Dark mode support
```

---

#### T4: End-to-End Testing

```bash
# T4 Day 2 Morning:
# 1. Full E2E test: Button → API → Download
# 2. Test with real user account (staging)
# 3. Verify exported JSON is valid
# 4. Verify JSON opens in text editor
# 5. Test giving export to ChatGPT
```

---

### Afternoon — Bug Fixes & Polish

**All terminals focus on issues found in E2E testing**

| Priority | Issue Type | Owner |
|----------|------------|-------|
| P0 | API crashes | T1 |
| P0 | Data missing | T2 |
| P0 | Button doesn't work | T3 |
| P1 | Performance slow | T1 + T2 |
| P1 | UI glitches | T3 |
| P2 | Edge cases | T4 coordinates |

---

## Phase 3: Ship (Day 3)

### Morning — Final Testing

#### All Terminals: Test Matrix

| Test Case | T1 | T2 | T3 | T4 |
|-----------|----|----|----|----|
| Auth required | ✓ | | | ✓ |
| Valid JSON structure | ✓ | ✓ | | ✓ |
| Privacy filtering works | | ✓ | | ✓ |
| UI shows loading state | | | ✓ | ✓ |
| Download triggers | | | ✓ | ✓ |
| File opens in editor | | | | ✓ |
| ChatGPT accepts it | | | | ✓ |
| Large export (500+ notes) | ✓ | | | ✓ |
| Empty account | ✓ | ✓ | | ✓ |

---

### Afternoon — Deploy

#### T1: Backend Deploy
```bash
# 1. Final code review
# 2. Merge to main
# 3. Monitor Vercel deploy
# 4. Check production logs
```

#### T2: Verify Production Data
```bash
# 1. Test export with production user
# 2. Verify transforms work with real data
# 3. Check for any data edge cases
```

#### T3: Frontend Deploy
```bash
# 1. Verify UI appears in Settings
# 2. Test button on mobile
# 3. Test in multiple browsers
```

#### T4: Production Validation
```bash
# 1. Full E2E in production
# 2. Document any issues
# 3. Write release notes
# 4. Update EXPORT.md documentation
```

---

## Communication Protocol

### Sync Points

| Time | Purpose | All Terminals |
|------|---------|---------------|
| 9:00 AM | Daily standup | Status, blockers, plan |
| 12:00 PM | Midday sync | Progress check, unblock |
| 5:00 PM | EOD wrap | What shipped, what's left |

### Handoff Format

When T2 completes something T1 needs:

```
// T2 → T1 HANDOFF
// File: /lib/export/queries.js
// Status: READY FOR USE
// Exports: getProfile, getEntities, getNotes, getPatterns
// Usage example:
//   import { getProfile } from '../lib/export/queries.js';
//   const profile = await getProfile(user_id);
```

### Blocker Escalation

1. **Self-unblock** (15 min): Try to solve it yourself
2. **Peer help** (15 min): Ask the terminal that owns related code
3. **Sync call** (immediate): If blocking multiple terminals

---

## Git Strategy

### Branch Structure

```
main
  └── feat/export
        ├── feat/export-api        ← T1
        ├── feat/export-data       ← T2
        ├── feat/export-ui         ← T3
        └── feat/export-tests      ← T4
```

### Merge Order

1. T2 merges to `feat/export` first (data layer has no deps)
2. T1 merges (depends on T2)
3. T3 merges (depends on T1)
4. T4 merges (tests everything)
5. `feat/export` → `main`

### Commit Convention

```
T[n]: [Area] - [Description]

Examples:
T1: API - Add export endpoint skeleton
T2: Transforms - Implement buildIdentity function
T3: UI - Add export button to settings
T4: Tests - Add E2E export test
```

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Note decryption fails | Medium | T2 test early with real encrypted notes |
| Large exports timeout | Medium | T1 implement streaming if >1000 notes |
| UI doesn't match design | Low | T3 reference design system early |
| Privacy filter misses items | High | T4 explicit test cases for each privacy level |
| Merge conflicts | Low | Strict file ownership |

---

## Success Criteria (Sprint 1)

### Must Have
- [ ] Export button visible in Settings
- [ ] Click triggers download of .json file
- [ ] JSON contains identity, entities, notes, patterns
- [ ] Private items excluded
- [ ] File is valid JSON (parseable)

### Should Have
- [ ] Loading state while exporting
- [ ] Success toast on completion
- [ ] Error handling with user feedback
- [ ] Works on mobile

### Nice to Have
- [ ] Progress indicator for large exports
- [ ] "What's included" preview
- [ ] Export size estimate

---

## Terminal Startup Commands

```bash
# Terminal 1 - Backend
cd /path/to/inscript
export CLAUDE_CODE_TASK_LIST_ID=export-build-t1
claude

# Terminal 2 - Data Layer
cd /path/to/inscript
export CLAUDE_CODE_TASK_LIST_ID=export-build-t2
claude

# Terminal 3 - Frontend
cd /path/to/inscript
export CLAUDE_CODE_TASK_LIST_ID=export-build-t3
claude

# Terminal 4 - QA
cd /path/to/inscript
export CLAUDE_CODE_TASK_LIST_ID=export-build-t4
claude
```

---

## Day 1 Kickoff Checklist

Before starting, confirm:

- [ ] All 4 terminals have repo access
- [ ] All terminals on same branch (`feat/export`)
- [ ] Database access working
- [ ] Can run `vercel dev` locally
- [ ] Understand file ownership rules
- [ ] Know sync point times

---

*Inscript Export Build Workflow v1.0*  
*4-Terminal Parallel Execution Plan*  
*January 26, 2026*
