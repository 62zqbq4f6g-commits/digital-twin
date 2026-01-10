# CLAUDE.md — Digital Twin Note Agent

## ⚠️ CRITICAL: Start Every Session With These Steps

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

**Name:** Digital Twin Note Agent
**Owner:** Rox
**Version:** 0.1.0
**Purpose:** Convert Wispr voice transcriptions into professional, structured notes

---

## What We're Building

An automated voice-to-structured-data note-taking assistant that:
1. **Captures:** Wispr transcription files dropped into data/inbox/
2. **Classifies:** Personal or Work
3. **Extracts:** Title, topics, action items, sentiment, people
4. **Refines:** Converts raw voice transcription into professional structured output
5. **Stores:** JSON database for querying
6. **Outputs:** Professional format suitable for sharing with teams

### The Goal
> "Speak naturally, get professional structured notes — zero manual work."

---

## Key Feature: Professional Refinement

The agent doesn't just classify — it REFINES raw voice transcriptions into:
- Professional meeting minutes
- Structured updates for teams
- Clean action item lists
- Properly formatted summaries

Example transformation:
- INPUT: "so yeah the meeting went well they're interested in working with us talked about partnership structure and uh next steps are they'll send proposal"
- OUTPUT: Professional structured meeting summary with sections, action items, and clear formatting

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Voice Input | Wispr (external) |
| Processing | Python 3.10+ |
| Classification | Keyword matching |
| Refinement | Template-based structuring |
| Storage | JSON file |
| Preview | HTML dashboard |

---

## Directory Structure

digital-twin/
├── CLAUDE.md              ← This file
├── docs/PRD.md            ← Requirements
├── config/settings.json   ← Configuration
├── data/inbox/            ← Wispr files here
├── data/archive/          ← Processed files
├── data/notes.json        ← Database
├── src/
│   ├── classifier.py      ← Personal vs Work
│   ├── extractor.py       ← Metadata extraction
│   ├── refiner.py         ← Professional formatting
│   ├── storage.py         ← Database operations
│   ├── watcher.py         ← File monitor
│   ├── pipeline.py        ← Full flow
│   └── query.py           ← CLI queries
├── prompts/
│   └── classification.md  ← Classification examples
├── web/dashboard.html     ← Browser preview
├── stories/backlog.json   ← User stories
└── learnings.json         ← Persistent memory

---

## Classification Rules

### Personal Keywords
family, health, gym, friend, hobby, home, feeling, weekend, vacation, mom, dad, exercise, relax, meditation, sleep, birthday, dinner, movie, relationship, kids, wife, husband, pet

### Work Keywords
velolume, meeting, client, investor, revenue, deadline, project, team, strategy, product, business, api, integration, partnership, mcp, n8n, creator, pitch, deck, roadmap, sprint, launch, startup, funding, sales, marketing, hire, trust, spv, governance, proposal

### Default: If confidence < 0.6, classify as "personal"

---

## Commands (After Built)

python src/pipeline.py --watch    # Monitor inbox
python src/pipeline.py --once     # Process once
python src/query.py --all         # All notes
python src/query.py --work        # Work notes
python src/query.py --actions     # Action items
python -m http.server 8000        # Dashboard

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
