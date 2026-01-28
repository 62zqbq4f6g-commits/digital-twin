/**
 * DOCUMENT BUILDER
 *
 * Phase 2 - Post-RAG Architecture
 *
 * Converts loaded user memory into a structured markdown document
 * optimized for LLM consumption. Uses graph traversal to prioritize
 * which entities get "real estate" in the context window.
 *
 * OWNER: T2 (Data Layer)
 * CONSUMERS: /api/context/full.js, MIRROR
 */

/**
 * Build a markdown document from loaded context
 * @param {object} context - Full context from loadFullContext()
 * @param {object} options - Formatting options
 * @returns {string} Markdown document
 */
export function buildContextDocument(context, options = {}) {
  const {
    maxEntities = 50,          // Max entities to include in detail
    maxPatterns = 10,          // Max patterns to include
    maxNotes = 20,             // Max recent notes to reference
    maxBehaviors = 15,         // Max behaviors to list
    includeTimestamps = false, // Include timestamps in output
    focusEntity = null,        // Entity name to prioritize (for targeted queries)
  } = options;

  const sections = [];

  // Header
  sections.push(buildHeader(context));

  // Identity
  sections.push(buildIdentitySection(context.identity));

  // Key People (always include)
  if (context.identity.keyPeople?.length > 0) {
    sections.push(buildKeyPeopleSection(context.identity.keyPeople));
  }

  // Knowledge Graph (entities with facts)
  sections.push(buildKnowledgeGraphSection(
    context.knowledgeGraph,
    context.procedural.behaviors,
    context.procedural.entityQualities,
    { maxEntities, focusEntity }
  ));

  // Behavioral Profile
  if (context.procedural.behaviors.length > 0 || context.procedural.entityQualities.length > 0) {
    sections.push(buildBehavioralSection(
      context.procedural.behaviors,
      context.procedural.entityQualities,
      maxBehaviors
    ));
  }

  // Patterns
  if (context.procedural.patterns.length > 0) {
    sections.push(buildPatternsSection(context.procedural.patterns, maxPatterns));
  }

  // Category Summaries
  if (context.procedural.categorySummaries.length > 0) {
    sections.push(buildCategorySummariesSection(context.procedural.categorySummaries));
  }

  // Recent Episodes (notes, meetings)
  sections.push(buildEpisodesSection(
    context.episodes,
    { maxNotes, includeTimestamps }
  ));

  // Footer with meta
  sections.push(buildFooter(context));

  return sections.filter(Boolean).join('\n\n');
}

/**
 * Build header
 */
function buildHeader(context) {
  const name = context.identity.name || 'User';
  return `# Memory Document: ${name}

*This document contains everything known about ${name}. Use it to provide personalized, contextually aware responses.*`;
}

/**
 * Build identity section
 */
function buildIdentitySection(identity) {
  const lines = ['## Identity'];

  if (identity.name) {
    lines.push(`**Name:** ${identity.name}`);
  }
  if (identity.role) {
    lines.push(`**Role:** ${identity.role}`);
  }
  if (identity.selfDescription) {
    lines.push(`**Self-description:** ${identity.selfDescription}`);
  }
  if (identity.goals?.length > 0) {
    lines.push(`**Goals:** ${identity.goals.join(', ')}`);
  }
  if (identity.lifeContext?.length > 0) {
    lines.push(`**Current life context:** ${identity.lifeContext.join(', ')}`);
  }
  if (identity.boundaries?.length > 0) {
    lines.push(`**Boundaries (topics to avoid):** ${identity.boundaries.join(', ')}`);
  }
  if (identity.communication?.customInstructions) {
    lines.push(`**Communication preferences:** ${identity.communication.customInstructions}`);
  }

  return lines.join('\n');
}

/**
 * Build key people section
 */
function buildKeyPeopleSection(keyPeople) {
  const lines = ['## Key People'];
  lines.push('*These are the most important people in their life:*');
  lines.push('');

  for (const person of keyPeople) {
    lines.push(`- **${person.name}** — ${person.relationship}`);
  }

  return lines.join('\n');
}

/**
 * Build knowledge graph section with entities and facts
 */
function buildKnowledgeGraphSection(knowledgeGraph, behaviors, qualities, options) {
  const { maxEntities, focusEntity } = options;
  const lines = ['## People & Things'];

  // Sort entities: focused entity first, then by importance
  let entities = [...knowledgeGraph.entities];

  if (focusEntity) {
    entities.sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(focusEntity.toLowerCase());
      const bMatch = b.name.toLowerCase().includes(focusEntity.toLowerCase());
      if (aMatch && !bMatch) return -1;
      if (bMatch && !aMatch) return 1;
      return (b.importance || 0) - (a.importance || 0);
    });
  }

  entities = entities.slice(0, maxEntities);

  // Build behavior and quality lookups
  const behaviorsByEntity = new Map();
  for (const b of behaviors) {
    const key = b.entityName?.toLowerCase();
    if (key) {
      if (!behaviorsByEntity.has(key)) behaviorsByEntity.set(key, []);
      behaviorsByEntity.get(key).push(b);
    }
  }

  const qualitiesByEntity = new Map();
  for (const q of qualities) {
    const key = q.entityName?.toLowerCase();
    if (key) {
      if (!qualitiesByEntity.has(key)) qualitiesByEntity.set(key, []);
      qualitiesByEntity.get(key).push(q);
    }
  }

  // Group by type
  const byType = {};
  for (const entity of entities) {
    const type = entity.type || 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push(entity);
  }

  // Output people first, then others
  const typeOrder = ['person', 'organization', 'project', 'place', 'concept', 'event', 'other'];

  for (const type of typeOrder) {
    const typeEntities = byType[type];
    if (!typeEntities?.length) continue;

    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's';
    lines.push(`\n### ${typeLabel}`);

    for (const entity of typeEntities) {
      const nameLower = entity.name.toLowerCase();

      // Entity header
      let header = `**${entity.name}**`;
      if (entity.relationship) {
        header += ` (${entity.relationship})`;
      }
      if (entity.sentiment && Math.abs(entity.sentiment) > 0.3) {
        header += entity.sentiment > 0 ? ' ❤️' : ' ⚠️';
      }
      lines.push(header);

      // Summary
      if (entity.summary) {
        lines.push(`  ${entity.summary}`);
      }

      // Facts
      if (entity.facts?.length > 0) {
        for (const fact of entity.facts.slice(0, 5)) {
          const predicate = fact.predicate.replace(/_/g, ' ');
          lines.push(`  - ${predicate}: ${fact.object}`);
        }
      }

      // User's relationship to this entity (behaviors)
      const entityBehaviors = behaviorsByEntity.get(nameLower) || [];
      if (entityBehaviors.length > 0) {
        for (const b of entityBehaviors.slice(0, 3)) {
          const predicate = b.predicate.replace(/_/g, ' ');
          const topicPart = b.topic ? ` (re: ${b.topic})` : '';
          lines.push(`  - User ${predicate} them${topicPart}`);
        }
      }

      // How entity relates to user (qualities)
      const entityQualities = qualitiesByEntity.get(nameLower) || [];
      if (entityQualities.length > 0) {
        for (const q of entityQualities.slice(0, 3)) {
          const predicate = q.predicate.replace(/_/g, ' ');
          lines.push(`  - They ${predicate}: ${q.object}`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Build behavioral profile section
 */
function buildBehavioralSection(behaviors, qualities, maxBehaviors) {
  const lines = ['## Behavioral Profile'];
  lines.push('*How this person relates to people and things in their life:*');
  lines.push('');

  // Group behaviors by type
  const trustBehaviors = behaviors.filter(b =>
    ['trusts_opinion_of', 'seeks_advice_from', 'relies_on', 'learns_from'].includes(b.predicate)
  );
  const emotionalBehaviors = behaviors.filter(b =>
    ['feels_about', 'inspired_by', 'conflicted_about', 'avoids'].includes(b.predicate)
  );
  const collaborativeBehaviors = behaviors.filter(b =>
    ['collaborates_with', 'competes_with'].includes(b.predicate)
  );

  if (trustBehaviors.length > 0) {
    lines.push('**Trust & Reliance:**');
    for (const b of trustBehaviors.slice(0, 5)) {
      const predicate = b.predicate.replace(/_/g, ' ');
      const topicPart = b.topic ? ` (${b.topic})` : '';
      lines.push(`- ${predicate}: ${b.entityName}${topicPart}`);
    }
    lines.push('');
  }

  if (emotionalBehaviors.length > 0) {
    lines.push('**Emotional Connections:**');
    for (const b of emotionalBehaviors.slice(0, 5)) {
      const predicate = b.predicate.replace(/_/g, ' ');
      const sentiment = b.sentiment > 0 ? '(+)' : b.sentiment < 0 ? '(-)' : '';
      lines.push(`- ${predicate}: ${b.entityName} ${sentiment}`);
    }
    lines.push('');
  }

  if (collaborativeBehaviors.length > 0) {
    lines.push('**Work Relationships:**');
    for (const b of collaborativeBehaviors.slice(0, 5)) {
      const predicate = b.predicate.replace(/_/g, ' ');
      lines.push(`- ${predicate}: ${b.entityName}`);
    }
    lines.push('');
  }

  // How others relate to user
  if (qualities.length > 0) {
    lines.push('**How Others Support Them:**');
    for (const q of qualities.slice(0, 5)) {
      const predicate = q.predicate.replace(/_/g, ' ');
      lines.push(`- ${q.entityName} ${predicate}: ${q.object}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build patterns section
 */
function buildPatternsSection(patterns, maxPatterns) {
  const lines = ['## Observed Patterns'];
  lines.push('*Recurring behaviors and tendencies:*');
  lines.push('');

  for (const pattern of patterns.slice(0, maxPatterns)) {
    const confidence = Math.round(pattern.confidence * 100);
    lines.push(`- ${pattern.description} (${confidence}% confidence)`);
  }

  return lines.join('\n');
}

/**
 * Build category summaries section
 */
function buildCategorySummariesSection(summaries) {
  const lines = ['## Life Areas'];

  // Filter out behavioral_profile (shown separately)
  const filtered = summaries.filter(s => s.category !== 'behavioral_profile');

  for (const summary of filtered) {
    const category = summary.category.replace(/_/g, ' ');
    const label = category.charAt(0).toUpperCase() + category.slice(1);
    lines.push(`\n**${label}:**`);
    lines.push(summary.summary);
  }

  return lines.join('\n');
}

/**
 * Build episodes section (recent notes, meetings)
 */
function buildEpisodesSection(episodes, options) {
  const { maxNotes, includeTimestamps } = options;
  const lines = ['## Recent Activity'];

  // Recent notes
  if (episodes.notes?.length > 0) {
    lines.push('\n### Recent Notes');
    for (const note of episodes.notes.slice(0, maxNotes)) {
      const date = new Date(note.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      const title = note.title || note.distilledSummary || 'Untitled';
      const category = note.category ? ` [${note.category}]` : '';

      if (note.isDistilled && note.distilledSummary) {
        lines.push(`- [${date}] ${title}${category}`);
        lines.push(`  *Insight: ${note.distilledSummary}*`);
      } else {
        lines.push(`- [${date}] ${title}${category}`);
      }
    }
  }

  // Recent meetings
  if (episodes.meetings?.length > 0) {
    lines.push('\n### Recent Meetings');
    for (const meeting of episodes.meetings.slice(0, 10)) {
      const date = new Date(meeting.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      const topics = meeting.topics?.join(', ') || 'No topics recorded';
      lines.push(`- [${date}] ${topics}`);
      if (meeting.actionItems?.length > 0) {
        lines.push(`  Action items: ${meeting.actionItems.join(', ')}`);
      }
    }
  }

  // Conversation summary
  if (episodes.conversations?.length > 0) {
    const totalConvos = episodes.conversations.length;
    const recentWithInsights = episodes.conversations
      .filter(c => c.keyInsights?.length > 0)
      .slice(0, 3);

    lines.push(`\n### MIRROR Conversations`);
    lines.push(`*${totalConvos} conversations on record*`);

    if (recentWithInsights.length > 0) {
      lines.push('Recent insights:');
      for (const convo of recentWithInsights) {
        for (const insight of convo.keyInsights.slice(0, 2)) {
          lines.push(`- ${insight}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Build footer with meta information
 */
function buildFooter(context) {
  const { meta, knowledgeGraph, episodes, procedural } = context;

  const lines = [
    '---',
    '*Memory Summary:*',
    `- ${knowledgeGraph.entityCount} entities, ${knowledgeGraph.factCount} facts`,
    `- ${procedural.behaviorCount} behaviors, ${procedural.patternCount} patterns`,
    `- ${episodes.noteCount} notes, ${episodes.meetingCount} meetings`,
    `- Loaded in ${meta.totalLoadTime}ms`
  ];

  return lines.join('\n');
}

/**
 * Build a compact version for smaller context windows
 */
export function buildCompactDocument(context, options = {}) {
  const {
    maxEntities = 20,
    maxPatterns = 5,
    maxBehaviors = 10,
  } = options;

  const sections = [];

  // Compact identity
  const identity = context.identity;
  sections.push(`# ${identity.name || 'User'}'s Memory`);

  if (identity.goals?.length > 0) {
    sections.push(`Goals: ${identity.goals.join(', ')}`);
  }

  // Key people inline
  if (identity.keyPeople?.length > 0) {
    const people = identity.keyPeople.map(p => `${p.name} (${p.relationship})`).join(', ');
    sections.push(`Key people: ${people}`);
  }

  // Top entities with facts
  sections.push('\n## Key Entities');
  const topEntities = context.knowledgeGraph.entities.slice(0, maxEntities);
  for (const entity of topEntities) {
    let line = `**${entity.name}**`;
    if (entity.relationship) line += ` (${entity.relationship})`;
    if (entity.facts?.length > 0) {
      const factSummary = entity.facts.slice(0, 2).map(f =>
        `${f.predicate.replace(/_/g, ' ')}: ${f.object}`
      ).join('; ');
      line += ` — ${factSummary}`;
    }
    sections.push(line);
  }

  // Top behaviors
  if (context.procedural.behaviors.length > 0) {
    sections.push('\n## Behaviors');
    for (const b of context.procedural.behaviors.slice(0, maxBehaviors)) {
      sections.push(`- ${b.predicate.replace(/_/g, ' ')} ${b.entityName}`);
    }
  }

  // Top patterns
  if (context.procedural.patterns.length > 0) {
    sections.push('\n## Patterns');
    for (const p of context.procedural.patterns.slice(0, maxPatterns)) {
      sections.push(`- ${p.description}`);
    }
  }

  return sections.join('\n');
}

export default { buildContextDocument, buildCompactDocument };
