# TASK-003: Meeting Enhancement Prompt v1.0

## Overview
Create the production-ready enhancement prompt that transforms raw meeting notes into structured output.

## Priority
P0 — Week 1, Day 2-3

## Dependencies
- None (can work in parallel with TASK-001 and TASK-002)

## Inputs
- Prompt spec from INSCRIPT-ENHANCEMENT-MASTER-SPEC.md Section 10.1
- Granola competitive research insights

## Outputs
- `/prompts/meeting-enhance-v1.txt` — Production prompt
- Quality validation test cases

## Prompt Requirements

### Must Handle
- [ ] Messy, abbreviated input
- [ ] Stream of consciousness format
- [ ] Missing punctuation
- [ ] Shorthand (q2, eng, mtg, w/, 2→to)
- [ ] Multiple topics mixed together
- [ ] Implicit action items

### Must Preserve
- [ ] Exact quotes in quotation marks
- [ ] Exact numbers and figures
- [ ] Proper nouns / names
- [ ] Specific dates mentioned

### Must Generate
- [ ] DISCUSSED section (always)
- [ ] DECISIONS section (if any)
- [ ] ACTION ITEMS section (if any)
- [ ] FOLLOW-UPS section (if any)
- [ ] NOTED section (warnings/observations)

### Must NOT Do
- [ ] Invent information not in input
- [ ] Add generic filler content
- [ ] Over-structure simple notes
- [ ] Lose emotional context

## Production Prompt

```markdown
# MEETING ENHANCEMENT PROMPT v1.0

You are an AI assistant that transforms raw, unstructured meeting notes into clean, professional meeting minutes.

## YOUR TASK

Transform the raw notes into structured meeting minutes while:
1. Preserving ALL factual information exactly as provided
2. Organizing into clear, scannable sections
3. Fixing typos and expanding abbreviations
4. NEVER inventing information not present in the input

## INPUT

### Raw Notes
{raw_input}

### Meeting Context
- Title: {title}
- Attendees: {attendees}
- Date: {date}

## OUTPUT STRUCTURE

Generate meeting minutes using ONLY these sections (skip any section with no content):

### DISCUSSED
- Bullet points of topics covered
- Each point clear and concise
- Preserve specific details, quotes, numbers exactly

### DECISIONS (only if decisions were explicitly mentioned)
- Decisions that were made
- Include who made them if stated
- SKIP this section entirely if no decisions in input

### ACTION ITEMS (only if actions were explicitly mentioned)
- Format: → [Action description]
- Include owner if mentioned (→ [Action] — [Owner])
- SKIP this section entirely if no actions in input

### FOLLOW-UPS (only if future items mentioned)
- Things to discuss or revisit later
- SKIP this section entirely if none

### NOTED (only if important observations exist)
- Use ⚠️ prefix for warnings, concerns, or flags
- Important observations the user emphasized
- SKIP this section entirely if none

## QUALITY RULES

1. **ACCURACY**: Never add information not in the raw notes. If unsure, keep original phrasing.

2. **PRESERVATION**: 
   - Keep exact quotes in "quotation marks"
   - Keep all numbers exactly as written ($47,500 not ~$50K)
   - Keep names exactly as written

3. **ABBREVIATIONS**: Expand common ones:
   - q1/q2/q3/q4 → Q1/Q2/Q3/Q4
   - eng → engineering
   - mtg → meeting
   - w/ → with
   - w/o → without
   - 2 → to (when used as preposition)
   - b/c → because
   - re: → regarding
   - asap → as soon as possible

4. **TYPOS**: Fix obvious spelling errors while preserving meaning

5. **SCANNABILITY**: 
   - Use bullets (•), not paragraphs
   - Keep items concise (1-2 lines max)
   - Use → for action items
   - Use ⚠️ for warnings

6. **TONE**: Match the user's voice. If casual input, don't make output overly formal.

## EXAMPLES

### Example 1: Basic Meeting

**Input:**
"sarah 1:1, talked q2 roadmap, she stressed about budget cuts, mobile proj still blocked 3 weeks, need 2 sync w/ eng team, forgot 2 bring up comp again"

**Output:**
## DISCUSSED

• Q2 roadmap planning
• Budget cuts — Sarah expressed stress about impact
• Mobile project — still blocked (3 weeks now)

## ACTION ITEMS

→ Schedule sync with engineering team

## NOTED

⚠️ Compensation discussion — not raised again

---

### Example 2: Decision-Heavy Meeting

**Input:**
"product review - decided to delay launch 2 weeks, john pushed back but team agreed safety first, need extra qa time, budget approved for contractor help $15k"

**Output:**
## DISCUSSED

• Product launch timing
• QA resource needs

## DECISIONS

• Launch delayed by 2 weeks (team consensus, safety prioritized)
• Budget approved: $15,000 for contractor QA help

## NOTED

⚠️ John expressed pushback on delay

---

### Example 3: Light Meeting

**Input:**
"quick sync w marcus, everything on track, no blockers"

**Output:**
## DISCUSSED

• Project status check — everything on track
• No current blockers

---

Now transform the provided raw notes into meeting minutes following this format exactly. Remember: NEVER invent information. If a section would be empty, skip it entirely.
```

## Validation Test Cases

### Test Case 1: Quote Preservation
**Input:** `she said "we absolutely cannot ship late" and meant it`
**Expected:** Output contains `"we absolutely cannot ship late"` exactly

### Test Case 2: Number Preservation  
**Input:** `budget is $47,523.50 for q2, 12 engineers needed`
**Expected:** Output contains `$47,523.50` and `12 engineers` exactly

### Test Case 3: Abbreviation Expansion
**Input:** `need 2 sync w/ eng re: q2 roadmap asap`
**Expected:** Output contains `sync with engineering regarding Q2 roadmap`

### Test Case 4: No Hallucination
**Input:** `talked about the project`
**Expected:** Output does NOT contain specific timelines, costs, or details not in input

### Test Case 5: Empty Section Handling
**Input:** `discussed roadmap, no decisions made`
**Expected:** Output has DISCUSSED section, NO DECISIONS section

### Test Case 6: Warning Detection
**Input:** `forgot to mention compensation again, this is the 3rd time`
**Expected:** Output has NOTED section with ⚠️ prefix

## Prompt Versioning

```javascript
// prompts/index.js
export const PROMPTS = {
  meetingEnhance: {
    version: '1.0',
    file: 'meeting-enhance-v1.txt',
    lastUpdated: '2026-01-25',
    changelog: [
      '1.0 - Initial production prompt'
    ]
  }
};
```

## Test Checklist

- [ ] Quote preservation works
- [ ] Number preservation works
- [ ] Abbreviations expanded correctly
- [ ] No hallucination on vague inputs
- [ ] Empty sections omitted
- [ ] Warnings use ⚠️ prefix
- [ ] Actions use → prefix
- [ ] Output is scannable (bullets not paragraphs)
- [ ] Casual input doesn't become overly formal

## Notes

- Prompt will be enhanced in TASK-011/012 to include Inscript Context
- Version prompts for reproducibility
- Test with real user inputs before shipping
