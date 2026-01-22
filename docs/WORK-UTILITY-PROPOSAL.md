# INSCRIPT WORK UTILITY

## From "Note App" to "Assistant Replacement"

**Created:** January 21, 2026
**Purpose:** Define what makes Inscript indispensable for busy, unorganized founders

---

## The Problem

You created Inscript because:
- You wanted a place to store notes and meeting minutes (voice + text)
- You wanted to give your life more structure
- You don't have an assistant anymore
- You're not naturally organized

**Current gap:** Inscript captures beautifully but doesn't proactively organize or assist. It's memory without action.

---

## The Insight

> **Inscript should feel like a thoughtful friend who remembers — not a nagging productivity tool.**

The market is flooded with task managers. We don't need another one. We need something that:
- Understands context, not just tasks
- Nudges gently, not aggressively
- Centers people, not projects
- Works passively, surfaces naturally

---

## Core Philosophy

| Traditional Productivity App | Inscript Work Utility |
|------------------------------|----------------------|
| "OVERDUE: Send deck to Marcus" | "You mentioned wanting to get the deck to Marcus. How's that going?" |
| Task-first | People-first |
| You manage it | It learns from you |
| Explicit input required | Passive extraction |
| Anxiety-inducing | Supportive |

---

## Feature Set

### Tier 1: Foundation (Build First)

#### 1.1 Commitment Extraction (Passive)

**What it does:** Automatically detect promises and follow-ups from notes.

**How it works:**
- Scan notes for commitment language:
  - "I said I would..."
  - "I need to..."
  - "Promised to..."
  - "Should follow up on..."
  - "Marcus asked me to..."
- Extract: What, Who (if mentioned), When (if mentioned)
- Store as "commitments" linked to entities

**UX:**
```
After saving note, Knowledge Pulse shows:

"I noticed a commitment:"
→ "Send the deck to Marcus" (mentioned 2 days ago)

[That's done] [Still working on it] [Not a commitment]
```

**Key principle:** Non-judgmental. No red "OVERDUE" badges. Just gentle awareness.

---

#### 1.2 Morning Pulse (Daily Briefing)

**What it does:** Start each day with context, not chaos.

**When:** First app open of the day (or configurable time)

**Content:**

```
Good morning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT'S ON YOUR MIND
Based on your recent notes:
• The Series A timeline (mentioned 4 times this week)
• Sarah's feedback on the product (unresolved)

PEOPLE IN YOUR ORBIT
• Marcus — You last wrote about him 2 days ago
  "Excited about the pivot direction"
• Sarah — Open loop: You said you'd review her proposal

OPEN COMMITMENTS
• Send deck to investors (mentioned Tuesday)
• Follow up with lawyer about contract

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Start writing] [Dismiss]
```

**Key principle:** This isn't a calendar. It's what's actually weighing on your mind.

---

#### 1.3 People-Context Surface

**What it does:** When you write about someone, surface relevant context.

**How it works:**
- Detect entity mentions in note (already doing this)
- Before/after save, show contextual card:

```
┌─────────────────────────────────────┐
│ MARCUS                              │
│ Close friend • Mentioned 12 times   │
├─────────────────────────────────────┤
│ Recent context:                     │
│ • "Excited about pivot" (2 days)    │
│ • "Gave great advice on hiring"     │
│                                     │
│ Open loop:                          │
│ • You said you'd intro him to Sarah │
└─────────────────────────────────────┘
```

**Key principle:** Context at the moment of writing, not buried in a separate tab.

---

### Tier 2: Proactive Intelligence

#### 2.1 Gentle Nudges

**What it does:** Surface open loops at relevant moments.

**Types of nudges:**

| Trigger | Nudge |
|---------|-------|
| Time-based | "It's been 5 days since you mentioned sending that deck" |
| Person-based | "You're writing about Sarah — you also mentioned reviewing her proposal" |
| Pattern-based | "You usually talk to Marcus before big decisions. You haven't mentioned him lately." |

**UX:** Nudges appear as subtle inline suggestions, not pop-ups:

```
[Writing area]

━━━━━━━━━━━━━━━━━━━━━━━━━━
💭 Related: You mentioned wanting to follow up
   with the investor this week
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Key principle:** Ambient, not interruptive. Easy to ignore.

---

#### 2.2 Meeting Debrief Mode

**What it does:** Structured capture after meetings.

**Trigger:** User says "just had a meeting" or taps "Meeting Debrief" quick action

**Flow:**
```
Who was in the meeting?
[Voice or text: "Sarah and the design team"]

What was discussed?
[Voice capture or typing]

Any commitments made?
[AI extracts, user confirms]

How did it feel?
[Optional: Good / Tense / Productive / Draining]
```

**Output:** Structured note with:
- People tagged
- Commitments extracted
- Sentiment captured
- Linked to previous meetings with same people

---

#### 2.3 Evening Reflection Prompt

**What it does:** Close the loop on the day.

**When:** Evening (configurable, e.g., 8pm)

**Prompt:**
```
How was today?

[Quick capture area]

━━━━━━━━━━━━━━━━━━━━━━━━━━

Things you mentioned wanting to do today:
☐ Send deck to Marcus
☐ Review Sarah's proposal

[Mark what got done]
```

**Key principle:** Not a guilt trip. Just gentle closure.

---

### Tier 3: Ambient Intelligence

#### 3.1 Relationship Health Signals

**What it does:** Notice patterns in your relationships.

**Examples:**
- "You usually talk to Sarah weekly. It's been 3 weeks."
- "Your notes about [work project] have gotten more stressed over time."
- "You feel most supported after talking to Marcus."

**UX:** Surfaces in TWIN tab or Morning Pulse, not as notifications.

---

#### 3.2 Decision Context

**What it does:** Before big decisions, surface relevant past thinking.

**Trigger:** User writes about a decision ("trying to decide...", "not sure if...")

**Surface:**
```
You've thought about this before:

• Jan 15: "Leaning toward pushing the launch"
• Jan 10: "Marcus thinks we should wait"
• Jan 8: "Sarah disagrees — wants to move fast"

[See full context]
```

---

#### 3.3 Pattern Learning

**What it does:** Learn your rhythms without you telling it.

**Examples:**
- "You write most reflectively on Sunday mornings"
- "You tend to make decisions after talking to Marcus"
- "Stress spikes when you haven't written in 3+ days"

**Use:** Inform nudge timing, Morning Pulse content, TWIN insights.

---

## What We Don't Build

| Feature | Why Not |
|---------|---------|
| Calendar integration (yet) | Phase 2 — adds complexity |
| Task manager with due dates | Not our identity |
| Notification spam | Erodes trust |
| Complex project management | Not our focus |
| Productivity dashboards | Anxiety-inducing |

---

## Implementation Phases

### Phase A: Commitment Foundation (2-3 weeks)

1. **Commitment extraction** from notes (AI)
2. **Commitment storage** as entity-linked data
3. **Knowledge Pulse enhancement** to show commitments
4. **Morning Pulse v1** — simple daily context

### Phase B: People Context (2-3 weeks)

1. **Contextual entity cards** during writing
2. **Open loop surfacing** per person
3. **Enhanced entity cards** in TWIN tab

### Phase C: Proactive Features (3-4 weeks)

1. **Gentle nudges** (time-based, person-based)
2. **Meeting Debrief mode**
3. **Evening Reflection prompt**

### Phase D: Ambient Intelligence (4+ weeks)

1. **Relationship health signals**
2. **Decision context surfacing**
3. **Pattern learning**

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Daily active usage | 60%+ | Utility drives habit |
| Notes with commitments extracted | 30%+ | Extraction working |
| Morning Pulse engagement | 50%+ open rate | Daily value |
| Commitment resolution rate | Track | Are nudges helpful? |
| User sentiment on nudges | Positive | Not annoying |

---

## Language Guide

### Do Say:
- "You mentioned..."
- "How's that going?"
- "Worth reaching out?"
- "I noticed..."
- "Related to what you wrote..."

### Don't Say:
- "OVERDUE"
- "You failed to..."
- "Don't forget!"
- "Task incomplete"
- "Action required"

---

## Integration with Strategic Bible

This feature set directly supports:

| Strategic Principle | How Work Utility Supports It |
|--------------------|------------------------------|
| **People over productivity** | Commitments link to people, not projects |
| **Trust is earned daily** | Gentle nudges, not nagging |
| **Show, don't tell** | Knowledge Pulse shows learning |
| **Consumer love (Phase 1)** | Daily utility drives engagement |

---

## The Vision

> Inscript becomes the assistant you used to have.
>
> It remembers your commitments without you managing a task list.
> It knows who matters and surfaces context when relevant.
> It gently closes open loops without making you feel behind.
>
> You open it because it helps. Not because it guilts you.

---

*Document created: January 21, 2026*
*Status: Proposal for review*
