# Terminal 3: Frontend Lead — Export UI

**Role:** Build the export button and user interface  
**Task ID:** `export-build-t3`

---

## Your Ownership

**Files you OWN (only you touch these):**
```
/js/settings-export.js      ← Export UI logic
/css/settings-export.css    ← Export UI styles
```

**Files you may EDIT (coordinate, mark with `// EXPORT - T3`):**
```
/js/ui.js                   ← Add initialization hook
/js/app.js                  ← Add import if needed
/index.html                 ← Add section if needed
```

**Design system reference:**
```
/css/styles.css             ← Read for design tokens
CLAUDE.md                   ← Read for design principles
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/export-ui
touch js/settings-export.js
touch css/settings-export.css
export CLAUDE_CODE_TASK_LIST_ID=export-build-t3
```

---

## Design Requirements

**From CLAUDE.md - Design System:**
- Black, white, silver only — No color accents
- Typography-first — Playfair Display for headlines, Inter for UI
- Thin lines — 1px borders, no shadows
- Generous whitespace
- Subtle motion — things appear, they don't bounce

**Export Section Should:**
- Fit naturally in Settings page
- Be clear about what it does
- Show loading state during export
- Confirm success
- Handle errors gracefully

---

## Task 1: Create Export UI Component

Create `/js/settings-export.js`:

```javascript
// /js/settings-export.js
// OWNER: T3
// PURPOSE: Export button and UI for Settings page

const ExportUI = {
  
  /**
   * Initialize export UI
   * Call this when Settings page loads
   */
  init() {
    this.injectStyles();
    this.injectExportSection();
    this.bindEvents();
    console.log('[ExportUI] Initialized');
  },

  /**
   * Inject CSS if not using separate file
   */
  injectStyles() {
    if (document.getElementById('export-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'export-styles';
    link.rel = 'stylesheet';
    link.href = '/css/settings-export.css';
    document.head.appendChild(link);
  },

  /**
   * Find settings container and inject export section
   */
  injectExportSection() {
    // Find the settings content area
    // Adjust selector based on actual Settings page structure
    const container = document.querySelector('.settings-content') 
      || document.querySelector('.settings-container')
      || document.querySelector('[data-settings]');
    
    if (!container) {
      console.warn('[ExportUI] Settings container not found');
      return;
    }

    // Check if already injected
    if (document.getElementById('export-section')) return;

    const section = document.createElement('div');
    section.id = 'export-section';
    section.className = 'settings-section export-section';
    section.innerHTML = `
      <div class="export-header">
        <h3 class="export-title">Your Data</h3>
      </div>
      
      <p class="export-description">
        Export everything Inscript knows about you — your identity, 
        the people in your life, your notes, and patterns we've detected. 
        Take it to ChatGPT, Claude, or any AI.
      </p>
      
      <button id="export-btn" class="export-button" type="button">
        <span class="export-button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <li><strong>Patterns</strong> — Habits and preferences we've detected</li>
        </ul>
      </details>
    `;
    
    container.appendChild(section);
  },

  /**
   * Bind click event to export button
   */
  bindEvents() {
    const btn = document.getElementById('export-btn');
    if (!btn) return;
    
    btn.addEventListener('click', () => this.handleExport());
    
    // Keyboard accessibility
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleExport();
      }
    });
  },

  /**
   * Handle export button click
   */
  async handleExport() {
    const btn = document.getElementById('export-btn');
    const label = btn.querySelector('.export-button-label');
    
    // Prevent double-click
    if (btn.disabled) return;
    
    // Set loading state
    btn.disabled = true;
    btn.classList.add('loading');
    label.textContent = 'Preparing export...';
    this.hideStatus();
    
    try {
      // Get auth token
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Call export API
      const response = await fetch('/api/export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }
      
      // Get blob and trigger download
      const blob = await response.blob();
      this.downloadBlob(blob);
      
      // Show success
      this.showStatus('success', 'Export complete! Check your downloads.');
      
    } catch (error) {
      console.error('[ExportUI] Export failed:', error);
      this.showStatus('error', error.message || 'Export failed. Please try again.');
    } finally {
      // Reset button
      btn.disabled = false;
      btn.classList.remove('loading');
      label.textContent = 'Export My Memory';
    }
  },

  /**
   * Get current user's auth token
   * Adjust based on how Inscript handles auth
   */
  async getAuthToken() {
    // Option 1: From Supabase client
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session?.access_token;
    }
    
    // Option 2: From localStorage
    const storedSession = localStorage.getItem('supabase.auth.token');
    if (storedSession) {
      const parsed = JSON.parse(storedSession);
      return parsed?.currentSession?.access_token;
    }
    
    // Option 3: From app's auth system
    if (window.Auth?.getToken) {
      return window.Auth.getToken();
    }
    
    console.warn('[ExportUI] Could not find auth token');
    return null;
  },

  /**
   * Trigger file download
   */
  downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscript-export-${this.getDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Get formatted date string for filename
   */
  getDateString() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Show status message
   */
  showStatus(type, message) {
    const status = document.getElementById('export-status');
    const icon = status.querySelector('.export-status-icon');
    const text = status.querySelector('.export-status-text');
    
    status.hidden = false;
    status.className = `export-status ${type}`;
    text.textContent = message;
    
    // Icon based on type
    if (type === 'success') {
      icon.innerHTML = '✓';
    } else if (type === 'error') {
      icon.innerHTML = '✕';
    } else {
      icon.innerHTML = '';
    }
    
    // Auto-hide success after 5 seconds
    if (type === 'success') {
      setTimeout(() => this.hideStatus(), 5000);
    }
  },

  /**
   * Hide status message
   */
  hideStatus() {
    const status = document.getElementById('export-status');
    if (status) {
      status.hidden = true;
    }
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportUI;
}

// Make available globally
window.ExportUI = ExportUI;
```

---

## Task 2: Create Export Styles

Create `/css/settings-export.css`:

```css
/* /css/settings-export.css */
/* OWNER: T3 */
/* Design: SoHo minimalist editorial (black, white, silver) */

/* ============================================
   EXPORT SECTION
   ============================================ */

.export-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--silver-200, #E5E5E5);
}

.export-header {
  margin-bottom: 0.75rem;
}

.export-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--ink, #000000);
  margin: 0;
}

.export-description {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--ink-soft, #333333);
  margin: 0 0 1.5rem 0;
  max-width: 480px;
}

/* ============================================
   EXPORT BUTTON
   ============================================ */

.export-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  
  color: var(--ink, #000000);
  background: var(--paper, #FFFFFF);
  border: 1px solid var(--ink, #000000);
  border-radius: 2px;
  
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.export-button:hover:not(:disabled) {
  background: var(--ink, #000000);
  color: var(--paper, #FFFFFF);
}

.export-button:focus {
  outline: 2px solid var(--ink, #000000);
  outline-offset: 2px;
}

.export-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.export-button.loading .export-button-icon {
  animation: spin 1s linear infinite;
}

.export-button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.export-button-label {
  /* Label styling inherited from button */
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ============================================
   STATUS MESSAGE
   ============================================ */

.export-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  
  border-radius: 2px;
}

.export-status.success {
  background: var(--silver-50, #F9F9F9);
  color: var(--success, #065F46);
  border: 1px solid var(--success, #065F46);
}

.export-status.error {
  background: var(--silver-50, #F9F9F9);
  color: var(--error, #8B0000);
  border: 1px solid var(--error, #8B0000);
}

.export-status-icon {
  font-weight: bold;
}

/* ============================================
   NOTE & DETAILS
   ============================================ */

.export-note {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--silver-600, #666666);
  margin: 1rem 0 0 0;
  max-width: 400px;
}

.export-details {
  margin-top: 1.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
}

.export-details summary {
  cursor: pointer;
  color: var(--ink-soft, #333333);
  font-weight: 500;
}

.export-details summary:hover {
  color: var(--ink, #000000);
}

.export-details[open] summary {
  margin-bottom: 0.75rem;
}

.export-details-list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--ink-soft, #333333);
}

.export-details-list li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.export-details-list strong {
  color: var(--ink, #000000);
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 640px) {
  .export-section {
    padding-top: 1.5rem;
    margin-top: 1.5rem;
  }
  
  .export-button {
    width: 100%;
    justify-content: center;
  }
  
  .export-description,
  .export-note {
    max-width: 100%;
  }
}

/* ============================================
   DARK MODE (if supported)
   ============================================ */

@media (prefers-color-scheme: dark) {
  .export-title {
    color: var(--paper, #FFFFFF);
  }
  
  .export-description {
    color: var(--silver-300, #CCCCCC);
  }
  
  .export-button {
    color: var(--paper, #FFFFFF);
    background: transparent;
    border-color: var(--paper, #FFFFFF);
  }
  
  .export-button:hover:not(:disabled) {
    background: var(--paper, #FFFFFF);
    color: var(--ink, #000000);
  }
}
```

---

## Task 3: Integrate with Settings Page

Add hook in settings initialization. Find where Settings page is initialized and add:

```javascript
// In wherever settings UI is initialized
// Mark with: // EXPORT - T3

// Initialize export UI when settings loads
if (typeof ExportUI !== 'undefined') {
  ExportUI.init();
}
```

**Alternative: Auto-init on DOMContentLoaded**

Add to bottom of `settings-export.js`:

```javascript
// Auto-initialize when DOM is ready and we're on settings page
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on settings page
  const isSettingsPage = window.location.hash === '#settings' 
    || document.querySelector('.settings-page')
    || document.querySelector('[data-page="settings"]');
  
  if (isSettingsPage) {
    ExportUI.init();
  }
});

// Also listen for hash changes (SPA navigation)
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#settings') {
    ExportUI.init();
  }
});
```

---

## Task 4: Test Without API (Mock Mode)

For testing before T1's API is ready, add mock mode:

```javascript
// Add to ExportUI object

mockExport: true, // Set to false when API ready

async handleExport() {
  // ... existing loading state code ...
  
  try {
    if (this.mockExport) {
      // Simulate API delay
      await new Promise(r => setTimeout(r, 1500));
      
      // Create mock export data
      const mockData = {
        inscript_export: {
          identity: { name: "Test User" },
          entities: [],
          episodes: { notes: [] },
          patterns: [],
          meta: { 
            version: "1.0.0",
            exported_at: new Date().toISOString(),
            note: "MOCK DATA - API not connected"
          }
        }
      };
      
      const blob = new Blob([JSON.stringify(mockData, null, 2)], { 
        type: 'application/json' 
      });
      this.downloadBlob(blob);
      this.showStatus('success', 'Mock export complete!');
      return;
    }
    
    // Real API call...
  }
}
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| Section appears in Settings | Visual check | ☐ |
| Button is clickable | Click triggers handler | ☐ |
| Loading state shows | Button disables, text changes | ☐ |
| Mock download works | JSON file downloads | ☐ |
| Success message shows | Green message appears | ☐ |
| Error message shows | Disconnect API, see error | ☐ |
| Mobile responsive | Check on small viewport | ☐ |
| Keyboard accessible | Tab to button, Enter to click | ☐ |

---

## Handoff Signals

**You're waiting for:**
- T1: API endpoint ready → then test real export

**You signal when:**
- UI renders and mock works → tell T4 to test UI
- Real API integration works → tell T4 for E2E

**Signal format:**
```
T3 → T4: UI READY FOR TESTING
Location: Settings page
Button: "Export My Memory"
Mock mode: ON (set mockExport: false for real API)
```

After T1 API ready:
```
T3 → T4: FULL E2E READY
API connected, real export working
Test the full flow!
```

---

## Definition of Done

- [ ] Export section appears in Settings
- [ ] Button has proper hover/focus states
- [ ] Loading state works
- [ ] Download triggers (mock or real)
- [ ] Success toast appears
- [ ] Error handling works
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] Matches design system (black/white/silver)

---

## Design Reference

From CLAUDE.md:
```css
/* Colors */
--paper: #FFFFFF;
--ink: #000000;
--silver-200: #E5E5E5;
--success: #065F46;
--error: #8B0000;

/* Fonts */
Playfair Display - headlines
Inter - UI elements
```

Button style should match existing Inscript buttons. Check `/css/styles.css` for existing patterns.
