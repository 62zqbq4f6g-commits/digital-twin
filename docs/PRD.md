# Product Requirements Document: Digital Twin

**Version:** 2.0  
**Owner:** Rox  
**Status:** Ready for Build  
**Created:** 2025-01-10  
**Architecture:** Progressive Web App (PWA)

---

## 1. Vision

### 1.1 The Big Picture

**Digital Twin** is an AI-powered second brain that captures your thoughts, learns who you are, and eventually acts as an extension of yourself.

**Three Phases:**
1. **CAPTURE (Phase 1 - Now)** — System of Record
2. **LEARN (Phase 2)** — System of Intelligence  
3. **ACT (Phase 3)** — System of Action

### 1.2 Phase 1 Focus

> "I speak or type my thoughts, and instantly get professional, structured notes I can share — while building a machine-readable dataset of my life."

---

## 2. Problem Statement

| Pain | Impact |
|------|--------|
| Thoughts disappear | Ideas lost forever |
| Voice notes are messy | Can't share with team |
| Manual cleanup required | 5-10 min per note |
| No system of record | No learning over time |

---

## 3. Solution

### What We're Building

A PWA that:
1. Captures via voice (Web Speech API) or text
2. Classifies into 4 categories
3. Extracts metadata
4. Refines into professional output
5. Stores locally in IndexedDB
6. Works offline

### Tech Stack

| Layer | Technology |
|-------|------------|
| Structure | HTML5 |
| Styling | CSS3 (vanilla) |
| Logic | Vanilla JS (ES6+) |
| Voice | Web Speech API |
| Storage | IndexedDB |
| Offline | Service Worker |
| Hosting | Vercel |

---

## 4. Design System

### Philosophy
Minimalist black/white Soho NYC aesthetic. Typography-first. Confident whitespace.

### Colors (STRICT)
- Black: #000000
- White: #FFFFFF
- Grays: #FAFAFA, #F5F5F5, #9E9E9E, #757575
- NO other colors

### Typography
- Font: SF Pro Display / Inter
- Scale: 32px → 11px

---

## 5. Categories

| Category | Icon | Keywords |
|----------|------|----------|
| Personal | 🏠 | family, mom, dad, friend, home, weekend... |
| Work | 💼 | velolume, meeting, client, investor, project... |
| Health | 💪 | gym, exercise, sleep, meditation, energy... |
| Ideas | 💡 | idea, thinking, future, plan, vision... |

Default: Personal (if no keywords match)

---

## 6. Data Schema

```json
{
  "id": "dt_YYYYMMDD_HHMMSS_xxx",
  "timestamps": {
    "created_at": "ISO-8601",
    "input_date": "YYYY-MM-DD",
    "input_time": "HH:MM",
    "input_timezone": "Asia/Singapore",
    "day_of_week": "Friday"
  },
  "input": { "type": "voice|text", "raw_text": "..." },
  "classification": { "category": "work", "confidence": 0.87 },
  "extracted": { "title": "...", "action_items": [], "sentiment": "positive" },
  "refined": { "summary": "...", "formatted_output": "..." },
  "machine_readable": { "entities": [], "relationships": [] }
}
```

---

## 7. Refinement Templates

### Work
Title, Date/Time/Timezone, Summary, Key Points, Action Items, People

### Personal
Title, Date/Time/Timezone, Narrative, Reminders

### Health
Title, Date/Time/Timezone, Check-in, Mood, Reminders

### Ideas
Title, Date/Time/Timezone, Concept, Potential, Next Steps

---

## 8. Security

- Data stored locally only (IndexedDB)
- Never leaves device
- Browser-level encryption
- Manual export for backup

---

## 9. User Stories

14 stories, ~8 hours total build time:

1. DT-001: PWA foundation
2. DT-002: Design system CSS
3. DT-003: IndexedDB database
4. DT-004: App shell UI
5. DT-005: Text input
6. DT-006: Voice input
7. DT-007: Classifier
8. DT-008: Extractor
9. DT-009: Refiner
10. DT-010: Processing pipeline
11. DT-011: Notes list UI
12. DT-012: Note detail UI
13. DT-013: Copy & Export
14. DT-014: Offline & PWA

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Capture time | < 3 seconds |
| Daily usage | 3+ notes/day |
| Classification accuracy | > 80% |
| Refinement quality | Shareable without edits |

---

## 11. Roadmap

### Phase 1 (Now): Capture
MVP with voice + text input, 4 categories, professional output

### Phase 2: Enrich
Image/video input, Claude API, encrypted backup

### Phase 3: Learn
Pattern detection, insights, connections

### Phase 4: Act
Reminders, calendar integration, workflow triggers

---

*Full specifications in CLAUDE.md*
