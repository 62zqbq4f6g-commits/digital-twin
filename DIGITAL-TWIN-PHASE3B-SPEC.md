# Digital Twin — Phase 3b Build Specification

**Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Ready for Build  
**Goal:** PMF-focused release with decision support and improved output

---

## Executive Summary

Phase 3b adds three key capabilities:
1. **Original input display** with cleaned punctuation/grammar
2. **Decision detection** with smart insights (not tracking as a system)
3. **Open Loops** in TWIN tab (gentle, not judgmental)
4. **Actions extraction** from notes
5. **Shareability judgment**

Plus fixes for current issues.

---

## 1. Output Structure (Updated)

### Current Output (Problem)
```
┌─────────────────────────────────────────────────────────────┐
│  Summary                                                    │
│  Insight                                                    │
│  Question                                                   │
│  Feedback buttons                                           │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- Original input not shown
- No actions extracted
- No shareability judgment
- No decision-specific insight

### New Output Structure

```
┌─────────────────────────────────────────────────────────────┐
│  🏢 WORK                                                    │
│                                                             │
│  HK Trust Company Meeting                                   │
│  Sunday • January 11, 2026 • 17:23 Singapore               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ORIGINAL                                                   │
│  ──────────                                                 │
│  Meeting with HK trust company went well. They'll send     │
│  the proposal by Wednesday. Need to schedule a team         │
│  workshop to review the structure options before Chinese    │
│  New Year. Also need to confirm everyone's availability.    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SUMMARY                                                    │
│  ──────────                                                 │
│  Productive meeting with HK trust company. Proposal         │
│  expected Wednesday. Team workshop needed before CNY        │
│  to review structure options.                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  The ball is in their court until Wednesday. Your real     │
│  constraint is team availability before CNY, not the        │
│  trust company's timeline.                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Have you confirmed your team can meet before CNY,          │
│  or are you assuming availability?                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTIONS                                                    │
│  ──────────                                                 │
│  □ Wait for proposal (by Wednesday)                         │
│  □ Schedule team workshop (before CNY)                      │
│  □ Confirm team availability                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ READY TO SHARE                                          │
│  Clear, structured, appropriate for team distribution.      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│      APPROVE          REJECT          COMMENT               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

        [ COPY FOR TEAM ]        [ EXPORT JSON ]
```

### When Decision Detected

Add a "DECISION LENS" section:

```
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DECISION LENS                                              │
│  ──────────                                                 │
│  Type: Reversible — you can test with calls before flying   │
│                                                             │
│  Hidden assumption: HK leads are actually warm.             │
│  Have you confirmed interest since initial contact?         │
│                                                             │
│  Consider: Can you validate both options before committing? │
│                                                             │
├─────────────────────────────────────────────────────────────┤
```

---

## 2. Original Input — Punctuation & Grammar

### The Problem

User speaks:
> "meeting with hk trust company went well theyll send proposal by wednesday need to schedule team workshop to review structure options before chinese new year"

Current behavior: This raw text goes straight to the AI, and only the refined output is shown.

**Issues:**
1. User can't see what they originally said
2. Raw transcript has no punctuation
3. Grammar errors from speech-to-text
4. Filler words ("um", "uh", "like")

### The Solution

**Two-step processing:**

```
Raw Input → Clean Input → AI Analysis → Structured Output
              ↓
        (shown to user as "ORIGINAL")
```

### Cleaning Rules

| Issue | Example | Fix |
|-------|---------|-----|
| No punctuation | "went well theyll send" | "went well. They'll send" |
| No capitalization | "hk trust company" | "HK Trust Company" |
| Filler words | "um so like the meeting" | "The meeting" |
| Run-on sentences | Long stream of consciousness | Break into sentences |
| Contractions | "theyll" | "they'll" |
| Common speech errors | "gonna", "wanna" | "going to", "want to" |

### Implementation

Add a `cleanTranscript()` function that:
1. Sends raw input to Claude with cleaning prompt
2. Returns cleaned version with punctuation and grammar
3. Stores both `rawInput` and `cleanedInput` in the note

**Prompt for cleaning:**
```
Clean this voice transcript for display. Fix:
- Add punctuation and capitalization
- Remove filler words (um, uh, like, you know)
- Fix obvious speech-to-text errors
- Break run-on sentences
- Keep the speaker's voice and meaning intact

Do NOT summarize or remove content. Just clean for readability.

Transcript: {rawInput}
```

---

## 3. Decision Detection

### How It Works

The AI analyzes each note and determines:
1. Is this a decision in progress?
2. If yes, what type of decision?
3. What insights apply?

### Detection Signals

| Signal | Example |
|--------|---------|
| Explicit deliberation | "torn between", "should I", "deciding whether" |
| Options mentioned | "option A vs option B", "either X or Y" |
| Uncertainty language | "not sure if", "weighing", "considering" |
| Tradeoff language | "on one hand... on the other" |
| Timeline pressure | "need to decide by", "deadline is" |

### Decision Types

| Type | Description | Insight Angle |
|------|-------------|---------------|
| **Reversible** | Can be undone or tested | "You can experiment before committing" |
| **Irreversible** | Hard to undo once made | "This warrants more deliberation" |
| **Time-sensitive** | Has a deadline | "What's the cost of waiting vs deciding now?" |
| **Resource allocation** | Money, time, people | "What's the opportunity cost?" |
| **Relationship** | People, partnerships | "What does this signal to the other party?" |

### Decision-Specific Insights

| Insight Type | Example Output |
|--------------|----------------|
| **Hidden assumption exposure** | "Your upside case relies on HK leads being warm. Have you confirmed?" |
| **Reversibility framing** | "This is reversible—you can test with calls before flying." |
| **Portfolio thinking** | "This is a bet, not a conviction. Size it accordingly." |
| **Pre-decision interruption** | "You're rushing. Your pattern: quick decisions on X often need revisiting." |
| **Optionality prompt** | "Can you preserve optionality by doing a smaller test first?" |

### Data Model Update

```javascript
note: {
  id: "dt_...",
  rawInput: "original voice transcript",
  cleanedInput: "cleaned with punctuation",
  analysis: {
    title: "...",
    summary: "...",
    insight: "...",
    question: "...",
    actions: ["...", "...", "..."],
    shareability: {
      ready: true,
      reason: "Clear, structured, appropriate for team"
    },
    decision: {
      isDecision: true,
      type: "reversible",
      options: ["HK", "Tokyo"],
      hiddenAssumption: "HK leads are warm",
      insight: "You can test with calls before committing to travel",
      detectedAt: "2026-01-11T17:23:00Z"
    }
  },
  category: "work",
  createdAt: "...",
  ...
}
```

---

## 4. Open Loops (TWIN Tab)

### Design Philosophy

**Gentle, not judgmental.**

Instead of:
> ⚠️ Fundraising Trip — 12 days deliberating

Show:
> Fundraising Trip  
> First mentioned 2 days ago

### Display

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  THINKING THROUGH                                           │
│  ──────────────────                                         │
│                                                             │
│  Fundraising Trip Location                                  │
│  First mentioned 2 days ago                     [ VIEW ]    │
│                                                             │
│  Game Strategy Direction                                    │
│  First mentioned 5 days ago                     [ VIEW ]    │
│                                                             │
│  Hire VA Decision                                           │
│  First mentioned 12 days ago                    [ VIEW ]    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  3 open · Tap any to revisit                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Rules

1. **Appears when:** Note has `decision.isDecision = true` AND no `decision.resolved`
2. **Disappears when:** User marks as resolved OR mentions "decided" in a new note
3. **No guilt language:** No "overdue", no "⚠️", no "you should"
4. **Tapping "VIEW":** Opens the original note

### Resolving a Decision

Two ways to resolve:

**1. Explicit button on note:**
When viewing a decision note, show:
```
[ STILL THINKING ]    [ DECIDED ]
```

**2. Auto-detection:**
If user creates a new note mentioning "decided to go with Tokyo" or "chose HK", AI links it to the open decision and marks resolved.

### Data Model

```javascript
decision: {
  isDecision: true,
  type: "reversible",
  resolved: false,
  resolvedAt: null,
  resolvedNote: null,  // ID of note where decision was made
  outcome: null        // Optional: what they decided
}
```

---

## 5. Actions Extraction

### What Gets Extracted

| Input | Extracted Actions |
|-------|-------------------|
| "need to call John" | □ Call John |
| "should schedule a meeting" | □ Schedule meeting |
| "remember to review the deck" | □ Review deck |
| "they'll send proposal by Wednesday" | □ Wait for proposal (by Wednesday) |
| "follow up next week" | □ Follow up next week |

### Detection Signals

- "need to", "should", "have to", "must"
- "remember to", "don't forget"
- "will", "going to" (commitments)
- "by [date]", "before [event]" (deadlines)
- Imperative verbs: "call", "email", "schedule", "review", "send"

### Display

```
ACTIONS
──────────
□ Wait for proposal (by Wednesday)
□ Schedule team workshop (before CNY)
□ Confirm team availability
```

### Interaction

- Tapping checkbox marks as done (stored locally)
- Actions are part of the note, not a separate task system
- No separate "tasks" view — keeps it simple

---

## 6. Shareability Judgment

### What It Assesses

| Factor | What It Checks |
|--------|----------------|
| **Clarity** | Is the summary clear to someone without context? |
| **Completeness** | Are key details included? |
| **Tone** | Is it professional/appropriate for sharing? |
| **Sensitivity** | Does it contain private information? |
| **Structure** | Is it formatted for easy reading? |

### Output

**Ready to share:**
```
✓ READY TO SHARE
Clear, structured, appropriate for team distribution.
```

**Needs work:**
```
○ NEEDS REFINEMENT
Contains personal context that may not translate.
Consider: Add background on the trust company relationship.
```

**Private:**
```
✗ KEEP PRIVATE
Contains sensitive financial details.
```

### "Copy for Team" Button

Only appears when `shareability.ready = true`.

When tapped, copies a clean version:
```
HK Trust Company Meeting — Jan 11, 2026

Meeting with HK trust company went well. Proposal expected Wednesday. 
Team workshop needed before CNY to review structure options.

Actions:
- Wait for proposal (by Wednesday)
- Schedule team workshop (before CNY)
- Confirm team availability
```

---

## 7. Categories (Final)

### Remove
- Health (separate app territory)

### Keep
```
Work     — Professional, business, career
Personal — Life, relationships, self
Ideas    — Thoughts, explorations, creative
```

### Decision Detection
Happens across ALL categories. Not a separate category.

---

## 8. TWIN Tab (Updated)

### Remove (Broken/Low Value)
- Your People
- Your Expertise
- Your Values

### Keep
- Twin Confidence
- Output Quality
- Stats row

### Add
- **Thinking Through** (Open Loops)
- **This Week** (Activity summary)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      Digital Twin                           │
│                                                             │
│                       Your Twin                             │
│            Learning who you are from your notes             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  THINKING THROUGH                                           │
│  ──────────────────                                         │
│                                                             │
│  Fundraising Trip Location                                  │
│  First mentioned 2 days ago                     [ VIEW ]    │
│                                                             │
│  Game Strategy Direction                                    │
│  First mentioned 5 days ago                     [ VIEW ]    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  THIS WEEK                                                  │
│  ──────────────────                                         │
│                                                             │
│  12 notes · 3 decisions · 5 approved                        │
│                                                             │
│  VOICE ████████░░  8                                        │
│  TEXT  ██░░░░░░░░  2                                        │
│  IMAGE ██░░░░░░░░  2                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OUTPUT QUALITY                              ↑ Improving    │
│  ──────────────────                                         │
│                                                             │
│  ━━━━━━━━━━━━━━━━░░░░  78%                                 │
│                                                             │
│  12 approved · 3 rejected                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TWIN CONFIDENCE                                    54%     │
│  ──────────────────                                         │
│                                                             │
│  ━━━━━━━━━━━━━━░░░░░░░░                                    │
│                                                             │
│  Your twin is learning                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │
│  │   20   │ │    3   │ │    0   │ │  78%   │              │
│  │ NOTES  │ │DECISIONS│ │PATTERNS│ │APPROVED│              │
│  └────────┘ └────────┘ └────────┘ └────────┘              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │                  Rebuild Profile                     │   │
│  │               Re-analyze all notes                   │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. API Changes

### `/api/analyze.js` — Updated Prompt

```javascript
const systemPrompt = `You are a thinking partner for busy founders and professionals.

Analyze this note and provide:

1. CLEANED INPUT
   - Fix punctuation, capitalization, grammar
   - Remove filler words (um, uh, like)
   - Keep the speaker's voice and meaning
   - Do NOT summarize

2. TITLE
   - 2-6 words, captures the essence

3. SUMMARY
   - 1-3 sentences
   - What happened or what they're thinking about
   - Clean, structured, shareable

4. INSIGHT
   - What's the deeper meaning or reframe?
   - Don't be generic ("worth considering")
   - Be specific to THIS note

5. QUESTION
   - One question that surfaces what they haven't considered
   - Should make them think

6. ACTIONS
   - Extract any tasks, commitments, follow-ups
   - Format as actionable items
   - Include deadlines if mentioned

7. SHAREABILITY
   - Is this ready to share with a team?
   - ready: true/false
   - reason: why or why not

8. DECISION DETECTION
   - Is this a decision in progress?
   - If yes:
     - type: reversible / irreversible / time-sensitive
     - options: what are they choosing between
     - hiddenAssumption: what are they assuming that might not be true
     - insight: decision-specific guidance

9. CATEGORY
   - work / personal / ideas
   - Based on content, not user selection

Return as JSON:
{
  "cleanedInput": "...",
  "title": "...",
  "summary": "...",
  "insight": "...",
  "question": "...",
  "actions": ["...", "..."],
  "shareability": {
    "ready": true/false,
    "reason": "..."
  },
  "decision": {
    "isDecision": true/false,
    "type": "reversible/irreversible/time-sensitive",
    "options": ["...", "..."],
    "hiddenAssumption": "...",
    "insight": "..."
  },
  "category": "work/personal/ideas"
}`;
```

---

## 10. Current Issues to Fix

### P0 — Must Fix First

| Issue | Fix |
|-------|-----|
| Feedback button overflow | Widen buttons or reduce font |
| "undefined liked/disliked" in Output Quality | Handle missing data |
| Remove broken sections | Hide Your People / Expertise / Values |
| Category dropdown | Remove "Health" option |

### P1 — This Build

| Feature | Description |
|---------|-------------|
| Show original input | Add "ORIGINAL" section to note display |
| Clean transcript | Add cleaning step before analysis |
| Actions extraction | Add "ACTIONS" section to note display |
| Shareability judgment | Add shareability section + "Copy for Team" |
| Decision detection | Add "DECISION LENS" when applicable |
| Open Loops | Add "Thinking Through" to TWIN tab |
| This Week | Add activity summary to TWIN tab |

---

## 11. Implementation Order

### Step 1: Fix Current Issues
```
1. Fix feedback button CSS (overflow)
2. Fix "undefined" in Output Quality
3. Remove Your People / Expertise / Values from TWIN tab
4. Remove "Health" from category options
5. Bump versions, deploy
```

### Step 2: Update Note Output
```
1. Update API prompt to include all new fields
2. Update note data model
3. Update UI to show:
   - Original (cleaned) input
   - Summary
   - Insight
   - Question
   - Actions
   - Shareability
   - Decision Lens (when applicable)
4. Add "Copy for Team" button
5. Deploy, test
```

### Step 3: Update TWIN Tab
```
1. Add "Thinking Through" (Open Loops) section
2. Add "This Week" activity summary
3. Connect Open Loops to decision data
4. Add "DECIDED" button to decision notes
5. Deploy, test
```

### Step 4: Validate
```
1. Use daily for 1 week
2. Check: Does original input display help?
3. Check: Are decisions being detected correctly?
4. Check: Is Open Loops useful or guilt-inducing?
5. Adjust based on real usage
```

---

## 12. Success Criteria

### PMF Signals

| Signal | How to Measure |
|--------|----------------|
| User sends output to someone | "Copy for Team" usage |
| User returns same day | DAU / sessions per day |
| User would be annoyed if gone | Ask yourself: would you pay? |
| User checks before meetings | Pre-meeting app opens |

### Quality Metrics

| Metric | Target |
|--------|--------|
| Approve rate | >70% |
| Actions extracted per note | 1-3 average |
| Decision detection accuracy | >80% |
| Cleaned input readability | No complaints |

---

## 13. Files to Modify

| File | Changes |
|------|---------|
| `api/analyze.js` | New prompt, new response structure |
| `js/ui.js` | New note output layout |
| `js/twin-ui.js` | Add Thinking Through, This Week, remove broken sections |
| `js/db.js` | Update note schema |
| `css/styles.css` | Fix button overflow, new section styles |
| `index.html` | Remove Health category, bump versions |
| `sw.js` | Bump version |

---

## 14. Claude Code Prompt

```
PHASE 3B: Enhanced Output + Decision Support

## PRIORITY 1: Fix Current Issues

1. In css/styles.css, fix .feedback-btn:
   - Reduce padding to 0.5rem 0.75rem
   - Reduce font-size to 0.5rem
   - Add min-width: 70px
   - Add white-space: nowrap

2. In js/twin-ui.js, fix Output Quality section:
   - Handle undefined values for likedCount/dislikedCount
   - Show "0" instead of "undefined"

3. In js/twin-ui.js, REMOVE these sections:
   - Your People
   - Your Expertise
   - Your Values

4. In index.html and js/ui.js, remove "Health" category option

## PRIORITY 2: Update Note Output

1. Update api/analyze.js with new prompt (see spec section 9)

2. Update note data model in js/db.js to include:
   - rawInput (original)
   - cleanedInput (with punctuation)
   - analysis.actions[]
   - analysis.shareability { ready, reason }
   - analysis.decision { isDecision, type, options, hiddenAssumption, insight }

3. Update js/ui.js renderNoteDetail() to show:
   - ORIGINAL section (cleanedInput)
   - SUMMARY section
   - Insight (italic)
   - Question (bold)
   - ACTIONS section with checkboxes
   - Shareability indicator
   - DECISION LENS section (when decision detected)
   - "Copy for Team" button (when shareable)

4. Style new sections in css/styles.css:
   - .note-section-header (small caps, letter-spacing)
   - .note-actions (checkbox list)
   - .note-shareability (status indicator)
   - .note-decision-lens (bordered box)
   - .copy-for-team-btn (secondary button style)

## PRIORITY 3: Update TWIN Tab

1. Add "Thinking Through" section to js/twin-ui.js:
   - Query notes where decision.isDecision && !decision.resolved
   - Display: title, "First mentioned X days ago", VIEW button
   - Clicking VIEW opens the note

2. Add "This Week" section:
   - Count notes from last 7 days
   - Count decisions (where isDecision = true)
   - Count approved (from feedback)
   - Show input type breakdown (voice/text/image)

3. Add decision resolution:
   - When viewing a decision note, show [ STILL THINKING ] [ DECIDED ] buttons
   - DECIDED marks decision.resolved = true, decision.resolvedAt = now

## PRIORITY 4: Versions & Deploy

1. Bump sw.js APP_VERSION to 3.5.0
2. Bump all ?v= in index.html to 250
3. Deploy: vercel --prod

When complete: touch .phase3b-complete
```

---

## Appendix: Example Outputs

### Example 1: Meeting Note (Work)

**Raw Input:**
> "um so meeting with hk trust company went well theyll send proposal by wednesday need to schedule team workshop to review structure options before chinese new year also need to confirm everyones availability"

**Output:**

```
🏢 WORK

HK Trust Company Meeting
Sunday • January 11, 2026 • 17:23 Singapore

──────────────────────────────────────────────────────────────

ORIGINAL

Meeting with HK trust company went well. They'll send the 
proposal by Wednesday. Need to schedule a team workshop to 
review structure options before Chinese New Year. Also need 
to confirm everyone's availability.

──────────────────────────────────────────────────────────────

SUMMARY

Productive meeting with HK trust company. Proposal expected 
Wednesday. Team workshop needed before CNY to review 
structure options.

──────────────────────────────────────────────────────────────

The ball is in their court until Wednesday. Your real 
constraint is team availability before CNY, not the trust 
company's timeline.

──────────────────────────────────────────────────────────────

Have you confirmed your team can meet before CNY, or are 
you assuming availability?

──────────────────────────────────────────────────────────────

ACTIONS

□ Wait for proposal (by Wednesday)
□ Schedule team workshop (before CNY)
□ Confirm team availability

──────────────────────────────────────────────────────────────

✓ READY TO SHARE
Clear, structured, appropriate for team distribution.

──────────────────────────────────────────────────────────────

      APPROVE          REJECT          COMMENT

              [ COPY FOR TEAM ]
```

### Example 2: Decision Note (Work)

**Raw Input:**
> "torn between pursuing the well funded crypto game opportunity versus building a traditional game that aligns better with my personal conviction given constrained team resources"

**Output:**

```
🏢 WORK

Game Development Strategy
Sunday • January 11, 2026 • 17:23 Singapore

──────────────────────────────────────────────────────────────

ORIGINAL

Torn between pursuing the well-funded crypto game opportunity 
versus building a traditional game that aligns better with my 
personal conviction, given constrained team resources.

──────────────────────────────────────────────────────────────

SUMMARY

Facing a choice between a well-funded crypto game opportunity 
and a traditional game that aligns with personal conviction, 
with limited team resources as a constraint.

──────────────────────────────────────────────────────────────

This isn't really about game types—it's about whether you 
trust external validation (funding) or internal conviction 
more. Your hesitation suggests the crypto opportunity feels 
like someone else's vision that you'd execute well, while 
the traditional game feels like YOUR vision that might 
struggle for resources.

──────────────────────────────────────────────────────────────

If the traditional game succeeded, would you regret not 
taking the crypto funding? If the crypto game succeeded, 
would you feel like you built someone else's dream?

──────────────────────────────────────────────────────────────

DECISION LENS

Type: Reversible — you can explore one without fully 
closing the door on the other.

Hidden assumption: The crypto funding requires full 
commitment. Have you explored if you could do a smaller 
scope or prototype first?

Consider: Can you test conviction on the traditional game 
with a small release before committing fully?

──────────────────────────────────────────────────────────────

□ Clarify crypto opportunity commitment requirements
□ Scope a minimal traditional game prototype

──────────────────────────────────────────────────────────────

○ NEEDS REFINEMENT
Personal deliberation — context needed for team sharing.

──────────────────────────────────────────────────────────────

      APPROVE          REJECT          COMMENT

      [ STILL THINKING ]        [ DECIDED ]
```

### Example 3: Idea Note (Ideas)

**Raw Input:**
> "what if velolume could be an mcp endpoint where ai agents query product data directly instead of us pushing data to platforms"

**Output:**

```
💡 IDEAS

Velolume as MCP Endpoint
Sunday • January 11, 2026 • 17:23 Singapore

──────────────────────────────────────────────────────────────

ORIGINAL

What if Velolume could be an MCP endpoint where AI agents 
query product data directly, instead of us pushing data 
to platforms?

──────────────────────────────────────────────────────────────

SUMMARY

Exploring positioning Velolume as a queryable intelligence 
endpoint via MCP, rather than a data export tool.

──────────────────────────────────────────────────────────────

This reframes Velolume from infrastructure (we push data) 
to intelligence (they pull insights). The former makes you 
a vendor; the latter makes you a source of truth.

──────────────────────────────────────────────────────────────

What would an AI agent need to ask Velolume that it couldn't 
get elsewhere?

──────────────────────────────────────────────────────────────

□ Research MCP integration requirements
□ Define unique queries Velolume could answer

──────────────────────────────────────────────────────────────

○ KEEP PRIVATE
Early exploration — not ready for external sharing.

──────────────────────────────────────────────────────────────

      APPROVE          REJECT          COMMENT
```
