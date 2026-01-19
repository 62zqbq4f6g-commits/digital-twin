# CLAUDE.md — Inscript Developer Guide

## Version 8.0.0 | January 2026

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Version** | 8.0.0 |
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
│   ├── analyze.js          # Main reflection endpoint (3018 lines)
│   ├── chat.js             # "Go deeper" conversation
│   ├── extract-entities.js # Entity extraction
│   ├── embed.js            # OpenAI embeddings
│   ├── infer-connections.js
│   ├── classify-importance.js
│   ├── compress-memory.js
│   └── forgetting.js
├── js/
│   ├── ui.js               # Main UI (4799 lines — SPLIT NEEDED)
│   ├── entities.js         # Entity management
│   ├── twin-ui.js          # TWIN tab
│   ├── actions-ui.js       # Actions tab
│   ├── entity-memory.js    # Memory operations
│   └── pin.js              # Pinned notes
├── css/
│   ├── design-system.css   # Variables and tokens
│   └── styles.css          # Main styles (8219 lines)
└── supabase/
    └── migrations/         # Database migrations
```

## Large File Warning

⚠️ **ui.js is 4799 lines** — DO NOT read in full. Use grep.

```bash
# Find functions
grep -n "^function \|^const \|^async function " js/ui.js | head -50

# Find specific functionality
grep -n "renderNote\|showModal\|handleSubmit" js/ui.js
```

---

# DATABASE SCHEMA

## Core Tables

| Table | Purpose |
|-------|---------|
| `notes` | User notes with content and metadata |
| `note_embeddings` | Vector embeddings for semantic search |
| `user_entities` | Extracted people, places, themes |
| `entity_relationships` | Connections between entities |
| `entity_mentions` | Where entities appear in notes |
| `user_profiles` | User settings and onboarding data |
| `user_feedback` | Thumbs up/down on reflections |
| `user_learning_profile` | Learned preferences |
| `quality_learning` | Reflection quality metrics |
| `conversations` | Chat history for "Go deeper" |
| `actions` | User action items |

## RLS Policy

All tables have Row Level Security enabled. Users can only access their own data.

```sql
-- Example policy
CREATE POLICY "Users can only see own notes"
ON notes FOR ALL
USING (auth.uid() = user_id);
```

---

# API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analyze` | POST | Main reflection generation |
| `/api/chat` | POST | Conversation about a note |
| `/api/extract-entities` | POST | Extract entities from text |
| `/api/embed` | POST | Generate embeddings |
| `/api/infer-connections` | POST | Find entity relationships |
| `/api/classify-importance` | POST | Rate note importance |
| `/api/compress-memory` | POST | Summarize old memories |
| `/api/forgetting` | POST | Decay old, unimportant memories |

---

# REFLECTION QUALITY

## The Three-Layer Structure

AI reflections should follow this pattern:

### HEARD (Always)
Prove you understood. Be specific. Quote their words.
- BAD: "Sounds like a busy day"
- GOOD: "The product launch delay and friction with Jamie — that's a lot for one day"

### NOTICED (When memory is relevant)
Connect to what you know about their world.
- "This is the third time this month the launch has slipped"
- "Jamie has come up in tense moments before"
- "You usually mention Marcus when processing career decisions"

### OFFERED (When valuable)
A question, connection, or gentle observation.
- "What made the conversation with Jamie feel different this time?"
- "Last time you felt this stuck, taking a day off helped. Worth considering?"

## Forbidden Phrases

Never use:
- "I can see..."
- "It seems like..."
- "Based on my analysis..."
- "As an AI..."
- "I understand that..."
- "I notice that..."

## Quality Rules

1. Be SPECIFIC — Reference actual details from their note
2. Use memory NATURALLY — Don't announce "Based on my memory..."
3. Match their energy — Quick note = quick response
4. Ask ONE question maximum
5. Sound like a thoughtful friend, not a therapist or AI

---

# ENTITY SYSTEM

## Entity Types

| Type | Examples |
|------|----------|
| `person` | Marcus, Mom, Dr. Lee |
| `place` | Home, Office, San Francisco |
| `project` | The app, Q4 launch |
| `theme` | Work stress, Health goals |
| `organization` | Company, Team |

## Entity Context Accumulation

Each entity accumulates:
- `mention_count` — How often mentioned
- `recent_context` — Last 5 contexts
- `relationship` — Inferred relationship type
- `sentiment_trend` — Emotional trajectory
- `pattern` — Observed behavioral pattern
- `first_seen` / `last_seen` — Temporal range

---

# ONBOARDING DATA SCHEMA

```sql
CREATE TABLE onboarding_data (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  name TEXT NOT NULL,
  life_seasons TEXT[],           -- 10 options
  mental_focus TEXT[],           -- 10 options, max 3
  depth_question TEXT,           -- Which question was asked
  depth_answer TEXT,             -- Their answer
  seeded_people JSONB,           -- [{name, context}]
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Using Onboarding Data in Reflections

The AI MUST use onboarding data in the first response:

```javascript
// Build context from onboarding
const onboardingContext = `
User's name: ${onboarding.name}
Life season: ${onboarding.life_seasons.join(', ')}
Current focus: ${onboarding.mental_focus.join(', ')}
Shared context: ${onboarding.depth_answer}
Key people: ${onboarding.seeded_people.map(p => `${p.name} (${p.context})`).join(', ')}
`;
```

---

# KEY FEATURES

## Knowledge Pulse

Shows learning in real-time after note save:

```
┌─────────────────────────────────┐
│ ✓ Saved                         │
│                                 │
│ ◆ Learned: Marcus is a friend   │
│ ○ Noticed: Work stress theme    │
└─────────────────────────────────┘
```

## Entity Cards

Click any entity name to see accumulated knowledge:

```
┌─────────────────────────────────┐
│ [M]  Marcus                     │
│      Close friend               │
│ ─────────────────────────────── │
│ JOURNEY                         │
│ From college roommate to career │
│ advisor over 8 years.           │
│ ─────────────────────────────── │
│ RECENT                          │
│ "Marcus thinks I should..."     │
│ "Called Marcus about the..."    │
│ ─────────────────────────────── │
│ 12 mentions · Since Oct 2025    │
└─────────────────────────────────┘
```

## Pattern Detection

Surface non-obvious patterns:

```
"I've noticed something: You tend to write about work 
stress on Sunday evenings. Four of your last five 
Sunday notes mention feeling anxious about the week ahead."
```

---

# LOADING STATES

## Editorial Messages

```javascript
const LOADING_MESSAGES = [
  'thinking with you...',
  'listening...',
  'reflecting...',
  'connecting...',
  'considering...',
];
```

## Typography

```css
.loading-message {
  font-family: var(--font-editorial);
  font-size: var(--text-xl);
  font-style: italic;
  color: var(--silver-500);
}
```

---

# IMPLEMENTATION PRIORITIES

## Phase 11 — Current

| Priority | Feature |
|----------|---------|
| **P0** | Rebrand to Inscript throughout app |
| **P0** | Enhanced 7-screen onboarding |
| **P0** | Seeded people recognition in first note |
| **P0** | First response uses ALL onboarding data |
| **P0** | Privacy screen in onboarding |
| **P0** | Privacy settings page |
| **P1** | Knowledge Pulse visibility |
| **P1** | Entity Cards |
| **P1** | Reflection quality engine |

## Phase 12 — Next

| Priority | Feature |
|----------|---------|
| **P0** | Pattern verification UI |
| **P0** | "What does Inscript know?" query |
| **P1** | Memory depth visualization |
| **P1** | Preference learning from feedback |

---

# DEVELOPMENT COMMANDS

```bash
# Start local dev server
vercel dev

# Run on specific port
vercel dev --listen 3000

# Check for errors without reading large files
grep -r "error\|Error\|ERROR" js/*.js api/*.js 2>/dev/null | head -20

# Find specific functionality
grep -rn "functionName" js/*.js api/*.js

# Git status
git status
git log --oneline -5
```

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
| 7.8.0 | 10.8 | Intelligent Memory Layer, Mem0 parity |
| 7.9.0 | 10.9 | UI module split (if completed) |
| 8.0.0 | 11.0 | Inscript rebrand, enhanced onboarding, privacy |

---

*CLAUDE.md — Inscript Developer Guide*
*Last Updated: January 19, 2026*
