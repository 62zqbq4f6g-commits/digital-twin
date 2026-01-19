# Digital Twin — Phase 3d Build Specification

**Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Ready for Build  
**Goal:** Make the twin actually learn — detect patterns across notes

---

## Problem

TWIN tab shows "Your Patterns — No patterns detected yet"

But there's no logic to detect patterns. The section is a placeholder. The "twin" doesn't actually learn anything about the user.

---

## Solution

Build pattern detection that:
1. Analyzes all notes together
2. Identifies recurring themes, behaviors, decisions
3. Surfaces insights the user didn't realize
4. Makes the twin feel genuinely intelligent

---

## The "Aha" Moment

User sees in TWIN tab:

> **Your Patterns**
>
> 💰 **Cash flow comes up when evaluating opportunities**
> You've mentioned financial runway in 4 of your last 6 opportunity assessments.
>
> ⏱️ **You delay decisions involving people**
> Team-related decisions sit in "Thinking Through" 3x longer than product decisions.
>
> 🔋 **Higher energy around Velolume than Digital Twin**
> Your notes about Velolume use more action words and fewer hedging phrases.

User thinks: "That's... actually true. I didn't realize that."

---

## Pattern Types

### 1. Recurring Themes
Topics that appear across multiple notes.

```
"Cash flow" mentioned in 6 notes
"Investor readiness" mentioned in 4 notes
"Team capacity" mentioned in 5 notes
```

### 2. Decision Patterns
How the user approaches decisions.

```
"You deliberate longer on irreversible decisions" (good)
"You rush time-sensitive decisions" (neutral)
"People decisions take 3x longer than product decisions" (insight)
```

### 3. Behavioral Patterns
Tendencies in how they think/work.

```
"You capture more notes on Mondays" (timing)
"Your morning notes are more strategic, evening notes more tactical" (energy)
"You often revisit the same concern without resolving it" (loop detection)
```

### 4. Language Patterns
How they express themselves.

```
"You hedge more when discussing X" ("maybe", "might", "could")
"You use definitive language for Y" ("will", "must", "definitely")
"Higher energy words around topic Z"
```

### 5. Relationship Patterns
Who appears in their notes.

```
"Sarah mentioned in 8 notes (operations)"
"Investor conversations cluster around month-end"
```

---

## When to Run Detection

### Trigger 1: Rebuild Profile Button
User taps "Rebuild Profile" → runs full pattern analysis

### Trigger 2: Threshold-Based (Background)
- After every 10 new notes, queue pattern refresh
- After 5 new decisions logged
- Weekly automatic refresh

**For v1:** Just Trigger 1 (Rebuild Profile). Keep it simple.

---

## Detection Algorithm

### Step 1: Gather Notes
```javascript
const notes = await DB.getAll('notes');
const recentNotes = notes.filter(n => {
  const age = Date.now() - new Date(n.createdAt);
  const days = age / (1000 * 60 * 60 * 24);
  return days <= 90; // Last 90 days
});
```

### Step 2: Build Context
```javascript
const noteSummaries = recentNotes.map(n => ({
  date: n.createdAt,
  category: n.category,
  title: n.analysis?.title,
  summary: n.analysis?.summary,
  insight: n.analysis?.insight,
  isDecision: n.analysis?.decision?.isDecision,
  decisionType: n.analysis?.decision?.type,
  resolved: n.analysis?.decision?.resolved,
  actions: n.analysis?.actions
}));
```

### Step 3: Send to Claude
```javascript
const response = await fetch('/api/patterns', {
  method: 'POST',
  body: JSON.stringify({ notes: noteSummaries })
});
```

### Step 4: Store Patterns
```javascript
const patterns = await response.json();
await DB.put('profile', { 
  ...profile, 
  patterns: patterns,
  patternsDetectedAt: new Date().toISOString()
});
```

---

## API Endpoint: `/api/patterns.js`

```javascript
const systemPrompt = `You are analyzing a collection of notes from a busy founder/professional to detect patterns in their thinking, behavior, and decision-making.

You will receive summaries of their recent notes. Your job is to identify patterns they may not have noticed themselves.

PATTERN TYPES TO DETECT:

1. RECURRING THEMES
   - Topics that appear across multiple notes
   - Concerns that keep coming back
   - Ideas they circle around

2. DECISION PATTERNS  
   - How they approach different types of decisions
   - What they delay vs. decide quickly
   - Hidden criteria they use

3. BEHAVIORAL PATTERNS
   - When they capture notes (timing patterns)
   - Energy levels across topics
   - Hedging vs. confident language

4. BLIND SPOTS
   - Things they mention but never resolve
   - Assumptions they repeat without questioning
   - Topics they avoid

RULES:
- Only report patterns with 3+ data points
- Be specific, not generic
- Each pattern should be genuinely insightful
- Include the evidence (which notes support this)
- Maximum 5 patterns (quality over quantity)
- If insufficient data, return fewer patterns

Return JSON:
{
  "patterns": [
    {
      "type": "theme" | "decision" | "behavior" | "blindspot",
      "title": "Short title (5-8 words)",
      "description": "One sentence explanation",
      "evidence": "X notes mention this, examples: ...",
      "noteCount": 4,
      "icon": "💰" | "⏱️" | "🔋" | "🔄" | "👥" | "💡" | "⚠️"
    }
  ],
  "confidence": "low" | "medium" | "high",
  "noteCount": 23,
  "suggestion": "Optional suggestion for what to capture more of"
}`;
```

---

## Data Model

### Profile Update
```javascript
profile: {
  // ... existing fields
  patterns: [
    {
      id: "pattern_1",
      type: "theme",
      title: "Cash flow comes up when evaluating opportunities",
      description: "You've mentioned financial runway in 4 of your last 6 opportunity assessments.",
      evidence: "Notes: 'Investor Call', 'HK Opportunity', 'Game Strategy'...",
      noteCount: 4,
      icon: "💰",
      detectedAt: "2026-01-11T20:00:00Z"
    },
    // ... more patterns
  ],
  patternsConfidence: "medium",
  patternsDetectedAt: "2026-01-11T20:00:00Z",
  patternsSuggestion: "Capture more notes about team interactions to detect collaboration patterns"
}
```

---

## UI: TWIN Tab — Your Patterns Section

### Empty State (< 10 notes)
```
YOUR PATTERNS
─────────────

Not enough data yet

Capture 10+ notes for pattern detection.
You have 7 notes.

   ████████░░░░░░░░  7/10
```

### Loading State
```
YOUR PATTERNS
─────────────

Analyzing your notes...

Looking for themes, decisions, and behaviors
across 23 notes.
```

### Patterns Detected
```
YOUR PATTERNS                                    3 detected
─────────────

💰  Cash flow comes up when evaluating opportunities
    Mentioned in 4 of your last 6 opportunity assessments
    
⏱️  You delay decisions involving people
    Team decisions sit 3x longer than product decisions
    
🔄  HK trip keeps resurfacing
    Mentioned 5 times without resolution — consider deciding

─────────────────────────────────────────────────────────────
Confidence: Medium · Based on 23 notes · Updated just now
```

### Low Confidence State
```
YOUR PATTERNS                                    1 detected
─────────────

💡  Early pattern: You capture more work than personal
    13 work notes vs 7 personal — is this intentional?

─────────────────────────────────────────────────────────────
Confidence: Low · More notes will improve detection
```

---

## UI Implementation

### In js/twin-ui.js

```javascript
async function updatePatternsSection() {
  const container = document.getElementById('patterns-section');
  const notes = await DB.getAll('notes');
  const profile = await DB.get('profile', 'main');
  
  // Check minimum notes threshold
  if (notes.length < 10) {
    container.innerHTML = renderPatternsEmptyState(notes.length);
    return;
  }
  
  // Check if patterns exist
  if (!profile?.patterns || profile.patterns.length === 0) {
    container.innerHTML = renderPatternsNeedAnalysis();
    return;
  }
  
  // Render patterns
  container.innerHTML = renderPatterns(profile.patterns, profile.patternsConfidence);
}

function renderPatternsEmptyState(noteCount) {
  const progress = Math.min((noteCount / 10) * 100, 100);
  return `
    <div class="patterns-empty">
      <div class="patterns-empty-title">Not enough data yet</div>
      <div class="patterns-empty-subtitle">
        Capture 10+ notes for pattern detection.
        You have ${noteCount} notes.
      </div>
      <div class="patterns-progress">
        <div class="patterns-progress-bar" style="width: ${progress}%"></div>
      </div>
      <div class="patterns-progress-label">${noteCount}/10</div>
    </div>
  `;
}

function renderPatterns(patterns, confidence) {
  let html = `
    <div class="patterns-header">
      <span class="patterns-count">${patterns.length} detected</span>
    </div>
    <div class="patterns-list">
  `;
  
  patterns.forEach(pattern => {
    html += `
      <div class="pattern-item">
        <div class="pattern-icon">${pattern.icon}</div>
        <div class="pattern-content">
          <div class="pattern-title">${pattern.title}</div>
          <div class="pattern-description">${pattern.description}</div>
        </div>
      </div>
    `;
  });
  
  html += `
    </div>
    <div class="patterns-footer">
      Confidence: ${confidence} · Based on ${noteCount} notes
    </div>
  `;
  
  return html;
}
```

---

## Rebuild Profile Flow

### Current Flow
```
Tap "Rebuild Profile" → Re-analyze all notes → Update profile
```

### New Flow
```
Tap "Rebuild Profile" 
  → Show loading state
  → Re-analyze all notes (existing)
  → Run pattern detection (NEW)
  → Update profile with patterns
  → Refresh TWIN tab
```

### In js/twin-ui.js — rebuildProfile()

```javascript
async function rebuildProfile() {
  showLoadingState('Rebuilding profile...');
  
  const notes = await DB.getAll('notes');
  
  // Step 1: Re-analyze notes (existing logic)
  // ...
  
  // Step 2: Detect patterns (NEW)
  if (notes.length >= 10) {
    showLoadingState('Detecting patterns...');
    
    const noteSummaries = notes.map(n => ({
      date: n.createdAt,
      category: n.category,
      title: n.analysis?.title,
      summary: n.analysis?.summary,
      isDecision: n.analysis?.decision?.isDecision,
      decisionType: n.analysis?.decision?.type,
      resolved: n.analysis?.decision?.resolved
    }));
    
    try {
      const response = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteSummaries })
      });
      
      const patternData = await response.json();
      
      // Save patterns to profile
      const profile = await DB.get('profile', 'main') || {};
      profile.patterns = patternData.patterns;
      profile.patternsConfidence = patternData.confidence;
      profile.patternsDetectedAt = new Date().toISOString();
      profile.patternsSuggestion = patternData.suggestion;
      await DB.put('profile', profile);
      
    } catch (error) {
      console.error('Pattern detection failed:', error);
    }
  }
  
  // Step 3: Refresh UI
  hideLoadingState();
  updateTwinTab();
}
```

---

## CSS Styles

```css
/* Patterns Section */
.patterns-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.patterns-count {
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-gray-400);
}

.patterns-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pattern-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.pattern-icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.pattern-content {
  flex: 1;
}

.pattern-title {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-black);
  line-height: 1.4;
  margin-bottom: 0.25rem;
}

.pattern-description {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: var(--color-gray-500);
  line-height: 1.5;
}

.patterns-footer {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-gray-100);
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  color: var(--color-gray-400);
  letter-spacing: 0.02em;
}

/* Empty State */
.patterns-empty {
  text-align: center;
  padding: 1.5rem 0;
}

.patterns-empty-title {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-gray-600);
  margin-bottom: 0.5rem;
}

.patterns-empty-subtitle {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: var(--color-gray-400);
  margin-bottom: 1rem;
}

.patterns-progress {
  width: 100%;
  height: 4px;
  background: var(--color-gray-100);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.patterns-progress-bar {
  height: 100%;
  background: var(--color-black);
  transition: width 0.3s ease;
}

.patterns-progress-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  color: var(--color-gray-400);
}
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `api/patterns.js` | NEW — Pattern detection endpoint |
| `js/twin-ui.js` | Update patterns section, modify rebuildProfile() |
| `css/styles.css` | Pattern section styles |
| `js/db.js` | Ensure profile can store patterns array |

---

## Edge Cases

| Case | Handling |
|------|----------|
| < 10 notes | Show progress bar, don't run detection |
| API fails | Keep existing patterns, show error toast |
| No patterns found | "No clear patterns yet — keep capturing" |
| All notes same category | Note this as a pattern itself |
| Very old notes | Weight recent notes higher (last 90 days) |

---

## Success Criteria

1. User with 20+ notes taps "Rebuild Profile"
2. Loading state shows "Detecting patterns..."
3. 2-5 patterns appear in "Your Patterns" section
4. Patterns are specific and insightful (not generic)
5. User thinks "I didn't realize that about myself"

---

## Version

- Target: v3.7.0
- Cache bust: v=254
