# CLAUDE.md — Digital Twin PWA

> **THIS IS THE SOURCE OF TRUTH. Read this file COMPLETELY at the start of EVERY session.**

---

## ⚠️ MANDATORY: Start Every Session With These Steps

```bash
# STEP 1: Read learnings (NEVER SKIP)
cat learnings.json

# STEP 2: Check current story
cat stories/current.json

# STEP 3: Find next story
cat stories/backlog.json | head -100
```

---

## 1. Project Overview

| Field | Value |
|-------|-------|
| **Name** | Digital Twin |
| **Type** | Progressive Web App (PWA) |
| **Owner** | Rox |
| **Vision** | AI-powered second brain that captures thoughts, learns who you are, and eventually acts as an extension of yourself |
| **Phase 1 Focus** | System of Record — capture and structure |

### What We're Building

A voice and text note-taking PWA that:
1. **CAPTURES** thoughts via voice (Web Speech API) or text input
2. **CLASSIFIES** into 4 categories: Personal, Work, Health, Ideas
3. **EXTRACTS** metadata: title, topics, actions, sentiment, people
4. **REFINES** into professional shareable output
5. **STORES** locally in IndexedDB (never leaves device)
6. **WORKS OFFLINE** as installable PWA

### Success Statement

> "I speak or type my thoughts, and instantly get professional, structured notes I can share — while building a machine-readable dataset of my life."

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Structure** | HTML5 | Single index.html |
| **Styling** | CSS3 | Vanilla, no framework |
| **Logic** | Vanilla JavaScript (ES6+) | No build step |
| **Voice** | Web Speech API | Built into browsers |
| **Storage** | IndexedDB | Local, encrypted by browser |
| **Offline** | Service Worker | Cache all assets |
| **Hosting** | Vercel | Free, global CDN |

---

## 3. File Structure

```
digital-twin/
├── index.html              # Main app (single page)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│   └── styles.css          # All styles (design system)
├── js/
│   ├── app.js              # Main controller
│   ├── db.js               # IndexedDB operations
│   ├── classifier.js       # 4-category classification
│   ├── extractor.js        # Metadata extraction
│   ├── refiner.js          # Professional formatting
│   ├── voice.js            # Web Speech API
│   └── ui.js               # UI interactions
├── assets/
│   ├── icon-192.png        # PWA icon
│   └── icon-512.png        # PWA icon
├── docs/
│   └── PRD.md              # Full requirements
├── stories/
│   ├── backlog.json        # User stories
│   ├── current.json        # In progress
│   └── done.json           # Completed
├── learnings.json          # Persistent memory
└── CLAUDE.md               # This file
```

---

## 4. Design System (FOLLOW EXACTLY)

### 4.1 Design Philosophy

**Inspired by:** Modern Soho NYC design agencies — Pentagram, Collins, Mother Design

**Principles:**
- **Radical simplicity** — One screen does one thing
- **Invisible UI** — Interface disappears, content shines
- **Typography-first** — Beautiful type hierarchy, minimal decoration
- **Confident whitespace** — Let content breathe
- **Monochrome base** — Black and white ONLY, no other colors
- **Zero friction** — Capture in under 3 seconds

### 4.2 Color Palette (STRICT)

```css
:root {
  /* PRIMARY — Use these for everything */
  --color-black: #000000;      /* Text, icons, primary actions */
  --color-white: #FFFFFF;      /* Backgrounds, cards */
  
  /* SUBTLE — Use sparingly */
  --color-gray-50: #FAFAFA;    /* Subtle backgrounds */
  --color-gray-100: #F5F5F5;   /* Dividers, borders */
  --color-gray-200: #EEEEEE;   /* Hover states */
  --color-gray-400: #9E9E9E;   /* Secondary text */
  --color-gray-600: #757575;   /* Placeholder text */
}

/* ⚠️ NO OTHER COLORS ALLOWED */
/* Categories are distinguished by ICON, not color */
```

### 4.3 Typography

```css
:root {
  /* Font Stack */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', 'Consolas', monospace;
  
  /* Type Scale */
  --text-title: 2rem;        /* 32px - Main titles */
  --text-heading: 1.25rem;   /* 20px - Section heads */
  --text-body: 1rem;         /* 16px - Primary content */
  --text-caption: 0.8125rem; /* 13px - Timestamps, metadata */
  --text-micro: 0.6875rem;   /* 11px - Labels, UPPERCASE */
  
  /* Font Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  
  /* Letter Spacing */
  --tracking-tight: -0.02em;  /* Titles */
  --tracking-normal: 0;       /* Body */
  --tracking-wide: 0.02em;    /* Micro/uppercase */
}
```

### 4.4 Spacing Scale

```css
:root {
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
  --space-3xl: 4rem;     /* 64px */
}
```

### 4.5 Borders & Radius

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;  /* Pills, circles */
  
  --border-thin: 1px solid var(--color-gray-100);
  --border-medium: 1px solid var(--color-gray-200);
}
```

### 4.6 Shadows (Use Sparingly)

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.05);
}
```

### 4.7 Transitions

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
}
```

---

## 5. Categories (4 Total)

### 5.1 Category Definitions

| Category | Icon | Description |
|----------|------|-------------|
| **Personal** | 🏠 | Family, relationships, life admin, emotions, hobbies |
| **Work** | 💼 | Velolume, meetings, clients, business, partnerships |
| **Health** | 💪 | Physical fitness, mental health, medical, wellness |
| **Ideas** | 💡 | Business ideas, strategies, reflections, future plans |

### 5.2 Classification Keywords

```javascript
const KEYWORDS = {
  personal: [
    'family', 'mom', 'dad', 'friend', 'home', 'weekend', 'dinner',
    'birthday', 'movie', 'relationship', 'kids', 'wife', 'husband',
    'girlfriend', 'boyfriend', 'pet', 'dog', 'cat', 'holiday', 'trip',
    'vacation', 'wedding', 'party', 'personal', 'life'
  ],
  
  work: [
    'velolume', 'meeting', 'client', 'investor', 'revenue', 'deadline',
    'project', 'team', 'business', 'partnership', 'pitch', 'proposal',
    'hire', 'demo', 'trust', 'spv', 'jv', 'strategy', 'product', 'api',
    'launch', 'startup', 'funding', 'sales', 'marketing', 'ceo', 'cto',
    'interview', 'presentation', 'deck', 'roadmap', 'sprint'
  ],
  
  health: [
    'gym', 'exercise', 'health', 'sleep', 'meditation', 'doctor',
    'dentist', 'workout', 'fitness', 'stress', 'energy', 'tired',
    'sick', 'mental', 'therapy', 'wellness', 'run', 'yoga', 'weight',
    'diet', 'nutrition', 'water', 'steps', 'walk', 'rest'
  ],
  
  ideas: [
    'idea', 'thinking', 'maybe', 'could', 'future', 'plan', 'vision',
    'opportunity', 'experiment', 'hypothesis', 'explore', 'brainstorm',
    'innovation', 'concept', 'possibility', 'what if', 'wonder',
    'imagine', 'potential', 'theory'
  ]
};
```

### 5.3 Classification Algorithm

```javascript
function classify(text) {
  const lower = text.toLowerCase();
  
  // Count keyword matches per category
  const scores = {};
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    scores[category] = keywords.filter(kw => lower.includes(kw)).length;
  }
  
  // Find highest score
  const max = Math.max(...Object.values(scores));
  
  // Default to personal if no matches
  if (max === 0) {
    return { category: 'personal', confidence: 0.5, reasoning: 'No keywords matched, defaulting to personal' };
  }
  
  // Get winning category
  const category = Object.keys(scores).find(k => scores[k] === max);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.round((max / total) * 100) / 100;
  
  return {
    category,
    confidence,
    reasoning: `Matched ${max} ${category} keywords`
  };
}
```

---

## 6. Database Schema (FOLLOW EXACTLY)

### 6.1 IndexedDB Setup

```javascript
const DB_NAME = 'digital-twin';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

// Indexes
// - by_date: timestamps.input_date
// - by_category: classification.category
// - by_created: timestamps.created_at
```

### 6.2 Note Object Schema

```javascript
const noteSchema = {
  // Unique identifier
  id: "dt_20250110_143052_a7x",  // Format: dt_YYYYMMDD_HHMMSS_xxx
  version: "1.0",
  
  // Timestamps (REQUIRED - include all fields)
  timestamps: {
    created_at: "2025-01-10T14:30:52+08:00",  // ISO 8601 with timezone
    input_date: "2025-01-10",                  // YYYY-MM-DD
    input_time: "14:30",                       // HH:MM (24h)
    input_timezone: "Asia/Singapore",          // IANA timezone
    day_of_week: "Friday"                      // Full day name
  },
  
  // Input data
  input: {
    type: "voice",  // "voice" or "text"
    raw_text: "so yeah the meeting went well um they want to partner...",
    duration_seconds: 45  // Only for voice
  },
  
  // Classification result
  classification: {
    category: "work",  // personal, work, health, ideas
    confidence: 0.87,  // 0.0 to 1.0
    reasoning: "Matched 5 work keywords: meeting, partner, proposal, team, workshop"
  },
  
  // Extracted metadata
  extracted: {
    title: "Meeting with Trust Company",           // Max 50 chars
    topics: ["meetings", "partnerships"],          // Max 5
    action_items: [
      "Wait for written proposal",
      "Schedule team workshop"
    ],
    sentiment: "positive",  // positive, negative, neutral
    people: ["Mario Ho"]    // Extracted names
  },
  
  // Refined output (THE KEY FEATURE)
  refined: {
    summary: "Productive meeting with trust company. They expressed strong interest in partnership and will send formal proposal.",
    formatted_output: "# Meeting with Trust Company\n\n**Friday, January 10, 2025**\n..."
  },
  
  // Machine-readable (for future AI agents)
  machine_readable: {
    schema_type: "DigitalTwin.Note/v1",
    entities: [
      { type: "person", value: "Mario Ho" },
      { type: "organization", value: "Trust Company" }
    ],
    relationships: [
      { from: "Rox", to: "Trust Company", type: "partnership_discussion" }
    ],
    temporal: {
      event_type: "meeting",
      follow_up_expected: true
    }
  }
};
```

### 6.3 ID Generation

```javascript
function generateId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 5);
  return `dt_${date}_${time}_${random}`;
}
// Output: dt_20250110_143052_a7x
```

---

## 7. Refinement Templates (FOLLOW EXACTLY)

### 7.1 Work Template

```markdown
# [TITLE]

**[DAY], [MONTH] [DATE], [YEAR]**  
**[TIME] [TIMEZONE]**  
**💼 Work**

---

## Summary

[2-3 sentence professional summary. Clean, no filler words.]

---

## Key Points

• [Point 1]
• [Point 2]
• [Point 3]

---

## Action Items

☐ [Action 1]
☐ [Action 2]
☐ [Action 3]

---

## People Mentioned

• [Person 1]
• [Person 2]

---

*Captured by Digital Twin*
```

### 7.2 Personal Template

```markdown
# [TITLE]

**[DAY], [MONTH] [DATE], [YEAR]**  
**[TIME] [TIMEZONE]**  
**🏠 Personal**

---

[Clean, readable narrative. Remove filler words. Keep it natural but polished.]

---

## Reminders

☐ [Reminder 1]
☐ [Reminder 2]

---

*Captured by Digital Twin*
```

### 7.3 Health Template

```markdown
# [TITLE]

**[DAY], [MONTH] [DATE], [YEAR]**  
**[TIME] [TIMEZONE]**  
**💪 Health**

---

## Check-in

[Clean narrative of health update. Energy levels, activities, feelings.]

---

## Mood

[Sentiment: Positive / Neutral / Negative]

---

## Reminders

☐ [Reminder 1]
☐ [Reminder 2]

---

*Captured by Digital Twin*
```

### 7.4 Ideas Template

```markdown
# [TITLE]

**[DAY], [MONTH] [DATE], [YEAR]**  
**[TIME] [TIMEZONE]**  
**💡 Idea**

---

## Concept

[The core idea, cleaned up and articulated clearly.]

---

## Potential

[Any mentioned benefits, opportunities, or possibilities.]

---

## Next Steps

☐ [Exploration action 1]
☐ [Exploration action 2]

---

*Captured by Digital Twin*
```

### 7.5 Refinement Rules

```javascript
// Filler words to remove
const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'so yeah', 'basically',
  'actually', 'literally', 'kind of', 'sort of', 'i mean',
  'right', 'okay so', 'well'
];

// Clean text function
function cleanText(text) {
  let cleaned = text;
  FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  // Remove extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned;
}
```

---

## 8. Extraction Rules

### 8.1 Title Generation

```javascript
function generateTitle(text) {
  // Get first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();
  
  // Clean filler words
  let title = cleanText(firstSentence);
  
  // Truncate to 50 chars at word boundary
  if (title.length > 50) {
    title = title.substring(0, 47).replace(/\s+\S*$/, '') + '...';
  }
  
  // Fallback
  if (!title || title.length < 3) {
    title = 'Untitled Note';
  }
  
  return title;
}
```

### 8.2 Action Item Extraction

```javascript
const ACTION_TRIGGERS = [
  /need to ([^.!?]+)/gi,
  /should ([^.!?]+)/gi,
  /must ([^.!?]+)/gi,
  /have to ([^.!?]+)/gi,
  /remember to ([^.!?]+)/gi,
  /don't forget (?:to )?([^.!?]+)/gi,
  /going to ([^.!?]+)/gi,
  /want to ([^.!?]+)/gi,
  /will ([^.!?]+)/gi
];

const FALSE_POSITIVES = ['used to', 'supposed to', 'want to know', 'want to see'];

function extractActions(text) {
  const actions = [];
  
  ACTION_TRIGGERS.forEach(regex => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const action = match[1].trim();
      // Filter false positives
      const isFalsePositive = FALSE_POSITIVES.some(fp => 
        match[0].toLowerCase().includes(fp)
      );
      if (!isFalsePositive && action.length > 3) {
        actions.push(action.charAt(0).toUpperCase() + action.slice(1));
      }
    }
  });
  
  return [...new Set(actions)]; // Remove duplicates
}
```

### 8.3 Sentiment Analysis

```javascript
const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
  'happy', 'excited', 'love', 'awesome', 'perfect', 'best',
  'well', 'positive', 'success', 'productive', 'energized'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'stressed', 'worried',
  'anxious', 'frustrated', 'difficult', 'hard', 'problem', 'issue',
  'tired', 'exhausted', 'sick', 'pain', 'fail', 'negative'
];

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const positiveCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const negativeCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}
```

### 8.4 People Extraction

```javascript
const COMMON_WORDS = [
  'I', 'The', 'This', 'That', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February',
  'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'Today', 'Tomorrow', 'Yesterday'
];

function extractPeople(text) {
  // Find capitalized words that might be names
  const words = text.match(/\b[A-Z][a-z]+\b/g) || [];
  
  // Filter common words
  const people = words.filter(word => !COMMON_WORDS.includes(word));
  
  return [...new Set(people)];
}
```

---

## 9. UI Components

### 9.1 Voice Button States

```css
/* Idle state */
.voice-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid var(--color-black);
  background: var(--color-white);
  cursor: pointer;
  transition: var(--transition-normal);
}

/* Recording state */
.voice-btn.recording {
  background: var(--color-black);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Processing state */
.voice-btn.processing {
  border-style: dashed;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### 9.2 Note Card

```css
.note-card {
  background: var(--color-white);
  border: var(--border-thin);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.note-card:hover {
  border-color: var(--color-gray-200);
}

.note-card:active {
  background: var(--color-gray-50);
}
```

### 9.3 Category Badge

```css
.category-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-micro);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--color-gray-600);
}
```

### 9.4 Toast Notification

```css
.toast {
  position: fixed;
  bottom: calc(80px + var(--space-lg)); /* Above nav */
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-black);
  color: var(--color-white);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-full);
  font-size: var(--text-caption);
  font-weight: var(--weight-medium);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.toast.visible {
  opacity: 1;
}
```

---

## 10. Sample Input/Output

### 10.1 Work Meeting Example

**Input (voice):**
```
so yeah the meeting with the trust company went pretty well um they're clearly 
interested in working with us they mentioned they did the mario ho family office 
and boston celtics deal uh main discussion was about partnership structure they 
want us to put capital in but i pushed back said that's not the entry point they 
were receptive next steps they'll send a proposal and we need to schedule a team workshop
```

**Output (formatted):**
```markdown
# Meeting with Trust Company

**Friday, January 10, 2025**  
**2:30 PM SGT**  
**💼 Work**

---

## Summary

Productive meeting with trust company. They expressed strong interest in partnership and have relevant credentials including the Mario Ho family office and Boston Celtics deal. Discussion centered on structure — they proposed capital placement but we maintained that capital shouldn't be the entry point. They were receptive and will follow up with a formal proposal.

---

## Key Points

• Strong interest in partnership from their side
• Credentials include Mario Ho family office and Boston Celtics
• Capital placement proposed but we pushed back
• They were receptive to alternative structure

---

## Action Items

☐ Wait for written proposal
☐ Schedule team workshop

---

## People Mentioned

• Mario Ho

---

*Captured by Digital Twin*
```

### 10.2 Personal Example

**Input (text):**
```
need to call mom this weekend about dinner also should get back to the gym 
haven't been in two weeks feeling kind of tired lately
```

**Output (formatted):**
```markdown
# Weekend Plans and Self-Care

**Friday, January 10, 2025**  
**9:15 PM SGT**  
**🏠 Personal**

---

Planning to call mom this weekend about dinner. Been two weeks since the gym and feeling tired — time to get back on track with exercise.

---

## Reminders

☐ Call mom about weekend dinner
☐ Get back to the gym

---

*Captured by Digital Twin*
```

### 10.3 Health Example

**Input (voice):**
```
good workout this morning did 30 minutes cardio and some weights feeling 
energized slept about 7 hours last night which is better than usual
```

**Output (formatted):**
```markdown
# Morning Workout Check-in

**Friday, January 10, 2025**  
**7:45 AM SGT**  
**💪 Health**

---

## Check-in

Good workout this morning — 30 minutes cardio plus weights. Slept about 7 hours last night, which is better than usual. Feeling energized and ready for the day.

---

## Mood

Positive

---

*Captured by Digital Twin*
```

### 10.4 Ideas Example

**Input (text):**
```
what if velolume could integrate directly with mcp servers then other ai 
agents could query creator data directly without needing api calls this 
could position us as the intelligence layer for the creator economy
```

**Output (formatted):**
```markdown
# MCP Integration Concept

**Friday, January 10, 2025**  
**11:30 PM SGT**  
**💡 Idea**

---

## Concept

Velolume could integrate directly with MCP servers, allowing other AI agents to query creator data without needing traditional API calls.

---

## Potential

This could position Velolume as the intelligence layer for the creator economy — becoming the go-to data source for AI agents working with creator content.

---

## Next Steps

☐ Research MCP server integration requirements
☐ Explore what "intelligence layer" positioning means

---

*Captured by Digital Twin*
```

---

## 11. Story Workflow

### 11.1 Standard Flow

```
1. Read story from backlog.json
2. Update current.json with story ID
3. Implement ALL acceptance_criteria
4. Ensure NO not_done_if conditions are true
5. Run verification command
6. Log learnings to learnings.json
7. Update story status to 'done' in backlog.json
8. Add story to done.json
9. Clear current.json
10. Git commit
11. Output: <promise>STORY_COMPLETE</promise>
```

### 11.2 Logging Learnings (REQUIRED)

Before marking any story complete, ask:
- Did verification fail initially? Why?
- Did I discover an edge case?
- Did I find a better approach?
- Was anything confusing?

If YES to any, add to learnings.json:

```json
{
  "id": "LEARN-XXX",
  "timestamp": "ISO-8601",
  "story_id": "DT-XXX",
  "category": "error|edge_case|pattern|discovery",
  "what_happened": "Description",
  "lesson": "What was learned",
  "resolution": "How it was fixed"
}
```

### 11.3 Error Recovery

- If verification fails 3 times → Mark story as "blocked"
- Output: `<promise>STORY_BLOCKED</promise>`
- Move to next story
- Log detailed blocker in learnings.json

---

## 12. Commands

### Development

```bash
# Start local server
python -m http.server 8000

# Open in browser
open http://localhost:8000

# Test mobile
# Use browser dev tools → device toolbar → select mobile
```

### Deployment

```bash
# Deploy to Vercel
vercel --prod
```

---

## 13. Quality Checklist

Before completing ANY story:

- [ ] All acceptance_criteria pass
- [ ] No not_done_if conditions are true
- [ ] Works on mobile (375px viewport)
- [ ] Follows black/white design system (NO other colors)
- [ ] Typography matches design tokens
- [ ] No console errors
- [ ] Learnings logged if applicable
- [ ] Code is clean and readable

---

## 14. Critical Reminders

1. **ALWAYS read learnings.json first** — You will repeat mistakes otherwise
2. **ALWAYS log learnings** — Future sessions depend on this
3. **Design is BLACK & WHITE only** — No other colors allowed
4. **Mobile-first** — Test at 375px width
5. **Timestamps must include** — Date, time, timezone, day of week
6. **Refinement must be professional** — Ready to share without editing
7. **Stories in order** — Dependencies exist
8. **One story per iteration** — Don't combine

---

*Last updated: 2025-01-10*
