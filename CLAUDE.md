# CLAUDE.md — Digital Twin Note Agent

## Every Session: Do These Steps FIRST

1. cat learnings.json
2. cat stories/backlog.json (find first story with status "backlog")
3. Implement that story
4. Run verification command
5. Update story status to "done" in backlog.json
6. Add to stories/done.json
7. Git commit
8. Output: <promise>STORY_COMPLETE</promise>

## Project Overview

**Name:** Digital Twin Note Agent
**Purpose:** Convert Wispr voice transcriptions into organized, searchable notes

### How It Works (Once Built)

1. User speaks → Wispr creates .txt file
2. User drops file in data/inbox/
3. Agent classifies: Personal or Work
4. Agent extracts: title, topics, action items, sentiment
5. Agent saves to data/notes.json
6. User queries via CLI or web dashboard

## Directory Structure

digital-twin/
├── CLAUDE.md
├── config/settings.json
├── data/inbox/          ← Wispr files here
├── data/archive/        ← Processed files
├── data/notes.json      ← Database
├── src/classifier.py    ← Personal vs Work
├── src/extractor.py     ← Metadata extraction
├── src/storage.py       ← Database operations
├── src/watcher.py       ← File monitor
├── src/pipeline.py      ← Full flow
├── src/query.py         ← CLI queries
├── prompts/classification.md
├── web/dashboard.html
├── stories/backlog.json
├── stories/done.json
└── learnings.json

## Classification Keywords

Personal: family, health, gym, friend, hobby, home, feeling, weekend, vacation, personal, self, mom, dad, exercise, relax, meditation, sleep, birthday, dinner
Work: velolume, meeting, client, investor, revenue, deadline, project, team, strategy, product, business, api, integration, partnership, mcp, n8n, creator, pitch

Rule: If confidence < 0.6, default to "personal"

## Commands (After Built)

python src/pipeline.py --watch
python src/pipeline.py --once
python src/query.py --all
python src/query.py --personal
python src/query.py --work
python src/query.py --actions
python -m http.server 8000

## Story Workflow

1. Find first story with status "backlog"
2. Create files in files_to_create
3. Meet ALL acceptance_criteria
4. Run verification command
5. Update backlog.json status to "done"
6. Add to done.json
7. Git commit
8. Output: <promise>STORY_COMPLETE</promise>
