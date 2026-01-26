# Sprint 2: Master Workflow

**Objective:** Add structured facts, MIRROR messages, and privacy controls to export  
**Timeline:** 1-2 days  
**Terminals:** 4 parallel

---

## What Sprint 2 Delivers

| Gap from Sprint 1 | Solution | Owner |
|-------------------|----------|-------|
| No structured facts | `entity_facts` table + extraction | T1 + T2 |
| No MIRROR messages | Fetch + include in export | T2 |
| No privacy controls | `privacy_level` columns + UI | T1 + T3 |

---

## Terminal Assignments

| Terminal | Role | Primary Files |
|----------|------|---------------|
| **T1** | Database + Extraction | Migrations, `/api/extract-entities.js` |
| **T2** | Data Layer | `/lib/export/queries.js`, `transforms.js` |
| **T3** | Privacy UI | `/js/privacy-controls.js`, `/api/privacy-*.js` |
| **T4** | QA | `/tests/export/*`, `/docs/EXPORT.md` |

---

## Dependency Chain

```
                    ┌─────────────────────────────┐
                    │         T1 (Database)        │
                    │  • entity_facts table        │
                    │  • privacy_level columns     │
                    │  • Updated extraction        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │      T2 (Data Layer)       │   │      T3 (Privacy UI)       │
    │  • getEntityFacts query    │   │  • Privacy toggle UI       │
    │  • MIRROR messages query   │   │  • Privacy indicator       │
    │  • Updated transforms      │   │  • Privacy APIs            │
    └─────────────┬─────────────┘   └─────────────┬─────────────┘
                  │                               │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │         T4 (QA)              │
                    │  • Updated fixtures          │
                    │  • New tests                 │
                    │  • E2E validation            │
                    └─────────────────────────────┘
```

---

## Execution Order

### Phase 1: Parallel Start (All terminals)

**T1 starts immediately:**
- Create database migrations
- Run migrations in Supabase

**T2 starts immediately (partial):**
- Add MIRROR messages to `getConversations` (no blocker)
- Update `transformConversation`
- Wait for T1 before fact queries

**T3 starts immediately:**
- Build privacy UI components
- Create privacy API endpoints
- Can test after T1 adds columns

**T4 starts immediately:**
- Update test fixtures
- Write new test cases
- Wait for T1/T2/T3 before running

### Phase 2: T1 Unblocks Others

When T1 signals **"MIGRATIONS COMPLETE"**:
- T2 adds `getEntityFacts` query
- T2 updates `transformEntity` to include facts
- T3 tests privacy toggles with real data

### Phase 3: T2 Completes Data Layer

When T2 signals **"DATA LAYER COMPLETE"**:
- T1 updates `/api/export.js` to fetch facts
- T4 runs transform tests

### Phase 4: Integration Testing

When T1, T2, T3 all signal complete:
- T4 runs full E2E checklist
- T4 validates with ChatGPT/Claude
- T4 reports any bugs

### Phase 5: Merge

After T4 confirms all tests pass:
- Merge all branches to main
- Deploy

---

## Signal Protocol

### T1 Signals

```
T1 → T2, T3: MIGRATIONS COMPLETE
Tables ready:
- entity_facts created
- privacy_level on user_entities, notes, user_patterns
```

```
T1 → T4: EXTRACTION UPDATED
Entity extraction now outputs structured facts.
```

### T2 Signals

```
T2 → T4: MIRROR MESSAGES READY
Conversations now include full message history.
```

```
T2 → T1: FACT TRANSFORMS READY
Update /api/export.js to pass facts to transformEntity.
```

```
T2 → ALL: DATA LAYER COMPLETE
All queries and transforms updated for Sprint 2.
```

### T3 Signals

```
T3 → T4: PRIVACY UI READY
- Privacy indicator
- Privacy management section
- Privacy APIs
```

### T4 Signals

```
T4 → ALL: TESTS READY
Fixtures and tests updated. Waiting for code.
```

```
T4 → ALL: SPRINT 2 E2E COMPLETE
All tests pass. Ready to merge.
```

---

## File Ownership Map

```
T1 OWNS:
  /supabase/migrations/*           ← Database changes
  /api/extract-entities.js         ← Extraction prompt
  /api/export.js                   ← Wire facts (after T2 ready)

T2 OWNS:
  /lib/export/queries.js           ← Add getEntityFacts
  /lib/export/transforms.js        ← Update transformEntity, transformConversation
  /lib/export/types.js             ← Add FACT_PREDICATES

T3 OWNS:
  /js/privacy-controls.js          ← NEW
  /css/privacy-controls.css        ← NEW
  /js/settings-export.js           ← Add privacy indicator
  /api/privacy-summary.js          ← NEW
  /api/update-privacy.js           ← NEW

T4 OWNS:
  /tests/export/fixtures/*
  /tests/export/*.test.js
  /tests/export/E2E-CHECKLIST.md
  /docs/EXPORT.md
```

---

## Startup Commands

```bash
# Terminal 1 - Database
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-database

# Terminal 2 - Data Layer
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-data

# Terminal 3 - Privacy UI
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-privacy

# Terminal 4 - QA
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-tests
```

---

## Prompts to Send

### To T1:
> "Read T1-SPRINT2-INSTRUCTIONS.md. You are T1 Database Lead. Start with Task 1: Database Migrations. T2 and T3 are waiting on you."

### To T2:
> "Read T2-SPRINT2-INSTRUCTIONS.md. You are T2 Data Layer Lead. Start with Task 1: MIRROR Messages (no blocker). Wait for T1 signal before Task 2: Entity Facts."

### To T3:
> "Read T3-SPRINT2-INSTRUCTIONS.md. You are T3 Frontend Lead. Start with Task 1: Privacy Indicator. Build UI while waiting for T1's columns."

### To T4:
> "Read T4-SPRINT2-INSTRUCTIONS.md. You are T4 QA Lead. Start with Task 1: Update Fixtures. Write tests now, run them after T1/T2/T3 complete."

---

## Definition of Done (Sprint 2)

### Features
- [ ] Export includes structured facts on entities
- [ ] Export includes full MIRROR message history
- [ ] Users can mark entities/notes as private
- [ ] Private items excluded from export
- [ ] Privacy indicator shows count before export

### Quality
- [ ] All unit tests pass
- [ ] All API tests pass
- [ ] E2E checklist complete
- [ ] ChatGPT/Claude validation done
- [ ] No P0 bugs

### Documentation
- [ ] EXPORT.md updated
- [ ] Version bumped to 1.1.0

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|------------|
| T1 migrations fail | Low | Test in Supabase dashboard first |
| MIRROR messages table different | Medium | T2 check actual table schema |
| Privacy toggle doesn't persist | Medium | T3 test with Supabase logs |
| Large exports slow down | Medium | T4 performance test |

---

## Success Criteria

After Sprint 2, a user can:

1. **See facts about people** — "Alice works at Acme Corp" not just "Alice"
2. **See full conversations** — Every message from MIRROR, not just summaries
3. **Control privacy** — Mark sensitive items as private
4. **Export with confidence** — Know exactly what's included/excluded

---

## After Sprint 2

What's still not built (future sprints):
- Import functionality
- Encrypted export option
- Structured patterns (Sprint 3)
- Real-time sync (separate project)

---

*Sprint 2 Master Workflow*  
*4-Terminal Parallel Execution*  
*January 2026*
