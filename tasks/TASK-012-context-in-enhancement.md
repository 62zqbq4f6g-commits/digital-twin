# TASK-012: Context in Enhancement

## Overview
Integrate Inscript Context into the enhancement API and prompt.

## Priority
P0 — Week 3, Day 2-3

## Dependencies
- TASK-002 (Enhancement API)
- TASK-003 (Enhancement prompt)
- TASK-011 (Context fetch API)

## Outputs
- Modifications to `/api/enhance-meeting.js`
- Updated enhancement prompt

## Acceptance Criteria

### API Changes
- [ ] Fetch context in parallel with prompt building
- [ ] Include context in enhancement prompt
- [ ] Stream context items after content
- [ ] Context fetch doesn't slow down response

### Context in Prompt
- [ ] Attendee history included
- [ ] Relevant patterns included
- [ ] Open loops included (for NOTED section)

### Response Format
```
data: {"type":"metadata",...}
data: {"type":"content","text":"..."}  (multiple)
data: {"type":"context","item":{...}}  (multiple)
data: {"type":"done",...}
```

## Implementation

```javascript
// In api/enhance-meeting.js

// Add context fetch in parallel
const [context, promptReady] = await Promise.all([
  fetchInscriptContext(attendees, rawInput, userId),
  Promise.resolve(true), // placeholder for any other parallel work
]);

// Update prompt building to include context
function buildEnhancementPrompt(rawInput, title, attendees, context) {
  return `You are an AI assistant that transforms raw meeting notes into clean, professional meeting minutes. You also have access to the user's Inscript memory system.

## RAW NOTES
${rawInput}

## MEETING CONTEXT
- Title: ${title || 'Untitled Meeting'}
- Attendees: ${attendees?.join(', ') || 'Not specified'}
- Date: ${new Date().toLocaleDateString()}

## USER'S INSCRIPT CONTEXT
${formatContextForPrompt(context)}

## OUTPUT FORMAT
[... existing format instructions ...]

## INSCRIPT CONTEXT SECTION
After the main sections, generate an "INSCRIPT CONTEXT" section with relevant insights:
- Meeting history with attendees (if known)
- Patterns that are relevant to this meeting
- Open loops that should be noted
- Use ℹ️ for info, ⚠️ for warnings, 🔗 for connections

Only include genuinely relevant context. If nothing is relevant, omit this section.
`;
}

function formatContextForPrompt(context) {
  const parts = [];

  if (context.attendeeContext?.length) {
    parts.push('### Attendee History');
    for (const a of context.attendeeContext) {
      parts.push(`- ${a.name}: ${a.meetingCount} previous meetings (first: ${a.firstMeeting})`);
      if (a.recentTopics?.length) {
        parts.push(`  Recent topics: ${a.recentTopics.join(', ')}`);
      }
    }
  }

  if (context.patterns?.length) {
    parts.push('### Relevant Patterns');
    for (const p of context.patterns) {
      parts.push(`- ${p.description} (${p.frequency})`);
    }
  }

  if (context.openLoops?.length) {
    parts.push('### Open Loops');
    for (const l of context.openLoops) {
      parts.push(`- ${l.description} (mentioned ${l.mentionCount}x since ${l.firstMentioned})`);
    }
  }

  return parts.join('\n') || 'No prior context available.';
}

// After streaming content, stream context items
async function streamContextItems(writer, encoder, context) {
  // Generate context items from LLM response or directly from context
  const items = generateContextItems(context);
  
  for (const item of items) {
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({ type: 'context', item })}\n\n`)
    );
  }
}

function generateContextItems(context) {
  const items = [];

  // Add attendee info items
  for (const a of context.attendeeContext || []) {
    if (a.meetingCount > 0) {
      items.push({
        type: 'info',
        icon: 'ℹ️',
        text: `${a.meetingCount}${getOrdinalSuffix(a.meetingCount)} meeting with ${a.name} (first: ${a.firstMeeting})`,
      });
    }
  }

  // Add pattern warnings
  for (const p of context.patterns || []) {
    items.push({
      type: 'warning',
      icon: '⚠️',
      text: p.description,
      subtext: `Frequency: ${p.frequency}`,
    });
  }

  // Add open loops
  for (const l of context.openLoops || []) {
    items.push({
      type: 'warning',
      icon: '⚠️',
      text: l.description,
      subtext: `Mentioned ${l.mentionCount} times since ${l.firstMentioned}`,
    });
  }

  return items.slice(0, 5); // Max 5 items
}
```

## Test Checklist

- [ ] Context fetched in parallel (not adding latency)
- [ ] Attendee history appears in context section
- [ ] Patterns appear in context section
- [ ] Open loops appear in context section
- [ ] Context items stream correctly
- [ ] Empty context handled gracefully
- [ ] Total response time still < 3 seconds
