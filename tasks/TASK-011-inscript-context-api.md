# TASK-011: Inscript Context Fetch

## Overview
Create API endpoint that fetches user context for enhancement (attendee history, patterns, open loops, related notes).

## Priority
P0 — Week 3, Day 1-2

## Dependencies
- TASK-010 (Database schema)
- Existing entity system

## Outputs
- `/api/inscript-context.js` — New file

## Acceptance Criteria

### Endpoint
- [ ] GET /api/inscript-context
- [ ] Query params: attendees, content, userId
- [ ] Returns context within 500ms
- [ ] Edge Runtime

### Response Format
```json
{
  "attendeeContext": [
    {
      "entityId": "uuid",
      "name": "Sarah",
      "meetingCount": 12,
      "firstMeeting": "July 2025",
      "lastMeeting": "3 days ago",
      "recentTopics": ["roadmap", "budget"]
    }
  ],
  "patterns": [
    {
      "type": "recurring_topic",
      "description": "Mobile blocked — mentioned 4 of last 5 notes",
      "frequency": "4 of last 5",
      "severity": "warning"
    }
  ],
  "openLoops": [
    {
      "description": "Compensation discussion",
      "firstMentioned": "December 15, 2025",
      "mentionCount": 3,
      "status": "unresolved"
    }
  ],
  "relatedNotes": [
    {
      "noteId": "uuid",
      "title": "Project frustration",
      "date": "January 20",
      "relevance": "Also discusses feeling stuck",
      "snippet": "brief excerpt..."
    }
  ],
  "processingTime": 234
}
```

## Implementation

```javascript
// api/inscript-context.js

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
    });
  }

  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const attendees = searchParams.get('attendees')?.split(',') || [];
  const content = searchParams.get('content') || '';
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    // Parallel fetch all context
    const [attendeeContext, patterns, openLoops, relatedNotes] = await Promise.all([
      fetchAttendeeContext(userId, attendees),
      fetchRelevantPatterns(userId, content),
      fetchOpenLoops(userId, content),
      fetchRelatedNotes(userId, content),
    ]);

    return new Response(
      JSON.stringify({
        attendeeContext,
        patterns,
        openLoops,
        relatedNotes,
        processingTime: Date.now() - startTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Context fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch context' }),
      { status: 500 }
    );
  }
}

async function fetchAttendeeContext(userId, attendeeNames) {
  if (!attendeeNames.length) return [];

  // Find matching entities
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, metadata')
    .eq('user_id', userId)
    .in('name', attendeeNames);

  if (!entities?.length) return [];

  // Get meeting history for each
  const context = await Promise.all(
    entities.map(async (entity) => {
      const { data } = await supabase.rpc('get_meeting_count', {
        p_user_id: userId,
        p_entity_id: entity.id,
      });

      return {
        entityId: entity.id,
        name: entity.name,
        meetingCount: data?.[0]?.meeting_count || 0,
        firstMeeting: formatDate(data?.[0]?.first_meeting),
        lastMeeting: formatRelativeDate(data?.[0]?.last_meeting),
        recentTopics: data?.[0]?.recent_topics || [],
      };
    })
  );

  return context;
}

async function fetchRelevantPatterns(userId, content) {
  // Query user_patterns table for relevant patterns
  const { data: patterns } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('confidence', { ascending: false })
    .limit(5);

  // Filter to those relevant to content
  return (patterns || [])
    .filter((p) => isRelevantPattern(p, content))
    .map((p) => ({
      type: p.pattern_type,
      description: p.description,
      frequency: p.frequency,
      severity: p.confidence > 0.8 ? 'warning' : 'info',
    }));
}

async function fetchOpenLoops(userId, content) {
  const { data: loops } = await supabase
    .from('open_loops')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('mention_count', { ascending: false })
    .limit(5);

  // Filter to those relevant to content
  return (loops || [])
    .filter((l) => isRelevantLoop(l, content))
    .map((l) => ({
      description: l.description,
      firstMentioned: formatDate(l.first_noted_at),
      mentionCount: l.mention_count,
      status: l.status,
    }));
}

async function fetchRelatedNotes(userId, content) {
  // Use existing semantic search
  // Return top 3 related notes
  return [];
}

function formatDate(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatRelativeDate(date) {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(date);
}

function isRelevantPattern(pattern, content) {
  // Check if pattern keywords appear in content
  const keywords = pattern.keywords || [];
  return keywords.some((kw) => content.toLowerCase().includes(kw.toLowerCase()));
}

function isRelevantLoop(loop, content) {
  const keywords = loop.keywords || [];
  return keywords.some((kw) => content.toLowerCase().includes(kw.toLowerCase()));
}
```

## Test Checklist

- [ ] Returns attendee context for known entities
- [ ] Returns empty array for unknown attendees
- [ ] Patterns filtered to relevant ones
- [ ] Open loops filtered to relevant ones
- [ ] Completes in < 500ms
- [ ] Handles empty content gracefully
- [ ] Handles missing attendees gracefully
