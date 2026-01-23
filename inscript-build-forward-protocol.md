# INSCRIPT: BUILD FORWARD PROTOCOL

> This prompt ensures all development builds forward — never backwards.
> Include at the start of ANY Claude Code session working on Inscript.

---

## PRIME DIRECTIVE

**Every change must leave the codebase better than you found it.**

- ✅ Refine, simplify, enhance
- ✅ Fix bugs without creating new ones
- ✅ Remove complexity, add clarity
- ❌ Never regress existing features
- ❌ Never violate design system
- ❌ Never add unnecessary complexity

---

## CURRENT STATE (January 24, 2026)

### Version: 8.2.1

### What's Working (DO NOT BREAK)
- ✅ Note creation + AI reflections (heard/noticed/question)
- ✅ Memory system (Mem0 parity ~95%)
- ✅ Entity extraction with embeddings
- ✅ Category summaries (evolving)
- ✅ WORK tab (Pulse, Actions, Meetings, Commitments)
- ✅ TWIN tab (Stats, Patterns, Key People)
- ✅ MIRROR chat with Key People recognition
- ✅ Skeleton loading states
- ✅ Knowledge Pulse toast (white, "✓ Saved" only)
- ✅ Meeting dates display correctly
- ✅ No duplicate meetings
- ✅ Job title filtering in entities
- ✅ Pattern quality (LLM hybrid, no day-based patterns)

### Recent Fixes (Already Resolved)
- ✅ Knowledge Pulse black background → white
- ✅ Pattern removed from save toast
- ✅ TwinProfile 500 errors → null-safe access
- ✅ Onboarding 406 error → .maybeSingle()
- ✅ Pulse API 500 error → uses unencrypted tables
- ✅ Dismissed patterns hidden from TWIN tab

---

## DESIGN SYSTEM (MUST FOLLOW)

### Colors
| Use | Color |
|-----|-------|
| Background | `#FFFFFF` (white) |
| Paper/Cards | `#FAFAFA` |
| Text Primary | `#1A1A1A` |
| Text Secondary | `#6B6B6B` |
| Borders | `rgba(0,0,0,0.06)` to `rgba(0,0,0,0.12)` |
| Buttons ONLY | `#000000` (black) |

### FORBIDDEN
- ❌ Black backgrounds (except buttons)
- ❌ Colored backgrounds (blue, red, green, etc.)
- ❌ Gradients
- ❌ Heavy shadows
- ❌ Borders heavier than 1px

### Typography
- **Primary**: Inter, system fonts
- **Editorial**: Cormorant Garamond (loading states, quotes)
- **Spacing**: 4px base unit

### Components
```css
/* Cards */
.card {
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
}

/* Buttons - ONLY place for black */
.button-primary {
  background: #000000;
  color: #FFFFFF;
  border-radius: 8px;
}

/* Toasts - Always white */
.toast {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #1A1A1A;
}
```

---

## ARCHITECTURE (DO NOT UNDERMINE)

### Memory System (Core Product)
```
Layer 1: notes table (raw data)
Layer 2: user_entities (atomic facts + embeddings)
Layer 3: category_summaries (evolving prose)
```

### Performance Architecture
```
CRITICAL PATH (3-5s): getMemoryContextFast → generateReflection → RETURN
BACKGROUND (via ctx.waitUntil): extractEntities → embeddings → save → summaries
```

### File Ownership
| Area | Files |
|------|-------|
| Backend (T1) | `api/*.js`, `vercel.json` |
| Frontend (T2) | `js/*.js`, `css/*.css` |
| Shared (coordinate) | `js/ui.js`, `index.html` |

---

## BUILD FORWARD CHECKLIST

Before making ANY change, verify:

### Pre-Flight
- [ ] Did I pull latest? (`git pull origin main`)
- [ ] Do I understand what currently works?
- [ ] Will this change break existing features?
- [ ] Does this follow the design system?

### During Development
- [ ] Am I adding complexity or removing it?
- [ ] Am I fixing one thing without breaking another?
- [ ] Am I touching only files in my ownership area?
- [ ] Am I following the commit prefix (T1: or T2:)?

### Pre-Commit
- [ ] Does the app still load without errors?
- [ ] Do all existing features still work?
- [ ] Did I test both light and dark mode?
- [ ] Did I check mobile responsiveness?
- [ ] Are there any console errors?

### Commit Message Format
```
<type>(<scope>): <description>

Types: feat, fix, refactor, style, docs, perf
Scope: notes, work, twin, mirror, ui, api, memory

Examples:
- fix(ui): Remove black background from toast
- feat(work): Add skeleton loaders to Pulse
- refactor(twin): Simplify pattern display
- perf(api): Optimize entity extraction
```

---

## REGRESSION PREVENTION

### Quick Smoke Test
After any change, verify these still work:

```
1. NOTES: Create note → reflection appears
2. WORK > PULSE: Loads with greeting
3. WORK > MEETINGS: Shows list, dates correct
4. TWIN: Stats show immediately
5. MIRROR: Responds, knows Key People
6. SAVE: Shows white "✓ Saved" toast
```

### If Something Breaks
1. `git diff` — see what changed
2. `git stash` — temporarily revert
3. Test if issue persists
4. If stash fixes it, your change caused the regression
5. Fix the issue before proceeding

---

## WHAT "BUILD FORWARD" MEANS

### ✅ Building Forward
- Fixing a bug properly
- Simplifying complex code
- Removing unused code
- Improving performance
- Adding missing error handling
- Enhancing UX without changing core flow
- Following design system consistently

### ❌ Building Backwards
- Fixing one bug, creating another
- Adding complexity without clear benefit
- Violating design system "just this once"
- Changing working features unnecessarily
- Ignoring mobile/dark mode
- Skipping tests to move faster
- Breaking memory system for "optimization"

---

## TECH DEBT AWARENESS

### Known Tech Debt (OK to defer)
- `js/ui.js` is 4,138 lines (needs modularization)
- `css/styles.css` is 8,400+ lines (needs modularization)
- `api/analyze.js` is 3,600 lines (needs splitting)

### Tech Debt Rules
- Don't add to tech debt without strong reason
- If you must, document it
- Don't let tech debt block features
- Refactor incrementally, not all at once

---

## ITERATION LOOP FOR FIXES

When fixing any issue:

```
ATTEMPT 1
├── Implement fix
├── Test the specific fix
├── Test for regressions (memory system, core features)
├── PASS? → Commit and continue
└── FAIL? → Analyze why

ATTEMPT 2 (if needed)
├── Adjust approach based on findings
├── Implement adjusted solution
├── Test again
├── PASS? → Commit and continue
└── FAIL? → One more try

ATTEMPT 3 (if needed)
├── Try alternative approach
├── Test thoroughly
├── PASS? → Commit and continue
└── FAIL? → Flag for review, document findings
```

---

## STARTING A SESSION

Begin every Claude Code session with:

```
I am working on Inscript.

Before I start:
1. git pull origin main
2. Read CLAUDE.md for guidelines
3. Check STATUS.md for current state

My task: [describe task]

I will follow the Build Forward Protocol:
- No regressions
- Follow design system
- Test before committing
- Use proper commit prefix (T1: or T2:)
```

---

## ENDING A SESSION

Before closing:

```bash
# Ensure everything is committed and pushed
git status
git add -A
git commit -m "<type>(<scope>): <description>"
git push origin main

# Verify deployment
# Check https://digital-twin-ecru.vercel.app
```

Update STATUS.md if significant changes were made.

---

## SUMMARY

**The Golden Rule:**

> If you're not sure whether a change builds forward or backwards, 
> ask yourself: "Would the codebase be better if this change never existed?"
> 
> If the answer is "no" or "maybe," don't make the change.

Every line of code should earn its place.
Every change should make the product better.
Every session should leave things cleaner than you found them.

**Build forward. Always.**
