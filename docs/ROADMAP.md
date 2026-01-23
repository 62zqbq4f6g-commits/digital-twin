# Inscript — Development Roadmap

## January 24, 2026 | Version 8.5.0

---

## Current Status

**Beta Ready:** Quality fixes deployed, SoHo editorial design refined
**Production:** https://digital-twin-ecru.vercel.app
**Design System:** SoHo Editorial Aesthetic ✅
**Mobile Responsive:** Verified at 375px ✅

---

## Completed Phases

### Phase 8: Intelligent Twin
- Twin profile and learning
- Entity extraction pipeline
- Basic memory operations

### Phase 9: Personalization
- 8-screen onboarding flow
- Seeded people recognition
- Life season context

### Phase 10: Entity Extraction & Relationships
- LLM-powered extraction
- Importance classification
- Relationship graph
- Semantic search (pgvector)
- Cross-memory reasoning

### Phase 11: Inscript Rebrand
- Digital Twin → Inscript rebrand
- Editorial design system
- Privacy promise
- Production deployment

### Phase 13A: Pattern Foundation
- LLM hybrid pattern detection
- Pattern storage
- Pattern API

### Phase 13B: MIRROR Foundation
- MIRROR tab implementation
- Conversation flow
- Basic API integration

### Phase 13C: MIRROR Intelligence
- Signal-based prompts
- Context-aware responses
- Memory integration

### Phase 13D: Pattern Verification UI
- Inline pattern display
- TWIN section patterns
- User feedback on patterns

### Phase 13E: Polish & Bug Fixes
- Pre-beta holistic testing (93% pass)
- Key People fix (pets recognized)
- Documentation update

### Mem0 Parity (~95%)
- Query synthesis
- Summary evolution (LLM rewrite)
- Hybrid retrieval (vector + keyword)
- Tiered retrieval (3 tiers)
- Context assembly with time decay

### Phase 14.1: Quality Fixes (January 24, 2026) ✅
- Key People unique constraint migration
- Stats Supabase fallback (race condition fix)
- SoHo Editorial CSS refinements (NOTES + WORK tabs)
- Mobile responsiveness audit (375px verified)

### Phase 14.2: Critical Quality Fixes (January 24, 2026 Evening) ✅
**Commit:** `1da6dda`
- **Key People in MIRROR** — Strengthened system prompt, absolute directive
- **Pattern Quality** — LLM prompt + temporal post-processing filter
- **TWIN Stats Immediate Loading** — `loadStatsImmediately()` with Supabase fallback
- **Action Extraction** — `isActionable()` filter for AI-generated actions

---

## Current Sprint: Phase 15 Features

### Recently Completed ✅

| Task | Location | Status |
|------|----------|--------|
| Fix Key People in MIRROR | `api/mirror.js`, `api/chat.js` | ✅ Fixed |
| Fix pattern quality (temporal) | `api/detect-patterns.js` | ✅ Fixed |
| Fix TWIN stats loading | `js/twin-ui.js` | ✅ Fixed |
| Fix action extraction | `api/analyze.js` | ✅ Fixed |
| Fix MEETINGS "Invalid Date" | `js/work-ui.js` | ✅ Fixed |
| Fix Meeting double-save | `js/work-ui.js` | ✅ Fixed |
| Add Key People unique constraint | Migration | ✅ Done |
| Fix stats showing zero | `js/twin-ui.js` | ✅ Added fallback |

### P0 — Critical (This Week)

| Task | Location | Status |
|------|----------|--------|
| **Optimize app load speed** | `js/app.js`, `js/sync.js`, `js/twin-ui.js` | 🔴 Critical |
| Set up Vercel Cron for memory maintenance | `/api/cron/` | Open |
| Begin Phase 15 Task #0 (RLS Policies) | Supabase | Open |

#### Load Speed Investigation Areas
- Sync pulls all notes sequentially (should parallelize)
- TwinUI, Entities, Patterns init independently (should coordinate)
- May be hitting Tier 3 retrieval unnecessarily
- Large JS files (ui.js 4900 lines) slow to parse
- Consider lazy loading tabs, skeleton UI, aggressive caching

### P1 — Important (This Sprint)

| Task | Location | Status |
|------|----------|--------|
| Improve entity classification (filter job titles) | `api/extract-entities.js` | Open |
| Add duplicate entity detection | `api/analyze.js` | Open |
| Split ui.js into modules | `js/ui.js` | Open |

---

## Current Phase

### Phase 15: Experience Transformation 🔄 IN PROGRESS

**Goal:** Make accumulated value visible and reduce capture friction

**The 3 High-Impact Features:**

| # | Feature | Impact | Description |
|---|---------|--------|-------------|
| 1 | **State of You** | 10X | Monthly auto-generated report |
| 2 | **Whispers** | 5X | Quick capture mode |
| 3 | **Memory Moments** | 10X | Proactive memory surfacing |

**Task List ID:** `phase15-experience-transform`

#### Feature 1: State of You (Monthly Report)

| Component | Owner | Status |
|-----------|-------|--------|
| `api/state-of-you.js` | T1 | 🔲 |
| `api/cron/monthly-report.js` | T1 | 🔲 |
| `js/state-of-you-ui.js` | T2 | 🔲 |
| `css/state-of-you.css` | T2 | 🔲 |
| TWIN tab integration | T2 | 🔲 |

#### Feature 2: Whispers (Quick Capture)

| Component | Owner | Status |
|-----------|-------|--------|
| `api/whisper.js` | T1 | 🔲 |
| `js/whisper-ui.js` | T2 | 🔲 |
| `css/whisper.css` | T2 | 🔲 |
| Whisper input mode | T2 | 🔲 |
| Whisper history | T2 | 🔲 |
| Batch reflection | T2 | 🔲 |

#### Feature 3: Memory Moments (Proactive Surfacing)

| Component | Owner | Status |
|-----------|-------|--------|
| `api/memory-moments.js` | T1 | 🔲 |
| `api/cron/memory-moments.js` | T1 | 🔲 |
| Anniversary triggers | T1 | 🔲 |
| Dormant entity triggers | T1 | 🔲 |
| Progress triggers | T1 | 🔲 |
| `js/memory-moments-ui.js` | T2 | 🔲 |
| `css/memory-moments.css` | T2 | 🔲 |
| NOTES tab integration | T2 | 🔲 |

#### Database (Phase 15)

| Table | Purpose | Status |
|-------|---------|--------|
| `user_reports` | Monthly reports | 🔲 |
| `whispers` | Quick captures | 🔲 |
| `memory_moments` | Proactive surfacing | 🔲 |
| `user_notification_preferences` | Settings | 🔲 |

**Success Criteria:**
- Monthly report generates and displays correctly
- Whispers save without triggering reflection
- Memory Moments surface proactively
- All features mobile responsive

---

## Completed Phases

### Phase 14: Production Hardening ✅

**Completed:** January 23, 2026

| Task | Status |
|------|--------|
| Fix 406 onboarding error | ✅ |
| Fix 500 Pulse API error | ✅ |
| Fix Invalid Date in MEETINGS | ✅ |
| Fix Meeting double-save | ✅ |
| Parallel terminal setup | ✅ |

---

## Upcoming Phases

---

### Phase 16: Advanced Memory

**Goal:** Deepen the "it knows me" experience

| Priority | Task | Description |
|----------|------|-------------|
| P0 | Memory milestones | 30/90/365 day reviews |
| P0 | "What does Inscript know?" | Natural language memory query |
| P1 | Memory visualization | Entity/relationship graph |
| P1 | Monthly memory summaries | Automated insights |
| P2 | Memory export | Download your data |

**Success Criteria:**
- Users receive milestone notifications
- Memory query accuracy > 80%
- Visualization renders in < 1s

---

### Phase 17: Growth

**Goal:** Increase engagement and retention

| Priority | Task | Description |
|----------|------|-------------|
| P1 | Push notifications | Daily reflection prompts |
| P1 | Weekly digest emails | Memory highlights |
| P2 | Privacy-preserving sharing | Share insights, not data |
| P2 | Community features | Optional shared patterns |

**Success Criteria:**
- D7 retention > 50%
- D30 retention > 30%
- NPS > 50

---

### Phase 18: Platform (Future)

**Goal:** Enable integrations and extensibility

| Priority | Task | Description |
|----------|------|-------------|
| P0 | MCP Server | Model Context Protocol integration |
| P1 | API access | Developer API for memory |
| P2 | Webhook support | Event notifications |
| P2 | Third-party integrations | Calendar, email, etc. |

---

## Technical Debt Backlog

### Critical (Must Fix)

| Issue | Impact | Location |
|-------|--------|----------|
| `ui.js` is 4,800+ lines | Maintainability | `js/ui.js` |
| `analyze.js` is 3,600+ lines | Maintainability | `api/analyze.js` |
| `styles.css` is 8,400+ lines | Maintainability | `css/styles.css` |

### Important (Should Fix)

| Issue | Impact |
|-------|--------|
| Mixed module exports (CommonJS + ESM) | Consistency |
| Double version log (8.0.0 + 7.0.0) | Confusing console |
| No Vercel Cron for maintenance | Memory decay not automated |

---

## Sprint Planning Template

### Sprint Goals
1. [Primary goal]
2. [Secondary goal]
3. [Stretch goal]

### Committed Tasks
- [ ] Task 1 (P0)
- [ ] Task 2 (P0)
- [ ] Task 3 (P1)

### Stretch Tasks
- [ ] Task 4 (P2)

### Definition of Done
- [ ] Code complete
- [ ] Tests passing
- [ ] Deployed to production
- [ ] Documentation updated

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| **8.5.0** | Jan 24, 2026 | Key People in MIRROR, pattern quality, immediate stats, action filtering |
| 8.3.0 | Jan 23, 2026 | Knowledge Pulse simplification |
| 8.2.0 | Jan 23, 2026 | Beta ready (93% tests) |
| 8.1.1 | Jan 21, 2026 | Category summaries fix |
| 8.1.0 | Jan 21, 2026 | Mem0 parity |
| 8.0.0 | Jan 20, 2026 | Phase 13 complete |
| 7.8.0 | Jan 19, 2026 | Cross-memory reasoning |
| 7.5.0 | Jan 19, 2026 | Semantic search |

---

*Roadmap — Inscript*
*Last Updated: January 24, 2026*
*Production: https://digital-twin-ecru.vercel.app*
