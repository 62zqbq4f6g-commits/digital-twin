/**
 * INSCRIPT: Meeting Enhancement Prompt v2.0
 *
 * Institutional-grade meeting output with type detection
 * Edge Runtime compatible - exports prompt as constant
 */

export const MEETING_ENHANCE_VERSION = '2.0';
export const MEETING_ENHANCE_UPDATED = '2026-01-27';

/**
 * Detect meeting type from content and title
 * @param {string} content - Meeting notes content
 * @param {string} title - Meeting title
 * @returns {string} Meeting type: 'standup' | '1on1' | 'interview' | 'sales' | 'retro' | 'brainstorm' | 'general'
 */
export function detectMeetingType(content, title = '') {
  const lower = (content + ' ' + title).toLowerCase();

  const patterns = {
    'standup': [
      'standup', 'stand-up', 'daily sync', 'daily scrum',
      'blockers', 'what did you work on', 'yesterday i', 'today i will',
      'sprint update', 'morning sync'
    ],
    '1on1': [
      '1:1', '1-1', 'one on one', 'one-on-one',
      'check-in', 'how are you feeling', 'career', 'growth',
      'feedback session', 'coaching', 'personal development'
    ],
    'interview': [
      'user interview', 'customer interview', 'user research',
      'usability', 'feedback session', 'customer feedback',
      'user testing', 'discovery call', 'research interview'
    ],
    'sales': [
      'sales call', 'demo', 'pitch', 'prospect',
      'pricing discussion', 'contract', 'proposal',
      'decision maker', 'budget', 'timeline to close',
      'qualified lead', 'objection'
    ],
    'retro': [
      'retrospective', 'retro', 'what went well',
      'what could improve', 'lessons learned', 'post-mortem',
      'sprint review'
    ],
    'brainstorm': [
      'brainstorm', 'ideation', 'workshop',
      'creative session', 'blue sky', 'ideas session'
    ]
  };

  for (const [type, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => lower.includes(k))) {
      return type;
    }
  }

  return 'general';
}

/**
 * Get meeting type display name
 */
export function getMeetingTypeLabel(type) {
  const labels = {
    'standup': 'Team Standup',
    '1on1': '1:1 Meeting',
    'interview': 'User Interview',
    'sales': 'Sales Call',
    'retro': 'Retrospective',
    'brainstorm': 'Brainstorm',
    'general': 'Meeting'
  };
  return labels[type] || 'Meeting';
}

/**
 * Base system prompt - shared context and rules
 */
const BASE_SYSTEM_PROMPT = `You are an AI assistant that transforms raw, unstructured meeting notes into institutional-grade meeting minutes. You have access to the user's memory system for relevant context.

## CORE PRINCIPLES

1. **ACCURACY ABOVE ALL**: Never invent information. If unsure, preserve original phrasing.
2. **PRESERVE EXACTLY**: Keep quotes in "quotation marks", numbers exact ($47,500 not ~$50K), names as written.
3. **ATTRIBUTION**: When someone said something specific, attribute it: "Sarah: [point]" or "— Sarah"
4. **FLAG RISKS**: Use ⚠️ for concerns, blockers, or items needing attention.
5. **SCANNABLE**: Bullets not paragraphs. 1-2 lines per item max.

## FORMATTING RULES

- Use → for action items
- Use ⚠️ for warnings/risks
- Use 📌 for pinned/important items
- Format deadlines: **[Date]** in bold
- Format owners: — [Name] at end of line
- Skip any section that would be empty`;

/**
 * Type-specific output templates
 */
const MEETING_TYPE_TEMPLATES = {
  '1on1': `
## OUTPUT STRUCTURE FOR 1:1 MEETINGS

Generate minutes using these sections:

### PULSE
- Energy/mood check: How is the person doing? (one line)
- Any personal context mentioned

### DISCUSSED
- Topics covered in order discussed
- Attribution for key points: "[Person] mentioned..."

### BLOCKERS
- Current obstacles or challenges
- Include severity if apparent

### GROWTH
- Career discussions, feedback given/received
- Development goals mentioned
- Coaching points

### ACTION ITEMS
- Format: → [Action] — [Owner] — **[Deadline if mentioned]**

### OPEN QUESTIONS
- Unresolved items to revisit
- Topics that need follow-up

### NOTED
- ⚠️ Concerns or flags raised
- Important observations`,

  'standup': `
## OUTPUT STRUCTURE FOR STANDUPS

Generate minutes using these sections:

### BY PERSON
For each attendee who spoke:
**[Name]**
- ✅ Done: [completed items]
- 🔄 Doing: [in progress]
- 🚫 Blocked: [blockers if any]

### BLOCKED
- List all blockers with owner
- Format: ⚠️ [Blocker] — [Person affected]

### NEEDS ATTENTION
- Items requiring team discussion
- Dependencies between people

### ACTION ITEMS
- Format: → [Action] — [Owner]`,

  'interview': `
## OUTPUT STRUCTURE FOR USER/CUSTOMER INTERVIEWS

Generate minutes using these sections:

### PARTICIPANT
- Name, role, company (if mentioned)
- Relevant context about their use case

### KEY INSIGHTS
- Major learnings from the interview
- Prioritize by impact/frequency mentioned

### VERBATIM QUOTES
- Exact quotes that capture important sentiments
- Format: "[Quote]" — [Name]

### PAIN POINTS
- Problems and frustrations expressed
- Include severity/frequency if mentioned

### FEATURE REQUESTS
- Specific asks or wishes
- Note if it's a blocker vs nice-to-have

### FOLLOW-UP NEEDED
- Questions to research
- Commitments made to the participant`,

  'sales': `
## OUTPUT STRUCTURE FOR SALES CALLS

Generate minutes using these sections:

### OPPORTUNITY SUMMARY
- Company, deal size if mentioned
- Current stage/status

### DECISION MAKERS
- Who was on the call and their role
- Who else needs to be involved

### PAIN POINTS
- Problems they're trying to solve
- Current solution and limitations

### OBJECTIONS
- Concerns or pushback raised
- How they were addressed (if at all)

### NEXT STEPS
- Format: → [Action] — [Owner] — **[Deadline]**
- Include both our actions and theirs

### DEAL SIGNALS
- 🟢 Positive signals (budget confirmed, timeline urgent, etc.)
- 🔴 Risk signals (competing solutions, long timeline, etc.)`,

  'retro': `
## OUTPUT STRUCTURE FOR RETROSPECTIVES

Generate minutes using these sections:

### WHAT WENT WELL
- Successes and wins
- Things to continue doing

### WHAT COULD IMPROVE
- Challenges faced
- Areas for improvement

### ACTION ITEMS
- Specific changes the team will make
- Format: → [Action] — [Owner]

### SHOUTOUTS
- Recognition and appreciation
- Format: 🎉 [Person] — [Reason]`,

  'brainstorm': `
## OUTPUT STRUCTURE FOR BRAINSTORMS

Generate minutes using these sections:

### IDEAS GENERATED
- All ideas captured (don't filter)
- Group by theme if natural groupings emerge

### TOP CANDIDATES
- Ideas that got energy/votes
- Note who championed each

### QUESTIONS TO EXPLORE
- Open questions raised
- Areas needing research

### NEXT STEPS
- How ideas will be evaluated
- Format: → [Action] — [Owner]`,

  'general': `
## OUTPUT STRUCTURE FOR GENERAL MEETINGS

Generate minutes using these sections:

### SUMMARY
- 1-2 sentence executive summary of the meeting

### DISCUSSED
- Topics covered in bullet form
- Attribution for key points: "[Name] raised..." or "— [Name]"

### DECISIONS
- Decisions made with rationale
- Format: ✓ [Decision] — [Rationale if given]

### ACTION ITEMS
- Format: → [Action] — [Owner] — **[Deadline if mentioned]**

### PARKING LOT
- Topics raised but deferred
- Items needing follow-up meetings

### RISKS & CONCERNS
- ⚠️ Flags or concerns raised
- Items that need attention`
};

/**
 * Build the complete system prompt for a meeting type
 */
export function buildSystemPrompt(meetingType) {
  const template = MEETING_TYPE_TEMPLATES[meetingType] || MEETING_TYPE_TEMPLATES['general'];
  return BASE_SYSTEM_PROMPT + '\n' + template;
}

/**
 * Static system prompt for meeting enhancement (cacheable) - LEGACY
 * Use buildSystemPrompt(meetingType) for type-specific prompts
 */
export const MEETING_ENHANCE_SYSTEM_PROMPT = buildSystemPrompt('general');

/**
 * Format Inscript Context for prompt inclusion
 * @param {Object} context - Context from inscript-context API
 * @returns {string} Formatted context section
 */
export function formatContextForPrompt(context) {
  if (!context) return '';

  const parts = [];

  // Attendee history
  if (context.attendeeContext?.length) {
    parts.push('### Attendee History');
    for (const a of context.attendeeContext) {
      if (a.meetingCount > 0) {
        let line = `- ${a.name}: ${a.meetingCount} previous meeting${a.meetingCount > 1 ? 's' : ''}`;
        if (a.lastMeeting) line += ` (last: ${a.lastMeeting})`;
        parts.push(line);
        if (a.recentTopics?.length) {
          parts.push(`  Recent topics: ${a.recentTopics.slice(0, 5).join(', ')}`);
        }
      }
    }
  }

  // Relevant patterns
  if (context.patterns?.length) {
    parts.push('### Relevant Patterns');
    for (const p of context.patterns) {
      parts.push(`- ${p.description} (${p.frequency})`);
    }
  }

  // Open loops
  if (context.openLoops?.length) {
    parts.push('### Open Loops (unresolved recurring topics)');
    for (const l of context.openLoops) {
      parts.push(`- ${l.description} — mentioned ${l.mentionCount}x since ${l.firstMentioned}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'No prior context available for these attendees.';
}

/**
 * Build the user message for meeting enhancement (dynamic content only)
 * @param {Object} params - Parameters to substitute
 * @param {string} params.rawInput - Raw meeting notes
 * @param {string} params.title - Meeting title
 * @param {string[]} params.attendees - List of attendees
 * @param {string} params.date - Meeting date
 * @param {Object} params.context - Inscript Context (optional)
 * @param {string} params.meetingType - Detected meeting type
 * @returns {string} The user message with dynamic content
 */
export function buildMeetingUserMessage({ rawInput, title, attendees, date, context, meetingType }) {
  const attendeeList = attendees?.length ? attendees.join(', ') : 'Not specified';
  const meetingDate = date || new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const typeLabel = getMeetingTypeLabel(meetingType || 'general');

  // Build context section if provided
  const contextSection = context ? `
## USER'S INSCRIPT MEMORY

The user has a memory system called Inscript. Here's relevant context about the attendees and topics:

${formatContextForPrompt(context)}

Use this context to:
1. Add a subtle note if an open loop is relevant (e.g., "⚠️ Compensation — 3rd mention, still unresolved")
2. Reference meeting history naturally if it adds value (e.g., "Continues Q2 roadmap discussion from Jan 20")

Do NOT:
- Invent context not provided
- Add context that isn't relevant to the notes
- Make assumptions about relationships not stated
` : '';

  return `## MEETING TO TRANSFORM

### Meeting Type: ${typeLabel}

### Raw Notes
${rawInput}

### Meeting Context
- Title: ${title || 'Untitled Meeting'}
- Attendees: ${attendeeList}
- Date: ${meetingDate}
${contextSection}
Transform these notes into ${typeLabel.toLowerCase()} minutes now. Use the exact section structure specified for this meeting type.`;
}

/**
 * Build the meeting enhancement prompt with variables substituted (legacy, non-cached)
 * @deprecated Use buildSystemPrompt(meetingType) + buildMeetingUserMessage for caching
 */
export function buildMeetingEnhancePrompt({ rawInput, title, attendees, date, context }) {
  const meetingType = detectMeetingType(rawInput, title);
  return buildSystemPrompt(meetingType) + '\n\n' + buildMeetingUserMessage({
    rawInput, title, attendees, date, context, meetingType
  });
}
