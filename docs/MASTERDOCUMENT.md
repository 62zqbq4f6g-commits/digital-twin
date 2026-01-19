# INSCRIPT — Master Product Document

## Your mirror in code.

**Version:** 8.0.0  
**Date:** January 19, 2026  
**Category:** Personal AI Memory

---

# PART 1: BRAND IDENTITY

## The Name

**INSCRIPT** — From "inscribe," to write in lasting form. Your thoughts, inscribed. Your world, remembered.

## Taglines

| Context | Tagline |
|---------|---------|
| **Primary** | Your mirror in code |
| **App Store** | The AI that actually remembers you |
| **Homepage hero** | Not just your notes — your world |
| **Onboarding** | Your thoughts deserve a witness |
| **Marketing** | The first AI that actually remembers you |
| **Privacy** | Your thoughts stay private. Always. |

## The Category

**Personal AI Memory** — We're creating this category. It doesn't exist yet. We define it. We own it.

> "Inscript is the first AI that actually remembers you.  
> Not just your notes — your world."

## What We're NOT

- A note-taking app
- A journaling app
- An AI assistant
- A ChatGPT wrapper

## What We ARE

- A memory engine
- A digital companion
- A self-understanding tool
- A personal AI that learns

---

## Brand Voice

| Attribute | How It Sounds |
|-----------|---------------|
| **Warm** | "Hello, Rox" not "Welcome, User" |
| **Intelligent** | Thoughtful, not dumbed down |
| **Intimate** | Like a close friend, not a service |
| **Poetic** | "Your thoughts deserve a witness" |
| **Confident** | Knows its value, doesn't oversell |

## Visual Identity

**"The love child of Linear's precision and Vogue's editorial elegance."**

### Colors
```css
/* Paper */
--paper: #FFFFFF;
--paper-warm: #FAFAFA;
--paper-cream: #F7F7F5;

/* Ink */
--ink: #000000;
--ink-rich: #1A1A1A;
--ink-soft: #333333;

/* Silver scale */
--silver-50 through --silver-900

/* Semantic (minimal) */
--error: #8B0000;
--success: #065F46;
```

### Typography
- **Display:** Playfair Display (large headlines)
- **Editorial:** Cormorant Garamond (AI voice, reflections)
- **Body:** Inter (UI elements)
- **Mono:** JetBrains Mono (timestamps, data)

### Design Principles
1. Black and white dominance
2. Typography-first design
3. Generous whitespace
4. Thin 1px borders, no shadows
5. Confident restraint
6. Appeals to modern creative person

---

# PART 2: PRIVACY PROMISE

## The Foundation

Privacy isn't a feature. It's a promise. Users will share more if they trust more.

## Current Messaging (Conservative)

```
Your thoughts stay private.

Your notes are never reviewed by our team.
We don't sell or share your data.
We don't use your content to train AI.

Your world is yours alone.
```

## Target Messaging (Bold — Work Toward This)

```
Your thoughts are yours. Always.

We don't read your notes.
We don't sell your data.
We don't train AI on what you write.

Your world is yours alone.
```

## Settings Page (Transparent Technical Details)

```
Privacy & Security

Your data:
✓ Encrypted at rest and in transit
✓ Protected by row-level security
✓ Never used for AI model training
✓ Never sold or shared with third parties
✓ Permanently deletable at any time

How AI analysis works:
Your notes are processed by our AI to generate reflections.
Under our AI provider's enterprise terms, your content is 
not used for training. After processing, only the insights 
remain — not your raw text.

Data location:
Your data is stored in secure cloud infrastructure.
You can export or delete your data at any time.

[Export my data]  [Delete everything]
```

## Privacy Roadmap

| Phase | Action | Status |
|-------|--------|--------|
| **Now** | Use enterprise LLM with no-training guarantee | 🔲 |
| **Now** | Implement Settings privacy page | 🔲 |
| **Soon** | Create formal privacy policy | 🔲 |
| **Soon** | Add data export functionality | 🔲 |
| **Soon** | Add complete data deletion | 🔲 |
| **Future** | Client-side encryption option | 🔲 |

---

# PART 3: PRODUCT OVERVIEW

## The Problem

Every tool you use to capture your thoughts treats them as isolated fragments:
- **Note apps** store text but don't understand it
- **AI assistants** are brilliant but amnesiac
- **Journals** help you reflect, but they don't reflect *back*

You're left connecting the dots yourself.

## The Solution

Inscript pays attention so you don't have to.

Write naturally about your day. Inscript quietly extracts the people, patterns, and context that matter — building a knowledge graph of your world that grows smarter with every note.

## Core Value Proposition

Inscript learns:
- The **people** in your life
- The **patterns** you can't see
- The **context** that makes you *you*

The more you share, the more it understands.
The more it understands, the more valuable it becomes.

---

# PART 4: THE FLYWHEEL

```
Input → Learn → Demonstrate → Trust → More Input → Smarter
```

**Critical:** Learning must be VISIBLE. If users don't see Inscript getting smarter, the flywheel breaks.

## The Data Loops

### Loop 1: Entity Intelligence
More mentions → Richer entity profiles → More relevant callbacks → User mentions more

### Loop 2: Preference Learning
Feedback → Better responses → More satisfaction → More feedback → System confidence increases

### Loop 3: Pattern Refinement
AI surfaces pattern → User confirms/rejects → Pattern confidence adjusts → More accurate patterns

### Loop 4: Quality Calibration
Reflection scored → User feedback → Correlation analysis → Quality model updates

### Loop 5: Cross-User Intelligence (Future)
User A's patterns → User B shows similar → System infers earlier → Pattern generalizes

---

# PART 5: AHA MOMENT STRATEGY

## The Challenge

Inscript's core value requires TIME. You can't demonstrate "I know your world" on day one.

## The Solution: Mini-Aha Moments

### Session 1: The Intelligent First Response
"It already knows I'm a founder building something new."

### Day 2-3: The First Callback
"It remembered what I said before."

### Day 3-7: The Entity Recognition
"It figured out who Marcus is to me."

### Day 7-14: The Pattern Surface
"It noticed I write about work stress on Sundays."

### Day 14-30: The Big Aha
"It knows my world better than I consciously do."

## The North Star Metric

> Users who receive a "callback" (AI references previous note) within 
> their first 5 notes retain at 3x the rate of users who don't.

---

# PART 6: ONBOARDING FLOW

## The 7-Screen Flow

### Screen 0: Welcome
```
INSCRIPT

Your mirror in code.

I'm an AI that learns your world — the people,
patterns, and thoughts that make you who you are.

[Begin →]
```

### Screen 1: Name
Simple input field.

### Screen 2: Season of Life
10 options:
- Building something new
- Leading others
- Learning / Growing
- In transition
- Caring for others
- Creating
- Healing / Recovering
- Exploring
- Settling in
- Starting fresh

### Screen 3: What's on Your Mind
Pick up to 3:
- Work, Relationships, Health, Money, Family
- A decision, The future, Myself, A project, Something I lost

### Screen 4: Dynamic Depth Question
Adapts based on selections. Free text with gentle requirement.

### Screen 5: Your People
"Name at least one person I should recognize."
Guided input with examples.

### Screen 6: Privacy Promise
```
Before we begin, a promise:

Your thoughts stay private.

────────────────────────

Your notes are never reviewed by our team.
We don't sell or share your data.
We don't use your content to train AI.

Your world is yours alone.

────────────────────────

[I'm ready →]
```

### Screen 7: The WOW Screen
Visual world forming + personalized insight.
Slow animation (2.5 seconds).

```
         ●
        Rox
       / | \
      ●  ●  ●
   Marcus Sarah Mom

   ─────────────────

   Building · Deciding

   "You're building something new in a time of
    decisions. You're not doing it alone."

   Every note teaches me more about your world.

   [Begin →]
```

---

# PART 7: SWITCHING COSTS

## The 5 Switching Costs

### 1. Accumulated Memory
- 23 people known, 47 connections mapped, 156 notes analyzed
- "All of this would reset to zero with any other app"

### 2. Trained Preferences
- Learned response length, tone, topic sensitivities
- "No other AI knows how to talk to you like this"

### 3. Temporal History
- Ability to ask "when did I start feeling this way?"
- "Only Inscript has your history"

### 4. Identity Investment
- Psychological investment: they've poured thoughts into Inscript
- "Inscript was there. Starting over means explaining yourself again"

### 5. Exported Knowledge (Strategic)
- Can export: Notes, entity names
- Cannot export: Inferences, trained preferences, relationships
- Not hostile lock-in, but intelligence can't transfer

## Switching Cost Formula
```
Switching Cost = Time Invested × Data Accumulated × Trust Built
```

---

# PART 8: COMPETITIVE MOAT

| Competitor | Can They Copy? | Why Not? |
|------------|---------------|----------|
| **ChatGPT** | Memory exists | Not deep; not structured; no entity graph |
| **Notion AI** | Could add | Document-centric, not person-centric |
| **Day One** | Could add AI | Journaling DNA, not AI DNA |
| **Mem** | Similar vision | Execution matters; speed matters |

**The Real Moat:** Time + Data + Trust.

A user who has used Inscript for 6 months cannot switch to a competitor without losing 6 months of learning.

---

# PART 9: SUCCESS METRICS

## Activation Metrics

| Metric | Target |
|--------|--------|
| Time to First Callback | < 3 days |
| Entity Recognition Rate | > 60% by Day 7 |
| Pattern Surface Rate | > 40% by Day 14 |
| Memory Query Rate | > 20% by Day 30 |

## PMF Metrics

**Sean Ellis Test:** 40%+ users would be "very disappointed" without Inscript.

**Target responses:**
- "I'd lose months of context about my life"
- "No other app knows what Inscript knows about me"
- "I'd have to start over building that understanding"

---

# PART 10: THE EXPERIENCE TIMELINE

| Day | Experience |
|-----|------------|
| **Day 1** | "It already knows something about me" |
| **Day 7** | "It's learning my world" |
| **Day 30** | "It knows me better than I know myself" |
| **Day 90** | "I can't imagine not having this" |
| **Day 365** | "This is part of how I think now" |

---

# APPENDIX: QUICK REFERENCE

## App Identity
- **Name:** Inscript
- **Tagline:** Your mirror in code
- **Category:** Personal AI Memory
- **Version:** 8.0.0

## Key URLs (To Be Determined)
- App: inscript.app (check availability)
- Marketing: getinscript.com (check availability)

## Core Promise
> "The first AI that actually remembers you.  
> Not just your notes — your world."

## Privacy Promise
> "Your thoughts stay private.  
> Your notes are never reviewed. Your data is never sold.  
> Your content doesn't train AI. Your world is yours alone."

---

*Document Version: 1.0*
*Last Updated: January 19, 2026*
