# Digital Twin PWA — Project Status

**Last Updated:** January 11, 2026  
**Project Location:** `~/Projects/digital-twin`

---

## What We Built Today

### Phase 1: Capture (MVP) ✅ COMPLETE
- Voice input (Web Speech API)
- Text input
- Image/media input (camera + gallery)
- Classification (4 categories)
- Extraction (title, topics, actions, sentiment)
- Refinement (Claude API)
- Note storage (IndexedDB)
- Notes list/detail UI
- Copy/Export
- Weekly Digest

### Phase 2: Enrich ✅ COMPLETE
- **Image Capture** — Camera + photo library on all devices
- **Vision Processing** — Claude Vision API for OCR + descriptions
- **Weekly Digest** — AI-generated summary of week's notes
- **App PIN** — 6-digit PIN lock (doubles as encryption key)
- **E2E Encryption** — AES-256-GCM, key never leaves device
- **Cloud Sync** — Supabase backend (partially working)

---

## Current Status

### Working ✅
- PIN setup and unlock (laptop + mobile)
- Voice/text/image capture
- Note processing with Claude API
- Local storage (IndexedDB)
- Weekly digest generation
- PWA installable

### Needs Fixing 🔧
| Issue | Status | Notes |
|-------|--------|-------|
| Cloud sync | Not working | Auth flow exists but sync not triggering |
| Supabase auth | Added | Sign-in/sign-up in Settings — needs testing |
| RESEND_API_KEY | Shows "not configured" | Key is in .env.local but not being read |

---

## Tomorrow's Tasks

### Priority 1: Fix Cloud Sync
1. Test the new sign-in/sign-up flow in Settings
2. Verify Supabase auth works
3. Confirm notes sync between laptop and mobile
4. Check Supabase dashboard for rows in `notes` table

### Priority 2: Fix RESEND_API_KEY
1. Check api/recovery.js for correct env var name
2. Verify .env.local format (no spaces, no quotes)
3. Test "Forgot PIN?" email delivery

### Priority 3: Build Phase 3 (Content Creator)
Spec ready at: `~/Downloads/RALPH-PHASE3-CONTENT-SPEC.md`

Features to build:
- Voice Engine (learns your writing style)
- Content Suggester (flags notes worth posting)
- Quality Loop (draft → critique → iterate → publish-ready)
- CREATE tab in navigation

Run command:
```
/ralph-loop

SPEC: ~/Downloads/RALPH-PHASE3-CONTENT-SPEC.md
PROJECT: ~/Projects/digital-twin

Build: Voice Engine, Content Suggester, Quality Loop
Design: Vogue magazine minimalist

When done, touch .ralph-complete and STOP.
```

---

## Key Design Guidelines

**Aesthetic:** Vogue Magazine Minimalist
- Playfair Display for headings (serif)
- Inter for body (sans)
- Black/white only
- Generous whitespace
- No unnecessary elements
- Editorial, refined, confident typography
- No emojis in UI unless essential

---

## Environment Setup

### .env.local (in project root)
```
ANTHROPIC_API_KEY=sk-ant-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...
RESEND_API_KEY=re_xxxxxxxx
```

### Supabase
- Project created ✅
- SQL schema run ✅
- Tables: `notes`, `recovery_keys`
- RLS policies enabled ✅

### Resend
- API key created ✅
- For PIN recovery emails

---

## Run Commands

**Start dev server:**
```bash
cd ~/Projects/digital-twin
vercel dev
```

**Run Ralph Loop:**
```bash
claude --dangerously-skip-permissions
```
Then:
```
/ralph-loop

SPEC: [path-to-spec]
PROJECT: ~/Projects/digital-twin
[instructions]

When done, touch .ralph-complete and STOP.
```

**Kill stuck server:**
```bash
pkill -f "vercel dev"
```

**Hard refresh browser:**
- Mac: `Cmd + Shift + R`
- Clear site data: DevTools → Application → Storage → Clear site data

---

## Phase 3 Notes (Content Creator)

Key decisions made:
1. **Voice Engine learns automatically** — Runs on every note save (background, async)
2. **Content generation is on-demand** — Only when you tap CREATE
3. **Speed is priority** — Note-taking must stay fast, no lag
4. **Quality Loop from Ralph Wiggum** — Draft → Critique → Iterate until "Would Rox post this?" = YES

Voice Engine learns:
- Vocabulary patterns
- Sentence length
- Tone (direct, casual, provocative)
- Signature phrases
- Topics you care about

---

## Files Created Today

### Specs (in ~/Downloads or /mnt/user-data/outputs)
- `RALPH-PHASE2-SPEC.md` — Image, Vision, Digest
- `RALPH-PHASE2B-SPEC.md` — PIN, Encryption, Cloud Sync
- `RALPH-PHASE3-CONTENT-SPEC.md` — Voice Engine, Content Creator

### Project Files
```
digital-twin/
├── js/
│   ├── pin.js          # PIN lock + encryption
│   ├── sync.js         # Supabase cloud sync
│   ├── camera.js       # Image capture
│   ├── digest.js       # Weekly digest
│   └── ... (existing)
├── api/
│   ├── vision.js       # Claude Vision API
│   ├── digest.js       # Digest generation
│   ├── recovery.js     # PIN recovery email
│   └── refine.js       # Note refinement
├── .env.local          # API keys
└── .claude/
    └── ralph-loop.local.md
```

---

## Reference Links

- Supabase Dashboard: https://supabase.com/dashboard
- Resend Dashboard: https://resend.com
- Vercel Dashboard: https://vercel.com
- Ralph Wiggum Marketer (inspiration): https://github.com/muratcankoylan/ralph-wiggum-marketer

---

## Quick Resume Tomorrow

1. Open terminal:
   ```bash
   cd ~/Projects/digital-twin
   vercel dev
   ```

2. Test sync: Settings → Sign in → Create note → Check Supabase dashboard

3. If sync works → Start Phase 3 build

4. If sync broken → Run in Claude Code:
   ```
   Debug cloud sync. Check Sync.init(), auth flow, and why notes aren't appearing in Supabase.
   ```

---

*Document created: January 11, 2026*
