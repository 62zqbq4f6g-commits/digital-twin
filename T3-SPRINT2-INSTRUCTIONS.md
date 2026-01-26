# Terminal 3: Frontend Lead — Sprint 2

**Role:** Build Privacy Controls UI  
**Task ID:** `export-sprint2-t3`

---

## Context: What We Built in Sprint 1

We shipped **Portable Memory Export** — users can download everything Inscript knows about them as JSON.

**What's working:**
- `/js/settings-export.js` — Export UI you built
- `/css/settings-export.css` — Export styles
- "Export My Memory" button in Settings
- Auto-initialization, success messages

**What's missing (Sprint 2 fixes):**
1. **Privacy controls** — Users need to mark items as private (excluded from export)
2. **Privacy indicator** — Show how many items will be excluded before export

---

## Your Ownership

**Files you OWN:**
```
/js/settings-export.js       ← Add privacy indicator
/js/privacy-controls.js      ← NEW: Privacy toggle components
/css/settings-export.css     ← Update styles
/css/privacy-controls.css    ← NEW: Privacy styles
```

**Files you may EDIT (coordinate, mark with `// PRIVACY - T3`):**
```
/js/ui.js                    ← Add privacy toggles to entity/note views
/index.html                  ← Add script/style includes
```

**Files you READ (for context):**
```
CLAUDE.md                    ← Design system
/css/styles.css              ← Existing patterns
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-privacy-ui
```

---

## Dependency: Wait for T1

**T1 is adding `privacy_level` columns.** You can build UI now, but test after T1 signals:
```
T1 → T3: PRIVACY COLUMNS READY
```

You can start building immediately — the UI will work once columns exist.

---

## Task 1: Privacy Indicator in Export Section (DO FIRST)

Update the export section to show what will be excluded.

### 1.1 Update settings-export.js

Add a privacy summary that shows before export:

```javascript
// Add to ExportUI object in /js/settings-export.js

/**
 * Fetch and display privacy summary
 */
async fetchPrivacySummary() {
  const token = await this.getAuthToken();
  if (!token) return;
  
  try {
    // Fetch counts of private items
    const response = await fetch('/api/privacy-summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) return;
    
    const summary = await response.json();
    this.updatePrivacyIndicator(summary);
  } catch (err) {
    console.warn('[ExportUI] Could not fetch privacy summary:', err);
  }
},

/**
 * Update the privacy indicator display
 */
updatePrivacyIndicator(summary) {
  const indicator = document.getElementById('privacy-indicator');
  if (!indicator) return;
  
  const total = summary.private_entities + summary.private_notes + summary.private_patterns;
  
  if (total === 0) {
    indicator.innerHTML = `
      <span class="privacy-indicator-icon">✓</span>
      <span class="privacy-indicator-text">All items will be included in export</span>
    `;
    indicator.className = 'privacy-indicator all-included';
  } else {
    indicator.innerHTML = `
      <span class="privacy-indicator-icon">⚑</span>
      <span class="privacy-indicator-text">${total} private item${total > 1 ? 's' : ''} will be excluded</span>
      <a href="#" class="privacy-indicator-link" onclick="ExportUI.showPrivacyDetails(); return false;">Manage</a>
    `;
    indicator.className = 'privacy-indicator has-private';
  }
},

/**
 * Show privacy management modal/section
 */
showPrivacyDetails() {
  // Navigate to privacy management or show modal
  // Option 1: Scroll to privacy section
  const privacySection = document.getElementById('privacy-management-section');
  if (privacySection) {
    privacySection.scrollIntoView({ behavior: 'smooth' });
  }
  // Option 2: Open modal (implement if preferred)
}
```

### 1.2 Update injectExportSection

Add the privacy indicator to the HTML:

```javascript
injectExportSection() {
  // ... existing code ...
  
  section.innerHTML = `
    <div class="export-header">
      <h3 class="export-title">Portable Memory</h3>
    </div>
    
    <p class="export-description">
      Export everything Inscript knows about you — your identity, 
      the people in your life, your notes, and patterns we've detected. 
      Take it to ChatGPT, Claude, or any AI.
    </p>
    
    <!-- NEW: Privacy indicator -->
    <div id="privacy-indicator" class="privacy-indicator loading">
      <span class="privacy-indicator-text">Checking privacy settings...</span>
    </div>
    
    <button id="export-btn" class="export-button" type="button">
      <span class="export-button-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 14H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="export-button-label">Export My Memory</span>
    </button>
    
    <div id="export-status" class="export-status" hidden>
      <span class="export-status-icon"></span>
      <span class="export-status-text"></span>
    </div>
    
    <p class="export-note">
      Items marked as private are excluded. The exported file contains personal information — store it securely.
    </p>
    
    <details class="export-details">
      <summary>What's included?</summary>
      <ul class="export-details-list">
        <li><strong>Identity</strong> — Your name, goals, communication preferences</li>
        <li><strong>People & Projects</strong> — Everyone and everything you've mentioned</li>
        <li><strong>Notes</strong> — All your entries (except private ones)</li>
        <li><strong>Conversations</strong> — Your MIRROR chat history</li>
        <li><strong>Patterns</strong> — Habits and preferences we've detected</li>
      </ul>
    </details>
  `;
  
  // ... rest of existing code ...
  
  // NEW: Fetch privacy summary after injection
  this.fetchPrivacySummary();
}
```

### 1.3 Add privacy indicator styles to settings-export.css

```css
/* Privacy Indicator */
.privacy-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  border-radius: 2px;
  border: 1px solid var(--silver-200, #E5E5E5);
}

.privacy-indicator.loading {
  color: var(--silver-600, #666666);
  background: var(--silver-50, #F9F9F9);
}

.privacy-indicator.all-included {
  color: var(--ink-soft, #333333);
  background: var(--paper, #FFFFFF);
}

.privacy-indicator.has-private {
  color: var(--ink, #000000);
  background: var(--silver-50, #F9F9F9);
}

.privacy-indicator-icon {
  font-size: 1rem;
}

.privacy-indicator-text {
  flex: 1;
}

.privacy-indicator-link {
  color: var(--ink, #000000);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.privacy-indicator-link:hover {
  text-decoration-thickness: 2px;
}
```

---

## Task 2: Create Privacy Summary API

Create `/api/privacy-summary.js` (or tell T1 to create it):

```javascript
// /api/privacy-summary.js
// Returns counts of private items for the current user

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
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

    // Count private items in parallel
    const [entitiesResult, notesResult, patternsResult] = await Promise.all([
      supabase
        .from('user_entities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('privacy_level', 'private'),
      supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('privacy_level', 'private'),
      supabase
        .from('user_patterns')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('privacy_level', 'private')
    ]);

    return res.status(200).json({
      private_entities: entitiesResult.count || 0,
      private_notes: notesResult.count || 0,
      private_patterns: patternsResult.count || 0
    });

  } catch (error) {
    console.error('[PrivacySummary] Failed:', error);
    return res.status(500).json({ error: 'Failed to get privacy summary' });
  }
}
```

---

## Task 3: Privacy Management Section

Add a section in Settings where users can manage privacy.

### 3.1 Create privacy-controls.js

```javascript
// /js/privacy-controls.js
// OWNER: T3
// Privacy management UI

const PrivacyControls = {
  
  /**
   * Initialize privacy controls
   */
  init() {
    this.injectPrivacySection();
    this.loadPrivateItems();
    console.log('[PrivacyControls] Initialized');
  },

  /**
   * Inject privacy management section into Settings
   */
  injectPrivacySection() {
    const container = document.querySelector('#screen-settings');
    if (!container) return;
    
    // Check if already exists
    if (document.getElementById('privacy-management-section')) return;
    
    const section = document.createElement('div');
    section.id = 'privacy-management-section';
    section.className = 'settings-section privacy-section';
    section.innerHTML = `
      <div class="privacy-header">
        <h3 class="privacy-title">Privacy Controls</h3>
      </div>
      
      <p class="privacy-description">
        Mark items as private to exclude them from exports. 
        Private items stay in Inscript but won't be shared.
      </p>
      
      <div class="privacy-tabs">
        <button class="privacy-tab active" data-tab="entities">People & Projects</button>
        <button class="privacy-tab" data-tab="notes">Notes</button>
      </div>
      
      <div id="privacy-list" class="privacy-list">
        <div class="privacy-loading">Loading...</div>
      </div>
    `;
    
    // Insert after export section
    const exportSection = document.getElementById('export-section');
    if (exportSection && exportSection.nextSibling) {
      container.insertBefore(section, exportSection.nextSibling);
    } else {
      container.appendChild(section);
    }
    
    // Bind tab events
    section.querySelectorAll('.privacy-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  },

  /**
   * Switch between entities and notes tabs
   */
  switchTab(tab) {
    document.querySelectorAll('.privacy-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    this.loadPrivateItems(tab);
  },

  /**
   * Load items for privacy management
   */
  async loadPrivateItems(tab = 'entities') {
    const list = document.getElementById('privacy-list');
    if (!list) return;
    
    list.innerHTML = '<div class="privacy-loading">Loading...</div>';
    
    const token = await this.getAuthToken();
    if (!token) {
      list.innerHTML = '<div class="privacy-error">Please log in</div>';
      return;
    }
    
    try {
      const endpoint = tab === 'entities' ? '/api/entities' : '/api/notes';
      const response = await fetch(`${endpoint}?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load items');
      
      const items = await response.json();
      this.renderPrivacyList(items, tab);
      
    } catch (err) {
      console.error('[PrivacyControls] Load failed:', err);
      list.innerHTML = '<div class="privacy-error">Failed to load items</div>';
    }
  },

  /**
   * Render the privacy list
   */
  renderPrivacyList(items, tab) {
    const list = document.getElementById('privacy-list');
    if (!list) return;
    
    if (!items?.length) {
      list.innerHTML = `<div class="privacy-empty">No ${tab} found</div>`;
      return;
    }
    
    list.innerHTML = items.map(item => `
      <div class="privacy-item" data-id="${item.id}" data-type="${tab}">
        <div class="privacy-item-info">
          <span class="privacy-item-name">${this.escapeHtml(item.name || item.content?.substring(0, 50) || 'Untitled')}</span>
          ${tab === 'entities' ? `<span class="privacy-item-type">${item.entity_type || 'entity'}</span>` : ''}
        </div>
        <label class="privacy-toggle">
          <input type="checkbox" 
                 ${item.privacy_level === 'private' ? 'checked' : ''} 
                 onchange="PrivacyControls.togglePrivacy('${item.id}', '${tab}', this.checked)">
          <span class="privacy-toggle-label">Private</span>
        </label>
      </div>
    `).join('');
  },

  /**
   * Toggle privacy level for an item
   */
  async togglePrivacy(id, type, isPrivate) {
    const token = await this.getAuthToken();
    if (!token) return;
    
    const table = type === 'entities' ? 'user_entities' : 'notes';
    const newLevel = isPrivate ? 'private' : 'internal';
    
    try {
      const response = await fetch('/api/update-privacy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table, id, privacy_level: newLevel })
      });
      
      if (!response.ok) throw new Error('Failed to update');
      
      // Update UI
      const item = document.querySelector(`.privacy-item[data-id="${id}"]`);
      if (item) {
        item.classList.toggle('is-private', isPrivate);
      }
      
      // Refresh export privacy indicator
      if (window.ExportUI) {
        ExportUI.fetchPrivacySummary();
      }
      
      console.log(`[PrivacyControls] ${id} set to ${newLevel}`);
      
    } catch (err) {
      console.error('[PrivacyControls] Toggle failed:', err);
      // Revert checkbox
      const checkbox = document.querySelector(`.privacy-item[data-id="${id}"] input`);
      if (checkbox) checkbox.checked = !isPrivate;
    }
  },

  /**
   * Get auth token
   */
  async getAuthToken() {
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session?.access_token;
    }
    return null;
  },

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
};

// Make available globally
window.PrivacyControls = PrivacyControls;
```

### 3.2 Create privacy-controls.css

```css
/* /css/privacy-controls.css */
/* OWNER: T3 */

/* Privacy Section */
.privacy-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--silver-200, #E5E5E5);
}

.privacy-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--ink, #000000);
  margin: 0 0 0.75rem 0;
}

.privacy-description {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--ink-soft, #333333);
  margin: 0 0 1.5rem 0;
}

/* Tabs */
.privacy-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--silver-200, #E5E5E5);
}

.privacy-tab {
  padding: 0.75rem 1rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--silver-600, #666666);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.privacy-tab:hover {
  color: var(--ink, #000000);
}

.privacy-tab.active {
  color: var(--ink, #000000);
  border-bottom-color: var(--ink, #000000);
}

/* List */
.privacy-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--silver-200, #E5E5E5);
  border-radius: 2px;
}

.privacy-loading,
.privacy-empty,
.privacy-error {
  padding: 2rem;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--silver-600, #666666);
}

.privacy-error {
  color: var(--error, #8B0000);
}

/* Item */
.privacy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--silver-100, #F0F0F0);
}

.privacy-item:last-child {
  border-bottom: none;
}

.privacy-item.is-private {
  background: var(--silver-50, #F9F9F9);
}

.privacy-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.privacy-item-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--ink, #000000);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.privacy-item-type {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--silver-600, #666666);
  text-transform: capitalize;
}

/* Toggle */
.privacy-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.privacy-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--ink, #000000);
}

.privacy-toggle-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--ink-soft, #333333);
}

/* Responsive */
@media (max-width: 640px) {
  .privacy-list {
    max-height: 300px;
  }
}
```

---

## Task 4: Create Update Privacy API

Create `/api/update-privacy.js`:

```javascript
// /api/update-privacy.js
// Update privacy_level for an entity or note

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_TABLES = ['user_entities', 'notes', 'user_patterns'];
const ALLOWED_LEVELS = ['private', 'internal', 'shared'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { table, id, privacy_level } = req.body;

    // Validate inputs
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }
    if (!ALLOWED_LEVELS.includes(privacy_level)) {
      return res.status(400).json({ error: 'Invalid privacy level' });
    }
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }

    // Update with user_id check for security
    const { error } = await supabase
      .from(table)
      .update({ privacy_level, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[UpdatePrivacy] Failed:', error);
      return res.status(500).json({ error: 'Update failed' });
    }

    return res.status(200).json({ success: true, privacy_level });

  } catch (error) {
    console.error('[UpdatePrivacy] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
```

---

## Task 5: Initialize Privacy Controls

Update Settings initialization to include PrivacyControls:

```javascript
// In ui.js or wherever Settings is initialized
// Mark with: // PRIVACY - T3

// After ExportUI.init()
if (typeof PrivacyControls !== 'undefined') {
  PrivacyControls.init();
}
```

And add script includes to index.html:

```html
<!-- PRIVACY - T3 -->
<link rel="stylesheet" href="/css/privacy-controls.css?v=100">
<script src="/js/privacy-controls.js?v=100"></script>
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| Privacy indicator shows in export section | Visual check | ☐ |
| Privacy summary API returns counts | Call API | ☐ |
| Privacy management section appears | Visual check | ☐ |
| Tab switching works | Click tabs | ☐ |
| Toggle updates privacy_level | Check database | ☐ |
| Export indicator updates after toggle | Toggle then check | ☐ |
| Design matches system | Black/white/silver | ☐ |

---

## Handoff Signals

**You're waiting for:**
- T1: `privacy_level` columns ready → then test toggles

**You signal when:**
```
T3 → T4: PRIVACY UI READY
- Privacy indicator in export section
- Privacy management section in Settings
- Toggle to mark entities/notes as private
- /api/privacy-summary and /api/update-privacy endpoints
Ready for testing!
```

---

## Definition of Done

- [ ] Privacy indicator shows count of excluded items
- [ ] Privacy management section in Settings
- [ ] Entity privacy toggles work
- [ ] Note privacy toggles work
- [ ] Export indicator updates after changes
- [ ] APIs created: privacy-summary, update-privacy
- [ ] Design matches system (outlined, black/white)
- [ ] Mobile responsive
- [ ] T4 signaled for testing
