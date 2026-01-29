/**
 * Context Loader
 *
 * Loads context based on task type and strategy.
 * Part of RAG 2.0 — task-aware context loading.
 *
 * OWNER: T2
 * CONSUMERS: api/mirror.js
 */

import { classifyTask, extractMentionedEntities, extractTopics, getTaskTypeLabel } from './task-classifier.js';
import { getContextStrategy } from './context-strategies.js';
import { getBehavioralContext } from './graph-traversal.js';

/**
 * Load context for a user message
 * @param {string} userId
 * @param {string} message
 * @param {object} supabase - Supabase client
 * @returns {Promise<object>} Loaded context
 */
export async function loadContextForTask(userId, message, supabase) {
  const taskType = classifyTask(message);
  const strategy = getContextStrategy(taskType);
  const mentionedEntities = extractMentionedEntities(message);
  const topics = extractTopics(message);

  const context = {
    taskType,
    taskLabel: getTaskTypeLabel(taskType),
    strategy: strategy.description,
    entities: [],
    facts: [],
    notes: [],
    patterns: [],
    behaviors: [],      // Phase 19: User behaviors
    entityQualities: [], // Phase 19: Entity qualities
    userTopics: [],     // User's interests/topics
    contextUsed: []
  };

  try {
    // Load entities based on strategy
    context.entities = await loadEntities(userId, strategy.entities, mentionedEntities, supabase);

    // Load facts based on strategy
    context.facts = await loadFacts(userId, strategy.facts, context.entities, supabase);

    // Load notes based on strategy
    context.notes = await loadNotes(userId, strategy.notes, topics, mentionedEntities, supabase);

    // Load patterns based on strategy
    context.patterns = await loadPatterns(userId, strategy.patterns, supabase);

    // Phase 19: Load behavioral context (ALWAYS load top behaviors for proactive context)
    const behavioralData = await loadBehaviors(userId, mentionedEntities, supabase);
    context.behaviors = behavioralData.behaviors;
    context.entityQualities = behavioralData.qualities;

    // Load user topics/interests for relevance
    context.userTopics = await loadUserTopics(userId, supabase);

    // Build context used list for UI
    context.contextUsed = buildContextUsedList(context);

  } catch (error) {
    // Log error ID only, not content
    console.error('[context-loader] Error loading context for user:', userId, 'taskType:', taskType);
  }

  return context;
}

/**
 * Load entities based on strategy type
 */
async function loadEntities(userId, strategyType, mentionedNames, supabase) {
  if (strategyType === 'none') return [];

  try {
    let query = supabase
      .from('user_entities')
      .select('id, name, entity_type, relationship, importance_score, summary, mention_count')
      .eq('user_id', userId);

    switch (strategyType) {
      case 'mentioned_only':
        if (mentionedNames.length === 0) return [];
        // Case-insensitive name matching
        query = query.or(mentionedNames.map(n => `name.ilike.%${n}%`).join(','));
        break;

      case 'mentioned_plus_related':
        // Get mentioned + their connections (handled after initial fetch)
        if (mentionedNames.length > 0) {
          query = query.or(mentionedNames.map(n => `name.ilike.%${n}%`).join(','));
        } else {
          // Fallback to top by importance
          query = query.order('importance_score', { ascending: false, nullsFirst: false }).limit(10);
        }
        break;

      case 'supportive_relationships':
        // People marked as close/supportive — look at relationship types
        query = query.eq('entity_type', 'person');
        query = query.limit(10);
        break;

      case 'relevant_people':
        query = query.eq('entity_type', 'person').limit(15);
        break;

      case 'all_related':
        query = query.limit(30);
        break;

      case 'top_by_importance':
      default:
        query = query.order('mention_count', { ascending: false, nullsFirst: false }).limit(10);
        break;
    }

    const { data, error } = await query;
    if (error) {
      console.error('[context-loader] Error loading entities:', error.code);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[context-loader] Exception loading entities:', error.message);
    return [];
  }
}

/**
 * Load facts based on strategy type
 * Only loads active facts (filters out facts from deleted notes)
 */
async function loadFacts(userId, strategyType, entities, supabase) {
  if (strategyType === 'none' || strategyType === 'minimal') return [];

  try {
    let query = supabase
      .from('entity_facts')
      .select('id, entity_id, predicate, object_text, confidence')
      .eq('user_id', userId)
      .eq('status', 'active'); // Only active facts (not from deleted notes)

    switch (strategyType) {
      case 'all_for_entity':
        if (entities.length === 0) return [];
        const entityIds = entities.map(e => e.id);
        query = query.in('entity_id', entityIds);
        break;

      case 'high_confidence':
        query = query.gte('confidence', 0.7).limit(30);
        break;

      case 'relevant':
        query = query.gte('confidence', 0.6).limit(20);
        break;

      case 'all':
      default:
        query = query.limit(50);
        break;
    }

    query = query.order('confidence', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('[context-loader] Error loading facts:', error.code);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[context-loader] Exception loading facts:', error.message);
    return [];
  }
}

/**
 * Load notes based on strategy type
 * Note: Notes content is E2E encrypted, so we search titles/metadata only
 */
async function loadNotes(userId, strategyType, topics, mentionedNames, supabase) {
  if (strategyType === 'none') return [];

  try {
    let query = supabase
      .from('notes')
      .select('id, title, created_at, category')
      .eq('user_id', userId)
      .is('deleted_at', null);

    switch (strategyType) {
      case 'mentions_only':
        if (mentionedNames.length === 0) return [];
        // Search for notes with these names in title
        query = query.or(mentionedNames.map(n => `title.ilike.%${n}%`).join(','));
        query = query.limit(10);
        break;

      case 'related_topics':
        if (topics.length === 0) {
          // Fallback to recent
          query = query.order('created_at', { ascending: false }).limit(10);
        } else {
          // Search for notes with these topics in title
          const topicFilters = topics.slice(0, 5).map(t => `title.ilike.%${t}%`).join(',');
          query = query.or(topicFilters);
          query = query.limit(15);
        }
        break;

      case 'past_similar':
        // Recent notes (emotional context often relates to recent events)
        query = query.order('created_at', { ascending: false }).limit(10);
        break;

      case 'similar_explorations':
        // Notes that might be explorations/thinking
        if (topics.length > 0) {
          const topicFilters = topics.slice(0, 3).map(t => `title.ilike.%${t}%`).join(',');
          query = query.or(topicFilters);
        }
        query = query.order('created_at', { ascending: false }).limit(15);
        break;

      case 'broad_search':
        // Cast a wide net
        if (topics.length > 0) {
          const topicFilters = topics.slice(0, 5).map(t => `title.ilike.%${t}%`).join(',');
          query = query.or(topicFilters);
        }
        query = query.order('created_at', { ascending: false }).limit(25);
        break;

      case 'recent':
      default:
        query = query.order('created_at', { ascending: false }).limit(10);
        break;
    }

    const { data, error } = await query;
    if (error) {
      console.error('[context-loader] Error loading notes:', error.code);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[context-loader] Exception loading notes:', error.message);
    return [];
  }
}

/**
 * Load behavioral context for mentioned entities
 * Phase 19: Intent-Aware Extraction
 */
async function loadBehaviors(userId, mentionedNames, supabase) {
  const behaviors = [];
  const qualities = [];

  try {
    // Load all active behaviors for this user
    const { data: allBehaviors } = await supabase
      .from('user_behaviors')
      .select('predicate, entity_name, topic, sentiment, confidence, reinforcement_count')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('confidence', { ascending: false })
      .limit(20);

    // Load all active entity qualities
    const { data: allQualities } = await supabase
      .from('entity_qualities')
      .select('entity_name, predicate, object, confidence, reinforcement_count')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('confidence', { ascending: false })
      .limit(20);

    // If entities are mentioned, prioritize those
    if (mentionedNames.length > 0) {
      const mentionedLower = mentionedNames.map(n => n.toLowerCase());

      // Filter behaviors for mentioned entities
      for (const b of (allBehaviors || [])) {
        const isRelevant = mentionedLower.some(n =>
          b.entity_name.toLowerCase().includes(n)
        );
        if (isRelevant) {
          behaviors.push(b);
        }
      }

      // Filter qualities for mentioned entities
      for (const q of (allQualities || [])) {
        const isRelevant = mentionedLower.some(n =>
          q.entity_name.toLowerCase().includes(n)
        );
        if (isRelevant) {
          qualities.push(q);
        }
      }

      // Add top behaviors even if not mentioned (for broader context)
      const remaining = (allBehaviors || [])
        .filter(b => !behaviors.find(x => x.entity_name === b.entity_name && x.predicate === b.predicate))
        .slice(0, 5);
      behaviors.push(...remaining);

    } else {
      // No specific entities mentioned, return top behaviors/qualities
      behaviors.push(...(allBehaviors || []).slice(0, 10));
      qualities.push(...(allQualities || []).slice(0, 10));
    }

  } catch (error) {
    console.warn('[context-loader] Error loading behaviors:', error.message);
  }

  return { behaviors, qualities };
}

/**
 * Load user topics/interests
 * Returns top topics by importance for understanding user's interests
 */
async function loadUserTopics(userId, supabase) {
  try {
    const { data, error } = await supabase
      .from('user_topics')
      .select('name, description, importance_score, mention_count')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('importance_score', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.warn('[context-loader] Error loading topics:', error.code);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn('[context-loader] Exception loading topics:', error.message);
    return [];
  }
}

/**
 * Load patterns based on strategy type
 */
async function loadPatterns(userId, strategyType, supabase) {
  if (strategyType === 'none') return [];

  try {
    let query = supabase
      .from('user_patterns')
      .select('id, pattern_type, description, short_description, confidence, category')
      .eq('user_id', userId);

    switch (strategyType) {
      case 'behavioral':
        query = query.or('category.eq.decision,category.eq.behavior,category.eq.preference,pattern_type.eq.behavioral');
        break;

      case 'emotional_patterns':
        query = query.or('category.eq.emotional,category.eq.stress,category.eq.wellbeing,pattern_type.eq.emotional');
        break;

      case 'thinking_patterns':
        query = query.or('category.eq.thinking,category.eq.exploration,category.eq.curiosity,pattern_type.eq.cognitive');
        break;

      case 'all':
      default:
        break;
    }

    query = query.gte('confidence', 0.6).order('confidence', { ascending: false }).limit(10);

    const { data, error } = await query;
    if (error) {
      console.error('[context-loader] Error loading patterns:', error.code);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[context-loader] Exception loading patterns:', error.message);
    return [];
  }
}

/**
 * Build list of context items used (for UI display)
 */
function buildContextUsedList(context) {
  const used = [];

  for (const entity of context.entities) {
    used.push({
      type: 'entity',
      name: entity.name,
      entityType: entity.entity_type || 'entity'
    });
  }

  for (const fact of context.facts.slice(0, 5)) {
    const preview = fact.object_text?.substring(0, 30) || '';
    used.push({
      type: 'fact',
      name: `${fact.predicate}: ${preview}${preview.length >= 30 ? '...' : ''}`
    });
  }

  // Phase 19: Include behaviors in context used
  for (const behavior of (context.behaviors || []).slice(0, 3)) {
    const topicPart = behavior.topic ? ` (${behavior.topic})` : '';
    used.push({
      type: 'behavior',
      name: `${behavior.predicate.replace(/_/g, ' ')}: ${behavior.entity_name}${topicPart}`
    });
  }

  for (const note of context.notes.slice(0, 3)) {
    const preview = note.title?.substring(0, 40) || 'Untitled';
    used.push({
      type: 'note',
      name: `Note: "${preview}${preview.length >= 40 ? '...' : ''}"`
    });
  }

  for (const pattern of context.patterns) {
    const preview = pattern.short_description || pattern.description || '';
    used.push({
      type: 'pattern',
      name: `Pattern: ${preview.substring(0, 30)}${preview.length >= 30 ? '...' : ''}`
    });
  }

  // Include user topics/interests
  for (const topic of (context.userTopics || []).slice(0, 3)) {
    used.push({
      type: 'topic',
      name: `Interest: ${topic.name}`
    });
  }

  return used;
}

/**
 * Format context for inclusion in prompt
 * @param {object} context - Context from loadContextForTask
 * @returns {string} Formatted context string
 */
export function formatContextForPrompt(context) {
  let formatted = '';

  if (context.entities.length > 0) {
    formatted += '\n### People & Things You Know About\n';
    for (const entity of context.entities) {
      formatted += `- **${entity.name}** (${entity.entity_type || 'entity'})`;
      if (entity.relationship) {
        formatted += ` — ${entity.relationship}`;
      }
      if (entity.summary) {
        formatted += `: ${entity.summary}`;
      }
      formatted += '\n';
    }
  }

  if (context.facts.length > 0) {
    formatted += '\n### Facts\n';
    for (const fact of context.facts) {
      const predicate = fact.predicate.replace(/_/g, ' ');
      formatted += `- ${predicate}: ${fact.object_text}\n`;
    }
  }

  if (context.notes.length > 0) {
    formatted += '\n### Relevant Notes\n';
    for (const note of context.notes) {
      const date = new Date(note.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      const title = note.title || 'Untitled';
      formatted += `- [${date}] ${title}`;
      if (note.category) {
        formatted += ` (${note.category})`;
      }
      formatted += '\n';
    }
  }

  if (context.patterns.length > 0) {
    formatted += '\n### Patterns Observed\n';
    for (const pattern of context.patterns) {
      const desc = pattern.short_description || pattern.description || '';
      formatted += `- ${desc}\n`;
    }
  }

  // Phase 19: Behavioral context
  if (context.behaviors && context.behaviors.length > 0) {
    formatted += '\n### User Behaviors\n';
    for (const behavior of context.behaviors) {
      const predicate = behavior.predicate.replace(/_/g, ' ');
      const topicPart = behavior.topic ? ` (topic: ${behavior.topic})` : '';
      const sentimentPart = behavior.sentiment > 0 ? ' (+)' : behavior.sentiment < 0 ? ' (-)' : '';
      formatted += `- You ${predicate} ${behavior.entity_name}${topicPart}${sentimentPart}\n`;
    }
  }

  if (context.entityQualities && context.entityQualities.length > 0) {
    formatted += '\n### How People Relate to You\n';
    for (const quality of context.entityQualities) {
      const predicate = quality.predicate.replace(/_/g, ' ');
      formatted += `- ${quality.entity_name} ${predicate}: ${quality.object}\n`;
    }
  }

  // User topics/interests
  if (context.userTopics && context.userTopics.length > 0) {
    formatted += '\n### Your Interests\n';
    for (const topic of context.userTopics) {
      formatted += `- ${topic.name}`;
      if (topic.description) {
        formatted += `: ${topic.description}`;
      }
      formatted += '\n';
    }
  }

  return formatted;
}

/**
 * Get context summary for debugging/logging (no content, just counts)
 * @param {object} context
 * @returns {object}
 */
export function getContextSummary(context) {
  return {
    taskType: context.taskType,
    entityCount: context.entities.length,
    factCount: context.facts.length,
    noteCount: context.notes.length,
    patternCount: context.patterns.length,
    contextUsedCount: context.contextUsed.length
  };
}
