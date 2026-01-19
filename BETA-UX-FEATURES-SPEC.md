# BETA-UX-FEATURES-SPEC.md
## 4 UX Features for Beta Launch
### January 15, 2026

---

# Overview

**Goal:** Build 4 essential UX features before beta launch
**Target Version:** 5.3.0
**Estimated Total Effort:** 3-4 hours

## Features to Build

| # | Feature | Purpose | Effort |
|---|---------|---------|--------|
| 1 | Onboarding Flow | Welcome new users, guide first experience | 1-2 hrs |
| 2 | Empty State UI | Show helpful prompts when tabs have no content | 30 min |
| 3 | Better Error Messages | User-friendly errors instead of silent fails | 30 min |
| 4 | Settings Page | Proper settings UI with all account options | 1 hr |

---

# Pre-Build Requirements

## Design System (from CLAUDE.md)

**CRITICAL: All UI must follow these guidelines:**

### Aesthetic
- Vogue minimalist, designed like a top SoHo design agency
- Editorial, not app-like
- Feels like a luxury magazine, not a productivity tool

### Colors
```css
--background: #FFFFFF;
--surface: #FAFAFA;
--surface-hover: #F5F5F5;
--border: #E5E5E5;
--border-light: #F0F0F0;
--text-primary: #000000;
--text-secondary: #666666;
--text-tertiary: #999999;
--accent: #000000;
--error: #EF4444;
```

### Typography
```css
--text-xs: 11px;    /* Labels */
--text-sm: 13px;    /* Secondary */
--text-base: 15px;  /* Body */
--text-lg: 17px;    /* Emphasis */
--text-xl: 20px;    /* Section headers */
--text-2xl: 24px;   /* Page titles */
```

### Rules
- Black and white dominant
- Color is rare and meaningful (only for errors, success)
- No shadows
- No gradients
- No colored backgrounds
- Typography-first
- Generous whitespace
- No em dashes in any text (use commas or periods instead)

---

# Workflow

Before building:
1. Open Abacus.ai tab in Chrome
2. Share this entire spec with Abacus.ai
3. Ask: "Review this spec for building 4 UX features. Any issues, edge cases, or suggestions before I build?"
4. Read and consider Abacus.ai's feedback
5. Adjust approach if needed
6. Then begin building

After building each feature:
1. Test thoroughly with Chrome MCP
2. Verify design matches guidelines
3. Report results

After all features complete:
1. Share test results with Abacus.ai
2. Get final feedback
3. Deploy

---

# Feature 1: Onboarding Flow

## Purpose
First-time users should see a welcoming experience that guides them, not an empty app.

## Trigger Condition
Show onboarding when ALL of these are true:
- User is signed in (has Sync.user)
- User has entered PIN successfully
- User has zero notes (DB.notes.length === 0)
- Onboarding not previously completed (localStorage check)

## User Flow

```
[User signs in and enters PIN]
           ↓
[Check: Has notes? Onboarding complete?]
           ↓
    [NO to both]
           ↓
┌─────────────────────────────────┐
│     SCREEN 1: Welcome           │
│                                 │
│     Welcome to                  │
│     Your Mirror in Code         │
│                                 │
│     A digital version of you,   │
│     trained by your daily       │
│     inputs, growing smarter     │
│     over time.                  │
│                                 │
│     [Get Started]               │
│                                 │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│     SCREEN 2: About You         │
│                                 │
│     What should I call you?     │
│                                 │
│     [Name input]                │
│                                 │
│     Tell me a bit about         │
│     yourself (optional)         │
│                                 │
│     [Textarea]                  │
│                                 │
│     [Skip]        [Continue]    │
│                                 │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│     SCREEN 3: First Note        │
│                                 │
│     Capture your first thought  │
│                                 │
│     What's on your mind?        │
│                                 │
│     [Note input area]           │
│                                 │
│     Try voice, text, or photo   │
│                                 │
└─────────────────────────────────┘
           ↓
[User creates first note]
           ↓
┌─────────────────────────────────┐
│     SCREEN 4: Success           │
│                                 │
│     Perfect.                    │
│     I'll remember this.         │
│                                 │
│     (auto-transition 2 sec)     │
│                                 │
└─────────────────────────────────┘
           ↓
[Normal app view with first note]
```

## File: js/onboarding.js (NEW)

```javascript
window.Onboarding = {
  STORAGE_KEY_PREFIX: 'onboarding_complete_',
  
  /**
   * Get storage key for current user
   */
  getStorageKey() {
    const userId = Sync.user?.id;
    if (!userId) return null;
    return this.STORAGE_KEY_PREFIX + userId;
  },
  
  /**
   * Check if onboarding should be shown
   * Returns true if: user signed in, no notes, onboarding not completed
   */
  shouldShow() {
    const storageKey = this.getStorageKey();
    if (!storageKey) return false;
    
    const completed = localStorage.getItem(storageKey);
    if (completed === 'true') return false;
    
    const hasNotes = DB.notes && DB.notes.length > 0;
    if (hasNotes) {
      // User has notes, mark onboarding as complete
      this.markComplete();
      return false;
    }
    
    return true;
  },
  
  /**
   * Mark onboarding as complete for current user
   */
  markComplete() {
    const storageKey = this.getStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
  },
  
  /**
   * Start the onboarding flow
   */
  start() {
    console.log('[Onboarding] Starting onboarding flow');
    this.showWelcome();
  },
  
  /**
   * Screen 1: Welcome
   */
  showWelcome() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content">
          <h1 class="onboarding-title">Welcome to<br>Your Mirror in Code</h1>
          <p class="onboarding-description">A digital version of you, trained by your daily inputs, growing smarter over time.</p>
          <button class="btn-primary onboarding-btn" onclick="Onboarding.showAboutYou()">Get Started</button>
        </div>
      </div>
    `;
  },
  
  /**
   * Screen 2: About You
   */
  showAboutYou() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content">
          <h2 class="onboarding-heading">What should I call you?</h2>
          <input 
            type="text" 
            id="onboarding-name" 
            class="onboarding-input" 
            placeholder="Your name"
            autocomplete="off"
          >
          
          <h2 class="onboarding-heading onboarding-heading-spaced">Tell me a bit about yourself</h2>
          <p class="onboarding-optional">Optional</p>
          <textarea 
            id="onboarding-about" 
            class="onboarding-textarea" 
            placeholder="I'm a founder, dog lover, based in Singapore..."
            rows="3"
          ></textarea>
          
          <div class="onboarding-buttons">
            <button class="btn-secondary" onclick="Onboarding.showFirstNote()">Skip</button>
            <button class="btn-primary" onclick="Onboarding.saveAboutAndContinue()">Continue</button>
          </div>
        </div>
      </div>
    `;
    
    // Focus name input
    document.getElementById('onboarding-name').focus();
  },
  
  /**
   * Save About You data and continue
   */
  async saveAboutAndContinue() {
    const name = document.getElementById('onboarding-name').value.trim();
    const about = document.getElementById('onboarding-about').value.trim();
    
    if (name || about) {
      try {
        await UserProfile.save({
          display_name: name,
          about_me: about
        });
        console.log('[Onboarding] Saved user profile');
      } catch (error) {
        console.error('[Onboarding] Failed to save profile:', error);
        // Continue anyway
      }
    }
    
    this.showFirstNote();
  },
  
  /**
   * Screen 3: First Note
   */
  showFirstNote() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content onboarding-content-wide">
          <h2 class="onboarding-heading">Capture your first thought</h2>
          <p class="onboarding-description">What's on your mind?</p>
          
          <textarea 
            id="onboarding-note" 
            class="onboarding-note-input" 
            placeholder="Start typing..."
            rows="4"
          ></textarea>
          
          <p class="onboarding-hint">You can also try voice or add a photo</p>
          
          <button class="btn-primary onboarding-btn" onclick="Onboarding.saveFirstNote()">Save</button>
        </div>
      </div>
    `;
    
    document.getElementById('onboarding-note').focus();
  },
  
  /**
   * Save first note and show success
   */
  async saveFirstNote() {
    const noteContent = document.getElementById('onboarding-note').value.trim();
    
    if (!noteContent) {
      UI.showError('Please enter something first');
      return;
    }
    
    try {
      // Create the note using existing app functionality
      await DB.createNote({
        content: noteContent,
        type: 'text',
        created_at: new Date().toISOString()
      });
      
      console.log('[Onboarding] First note saved');
      this.showSuccess();
    } catch (error) {
      console.error('[Onboarding] Failed to save note:', error);
      UI.showError('Could not save note. Please try again.');
    }
  },
  
  /**
   * Screen 4: Success
   */
  showSuccess() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content">
          <h2 class="onboarding-success-title">Perfect.</h2>
          <p class="onboarding-success-text">I'll remember this.</p>
        </div>
      </div>
    `;
    
    // Mark complete and transition to app after 2 seconds
    this.markComplete();
    
    setTimeout(() => {
      this.complete();
    }, 2000);
  },
  
  /**
   * Complete onboarding and load normal app
   */
  complete() {
    console.log('[Onboarding] Complete, loading app');
    UI.init();
  }
};
```

## CSS for Onboarding (add to styles.css)

```css
/* ==================== */
/* ONBOARDING           */
/* ==================== */

.onboarding-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: var(--background);
}

.onboarding-content {
  max-width: 300px;
  width: 100%;
  text-align: center;
}

.onboarding-content-wide {
  max-width: 400px;
}

.onboarding-title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin: 0 0 20px 0;
}

.onboarding-heading {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  text-align: left;
}

.onboarding-heading-spaced {
  margin-top: 28px;
}

.onboarding-description {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 32px 0;
}

.onboarding-optional {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0 0 8px 0;
  text-align: left;
}

.onboarding-input {
  width: 100%;
  padding: 14px 16px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text-primary);
}

.onboarding-input:focus {
  outline: none;
  border-color: var(--text-primary);
}

.onboarding-textarea {
  width: 100%;
  padding: 14px 16px;
  font-size: 15px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text-primary);
  resize: none;
  font-family: inherit;
}

.onboarding-textarea:focus {
  outline: none;
  border-color: var(--text-primary);
}

.onboarding-note-input {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text-primary);
  resize: none;
  font-family: inherit;
  min-height: 120px;
}

.onboarding-note-input:focus {
  outline: none;
  border-color: var(--text-primary);
}

.onboarding-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 12px 0 24px 0;
}

.onboarding-btn {
  width: 100%;
  padding: 16px 24px;
  font-size: 15px;
}

.onboarding-buttons {
  display: flex;
  gap: 12px;
  margin-top: 32px;
}

.onboarding-buttons .btn-secondary {
  flex: 1;
  padding: 14px 20px;
}

.onboarding-buttons .btn-primary {
  flex: 1;
  padding: 14px 20px;
}

.onboarding-success-title {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.onboarding-success-text {
  font-size: 17px;
  color: var(--text-secondary);
  margin: 0;
}
```

## Integration in js/app.js

In the init() function, after PIN verification and data loading, add:

```javascript
// After PIN verified and DB loaded
if (Onboarding.shouldShow()) {
  Onboarding.start();
  return; // Don't continue with normal UI
}

// Continue with normal UI.init()
```

## Add script to index.html

```html
<script src="js/onboarding.js"></script>
```

Make sure it loads AFTER db.js, sync.js, ui.js, and user-profile.js

## Test Checklist for Feature 1

- [ ] New user (no notes) sees onboarding after PIN entry
- [ ] Welcome screen displays correctly
- [ ] "Get Started" button works
- [ ] About You screen displays correctly
- [ ] Name and About fields work
- [ ] Skip button works
- [ ] Continue button saves data to user_profiles table
- [ ] First Note screen displays correctly
- [ ] Cannot save empty note (shows error)
- [ ] Saving note works
- [ ] Success screen displays for 2 seconds
- [ ] Transitions to normal app with note visible
- [ ] Refreshing page does NOT show onboarding again
- [ ] Existing user (has notes) does NOT see onboarding
- [ ] Design matches Vogue guidelines (minimal, black/white)

---

# Feature 2: Empty State UI

## Purpose
When a tab has no content, show helpful prompts instead of blank space.

## Empty States Needed

### Notes Tab (no notes)
```
┌─────────────────────────────────┐
│                                 │
│         No notes yet            │
│                                 │
│   Capture your first thought    │
│                                 │
│       [Create Note]             │
│                                 │
└─────────────────────────────────┘
```

### Actions Tab (no actions)
```
┌─────────────────────────────────┐
│                                 │
│        No actions yet           │
│                                 │
│   Actions will appear when      │
│   you capture tasks and         │
│   commitments in your notes     │
│                                 │
└─────────────────────────────────┘
```

### Twin Tab (no data)
```
┌─────────────────────────────────┐
│                                 │
│     Your Twin is learning       │
│                                 │
│   The more you share, the       │
│   smarter it gets               │
│                                 │
└─────────────────────────────────┘
```

## Implementation in js/ui.js

Add this method to the UI object:

```javascript
/**
 * Render empty state for a given section
 * @param {string} type - 'notes', 'actions', or 'twin'
 * @returns {string} HTML string
 */
renderEmptyState(type) {
  const states = {
    notes: {
      title: 'No notes yet',
      description: 'Capture your first thought',
      action: {
        label: 'Create Note',
        onclick: 'UI.focusNoteInput()'
      }
    },
    actions: {
      title: 'No actions yet',
      description: 'Actions will appear when you capture tasks and commitments in your notes',
      action: null
    },
    twin: {
      title: 'Your Twin is learning',
      description: 'The more you share, the smarter it gets',
      action: null
    }
  };
  
  const state = states[type];
  if (!state) {
    console.error('[UI] Unknown empty state type:', type);
    return '';
  }
  
  let actionHTML = '';
  if (state.action) {
    actionHTML = `<button class="btn-secondary empty-state-btn" onclick="${state.action.onclick}">${state.action.label}</button>`;
  }
  
  return `
    <div class="empty-state">
      <h3 class="empty-state-title">${state.title}</h3>
      <p class="empty-state-description">${state.description}</p>
      ${actionHTML}
    </div>
  `;
},

/**
 * Focus the note input field
 */
focusNoteInput() {
  const input = document.getElementById('note-input');
  if (input) {
    input.focus();
  }
}
```

## Update renderNotes() in js/ui.js

```javascript
renderNotes() {
  const notes = DB.notes || [];
  
  if (notes.length === 0) {
    return this.renderEmptyState('notes');
  }
  
  // ... existing render logic
}
```

## Update renderActions() in js/actions-ui.js

```javascript
renderActions() {
  const actions = this.getActions() || [];
  
  if (actions.length === 0) {
    return UI.renderEmptyState('actions');
  }
  
  // ... existing render logic
}
```

## Update Twin tab rendering in js/twin-ui.js

```javascript
renderTwinContent() {
  const hasProfile = UserProfile.profile && UserProfile.profile.display_name;
  const hasEntities = EntityMemory.entities && EntityMemory.entities.length > 0;
  const hasFeedback = /* check feedback count */;
  
  if (!hasProfile && !hasEntities && !hasFeedback) {
    return UI.renderEmptyState('twin');
  }
  
  // ... existing render logic
}
```

## CSS for Empty States (add to styles.css)

```css
/* ==================== */
/* EMPTY STATES         */
/* ==================== */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px;
  min-height: 300px;
}

.empty-state-title {
  font-size: 17px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.empty-state-description {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0 0 24px 0;
  max-width: 240px;
  line-height: 1.5;
}

.empty-state-btn {
  padding: 12px 24px;
  font-size: 14px;
}
```

## Test Checklist for Feature 2

- [ ] New account with no notes shows empty state in Notes tab
- [ ] Empty state has "Create Note" button that focuses input
- [ ] Creating a note makes empty state disappear
- [ ] Actions tab shows empty state when no actions
- [ ] Twin tab shows empty state when no data
- [ ] Empty states are centered and clean
- [ ] Design matches Vogue guidelines

---

# Feature 3: Better Error Messages

## Purpose
Replace silent failures and console-only errors with user-friendly toast messages.

## Error Scenarios

| Scenario | Message | Has Retry? |
|----------|---------|------------|
| Network error | "Couldn't connect. Check your internet and try again." | Yes |
| Analysis failed | "Something went wrong analyzing your note. It's been saved." | No |
| Save failed | "Couldn't save. Please try again." | Yes |
| Sign in failed (wrong password) | "Invalid email or password." | No |
| Sign in failed (no account) | "Account not found. Please sign up." | No |
| PIN wrong | "Incorrect PIN. Try again." | No |
| PIN too many attempts | "Too many attempts. Please wait 30 seconds." | No |
| Generic error | "Something went wrong. Please try again." | No |

## Implementation in js/ui.js

Add these methods to the UI object:

```javascript
/**
 * Show error toast message
 * @param {string} message - Error message to display
 * @param {object} options - Optional settings
 * @param {string} options.retry - Function name to call on retry (e.g., 'UI.retryLastAction()')
 * @param {number} options.duration - How long to show (ms), default 5000
 */
showError(message, options = {}) {
  const { retry = null, duration = 5000 } = options;
  
  // Remove any existing toast
  this.hideToast();
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.id = 'app-toast';
  
  let retryHTML = '';
  if (retry) {
    retryHTML = `<button class="toast-btn" onclick="${retry}; UI.hideToast();">Retry</button>`;
  }
  
  toast.innerHTML = `
    <p class="toast-message">${message}</p>
    ${retryHTML}
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });
  
  // Auto-hide if no retry button
  if (!retry) {
    setTimeout(() => {
      this.hideToast();
    }, duration);
  }
},

/**
 * Show success toast message
 * @param {string} message - Success message to display
 * @param {number} duration - How long to show (ms), default 3000
 */
showSuccess(message, duration = 3000) {
  // Remove any existing toast
  this.hideToast();
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.id = 'app-toast';
  
  toast.innerHTML = `<p class="toast-message">${message}</p>`;
  
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });
  
  setTimeout(() => {
    this.hideToast();
  }, duration);
},

/**
 * Hide current toast
 */
hideToast() {
  const existing = document.getElementById('app-toast');
  if (existing) {
    existing.classList.remove('toast-visible');
    setTimeout(() => {
      existing.remove();
    }, 300);
  }
}
```

## CSS for Toasts (add to styles.css)

```css
/* ==================== */
/* TOAST MESSAGES       */
/* ==================== */

.toast {
  position: fixed;
  bottom: 100px;
  left: 16px;
  right: 16px;
  padding: 16px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: 1000;
}

.toast-visible {
  opacity: 1;
  transform: translateY(0);
}

.toast-error {
  background: var(--text-primary);
  color: var(--background);
}

.toast-success {
  background: var(--text-primary);
  color: var(--background);
}

.toast-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  flex: 1;
}

.toast-btn {
  background: transparent;
  border: 1px solid var(--background);
  color: var(--background);
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.toast-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

## Update Error Handling in js/analyzer.js

```javascript
async analyze(note) {
  try {
    const response = await fetch('/api/analyze', {
      // ... existing code
    });
    
    if (!response.ok) {
      throw new Error('Analysis failed');
    }
    
    // ... existing code
  } catch (error) {
    console.error('[Analyzer] Error:', error);
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      UI.showError('Couldn\'t connect. Check your internet and try again.', {
        retry: 'Analyzer.retryLastAnalysis()'
      });
    } else {
      UI.showError('Something went wrong analyzing your note. It\'s been saved.');
    }
    
    throw error;
  }
}
```

## Update Error Handling in js/sync.js

```javascript
async signIn(email, password) {
  try {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      if (error.message.includes('Invalid login')) {
        UI.showError('Invalid email or password.');
      } else if (error.message.includes('not found')) {
        UI.showError('Account not found. Please sign up.');
      } else {
        UI.showError('Could not sign in. Please try again.');
      }
      return { error };
    }
    
    // ... existing code
  } catch (error) {
    UI.showError('Couldn\'t connect. Check your internet and try again.');
    throw error;
  }
}
```

## Update Error Handling in js/pin.js

```javascript
// Add attempt tracking
let pinAttempts = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30000; // 30 seconds
let lockoutUntil = null;

async verifyPIN(enteredPIN) {
  // Check lockout
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
    UI.showError(`Too many attempts. Please wait ${secondsLeft} seconds.`);
    return false;
  }
  
  const isValid = await this.checkPIN(enteredPIN);
  
  if (!isValid) {
    pinAttempts++;
    
    if (pinAttempts >= MAX_ATTEMPTS) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION;
      pinAttempts = 0;
      UI.showError('Too many attempts. Please wait 30 seconds.');
    } else {
      UI.showError('Incorrect PIN. Try again.');
    }
    
    return false;
  }
  
  // Reset on success
  pinAttempts = 0;
  lockoutUntil = null;
  return true;
}
```

## Test Checklist for Feature 3

- [ ] Network error shows toast with Retry button
- [ ] Analysis error shows appropriate message
- [ ] Wrong PIN shows "Incorrect PIN" message
- [ ] 5 wrong PINs shows lockout message
- [ ] Sign in with wrong password shows error
- [ ] Success messages appear and auto-dismiss
- [ ] Toasts are styled correctly (black background, white text)
- [ ] Retry button works
- [ ] Toast auto-dismisses after 5 seconds (if no retry)

---

# Feature 4: Settings Page

## Purpose
Proper settings UI with all account and app options in one place.

## Settings Structure

```
┌─────────────────────────────────┐
│  ← Back           Settings      │
├─────────────────────────────────┤
│                                 │
│  ACCOUNT                        │
│  ┌─────────────────────────────┐│
│  │ Email     user@email.com   ││
│  └─────────────────────────────┘│
│  [Sign Out]                     │
│                                 │
│  SECURITY                       │
│  [Change PIN]                   │
│  [Lock App]                     │
│                                 │
│  DATA                           │
│  [Delete All My Data] (red)     │
│                                 │
│  ABOUT                          │
│  ┌─────────────────────────────┐│
│  │ Version          5.3.0     ││
│  └─────────────────────────────┘│
│  Your Mirror in Code            │
│                                 │
└─────────────────────────────────┘
```

## File: js/settings.js (NEW)

```javascript
window.Settings = {
  /**
   * Show settings page
   */
  show() {
    console.log('[Settings] Opening settings page');
    
    const user = Sync.user;
    const container = document.getElementById('app-container');
    
    container.innerHTML = `
      <div class="settings-page">
        <header class="settings-header">
          <button class="settings-back-btn" onclick="Settings.close()">
            <span class="settings-back-arrow">←</span>
            <span>Back</span>
          </button>
          <h1 class="settings-title">Settings</h1>
          <div class="settings-header-spacer"></div>
        </header>
        
        <div class="settings-content">
          <section class="settings-section">
            <h2 class="settings-section-title">Account</h2>
            <div class="settings-item">
              <span class="settings-item-label">Email</span>
              <span class="settings-item-value">${user?.email || 'Not signed in'}</span>
            </div>
            <button class="btn-secondary settings-btn" onclick="Settings.signOut()">
              Sign Out
            </button>
          </section>
          
          <section class="settings-section">
            <h2 class="settings-section-title">Security</h2>
            <button class="btn-secondary settings-btn" onclick="Settings.changePIN()">
              Change PIN
            </button>
            <button class="btn-secondary settings-btn" onclick="Settings.lockApp()">
              Lock App
            </button>
          </section>
          
          <section class="settings-section">
            <h2 class="settings-section-title">Data</h2>
            <button class="btn-danger settings-btn" onclick="Settings.deleteAllData()">
              Delete All My Data
            </button>
            <p class="settings-warning">This will permanently delete all your notes and data.</p>
          </section>
          
          <section class="settings-section">
            <h2 class="settings-section-title">About</h2>
            <div class="settings-item">
              <span class="settings-item-label">Version</span>
              <span class="settings-item-value">${window.APP_VERSION || '5.3.0'}</span>
            </div>
            <p class="settings-tagline">Your Mirror in Code</p>
          </section>
        </div>
      </div>
    `;
  },
  
  /**
   * Close settings and return to app
   */
  close() {
    console.log('[Settings] Closing settings page');
    UI.init();
  },
  
  /**
   * Sign out of account
   */
  async signOut() {
    const confirmed = confirm('Sign out of your account?');
    if (!confirmed) return;
    
    console.log('[Settings] Signing out');
    
    try {
      await Sync.signOut();
      location.reload();
    } catch (error) {
      console.error('[Settings] Sign out failed:', error);
      UI.showError('Could not sign out. Please try again.');
    }
  },
  
  /**
   * Change PIN
   */
  async changePIN() {
    console.log('[Settings] Change PIN requested');
    
    // Show PIN change UI
    const container = document.getElementById('app-container');
    container.innerHTML = `
      <div class="settings-page">
        <header class="settings-header">
          <button class="settings-back-btn" onclick="Settings.show()">
            <span class="settings-back-arrow">←</span>
            <span>Back</span>
          </button>
          <h1 class="settings-title">Change PIN</h1>
          <div class="settings-header-spacer"></div>
        </header>
        
        <div class="settings-content">
          <section class="settings-section">
            <h2 class="settings-section-title">Enter Current PIN</h2>
            <input 
              type="password" 
              id="current-pin" 
              class="settings-pin-input" 
              placeholder="Current PIN"
              inputmode="numeric"
              maxlength="6"
            >
          </section>
          
          <section class="settings-section">
            <h2 class="settings-section-title">Enter New PIN</h2>
            <input 
              type="password" 
              id="new-pin" 
              class="settings-pin-input" 
              placeholder="New PIN (6 digits)"
              inputmode="numeric"
              maxlength="6"
            >
          </section>
          
          <section class="settings-section">
            <h2 class="settings-section-title">Confirm New PIN</h2>
            <input 
              type="password" 
              id="confirm-pin" 
              class="settings-pin-input" 
              placeholder="Confirm new PIN"
              inputmode="numeric"
              maxlength="6"
            >
          </section>
          
          <button class="btn-primary settings-btn" onclick="Settings.savePIN()">
            Save New PIN
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('current-pin').focus();
  },
  
  /**
   * Save new PIN
   */
  async savePIN() {
    const currentPIN = document.getElementById('current-pin').value;
    const newPIN = document.getElementById('new-pin').value;
    const confirmPIN = document.getElementById('confirm-pin').value;
    
    // Validate current PIN
    const isCurrentValid = await PIN.verify(currentPIN);
    if (!isCurrentValid) {
      UI.showError('Current PIN is incorrect.');
      return;
    }
    
    // Validate new PIN
    if (newPIN.length < 4) {
      UI.showError('PIN must be at least 4 digits.');
      return;
    }
    
    if (newPIN !== confirmPIN) {
      UI.showError('New PINs do not match.');
      return;
    }
    
    // Save new PIN
    try {
      await PIN.save(newPIN);
      UI.showSuccess('PIN changed successfully.');
      this.show();
    } catch (error) {
      console.error('[Settings] PIN change failed:', error);
      UI.showError('Could not change PIN. Please try again.');
    }
  },
  
  /**
   * Lock the app
   */
  lockApp() {
    console.log('[Settings] Locking app');
    UI.lockApp();
  },
  
  /**
   * Delete all user data
   */
  async deleteAllData() {
    const confirmed = confirm(
      'This will permanently delete ALL your data including notes, entities, and everything the Twin has learned. This cannot be undone.\n\nAre you sure?'
    );
    
    if (!confirmed) return;
    
    // Double confirm for safety
    const doubleConfirmed = confirm('Are you absolutely sure? This cannot be undone.');
    if (!doubleConfirmed) return;
    
    console.log('[Settings] Deleting all user data');
    
    try {
      await DB.deleteAllUserData();
      UI.showSuccess('All data deleted.');
      
      setTimeout(() => {
        location.reload();
      }, 1500);
    } catch (error) {
      console.error('[Settings] Delete failed:', error);
      UI.showError('Could not delete all data. Please try again.');
    }
  }
};
```

## CSS for Settings (add to styles.css)

```css
/* ==================== */
/* SETTINGS PAGE        */
/* ==================== */

.settings-page {
  min-height: 100vh;
  background: var(--background);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  position: sticky;
  top: 0;
  background: var(--background);
  z-index: 10;
}

.settings-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 15px;
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px 12px;
  margin: -8px -12px;
}

.settings-back-arrow {
  font-size: 18px;
}

.settings-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.settings-header-spacer {
  width: 60px;
}

.settings-content {
  padding: 24px 16px;
}

.settings-section {
  margin-bottom: 36px;
}

.settings-section-title {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  margin: 0 0 12px 0;
}

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-light);
}

.settings-item-label {
  font-size: 15px;
  color: var(--text-primary);
}

.settings-item-value {
  font-size: 15px;
  color: var(--text-secondary);
}

.settings-btn {
  width: 100%;
  padding: 14px 20px;
  margin-top: 12px;
  font-size: 15px;
}

.settings-btn:first-of-type {
  margin-top: 0;
}

.btn-danger {
  background: transparent;
  color: var(--error);
  border: 1px solid var(--error);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.05);
}

.settings-warning {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 12px 0 0 0;
  text-align: center;
}

.settings-tagline {
  font-size: 14px;
  color: var(--text-tertiary);
  text-align: center;
  margin: 16px 0 0 0;
}

.settings-pin-input {
  width: 100%;
  padding: 14px 16px;
  font-size: 18px;
  text-align: center;
  letter-spacing: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text-primary);
}

.settings-pin-input:focus {
  outline: none;
  border-color: var(--text-primary);
}
```

## Update Header to Include Settings Button

In the main app header (index.html or wherever header is rendered), ensure there's a settings button:

```html
<header class="app-header">
  <div class="header-left">
    <!-- Logo or title -->
  </div>
  <div class="header-right">
    <button class="header-btn" onclick="UI.lockApp()" title="Lock">🔒</button>
    <button class="header-btn" onclick="Settings.show()" title="Settings">⚙️</button>
  </div>
</header>
```

## Add script to index.html

```html
<script src="js/settings.js"></script>
```

## Test Checklist for Feature 4

- [ ] Settings icon visible in header
- [ ] Clicking settings icon opens settings page
- [ ] Back button returns to app
- [ ] Email displays correctly
- [ ] Sign Out button works (with confirmation)
- [ ] Change PIN flow works
  - [ ] Current PIN validation works
  - [ ] New PIN validation (min length, match)
  - [ ] PIN actually changes
- [ ] Lock App button works
- [ ] Delete All Data works (with double confirmation)
- [ ] Version displays correctly
- [ ] Design matches Vogue guidelines

---

# Deployment

## Pre-Deployment Checklist

- [ ] All 4 features implemented
- [ ] All CSS added to styles.css
- [ ] All new JS files created (onboarding.js, settings.js)
- [ ] Scripts added to index.html in correct order
- [ ] Version updated to 5.3.0 in:
  - [ ] js/app.js (APP_VERSION constant)
  - [ ] index.html (SW registration query param)

## Deploy Command

```bash
vercel --prod
```

## Post-Deployment Verification

1. Hard refresh the app
2. Check console for version 5.3.0
3. Test each feature per checklist above

---

# Final Report Template

After completing all features, report results in this format:

```
## Beta UX Features - v5.3.0 Test Results

### Overall Status
- Features Built: 4/4
- Tests Passed: X/X
- Issues Found: X

### Feature 1: Onboarding Flow
Status: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
Issues: [list any issues]

### Feature 2: Empty State UI
Status: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
Issues: [list any issues]

### Feature 3: Better Error Messages
Status: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
Issues: [list any issues]

### Feature 4: Settings Page
Status: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
Issues: [list any issues]

### Design Compliance
- Vogue minimalist aesthetic: ✅/❌
- Black and white dominant: ✅/❌
- No shadows/gradients: ✅/❌
- Typography-first: ✅/❌

### Recommendations
1. [any follow-up items]
```

---

*Specification created: January 15, 2026*
*Target version: 5.3.0*
