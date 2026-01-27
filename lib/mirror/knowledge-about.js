/**
 * MIRROR Knowledge About — Enhanced "What do you know about X"
 *
 * Provides structured, comprehensive responses when user asks
 * what MIRROR knows about a person, topic, or entity.
 */

/**
 * Detect if message is asking "what do you know about X"
 * @param {string} message - User message
 * @returns {{ isKnowledgeQuery: boolean, subject?: string }}
 */
export function detectKnowledgeQuery(message) {
  const patterns = [
    /what do you (?:know|remember) about\s+(.+?)(?:\?|$)/i,
    /what have you learned about\s+(.+?)(?:\?|$)/i,
    /tell me about\s+(.+?)(?:\?|$)/i,
    /who is\s+(.+?)(?:\?|$)/i,
    /what is\s+(.+?)(?:\?|$)/i,
    /remind me (?:about|who)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const subject = match[1].trim().replace(/[?.]$/, '');
      return { isKnowledgeQuery: true, subject };
    }
  }

  return { isKnowledgeQuery: false };
}

/**
 * Get comprehensive knowledge about a subject
 * @param {string} userId - User ID
 * @param {string} subject - Subject to look up
 * @param {Object} supabase - Supabase client
 * @returns {Object} Knowledge results
 */
export async function getKnowledgeAbout(userId, subject, supabase) {
  const results = {
    type: 'unknown', // 'person' | 'entity' | 'topic'
    subject,
    entity: null,
    facts: [],
    mentions: [],
    mentionCount: 0,
    firstMention: null,
    lastMention: null,
    relatedEntities: [],
    keyAttributes: []
  };

  try {
    // 1. Try to find an entity matching the subject
    const { data: entities, error: entityError } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${subject}%`)
      .order('mention_count', { ascending: false })
      .limit(1);

    if (!entityError && entities?.length > 0) {
      const entity = entities[0];
      results.entity = entity;
      results.type = entity.entity_type || 'entity';

      // 2. Get all facts about this entity
      const { data: facts, error: factsError } = await supabase
        .from('entity_facts')
        .select('predicate, object_text, confidence, created_at')
        .eq('user_id', userId)
        .eq('entity_id', entity.id)
        .order('confidence', { ascending: false });

      if (!factsError && facts) {
        results.facts = facts;

        // Extract key attributes from facts
        const attributeMap = {
          'works_at': 'Works at',
          'role': 'Role',
          'relationship': 'Relationship',
          'likes': 'Interests',
          'lives_in': 'Location',
          'works_on': 'Working on',
          'mentioned_with': 'Often mentioned with'
        };

        results.keyAttributes = facts
          .filter(f => attributeMap[f.predicate])
          .slice(0, 5)
          .map(f => ({
            label: attributeMap[f.predicate] || f.predicate.replace(/_/g, ' '),
            value: f.object_text,
            confidence: f.confidence
          }));
      }

      // 3. Get notes mentioning this entity (by title search since content is encrypted)
      const { data: mentions, error: mentionsError } = await supabase
        .from('notes')
        .select('id, title, created_at, category')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .ilike('title', `%${entity.name}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!mentionsError && mentions) {
        results.mentions = mentions;
        results.mentionCount = entity.mention_count || mentions.length;
        if (mentions.length > 0) {
          results.lastMention = mentions[0].created_at;
          results.firstMention = mentions[mentions.length - 1].created_at;
        }
      }

      // 4. Find related entities (share common facts or mentioned together)
      const relatedNames = [];

      // From facts: extract entity names mentioned as object
      facts?.forEach(f => {
        if (f.predicate === 'works_with' || f.predicate === 'knows' || f.predicate === 'mentioned_with') {
          relatedNames.push(f.object_text);
        }
      });

      // From entity context_notes: extract potential names
      if (entity.context_notes?.length > 0) {
        const namePattern = /\b([A-Z][a-z]+)\b/g;
        entity.context_notes.forEach(note => {
          const matches = note.match(namePattern);
          if (matches) {
            relatedNames.push(...matches.filter(m => m !== entity.name));
          }
        });
      }

      // Dedupe and limit related entities
      results.relatedEntities = [...new Set(relatedNames)].slice(0, 5);

    } else {
      // No entity found — treat as topic search
      results.type = 'topic';

      // Search for topic in entity summaries
      const { data: topicEntities } = await supabase
        .from('user_entities')
        .select('name, entity_type, summary, mention_count')
        .eq('user_id', userId)
        .ilike('summary', `%${subject}%`)
        .limit(5);

      if (topicEntities?.length > 0) {
        results.relatedEntities = topicEntities.map(e => e.name);
      }

      // Search for topic in patterns
      const { data: patterns } = await supabase
        .from('user_patterns')
        .select('description, short_description')
        .eq('user_id', userId)
        .or(`description.ilike.%${subject}%,short_description.ilike.%${subject}%`)
        .limit(3);

      if (patterns?.length > 0) {
        results.facts = patterns.map(p => ({
          predicate: 'pattern',
          object_text: p.short_description || p.description,
          confidence: 0.8
        }));
      }
    }

  } catch (error) {
    console.error('[knowledge-about] Error getting knowledge:', error);
  }

  return results;
}

/**
 * Build knowledge prompt for Claude
 * @param {Object} knowledge - Knowledge results from getKnowledgeAbout
 * @returns {string} Knowledge context for system prompt
 */
export function buildKnowledgePrompt(knowledge) {
  const { type, subject, entity, facts, mentionCount, firstMention, lastMention, relatedEntities, keyAttributes } = knowledge;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (type === 'topic') {
    // Topic-based response
    return `
KNOWLEDGE QUERY: "${subject}" (topic/concept)

This appears to be a topic rather than a specific person or entity.
${relatedEntities.length > 0 ? `Related to: ${relatedEntities.join(', ')}` : 'No direct matches found.'}
${facts.length > 0 ? `Relevant patterns: ${facts.map(f => f.object_text).join('; ')}` : ''}

YOUR RESPONSE:
1. Acknowledge what you know (or don't know) about this topic
2. Connect it to people/things from their context if relevant
3. Ask if they want to explore a specific aspect
`;
  }

  // Entity-based response (person, place, project, etc.)
  let prompt = `
KNOWLEDGE QUERY: "${subject}" (${type})

WHO THEY ARE:
${entity?.name || subject}${entity?.entity_type === 'person' ? ' is a person' : ` is a ${entity?.entity_type || 'known entity'}`} in the user's world.
${mentionCount > 0 ? `Mentioned ${mentionCount} time${mentionCount !== 1 ? 's' : ''}.` : ''}
${firstMention ? `First mentioned: ${formatDate(firstMention)}` : ''}
${lastMention && firstMention !== lastMention ? ` → Most recent: ${formatDate(lastMention)}` : ''}
`;

  if (keyAttributes.length > 0) {
    prompt += `
KEY FACTS:
${keyAttributes.map(a => `- ${a.label}: ${a.value}${a.confidence >= 0.9 ? ' (high confidence)' : ''}`).join('\n')}
`;
  }

  if (entity?.context_notes?.length > 0) {
    prompt += `
FROM USER'S NOTES:
${entity.context_notes.slice(0, 3).map(c => `- "${c}"`).join('\n')}
`;
  }

  if (relatedEntities.length > 0) {
    prompt += `
CONNECTIONS:
Related to: ${relatedEntities.join(', ')}
`;
  }

  prompt += `
YOUR RESPONSE FORMAT:
Structure your response as:

**Who they are**
[1-2 sentences about who this person/entity is based on what you know]

**Key facts**
[Bullet points of the most important facts, naturally phrased]

**Your history**
[When they were first mentioned, what context, any evolution]

${relatedEntities.length > 0 ? `**Connections**
[How they relate to other people/things in the user's world]
` : ''}
End with: "Is there something specific about ${entity?.name || subject} you'd like to explore?"
`;

  return prompt;
}

/**
 * Format knowledge for Context Used UI
 * @param {Object} knowledge - Knowledge results
 * @returns {Array} Context items for UI
 */
export function formatKnowledgeForContextUI(knowledge) {
  const contextItems = [];

  if (knowledge.entity) {
    contextItems.push({
      type: 'entity',
      name: knowledge.entity.name,
      value: knowledge.entity.entity_type || 'entity'
    });
  }

  if (knowledge.mentionCount > 0) {
    contextItems.push({
      type: 'mentions',
      label: 'Mentions',
      value: `${knowledge.mentionCount} time${knowledge.mentionCount !== 1 ? 's' : ''}`
    });
  }

  if (knowledge.keyAttributes.length > 0) {
    knowledge.keyAttributes.slice(0, 2).forEach(attr => {
      contextItems.push({
        type: 'fact',
        value: `${attr.label}: ${attr.value}`
      });
    });
  }

  if (knowledge.relatedEntities.length > 0) {
    contextItems.push({
      type: 'related',
      label: 'Related',
      value: knowledge.relatedEntities.slice(0, 3).join(', ')
    });
  }

  return contextItems;
}
