# INSCRIPT DATA FLOW AUDIT
**Generated: January 25, 2026**

---

## PART 1: DATA COLLECTION INVENTORY

### 1.1 ONBOARDING (8 Screens)

| Screen | Field | Type | Required | Stored In | Used By |
|--------|-------|------|----------|-----------|---------|
| 1 | `name` | TEXT | Yes | `onboarding_data.name` + `user_profiles.name` | MIRROR, analyze.js, ui-profile.js |
| 2 | `life_seasons` | TEXT[] | Yes (≥1) | `onboarding_data.life_seasons` | MIRROR, analyze.js |
| 3 | `mental_focus` | TEXT[] | Yes (1-3) | `onboarding_data.mental_focus` | MIRROR, analyze.js |
| 4 | `depth_question` | TEXT | Auto | `onboarding_data.depth_question` | MIRROR, analyze.js |
| 4 | `depth_answer` | TEXT | Optional | `onboarding_data.depth_answer` | MIRROR, analyze.js |
| 5 | `value_priorities` | JSONB | Auto | `onboarding_data.value_priorities` | **NOT USED** |
| 6 | `seeded_people` | JSONB | Optional | `onboarding_data.seeded_people` + `user_entities` | MIRROR, analyze.js |

**Life Seasons Options:** building, leading, learning, transition, caring, creating, healing, exploring, settling, fresh

**Mental Focus Options:** work, relationships, health, money, family, decision, future, myself, project, loss

---

### 1.2 PROFILE SETTINGS (TWIN Tab)

| Field | Type | Unlocks At | Stored In | Used By |
|-------|------|------------|-----------|---------|
| `name` | TEXT | Immediate | `user_profiles.name` + `onboarding_data.name` | MIRROR, analyze.js |
| `life_seasons` | TEXT[] | Immediate | `onboarding_data.life_seasons` | MIRROR, analyze.js |
| `mental_focus` | TEXT[] | Immediate | `onboarding_data.mental_focus` | MIRROR, analyze.js |
| `tone` | ENUM | 5 notes | `user_profiles.tone` | MIRROR only |
| `life_context` | TEXT | 5 notes | `user_profiles.life_context` | MIRROR only |
| `boundaries` | TEXT[] | 5 notes | `user_profiles.boundaries` | MIRROR only |

**Tone Options:** DIRECT, WARM, CHALLENGING, ADAPTIVE

---

### 1.3 KEY PEOPLE (Manual Entry)

| Field | Type | Stored In | Used By |
|-------|------|-----------|---------|
| `name` | TEXT | `user_key_people.name` | MIRROR (highest priority) |
| `relationship` | TEXT | `user_key_people.relationship` | MIRROR context |
| `added_via` | TEXT | `user_key_people.added_via` | Internal tracking |

**Entry Points:**
- Manual add in Profile modal
- Entity confirmation ("Yes, this is someone important")
- Onboarding seeded people → auto-migrated

---

### 1.4 NOTES

| Field | Captured From | Stored In | Used By |
|-------|---------------|-----------|---------|
| `content` | User input | `notes.encrypted_data` (E2E) | Can't be read server-side |
| `created_at` | Auto | `notes.created_at` | Pattern detection, reports |
| `category` | Local classifier | `notes.classification.category` | Filtering |
| `title` | Local extractor | `notes.extracted.title` | Display |
| `sentiment` | Local + AI | `notes.extracted.sentiment` | Analysis |
| `action_items` | Local + AI | `notes.extracted.action_items` | Actions tab |
| `analysis` | `/api/analyze` | `notes.analysis` | Note detail view |

**Extracted Entities (from notes):**
- People → `user_entities` (entity_type='person')
- Places → `user_entities` (entity_type='place')
- Projects → `user_entities` (entity_type='project')

---

### 1.5 WHISPERS

| Field | Type | Stored In | Used By |
|-------|------|-----------|---------|
| `content_encrypted` | TEXT (E2E) | `whispers.content_encrypted` | Batch reflection |
| `iv` | TEXT | `whispers.iv` | Decryption |
| `source` | TEXT | `whispers.source` | Type tracking |
| `processed` | BOOLEAN | `whispers.processed` | Batch selection |
| `entities_extracted` | JSONB | `whispers.entities_extracted` | Entity extraction |

---

### 1.6 MEETINGS

| Field | Type | Stored In | Used By |
|-------|------|-----------|---------|
| `attendees` | STRING[] | `notes.meeting.attendees` | Work tab display |
| `title` | TEXT | `notes.meeting.title` | Meeting list |
| `content` | TEXT | `notes.meeting.content` | Analysis |
| `action_items` | JSONB | `notes.meeting.actionItems` | Actions tab |

**Note:** Meetings are stored as notes with `type='meeting'` marker, not a separate table.

---

### 1.7 FEEDBACK

| Type | Captured When | Stored In | Used By |
|------|---------------|-----------|---------|
| Reflection thumbs up/down | Note detail view | `user_feedback` | **user_learning_profile (aggregated)** |
| Reflection edit | Edit reflection text | `output_feedback` (**TABLE MISSING**) | **NOT USED** |
| Pattern confirm/reject | "That resonates" click | `user_patterns.status` | Confidence adjustment |
| Pattern rejection reason | "Not quite" textarea | `user_patterns.rejection_reason` | **NOT USED** |

---

### 1.8 MEMORY PREFERENCES

| Field | Type | Stored In | Used By |
|-------|------|-----------|---------|
| `custom_instructions` | TEXT | `memory_preferences.custom_instructions` | extract-entities.js |
| `enabled_categories` | TEXT[] | `memory_preferences.enabled_categories` | Memory extraction |
| `never_store` | TEXT[] | `memory_preferences.never_store` | Memory filtering |
| `auto_mark_sensitive` | TEXT[] | `memory_preferences.auto_mark_sensitive` | Sensitivity tagging |
| `default_expiry_days` | INT | `memory_preferences.default_expiry_days` | Memory decay |

---

## PART 2: DATA STORAGE MAP

### 2.1 ONBOARDING_DATA

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `user_id` | UUID | Auth signup | All queries |
| `name` | TEXT | Onboarding screen 1 | MIRROR, analyze.js |
| `life_seasons` | TEXT[] | Onboarding screen 2 | MIRROR, analyze.js |
| `mental_focus` | TEXT[] | Onboarding screen 3 | MIRROR, analyze.js |
| `depth_question` | TEXT | Auto-generated | MIRROR, analyze.js |
| `depth_answer` | TEXT | Onboarding screen 4 | MIRROR, analyze.js |
| `value_priorities` | JSONB | Onboarding screen 5 | **NOTHING** |
| `seeded_people` | JSONB | Onboarding screen 6 | Entity seeding |
| `completed_at` | TIMESTAMP | Onboarding completion | Skip logic |

---

### 2.2 USER_PROFILES

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `name` | TEXT | Onboarding + Profile edit | MIRROR |
| `role_types` | TEXT[] | Profile edit | **NOTHING** |
| `goals` | TEXT[] | Profile edit | **NOTHING** |
| `tone` | TEXT | Profile edit (after 5 notes) | MIRROR only |
| `life_context` | TEXT | Profile edit (after 5 notes) | MIRROR only |
| `boundaries` | TEXT[] | Profile edit (after 5 notes) | MIRROR only |
| `preferences_unlocked_at` | TIMESTAMP | Auto after 5 notes | UI unlock logic |

---

### 2.3 USER_KEY_PEOPLE

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `name` | TEXT | Manual add / Entity confirm | MIRROR (⭐ highest priority) |
| `relationship` | TEXT | Manual add / Entity confirm | MIRROR context |
| `added_via` | TEXT | System | Analytics |

---

### 2.4 USER_ENTITIES

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `name` | TEXT | Entity extraction from notes | All features |
| `entity_type` | TEXT | AI classification | Filtering |
| `memory_type` | TEXT | Mem0 classification | Retrieval |
| `relationship` | TEXT | AI inference / User correction | MIRROR, analyze.js |
| `mention_count` | INT | Auto-increment on mention | Importance ranking |
| `first_mentioned_at` | TIMESTAMP | First note mention | Pattern detection |
| `last_mentioned_at` | TIMESTAMP | Most recent mention | Absence detection |
| `sentiment_average` | DECIMAL | Rolling average | MIRROR, reports |
| `context_notes` | TEXT[] | Recent context snippets | MIRROR, analyze.js |
| `importance_score` | FLOAT | Computed (decay + mentions) | Retrieval ranking |
| `embedding` | vector(1536) | OpenAI text-embedding-3-small | Semantic search |
| `status` | TEXT | System / User | Active filtering |

---

### 2.5 USER_PATTERNS

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `pattern_type` | TEXT | detect-patterns.js | Display categorization |
| `description` | TEXT | LLM generation | TWIN display |
| `short_description` | TEXT | LLM generation | Knowledge Pulse |
| `confidence` | FLOAT | Detection + user feedback | Surfacing threshold |
| `evidence` | JSONB | Note references | Verification |
| `status` | TEXT | Detection → User confirm/reject | Filtering |
| `rejection_reason` | TEXT | User feedback | **NOT USED** |

---

### 2.6 CATEGORY_SUMMARIES

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `category` | TEXT | System categories | Filtering |
| `summary` | TEXT | evolve-summary.js (LLM) | analyze.js (TIER 1 context) |
| `entity_count` | INT | Auto-count | Display |
| `last_entities` | JSONB | Recent entities | Context |

**Categories:** work_life, personal_life, health_wellness, relationships, goals_aspirations, preferences, beliefs_values, skills_expertise, projects, challenges, general

---

### 2.7 WHISPERS

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `content_encrypted` | TEXT | User input (E2E) | Batch reflection |
| `iv` | TEXT | Encryption | Decryption |
| `processed` | BOOLEAN | Batch reflection | Filter unprocessed |
| `entities_extracted` | JSONB | Client-side extraction | Entity seeding |

---

### 2.8 MEMORY_MOMENTS

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `moment_type` | TEXT | cron/memory-moments.js | Display categorization |
| `title` | TEXT | LLM generation | Notification |
| `content` | TEXT | LLM generation | Detail view |
| `related_entity_id` | UUID | Moment generator | Entity linking |
| `priority` | INT | Computed | Sort order |
| `shown_at` | TIMESTAMP | UI display | Dedup |
| `dismissed_at` | TIMESTAMP | User dismiss | **NOT USED for learning** |
| `engaged_at` | TIMESTAMP | User engage | **NOT USED for learning** |

---

### 2.9 USER_REPORTS

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `report_month` | DATE | Monthly cron | Lookup |
| `report_data` | JSONB | state-of-you.js | Report display |
| `generated_at` | TIMESTAMP | System | Freshness |
| `viewed_at` | TIMESTAMP | User view | **NOT USED** |

---

### 2.10 USER_FEEDBACK

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `feedback_type` | TEXT | Thumbs up/down | user_learning_profile aggregation |
| `insight_type` | TEXT | Classification | Preference learning |
| `note_id` | TEXT | Context | Linking |
| `comment_text` | TEXT | Optional comment | **NOT USED** |

---

### 2.11 USER_LEARNING_PROFILE

| Column | Type | Populated By | Used By |
|--------|------|--------------|---------|
| `approved_insight_types` | JSONB | Aggregated from feedback | **context.js only (BASIC level)** |
| `rejected_insight_types` | JSONB | Aggregated from feedback | **context.js only (BASIC level)** |
| `recurring_themes` | JSONB | Pattern detection | **NOTHING** |
| `vocabulary_style` | TEXT | Analysis | **NOTHING** |
| `temporal_patterns` | JSONB | Note timing | **NOTHING** |

---

## PART 3: FEATURE CONSUMPTION MAP

### 3.1 NOTE REFLECTION (analyze.js / analyze-edge.js)

| Data Source | Currently Reads | Should Read | Gap |
|-------------|-----------------|-------------|-----|
| `onboarding_data` | ✅ name, life_seasons, mental_focus, depth_answer, seeded_people | ✅ | None |
| `category_summaries` | ✅ Top 5 summaries | ✅ | None |
| `user_entities` | ✅ Top 10 by importance | ✅ | None |
| `user_key_people` | ❌ | ✅ | **GAP: Not reading manually added people** |
| `user_patterns` | ❌ | ✅ | **GAP: Not reading confirmed patterns** |
| `user_profiles.tone` | ❌ | ✅ | **GAP: Not adapting tone to preference** |
| `user_profiles.boundaries` | ❌ | ✅ | **GAP: Not avoiding boundary topics** |
| `user_learning_profile` | ❌ | ✅ | **GAP: Not using learned preferences** |
| `entity_relationships` | ❌ | ✅ | **GAP: Not showing entity connections** |
| `user_feedback` | ❌ | ✅ | **GAP: Not learning from past feedback** |

---

### 3.2 MIRROR CHAT (mirror.js)

| Data Source | Currently Reads | Should Read | Gap |
|-------------|-----------------|-------------|-----|
| `onboarding_data` | ✅ Full context | ✅ | None |
| `user_key_people` | ✅ Highest priority | ✅ | None |
| `user_entities` | ✅ Top 20 | ✅ | None |
| `user_patterns` | ✅ High confidence | ✅ | None |
| `category_summaries` | ✅ | ✅ | None |
| `user_profiles` | ✅ tone, boundaries | ✅ | None |
| `entity_sentiment_history` | ❌ | ✅ | **GAP: Not showing sentiment trends** |
| `user_feedback` | ❌ | ✅ | **GAP: Not improving from feedback** |
| `memory_moments` (dismissed) | ❌ | ✅ | **GAP: May repeat dismissed content** |

---

### 3.3 TWIN TAB (twin-ui.js)

| Data Source | Currently Reads | Should Read | Gap |
|-------------|-----------------|-------------|-----|
| `user_entities` | ✅ | ✅ | None |
| `user_patterns` | ✅ | ✅ | None |
| `category_summaries` | ✅ | ✅ | None |
| `user_key_people` | ✅ | ✅ | None |
| `entity_relationships` | ❌ | ✅ | **GAP: Not showing entity graph** |
| `entity_sentiment_history` | ❌ | ✅ | **GAP: Not showing sentiment trends** |

---

### 3.4 PATTERN DETECTION (detect-patterns.js)

| Data Source | Currently Reads | Should Read | Gap |
|-------------|-----------------|-------------|-----|
| `notes` | ✅ Metadata (id, created_at) | ✅ | None |
| `user_entities` | ✅ With temporal data | ✅ | None |
| `category_summaries` | ✅ | ✅ | None |
| `user_patterns` (existing) | ❌ | ✅ | **GAP: May re-detect known patterns** |
| `user_feedback` | ❌ | ✅ | **GAP: Doesn't learn from rejections** |
| `entity_sentiment_history` | ❌ | ✅ | **GAP: Missing granular sentiment** |

---

### 3.5 STATE OF YOU REPORT (state-of-you.js)

| Data Source | Currently Reads | Should Read | Gap |
|-------------|-----------------|-------------|-----|
| `notes` | ✅ Count, date range | ✅ | None |
| `whispers` | ✅ Count | ✅ | None |
| `user_entities` | ✅ Top 10 | ✅ | None |
| `user_patterns` | ✅ Confirmed patterns | ✅ | None |
| `category_summaries` | ✅ | ✅ | None |
| `user_profiles.boundaries` | ❌ | ✅ | **GAP: May mention avoided topics** |
| `entity_relationships` | ❌ | ✅ | **GAP: Not showing how people connect** |
| `user_learning_profile` | ❌ | ✅ | **GAP: Not personalizing tone** |

---

### 3.6 MEMORY MOMENTS (cron/memory-moments.js)

| Data Source | Currently Reads | Should Read | Gap |
|-------------|-----------------|-------------|-----|
| `notes` | ✅ Anniversary detection | ✅ | None |
| `user_entities` | ✅ Dormant detection | ✅ | None |
| `user_key_people` | ✅ Higher priority | ✅ | None |
| `entity_sentiment_history` | ✅ Progress detection | ✅ | None |
| `memory_moments` (dismissed) | ❌ | ✅ | **GAP: May repeat dismissed moments** |
| `user_patterns` | ❌ | ✅ | **GAP: Not surfacing pattern insights** |
| `user_feedback` | ❌ | ✅ | **GAP: Not learning what user cares about** |

---

## PART 4: GAP ANALYSIS TABLE

### 4.1 Data Collected But Not Used

| Data Collected | Stored In | Used By | NOT Used By (Gap) |
|----------------|-----------|---------|-------------------|
| `value_priorities` (ranked values) | `onboarding_data` | **NOTHING** | analyze.js, mirror.js, reports |
| `role_types` (who they are) | `user_profiles` | **NOTHING** | analyze.js, mirror.js |
| `goals` (why they're here) | `user_profiles` | **NOTHING** | analyze.js, mirror.js |
| `tone` preference | `user_profiles` | MIRROR only | **Note reflections (analyze.js)** |
| `boundaries` (topics to avoid) | `user_profiles` | MIRROR only | **Note reflections, reports** |
| `life_context` | `user_profiles` | MIRROR only | **Note reflections** |
| `rejection_reason` (patterns) | `user_patterns` | **NOTHING** | Pattern detection improvement |
| `dismissed_at` (moments) | `memory_moments` | **NOTHING** | Avoid repetition |
| `engaged_at` (moments) | `memory_moments` | **NOTHING** | Learn what matters |
| `viewed_at` (reports) | `user_reports` | **NOTHING** | Analytics |
| `comment_text` (feedback) | `user_feedback` | **NOTHING** | Quality learning |
| `recurring_themes` | `user_learning_profile` | **NOTHING** | analyze.js, patterns |
| `vocabulary_style` | `user_learning_profile` | **NOTHING** | Tone matching |
| `temporal_patterns` | `user_learning_profile` | **NOTHING** | Optimal timing |
| Entity relationships | `entity_relationships` | MIRROR (partial) | **TWIN, analyze.js, reports** |
| Sentiment history | `entity_sentiment_history` | memory-moments | **MIRROR, TWIN, reports** |

---

### 4.2 Features Missing Data They Need

| Feature | Missing Data | Impact |
|---------|--------------|--------|
| Note Reflections | Key people, tone, boundaries, patterns, feedback | Generic reflections, may hit sensitive topics |
| TWIN Entity View | Entity relationships, sentiment history | Can't show how people connect or sentiment trends |
| Pattern Detection | Existing patterns, feedback history | Re-detects known patterns, doesn't learn |
| Memory Moments | Dismissed moments, patterns | Spams with unwanted content |
| Reports | Boundaries, relationships | May discuss avoided topics, misses connections |
| Knowledge Pulse | Feedback loop visibility | User doesn't see learning happen |

---

### 4.3 Missing Tables/Schema

| Expected | Status | Impact |
|----------|--------|--------|
| `output_feedback` | **MISSING** (referenced in code, not in migrations) | Edit tracking silently fails |
| `notes` table schema | **NOT IN MIGRATIONS** (pre-existing assumed) | Can't verify structure |

---

## PART 5: DATA FLOW DIAGRAM

```
═══════════════════════════════════════════════════════════════════════════════
                           INSCRIPT DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

ONBOARDING (8 screens)
├── name ──────────────────► onboarding_data.name ──────► MIRROR ✓
│                            user_profiles.name           analyze.js ✓
│
├── life_seasons ──────────► onboarding_data ───────────► MIRROR ✓
│                                                         analyze.js ✓
│
├── mental_focus ──────────► onboarding_data ───────────► MIRROR ✓
│                                                         analyze.js ✓
│
├── depth_question/answer ─► onboarding_data ───────────► MIRROR ✓
│                                                         analyze.js ✓
│
├── value_priorities ──────► onboarding_data ───────────► ❌ NOTHING (GAP)
│
└── seeded_people ─────────► onboarding_data ───────────► user_entities (seeding)
                             user_entities                MIRROR ✓
                                                         analyze.js ✓

───────────────────────────────────────────────────────────────────────────────

PROFILE SETTINGS (after 5 notes)
├── tone ──────────────────► user_profiles.tone ────────► MIRROR ✓
│                                                         analyze.js ❌ (GAP)
│
├── life_context ──────────► user_profiles ─────────────► MIRROR ✓
│                                                         analyze.js ❌ (GAP)
│
├── boundaries ────────────► user_profiles ─────────────► MIRROR ✓
│                                                         analyze.js ❌ (GAP)
│                                                         reports ❌ (GAP)
│
├── role_types ────────────► user_profiles ─────────────► ❌ NOTHING (GAP)
│
└── goals ─────────────────► user_profiles ─────────────► ❌ NOTHING (GAP)

───────────────────────────────────────────────────────────────────────────────

KEY PEOPLE (manual add)
└── name, relationship ────► user_key_people ───────────► MIRROR ✓ (⭐ highest)
                                                         analyze.js ❌ (GAP)
                                                         Pattern detection ❌

───────────────────────────────────────────────────────────────────────────────

NOTES
├── content (encrypted) ───► notes.encrypted_data ──────► (can't read server-side)
│
├── created_at ────────────► notes.created_at ──────────► Pattern detection ✓
│                                                         Reports ✓
│
├── extracted entities ────► user_entities ─────────────► MIRROR ✓
│                                                         TWIN ✓
│                                                         analyze.js ✓
│                                                         Pattern detection ✓
│
├── sentiment ─────────────► entity_sentiment_history ──► memory-moments ✓
│                                                         MIRROR ❌ (GAP)
│                                                         TWIN ❌ (GAP)
│
└── analysis ──────────────► notes.analysis ────────────► Note detail ✓

───────────────────────────────────────────────────────────────────────────────

WHISPERS
└── content_encrypted ─────► whispers ──────────────────► Batch reflection ✓
                                                         Entity extraction ✓

───────────────────────────────────────────────────────────────────────────────

FEEDBACK
├── thumbs up/down ────────► user_feedback ─────────────► user_learning_profile
│                                                         ❌ NOT fed back to AI
│
├── reflection edit ───────► output_feedback ───────────► ❌ TABLE MISSING
│                            (FAILS SILENTLY)
│
├── pattern confirm ───────► user_patterns.status ──────► Confidence adjustment ✓
│                                                         Future detection ❌ (GAP)
│
└── pattern reject reason ─► user_patterns ─────────────► ❌ NOTHING (GAP)

───────────────────────────────────────────────────────────────────────────────

MEMORY MOMENTS
├── shown_at ──────────────► memory_moments ────────────► Dedup display ✓
├── dismissed_at ──────────► memory_moments ────────────► ❌ NOTHING (GAP)
└── engaged_at ────────────► memory_moments ────────────► ❌ NOTHING (GAP)

───────────────────────────────────────────────────────────────────────────────

DERIVED DATA (System Generated)
├── category_summaries ────► Tier 1 context ────────────► analyze.js ✓
│                                                         MIRROR ✓
│
├── user_patterns ─────────► Detected patterns ─────────► MIRROR ✓
│                                                         TWIN ✓
│                                                         analyze.js ❌ (GAP)
│
├── entity_relationships ──► Entity graph ──────────────► MIRROR (partial)
│                                                         TWIN ❌ (GAP)
│                                                         analyze.js ❌ (GAP)
│
└── user_learning_profile ─► Aggregated learning ───────► context.js (BASIC only)
                                                         analyze.js ❌ (GAP)

═══════════════════════════════════════════════════════════════════════════════
```

---

## PART 6: PRIORITY FIX LIST

### P0: CRITICAL (Breaks Core UX)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 1 | **analyze.js doesn't read user_key_people** | AI doesn't know about manually added important people | Add key_people query to analyze.js context |
| 2 | **analyze.js doesn't read tone/boundaries** | Reflections don't match user preference, may hit sensitive topics | Add user_profiles query to analyze.js |
| 3 | **output_feedback table missing** | Edit tracking silently fails | Create migration for output_feedback table |
| 4 | **Feedback not fed back to AI** | "Flywheel breaks" - user doesn't see learning | Use user_learning_profile in analyze.js prompts |

### P1: IMPORTANT (Reduces Quality)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 5 | analyze.js doesn't read confirmed patterns | Misses opportunity to reference known patterns | Add user_patterns query (status='confirmed') |
| 6 | Pattern detection doesn't check existing patterns | May re-detect patterns user already knows | Filter against existing user_patterns |
| 7 | Pattern rejection_reason not used | Can't learn what makes patterns weak | Feed rejection_reason to detection prompt |
| 8 | Memory moments doesn't check dismissed | May spam user with unwanted moments | Filter against dismissed_at IS NOT NULL |
| 9 | value_priorities not used anywhere | Wasted onboarding data | Include in context for analyze.js and mirror.js |
| 10 | role_types and goals not used | Wasted profile data | Include in context building |

### P2: NICE TO HAVE (Polish)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 11 | Entity relationships not shown in TWIN | Users can't see how people connect | Add relationship graph visualization |
| 12 | Sentiment history not shown in TWIN | Users can't see relationship trends | Add sentiment sparklines to entities |
| 13 | engaged_at not used for learning | Don't know what moments matter | Track engagement patterns |
| 14 | vocabulary_style not used | Tone doesn't match user's language | Include in reflection prompt |
| 15 | temporal_patterns not used | Don't know optimal timing | Use for moment scheduling |

---

## SUMMARY

### Data Collection Points: 8
1. Onboarding (8 screens, 7 fields)
2. Profile Settings (6 fields)
3. Key People (3 fields)
4. Notes (6+ fields extracted)
5. Whispers (5 fields)
6. Meetings (4 fields, stored as notes)
7. Feedback (4 types)
8. Memory Preferences (10 fields)

### Tables Audited: 15
- `onboarding_data`, `user_profiles`, `user_key_people`, `notes`, `user_entities`, `user_patterns`, `category_summaries`, `whispers`, `memory_moments`, `user_reports`, `user_feedback`, `user_learning_profile`, `entity_relationships`, `entity_sentiment_history`, `memory_preferences`

### Critical Gaps Found: 4
### Important Gaps Found: 6
### Total Unused Data Fields: 15+

### Key Finding
**The feedback loop is broken.** Data is collected but not visibly used to improve the system. Per CLAUDE.md: *"Learning must be VISIBLE. If users don't see Inscript getting smarter, the flywheel breaks."*

---

*Generated by Claude Code - January 25, 2026*
