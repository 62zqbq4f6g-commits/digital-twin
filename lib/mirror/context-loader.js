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
 */
async function loadFacts(userId, strategyType, entities, supabase) {
  if (strategyType === 'none' || strategyType === 'minimal') return [];

  try {
    let query = supabase
      .from('entity_facts')
      .select('id, entity_id, predicate, object_text, confidence')
      .eq('user_id', userId);

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
