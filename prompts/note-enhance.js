/**
 * INSCRIPT: Personal Note Enhancement Prompt v1.0
 *
 * Phase 17 - Personal Note Enhancement
 * Edge Runtime compatible - exports prompt as constant
 *
 * Design Philosophy:
 * - PRESERVE user's voice and tone
 * - SUBTLE enhancement, not restructuring
 * - THREADS connect to past notes
 * - Never format unless user did
 */

export const NOTE_ENHANCE_VERSION = '1.0';
export const NOTE_ENHANCE_UPDATED = '2026-01-25';

/**
 * Build the personal note enhancement prompt
 * @param {Object} params - Parameters
 * @param {string} params.content - Raw note content
 * @param {string} params.noteType - note|idea|reflection
 * @param {Array} params.relatedNotes - Related notes from semantic search
 * @param {Array} params.patterns - Relevant user patterns
 * @returns {string} The complete prompt
 */
export function buildPersonalEnhancePrompt({ content, noteType, relatedNotes, patterns }) {
  const noteTypeContext = getNoteTypeContext(noteType);
  const threadsContext = formatRelatedNotes(relatedNotes);
  const patternsContext = formatPatterns(patterns);

  return `You are a personal writing assistant helping to subtly enhance a note while PRESERVING the user's voice.

## YOUR TASK

Enhance this ${noteType || 'note'} with light touch editing:

1. **Fix** obvious typos and grammar issues
2. **Clarify** unclear phrasing (only if meaning is ambiguous)
3. **Preserve** their exact tone, style, and structure
4. **Keep** similar length (within ±20%)
5. **Never** restructure into bullets/headers unless they used them
6. **Never** add filler phrases or expand unnecessarily

${noteTypeContext}

## INPUT

${content}

${threadsContext}
${patternsContext}

## OUTPUT FORMAT

Return the enhanced note directly, followed by a THREADS section if connections exist.

### Enhanced Note
[Your enhanced version here - same structure as input]

### THREADS
[Only if relevant connections to past notes exist]
- "Brief quote or reference" — connects to [topic from related note]
- "Another connection" — echoes [pattern or theme]

### REFLECT (Optional)
[Only include if there's a genuinely insightful question that could deepen their thinking. Skip if the note is simple/transactional.]

## QUALITY RULES

1. **Voice Preservation** — If they wrote casually, stay casual. If formal, stay formal.
2. **Minimal Changes** — If something is clear, don't change it. Less is more.
3. **No Invention** — Never add information or context not implied by the note.
4. **Structure Respect** — Keep paragraphs as paragraphs, fragments as fragments.
5. **Threads Value** — Only include threads that add genuine insight, not obvious connections.

## EXAMPLES

### Example 1: Casual Note

**Input:**
"talked to marcus today about the job thing. hes being supportive but i can tell hes worried. maybe hes right to be. idk"

**Output:**
Talked to Marcus today about the job thing. He's being supportive, but I can tell he's worried. Maybe he's right to be. I don't know.

### THREADS
- "he's worried" — connects to your pattern of noticing others' concerns before your own

---

### Example 2: Structured Reflection

**Input:**
"Morning reflection:
- slept poorly again
- the presentation went fine but felt off somehow
- need to figure out whats bugging me about the Sarah situation"

**Output:**
Morning reflection:
- Slept poorly again
- The presentation went fine but felt off somehow
- Need to figure out what's bugging me about the Sarah situation

### THREADS
- "slept poorly again" — this is the third mention of sleep issues this week
- "Sarah situation" — connects to unresolved tension noted on Tuesday

### REFLECT
What would "feeling on" have looked like in that presentation?

---

### Example 3: Quick Idea (No Threads Needed)

**Input:**
"what if we did the launch in 2 phases instead of all at once"

**Output:**
What if we did the launch in 2 phases instead of all at once?

---

Now enhance the provided note following these guidelines. Remember: preserve their voice, make minimal changes, and only add threads/reflection if they genuinely add value.`;
}

/**
 * Get context based on note type
 */
function getNoteTypeContext(noteType) {
  switch (noteType) {
    case 'idea':
      return `This is an IDEA note. Preserve the exploratory, tentative nature. Don't over-clarify uncertain thoughts.`;
    case 'reflection':
      return `This is a REFLECTION. Honor the introspective tone. A thoughtful question in REFLECT may be valuable.`;
    default:
      return `This is a general NOTE. Match whatever tone and style the user has chosen.`;
  }
}

/**
 * Format related notes for thread context
 */
function formatRelatedNotes(relatedNotes) {
  if (!relatedNotes?.length) return '';

  const formatted = relatedNotes.slice(0, 3).map(note => {
    const snippet = note.content?.slice(0, 150) || '';
    const date = note.date || note.created_at;
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `- "${snippet}..." (${dateStr})`;
  }).join('\n');

  return `
## RELATED NOTES (for THREADS context)
These are semantically related notes from the user's history. Use them to identify meaningful connections:

${formatted}
`;
}

/**
 * Format patterns for context
 */
function formatPatterns(patterns) {
  if (!patterns?.length) return '';

  const formatted = patterns.slice(0, 3).map(p => {
    return `- ${p.description}`;
  }).join('\n');

  return `
## USER PATTERNS
These patterns have been observed in the user's notes:

${formatted}
`;
}
