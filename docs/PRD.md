# Product Requirements Document: Digital Twin

**Version:** 2.0  
**Owner:** Rox  
**Status:** Ready for Build  
**Created:** 2025-01-10  
**Build Method:** Ralph Wiggum Loop (Autonomous)  
**Architecture:** Progressive Web App (PWA)

---

## Table of Contents

1. [Vision](#1-vision)
2. [Problem Statement](#2-problem-statement)
3. [User Persona](#3-user-persona)
4. [Product Strategy](#4-product-strategy)
5. [User Experience](#5-user-experience)
6. [Technical Architecture](#6-technical-architecture)
7. [Feature Specifications](#7-feature-specifications)
8. [Data Architecture](#8-data-architecture)
9. [Design System](#9-design-system)
10. [Security](#10-security)
11. [Success Metrics](#11-success-metrics)
12. [Roadmap](#12-roadmap)
13. [User Stories](#13-user-stories)
14. [Edge Cases](#14-edge-cases)
15. [Appendix](#15-appendix)

---

## 1. Vision

### 1.1 The Big Picture

**Digital Twin** is an AI-powered second brain that captures your thoughts, learns who you are, and eventually acts as an extension of yourself.

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE DIGITAL TWIN JOURNEY                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PHASE 1                PHASE 2                PHASE 3          │
│   ────────               ────────               ────────          │
│   CAPTURE                LEARN                  ACT               │
│                                                                  │
│   "Record my            "Know me               "Be me             │
│    thoughts"             deeply"                sometimes"        │
│                                                                  │
│   ┌─────────┐           ┌─────────┐           ┌─────────┐       │
│   │ System  │    ───►   │ System  │    ───►   │ System  │       │
│   │   of    │           │   of    │           │   of    │       │
│   │ Record  │           │ Intelli-│           │ Action  │       │
│   │         │           │ gtic    │           │         │       │
│   └─────────┘           └─────────┘           └─────────┘       │
│                                                                  │
│   • Voice input         • Pattern detection    • Draft emails    │
│   • Text input          • Insights             • Set reminders   │
│   • Classification      • Predictions          • Suggest actions │
│   • Professional        • Connections          • Trigger flows   │
│     formatting          • Growth tracking      • Be proactive    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Phase 1 Focus: System of Record

For MVP, we focus exclusively on **capture and structure**:

> "I speak or type my thoughts, and instantly get professional, structured notes I can share — while building a machine-readable dataset of my life."

### 1.3 Why This Matters

The notes you capture today become the training data for your future Digital Twin. Every input:
- Teaches the system who you are
- Builds patterns of your thinking
- Creates a searchable history of your decisions
- Enables future AI agents to act on your behalf

### 1.4 Success Statement

> "My Digital Twin captures my thoughts effortlessly, organizes them beautifully, and grows smarter about me every day."

---

## 2. Problem Statement

### 2.1 Current Pain Points

| Pain | Impact | Frequency |
|------|--------|-----------|
| Thoughts disappear | Good ideas lost forever | Daily |
| Voice notes are messy | Can't share with team | Weekly |
| Manual cleanup required | 5-10 min per note | Every note |
| Notes scattered everywhere | Can't find things | Daily |
| No system of record | No learning over time | Always |
| Action items lost | Tasks fall through cracks | Weekly |

### 2.2 Current Workflow

```
Think → Maybe write it down → Probably forget → Definitely can't find it later
```

### 2.3 Desired Workflow

```
Think → Speak/Type → Done → Find it anytime → AI learns from it
```

---

## 3. User Persona

### 3.1 Primary User: Rox

| Attribute | Detail |
|-----------|--------|
| **Role** | Founder, building Velolume |
| **Context** | Switches between deep work, meetings, personal life, health |
| **Technical Level** | Non-technical (can follow instructions) |
| **Devices** | iPhone (primary), MacBook |
| **Pain Point** | Thoughts captured but not organized or actionable |
| **Goal** | Effortless capture → organized notes → smarter AI over time |

### 3.2 Usage Patterns

| Context | When | Example Input |
|---------|------|---------------|
| **Post-Meeting** | 3-5x/week | "Meeting with trust company went well, they'll send proposal" |
| **Personal Reminders** | Daily | "Need to call mom, book dentist" |
| **Health Check-in** | Daily | "Good workout, feeling energized, slept 7 hours" |
| **Ideas** | Multiple/day | "What if Velolume integrated with MCP directly?" |
| **Work Updates** | Daily | "Finished pitch deck, need investor feedback" |

---

## 4. Product Strategy

### 4.1 Why PWA (Not Native App)

| Factor | PWA | Native App |
|--------|-----|------------|
| Build time | Weeks | Months |
| App store approval | Not needed | Required |
| Updates | Instant | Review cycle |
| Cross-platform | Automatic | Separate builds |
| Cost | Free hosting | $99/year + hosting |

**Decision:** PWA gives 90% of native experience with 20% of the effort.

### 4.2 Why No Backend (Phase 1)

| Factor | With Backend | Without Backend |
|--------|--------------|-----------------|
| Hosting cost | $5-50/month | Free |
| Security | Must secure server | Data never leaves device |
| Complexity | High | Low |
| Privacy | Data on server | 100% local |

**Decision:** Pure client-side for MVP. Add backend in Phase 2 for AI features.

---

## 5. User Experience

### 5.1 Design Philosophy

**Inspired by:** Modern Soho NYC design agencies — Pentagram, Collins, Mother Design

**Principles:**

| Principle | Application |
|-----------|-------------|
| **Radical simplicity** | One screen does one thing |
| **Invisible UI** | Interface disappears, content shines |
| **Typography-first** | Beautiful type hierarchy, minimal decoration |
| **Confident whitespace** | Let content breathe |
| **Monochrome base** | Black and white, color only for meaning |
| **Zero friction** | Capture in under 3 seconds |

### 5.2 Visual Language

```
COLOR PALETTE
─────────────

PRIMARY
■ Black     #000000    Text, icons, primary actions
□ White     #FFFFFF    Background, cards

SUBTLE
▒ Gray 50   #FAFAFA    Subtle backgrounds
▒ Gray 100  #F5F5F5    Dividers, borders
▒ Gray 400  #9E9E9E    Secondary text
▒ Gray 600  #757575    Placeholder text

Note: Categories distinguished by ICON, not color
```

### 5.3 Typography

```
FONT STACK
──────────
Primary: SF Pro Display (iOS) / Inter (fallback)
Mono: SF Mono / JetBrains Mono (timestamps)

SCALE
─────
Title          32px / 700 / -0.02em
Heading        20px / 600 / -0.01em
Body           16px / 400 / 0
Caption        13px / 400 / 0.01em
Micro          11px / 500 / 0.02em / UPPERCASE
```

### 5.4 Core Screens

#### Screen 1: Capture (Home)

```
┌─────────────────────────────────────┐
│                                     │
│  Digital Twin              ≡        │
│                                     │
│                                     │
│         ┌───────────────┐           │
│         │               │           │
│         │    ◉          │           │
│         │               │           │
│         │  Tap to speak │           │
│         │               │           │
│         └───────────────┘           │
│                                     │
│         or type below               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ What's on your mind?        │    │
│  └─────────────────────────────┘    │
│                                     │
│  RECENT                             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 💼 Meeting with trust...    │    │
│  │ Today, 2:30 PM              │    │
│  └─────────────────────────────┘    │
│                                     │
│  ●         ○         ○             │
│  Capture   Notes     Settings       │
│                                     │
└─────────────────────────────────────┘
```

#### Screen 2: Notes (List)

```
┌─────────────────────────────────────┐
│                                     │
│  Notes                    🔍        │
│                                     │
│  ALL    WORK    PERSONAL    ···     │
│  ───                                │
│                                     │
│  TODAY                              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Meeting with Trust Company  │    │
│  │ 💼 WORK · 2:30 PM           │    │
│  │ Productive discussion...    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Morning Energy Check        │    │
│  │ 💪 HEALTH · 7:15 AM         │    │
│  │ Great workout...            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ○         ●         ○             │
│  Capture   Notes     Settings       │
│                                     │
└─────────────────────────────────────┘
```

#### Screen 3: Note Detail

```
┌─────────────────────────────────────┐
│                                     │
│  ←  Note                   ⋯        │
│                                     │
│  💼 WORK                            │
│                                     │
│  Meeting with Trust                 │
│  Company                            │
│                                     │
│  Friday, January 10, 2025           │
│  2:30 PM SGT                        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  SUMMARY                            │
│                                     │
│  Productive meeting with Chinese    │
│  trust company. Strong interest...  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ACTION ITEMS                       │
│                                     │
│  ☐ Wait for written proposal        │
│  ☐ Schedule team workshop           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     📋 Copy to Clipboard    │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIGITAL TWIN PWA                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   INPUT LAYER                                                    │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│   │  Voice  │  │  Text   │  │  Image  │  │  Video  │           │
│   │  [MVP]  │  │  [MVP]  │  │  [v2]   │  │  [v2]   │           │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘           │
│        │            │            │            │                  │
│        ▼            ▼            ▼            ▼                  │
│   PROCESSING LAYER                                               │
│   ┌─────────────────────────────────────────────────┐           │
│   │  CLASSIFIER → EXTRACTOR → REFINER               │           │
│   └─────────────────────────────────────────────────┘           │
│                          │                                       │
│                          ▼                                       │
│   STORAGE LAYER                                                  │
│   ┌─────────────────────────────────────────────────┐           │
│   │              IndexedDB (Local)                   │           │
│   └─────────────────────────────────────────────────┘           │
│                          │                                       │
│                          ▼                                       │
│   OUTPUT LAYER                                                   │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐                  │
│   │   View    │  │   Copy    │  │  Export   │                  │
│   └───────────┘  └───────────┘  └───────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Vanilla JS + HTML/CSS |
| **Voice** | Web Speech API |
| **Storage** | IndexedDB |
| **Offline** | Service Worker |
| **Hosting** | Vercel (free) |

### 6.3 File Structure

```
digital-twin/
├── index.html              # Main app
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│   └── styles.css          # All styles
├── js/
│   ├── app.js              # Main controller
│   ├── db.js               # IndexedDB operations
│   ├── classifier.js       # Category classification
│   ├── extractor.js        # Metadata extraction
│   ├── refiner.js          # Professional formatting
│   ├── voice.js            # Web Speech API
│   └── ui.js               # UI interactions
├── assets/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── favicon.ico
└── docs/
    └── PRD.md
```

---

## 7. Feature Specifications

### 7.1 Voice Input

**Technology:** Web Speech API

**Flow:**
```
Tap 🎤 → Recording → User speaks → Real-time text → Stop → Process → Save
```

### 7.2 Text Input

**Behavior:**
- Auto-expanding textarea
- Submit on Enter (desktop) or tap arrow (mobile)
- Placeholder: "What's on your mind?"

### 7.3 Classification

**Four Categories:**

| Category | Icon | Keywords |
|----------|------|----------|
| **Personal** | 🏠 | family, mom, dad, friend, home, weekend, dinner, birthday, movie, relationship, kids, wife, husband, pet, holiday, trip, vacation |
| **Work** | 💼 | velolume, meeting, client, investor, revenue, deadline, project, team, business, partnership, pitch, proposal, hire, demo, trust, spv, jv, strategy, product, api |
| **Health** | 💪 | gym, exercise, health, sleep, meditation, doctor, dentist, workout, fitness, stress, energy, tired, sick, mental, therapy, wellness, yoga |
| **Ideas** | 💡 | idea, strategy, thinking, maybe, could, future, plan, vision, opportunity, experiment, hypothesis, explore, brainstorm, what if |

**Default:** If no keywords match → Personal

### 7.4 Extraction

| Field | Logic |
|-------|-------|
| **title** | First sentence, max 50 chars |
| **topics** | Matched keyword categories |
| **action_items** | "need to", "should", "must", "have to", "remember to" |
| **sentiment** | Positive/Negative/Neutral |
| **people** | Capitalized names |

### 7.5 Refinement Templates

**Work Template:**
```markdown
# [TITLE]

**[DAY], [MONTH] [DATE], [YEAR]**  
**[TIME] [TIMEZONE]**  
**💼 Work**

---

## Summary

[2-3 sentence professional summary]

---

## Key Points

• [Point 1]
• [Point 2]

---

## Action Items

☐ [Action 1]
☐ [Action 2]

---

*Captured by Digital Twin*
```

**Personal/Health/Ideas** follow similar minimal templates.

---

## 8. Data Architecture

### 8.1 Note Object Schema

```json
{
  "id": "dt_20250110_143052_a7x",
  "version": "1.0",
  
  "timestamps": {
    "created_at": "2025-01-10T14:30:52+08:00",
    "input_date": "2025-01-10",
    "input_time": "14:30",
    "input_timezone": "Asia/Singapore",
    "day_of_week": "Friday"
  },
  
  "input": {
    "type": "voice",
    "raw_text": "so yeah the meeting went well..."
  },
  
  "classification": {
    "category": "work",
    "confidence": 0.87,
    "reasoning": "Contains: meeting, trust, partnership"
  },
  
  "extracted": {
    "title": "Meeting with Trust Company",
    "topics": ["meetings", "partnerships"],
    "action_items": ["Wait for proposal", "Schedule workshop"],
    "sentiment": "positive",
    "people": ["Mario Ho"]
  },
  
  "refined": {
    "summary": "Productive meeting with trust company...",
    "formatted_output": "# Meeting with Trust Company\n\n..."
  },
  
  "machine_readable": {
    "schema_type": "DigitalTwin.Note/v1",
    "entities": [
      {"type": "person", "value": "Mario Ho"},
      {"type": "organization", "value": "Trust Company"}
    ]
  }
}
```

---

## 9. Design System

### 9.1 Design Tokens

```css
:root {
  /* Colors */
  --color-black: #000000;
  --color-white: #FFFFFF;
  --color-gray-50: #FAFAFA;
  --color-gray-100: #F5F5F5;
  --color-gray-400: #9E9E9E;
  --color-gray-600: #757575;
  
  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Borders */
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

---

## 10. Security

### 10.1 Device-Trust Model (MVP)

| Measure | Implementation |
|---------|----------------|
| **Data location** | IndexedDB (local only, never leaves device) |
| **Encryption** | Browser-handled |
| **Authentication** | Device lock screen |
| **Backup** | Manual JSON export |

### 10.2 Privacy Principles

1. **Data never leaves device**
2. **No third-party scripts**
3. **User can export/delete all data**
4. **You own your data, forever**

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Capture time | < 3 seconds to start |
| Daily usage | 3+ notes/day |
| Classification accuracy | > 80% |
| Refinement quality | Shareable without edits |

---

## 12. Roadmap

### Phase 1: Capture (MVP) — ~8 hours build

- PWA setup
- Voice + text input
- 4-category classification
- Extraction
- Refinement
- Storage (IndexedDB)
- Notes list & detail views
- Copy/Export

### Phase 2: Enrich — 2-4 weeks

- Image/video input
- Claude API integration
- Encrypted backup
- App PIN

### Phase 3: Learn — 2-3 months

- Pattern detection
- Insights generation
- Cross-note connections

### Phase 4: Act — Future

- Action item reminders
- Calendar integration
- Email drafts
- MCP integration

---

## 13. User Stories

| ID | Title | Est. |
|----|-------|------|
| DT-001 | PWA foundation | 30m |
| DT-002 | Design system | 30m |
| DT-003 | Database layer | 30m |
| DT-004 | App shell | 45m |
| DT-005 | Text input | 30m |
| DT-006 | Voice input | 45m |
| DT-007 | Classifier | 30m |
| DT-008 | Extractor | 45m |
| DT-009 | Refiner | 45m |
| DT-010 | Note storage | 30m |
| DT-011 | Notes list UI | 45m |
| DT-012 | Note detail UI | 30m |
| DT-013 | Copy & Export | 20m |
| DT-014 | Offline & PWA | 30m |

**Total: ~8 hours**

---

## 14. Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty input | Show message, don't save |
| No microphone | Text-only mode |
| Browser not supported | Graceful text fallback |
| IndexedDB full | Warn, suggest export |
| Private browsing | Warn data won't persist |

---

## 15. Appendix

### 15.1 Sample Output

**Input (voice):**
> "meeting with trust company went well they want to partner will send proposal need to schedule team workshop"

**Output:**

```markdown
# Meeting with Trust Company

**Friday, January 10, 2025**  
**2:30 PM SGT**  
**💼 Work**

---

## Summary

Productive meeting with trust company. They expressed interest in partnership and will send formal proposal.

---

## Action Items

☐ Wait for written proposal
☐ Schedule team workshop

---

*Captured by Digital Twin*
```

### 15.2 Glossary

| Term | Definition |
|------|------------|
| **Digital Twin** | AI system that represents and learns from user |
| **PWA** | Progressive Web App |
| **IndexedDB** | Browser local database |
| **Refinement** | Converting raw text to professional format |

---

*End of PRD v2.0*
