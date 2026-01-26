# Terminal 4: QA & Integration — Testing & Documentation

**Role:** Test everything, document everything, catch bugs before ship  
**Task ID:** `export-build-t4`

---

## Your Ownership

**Files you OWN (only you touch these):**
```
/tests/export/                    ← All test files
/docs/EXPORT.md                   ← User documentation
/docs/EXPORT-TECHNICAL.md         ← Technical documentation
```

**Files you READ (to understand what to test):**
```
/api/export.js                    ← T1's API
/lib/export/*                     ← T2's data layer
/js/settings-export.js            ← T3's UI
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/export-tests
mkdir -p tests/export
mkdir -p tests/export/fixtures
export CLAUDE_CODE_TASK_LIST_ID=export-build-t4
```

---

## Your Role

You are the **quality gate**. Nothing ships until you've verified it works.

**Responsibilities:**
1. Create test fixtures (mock data)
2. Write unit tests for T2's transforms
3. Write integration tests for T1's API
4. Manual E2E testing of T3's UI
5. Document the feature for users
6. Document the code for developers
7. Track and report bugs to other terminals

---

## Task 1: Create Test Fixtures (Do First)

Create `/tests/export/fixtures/mock-data.js`:

```javascript
// /tests/export/fixtures/mock-data.js
// OWNER: T4
// Mock data for testing export functionality

export const mockUserId = 'test-user-00000000-0000-0000-0000-000000000001';

export const mockProfile = {
  user_id: mockUserId,
  name: 'Test User',
  role_type: 'Product Manager',
  goals: ['Ship v1', 'Get user feedback', 'Iterate quickly'],
  tone: 'warm',
  life_seasons: ['career transition', 'learning phase'],
  depth_answer: 'I am building products that help people think better.',
  custom_instructions: 'Be concise and direct. Skip unnecessary caveats.'
};

export const mockKeyPeople = [
  { name: 'Alice Chen', relationship: 'colleague', created_at: '2024-06-15T10:00:00Z' },
  { name: 'Bob Smith', relationship: 'mentor', created_at: '2024-06-20T10:00:00Z' },
  { name: 'Charlie', relationship: 'friend', created_at: '2024-07-01T10:00:00Z' }
];

export const mockEntities = [
  {
    id: 'ent-001',
    name: 'Alice Chen',
    entity_type: 'person',
    summary: 'Colleague at work, PM on the platform team',
    importance_score: 0.9,
    sentiment_average: 0.7,
    mention_count: 23,
    is_historical: false,
    privacy_level: 'internal',
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2025-01-20T10:00:00Z'
  },
  {
    id: 'ent-002',
    name: 'Project Phoenix',
    entity_type: 'project',
    summary: 'Main product initiative for Q1',
    importance_score: 0.95,
    sentiment_average: 0.5,
    mention_count: 45,
    is_historical: false,
    privacy_level: 'internal',
    created_at: '2024-09-01T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z'
  },
  {
    id: 'ent-003',
    name: 'Secret Project',
    entity_type: 'project',
    summary: 'Confidential work',
    importance_score: 0.8,
    sentiment_average: 0.6,
    mention_count: 5,
    is_historical: false,
    privacy_level: 'private',  // Should be EXCLUDED from export
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z'
  },
  {
    id: 'ent-004',
    name: 'Old Company',
    entity_type: 'organization',
    summary: 'Previous employer',
    importance_score: 0.3,
    sentiment_average: 0.4,
    mention_count: 8,
    is_historical: true,  // Historical entity
    privacy_level: 'internal',
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2024-12-01T10:00:00Z'
  }
];

export const mockNotes = [
  {
    id: 'note-001',
    content: 'Met with Alice about Project Phoenix roadmap. She raised concerns about the timeline.',
    note_type: 'standard',
    category: 'work',
    sentiment: -0.2,
    privacy_level: 'internal',
    created_at: '2025-01-20T14:30:00Z',
    updated_at: '2025-01-20T14:30:00Z'
  },
  {
    id: 'note-002',
    content: 'Great brainstorming session today. Feeling optimistic about the new direction.',
    note_type: 'standard',
    category: 'work',
    sentiment: 0.8,
    privacy_level: 'internal',
    created_at: '2025-01-21T10:00:00Z',
    updated_at: '2025-01-21T10:00:00Z'
  },
  {
    id: 'note-003',
    content: 'Private reflection about personal matters.',
    note_type: 'standard',
    category: 'personal',
    sentiment: 0.0,
    privacy_level: 'private',  // Should be EXCLUDED
    created_at: '2025-01-22T20:00:00Z',
    updated_at: '2025-01-22T20:00:00Z'
  }
];

export const mockPatterns = [
  {
    id: 'pat-001',
    pattern_type: 'temporal',
    description: 'You do your best deep work between 9-11pm on weeknights',
    confidence: 0.85,
    evidence: { note_ids: ['note-001', 'note-002'] },
    status: 'active',
    privacy_level: 'internal',
    created_at: '2024-10-01T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'pat-002',
    pattern_type: 'relational',
    description: 'You often discuss Project Phoenix with Alice',
    confidence: 0.9,
    evidence: { note_ids: ['note-001'] },
    status: 'active',
    privacy_level: 'internal',
    created_at: '2024-11-01T10:00:00Z',
    updated_at: '2025-01-20T10:00:00Z'
  }
];

export const mockMeetings = [
  {
    id: 'mtg-001',
    entity_id: 'ent-001',
    note_id: 'note-001',
    meeting_date: '2025-01-20',
    topics: ['roadmap', 'timeline', 'resources'],
    sentiment: -0.1,
    action_items: ['Send updated timeline', 'Schedule follow-up'],
    created_at: '2025-01-20T15:00:00Z'
  }
];

export const mockConversations = [
  {
    id: 'conv-001',
    status: 'completed',
    summary: 'Discussed project priorities and next steps',
    key_insights: ['Focus on user feedback', 'Reduce scope for v1'],
    created_at: '2025-01-19T10:00:00Z',
    updated_at: '2025-01-19T10:30:00Z'
  }
];

// Expected counts after privacy filtering
export const expectedCounts = {
  entities: 3,  // Excludes 'Secret Project' (private)
  notes: 2,     // Excludes private note
  patterns: 2,
  meetings: 1,
  conversations: 1
};
```

---

## Task 2: Write Unit Tests for Transforms

Create `/tests/export/transforms.test.js`:

```javascript
// /tests/export/transforms.test.js
// OWNER: T4
// Unit tests for T2's transform functions

import {
  buildIdentity,
  transformEntity,
  transformNote,
  transformPattern,
  buildMeta
} from '../../lib/export/transforms.js';

import { filterByPrivacy } from '../../lib/export/privacy.js';

import {
  mockProfile,
  mockKeyPeople,
  mockEntities,
  mockNotes,
  mockPatterns,
  expectedCounts
} from './fixtures/mock-data.js';

describe('Transform Functions', () => {
  
  describe('buildIdentity', () => {
    test('builds identity with all fields', () => {
      const identity = buildIdentity(mockProfile, mockKeyPeople);
      
      expect(identity.name).toBe('Test User');
      expect(identity.role).toBe('Product Manager');
      expect(identity.goals).toHaveLength(3);
      expect(identity.communication.tone).toBe('warm');
      expect(identity.key_people).toHaveLength(3);
    });
    
    test('handles null profile gracefully', () => {
      const identity = buildIdentity(null, []);
      
      expect(identity.name).toBeNull();
      expect(identity.goals).toEqual([]);
      expect(identity.key_people).toEqual([]);
    });
    
    test('includes custom instructions', () => {
      const identity = buildIdentity(mockProfile, []);
      
      expect(identity.communication.custom_instructions).toContain('concise');
    });
  });

  describe('transformEntity', () => {
    test('transforms entity to export format', () => {
      const entity = transformEntity(mockEntities[0]);
      
      expect(entity.id).toBe('ent-001');
      expect(entity.type).toBe('person');
      expect(entity.name).toBe('Alice Chen');
      expect(entity.importance).toBe(0.9);
      expect(entity.temporal.active).toBe(true);
    });
    
    test('marks historical entities as inactive', () => {
      const entity = transformEntity(mockEntities[3]); // Old Company
      
      expect(entity.temporal.active).toBe(false);
    });
    
    test('maps entity types correctly', () => {
      const personEntity = transformEntity({ ...mockEntities[0], entity_type: 'person' });
      const companyEntity = transformEntity({ ...mockEntities[0], entity_type: 'company' });
      
      expect(personEntity.type).toBe('person');
      expect(companyEntity.type).toBe('organization');
    });
  });

  describe('transformNote', () => {
    test('transforms note to export format', () => {
      const note = transformNote(mockNotes[0]);
      
      expect(note.id).toBe('note-001');
      expect(note.content).toContain('Alice');
      expect(note.category).toBe('work');
      expect(note.timestamp).toBeDefined();
    });
    
    test('includes sentiment in extracted field', () => {
      const note = transformNote(mockNotes[0]);
      
      expect(note.extracted.sentiment).toBe(-0.2);
    });
  });

  describe('transformPattern', () => {
    test('transforms pattern to export format', () => {
      const pattern = transformPattern(mockPatterns[0]);
      
      expect(pattern.type).toBe('temporal');
      expect(pattern.description).toContain('deep work');
      expect(pattern.confidence).toBe(0.85);
      expect(pattern.evidence.first_detected).toBeDefined();
    });
  });

  describe('filterByPrivacy', () => {
    test('excludes private entities', () => {
      const filtered = filterByPrivacy(mockEntities);
      
      expect(filtered).toHaveLength(expectedCounts.entities);
      expect(filtered.find(e => e.name === 'Secret Project')).toBeUndefined();
    });
    
    test('excludes private notes', () => {
      const filtered = filterByPrivacy(mockNotes);
      
      expect(filtered).toHaveLength(expectedCounts.notes);
      expect(filtered.find(n => n.privacy_level === 'private')).toBeUndefined();
    });
    
    test('handles empty array', () => {
      const filtered = filterByPrivacy([]);
      
      expect(filtered).toEqual([]);
    });
    
    test('handles items without privacy_level', () => {
      const items = [{ id: 1 }, { id: 2, privacy_level: 'private' }];
      const filtered = filterByPrivacy(items);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  describe('buildMeta', () => {
    test('builds meta with correct counts', () => {
      const meta = buildMeta({
        entities: mockEntities.slice(0, 3),
        notes: mockNotes.slice(0, 2),
        patterns: mockPatterns
      });
      
      expect(meta.version).toBe('1.0.0');
      expect(meta.counts.entities).toBe(3);
      expect(meta.counts.notes).toBe(2);
      expect(meta.counts.patterns).toBe(2);
      expect(meta.exported_at).toBeDefined();
    });
    
    test('calculates date range from notes', () => {
      const meta = buildMeta({
        entities: [],
        notes: mockNotes.slice(0, 2),
        patterns: []
      });
      
      expect(meta.date_range.first_entry).toBeDefined();
      expect(meta.date_range.last_entry).toBeDefined();
    });
  });
});
```

---

## Task 3: Write Integration Tests for API

Create `/tests/export/api.test.js`:

```javascript
// /tests/export/api.test.js
// OWNER: T4
// Integration tests for T1's API endpoint

// Note: These tests require a test environment with database access
// Run with: npm test -- tests/export/api.test.js

describe('Export API', () => {
  
  const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;
  const API_URL = process.env.API_URL || 'http://localhost:3001';
  
  describe('Authentication', () => {
    test('returns 401 without auth header', async () => {
      const response = await fetch(`${API_URL}/api/export`);
      expect(response.status).toBe(401);
    });
    
    test('returns 401 with invalid token', async () => {
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      expect(response.status).toBe(401);
    });
    
    test('returns 200 with valid token', async () => {
      if (!TEST_USER_TOKEN) {
        console.warn('Skipping: TEST_USER_TOKEN not set');
        return;
      }
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    test('returns valid JSON', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const data = await response.json();
      expect(data).toBeDefined();
      expect(data.inscript_export).toBeDefined();
    });
    
    test('has correct top-level structure', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const data = await response.json();
      const export_ = data.inscript_export;
      
      expect(export_.identity).toBeDefined();
      expect(export_.entities).toBeDefined();
      expect(export_.episodes).toBeDefined();
      expect(export_.patterns).toBeDefined();
      expect(export_.meta).toBeDefined();
    });
    
    test('has Content-Disposition header for download', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('inscript-export');
      expect(disposition).toContain('.json');
    });
  });

  describe('Data Integrity', () => {
    test('entities is an array', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const data = await response.json();
      expect(Array.isArray(data.inscript_export.entities)).toBe(true);
    });
    
    test('meta has version 1.0.0', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const data = await response.json();
      expect(data.inscript_export.meta.version).toBe('1.0.0');
    });
    
    test('meta has exported_at timestamp', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const data = await response.json();
      const exportedAt = new Date(data.inscript_export.meta.exported_at);
      expect(exportedAt).toBeInstanceOf(Date);
      expect(isNaN(exportedAt)).toBe(false);
    });
  });
});
```

---

## Task 4: Manual E2E Test Checklist

Create `/tests/export/E2E-CHECKLIST.md`:

```markdown
# Export Feature E2E Test Checklist

**Tester:** T4  
**Date:** ___________  
**Build:** ___________

## Prerequisites
- [ ] Logged into Inscript with test account
- [ ] Account has: entities, notes, patterns
- [ ] At least one item marked private (to test filtering)

## UI Tests

### Settings Page
- [ ] Navigate to Settings
- [ ] Export section is visible
- [ ] "Your Data" heading displays
- [ ] Description text is readable
- [ ] "Export My Memory" button is visible
- [ ] "What's included?" expandable works

### Button Interaction
- [ ] Button has hover state (background changes)
- [ ] Button has focus state (outline visible)
- [ ] Button is keyboard accessible (Tab, Enter)
- [ ] Button disables during export
- [ ] Loading text shows ("Preparing export...")

### Export Flow
- [ ] Click Export button
- [ ] Loading state appears
- [ ] File download triggers
- [ ] Success message appears
- [ ] Button returns to normal state
- [ ] Success message auto-hides after 5s

### Error Handling
- [ ] Disconnect network, try export
- [ ] Error message appears (not just silent fail)
- [ ] Button returns to normal state
- [ ] Can retry after error

## File Tests

### File Basics
- [ ] File downloads with correct name (inscript-export-YYYY-MM-DD.json)
- [ ] File opens in text editor
- [ ] File is valid JSON (no parse errors)
- [ ] File is human-readable (pretty printed)

### File Structure
- [ ] Has `inscript_export` root object
- [ ] Has `identity` section
- [ ] Has `entities` array
- [ ] Has `episodes` object with `notes`
- [ ] Has `patterns` array
- [ ] Has `meta` section

### Data Accuracy
- [ ] Identity name matches account
- [ ] Entity count seems reasonable
- [ ] Note content is readable (decrypted)
- [ ] Patterns have descriptions
- [ ] Meta version is "1.0.0"

### Privacy
- [ ] Private entities NOT in export
- [ ] Private notes NOT in export
- [ ] Only internal/shared items present

## Cross-Browser

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile)

## External Validation

### ChatGPT Test
- [ ] Open ChatGPT
- [ ] Upload or paste export JSON
- [ ] Ask "What do you know about me from this file?"
- [ ] ChatGPT correctly identifies user name
- [ ] ChatGPT mentions some entities

### Claude Test
- [ ] Open Claude
- [ ] Upload or paste export JSON
- [ ] Ask "Summarize what you learned about me"
- [ ] Claude correctly reads the export

## Performance

- [ ] Export completes in < 10 seconds (small account)
- [ ] Export completes in < 30 seconds (large account)
- [ ] No browser freeze during export
- [ ] File size is reasonable (< 5MB typical)

## Issues Found

| Issue | Severity | Assigned To | Status |
|-------|----------|-------------|--------|
| | | | |
| | | | |
| | | | |

## Sign-off

- [ ] All critical tests pass
- [ ] No P0 bugs open
- [ ] Ready for production

Tester Signature: _______________ Date: ___________
```

---

## Task 5: Write User Documentation

Create `/docs/EXPORT.md`:

```markdown
# Export Your Data from Inscript

Inscript lets you export everything we've learned about you — your identity, the people in your life, your notes, and patterns we've detected. Take your data anywhere.

## How to Export

1. Open **Settings** (click the gear icon)
2. Scroll to **Your Data** section
3. Click **Export My Memory**
4. Wait for the download to complete
5. Your file will be saved as `inscript-export-YYYY-MM-DD.json`

## What's Included

### Identity
Your name, goals, and communication preferences.

### People & Projects
Everyone and everything you've mentioned in your notes.

### Notes
All your entries — thoughts, meetings, reflections.

### Patterns
Habits and preferences we've detected over time.

## What's NOT Included

- **Private items** — Anything marked private stays private
- **Raw audio** — Only transcripts are exported
- **Internal data** — Technical stuff that's only useful inside Inscript

## How to Use Your Export

### With ChatGPT
1. Open ChatGPT
2. Click the paperclip to upload
3. Upload your export file
4. Say: "Here's my personal context. Use this to personalize your responses."

### With Claude
1. Open Claude
2. Upload your export file
3. Say: "This is my Inscript export with information about me and my life. Please use it."

### With Other AI
The export is standard JSON — any AI that accepts text or file uploads can read it.

## Privacy & Security

- Your export contains personal information
- Store it securely
- Don't share it publicly
- Private items are automatically excluded

## Troubleshooting

**Export button doesn't work**
- Make sure you're logged in
- Try refreshing the page
- Check your internet connection

**File won't open**
- Make sure you have a text editor installed
- Try opening with VS Code or Notepad

**Data seems missing**
- Private items are excluded by design
- Very old data may not have been captured
- Some features were added recently

## Questions?

Contact support or press the thumbs-down button on any response to send feedback.
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| Fixtures created | Mock data file exists | ☐ |
| Unit tests pass | `npm test transforms` | ☐ |
| API tests pass | `npm test api` | ☐ |
| E2E checklist complete | All boxes checked | ☐ |
| User docs written | EXPORT.md exists | ☐ |
| ChatGPT validation | Export works in ChatGPT | ☐ |

---

## Bug Reporting Format

When you find a bug, report to the owning terminal:

```
🐛 BUG REPORT

Terminal: T[1/2/3]
File: /path/to/file.js
Severity: P0/P1/P2

Description:
[What's wrong]

Steps to Reproduce:
1. ...
2. ...
3. ...

Expected:
[What should happen]

Actual:
[What actually happens]

Screenshot/Log:
[If applicable]
```

---

## Handoff Signals

**You signal when:**
- Tests are ready → tell T1, T2, T3 to run them
- Bugs found → report to owning terminal
- E2E passes → confirm ready to ship

**Signal format:**
```
T4 → ALL: TESTS READY
Unit tests: /tests/export/transforms.test.js
API tests: /tests/export/api.test.js
Run with: npm test

Waiting for code to be complete before running.
```

```
T4 → ALL: E2E PASSED ✅
All critical tests pass
Export verified with ChatGPT
Ready for production deploy
```

---

## Definition of Done

- [ ] Test fixtures created with realistic data
- [ ] Unit tests written for all transforms
- [ ] Integration tests written for API
- [ ] E2E manual testing complete
- [ ] User documentation written
- [ ] All P0 bugs resolved
- [ ] Export verified in ChatGPT/Claude
