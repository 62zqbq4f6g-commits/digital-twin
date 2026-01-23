# Terminal 2 - Frontend Tasks

I am Terminal 2. My focus: UI and frontend.

## My Files (safe to edit):
- `js/*.js`
- `css/*.css`
- `index.html`

## Do NOT edit:
- `api/*.js` (Terminal 1 owns these)
- `vercel.json` (Terminal 1 owns this)

## Current State
- Notes tab: Working
- WORK tab: Meeting dates fixed, double-save fixed
- TWIN tab: Working
- MIRROR tab: Working
- Onboarding: Fixed (.maybeSingle())

## Tasks

### P0 - Critical
1. **Split ui.js into modules**
   - Current: 4,800+ lines (too large)
   - Target modules:
     - `js/ui-core.js` — Core utilities, initialization
     - `js/ui-notes.js` — Note rendering, input handling
     - `js/ui-twin.js` — TWIN tab specific code
     - `js/ui-modals.js` — Modal management
     - `js/ui-onboarding.js` — Onboarding flow
   - Goal: No file > 1,000 lines

### P1 - Important
2. **Debug attendee capture in meetings**
   - File: `js/work-ui.js`
   - Issue: Attendees showing as "team" even when names entered
   - Check: `saveMeeting()` function, look for attendee parsing logic
   - Console log: `[WorkUI] saveMeeting - Attendees from chips/input`

3. **Improve loading states**
   - Add skeleton loaders for TWIN stats
   - Better feedback during note processing
   - Consistent loading messages

4. **Polish dark mode**
   - File: `css/styles.css`
   - Ensure all components have dark mode styles
   - Check contrast ratios

### P2 - Tech Debt
5. **Modularize styles.css**
   - Current: 8,400+ lines
   - Target modules:
     - `css/core.css` — Variables, resets
     - `css/components.css` — Buttons, inputs, cards
     - `css/notes.css` — Notes tab styles
     - `css/work.css` — WORK tab styles
     - `css/twin.css` — TWIN tab styles
     - `css/mirror.css` — MIRROR tab styles

6. **Remove double version log**
   - Issue: Console shows both 8.0.0 and 7.0.0
   - Find and remove duplicate version logging

## JS File Overview

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `ui.js` | 4,800+ | Main UI | Needs split |
| `work-ui.js` | ~1,200 | WORK tab | Working, attendee bug |
| `twin-ui.js` | ~600 | TWIN tab | Working |
| `app.js` | ~300 | App controller | Working |
| `onboarding.js` | ~400 | Onboarding flow | Fixed |
| `sync.js` | ~700 | Cloud sync | Working |
| `db.js` | ~200 | IndexedDB | Working |

## CSS File Overview

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `styles.css` | 8,400+ | All styles | Needs modularization |
| `design-system.css` | ~200 | Variables/tokens | Working |

## Rules
- Commit prefix: `T2:`
- Pull before starting: `git pull origin main`
- Push after completing: `git push origin main`
- Test on mobile: Responsive design required (375px min)
- Do not modify API files

## Quick Commands

```bash
# Start local dev
vercel dev --listen 3001

# Find function in ui.js (don't read whole file)
grep -n "functionName" js/ui.js

# Check for specific pattern
grep -rn "pattern" js/*.js

# Deploy
git add -A && git commit -m "T2: description" && git push origin main
```

## UI Guidelines Reminder

- All clickable elements must be keyboard accessible
- All icon-only buttons need aria-labels
- Colors from approved palette only (black/white/silver)
- Spacing uses defined scale (4/8/12/16/24/32/48/64px)
- Works in dark mode
- Works on mobile (375px)
