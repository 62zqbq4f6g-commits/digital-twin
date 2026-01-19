# Phase 7 Implementation Plan: Feedback Loop & Learning

## Objective
Transform static memory into compounding intelligence through user feedback.

## Success Criteria
1. User gives thumbs down to verbose summary
2. Next similar note produces concise summary
3. User sees visible improvement ("Based on your preferences...")
4. Flywheel accelerates

---

## Database Changes

### 1. Expand output_feedback table
```sql
ALTER TABLE output_feedback ADD COLUMN IF NOT EXISTS original_output JSONB;
ALTER TABLE output_feedback ADD COLUMN IF NOT EXISTS edited_output JSONB;
ALTER TABLE output_feedback ADD COLUMN IF NOT EXISTS edit_type TEXT;
```

### 2. Create action_signals table
```sql
CREATE TABLE IF NOT EXISTS action_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_id TEXT,
  action_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  time_to_complete INTEGER,
  nudge_type TEXT,
  nudge_clicked BOOLEAN DEFAULT FALSE
);

-- RLS policy
ALTER TABLE action_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own action_signals" ON action_signals
  FOR ALL USING (auth.uid() = user_id);
```

---

## Implementation Steps

### Step 1: Database Setup (Supabase SQL Editor)
- Execute ALTER TABLE for output_feedback
- Execute CREATE TABLE for action_signals
- Verify RLS policies

### Step 2: js/feedback.js - Enhanced Feedback Capture
**Changes:**
- Add edit tracking functionality
- Capture original_output before any edits
- Store edited_output when user modifies
- Determine edit_type (tone_change, length_change, content_change, etc.)

**New Functions:**
- `captureOriginalOutput(noteId, output)` - Store before state
- `captureEdit(noteId, editedOutput)` - Store after state with diff analysis
- `classifyEditType(original, edited)` - Determine what changed

### Step 3: js/quality-learning.js - Preference Aggregation
**Changes:**
- Aggregate feedback into preferences
- Build few-shot examples from liked outputs
- Track negative examples from disliked outputs
- Generate preference summaries

**New Functions:**
- `aggregatePreferences()` - Build preference profile
- `getLikedExamples(type, limit)` - Get max 3 per type
- `getDislikedExamples(type, limit)` - Get negative examples
- `getPreferenceSummary()` - Return user's style preferences

### Step 4: js/analyzer.js - Inject Preferences into Analysis
**Changes:**
- Load preferences before analysis
- Format as XML blocks for prompt injection
- Pass to API

**Modified Functions:**
- `analyze()` - Add preferences to API call

**New Functions:**
- `buildPreferencesContext()` - Format preferences as XML

### Step 5: api/analyze.js - Use Preferences in Prompts
**Changes:**
- Accept preferences in request
- Inject into system prompt
- Apply to output generation

**Modified Functions:**
- `buildTaskSystemPrompt()` - Add preferences section
- `buildPersonalSystemPrompt()` - Add preferences section

### Step 6: js/actions-ui.js - Completion Signals
**Changes:**
- Track when actions are marked complete
- Store completion time and context
- Track nudge effectiveness

**New Functions:**
- `trackActionCompletion(actionId, actionText)` - Store signal
- `trackNudgeClick(actionId, nudgeType)` - Track nudge engagement

### Step 7: js/ui.js - Visible Adaptation
**Changes:**
- Show "Based on your preferences" indicator
- Display when preferences influence output
- Build trust through transparency

**New Functions:**
- `showPreferenceInfluence(noteId, preferences)` - Visual indicator

---

## XML Context Structure

```xml
<user_preferences>
  <preferred_length>concise, under 50 words</preferred_length>
  <tone>direct, no emotional language</tone>
  <format>bullet points preferred</format>
</user_preferences>

<good_examples>
  <example type="summary">User liked: "Follow up with Sarah on Jakarta pricing by Friday"</example>
  <example type="action">User liked: "Send proposal by EOD"</example>
</good_examples>

<bad_examples>
  <example type="summary">User disliked: "This reflects your deep commitment to growth and your journey of self-improvement..."</example>
</bad_examples>
```

---

## Edge Cases (from Gemini Review)

### 1. Ambiguous Corrections
- User edits "Sarah is my CEO" to "Sarah is my co-founder"
- Could be: Correction OR new information
- **Solution:** Check if existing entity exists, then decide update vs create

### 2. Fact-Fighting
- User corrects entity but Twin has conflicting data
- **Solution:** User corrections always win (trust signal)

### 3. Redundant Updates
- User edits minor phrasing, not factual content
- **Solution:** Only extract entity/preference updates from meaningful changes

### 4. Stale Examples
- Old liked examples may not reflect current preferences
- **Solution:** Weight recent feedback higher, consider TTL on examples

---

## Testing Plan

1. **Feedback Capture Test**
   - Create note, give thumbs down
   - Verify stored in output_feedback with context

2. **Edit Tracking Test**
   - Create note, edit the summary
   - Verify original and edited captured

3. **Few-Shot Test**
   - Give thumbs up to 3+ outputs
   - Create new note, verify liked examples in prompt

4. **Preference Influence Test**
   - Give thumbs down to verbose output
   - Create similar note
   - Verify output is more concise
   - Verify "Based on your preferences" indicator shows

5. **Action Completion Test**
   - Complete an action
   - Verify action_signal stored with timing

---

## File Modification Summary

| File | Lines Added (est) | Changes |
|------|-------------------|---------|
| js/feedback.js | ~100 | Edit tracking, capture functions |
| js/quality-learning.js | ~150 | Preference aggregation, few-shot |
| js/analyzer.js | ~50 | Preferences context building |
| api/analyze.js | ~80 | Preferences injection in prompts |
| js/actions-ui.js | ~60 | Completion signal tracking |
| js/ui.js | ~40 | Preference indicator display |

---

## Commit Strategy

1. Database schema changes (SQL)
2. feedback.js changes
3. quality-learning.js changes
4. analyzer.js + api/analyze.js changes
5. actions-ui.js changes
6. ui.js changes
7. Integration testing commit

---

*Created: January 15, 2026*
*Phase 7: Feedback Loop & Learning*
