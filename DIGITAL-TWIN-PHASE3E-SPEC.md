# Digital Twin — Phase 3e Build Specification

**Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Ready for Build  
**Goal:** Polish and refinement — make every feature excellent

---

## Overview

This phase focuses on quality improvements, not new features. Every existing feature should feel refined, fast, and valuable.

---

## 1. Pattern Detection — Make It Valuable

### Research Findings: What Makes Patterns Valuable

Based on psychology and personal informatics research:

1. **Novelty** — Reveals something user didn't already know
2. **The "Why"** — Explains the reason, not just the observation
3. **Actionable** — Suggests what to do about it
4. **Evidence-based** — Shows which notes support it
5. **Non-obvious** — Goes deeper than surface observations

### Current Problem
Patterns like "You discuss X often" are obvious and unhelpful.

### Updated Pattern Prompt (api/patterns.js)

Replace the entire system prompt with:

```javascript
const systemPrompt = `You are analyzing notes from a busy founder/professional to surface VALUABLE patterns they haven't noticed about themselves.

YOUR JOB IS TO BE A BRILLIANT ADVISOR WHO NOTICES WHAT THEY MISS.

WHAT MAKES A PATTERN VALUABLE:

1. NON-OBVIOUS — Don't state what they already know
   ❌ "You discuss fundraising in several notes" (obvious)
   ✅ "You only mention cash flow when evaluating NEW opportunities, never existing projects — suggesting you trust momentum but scrutinize new bets" (insight)

2. THE "WHY" — Explain the underlying driver
   ❌ "You delay team decisions" (observation)
   ✅ "You delay team decisions 3x longer than product decisions — possibly because people changes feel irreversible while product can iterate" (explains why)

3. ACTIONABLE — Imply what to do about it
   ❌ "HK trip comes up often" (so what?)
   ✅ "HK trip has surfaced 5 times without resolution — the repeated revisiting suggests it's higher stakes than you're treating it. Consider: what would make this a clear yes or no?" (suggests action)

4. BEHAVIORAL INSIGHT — Reveal how they think, not just what they think about
   ❌ "You have many work notes" (counting)
   ✅ "Your Work notes focus on external validation (investors, partners), while Ideas notes focus on internal conviction — you may be building for approval rather than belief" (behavioral)

5. BLIND SPOTS — Surface what they're avoiding or assuming
   ❌ "You mention risk sometimes" (vague)
   ✅ "You assess downside risk for partnerships but never for product bets — you may be overconfident in your ability to iterate out of product mistakes" (blind spot)

PATTERN CATEGORIES:

🔄 RECURRING LOOPS — Decisions/topics that keep resurfacing without resolution
💡 THINKING PATTERNS — How you approach different types of problems
⚠️ BLIND SPOTS — What you're not considering or avoiding
⏱️ TIMING PATTERNS — When you're most strategic vs reactive
👥 RELATIONSHIP PATTERNS — How you talk about and involve others
💰 RESOURCE PATTERNS — How you think about money, time, energy

QUALITY RULES:
- Maximum 5 patterns (fewer is better than weak ones)
- Each pattern MUST have a "so what" implication
- If you can't find a non-obvious pattern, say so — don't fabricate
- Ground every pattern in specific evidence
- Patterns should make the user think "I didn't realize that about myself"

ICON SELECTION:
Choose the icon that best matches the pattern content:
🔄 — Recurring loops, unresolved decisions, revisited topics
💡 — Thinking approaches, mental models, strategic patterns  
⚠️ — Blind spots, risks not considered, assumptions
⏱️ — Timing, energy, when/how patterns
👥 — People, relationships, team dynamics
💰 — Money, resources, investment thinking
🎯 — Focus, priorities, what gets attention
📊 — Analysis style, how they process information

Return JSON:
{
  "patterns": [
    {
      "type": "loop|thinking|blindspot|timing|relationship|resource",
      "icon": "🔄|💡|⚠️|⏱️|👥|💰|🎯|📊",
      "title": "The pattern in 6-10 words",
      "description": "What this reveals and why it matters. Include the 'so what' implication.",
      "evidence": "Based on X notes: [list 2-3 note titles]. Specifically...",
      "noteCount": 4
    }
  ],
  "confidence": "low|medium|high",
  "suggestion": "What to capture more of for richer patterns"
}`;
```

### Evidence Display (Expandable)

```html
<div class="pattern-item">
  <div class="pattern-icon">🔄</div>
  <div class="pattern-content">
    <div class="pattern-title">HK trip resurfaces without resolution</div>
    <div class="pattern-description">
      Mentioned 5 times across 3 weeks without deciding. The repeated revisiting 
      suggests higher stakes than you're treating it. Consider: what would make 
      this a clear yes or no?
    </div>
    <div class="pattern-evidence" onclick="toggleEvidence(this)">
      <span class="evidence-toggle">View supporting notes ↓</span>
      <div class="evidence-list" style="display: none;">
        <div class="evidence-note" onclick="openNoteDetail('dt_123')">
          • Fundraising Trip Decision — Jan 9
        </div>
        <div class="evidence-note" onclick="openNoteDetail('dt_124')">
          • HK vs Tokyo — Jan 7
        </div>
        <div class="evidence-note" onclick="openNoteDetail('dt_125')">
          • Investor Strategy — Jan 5
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 2. Insight Quality — Anti-Generic Rules

### Current Problem
Some insights are generic ("worth considering") or restate the input.

### Updated Analysis Prompt (api/analyze.js)

Find the insight section in the system prompt and replace with:

```javascript
// INSIGHT SECTION OF PROMPT:

`INSIGHT — Critical quality rules

Your insight must pass ALL these tests:

TEST 1: SPECIFICITY
❌ "This is worth considering" (generic — applies to anything)
❌ "Interesting thought to explore" (generic)
❌ "Important to think about the implications" (generic)
✅ "You're tracking the deadline but not what you're sending — this creates execution risk when Friday arrives" (specific)

TEST 2: ADDITIVE VALUE  
❌ "You had a meeting about the trust company" (restates input)
❌ "You're deciding between HK and Tokyo" (restates input)
✅ "The ball is in their court until Wednesday — your real constraint is team availability, not their timeline" (adds perspective)

TEST 3: REFRAME OR REVEAL
- REFRAME: "You're treating this as a location decision, but it's actually a relationship prioritization"
- REVEAL: "Your hesitation suggests the crypto opportunity feels like someone else's vision"

BANNED PHRASES — Never use these:
- "worth considering"
- "interesting to note"  
- "important to think about"
- "you might want to consider"
- "it's worth exploring"
- "this could be significant"
- "take some time to reflect"

If you cannot generate a genuinely insightful observation for this specific note, make the insight shorter and put more effort into the QUESTION.`
```

---

## 3. Decision Lens — Better Assumptions

### Current Problem
Hidden assumptions sometimes weak or obvious.

### Updated Decision Detection (api/analyze.js)

Find the decision section and add/replace with:

```javascript
// DECISION LENS SECTION OF PROMPT:

`DECISION LENS — When decision detected:

HIDDEN ASSUMPTION — Must be specific and verifiable:
❌ "You assume this is a good opportunity" (too vague)
❌ "You assume you can do this" (obvious)
✅ "You assume HK investors are actively looking for deals right now" (specific, verifiable)
✅ "You assume one month of polish will meaningfully change user perception" (specific, questionable)

The best hidden assumptions:
- Specific enough to verify or challenge
- Would change the decision if proven false
- Likely TRUE in user's mind but UNEXAMINED

OPTIONS — List actual options being weighed, even implicit:
- "HK trip" → Options: ["Go to HK", "Go to Tokyo", "Do neither", "Do both"]
- "Hire VA" → Options: ["Hire VA", "Keep doing yourself", "Hire employee", "Different outsource"]

REVERSIBILITY — Be precise:
- "Reversible: You can do exploratory calls before committing"
- "Irreversible: Once announced, changing direction signals uncertainty"
- "Time-sensitive: Conference in 3 weeks — logistics require deciding within 5 days"`
```

---

## 4. UI Polish

### 4.1 Notes List — Add Date

**Current:** "19:23"  
**New:** "Jan 11 · 19:23"

```javascript
// In js/ui.js, update note list timestamp rendering:

function formatNoteTimestamp(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  if (isToday) {
    return `Today · ${timeStr}`;
  }
  
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `${dateStr} · ${timeStr}`;
}
```

### 4.2 Clear Data — Type "DELETE" Confirmation

**Current:** One-tap delete  
**New:** Must type "DELETE" to confirm

```javascript
// In js/ui.js or settings handling:

function confirmClearAllData() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-title">Delete All Data</div>
      <div class="modal-message">
        This will permanently delete all your notes, patterns, and settings.
        This action cannot be undone.
      </div>
      <div class="modal-input-label">Type DELETE to confirm:</div>
      <input type="text" id="delete-confirm-input" class="modal-input" placeholder="DELETE" autocomplete="off">
      <div class="modal-buttons">
        <button class="modal-btn cancel" onclick="closeModal()">Cancel</button>
        <button class="modal-btn danger" id="confirm-delete-btn" disabled onclick="executeClearAllData()">
          Delete Everything
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Enable button only when "DELETE" is typed
  const input = document.getElementById('delete-confirm-input');
  const btn = document.getElementById('confirm-delete-btn');
  
  input.addEventListener('input', () => {
    btn.disabled = input.value !== 'DELETE';
  });
}
```

**CSS:**
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-white);
  padding: 2rem;
  max-width: 320px;
  width: 90%;
}

.modal-title {
  font-family: 'Inter', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.modal-message {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--color-gray-600);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.modal-input-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--color-gray-500);
  margin-bottom: 0.5rem;
}

.modal-input {
  width: 100%;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  border: 1px solid var(--color-gray-200);
  margin-bottom: 1.5rem;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: var(--color-black);
}

.modal-buttons {
  display: flex;
  gap: 0.75rem;
}

.modal-btn {
  flex: 1;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
}

.modal-btn.cancel {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.modal-btn.danger {
  background: #dc2626;
  color: white;
}

.modal-btn.danger:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
}
```

### 4.3 Toast Notifications

**For:** Approve/Reject feedback, Copy button

```javascript
// Add toast system to js/ui.js:

function showToast(message, duration = 1500) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// Usage:
// After approve: showToast('✓ Approved');
// After reject: showToast('✗ Rejected');
// After copy: showToast('✓ Copied');
```

**CSS:**
```css
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--color-black);
  color: var(--color-white);
  padding: 0.75rem 1.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 1000;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
```

### 4.4 Loading States — Progressive Feedback

**During analysis:**

```javascript
function showAnalysisProgress(stage) {
  const stages = {
    'recording': 'Recording...',
    'processing': 'Processing audio...',
    'analyzing': 'Analyzing...',
    'complete': 'Done ✓'
  };
  
  const indicator = document.getElementById('progress-indicator');
  indicator.textContent = stages[stage] || stage;
}

// Usage during note creation:
showAnalysisProgress('recording');
// ... after recording stops
showAnalysisProgress('processing');
// ... after transcription
showAnalysisProgress('analyzing');
// ... after analysis complete
showAnalysisProgress('complete');
```

**During pattern detection:**

```javascript
function showPatternProgress(current, total) {
  const indicator = document.getElementById('pattern-progress');
  indicator.innerHTML = `
    <div class="pattern-loading">
      Detecting patterns...
      <div class="pattern-loading-detail">Analyzing ${current} of ${total} notes</div>
    </div>
  `;
}
```

---

## 5. Performance Improvements

### 5.1 Skeleton UI During Analysis

Show placeholder content immediately while waiting for AI:

```javascript
function showNoteSkeleton() {
  return `
    <div class="note-skeleton">
      <div class="skeleton-header">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-line full"></div>
        <div class="skeleton-line full"></div>
        <div class="skeleton-line medium"></div>
      </div>
    </div>
  `;
}
```

**CSS:**
```css
.note-skeleton {
  padding: 1.5rem;
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-50) 50%, var(--color-gray-100) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  margin-bottom: 0.75rem;
  border-radius: 2px;
}

.skeleton-line.short { width: 30%; }
.skeleton-line.medium { width: 60%; }
.skeleton-line.full { width: 100%; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 5.2 Optimistic UI for Feedback

Show feedback state immediately, sync in background:

```javascript
async function handleFeedback(noteId, rating) {
  // Immediately update UI
  updateFeedbackButtons(noteId, rating);
  showToast(rating === 'liked' ? '✓ Approved' : '✗ Rejected');
  
  // Save in background
  try {
    const note = await DB.get('notes', noteId);
    note.feedback = { rating, timestamp: new Date().toISOString() };
    await DB.put('notes', note);
    // Sync if needed
  } catch (error) {
    // Revert UI on error
    updateFeedbackButtons(noteId, null);
    showToast('Failed to save — try again');
  }
}
```

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `api/patterns.js` | Updated prompt for valuable patterns |
| `api/analyze.js` | Anti-generic insight rules, better decision lens |
| `js/ui.js` | Date formatting, toast system, delete confirmation, loading states |
| `js/twin-ui.js` | Pattern evidence display, progress indicator |
| `css/styles.css` | Toast, modal, skeleton, evidence styles |

---

## 7. Implementation Order

### Step 1: Quick UI Wins
1. Notes list date formatting
2. Toast notifications (approve/reject/copy)
3. Delete confirmation modal

### Step 2: Quality Improvements  
4. Update pattern detection prompt
5. Add pattern evidence display
6. Update insight prompt (anti-generic)
7. Update decision lens prompt

### Step 3: Performance Polish
8. Skeleton UI during analysis
9. Optimistic feedback UI
10. Progressive loading states

---

## 8. Version

- Target: v3.8.0
- Cache bust: v=255

---

## 9. Complete Implementation Code

### 9.1 Toast System (js/ui.js)

```javascript
function showToast(message, duration = 1500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

window.showToast = showToast;
```

### 9.2 Delete Confirmation Modal (js/ui.js)

```javascript
function confirmClearAllData() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'delete-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-title">Delete All Data</div>
      <div class="modal-message">
        This will permanently delete all your notes, patterns, and settings.
        This action cannot be undone.
      </div>
      <div class="modal-input-label">Type DELETE to confirm:</div>
      <input type="text" id="delete-confirm-input" class="modal-input" placeholder="DELETE" autocomplete="off" spellcheck="false">
      <div class="modal-buttons">
        <button class="modal-btn cancel" onclick="closeDeleteModal()">Cancel</button>
        <button class="modal-btn danger" id="confirm-delete-btn" disabled onclick="executeClearAllData()">
          Delete Everything
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const input = document.getElementById('delete-confirm-input');
  const btn = document.getElementById('confirm-delete-btn');
  input.addEventListener('input', () => {
    btn.disabled = input.value !== 'DELETE';
  });
  input.focus();
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.remove();
}

function executeClearAllData() {
  closeDeleteModal();
  clearAllData(); // existing function
  showToast('All data deleted');
}
```

### 9.3 Date Formatting (js/ui.js)

```javascript
function formatNoteListTimestamp(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  if (isToday) return `Today · ${timeStr}`;
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${timeStr}`;
  }
  
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `${dateStr} · ${timeStr}`;
}
```

### 9.4 Pattern Evidence Display (js/twin-ui.js)

```javascript
function renderPattern(pattern) {
  const evidenceList = (pattern.evidence || [])
    .map(title => `<div class="evidence-note">${title}</div>`)
    .join('');
  
  return `
    <div class="pattern-item">
      <div class="pattern-icon">${pattern.icon}</div>
      <div class="pattern-content">
        <div class="pattern-title">${pattern.title}</div>
        <div class="pattern-description">${pattern.description}</div>
        <div class="pattern-evidence">
          <div class="evidence-toggle" onclick="toggleEvidence(this)">
            Based on ${pattern.noteCount} notes ↓
          </div>
          <div class="evidence-list" style="display: none;">
            ${evidenceList}
          </div>
        </div>
      </div>
    </div>
  `;
}

function toggleEvidence(element) {
  const list = element.nextElementSibling;
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? 'block' : 'none';
  element.textContent = isHidden 
    ? `Based on ${list.children.length} notes ↑` 
    : `Based on ${list.children.length} notes ↓`;
}

window.toggleEvidence = toggleEvidence;
```

### 9.5 All CSS Additions (css/styles.css)

```css
/* Toast */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--color-black);
  color: var(--color-white);
  padding: 0.75rem 1.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 1000;
  pointer-events: none;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--color-white);
  padding: 2rem;
  max-width: 320px;
  width: 90%;
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-title {
  font-family: 'Inter', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-black);
  margin-bottom: 1rem;
}

.modal-message {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--color-gray-600);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.modal-input-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-gray-500);
  margin-bottom: 0.5rem;
}

.modal-input {
  width: 100%;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  border: 1px solid var(--color-gray-200);
  margin-bottom: 1.5rem;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: var(--color-black);
}

.modal-buttons {
  display: flex;
  gap: 0.75rem;
}

.modal-btn {
  flex: 1;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.modal-btn.cancel {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.modal-btn.danger {
  background: #dc2626;
  color: white;
}

.modal-btn.danger:disabled {
  background: var(--color-gray-300);
  cursor: not-allowed;
}

/* Pattern Evidence */
.pattern-evidence {
  margin-top: 0.75rem;
}

.evidence-toggle {
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--color-gray-400);
  cursor: pointer;
  transition: color 0.2s ease;
}

.evidence-toggle:hover {
  color: var(--color-gray-600);
}

.evidence-list {
  margin-top: 0.5rem;
  padding-left: 0.75rem;
  border-left: 1px solid var(--color-gray-200);
}

.evidence-note {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--color-gray-500);
  padding: 0.25rem 0;
}

/* Skeleton Loading */
.note-skeleton {
  padding: 1.5rem;
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-50) 50%, var(--color-gray-100) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  margin-bottom: 0.75rem;
  border-radius: 2px;
}

.skeleton-line.short { width: 30%; }
.skeleton-line.medium { width: 60%; }
.skeleton-line.full { width: 100%; }
.skeleton-spacer { height: 1rem; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Pattern Loading */
.pattern-loading-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-gray-600);
  margin-bottom: 0.25rem;
}

.pattern-loading-detail {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--color-gray-400);
}
```

---

## 10. Verification Checklist

After deployment, test:

- [ ] Create note → Insight is specific, not generic
- [ ] Create decision note → Hidden assumption is specific and verifiable
- [ ] TWIN tab → Tap Rebuild Profile → Patterns are non-obvious and valuable
- [ ] Pattern icons match content
- [ ] Expand pattern evidence → Shows supporting note titles
- [ ] Notes list shows date ("Jan 11 · 19:23" or "Today · 19:23")
- [ ] Click Approve → Toast shows "✓ Approved"
- [ ] Click Copy → Toast shows "✓ Copied"
- [ ] Settings → Clear Data → Must type "DELETE" to confirm

When complete: `touch .phase3e-complete`
