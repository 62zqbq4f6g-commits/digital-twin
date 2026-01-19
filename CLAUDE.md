# CLAUDE.md — Inscript Developer Guide

## Version 8.0.0 | January 20, 2026

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Version** | 8.0.0 |
| **Production URL** | https://digital-twin-ecru.vercel.app |
| **Working Directory** | `/Users/airoxthebox/Projects/digital-twin` |

---

# PRODUCT IDENTITY

## The Category

**We're not a note app. We're not a journaling app. We're not an AI assistant.**

We're creating a new category: **Personal AI Memory**

> "Inscript is the first AI that actually remembers you.
> Not just your notes — your world."

## Core Value Proposition

Inscript learns:
- The **people** in your life
- The **patterns** you can't see
- The **context** that makes you *you*

## The Flywheel

```
Input → Learn → Demonstrate → Trust → More Input → Smarter
```

**CRITICAL:** Learning must be VISIBLE. If users don't see Inscript getting smarter, the flywheel breaks.

## Privacy Foundation

- User data is encrypted and isolated
- Never used to train AI models (use enterprise LLM tier)
- Never sold or shared
- Delete means delete
- This is non-negotiable

---

# CURRENT STATE (Phase 11 Complete)

## What's Working in Production

| Feature | Status |
|---------|--------|
| Login / Sign up | ✅ Live |
| 8-screen onboarding flow | ✅ Live |
| Note creation (text, voice, image) | ✅ Live |
| AI reflection with personalization | ✅ Live |
| Seeded people → AI context injection | ✅ Verified |
| Entity extraction | ✅ Live |
| Feedback loop | ✅ Live |
| Actions tab | ✅ Live |
| TWIN tab | ✅ Live |
| Cloud sync (E2E encrypted) | ✅ Live |
| PIN authentication | ✅ Live |

## The Critical Test — PASSED

When user wrote about Marcus, the AI responded:
> "I noticed you're holding input from Marcus—**your close friend**—alongside Sarah's pivot thinking..."

This is the "holy shit, it knows" moment working in production.

---

# DESIGN SYSTEM

## Philosophy

**"The love child of Linear's precision and Vogue's editorial elegance."**

## Colors

```css
:root {
  /* Paper */
  --paper: #FFFFFF;
  --paper-warm: #FAFAFA;
  --paper-cream: #F7F7F5;

  /* Ink */
  --ink: #000000;
  --ink-rich: #1A1A1A;
  --ink-soft: #333333;

  /* Silver scale */
  --silver-50: #F9F9F9;
  --silver-100: #F5F5F5;
  --silver-200: #E5E5E5;
  --silver-300: #D4D4D4;
  --silver-400: #A3A3A3;
  --silver-500: #737373;
  --silver-600: #525252;
  --silver-700: #404040;
  --silver-800: #262626;
  --silver-900: #171717;

  /* Semantic (minimal — color is earned) */
  --error: #8B0000;
  --error-soft: #FEE2E2;
  --success: #065F46;
  --success-soft: #D1FAE5;
}
```

## Typography

```css
:root {
  /* Font families */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-editorial: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

| Use Case | Font |
|----------|------|
| Large headlines, app name | Playfair Display |
| AI reflections, insights, quotes | Cormorant Garamond (italic) |
| UI elements, buttons, labels | Inter |
| Timestamps, data, metrics | JetBrains Mono |

## Design Principles

1. **Black, white, silver only** — No color accents. Color is earned (errors only).
2. **Typography-first** — Let the words carry the design
3. **Thin lines** — 1px borders, no shadows
4. **Generous whitespace** — Thoughts need room to breathe
5. **Subtle motion** — Things appear, they don't bounce

---

# FILE STRUCTURE

## Key Files

```
/
├── index.html              # Main app entry
├── api/
│   ├── analyze.js          # Main reflection endpoint (3,128 lines)
│   ├── chat.js             # "Go deeper" conversation
│   ├── vision.js           # Image analysis (Claude Vision)
│   ├── extract-entities.js # Entity extraction
│   ├── embed.js            # OpenAI embeddings
│   ├── infer-connections.js
│   ├── classify-importance.js
│   └── compress-memory.js
├── js/
│   ├── ui.js               # Main UI (4,824 lines — SPLIT NEEDED)
│   ├── app.js              # Application entry point
│   ├── onboarding.js       # 8-screen onboarding flow
│   ├── analyzer.js         # Analysis orchestration
│   ├── entities.js         # Entity management
│   ├── entity-memory.js    # Memory operations
│   ├── twin-ui.js          # TWIN tab
│   ├── actions-ui.js       # Actions tab
│   ├── sync.js             # Cloud sync
│   └── pin.js              # PIN authentication
├── css/
│   ├── design-system.css   # Variables and tokens
│   └── styles.css          # Main styles (8,280 lines)
└── supabase/
    └── migrations/         # Database migrations
```

## Large File Warning

⚠️ **ui.js is 4,824 lines** — DO NOT read in full. Use grep.

```bash
# Find functions
grep -n "^function \|^const \|^async function " js/ui.js | head -50

# Find specific functionality
grep -n "renderNote\|showModal\|handleSubmit" js/ui.js
```

---

# ONBOARDING DATA

## 8-Screen Flow

| # | Screen | Captures |
|---|--------|----------|
| 0 | Welcome | - |
| 1 | Name | User's name |
| 2 | Seasons | Life season (building, transition, healing, etc.) |
| 3 | Focus | What's on their mind (max 3) |
| 4 | Depth | Contextual question + answer |
| 5 | People | Seed 1-3 people with relationships |
| 6 | Privacy | Privacy promise |
| 7 | Wow | First note prompt |

## Database Schema

```sql
CREATE TABLE onboarding_data (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  name TEXT NOT NULL,
  life_seasons TEXT[],           -- Multi-select
  mental_focus TEXT[],           -- Max 3
  depth_question TEXT,           -- Which question was asked
  depth_answer TEXT,             -- Their answer
  seeded_people JSONB,           -- [{name, context}]
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## AI Context Injection

The AI receives this context in every analysis:

```xml
<user_context>
User's name: Test
Life season: Building something new
Currently focused on: work, decisions, future

People in their world:
- Marcus (close friend)
- Sarah (cofounder)
</user_context>
```

**Implementation:** `api/analyze.js` lines 9-91 contain `getUserOnboardingContext()` and `buildOnboardingContextPrompt()` functions.

---

# REFLECTION QUALITY

## The Three-Layer Structure

### HEARD (Always)
Prove you understood. Be specific. Quote their words.
- BAD: "Sounds like a busy day"
- GOOD: "The product launch delay and friction with Jamie — that's a lot for one day"

### NOTICED (When memory is relevant)
Connect to what you know about their world.
- "This is the third time this month the launch has slipped"
- "You usually mention Marcus when processing career decisions"

### OFFERED (When valuable)
A question, connection, or gentle observation.
- "What made the conversation with Jamie feel different this time?"

## Forbidden Phrases

Never use:
- "I can see..."
- "It seems like..."
- "Based on my analysis..."
- "As an AI..."
- "I understand that..."
- "Based on my records..."

## Quality Rules

1. Be SPECIFIC — Reference actual details from their note
2. Use memory NATURALLY — Don't announce "Based on my memory..."
3. Match their energy — Quick note = quick response
4. Ask ONE question maximum
5. Sound like a thoughtful friend, not a therapist or AI

---

# DATABASE SCHEMA

## Core Tables

| Table | Purpose |
|-------|---------|
| `notes` | Encrypted note storage |
| `onboarding_data` | Phase 11 onboarding (name, seasons, focus, people) |
| `user_entities` | Extracted people, places, themes |
| `note_embeddings` | Vector embeddings for semantic search |
| `entity_relationships` | Connections between entities |
| `user_feedback` | Thumbs up/down on reflections |
| `user_learning_profile` | Learned preferences |

## RLS Policy

All tables have Row Level Security enabled. Users can only access their own data.

```sql
CREATE POLICY "Users can only see own data"
ON table_name FOR ALL
USING (auth.uid() = user_id);
```

---

# API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analyze` | POST | Main reflection generation + context injection |
| `/api/chat` | POST | Conversation about a note |
| `/api/vision` | POST | Image analysis (Claude Vision) |
| `/api/extract-entities` | POST | Extract entities from text |
| `/api/embed` | POST | Generate embeddings |
| `/api/infer-connections` | POST | Find entity relationships |
| `/api/classify-importance` | POST | Rate entity importance |
| `/api/compress-memory` | POST | Summarize old memories |

---

# DEVELOPMENT COMMANDS

```bash
# Production URL
https://digital-twin-ecru.vercel.app

# Start local dev server
vercel dev --listen 3001

# Deploy to production
git add -A && git commit -m "message" && git push origin main

# Force deploy
vercel --prod

# Check version (browser console)
APP_VERSION  // "8.0.0"

# Find specific functionality (avoid reading large files)
grep -rn "functionName" js/*.js api/*.js

# Git status
git status
git log --oneline -5
```

---

# TECHNICAL DEBT

## Must Fix Before Phase 12

| File | Lines | Issue |
|------|-------|-------|
| `js/ui.js` | 4,824 | Split into ui-core, ui-notes, ui-twin, ui-modals, ui-onboarding |
| `api/analyze.js` | 3,128 | Extract prompts to separate files |
| `css/styles.css` | 8,280 | Modularize by feature |

---

# NEXT PHASE (12)

| Priority | Task |
|----------|------|
| P0 | Split `ui.js` into modules |
| P1 | Knowledge Pulse (show learning after save) |
| P1 | Entity Cards (click name → see context) |
| P2 | "What does Inscript know?" query |
| P2 | Pattern verification UI |

---

# CRITICAL REMINDERS

1. **NEVER read ui.js in full** — Use grep only
2. **Always use onboarding data** in first reflection
3. **Callbacks are critical** — Reference previous notes by note 2-3
4. **Entity mentions must feel natural** — Never "Based on my database..."
5. **Privacy is non-negotiable** — Enterprise LLM, no training
6. **Design is editorial** — Black, white, silver. Typography-first.
7. **Test mobile** — Responsive design is required

---

# VERSION HISTORY

| Version | Phase | Key Changes |
|---------|-------|-------------|
| **8.0.0** | 11.0 | Inscript rebrand, 8-screen onboarding, AI context injection, production deploy |
| 7.8.0 | 10.8 | Intelligent Memory Layer, Mem0 parity |
| 7.5.0 | 10.3 | Semantic search with pgvector |

---

*CLAUDE.md — Inscript Developer Guide*
*Last Updated: January 20, 2026*
*Production: https://digital-twin-ecru.vercel.app*
