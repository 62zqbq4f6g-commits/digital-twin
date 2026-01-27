/**
 * MIRROR Research Mode — Deep exploration of topics
 *
 * Triggered by:
 * - "Research [topic]"
 * - "What do I know about [topic]"
 * - "Deep dive into [topic]"
 * - "Explore my thinking on [topic]"
 */

/**
 * Detect if message triggers research mode
 * @param {string} message - User message
 * @returns {{ isResearch: boolean, topic?: string }}
 */
export function detectResearchMode(message) {
  const patterns = [
    /^research\s+(.+)/i,
    /^deep dive (?:into|on)\s+(.+)/i,
    /^explore my thinking on\s+(.+)/i,
    /what do i know about\s+(.+)/i,
    /what have i said about\s+(.+)/i,
    /tell me everything (?:i know |you know )?about\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return { isResearch: true, topic: match[1].trim() };
    }
  }

  return { isResearch: false };
}

/**
 * Conduct deep research on a topic across user's history
 * @param {string} userId - User ID
 * @param {string} topic - Topic to research
 * @param {Object} supabase - Supabase client
 * @returns {Object} Research results
 */
export async function conductResearch(userId, topic, supabase) {
  const results = {
    topic,
    noteCount: 0,
    notes: [],
    entities: [],
    facts: [],
    patterns: [],
    firstMention: null,
    lastMention: null,
    relatedPeople: [],
    timeline: []
  };

  try {
    // 1. Search notes for topic (text search)
    // Note: Notes are E2E encrypted, so this searches titles/metadata only
    const { data: relevantNotes, error: notesError } = await supabase
      .from('notes')
      .select('id, title, created_at, category')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(`title.ilike.%${topic}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!notesError && relevantNotes) {
      results.notes = relevantNotes;
      results.noteCount = relevantNotes.length;
      if (relevantNotes.length > 0) {
        results.lastMention = relevantNotes[0].created_at;
        results.firstMention = relevantNotes[relevantNotes.length - 1].created_at;
      }
    }

    // 2. Find entities matching topic
    const { data: entities, error: entitiesError } = await supabase
      .from('user_entities')
      .select('id, name, entity_type, summary, mention_count, context_notes, updated_at')
      .eq('user_id', userId)
      .or(`name.ilike.%${topic}%,summary.ilike.%${topic}%`)
      .order('mention_count', { ascending: false })
      .limit(10);

    if (!entitiesError && entities) {
      results.entities = entities;

      // Extract people from entities
      results.relatedPeople = entities
        .filter(e => e.entity_type === 'person')
        .map(e => e.name);
    }

    // 3. Get facts related to topic
    const { data: facts, error: factsError } = await supabase
      .from('entity_facts')
      .select('entity_id, predicate, object_text, confidence, created_at')
      .eq('user_id', userId)
      .or(`object_text.ilike.%${topic}%,predicate.ilike.%${topic}%`)
      .order('confidence', { ascending: false })
      .limit(15);

    if (!factsError && facts) {
      results.facts = facts;
    }

    // 4. Check patterns mentioning topic
    const { data: patterns, error: patternsError } = await supabase
      .from('user_patterns')
      .select('id, pattern_type, description, short_description, confidence, created_at')
      .eq('user_id', userId)
      .or(`description.ilike.%${topic}%,short_description.ilike.%${topic}%`)
      .order('confidence', { ascending: false })
      .limit(5);

    if (!patternsError && patterns) {
      results.patterns = patterns;
    }

    // 5. Build timeline from all sources
    const timeline = [];

    // Add notes to timeline
    results.notes.forEach(n => {
      timeline.push({
        type: 'note',
        date: n.created_at,
        summary: n.title || 'Untitled note',
        category: n.category
      });
    });

    // Add entities first mention to timeline
    results.entities.forEach(e => {
      if (e.updated_at) {
        timeline.push({
          type: 'entity',
          date: e.updated_at,
          summary: `${e.name} mentioned (${e.mention_count || 1}x total)`,
          entityType: e.entity_type
        });
      }
    });

    // Sort timeline by date
    results.timeline = timeline
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

  } catch (error) {
    console.error('[research-mode] Error conducting research:', error);
  }

  return results;
}

/**
 * Build research prompt for Claude
 * @param {Object} research - Research results from conductResearch
 * @returns {string} Research context for system prompt
 */
export function buildResearchPrompt(research) {
  const { topic, noteCount, entities, facts, patterns, firstMention, lastMention, relatedPeople, timeline } = research;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  let prompt = `
RESEARCH MODE ACTIVATED

You are conducting deep research on: "${topic}"

FINDINGS FROM USER'S HISTORY:
- Notes mentioning topic: ${noteCount}
${firstMention ? `- First mentioned: ${formatDate(firstMention)}` : ''}
${lastMention ? `- Most recent: ${formatDate(lastMention)}` : ''}
${relatedPeople.length > 0 ? `- Related people: ${relatedPeople.join(', ')}` : ''}
- Related facts: ${facts.length}
- Patterns detected: ${patterns.length}
`;

  // Add entity summaries
  if (entities.length > 0) {
    prompt += `
RELATED ENTITIES:
${entities.slice(0, 5).map(e => {
  const context = e.context_notes?.length > 0 ? ` — "${e.context_notes[0]}"` : '';
  return `- ${e.name} (${e.entity_type}, mentioned ${e.mention_count || 1}x)${context}`;
}).join('\n')}
`;
  }

  // Add facts
  if (facts.length > 0) {
    prompt += `
RELEVANT FACTS:
${facts.slice(0, 5).map(f => `- ${f.predicate.replace(/_/g, ' ')}: ${f.object_text}`).join('\n')}
`;
  }

  // Add patterns
  if (patterns.length > 0) {
    prompt += `
PATTERNS NOTICED:
${patterns.slice(0, 3).map(p => `- ${p.short_description || p.description} (${Math.round(p.confidence * 100)}% confidence)`).join('\n')}
`;
  }

  // Add timeline
  if (timeline.length > 0) {
    prompt += `
TIMELINE:
${timeline.slice(0, 5).map(t => `- ${formatDate(t.date)}: ${t.summary}`).join('\n')}
`;
  }

  prompt += `
YOUR RESPONSE SHOULD:
1. Synthesize what the user has thought/written about this topic
2. Highlight evolution of their thinking over time (if visible)
3. Surface connections they might not have noticed
4. End with a question to deepen the exploration

DO NOT just list what you found. Synthesize into insight.
Be specific — reference dates, people, and facts.
`;

  return prompt;
}

/**
 * Format research results for Context Used UI
 * @param {Object} research - Research results
 * @returns {Array} Context items for UI
 */
export function formatResearchForContextUI(research) {
  const contextItems = [];

  // Add note count
  if (research.noteCount > 0) {
    contextItems.push({
      type: 'research',
      label: 'Notes found',
      value: `${research.noteCount} mentions`
    });
  }

  // Add timeline range
  if (research.firstMention && research.lastMention) {
    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    contextItems.push({
      type: 'timeline',
      label: 'Timeline',
      value: `${formatDate(research.firstMention)} — ${formatDate(research.lastMention)}`
    });
  }

  // Add related people
  if (research.relatedPeople.length > 0) {
    contextItems.push({
      type: 'people',
      label: 'Related people',
      value: research.relatedPeople.slice(0, 3).join(', ')
    });
  }

  // Add fact count
  if (research.facts.length > 0) {
    contextItems.push({
      type: 'facts',
      label: 'Facts',
      value: `${research.facts.length} found`
    });
  }

  // Add pattern count
  if (research.patterns.length > 0) {
    contextItems.push({
      type: 'patterns',
      label: 'Patterns',
      value: `${research.patterns.length} detected`
    });
  }

  return contextItems;
}
