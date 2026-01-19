# Inscript — Project Status
## January 20, 2026 | Version 8.0.0

---

## Executive Summary

**Current State:** Phase 11 complete — deployed to production
**Production URL:** https://digital-twin-ecru.vercel.app
**Brand:** Inscript — "Your mirror in code"
**Category:** Personal AI Memory
**Previous Name:** Digital Twin / The Living Script
**Personalization:** VERIFIED — AI recognizes seeded people (tested: "Marcus—your close friend")
**Technical Debt:** `ui.js` at 4,824 lines must be split before major new work

---

## What's Working RIGHT NOW (Production)

| Feature | Status | Verified |
|---------|--------|----------|
| Login / Sign up | ✅ Live | Jan 20 |
| 8-screen onboarding flow | ✅ Live | Jan 20 |
| Note creation (text, voice, image) | ✅ Live | Jan 20 |
| AI reflection with personalization | ✅ Live | AI said "Marcus—your close friend" |
| Seeded people → AI context injection | ✅ Live | Tested |
| Entity extraction | ✅ Live | Jan 20 |
| Feedback (Resonates/Not quite) | ✅ Live | Jan 20 |
| Actions tab | ✅ Live | Jan 20 |
| TWIN tab with profile | ✅ Live | Jan 20 |
| Cloud sync (E2E encrypted) | ✅ Live | Jan 20 |
| PIN authentication | ✅ Live | Jan 20 |

---

## Phase 11 Deliverables

| Deliverable | Status |
|-------------|--------|
| Rebrand: Digital Twin → Inscript | ✅ Complete |
| 8-screen onboarding flow | ✅ Complete |
| Privacy promise screen | ✅ Complete |
| onboarding_data table + RLS | ✅ Complete |
| Seeded people → AI context | ✅ Complete |
| Login screen redesign | ✅ Complete |
| Editorial CSS (white bg, centered) | ✅ Complete |
| AI context injection (api/analyze.js) | ✅ Complete |
| Google Fonts (Playfair, Cormorant, Inter) | ✅ Complete |
| Production deployment | ✅ Complete (Jan 20, 2026) |
| Personalization test | ✅ PASSED |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **8.0.0** | Jan 20, 2026 | Phase 11: Inscript rebrand, 8-screen onboarding, AI context injection, production deploy |
| 7.8.0 | Jan 19, 2026 | Phase 10.6-10.8: Cross-memory reasoning, importance classification, automatic forgetting |
| 7.7.0 | Jan 19, 2026 | Phase 10.5: LLM memory compression |
| 7.6.0 | Jan 19, 2026 | Phase 10.4: LLM entity extraction |
| 7.5.0 | Jan 19, 2026 | Phase 10.3: Semantic search with pgvector |
| 7.4.0 | Jan 18, 2026 | Phase 9.4: Multi-select roles, editorial typography |
| 7.3.0 | Jan 18, 2026 | Phase 9.3: Design overhaul, loading overlay |

---

## Onboarding Flow (8 Screens)

| # | Screen | What It Captures |
|---|--------|------------------|
| 0 | Welcome | - |
| 1 | Name | User's name for personalization |
| 2 | Seasons | Life season (building, transition, healing, etc.) |
| 3 | Focus | What's on their mind (max 3 topics) |
| 4 | Depth | Contextual question + free-text answer |
| 5 | People | Seed 1-3 people with relationship context |
| 6 | Privacy | Privacy promise (data handling) |
| 7 | Wow | First note prompt |

**Data stored in:** `onboarding_data` table with RLS

---

## AI Context Injection

The AI receives user context in every analysis:

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

**Verified behavior:** When user mentioned Marcus in a note, AI responded with "Marcus—your close friend" in the reflection.

---

## Brand Identity

| Element | Value |
|---------|-------|
| **Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Voice** | Warm, intelligent, intimate, poetic |
| **Design** | Editorial minimalist (Linear x Vogue) |
| **Colors** | Black, white, silver only |
| **Fonts** | Playfair Display, Cormorant Garamond, Inter, JetBrains Mono |

---

## Technical Debt

### Critical (Must Fix Before Phase 12)

| File | Lines | Issue |
|------|-------|-------|
| `js/ui.js` | 4,824 | Must split into ui-core, ui-notes, ui-twin, ui-modals, ui-onboarding |
| `api/analyze.js` | 3,128 | Extract prompts to separate files |
| `css/styles.css` | 8,280 | Modularize by feature |

### Should Fix

- Consolidate `entities.js` and `entity-memory.js` (some overlap)
- Clean up verbose console logging for production
- Service worker disabled (intentional — no offline support yet)

---

## Database Schema (Key Tables)

### Core Tables
| Table | Purpose |
|-------|---------|
| `notes` | Encrypted note storage |
| `onboarding_data` | Phase 11 onboarding (name, seasons, focus, people) |
| `user_entities` | Auto-detected entities from notes |
| `user_profiles` | Legacy profile data |

### Memory System (Phase 10)
| Table | Purpose |
|-------|---------|
| `note_embeddings` | pgvector embeddings for semantic search |
| `memory_inferences` | Cross-memory reasoning results |
| `entity_relationships` | Relationship graph |

### Other Tables
`action_signals`, `decisions`, `entities`, `entity_corrections`, `nudge_effectiveness`, `output_feedback`, `quality_learning`, `twin_profiles`, `twin_relationships`, `user_feedback`, `user_inner_circle`, `user_key_people`, `user_learning_profile`, `user_salts`, `weekly_suggestions`

**RLS:** Enabled on all tables with `auth.uid() = user_id`

---

## API Endpoints

| Endpoint | Purpose | Lines |
|----------|---------|-------|
| `/api/analyze.js` | Main analysis pipeline + context injection | 3,128 |
| `/api/vision.js` | Image analysis (Claude Vision) | ~260 |
| `/api/chat.js` | Socratic dialogue | ~200 |
| `/api/embed.js` | OpenAI embeddings | ~50 |
| `/api/extract-entities.js` | LLM entity extraction | ~100 |
| `/api/compress-memory.js` | LLM memory compression | ~80 |
| `/api/infer-connections.js` | Cross-memory reasoning | ~90 |
| `/api/classify-importance.js` | Entity importance scoring | ~75 |
| `/api/recovery.js` | PIN recovery email | ~150 |
| `/api/refine.js` | Text refinement | ~120 |
| `/api/extract.js` | Entity/belief extraction | ~140 |
| `/api/patterns.js` | Pattern detection | ~150 |
| `/api/digest.js` | Weekly digest | ~120 |
| `/api/env.js` | Public Supabase config | ~30 |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API |
| `OPENAI_API_KEY` | Embeddings |
| `SUPABASE_URL` | Database URL |
| `SUPABASE_ANON_KEY` | Frontend key |
| `SUPABASE_SERVICE_KEY` | API-only key |
| `RESEND_API_KEY` | PIN recovery emails |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    index.html + js/*.js                         │
│    (Notes Tab | Actions Tab | TWIN Tab | Settings)              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  js/app.js      │    │  js/sync.js     │    │  js/pin.js      │
│  (Pipeline)     │    │  (Cloud)        │    │  (Encryption)   │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    api/*.js (Vercel)                            │
│  analyze | chat | vision | embed | infer-connections | etc.     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Supabase       │    │  Anthropic      │    │  OpenAI         │
│  PostgreSQL     │    │  Claude API     │    │  Embeddings     │
│  + pgvector     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Known Issues

| Issue | Priority | Status |
|-------|----------|--------|
| `ui.js` at 4,824 lines | P0 | Must split before Phase 12 |
| Service worker disabled | P3 | Intentional (no offline support) |
| Console verbose logging | P3 | Cleanup for production |

**No critical bugs in user-facing features.**

---

## Privacy Promise (Displayed in Onboarding)

```
Your thoughts stay private.

✓ Your notes are never reviewed by our team.
✓ We don't sell or share your data.
✓ We don't use your content to train AI.

Your world is yours alone.
```

**TODO:**
- [ ] Subscribe to enterprise LLM tier (training opt-out)
- [ ] Formal privacy policy page
- [ ] Data export functionality
- [ ] Data deletion functionality (beyond "Delete All My Data" in settings)

---

## Next Steps (Phase 12)

| Priority | Task |
|----------|------|
| P0 | Split `ui.js` into modules |
| P1 | Knowledge Pulse (show learning after save) |
| P1 | Entity Cards (click name → see context) |
| P2 | "What does Inscript know?" query |
| P2 | Pattern verification UI |
| P2 | Memory milestones (30/90/365 days) |
| P3 | Push notifications |

---

## Quick Commands

```bash
# Production URL
https://digital-twin-ecru.vercel.app

# Deploy to production
git add -A && git commit -m "message" && git push origin main
# (Vercel auto-deploys from main)

# Local dev
vercel dev --listen 3001

# Check version (browser console)
APP_VERSION  // "8.0.0"

# Force deploy
vercel --prod
```

---

## The Critical Test

> **PASSED:** When user wrote about Marcus, the AI responded:
> "I noticed you're holding input from Marcus—**your close friend**—alongside Sarah's pivot thinking..."

This is the "holy shit, it knows" moment working in production.

---

*Last Updated: January 20, 2026 01:00 SGT*
*Version: 8.0.0 — Inscript*
*Production: https://digital-twin-ecru.vercel.app*
