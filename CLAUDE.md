# CLAUDE.md — Digital Twin PWA

## Every Session: Do These Steps FIRST

1. cat learnings.json
2. cat stories/backlog.json
3. Find first story with status "backlog"
4. Implement that story (ALL acceptance_criteria must pass)
5. Run the verification command
6. Update story status to "done" in backlog.json
7. Add story to stories/done.json
8. git add -A && git commit -m "Complete [STORY_ID]: [title]"
9. Output: <promise>STORY_COMPLETE</promise>

---

## Project Identity

**Name:** Digital Twin
**Type:** Progressive Web App (PWA)
**Owner:** Rox
**Version:** 0.1.0
**Purpose:** AI-powered second brain — capture thoughts, get professional structured notes

---

## The Vision

```
PHASE 1 (NOW)     PHASE 2           PHASE 3
─────────────     ───────           ───────
CAPTURE           LEARN             ACT
System of Record  System of Intel   System of Action

Voice/Text →      Pattern detect →  Draft emails
Classify →        Insights →        Set reminders
Extract →         Predictions →     Trigger flows
Refine →          Connections →     Be proactive
Store locally
```

---

## What We're Building (Phase 1 MVP)

A PWA that:
1. **Captures** voice or text input
2. **Classifies** into 4 categories (Personal, Work, Health, Ideas)
3. **Extracts** title, topics, action items, sentiment, people
4. **Refines** raw input into professional shareable format
5. **Stores** in IndexedDB (100% local, never leaves device)
6. **Displays** in beautiful minimal UI

> "Speak naturally, get professional structured notes — zero manual work."

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vanilla JS + HTML/CSS |
| Voice | Web Speech API |
| Storage | IndexedDB |
| Offline | Service Worker |
| Hosting | Vercel (free) |
| Design | Soho NYC minimal (black/white, typography-first) |

---

## Directory Structure

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
├── docs/
│   └── PRD.md
├── stories/
│   ├── backlog.json
│   └── done.json
└── learnings.json
```

---

## 4 Categories

| Category | Icon | Example Keywords |
|----------|------|------------------|
| Personal | 🏠 | family, mom, dad, friend, home, weekend, dinner |
| Work | 💼 | velolume, meeting, client, investor, project, pitch |
| Health | 💪 | gym, exercise, sleep, meditation, doctor, stress |
| Ideas | 💡 | idea, what if, maybe, could, future, experiment |

**Default:** If no keywords match → Personal

---

## Note Schema

```json
{
  "id": "dt_20250110_143052_a7x",
  "timestamps": { "created_at": "ISO-8601", "day_of_week": "Friday" },
  "input": { "type": "voice|text", "raw_text": "..." },
  "classification": { "category": "work", "confidence": 0.87 },
  "extracted": { "title": "...", "topics": [], "action_items": [], "sentiment": "positive", "people": [] },
  "refined": { "summary": "...", "formatted_output": "..." }
}
```

---

## Story Workflow

1. Find first story with status "backlog"
2. Create files in files_to_create
3. Meet ALL acceptance_criteria
4. Run verification command
5. Update backlog.json status to "done"
6. Add to done.json
7. Git commit
8. Output: <promise>STORY_COMPLETE</promise>

---

## Design Principles

- **Radical simplicity** — one screen does one thing
- **Typography-first** — beautiful type, minimal decoration
- **Monochrome** — black/white, color only for category icons
- **Zero friction** — capture in under 3 seconds
