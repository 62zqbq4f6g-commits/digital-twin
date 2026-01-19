# Digital Twin — Phase 3c Build Specification

**Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Ready for Build  
**Goal:** Close the feedback loop — user answers AI question, note improves

---

## Problem

AI asks: *"What specifically are you sending back, and to whom?"*

User thinks: "Good question. Let me answer."

App: *No way to respond.*

**Result:** Valuable prompt goes unanswered. Note stays vague.

---

## Solution

Repurpose COMMENT button as "Answer" mechanism. User's answer triggers re-analysis, refining the note with specific details.

---

## User Flow

```
1. User creates note
2. AI generates: Summary, Insight, Question, Actions
3. User sees question: "What specifically are you sending back?"
4. User taps COMMENT
5. Input field appears
6. User types: "Q4 projections deck to Sarah"
7. User submits
8. App re-analyzes with new context
9. Note updates:
   - Actions become specific
   - Summary includes new detail
   - Answer displayed below question
```

---

## Before & After

### Before Answer

```
SUMMARY
Had a call today with two follow-up requirements: send 
something back by Friday and schedule a meeting.

What specifically are you sending back, and to whom?

ACTIONS
□ Send back response (by Friday)
□ Book a meeting
```

### After Answer

```
SUMMARY
Had a call today with two follow-up requirements: send 
Q4 projections deck to Sarah by Friday and schedule a meeting.

What specifically are you sending back, and to whom?

YOUR ANSWER
"Q4 projections deck to Sarah"

ACTIONS
□ Send Q4 projections deck to Sarah (by Friday)
□ Book a meeting
```

---

## UI Changes

### 1. COMMENT Button Behavior

**Current:** Unknown/unused behavior

**New:** Opens inline text input below the question

```
What specifically are you sending back, and to whom?

┌─────────────────────────────────────────────────────────────┐
│  Answer this question...                                    │
│                                                             │
│                                              [ SUBMIT ]     │
└─────────────────────────────────────────────────────────────┘

ACTIONS
□ Send back response (by Friday)
```

### 2. After Submission

Show the answer, hide input:

```
What specifically are you sending back, and to whom?

YOUR ANSWER
"Q4 projections deck to Sarah"

ACTIONS
□ Send Q4 projections deck to Sarah (by Friday)
```

### 3. Allow Re-answering

Small "Edit" link below answer:

```
YOUR ANSWER
"Q4 projections deck to Sarah"    [Edit]
```

---

## Data Model

Update note structure:

```javascript
note: {
  id: "dt_...",
  rawInput: "...",
  analysis: {
    cleanedInput: "...",
    title: "...",
    summary: "...",
    insight: "...",
    question: "...",
    actions: [...],
    decision: {...}
  },
  // NEW
  questionAnswer: {
    answer: "Q4 projections deck to Sarah",
    answeredAt: "2026-01-11T19:45:00Z"
  },
  // After re-analysis
  refinedAnalysis: {
    summary: "...",  // Updated with answer context
    actions: [...]   // More specific
  }
}
```

---

## API: Re-analysis Endpoint

### Option A: Use Existing `/api/analyze.js`

Send a modified payload:

```javascript
{
  input: originalInput,
  context: {
    question: "What specifically are you sending back, and to whom?",
    answer: "Q4 projections deck to Sarah"
  },
  mode: "refine"
}
```

### Option B: New `/api/refine.js`

Dedicated endpoint for refinement.

**Recommendation:** Option A (simpler, one endpoint)

---

## API Prompt (Refine Mode)

```javascript
const refinePrompt = `You previously analyzed a note and asked a clarifying question.

ORIGINAL NOTE:
${originalInput}

YOUR QUESTION:
${question}

USER'S ANSWER:
${answer}

Now refine the analysis with this new information:

1. UPDATE SUMMARY: Incorporate the specific details from their answer.

2. UPDATE ACTIONS: Make actions specific using the new information.
   - Before: "Send back response (by Friday)"
   - After: "Send Q4 projections deck to Sarah (by Friday)"

3. Keep insight and question unchanged.

Return JSON:
{
  "summary": "...",
  "actions": ["...", "..."]
}`;
```

---

## Implementation Steps

### Step 1: Update COMMENT Button

In `js/ui.js`, make COMMENT button toggle an input field:

```javascript
function handleCommentClick(noteId) {
  const note = await DB.get('notes', noteId);
  
  // Show input field below question
  showAnswerInput(noteId, note.analysis.question);
}

function showAnswerInput(noteId, question) {
  const container = document.querySelector('.question-answer-container');
  container.innerHTML = `
    <div class="answer-input-wrapper">
      <textarea 
        id="answer-input" 
        placeholder="Answer this question..."
        rows="2"
      ></textarea>
      <button onclick="submitAnswer('${noteId}')">SUBMIT</button>
    </div>
  `;
}
```

### Step 2: Submit Answer

```javascript
async function submitAnswer(noteId) {
  const answer = document.getElementById('answer-input').value;
  if (!answer.trim()) return;
  
  const note = await DB.get('notes', noteId);
  
  // Store answer
  note.questionAnswer = {
    answer: answer,
    answeredAt: new Date().toISOString()
  };
  
  // Show loading state
  showRefiningState();
  
  // Call API for re-analysis
  const refined = await refineAnalysis(note, answer);
  
  // Update note with refined analysis
  note.refinedAnalysis = refined;
  note.analysis.summary = refined.summary;
  note.analysis.actions = refined.actions;
  
  await DB.put('notes', note);
  
  // Re-render note detail
  renderNoteDetail(noteId);
}
```

### Step 3: API Refine Logic

In `api/analyze.js`, detect refine mode:

```javascript
export default async function handler(req, res) {
  const { input, context, mode } = req.body;
  
  if (mode === 'refine') {
    return handleRefine(input, context, res);
  }
  
  // ... existing analyze logic
}

async function handleRefine(input, context, res) {
  const prompt = buildRefinePrompt(input, context.question, context.answer);
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });
  
  const refined = JSON.parse(response.content[0].text);
  res.json(refined);
}
```

### Step 4: Display Answer

In `js/ui.js`, render answer below question:

```javascript
function renderQuestionSection(analysis, questionAnswer) {
  let html = `
    <div class="note-question">
      <strong>${analysis.question}</strong>
    </div>
  `;
  
  if (questionAnswer?.answer) {
    html += `
      <div class="note-answer">
        <div class="note-section-header">YOUR ANSWER</div>
        <div class="answer-text">"${questionAnswer.answer}"</div>
        <span class="edit-answer-link" onclick="editAnswer()">Edit</span>
      </div>
    `;
  }
  
  return html;
}
```

---

## CSS

```css
.answer-input-wrapper {
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.answer-input-wrapper textarea {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  padding: 0.75rem;
  border: 1px solid var(--color-gray-200);
  border-radius: 4px;
  resize: none;
}

.answer-input-wrapper button {
  align-self: flex-end;
  padding: 0.5rem 1rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--color-black);
  color: var(--color-white);
  border: none;
  cursor: pointer;
}

.note-answer {
  margin: 1rem 0;
  padding: 0.75rem;
  background: var(--color-gray-50);
  border-left: 2px solid var(--color-black);
}

.answer-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-style: italic;
  color: var(--color-gray-700);
}

.edit-answer-link {
  font-size: 0.75rem;
  color: var(--color-gray-400);
  cursor: pointer;
  text-decoration: underline;
}
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| User submits empty answer | Ignore, don't call API |
| API fails during refine | Keep original analysis, show error toast |
| User edits answer | Re-run refine with new answer |
| Note has no question | COMMENT button hidden or disabled |
| Very long answer | Truncate display, store full text |

---

## Success Criteria

1. User can tap COMMENT and type answer
2. Note re-analyzes with new context
3. Actions become specific
4. Answer is displayed and editable
5. Original analysis preserved if refinement fails

---

## Files to Modify

| File | Changes |
|------|---------|
| `api/analyze.js` | Add refine mode handling |
| `js/ui.js` | COMMENT button behavior, answer input, display |
| `js/app.js` | submitAnswer function |
| `js/db.js` | questionAnswer field in schema |
| `css/styles.css` | Answer input and display styles |

---

## Version

- Target: v3.6.0
- Cache bust: v=253
