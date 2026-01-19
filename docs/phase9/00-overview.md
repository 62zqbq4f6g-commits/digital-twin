# Phase 9: Personalization System — Overview

## Goal
Make every user input affect personalization and learning. The Twin should feel like a thoughtful friend who remembers everything and speaks in a way that resonates with each user specifically.

## What We're Building

1. **Redesigned Profile** — Structured fields (role, goals, tone) instead of freeform text
2. **Onboarding Flow** — 3 screens to capture essential context
3. **Entity Detection** — Auto-extract people/projects from notes, let users confirm
4. **Learning Infrastructure** — Store feedback, track patterns, build vocabulary
5. **Context Injection** — Feed all learning into analysis prompts

## File Structure

```
/docs/phase9/
├── 00-overview.md          ← You are here
├── 01-design-system.md     ← Typography, colors, components
├── 02-database-schema.md   ← All new tables
├── 03-onboarding-flow.md   ← 3-screen onboarding UI
├── 04-twin-tab-profile.md  ← Redesigned TWIN tab
├── 05-entity-system.md     ← Auto-detection + confirmation
├── 06-context-injection.md ← How learning feeds into prompts
└── 07-checklist.md         ← Implementation tasks
```

## Large File Warning

**ui.js is 39k tokens.** Never read the entire file.

When working with ui.js:
1. `grep -n "searchTerm" js/ui.js` to find line numbers
2. Read only specific line ranges (50-100 lines max)
3. Use surgical str_replace edits
4. Consider adding new code in separate files, then importing

## Design Philosophy

**Vogue Minimalist Editorial** — Inspired by high-end magazines (Kinfolk, Cereal, Vogue). Clean typography, intentional whitespace, no decorative elements, confidence through restraint.

Key principles:
- Playfair Display for headlines (serif, editorial)
- Inter for body text (clean sans-serif)
- Sharp corners (border-radius: 0 or 2px max)
- Ink palette (near-blacks, warm grays)
- No bright colors — accent through weight, not color
- Uppercase labels with letter-spacing

## Task Order

```
9.1 Foundation
├── Database tables
├── Design system CSS
└── Font loading

9.2 Onboarding
├── 3-screen flow
└── Save to user_profiles

9.3 TWIN Tab
├── Profile display
├── Edit modals
└── Progressive unlock

9.4 Entities
├── Auto-extraction
├── Confirmation prompt
└── YOUR WORLD display

9.5 Context
├── buildUserContext()
└── Integrate into analyze.js
```
