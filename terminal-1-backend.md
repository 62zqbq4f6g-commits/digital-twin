# Terminal 1 - Backend Tasks

I am Terminal 1. My focus: API and backend.

## My Files (safe to edit):
- `api/*.js`
- `vercel.json`
- `supabase/migrations/*.sql`

## Do NOT edit:
- `js/*.js` (Terminal 2 owns these)
- `css/*.css` (Terminal 2 owns these)

## Current State
- Pulse API: Fixed (now uses action_signals + user_entities)
- Onboarding: Fixed (.maybeSingle())
- All core APIs working

## Tasks

### P0 - Critical
1. **Verify Pulse API works post-fix**
   - File: `api/pulse.js`
   - Test: POST /api/pulse with valid user_id returns 200

2. **Set up Vercel Cron for memory maintenance**
   - Create: `api/cron/memory-maintenance.js`
   - Config: Add to `vercel.json` crons section
   - Tasks: time decay, duplicate detection, old memory compression
   - Reference: vercel.json already has cron config for 3 AM daily

### P1 - Important
3. **Fix 500 errors on TwinProfile sync**
   - File: `api/twin-profile.js`
   - Issue: Intermittent 500 errors during sync
   - Status: Non-blocking but noisy in logs

4. **Improve entity classification**
   - File: `api/extract-entities.js`
   - Issue: Job titles (Senior Engineer, Product Manager) extracted as People
   - Fix: Add job title filter list

5. **Add duplicate entity detection**
   - File: `api/analyze.js`
   - Issue: Same entity created multiple times
   - Fix: Check existing entities before INSERT

### P2 - Tech Debt
6. **Split analyze.js**
   - Current: 3,600+ lines
   - Target: Extract prompts to `api/prompts/*.js`
   - Modules: reflection-prompts, entity-prompts, classification-prompts

## API File Overview

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `analyze.js` | 3,600+ | Main reflection | Working, needs split |
| `pulse.js` | 154 | Morning briefing | Fixed |
| `chat.js` | ~400 | Go deeper conversation | Working |
| `mirror.js` | ~500 | MIRROR chat | Working |
| `twin-profile.js` | ~300 | Profile sync | Has 500 errors |
| `extract-entities.js` | ~400 | Entity extraction | Needs job title filter |
| `embed.js` | ~100 | OpenAI embeddings | Working |

## Rules
- Commit prefix: `T1:`
- Pull before starting: `git pull origin main`
- Push after completing: `git push origin main`
- Test locally before push: `vercel dev --listen 3001`
- Do not modify frontend files

## Quick Commands

```bash
# Start local dev
vercel dev --listen 3001

# Test pulse API
curl -X POST http://localhost:3001/api/pulse \
  -H "Content-Type: application/json" \
  -d '{"user_id": "YOUR_USER_ID"}'

# Deploy
git add -A && git commit -m "T1: description" && git push origin main
```
