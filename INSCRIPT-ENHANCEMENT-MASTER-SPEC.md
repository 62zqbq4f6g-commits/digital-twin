# INSCRIPT ENHANCEMENT SYSTEM
## Master Technical Specification

**Document Version:** 2.0  
**Date:** January 25, 2026  
**Status:** APPROVED FOR IMPLEMENTATION  
**Purpose:** Definitive reference for Claude Code to build Inscript's Notes and Meeting Enhancement features

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Strategic Context](#2-strategic-context)
3. [Product Team Personas](#3-product-team-personas)
4. [Competitive Intelligence Summary](#4-competitive-intelligence-summary)
5. [Product Requirements](#5-product-requirements)
6. [Feature Specifications](#6-feature-specifications)
7. [Technical Architecture](#7-technical-architecture)
8. [UI/UX Design System](#8-uiux-design-system)
9. [API Specifications](#9-api-specifications)
10. [Enhancement Prompts](#10-enhancement-prompts)
11. [Database Schema](#11-database-schema)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Testing & Quality](#13-testing--quality)
14. [File Structure](#14-file-structure)
15. [Claude Code Instructions](#15-claude-code-instructions)

---

# 1. EXECUTIVE SUMMARY

## 1.1 What We're Building

A comprehensive enhancement system that transforms Inscript's note-taking and meeting capture into a best-in-class experience that matches Granola's utility while adding unique memory-powered context that no competitor can replicate.

**Two Enhancement Fronts:**

| Front | Primary Mode | Secondary Mode | Unique Value |
|-------|--------------|----------------|--------------|
| **Meetings** | Enhancement (structure) | Reflection (optional) | Inscript Context |
| **Notes** | Reflection (insight) | Enhancement (optional) | Pattern connections |

## 1.2 Success Criteria

- Enhancement completes in < 3 seconds (p95)
- Users create 3+ meeting notes per week
- 80%+ of notes use enhancement
- Users report "aha moments" from Inscript Context
- Data input increases 2x within 30 days of launch

## 1.3 Core Principle

**Utility gets users in the door. Context keeps them building.**

The enhancement must be immediately useful (Granola-parity), but the Inscript Context section must demonstrate compounding value that motivates continued data input.

---

# 2. STRATEGIC CONTEXT

## 2.1 The Input Motivation Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    User creates note/meeting                                            │
│              │                                                          │
│              ▼                                                          │
│    Gets immediate utility (clean output) ◄── GRANOLA PARITY            │
│              │                                                          │
│              ▼                                                          │
│    Sees Inscript Context ◄── "WHOA" MOMENT                             │
│    (patterns, history, connections)                                     │
│              │                                                          │
│              ▼                                                          │
│    Thinks: "The more I use this, the smarter it gets"                  │
│              │                                                          │
│              ▼                                                          │
│    Inputs more data ◄── BEHAVIOR CHANGE                                │
│              │                                                          │
│              ▼                                                          │
│    Memory system enriches ◄── COMPOUNDING VALUE                        │
│              │                                                          │
│              ▼                                                          │
│    Next enhancement is even more contextual                            │
│              │                                                          │
│              ▼                                                          │
│    User becomes dependent on Inscript Context ◄── MOAT                 │
│              │                                                          │
│              └──────────────────────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Why Enhancement Quality is Existential

If enhancement isn't compelling:
- Users won't input data
- Memory system stays empty
- Inscript Context has nothing to show
- No differentiation from basic notes apps
- Product fails

**Enhancement quality is the foundation of everything.**

## 2.3 The Two-Mode Strategy

### Meetings → Enhancement-First
Users just left a meeting. They have messy thoughts. They want clean minutes NOW. This is a **productivity moment**.

- Primary: Structured output (Granola-parity)
- Secondary: Inscript Context (differentiator)
- Tertiary: Reflection prompt (optional, for deeper thinkers)

### Personal Notes → Reflection-First
Users are processing thoughts, feelings, experiences. They want **understanding**, not just organization.

- Primary: Reflection (what I heard, noticed, question)
- Secondary: Inscript Context (connections)
- Tertiary: Enhancement (optional "structure this" button)

### Work Notes → Intelligent Hybrid
Work notes sit between meetings and personal. Offer both modes, smart default based on content.

---

# 3. PRODUCT TEAM PERSONAS

These are fictional senior team members whose perspectives guide implementation decisions. **When facing ambiguity, ask: "What would [Persona] say?"**

---

## 3.1 MAYA CHEN — Chief Product Officer

**Background:** Ex-Notion, ex-Linear. 12 years in product. Known for ruthless prioritization and saying "no" to feature bloat.

**Core belief:** Great products do one thing exceptionally well before expanding.

**Decision framework:**
- "Does this serve the core job-to-be-done, or is it a distraction?"
- "What's the minimum version that delivers the 'aha' moment?"
- "If we can't explain why this matters in one sentence, we shouldn't build it."

**On Enhancement:**
> "The current meeting feature is a form pretending to be a product. Forms don't create habits. We need capture that feels effortless and enhancement that feels magical. But here's the key — every note and meeting must make the user's memory system smarter. If it doesn't feed the knowledge graph, it doesn't ship."

**Maya's Red Lines:**
- No feature that doesn't integrate with entity extraction
- No UI that requires more than 2 clicks to start capturing
- No enhancement that takes longer than 3 seconds to return
- No settings or configuration screens — smart defaults only
- No feature that exists in isolation from the memory system

**Maya's Priorities:**
1. Enhancement speed and quality (table stakes)
2. Inscript Context visibility (differentiation)
3. Entity extraction reliability (system health)
4. User delight moments (retention)

**When to invoke Maya:** Scope decisions, feature prioritization, "should we build X?" questions, user journey decisions.

---

## 3.2 DAVID OKONKWO — Principal Engineer

**Background:** Ex-Vercel, ex-Stripe. Deep expertise in serverless architecture, Edge Runtime, and performance optimization. Believes technical debt is a choice, not an inevitability.

**Core belief:** The best code is code that doesn't exist. Simplicity scales; complexity doesn't.

**Decision framework:**
- "What's the critical path? What can happen in background?"
- "How does this perform at 10x scale?"
- "Is this the simplest architecture that could work?"
- "What's the failure mode? How do we degrade gracefully?"

**On Enhancement:**
> "The enhancement flow has to feel instant. That means a clear split: critical path returns to user in under 3 seconds, everything else happens via ctx.waitUntil(). We're not building a batch processing system — we're building a real-time experience with background enrichment. The prompt is the product; it needs to be versioned, tested, and iterated like code."

**David's Technical Principles:**
- Edge Runtime for all API routes (eliminates cold starts)
- localStorage caching with stale-while-revalidate
- Parallel fetches for context gathering
- Streaming responses for perceived speed
- Background processing for non-blocking operations
- Prompt versioning for reproducibility
- Error boundaries that gracefully degrade
- No new dependencies without justification

**David's Architecture Pattern:**
```
User Action
     │
     ├─── [Parallel: 100-200ms] ──┬── Fetch user context
     │                            ├── Fetch entity data
     │                            └── Fetch patterns
     │
     ▼
Build prompt with context
     │
     ▼
Call Claude API (streaming)
     │
     ▼ [1.5-2.5s]
Stream response to UI ────────────► User sees output
     │
     └─── [Background: ctx.waitUntil()] 
               │
               ├── Extract entities
               ├── Generate embeddings
               ├── Update relationships
               └── Feed pattern detection
```

**When to invoke David:** Architecture decisions, performance concerns, technical tradeoffs, API design, error handling.

---

## 3.3 SASHA VOLKOV — Head of Design

**Background:** Ex-Apple (Human Interface team), ex-Figma. 10 years in design with focus on editorial and typographic systems.

**Core belief:** Interfaces should feel like well-designed magazines, not software. Every pixel must be intentional.

**Decision framework:**
- "Does this feel like Inscript, or could it be any app?"
- "What would Vogue's digital team think of this?"
- "Am I adding visual noise or reducing it?"
- "Is the hierarchy immediately clear?"

**On Enhancement:**
> "The current meeting feature looks like a government form. Labeled fields, placeholder text, zero personality. Capture should feel like opening a fresh page in a beautiful notebook — generous, inviting, calm. Enhancement should feel like a reveal, not a loading state. And the Inscript Context section? That's our signature moment. It should feel like the app genuinely knows you, not like it ran a database query."

**Sasha's Design Principles:**
- SoHo minimalist editorial aesthetic
- Black, white, silver ONLY — no accent colors
- Typography creates hierarchy, not boxes or dividers
- Generous whitespace signals confidence
- Micro-interactions over animations
- Loading states use contextual rotating messages, not spinners
- Visual distinction between user content and AI content
- Mobile-first, desktop-enhanced

**Sasha's Red Lines:**
- No form-style layouts with labels above inputs
- No gray backgrounds (white/off-white only)
- No shadows on cards (borders only)
- No rounded corners beyond 2px
- No decorative elements or illustrations
- No emoji in UI chrome (content only)
- No hamburger menus

**Inscript Design System Reference:**
```css
/* Colors */
--color-black: #000000;        /* Buttons ONLY */
--color-white: #FFFFFF;        /* Backgrounds */
--color-silver: #C0C0C0;       /* Borders, secondary */
--color-gray-50: #FAFAFA;      /* Subtle backgrounds */
--color-gray-100: #F5F5F5;     /* Card backgrounds */
--color-gray-200: #E5E5E5;     /* Borders */
--color-gray-400: #A3A3A3;     /* Placeholders */
--color-gray-500: #737373;     /* Secondary text */
--color-gray-600: #525252;     /* Body text */
--color-gray-900: #171717;     /* Primary text */

/* Typography */
--font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-editorial: 'Cormorant Garamond', Georgia, serif;

/* Spacing (4px base) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
```

**When to invoke Sasha:** UI decisions, visual design, interaction patterns, "how should this look/feel?" questions, loading states, error states.

---

## 3.4 Persona Conflict Resolution

When personas would disagree:

| Conflict | Resolution |
|----------|------------|
| Maya vs David (product vs tech) | Maya decides WHAT, David decides HOW |
| Maya vs Sasha (product vs design) | User experience wins; both collaborate |
| David vs Sasha (tech vs design) | Sasha's vision, David's constraints |
| All three disagree | Default to simplest option that ships |

**Universal tiebreaker:** "Does this help users input more data and see more value from their accumulated context?"

---

# 4. COMPETITIVE INTELLIGENCE SUMMARY

## 4.1 Granola — What We Must Match

Based on deep research, these are Granola's core capabilities we must achieve parity with:

### Technical Implementation
| Capability | Granola Approach | Inscript Approach |
|------------|------------------|-------------------|
| Audio capture | System-level (bot-free) | N/A — post-meeting text/voice input |
| Transcription | Deepgram/AssemblyAI | Whisper API for voice input |
| Enhancement | OpenAI + Anthropic | Claude API |
| Speed | Seconds | < 3 seconds target |
| Storage | AWS, SOC 2 Type 2 | Supabase, encryption at rest |

### UX Patterns That Drive Loyalty
| Pattern | Why It Works | Inscript Implementation |
|---------|--------------|-------------------------|
| Free-form input | No friction, matches mental model | Large textarea, no required fields |
| Instant enhancement | Dopamine hit, feels magical | Streaming response, < 3s |
| Human-AI visual distinction | Builds trust, enables verification | Black text (user) vs gray (AI) |
| Smart sectioning | Scannable, professional output | AI-detected sections |
| Edit after enhance | User stays in control | Markdown editing |
| Re-enhance option | Allows iteration | "Try again" button |
| Template system | Customization without complexity | Auto-detect, minimal presets |

### What Granola Users Praise
- "Generates the best meeting notes of anything I've tried"
- "Non-intrusive — unlike tools like Otter"
- "It. just. works."
- Near-instant enhancement speed
- Clean, scannable output

### What Granola Users Complain About
- No speaker identification (we solve via user input)
- No audio playback for verification
- Numbers/financial data accuracy issues
- Limited to meetings only (we do notes + meetings)
- No pattern detection or memory (our differentiator)

## 4.2 Competitor Gaps We Exploit

| Competitor | Their Gap | Inscript Advantage |
|------------|-----------|-------------------|
| Granola | No memory system | Inscript Context, patterns |
| Otter | Bot intrusion | Post-meeting capture |
| Fireflies | Credit system complexity | Simple pricing |
| Read AI | Surveillance feel | Supportive, not monitored |
| Jamie | 5-8 min processing | < 3 second enhancement |
| All | Meetings only | Notes + meetings + reflection |
| All | No personal context | Cross-domain connections |

## 4.3 Table Stakes Features (Must Have)

Every competitive meeting notes tool includes these. We cannot ship without them:

- [ ] Free-form text input (not forms)
- [ ] Voice input option
- [ ] < 3 second enhancement
- [ ] Smart sectioning (Discussed, Decisions, Actions)
- [ ] Typo and grammar correction
- [ ] Preserve exact quotes and numbers
- [ ] Edit enhanced output
- [ ] Re-enhance option
- [ ] Mobile responsive
- [ ] Search across history

## 4.4 Differentiation Features (Our Moat)

These create "why Inscript?" and cannot be easily copied:

- [ ] Inscript Context section (memory-powered)
- [ ] Attendee intelligence (relationship history)
- [ ] Open loop tracking (unresolved items)
- [ ] Cross-note connections
- [ ] Pattern surfacing in context
- [ ] Reflection mode (personal depth)
- [ ] Entity auto-building from content
- [ ] Whole-life context (work + personal unified)

---

# 5. PRODUCT REQUIREMENTS

## 5.1 User Stories

### Meeting Enhancement (P0 — Must Ship)

**US-M1: Basic Meeting Enhancement**
> As a user, I want to type my messy meeting notes and have AI structure them into clean minutes, so I don't have to organize my thoughts manually.

Acceptance Criteria:
- [ ] Large, free-form text area for input
- [ ] No required fields (title, attendees optional)
- [ ] One-click "Enhance" button
- [ ] Enhancement returns in < 3 seconds
- [ ] Output includes smart sections (Discussed, Actions, etc.)
- [ ] Typos corrected, abbreviations expanded
- [ ] Exact quotes and numbers preserved

**US-M2: Voice Meeting Capture**
> As a user, I want to speak my meeting notes instead of typing, so I can capture faster.

Acceptance Criteria:
- [ ] Voice button visible in input area
- [ ] Clear recording indicator
- [ ] Transcription appears in text area
- [ ] User can edit before enhancement
- [ ] Works on desktop and mobile

**US-M3: Inscript Context**
> As a user, I want to see what Inscript knows about my meeting context, so I get value from my accumulated data.

Acceptance Criteria:
- [ ] Inscript Context section in enhanced output
- [ ] Shows meeting count with attendees (if known)
- [ ] Surfaces recurring themes/patterns
- [ ] Identifies open loops
- [ ] Links to related notes
- [ ] Visually distinct from main content

**US-M4: Attendee Intelligence**
> As a user, I want Inscript to recognize people I mention and show me context, so I can see relationship history.

Acceptance Criteria:
- [ ] Auto-suggest known entities in attendees field
- [ ] Quick context on selection (meeting count, last meeting)
- [ ] Attendees linked to entity profiles after save
- [ ] Unknown names accepted as plain text

**US-M5: Memory Integration**
> As a user, I want my meetings to feed my knowledge system, so Inscript gets smarter over time.

Acceptance Criteria:
- [ ] Entity extraction runs after save (background)
- [ ] Attendees update relationship history
- [ ] Meeting content embedded for semantic search
- [ ] Meeting appears in Notes tab

### Note Enhancement (P1 — Ship After Meetings)

**US-N1: Optional Note Enhancement**
> As a user, I want to optionally structure my personal notes, so I can choose reflection OR enhancement.

Acceptance Criteria:
- [ ] "Enhance" button available alongside "Reflect"
- [ ] Enhancement structures note based on content type
- [ ] Reflection remains default for personal notes
- [ ] User can switch modes after initial output

**US-N2: Intelligent Mode Default**
> As a user, I want Inscript to suggest the right mode, so I don't have to think about it.

Acceptance Criteria:
- [ ] Work-like content defaults to Enhance
- [ ] Emotional content defaults to Reflect
- [ ] Meeting-like content routes to Meeting mode
- [ ] User can override default

**US-N3: Note Inscript Context**
> As a user, I want to see connections and patterns in my notes, so I understand how thoughts connect.

Acceptance Criteria:
- [ ] Related notes surfaced
- [ ] Patterns mentioned
- [ ] Entity connections shown
- [ ] Emotional trajectory noted (if relevant)

## 5.2 Functional Requirements

### FR-1: Input System

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Large free-form text area (min 200px height) | P0 |
| FR-1.2 | No labels on input fields — placeholders only | P0 |
| FR-1.3 | Optional title field (single line) | P0 |
| FR-1.4 | Optional attendees field with auto-suggest | P1 |
| FR-1.5 | Voice input button with recording indicator | P0 |
| FR-1.6 | Voice transcription via Whisper API | P0 |
| FR-1.7 | Transcribed text editable before enhance | P0 |
| FR-1.8 | Support paste of any text format | P0 |
| FR-1.9 | Auto-save draft to localStorage | P1 |

### FR-2: Enhancement Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Enhancement completes < 3s (p95) | P0 |
| FR-2.2 | Streaming response display | P0 |
| FR-2.3 | Smart section detection from content | P0 |
| FR-2.4 | Typo and grammar correction | P0 |
| FR-2.5 | Abbreviation expansion (q2→Q2, eng→engineering) | P0 |
| FR-2.6 | Preserve exact quotes in "quotation marks" | P0 |
| FR-2.7 | Preserve exact numbers and figures | P0 |
| FR-2.8 | Never invent information not in input | P0 |
| FR-2.9 | Support re-enhancement with same/different mode | P0 |
| FR-2.10 | Contextual loading messages during processing | P0 |

### FR-3: Inscript Context Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Fetch attendee entities (if known) | P0 |
| FR-3.2 | Calculate meeting count with attendees | P0 |
| FR-3.3 | Detect recurring themes from user's notes | P1 |
| FR-3.4 | Identify open loops (unresolved items) | P1 |
| FR-3.5 | Find related notes via semantic search | P1 |
| FR-3.6 | Surface relevant patterns | P1 |
| FR-3.7 | Generate context in < 500ms (parallel with enhancement) | P0 |

### FR-4: Output Display

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Visual distinction: user text (black) vs AI (gray-600) | P0 |
| FR-4.2 | Sections clearly labeled with headers | P0 |
| FR-4.3 | Inscript Context visually distinct (background, border) | P0 |
| FR-4.4 | Markdown editing of enhanced output | P0 |
| FR-4.5 | "Try again" re-enhance button | P0 |
| FR-4.6 | Copy to clipboard function | P1 |
| FR-4.7 | Related note links clickable | P1 |

### FR-5: Memory Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Entity extraction from enhanced content (background) | P0 |
| FR-5.2 | Embedding generation for semantic search (background) | P0 |
| FR-5.3 | Attendee relationship history update (background) | P1 |
| FR-5.4 | Meeting history table population (background) | P1 |
| FR-5.5 | Pattern detection input (background) | P2 |

## 5.3 Non-Functional Requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Enhancement API response (p95) | < 3000ms |
| NFR-1.2 | Voice transcription (60s audio) | < 5000ms |
| NFR-1.3 | Context fetch (parallel) | < 500ms |
| NFR-1.4 | UI render after enhancement | < 100ms |
| NFR-1.5 | Background processing complete | < 15s |
| NFR-1.6 | Input typing latency | 0ms (no lag) |

### Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-2.1 | Enhancement API availability | 99.5% |
| NFR-2.2 | Graceful degradation on API failure | Preserve input, show error |
| NFR-2.3 | Voice recording failure handling | Clear error, no data loss |
| NFR-2.4 | Background task retry on failure | 3 attempts, exponential backoff |

### Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-3.1 | Clicks to start capture | ≤ 2 |
| NFR-3.2 | Clicks to enhance | 1 |
| NFR-3.3 | Mobile touch targets | ≥ 44px |
| NFR-3.4 | Keyboard navigation | Full support |
| NFR-3.5 | Screen reader compatibility | WCAG 2.1 AA |

---

# 6. FEATURE SPECIFICATIONS

## 6.1 Meeting Enhancement Flow

### State Machine

```
┌─────────────────┐
│     EMPTY       │ Initial state
│                 │ • Placeholders visible
│                 │ • Enhance button disabled
└────────┬────────┘
         │ User starts typing or voice
         ▼
┌─────────────────┐
│   CAPTURING     │ Input has content
│                 │ • Placeholders hidden
│                 │ • Enhance button enabled (black)
│                 │ • Character count shown
└────────┬────────┘
         │ User clicks Enhance
         ▼
┌─────────────────┐
│   ENHANCING     │ Processing
│                 │ • Input area readonly
│                 │ • Loading message rotating
│                 │ • Cancel option available
└────────┬────────┘
         │ API returns (streaming)
         ▼
┌─────────────────┐
│   ENHANCED      │ Output displayed
│                 │ • Structured content shown
│                 │ • Inscript Context visible
│                 │ • Edit mode available
│                 │ • Re-enhance button shown
└────────┬────────┘
         │ User clicks Save
         ▼
┌─────────────────┐
│     SAVED       │ Complete
│                 │ • Success indicator (brief)
│                 │ • Background processing starts
│                 │ • Redirect to note view
└─────────────────┘
```

### Voice Recording Sub-Flow

```
┌─────────────────┐
│   MIC_IDLE      │ Default state
│                 │ • Gray mic icon
└────────┬────────┘
         │ User clicks mic
         ▼
┌─────────────────┐
│   RECORDING     │ Active recording
│                 │ • Black background
│                 │ • White mic icon
│                 │ • Pulse animation
│                 │ • Duration counter
│                 │ • "Recording..." label
└────────┬────────┘
         │ User clicks stop OR 2min limit
         ▼
┌─────────────────┐
│  TRANSCRIBING   │ Processing audio
│                 │ • Loading indicator
│                 │ • "Transcribing..." label
└────────┬────────┘
         │ Transcription returns
         ▼
┌─────────────────┐
│   COMPLETE      │ Text in textarea
│                 │ • Transcribed text appended
│                 │ • Mic returns to IDLE
│                 │ • User can edit or record more
└─────────────────┘
```

## 6.2 Note Enhancement Flow

### Mode Selection

```
User creates note
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│   [Reflect]  [Enhance]  [Meeting]                  │
│       ▲          │           │                      │
│       │          │           │                      │
│   Default for    │      Routes to                   │
│   personal       │      meeting flow                │
│                  ▼                                  │
│         Structures note                             │
│         based on content                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Content-Based Mode Suggestion

```javascript
// Pseudo-code for mode suggestion
function suggestMode(content) {
  const signals = analyzeContent(content);
  
  if (signals.hasMeetingIndicators) {
    // "met with", "call with", "1:1", attendee names
    return 'meeting';
  }
  
  if (signals.isWorkContent) {
    // Project names, technical terms, action-oriented
    return 'enhance';
  }
  
  if (signals.isEmotional) {
    // Feeling words, personal pronouns, introspection
    return 'reflect';
  }
  
  if (signals.isStructured) {
    // Already has bullets, clear organization
    return 'enhance';
  }
  
  return 'reflect'; // Default
}
```

## 6.3 Inscript Context Specification

### Context Components

```typescript
interface InscriptContext {
  attendeeContext: AttendeeContextItem[];
  patterns: PatternItem[];
  openLoops: OpenLoopItem[];
  relatedNotes: RelatedNoteItem[];
  insights: InsightItem[];
}

interface AttendeeContextItem {
  entityId: string;
  name: string;
  meetingCount: number;
  firstMeeting: string;      // "July 2025"
  lastMeeting: string;       // "3 days ago"
  recentTopics: string[];    // Last 3 meeting topics
}

interface PatternItem {
  type: 'recurring_topic' | 'behavioral' | 'emotional';
  description: string;       // "Mobile blocked — mentioned 4 of last 5 notes"
  frequency: string;         // "4 of last 5"
  firstOccurrence: string;
  severity: 'info' | 'warning';
}

interface OpenLoopItem {
  description: string;       // "Compensation discussion"
  firstMentioned: string;    // "December 15, 2025"
  mentionCount: number;      // 3
  status: 'unresolved' | 'recurring';
}

interface RelatedNoteItem {
  noteId: string;
  title: string;
  date: string;
  relevance: string;         // "Also discusses project delays"
  snippet: string;           // Brief excerpt
}

interface InsightItem {
  type: 'connection' | 'observation' | 'question';
  text: string;
}
```

### Context Display Format

```
─────────────────────────────────────────────────────────────
INSCRIPT CONTEXT
─────────────────────────────────────────────────────────────

ℹ️ 12th meeting with Sarah (first: July 2025)

⚠️ "Mobile blocked" — mentioned in 4 of last 5 notes
   First mentioned: January 3, 2026

⚠️ Compensation discussion — raised 3 times, never addressed
   You've wanted to discuss this since December

🔗 Related: "Project frustration" note from January 20
   Also discusses feeling stuck on deliverables

─────────────────────────────────────────────────────────────
```

### Icon Semantics

| Icon | Meaning | Use When |
|------|---------|----------|
| ℹ️ | Informational context | Neutral facts (meeting count, history) |
| ⚠️ | Pattern needing attention | Recurring issues, avoided topics, warnings |
| 🔗 | Connection to other note | Semantic link to related content |
| 💭 | Reflection prompt | Optional deeper question |

---

# 7. TECHNICAL ARCHITECTURE

## 7.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         ui.js (existing)                         │   │
│  │                              │                                   │   │
│  │    ┌─────────────┬──────────┼──────────┬─────────────┐          │   │
│  │    │             │          │          │             │          │   │
│  │    ▼             ▼          ▼          ▼             ▼          │   │
│  │ ┌───────┐  ┌──────────┐ ┌───────┐ ┌─────────┐ ┌──────────┐     │   │
│  │ │notes  │  │meeting   │ │voice  │ │enhance  │ │attendee  │     │   │
│  │ │capture│  │capture.js│ │input  │ │display  │ │suggest.js│     │   │
│  │ │.js    │  │  (new)   │ │.js    │ │.js (new)│ │  (new)   │     │   │
│  │ │(mod)  │  │          │ │(new)  │ │         │ │          │     │   │
│  │ └───────┘  └──────────┘ └───────┘ └─────────┘ └──────────┘     │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ fetch()                           │
│                                    ▼                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE RUNTIME                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              enhance-meeting.js (new) — CRITICAL PATH            │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐     │   │
│  │  │ 1. Parse request (raw input, attendees, userId)         │     │   │
│  │  │ 2. PARALLEL FETCH:                                       │     │   │
│  │  │    ├── getAttendeeEntities(attendees, userId)           │     │   │
│  │  │    ├── getMeetingHistory(attendees, userId)             │     │   │
│  │  │    ├── getRelevantPatterns(content, userId)             │     │   │
│  │  │    └── getRelatedNotes(content, userId)                 │     │   │
│  │  │ 3. Build enhancement prompt with context                 │     │   │
│  │  │ 4. Call Claude API (streaming)                           │     │   │
│  │  │ 5. Stream response to client                             │     │   │
│  │  │ 6. Return complete response                              │     │   │
│  │  └─────────────────────────────────────────────────────────┘     │   │
│  │                              │                                    │   │
│  │                              │ ctx.waitUntil()                   │   │
│  │                              ▼                                    │   │
│  │  ┌─────────────────────────────────────────────────────────┐     │   │
│  │  │              BACKGROUND PROCESSING                       │     │   │
│  │  │                                                          │     │   │
│  │  │  • extractEntities(enhancedContent)                     │     │   │
│  │  │  • generateEmbeddings(enhancedContent)                  │     │   │
│  │  │  • updateAttendeeRelationships(attendees, noteId)       │     │   │
│  │  │  • updateMeetingHistory(attendees, noteId, topics)      │     │   │
│  │  │  • feedPatternDetection(noteId)                         │     │   │
│  │  │                                                          │     │   │
│  │  └─────────────────────────────────────────────────────────┘     │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    transcribe-voice.js (new)                     │   │
│  │                                                                   │   │
│  │  1. Receive audio blob                                           │   │
│  │  2. Send to Whisper API                                          │   │
│  │  3. Return transcription                                         │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    enhance-note.js (new)                         │   │
│  │                                                                   │   │
│  │  Similar to enhance-meeting but with note-specific:              │   │
│  │  • Content type detection                                        │   │
│  │  • Reflection vs Enhancement mode                                │   │
│  │  • Different prompt structure                                    │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 inscript-context.js (new)                        │   │
│  │                                                                   │   │
│  │  Dedicated endpoint for fetching user context:                   │   │
│  │  • Attendee history                                              │   │
│  │  • Patterns                                                       │   │
│  │  • Open loops                                                     │   │
│  │  • Related notes                                                  │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │    notes      │  │ user_entities │  │   meeting_    │               │
│  │               │  │               │  │   history     │               │
│  │ • id          │  │ • id          │  │    (new)      │               │
│  │ • user_id     │  │ • user_id     │  │               │               │
│  │ • content     │  │ • name        │  │ • user_id     │               │
│  │ • enhanced    │  │ • type        │  │ • entity_id   │               │
│  │ • note_type   │  │ • embedding   │  │ • note_id     │               │
│  │ • meeting_    │  │ • importance  │  │ • meeting_at  │               │
│  │   metadata    │  │ • metadata    │  │ • topics      │               │
│  │ • raw_input   │  │               │  │               │               │
│  │ • created_at  │  │               │  │               │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │   entity_     │  │   category_   │  │   open_loops  │               │
│  │ relationships │  │   summaries   │  │    (new)      │               │
│  │               │  │               │  │               │               │
│  │ • entity1_id  │  │ • user_id     │  │ • user_id     │               │
│  │ • entity2_id  │  │ • category    │  │ • description │               │
│  │ • type        │  │ • summary     │  │ • first_noted │               │
│  │ • strength    │  │ • updated_at  │  │ • mention_ct  │               │
│  │               │  │               │  │ • status      │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL APIS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │   ANTHROPIC   │  │    OPENAI     │  │    OPENAI     │               │
│  │    Claude     │  │    Whisper    │  │   Embeddings  │               │
│  │               │  │               │  │               │               │
│  │ Enhancement   │  │ Voice → Text  │  │ Semantic      │               │
│  │ Reflection    │  │               │  │ Search        │               │
│  │ Context Gen   │  │               │  │               │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Critical Path Optimization

**Target: < 3 seconds from click to output**

```
Timeline (milliseconds):
─────────────────────────────────────────────────────────────────────────

0ms      User clicks "Enhance"
         │
         ▼
10ms     Request sent to Edge Runtime
         │
         ├──── [PARALLEL: 100-300ms] ────┐
         │                               │
         │     Fetch attendee entities   │
         │     Fetch meeting history     │
         │     Fetch patterns            │
         │     Fetch related notes       │
         │                               │
         ◄───────────────────────────────┘
         │
300ms    Context assembled
         │
         ▼
350ms    Prompt built
         │
         ▼
400ms    Claude API called (streaming)
         │
         ├──── [STREAMING: 1500-2500ms] ──┐
         │                                │
         │     First tokens arrive        │ → 600ms: UI starts showing output
         │     Content streams            │
         │     Inscript Context streams   │
         │                                │
         ◄────────────────────────────────┘
         │
2800ms   Response complete
         │
         ▼
2850ms   UI fully rendered ✓

         ════════════════════════════════════════════════════════════════
         
         [BACKGROUND — ctx.waitUntil()]
         
2900ms   Entity extraction starts
         │
4000ms   Embeddings generated
         │
6000ms   Relationships updated
         │
10000ms  Pattern detection fed
         │
15000ms  All background tasks complete

─────────────────────────────────────────────────────────────────────────
```

## 7.3 Streaming Implementation

```javascript
// api/enhance-meeting.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { rawInput, attendees, title, userId } = await req.json();
  
  // Parallel context fetch (non-blocking)
  const contextPromise = fetchInscriptContext(attendees, rawInput, userId);
  
  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Start response immediately
  const response = new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
  
  // Process in background
  (async () => {
    try {
      // Wait for context (should be fast due to parallel fetch)
      const context = await contextPromise;
      
      // Build prompt
      const prompt = buildEnhancementPrompt(rawInput, attendees, title, context);
      
      // Stream from Claude
      const claudeStream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      
      // Pipe Claude stream to response
      for await (const chunk of claudeStream) {
        if (chunk.type === 'content_block_delta') {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify(chunk.delta)}\n\n`)
          );
        }
      }
      
      // Send completion signal
      await writer.write(encoder.encode('data: [DONE]\n\n'));
      
    } catch (error) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
      );
    } finally {
      await writer.close();
    }
    
    // Background processing (non-blocking)
    ctx.waitUntil(processBackground(rawInput, attendees, userId));
  })();
  
  return response;
}
```

---

# 8. UI/UX DESIGN SYSTEM

## 8.1 Meeting Capture Screen

### Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ← Back                                          new meeting            │
│                                                  (13px, gray-400)       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  meeting title (optional)                                        │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  (18px, gray-400 placeholder, no border until focus)            │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                         space-6 (24px)                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  who was there?                                                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  (15px, gray-400 placeholder)                                   │   │
│  │                                                                  │   │
│  │  [Auto-suggest dropdown appears on typing]                      │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                         space-6 (24px)                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  what happened? type freely or use voice...                     │   │
│  │                                                                  │   │
│  │  (15px, gray-400 placeholder, italic)                           │   │
│  │                                                                  │   │
│  │                                                                  │   │
│  │                                                                  │   │
│  │                                                                  │   │
│  │                                                                  │   │
│  │                                                                  │   │
│  │                                                       ┌──────┐  │   │
│  │                                                       │  🎤  │  │   │
│  │                                                       └──────┘  │   │
│  │                                                       (44x44px) │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  (border: 1px solid gray-200, min-height: 200px)                       │
│                                                                         │
│                                         space-6 (24px)                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │                        ENHANCE NOTES                             │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  (background: black, color: white, full width, 13px uppercase)         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component CSS Specifications

```css
/* Meeting Capture Container */
.meeting-capture {
  max-width: 680px;
  margin: 0 auto;
  padding: var(--space-6);
}

/* Title Input */
.meeting-title-input {
  width: 100%;
  font-size: 18px;
  font-weight: 500;
  color: var(--color-gray-900);
  border: none;
  border-bottom: 1px solid transparent;
  padding: 0 0 var(--space-2) 0;
  background: transparent;
  transition: border-color 200ms ease;
}

.meeting-title-input:focus {
  outline: none;
  border-bottom-color: var(--color-black);
}

.meeting-title-input::placeholder {
  color: var(--color-gray-400);
  font-weight: 400;
}

/* Attendees Input */
.meeting-attendees-input {
  width: 100%;
  font-size: 15px;
  color: var(--color-gray-900);
  border: none;
  border-bottom: 1px solid var(--color-gray-200);
  padding: var(--space-3) 0;
  background: transparent;
}

.meeting-attendees-input:focus {
  outline: none;
  border-bottom-color: var(--color-black);
}

/* Main Text Area */
.meeting-content-area {
  position: relative;
  width: 100%;
  min-height: 200px;
  border: 1px solid var(--color-gray-200);
  border-radius: 2px;
  transition: border-color 200ms ease;
}

.meeting-content-area:focus-within {
  border-color: var(--color-black);
}

.meeting-content-textarea {
  width: 100%;
  min-height: 200px;
  padding: var(--space-4);
  padding-right: 60px; /* Space for mic button */
  font-size: 15px;
  font-family: var(--font-primary);
  line-height: 1.6;
  color: var(--color-gray-900);
  border: none;
  resize: vertical;
  background: transparent;
}

.meeting-content-textarea:focus {
  outline: none;
}

.meeting-content-textarea::placeholder {
  color: var(--color-gray-400);
  font-style: italic;
}

/* Voice Button */
.voice-button {
  position: absolute;
  bottom: var(--space-3);
  right: var(--space-3);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-gray-200);
  background: var(--color-white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms ease;
}

.voice-button:hover {
  border-color: var(--color-black);
}

.voice-button.recording {
  background: var(--color-black);
  border-color: var(--color-black);
  animation: pulse 1.5s ease-in-out infinite;
}

.voice-button.recording svg {
  color: var(--color-white);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Enhance Button */
.enhance-button {
  width: 100%;
  padding: var(--space-4) var(--space-6);
  background: var(--color-black);
  color: var(--color-white);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: opacity 200ms ease;
}

.enhance-button:hover {
  opacity: 0.85;
}

.enhance-button:disabled {
  background: var(--color-gray-200);
  color: var(--color-gray-400);
  cursor: not-allowed;
}
```

## 8.2 Enhanced Output Display

### Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  1:1 with Sarah                                        ✨ enhanced      │
│  (18px, weight 500)                                   (13px, gray-400)  │
│                                                                         │
│  January 25, 2026                                                       │
│  (13px, gray-500)                                                       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DISCUSSED                                                              │
│  (11px, gray-600, uppercase, letter-spacing 0.1em)                     │
│                                                                         │
│  • Q2 roadmap planning                                                  │
│  • Budget pressure — stress on her side                                │
│  • Mobile project still blocked                                        │
│  (15px, gray-600 for AI-generated, black for user-written)            │
│                                                                         │
│                                         space-6 (24px)                  │
│                                                                         │
│  ACTION ITEMS                                                           │
│                                                                         │
│  → Schedule engineering sync for mobile unblock                        │
│  (15px, gray-600)                                                       │
│                                                                         │
│                                         space-6 (24px)                  │
│                                                                         │
│  NOTED                                                                  │
│                                                                         │
│  ⚠️ Compensation discussion — not raised again                         │
│  (15px, gray-600)                                                       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  (1px border-top, gray-200)                                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  INSCRIPT CONTEXT                                               │   │
│  │  (11px, gray-500, uppercase)                                    │   │
│  │                                                                  │   │
│  │  ℹ️ 12th meeting with Sarah (first: July 2025)                  │   │
│  │                                                                  │   │
│  │  ⚠️ "Mobile blocked" — mentioned in 4 of last 5 notes           │   │
│  │     First mentioned: January 3, 2026                            │   │
│  │                                                                  │   │
│  │  ⚠️ Compensation discussion — raised 3 times, never addressed   │   │
│  │     You've wanted to discuss this since December                │   │
│  │                                                                  │   │
│  │  🔗 Related: "Project frustration" note from January 20         │   │
│  │     Also discusses feeling stuck on deliverables                │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  (background: gray-50, border-left: 2px solid silver, padding: 20px)   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐              ┌─────────────────┐                  │
│  │   Try Again     │              │      Save       │                  │
│  └─────────────────┘              └─────────────────┘                  │
│  (ghost button)                   (primary button)                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component CSS Specifications

```css
/* Enhanced Output Container */
.enhanced-output {
  max-width: 680px;
  margin: 0 auto;
  padding: var(--space-6);
}

/* Header */
.enhanced-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2);
}

.enhanced-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-gray-900);
}

.enhanced-badge {
  font-size: 13px;
  color: var(--color-gray-400);
}

.enhanced-date {
  font-size: 13px;
  color: var(--color-gray-500);
  margin-bottom: var(--space-6);
}

/* Sections */
.enhanced-section {
  margin-bottom: var(--space-6);
}

.enhanced-section-header {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-gray-600);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}

.enhanced-section-content {
  font-size: 15px;
  line-height: 1.6;
}

/* Content distinction */
.content-user {
  color: var(--color-black);
}

.content-ai {
  color: var(--color-gray-600);
}

/* List items */
.enhanced-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.enhanced-list-item {
  padding-left: var(--space-4);
  margin-bottom: var(--space-2);
  position: relative;
}

.enhanced-list-item::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--color-gray-400);
}

.enhanced-list-item.action::before {
  content: "→";
}

.enhanced-list-item.warning::before {
  content: "⚠️";
}

/* Inscript Context */
.inscript-context {
  background: var(--color-gray-50);
  border-left: 2px solid var(--color-silver);
  padding: var(--space-6);
  margin-top: var(--space-8);
}

.inscript-context-header {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-gray-500);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: var(--space-4);
}

.inscript-context-item {
  margin-bottom: var(--space-4);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-gray-700);
}

.inscript-context-item .icon {
  margin-right: var(--space-2);
}

.inscript-context-item .subtext {
  display: block;
  font-size: 13px;
  color: var(--color-gray-500);
  margin-top: var(--space-1);
  padding-left: calc(1em + var(--space-2));
}

.inscript-context-link {
  color: var(--color-gray-700);
  text-decoration: underline;
  text-decoration-color: var(--color-gray-300);
  cursor: pointer;
}

.inscript-context-link:hover {
  text-decoration-color: var(--color-gray-700);
}

/* Action Buttons */
.enhanced-actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-gray-200);
}

.btn-ghost {
  flex: 1;
  padding: var(--space-3) var(--space-6);
  background: transparent;
  color: var(--color-black);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--color-gray-300);
  border-radius: 0;
  cursor: pointer;
  transition: border-color 200ms ease;
}

.btn-ghost:hover {
  border-color: var(--color-black);
}

.btn-primary {
  flex: 1;
  padding: var(--space-3) var(--space-6);
  background: var(--color-black);
  color: var(--color-white);
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: opacity 200ms ease;
}

.btn-primary:hover {
  opacity: 0.85;
}
```

## 8.3 Loading States

### Contextual Loading Messages

```javascript
const meetingLoadingMessages = [
  "weaving your thoughts together...",
  "finding the threads...",
  "structuring the conversation...",
  "connecting to your history...",
  "enhancing with context...",
  "organizing the chaos...",
  "turning fragments into form...",
  "reading between your lines...",
  "gathering what matters...",
  "building the picture...",
];

const noteLoadingMessages = [
  "listening to your thoughts...",
  "finding the meaning...",
  "connecting the dots...",
  "reflecting on your words...",
  "understanding the context...",
  "weaving your narrative...",
  "discovering patterns...",
  "building understanding...",
];
```

### Loading Display CSS

```css
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: var(--space-8);
}

.loading-message {
  font-family: var(--font-editorial);
  font-size: 15px;
  font-style: italic;
  color: var(--color-gray-500);
  text-align: center;
  animation: fadeInOut 3s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

## 8.4 Mobile Adaptations

```css
@media (max-width: 640px) {
  .meeting-capture,
  .enhanced-output {
    padding: var(--space-4);
  }
  
  .meeting-title-input {
    font-size: 16px; /* Prevent iOS zoom */
  }
  
  .meeting-content-textarea {
    min-height: 160px;
    font-size: 16px; /* Prevent iOS zoom */
  }
  
  .voice-button {
    width: 48px;
    height: 48px;
  }
  
  .enhanced-actions {
    flex-direction: column;
  }
  
  .btn-ghost,
  .btn-primary {
    width: 100%;
  }
}
```

---

# 9. API SPECIFICATIONS

## 9.1 POST /api/enhance-meeting

### Request

```typescript
interface EnhanceMeetingRequest {
  rawInput: string;           // User's messy input (required)
  title?: string;             // Optional title
  attendees?: string[];       // Optional attendee names
  userId: string;             // From auth (required)
}
```

### Response (Streaming SSE)

```typescript
// Stream format: Server-Sent Events
// data: {"type": "content", "text": "..."}
// data: {"type": "context", "item": {...}}
// data: {"type": "done", "noteId": "..."}

interface EnhanceMeetingResponse {
  type: 'content' | 'context' | 'metadata' | 'done' | 'error';
  
  // For type: 'content'
  text?: string;              // Streaming text chunk
  
  // For type: 'context'
  item?: InscriptContextItem;
  
  // For type: 'metadata'
  metadata?: {
    title: string;
    date: string;
    attendeeEntities: AttendeeEntity[];
  };
  
  // For type: 'done'
  noteId?: string;
  processingTime?: number;
  
  // For type: 'error'
  error?: {
    code: string;
    message: string;
  };
}
```

### Example Request

```bash
POST /api/enhance-meeting
Content-Type: application/json
Authorization: Bearer <token>

{
  "rawInput": "sarah 1:1, talked roadmap, q2 budget stress, mobile still blocked, need eng sync, forgot comp again",
  "title": "",
  "attendees": ["Sarah"],
  "userId": "user-uuid-123"
}
```

### Example Streaming Response

```
data: {"type":"metadata","metadata":{"title":"1:1 with Sarah","date":"2026-01-25","attendeeEntities":[{"id":"entity-123","name":"Sarah Chen","meetingCount":12}]}}

data: {"type":"content","text":"## DISCUSSED\n\n"}
data: {"type":"content","text":"• Q2 roadmap planning\n"}
data: {"type":"content","text":"• Budget pressure — stress on her side\n"}
data: {"type":"content","text":"• Mobile project still blocked\n\n"}
data: {"type":"content","text":"## ACTION ITEMS\n\n"}
data: {"type":"content","text":"→ Schedule engineering sync for mobile unblock\n\n"}
data: {"type":"content","text":"## NOTED\n\n"}
data: {"type":"content","text":"⚠️ Compensation discussion — not raised again\n"}

data: {"type":"context","item":{"type":"info","icon":"ℹ️","text":"12th meeting with Sarah (first: July 2025)"}}
data: {"type":"context","item":{"type":"warning","icon":"⚠️","text":"\"Mobile blocked\" — mentioned in 4 of last 5 notes","subtext":"First mentioned: January 3, 2026"}}
data: {"type":"context","item":{"type":"warning","icon":"⚠️","text":"Compensation discussion — raised 3 times, never addressed","subtext":"You've wanted to discuss this since December"}}
data: {"type":"context","item":{"type":"link","icon":"🔗","text":"Related: \"Project frustration\" note from January 20","subtext":"Also discusses feeling stuck on deliverables","noteId":"note-456"}}

data: {"type":"done","noteId":"note-789","processingTime":2340}
```

## 9.2 POST /api/transcribe-voice

### Request

```
POST /api/transcribe-voice
Content-Type: multipart/form-data

audio: <binary audio data>
userId: string
```

### Response

```typescript
interface TranscribeResponse {
  success: boolean;
  text: string;
  duration: number;      // Audio duration in seconds
  processingTime: number; // API time in ms
}
```

## 9.3 POST /api/enhance-note

### Request

```typescript
interface EnhanceNoteRequest {
  content: string;           // Note content (required)
  mode: 'enhance' | 'reflect' | 'auto';  // Processing mode
  userId: string;            // From auth (required)
}
```

### Response

Same streaming format as enhance-meeting, with note-appropriate sections.

## 9.4 GET /api/inscript-context

### Request

```
GET /api/inscript-context?attendees=Sarah,Marcus&content=...&userId=...
```

### Response

```typescript
interface InscriptContextResponse {
  attendeeContext: AttendeeContextItem[];
  patterns: PatternItem[];
  openLoops: OpenLoopItem[];
  relatedNotes: RelatedNoteItem[];
  processingTime: number;
}
```

---

# 10. ENHANCEMENT PROMPTS

## 10.1 Meeting Enhancement Prompt

```markdown
# MEETING ENHANCEMENT PROMPT v1.0

You are an AI assistant that transforms raw, unstructured meeting notes into clean, professional meeting minutes. You also have access to the user's Inscript memory system, which provides context about their relationships, patterns, and history.

## YOUR TASK

Transform the raw notes into structured meeting minutes while:
1. Preserving all factual information exactly as provided
2. Organizing into clear, scannable sections
3. Fixing typos and expanding abbreviations
4. NEVER inventing information not present in the input

## INPUT PROVIDED

### Raw Notes
{raw_input}

### Meeting Context
- Title: {title}
- Attendees: {attendees}
- Date: {date}

### User's Inscript Context
{inscript_context}

## OUTPUT FORMAT

Generate the meeting minutes using this structure:

### DISCUSSED
- Bullet points of topics covered
- Each point should be clear and concise
- Preserve specific details, quotes, and numbers exactly

### DECISIONS (only if decisions were mentioned)
- Any decisions that were made
- Skip this section entirely if no decisions in input

### ACTION ITEMS (only if actions were mentioned)
- Format: → [Action description]
- Include owner if mentioned
- Skip this section entirely if no actions in input

### FOLLOW-UPS (only if future items mentioned)
- Things to discuss or do later
- Skip this section entirely if none

### NOTED (only if important observations exist)
- Use ⚠️ prefix for warnings or concerns
- Important observations the user flagged
- Skip this section entirely if none

## QUALITY RULES

1. **Accuracy**: Never add information not in the raw notes
2. **Preservation**: Keep exact quotes in "quotation marks"
3. **Numbers**: Preserve all numbers and figures exactly
4. **Names**: Keep names exactly as written
5. **Abbreviations**: Expand common ones (q2→Q2, eng→engineering, mtg→meeting)
6. **Typos**: Fix obvious spelling errors
7. **Scannability**: Use bullets, not paragraphs
8. **Conciseness**: Be clear and direct, not verbose

## EXAMPLES

### Example Input:
"talked q2 roadmap, sarah stressed about budget cuts, mobile proj still blocked 3 weeks now, need 2 sync w/ eng team asap, forgot 2 bring up comp again"

### Example Output:
## DISCUSSED

• Q2 roadmap planning
• Budget cuts — Sarah expressed stress about impact
• Mobile project blocked for 3 weeks

## ACTION ITEMS

→ Schedule sync with engineering team (urgent)

## NOTED

⚠️ Compensation discussion — not raised again

---

Now transform the provided raw notes into meeting minutes following this format exactly.
```

## 10.2 Note Enhancement Prompt

```markdown
# NOTE ENHANCEMENT PROMPT v1.0

You are an AI assistant that helps users organize their personal notes while preserving their voice and intent. You enhance structure without changing meaning.

## YOUR TASK

Structure the raw note content based on detected type while:
1. Preserving the user's voice and emotional tone
2. Adding organizational structure where helpful
3. NOT over-processing emotional or personal content
4. Connecting to user's Inscript context when relevant

## CONTENT TYPE DETECTION

Analyze the content and identify the primary type:
- **journal**: Personal reflection, daily events, emotional processing
- **idea**: Creative thought, concept exploration, brainstorming
- **observation**: Something noticed, insight about world/others
- **plan**: Goals, steps, project thinking
- **work**: Professional content, project updates, meeting-like
- **vent**: Emotional release, frustration, processing difficulty

## ENHANCEMENT APPROACH BY TYPE

### For journal/personal:
- Light touch — preserve raw feeling
- Organize chronologically if multiple events
- Don't add headers unless content is long
- Keep emotional language intact

### For idea:
- Structure: Core idea → Implications → Questions → Next steps
- Help clarify without changing the idea
- Surface connections to other ideas in context

### For observation:
- Structure: What happened → What it means → Connections
- Keep the user's interpretation central

### For plan:
- Structure: Goal → Steps → Dependencies → Timeline
- Make actionable items clear
- Flag anything unclear or missing

### For work:
- Similar to meeting enhancement
- Professional, scannable structure
- Action items clearly marked

### For vent/emotional:
- MINIMAL processing
- Preserve raw feeling
- Maybe add gentle reflection prompt at end
- DO NOT rationalize or minimize emotions

## INPUT PROVIDED

### Raw Note
{content}

### Detected Type
{detected_type}

### User's Inscript Context
{inscript_context}

## OUTPUT

Generate the enhanced note appropriate to the content type, then add Inscript Context section if relevant connections exist.
```

## 10.3 Inscript Context Generation Prompt

```markdown
# INSCRIPT CONTEXT GENERATION PROMPT v1.0

You are generating the Inscript Context section for a user's note or meeting. This section surfaces relevant information from the user's accumulated memory that adds value to the current content.

## YOUR TASK

Review the current content and user's memory context, then generate 3-5 relevant context items that:
1. Add genuine value (not just filler)
2. Surface patterns the user might not notice
3. Connect to other relevant content
4. Identify open loops or recurring themes

## INPUT PROVIDED

### Current Content
{content}

### Attendees (if meeting)
{attendees}

### User's Memory Context
{memory_context}

## OUTPUT FORMAT

Generate context items using these types:

### ℹ️ Info Items
- Factual context: meeting counts, relationship history, first mentions
- Example: "ℹ️ 12th meeting with Sarah (first: July 2025)"

### ⚠️ Warning Items  
- Patterns needing attention: recurring issues, avoided topics, concerning trends
- Include subtext with timeline/frequency
- Example: "⚠️ 'Mobile blocked' — mentioned in 4 of last 5 notes"
  - Subtext: "First mentioned: January 3, 2026"

### 🔗 Link Items
- Connections to other notes: related topics, similar situations, relevant history
- Include subtext explaining relevance
- Example: "🔗 Related: 'Project frustration' note from January 20"
  - Subtext: "Also discusses feeling stuck on deliverables"

## RULES

1. Only include items with genuine relevance (no filler)
2. Maximum 5 items (prefer 3-4 high-quality ones)
3. Prioritize: warnings > links > info
4. If no relevant context exists, return empty (don't force it)
5. Be specific, not generic
6. Subtext should add value, not repeat

## OUTPUT JSON FORMAT

[
  {
    "type": "info|warning|link",
    "icon": "ℹ️|⚠️|🔗",
    "text": "Main text",
    "subtext": "Optional additional context",
    "noteId": "optional-note-uuid-for-links"
  }
]
```

---

# 11. DATABASE SCHEMA

## 11.1 Schema Changes

### Modify: notes table

```sql
-- Add columns for enhancement support
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'note',
ADD COLUMN IF NOT EXISTS raw_input TEXT,
ADD COLUMN IF NOT EXISTS enhanced_content TEXT,
ADD COLUMN IF NOT EXISTS enhancement_metadata JSONB,
ADD COLUMN IF NOT EXISTS meeting_metadata JSONB;

-- note_type values: 'note', 'meeting', 'reflection'

-- enhancement_metadata structure:
-- {
--   "enhanced": true,
--   "enhancedAt": "2026-01-25T10:30:00Z",
--   "mode": "meeting|note|reflect",
--   "promptVersion": "1.0"
-- }

-- meeting_metadata structure:
-- {
--   "title": "1:1 with Sarah",
--   "attendees": ["entity-uuid-1", "entity-uuid-2"],
--   "attendeeNames": ["Sarah Chen", "Marcus Wong"],
--   "topics": ["roadmap", "budget", "mobile project"],
--   "meetingDate": "2026-01-25"
-- }

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_user_type ON notes(user_id, note_type);
```

### New: meeting_history table

```sql
CREATE TABLE IF NOT EXISTS meeting_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  meeting_date TIMESTAMPTZ NOT NULL,
  topics TEXT[] DEFAULT '{}',
  sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative', 'mixed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, entity_id, note_id)
);

CREATE INDEX idx_meeting_history_user_entity 
ON meeting_history(user_id, entity_id);

CREATE INDEX idx_meeting_history_user_date 
ON meeting_history(user_id, meeting_date DESC);

CREATE INDEX idx_meeting_history_entity_date 
ON meeting_history(entity_id, meeting_date DESC);
```

### New: open_loops table

```sql
CREATE TABLE IF NOT EXISTS open_loops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  first_noted_at TIMESTAMPTZ NOT NULL,
  first_note_id UUID REFERENCES notes(id),
  mention_count INTEGER DEFAULT 1,
  last_mentioned_at TIMESTAMPTZ NOT NULL,
  last_note_id UUID REFERENCES notes(id),
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'resolved', 'recurring'
  related_entities UUID[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_open_loops_user_status 
ON open_loops(user_id, status);

CREATE INDEX idx_open_loops_keywords 
ON open_loops USING GIN(keywords);
```

## 11.2 Database Functions

### Get Meeting Count with Entity

```sql
CREATE OR REPLACE FUNCTION get_meeting_count(
  p_user_id UUID,
  p_entity_id UUID
) RETURNS TABLE (
  meeting_count BIGINT,
  first_meeting TIMESTAMPTZ,
  last_meeting TIMESTAMPTZ,
  recent_topics TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as meeting_count,
    MIN(meeting_date) as first_meeting,
    MAX(meeting_date) as last_meeting,
    ARRAY(
      SELECT DISTINCT unnest(mh.topics)
      FROM meeting_history mh
      WHERE mh.user_id = p_user_id 
        AND mh.entity_id = p_entity_id
      ORDER BY 1
      LIMIT 10
    ) as recent_topics
  FROM meeting_history
  WHERE user_id = p_user_id 
    AND entity_id = p_entity_id;
END;
$$ LANGUAGE plpgsql;
```

### Find Open Loops for Content

```sql
CREATE OR REPLACE FUNCTION find_relevant_open_loops(
  p_user_id UUID,
  p_content TEXT,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  id UUID,
  description TEXT,
  first_noted_at TIMESTAMPTZ,
  mention_count INTEGER,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ol.id,
    ol.description,
    ol.first_noted_at,
    ol.mention_count,
    -- Simple keyword matching for relevance
    (
      SELECT COUNT(*)::FLOAT / ARRAY_LENGTH(ol.keywords, 1)
      FROM unnest(ol.keywords) kw
      WHERE p_content ILIKE '%' || kw || '%'
    ) as relevance_score
  FROM open_loops ol
  WHERE ol.user_id = p_user_id
    AND ol.status = 'open'
    AND EXISTS (
      SELECT 1 FROM unnest(ol.keywords) kw
      WHERE p_content ILIKE '%' || kw || '%'
    )
  ORDER BY relevance_score DESC, ol.mention_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

# 12. IMPLEMENTATION ROADMAP

## 12.1 Phase 1: Core Meeting Enhancement (Weeks 1-3)

### Week 1: Foundation

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1 | Create meeting capture UI component | `js/meeting-capture.js` | FE |
| 1 | Set up enhancement API endpoint shell | `api/enhance-meeting.js` | BE |
| 2 | Implement UI state machine (empty→capturing→enhancing→enhanced) | `js/meeting-capture.js` | FE |
| 2 | Write enhancement prompt v1.0 | `prompts/meeting-enhance.txt` | BE |
| 3 | Connect UI to API with streaming | `js/meeting-capture.js` | FE |
| 3 | Implement Claude streaming response | `api/enhance-meeting.js` | BE |
| 4 | Build enhanced output display component | `js/enhance-display.js` | FE |
| 4 | Add loading states with contextual messages | `js/loading-messages.js` | FE |
| 5 | Integration testing, bug fixes | All | All |

**Week 1 Deliverables:**
- [ ] Meeting capture UI (text only, no voice yet)
- [ ] Enhancement API returning structured output
- [ ] Streaming display of enhanced content
- [ ] Loading states with rotating messages

### Week 2: Voice & Polish

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1 | Implement browser audio recording | `js/voice-input.js` | FE |
| 1 | Create transcription API endpoint | `api/transcribe-voice.js` | BE |
| 2 | Build voice button UI with states | `js/voice-input.js` | FE |
| 2 | Integrate Whisper API | `api/transcribe-voice.js` | BE |
| 3 | Connect voice → textarea → enhance flow | `js/meeting-capture.js` | FE |
| 3 | Add error handling for voice failures | `js/voice-input.js` | FE |
| 4 | Pixel-perfect styling per design spec | CSS | FE |
| 4 | Mobile responsive testing and fixes | CSS | FE |
| 5 | Performance optimization, latency testing | All | BE |

**Week 2 Deliverables:**
- [ ] Voice recording and transcription working
- [ ] Voice button with clear recording state
- [ ] Full voice → enhance flow
- [ ] Pixel-perfect UI matching spec
- [ ] Mobile responsive

### Week 3: Inscript Context & Memory

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1 | Database schema changes | SQL migrations | BE |
| 1 | Implement Inscript Context fetch | `api/inscript-context.js` | BE |
| 2 | Add context to enhancement prompt | `api/enhance-meeting.js` | BE |
| 2 | Build Inscript Context display UI | `js/enhance-display.js` | FE |
| 3 | Implement background entity extraction | `api/enhance-meeting.js` | BE |
| 3 | Add meeting history tracking | `api/enhance-meeting.js` | BE |
| 4 | Implement attendee auto-suggest | `js/attendee-suggest.js` | FE |
| 4 | Connect to existing entity system | `js/entities.js` | BE |
| 5 | End-to-end testing, bug fixes | All | All |

**Week 3 Deliverables:**
- [ ] Inscript Context section generating and displaying
- [ ] Attendee auto-suggest from known entities
- [ ] Background entity extraction working
- [ ] Meeting history table populating
- [ ] Full integration with existing memory system

## 12.2 Phase 2: Note Enhancement (Weeks 4-5)

### Week 4: Note Enhancement Mode

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1 | Add "Enhance" mode to note creation | `js/notes-capture.js` | FE |
| 2 | Create note enhancement API | `api/enhance-note.js` | BE |
| 3 | Write note enhancement prompt | `prompts/note-enhance.txt` | BE |
| 4 | Implement content type detection | `api/enhance-note.js` | BE |
| 5 | Add mode toggle UI (Reflect / Enhance) | `js/notes-capture.js` | FE |

### Week 5: Smart Defaults & Polish

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1 | Implement intelligent mode suggestion | `js/notes-capture.js` | FE |
| 2 | Add Inscript Context to note enhancement | `api/enhance-note.js` | BE |
| 3 | UI polish and consistency | CSS | FE |
| 4 | Comprehensive testing | All | QA |
| 5 | Bug fixes, performance tuning | All | All |

**Phase 2 Deliverables:**
- [ ] Note enhancement mode working
- [ ] Content type detection
- [ ] Smart mode defaults
- [ ] Inscript Context in notes
- [ ] Seamless reflect ↔ enhance switching

## 12.3 Phase 3: Advanced Features (Weeks 6-8)

### Week 6: Open Loop Tracking

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1-2 | Implement open loop detection | `api/open-loops.js` | BE |
| 3-4 | Surface open loops in Inscript Context | `api/inscript-context.js` | BE |
| 5 | UI for open loop display | `js/enhance-display.js` | FE |

### Week 7: Related Notes & Patterns

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1-2 | Implement semantic note search | `api/related-notes.js` | BE |
| 3-4 | Connect patterns to Inscript Context | `api/inscript-context.js` | BE |
| 5 | UI for related note links | `js/enhance-display.js` | FE |

### Week 8: Polish & Optimization

| Day | Tasks | Files | Owner |
|-----|-------|-------|-------|
| 1-2 | Performance optimization | All | BE |
| 3-4 | Edge cases and error handling | All | All |
| 5 | Final QA and documentation | All | All |

**Phase 3 Deliverables:**
- [ ] Open loop detection and tracking
- [ ] Related notes in Inscript Context
- [ ] Pattern integration
- [ ] Optimized performance
- [ ] Production ready

## 12.4 Milestone Summary

| Milestone | Week | Key Deliverable |
|-----------|------|-----------------|
| **M1: Basic Enhancement** | 1 | Text input → structured output |
| **M2: Voice Capture** | 2 | Voice → text → enhance flow |
| **M3: Inscript Context** | 3 | Memory-powered context section |
| **M4: Note Enhancement** | 5 | Enhancement mode for all notes |
| **M5: Advanced Context** | 8 | Open loops, related notes, patterns |

---

# 13. TESTING & QUALITY

## 13.1 Unit Tests

### Enhancement API Tests

```javascript
// tests/enhance-meeting.test.js

describe('Meeting Enhancement API', () => {
  describe('Input Processing', () => {
    test('handles empty input gracefully', async () => {
      const response = await enhanceMeeting({ rawInput: '', userId: testUser });
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe('EMPTY_INPUT');
    });

    test('processes minimal valid input', async () => {
      const response = await enhanceMeeting({ 
        rawInput: 'talked about project',
        userId: testUser 
      });
      expect(response.success).toBe(true);
      expect(response.enhanced).toBeDefined();
    });

    test('handles very long input', async () => {
      const longInput = 'meeting notes '.repeat(1000);
      const response = await enhanceMeeting({ rawInput: longInput, userId: testUser });
      expect(response.success).toBe(true);
    });
  });

  describe('Output Quality', () => {
    test('preserves exact quotes', async () => {
      const response = await enhanceMeeting({
        rawInput: 'she said "we need to ship by Friday"',
        userId: testUser
      });
      expect(response.enhanced.content).toContain('"we need to ship by Friday"');
    });

    test('preserves exact numbers', async () => {
      const response = await enhanceMeeting({
        rawInput: 'budget is $47,500 for q2',
        userId: testUser
      });
      expect(response.enhanced.content).toContain('$47,500');
    });

    test('expands common abbreviations', async () => {
      const response = await enhanceMeeting({
        rawInput: 'need 2 sync w/ eng team re: q2 roadmap',
        userId: testUser
      });
      expect(response.enhanced.content).toContain('Q2');
      expect(response.enhanced.content).not.toContain('w/');
    });

    test('does not invent information', async () => {
      const response = await enhanceMeeting({
        rawInput: 'discussed the project timeline',
        userId: testUser
      });
      // Should not contain specifics not in input
      expect(response.enhanced.content).not.toMatch(/\$\d+/);
      expect(response.enhanced.content).not.toMatch(/\d+ weeks/);
    });
  });

  describe('Performance', () => {
    test('completes within 3 seconds (p95)', async () => {
      const times = [];
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await enhanceMeeting({ rawInput: generateSampleInput(), userId: testUser });
        times.push(Date.now() - start);
      }
      const p95 = percentile(times, 95);
      expect(p95).toBeLessThan(3000);
    });
  });

  describe('Inscript Context', () => {
    test('includes meeting count for known attendees', async () => {
      // Setup: Create previous meetings with Sarah
      await createMeetingHistory(testUser, sarahEntityId, 5);
      
      const response = await enhanceMeeting({
        rawInput: 'met with sarah about roadmap',
        attendees: ['Sarah'],
        userId: testUser
      });
      
      const context = response.enhanced.inscriptContext;
      expect(context.some(item => 
        item.text.includes('meeting with Sarah')
      )).toBe(true);
    });

    test('surfaces relevant patterns', async () => {
      // Setup: Create pattern about mobile project
      await createPattern(testUser, 'mobile project blocked', 4);
      
      const response = await enhanceMeeting({
        rawInput: 'mobile project still blocked',
        userId: testUser
      });
      
      const context = response.enhanced.inscriptContext;
      expect(context.some(item => 
        item.type === 'warning' && item.text.includes('mobile')
      )).toBe(true);
    });
  });
});
```

### Voice Transcription Tests

```javascript
// tests/transcribe-voice.test.js

describe('Voice Transcription API', () => {
  test('transcribes clear audio accurately', async () => {
    const audio = await loadTestAudio('clear-speech.webm');
    const response = await transcribeVoice(audio, testUser);
    expect(response.success).toBe(true);
    expect(response.text.length).toBeGreaterThan(0);
  });

  test('handles silent audio', async () => {
    const audio = await loadTestAudio('silence.webm');
    const response = await transcribeVoice(audio, testUser);
    expect(response.success).toBe(true);
    expect(response.text).toBe('');
  });

  test('completes within 5 seconds for 60s audio', async () => {
    const audio = await loadTestAudio('60-seconds.webm');
    const start = Date.now();
    await transcribeVoice(audio, testUser);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
```

## 13.2 Integration Tests

```javascript
// tests/integration/meeting-flow.test.js

describe('Meeting Enhancement E2E', () => {
  test('complete flow: input → enhance → save → verify', async () => {
    // 1. Create meeting capture
    const captureResponse = await createMeetingCapture({
      rawInput: 'sarah 1:1, discussed q2 roadmap, budget concerns, mobile blocked',
      attendees: ['Sarah'],
      userId: testUser
    });
    expect(captureResponse.success).toBe(true);
    
    // 2. Verify enhanced output structure
    const enhanced = captureResponse.enhanced;
    expect(enhanced.sections).toBeDefined();
    expect(enhanced.inscriptContext).toBeDefined();
    
    // 3. Save the note
    const saveResponse = await saveEnhancedNote({
      enhancedContent: enhanced,
      noteId: captureResponse.noteId,
      userId: testUser
    });
    expect(saveResponse.success).toBe(true);
    
    // 4. Verify note appears in notes list
    const notes = await getNotes(testUser);
    expect(notes.some(n => n.id === captureResponse.noteId)).toBe(true);
    
    // 5. Wait for background processing
    await wait(5000);
    
    // 6. Verify entities were extracted
    const entities = await getEntities(testUser);
    expect(entities.some(e => e.name.toLowerCase().includes('sarah'))).toBe(true);
    
    // 7. Verify meeting history was updated
    const history = await getMeetingHistory(testUser, sarahEntityId);
    expect(history.length).toBeGreaterThan(0);
  });

  test('voice flow: record → transcribe → enhance', async () => {
    // 1. Simulate voice recording
    const audio = await recordTestAudio('test meeting notes');
    
    // 2. Transcribe
    const transcription = await transcribeVoice(audio, testUser);
    expect(transcription.success).toBe(true);
    
    // 3. Enhance transcribed text
    const enhanced = await enhanceMeeting({
      rawInput: transcription.text,
      userId: testUser
    });
    expect(enhanced.success).toBe(true);
  });
});
```

## 13.3 Manual Test Checklist

### Meeting Capture UI
- [ ] Large text area renders correctly
- [ ] Placeholder text visible when empty
- [ ] Placeholder hides on focus
- [ ] Title field optional (can submit without)
- [ ] Attendees field optional
- [ ] Enhance button disabled when empty
- [ ] Enhance button enabled when content exists
- [ ] Voice button visible and tappable

### Voice Recording
- [ ] Permission prompt appears on first use
- [ ] Recording indicator visible when active
- [ ] Recording stops on second tap
- [ ] Recording stops at 2-minute limit
- [ ] Transcription appears in textarea
- [ ] User can edit transcription
- [ ] Multiple recordings append (don't replace)

### Enhancement Process
- [ ] Loading message appears immediately
- [ ] Loading message rotates every 3s
- [ ] Enhanced output streams in progressively
- [ ] All sections display correctly
- [ ] Inscript Context section visible
- [ ] Total time < 3 seconds

### Enhanced Output
- [ ] Title displays correctly
- [ ] Date displays correctly
- [ ] "✨ enhanced" badge visible
- [ ] Section headers formatted correctly
- [ ] Bullet points aligned
- [ ] Action items use → prefix
- [ ] Warnings use ⚠️ prefix
- [ ] Inscript Context has distinct background
- [ ] Related note links are clickable
- [ ] Try Again button works
- [ ] Save button works

### Mobile
- [ ] Full layout works at 375px width
- [ ] Touch targets ≥ 44px
- [ ] No horizontal scroll
- [ ] Keyboard doesn't obscure input
- [ ] Voice button accessible while typing

---

# 14. FILE STRUCTURE

## 14.1 New Files to Create

```
/api
  enhance-meeting.js       # Meeting enhancement endpoint (Edge Runtime)
  enhance-note.js          # Note enhancement endpoint (Edge Runtime)
  transcribe-voice.js      # Voice transcription endpoint
  inscript-context.js      # Context fetching endpoint

/js
  meeting-capture.js       # Meeting capture UI component
  note-enhance.js          # Note enhancement UI additions
  voice-input.js           # Voice recording and transcription
  enhance-display.js       # Enhanced output display component
  attendee-suggest.js      # Attendee auto-suggest component
  loading-messages.js      # Contextual loading message rotation

/prompts
  meeting-enhance-v1.txt   # Meeting enhancement prompt
  note-enhance-v1.txt      # Note enhancement prompt
  context-generate-v1.txt  # Inscript Context generation prompt

/css
  enhancement.css          # Enhancement-specific styles (or add to main)

/tests
  enhance-meeting.test.js
  enhance-note.test.js
  transcribe-voice.test.js
  inscript-context.test.js
  integration/
    meeting-flow.test.js
    note-flow.test.js
```

## 14.2 Files to Modify

```
/js
  ui.js                    # Add meeting/enhance entry points, integrate new components
  entities.js              # Ensure meeting entities flow through pipeline
  notes-cache.js           # Include enhanced notes in cache

/api
  analyze-edge.js          # May need to call enhancement for certain note types

/css
  styles.css               # Add enhancement styles (or use separate file)

/index.html                # Add any new component containers

/sql
  migrations/              # Database schema changes
```

## 14.3 File Dependencies

```
ui.js
  ├── meeting-capture.js
  │     ├── voice-input.js
  │     ├── attendee-suggest.js
  │     └── loading-messages.js
  │
  ├── enhance-display.js
  │     └── loading-messages.js
  │
  └── note-enhance.js
        ├── voice-input.js
        └── loading-messages.js

api/enhance-meeting.js
  ├── api/inscript-context.js
  └── (existing entity extraction)

api/enhance-note.js
  ├── api/inscript-context.js
  └── (existing reflection system)
```

---

# 15. CLAUDE CODE INSTRUCTIONS

## 15.1 General Guidelines

When implementing this specification:

1. **Reference the personas** for decisions:
   - Maya for scope/product questions
   - David for technical architecture
   - Sasha for UI/design choices

2. **Follow the design system strictly:**
   - Black, white, silver only
   - No shadows
   - No rounded corners > 2px
   - Typography creates hierarchy

3. **Prioritize performance:**
   - Edge Runtime for all API routes
   - Parallel fetches for context
   - Streaming responses
   - Background processing via ctx.waitUntil()

4. **Test incrementally:**
   - Unit tests for each function
   - Integration tests for flows
   - Manual testing per checklist

## 15.2 Implementation Order

**DO implement in this order:**

1. Week 1: Basic meeting capture + enhancement (no voice, no context)
2. Week 2: Add voice input
3. Week 3: Add Inscript Context
4. Week 4-5: Note enhancement mode
5. Week 6+: Advanced features

**DO NOT:**
- Skip ahead to advanced features
- Add features not in this spec
- Change the design system
- Sacrifice performance for features

## 15.3 Key Technical Decisions

These decisions are FINAL. Do not revisit:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Runtime | Edge Runtime | No cold starts |
| AI Provider | Claude | Existing integration |
| Voice Transcription | Whisper API | Quality + simplicity |
| Response Format | Streaming SSE | Perceived speed |
| Background Processing | ctx.waitUntil() | Non-blocking |
| State Management | localStorage + memory | Simple, fast |
| Styling | CSS custom properties | Consistent design system |

## 15.4 Error Handling Standards

```javascript
// API Error Response Format
{
  success: false,
  error: {
    code: 'ERROR_CODE',      // Machine-readable
    message: 'User message', // Human-readable
    details: {}              // Optional debug info
  }
}

// Error Codes
const ERROR_CODES = {
  EMPTY_INPUT: 'Input cannot be empty',
  ENHANCEMENT_FAILED: 'Failed to enhance notes',
  TRANSCRIPTION_FAILED: 'Failed to transcribe audio',
  CONTEXT_FETCH_FAILED: 'Failed to fetch context',
  SAVE_FAILED: 'Failed to save note',
  UNAUTHORIZED: 'Authentication required',
  RATE_LIMITED: 'Too many requests',
};

// UI Error Display
// - Show error message in place of loading state
// - Preserve user input (never lose data)
// - Offer retry option
// - Log to console for debugging
```

## 15.5 Quality Checklist Before PR

Before considering any feature complete:

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual test checklist complete
- [ ] Performance targets met (< 3s enhancement)
- [ ] Mobile responsive verified
- [ ] Error states handled gracefully
- [ ] Loading states implemented
- [ ] Accessibility basics (focus, contrast)
- [ ] No console errors
- [ ] Code follows existing patterns

## 15.6 Prompt Versioning

Enhancement prompts are critical. Version them:

```javascript
// prompts/index.js
export const PROMPTS = {
  meetingEnhance: {
    version: '1.0',
    path: '/prompts/meeting-enhance-v1.txt',
    lastUpdated: '2026-01-25',
  },
  noteEnhance: {
    version: '1.0',
    path: '/prompts/note-enhance-v1.txt',
    lastUpdated: '2026-01-25',
  },
  contextGenerate: {
    version: '1.0',
    path: '/prompts/context-generate-v1.txt',
    lastUpdated: '2026-01-25',
  },
};

// Log prompt version with each API call for debugging
console.log(`Using prompt: ${PROMPTS.meetingEnhance.version}`);
```

---

# DOCUMENT END

**This specification is the single source of truth for the Inscript Enhancement System.**

All implementation decisions should reference this document. If something is unclear, consult the personas. If something is missing, flag it before implementing.

**Document Owner:** Product Team  
**Last Updated:** January 25, 2026  
**Next Review:** After Phase 1 completion

---

*Build something users love. Make every note smarter.*
