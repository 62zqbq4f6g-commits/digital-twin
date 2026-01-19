# Phase 9: Implementation Checklist

## How to Use This Checklist

Each task is self-contained. Give Claude Code ONE task at a time with this format:

```
CONTEXT:
- Phase 9 personalization system
- Spec: /docs/phase9/[relevant-file].md

TASK:
[Copy the task description below]

CONSTRAINTS:
- Follow design system in 01-design-system.md
- ui.js is 39k tokens — use grep, read specific lines only
- Create new files when possible instead of bloating ui.js

VERIFY:
- [What to check when done]
```

---

## Phase 9.1: Foundation

### Task 1: Database Migration
```
Read: /docs/phase9/02-database-schema.md

Create Supabase migration file at supabase/migrations/[timestamp]_phase9_personalization.sql

Include:
- user_profiles table
- user_key_people table
- user_entities table
- user_feedback table
- user_learning_profile table
- All indexes
- RLS policies

Run: supabase db push (or however migrations are applied)

Verify: All 5 tables exist in Supabase dashboard
```
- [ ] Tables created
- [ ] RLS policies active

### Task 2: Design System CSS
```
Read: /docs/phase9/01-design-system.md

Create: js/design-system.css

Include ALL:
- CSS custom properties (typography, colors, spacing, animation)
- .card component
- .btn-primary, .btn-secondary, .btn-text
- .input, .label
- .section-header
- .pill, .pill--selected
- .option-card, .option-card--selected
- .stat
- .modal-overlay, .modal
- Animation keyframes

Add to index.html: <link rel="stylesheet" href="js/design-system.css">

Verify: Inspect page, confirm CSS variables are loading
```
- [ ] CSS file created
- [ ] Imported in index.html

### Task 3: Font Loading
```
Read: /docs/phase9/01-design-system.md (Typography section)

Add to index.html <head>:
- Google Fonts preconnect
- Inter (400, 500)
- Playfair Display (500, 600)  
- JetBrains Mono (400)

Verify: Network tab shows fonts loading
```
- [ ] Fonts loading

---

## Phase 9.2: Onboarding

### Task 4: Onboarding File Setup
```
Read: /docs/phase9/03-onboarding-flow.md

Create: js/onboarding.js

Scaffold functions (empty bodies for now):
- checkOnboardingStatus()
- showOnboarding()
- renderWelcomeScreen()
- renderNameScreen()
- renderRoleScreen()
- renderGoalsScreen()
- completeOnboarding()
- navigateOnboarding(direction)

Export functions needed by other files.
Add script tag to index.html.

Verify: No console errors, file loads
```
- [ ] File created and loading

### Task 5: Welcome Screen
```
Read: /docs/phase9/03-onboarding-flow.md (Screen 0)

Implement renderWelcomeScreen():
- Full-screen centered layout
- "the living script" in Playfair Display
- "a mirror in code" subtitle
- "Get Started" button
- Fade-in animation on load

Use design system classes from 01-design-system.md.

Verify: Manually call showOnboarding() in console, see welcome screen
```
- [ ] Welcome screen renders correctly

### Task 6: Name Screen
```
Read: /docs/phase9/03-onboarding-flow.md (Screen 1)

Implement renderNameScreen():
- Back button + "1 of 3" indicator
- "YOUR NAME" label
- Text input with italic placeholder
- Continue button (disabled until input has value)
- Store name in onboarding state object

Verify: Can enter name, Continue enables, clicking advances
```
- [ ] Name screen works

### Task 7: Role Screen
```
Read: /docs/phase9/03-onboarding-flow.md (Screen 2)

Implement renderRoleScreen():
- Back button + "2 of 3"
- "WHAT DESCRIBES YOUR DAYS?" label
- 6 option cards (use .option-card classes)
- Single selection (clicking one deselects others)
- Continue button (disabled until selection)

Use ROLE_OPTIONS array from spec.

Verify: Can select role, selection highlights, can proceed
```
- [ ] Role screen works

### Task 8: Goals Screen
```
Read: /docs/phase9/03-onboarding-flow.md (Screen 3)

Implement renderGoalsScreen():
- Back button + "3 of 3"
- "WHAT BRINGS YOU HERE?" + "Select 1-3" subtitle
- 2-column grid of pills
- Multi-select (1-3 max, show subtle error if >3)
- "Start Writing" button

Use GOAL_OPTIONS array from spec.

Verify: Can select 1-3 goals, validation works, button text correct
```
- [ ] Goals screen works

### Task 9: Complete Onboarding
```
Read: /docs/phase9/03-onboarding-flow.md (Save Logic)

Implement completeOnboarding():
- Collect name, roleType, goals from state
- Insert into user_profiles table
- Insert empty row into user_learning_profile table
- Navigate to main app (notes screen)

Verify: Complete flow, check Supabase — row exists in user_profiles
```
- [ ] Data saves to Supabase

### Task 10: Onboarding Check on Load
```
Read: /docs/phase9/03-onboarding-flow.md (Check Logic)

Implement checkOnboardingStatus():
- Get current user ID
- Query user_profiles for onboarding_completed_at
- If null/missing, call showOnboarding()
- If exists, proceed to app normally

Call this in app init (after auth check).

Verify: New user sees onboarding. Returning user skips to app.
```
- [ ] Auto-triggers for new users
- [ ] Skips for returning users

---

## Phase 9.3: TWIN Tab Redesign

### Task 11: Profile Display Section
```
Read: /docs/phase9/04-twin-tab-profile.md (Section 1)

In TWIN tab rendering, add "ABOUT YOU" section:
- Fetch user_profiles data
- Display: name, role (formatted), goals (formatted)
- Each with edit button (✎)
- Use design system classes

Note: If editing renderTwin in ui.js, use grep first to find the function.

Verify: TWIN tab shows profile data from database
```
- [ ] Profile displays correctly

### Task 12: Edit Modals
```
Read: /docs/phase9/04-twin-tab-profile.md (Edit Modals section)

Create modal system:
- Reusable modal component (openModal, closeModal)
- Edit Name modal
- Edit Role modal (same options as onboarding)
- Edit Goals modal (same pills as onboarding)
- Save updates to user_profiles
- Refresh display after save

Verify: Can edit each field, saves to DB, UI updates
```
- [ ] Name edit works
- [ ] Role edit works
- [ ] Goals edit works

### Task 13: Preferences Section (Locked/Unlocked)
```
Read: /docs/phase9/04-twin-tab-profile.md (Section 2)

Add "YOUR PREFERENCES" section:
- Check note count
- If < 5 notes: show locked state with progress
- If >= 5 notes: show preference fields
  - Tone (not set / value)
  - Life context (not set / truncated preview)
  - Key people (count)
  - Boundaries (none / count)

Update preferences_unlocked_at when threshold reached.

Verify: Locked state shows for new users. Unlocks after 5 notes.
```
- [ ] Locked state displays
- [ ] Unlocks at 5 notes

### Task 14: Preference Edit Modals
```
Read: /docs/phase9/04-twin-tab-profile.md (Edit Tone, Life Context, Key People, Boundaries modals)

Implement edit modals for:
- Tone (4 radio options)
- Life context (textarea, 200 char limit)
- Key people (list + add form)
- Boundaries (tag input)

Save to user_profiles (tone, life_context, boundaries).
Key people saves to user_key_people table.

Verify: All preference edits work and persist
```
- [ ] Tone modal
- [ ] Life context modal
- [ ] Key people modal
- [ ] Boundaries modal

---

## Phase 9.4: Entity System

### Task 15: Entity Extraction
```
Read: /docs/phase9/05-entity-system.md (Entity Extraction)

In analysis API (api/analyze.js):
- Add entity extraction to prompt
- Parse entities from response
- Call processExtractedEntities()

Create processExtractedEntities():
- Upsert to user_entities table
- Update mention_count, sentiment_average, context_notes
- Return new unconfirmed person entities

Verify: After saving a note mentioning "Sarah", check user_entities table
```
- [ ] Entities extracted and saved

### Task 16: Entity Confirmation Prompt
```
Read: /docs/phase9/05-entity-system.md (Entity Confirmation Prompt)

After note analysis, if new person entities:
- Show entity prompt below analysis
- Quick-tap relationship options
- Skip and "Don't ask again" buttons
- Confirm saves relationship and sets confirmed=true
- Dismiss hides prompt (Don't ask again sets dismissed=true)

Verify: Mention new name, see prompt, confirm works
```
- [ ] Prompt appears for new people
- [ ] Confirm/dismiss works

### Task 17: YOUR WORLD Display
```
Read: /docs/phase9/05-entity-system.md (YOUR WORLD Display)

In TWIN tab, add YOUR WORLD section:
- Fetch entities grouped by type
- Display people, projects, places, pets
- Show name, relationship (if known), mention count
- Unconfirmed entities show "?" and "Add context" button
- Empty states for each category

Verify: TWIN tab shows extracted entities
```
- [ ] YOUR WORLD section displays
- [ ] Grouped by type
- [ ] Unconfirmed shown differently

### Task 18: Entity Edit Modal
```
Read: /docs/phase9/05-entity-system.md (Entity Edit Modal)

Implement entity edit:
- Click edit on entity → open modal
- Edit relationship, add notes
- Show stats (mention count, first/last seen)
- "Remove from Twin" sets dismissed=true
- Save updates entity

Verify: Can edit and remove entities
```
- [ ] Entity edit works
- [ ] Remove works

---

## Phase 9.5: Context Injection

### Task 19: buildUserContext Function
```
Read: /docs/phase9/06-context-injection.md

Create js/context.js (or add to api/):
- buildUserContext(userId)
- getContextLevel(noteCount)
- buildMinimalContext()
- buildBasicContext()
- buildGrowingContext()
- buildFullContext()
- getToneGuidance()

Verify: Call buildUserContext(), log output, confirm structure
```
- [ ] Context builder works

### Task 20: Integrate Context into Analysis
```
Read: /docs/phase9/06-context-injection.md (Integration section)

In api/analyze.js:
- Import buildUserContext
- Call it before building prompt
- Prepend context to analysis prompt
- Add tone guidance based on profile.tone

Verify: Analysis prompt in logs shows user context prepended
```
- [ ] Context appears in prompts

### Task 21: Feedback Recording
```
Read: /docs/phase9/06-context-injection.md (Recording Feedback)

When APPROVE/REJECT clicked:
- Determine insight type of the note
- Call recordFeedback(noteId, type, userId, insightType)
- Update user_learning_profile aggregates
- Show toast: "Noted — I'll remember this resonates" / "Got it — I'll adjust"

Verify: Click approve, check user_feedback and user_learning_profile tables
```
- [ ] Feedback saves to user_feedback
- [ ] Aggregates update in user_learning_profile
- [ ] Toast shows

### Task 22: Test Personalization
```
Create test account. Complete onboarding:
- Name: "Test"
- Role: BUILDING
- Goals: DECISIONS, SELF_UNDERSTANDING

Write 5 notes. Approve 2, reject 1.

Check:
1. Context in analysis prompt includes profile
2. After 5 notes, context includes feedback patterns
3. After 10 notes, full context appears

Compare outputs between new user and trained user.

Document any issues.
```
- [ ] Personalization noticeably different with training

---

## Post-Implementation

### Cleanup
- [ ] Remove any console.logs
- [ ] Test on mobile
- [ ] Test cross-browser sync
- [ ] Update STATUS.md and CLAUDE.md

### Metrics to Track
- Onboarding completion rate
- APPROVE/REJECT ratio over time
- Entity confirmation rate
- Preference fill rate (how many unlock and fill preferences)
