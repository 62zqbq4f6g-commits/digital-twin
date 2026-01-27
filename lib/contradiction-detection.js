// /lib/contradiction-detection.js
// Contradiction & Evolution Detection for Inscript
// Identifies changes in user opinions, sentiments, and facts over time

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Minimum confidence threshold for surfacing contradictions
const MIN_CONFIDENCE = 0.8;
// Minimum sentiment change to flag as evolution
const SENTIMENT_THRESHOLD = 0.3;
// Minimum days apart to consider a real change (not just mood)
const MIN_DAYS_APART = 7;

/**
 * Detect contradictions and evolutions for a user
 *
 * @param {string} user_id - User ID
 * @param {Object} options - Detection options
 * @param {string} options.timeframeA - Start of earlier period (ISO date)
 * @param {string} options.timeframeB - Start of later period (ISO date)
 * @param {string} options.entityId - Optional: specific entity to check
 * @param {string} options.scope - 'weekly' | 'monthly' | 'all'
 * @returns {Promise<Object>} Contradictions and evolutions
 */
async function detectContradictions(user_id, options = {}) {
  const { scope = 'monthly', entityId = null } = options;

  // Calculate time ranges based on scope
  const { periodA, periodB } = getTimePeriods(scope);

  const results = {
    contradictions: [],
    evolutions: [],
    sentimentShifts: []
  };

  try {
    // 1. Detect fact contradictions (same predicate, different values)
    const factContradictions = await detectFactContradictions(user_id, periodA, periodB, entityId);
    results.contradictions.push(...factContradictions);

    // 2. Detect sentiment evolutions
    const sentimentEvolutions = await detectSentimentEvolutions(user_id, periodA, periodB, entityId);
    results.sentimentShifts.push(...sentimentEvolutions);

    // 3. Detect topic/theme contradictions from notes
    const themeEvolutions = await detectThemeEvolutions(user_id, periodA, periodB);
    results.evolutions.push(...themeEvolutions);

  } catch (error) {
    console.error('[ContradictionDetection] Error:', error);
  }

  return results;
}

/**
 * Get time periods based on scope
 */
function getTimePeriods(scope) {
  const now = new Date();
  let periodA, periodB;

  switch (scope) {
    case 'weekly':
      // This week vs last week
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);

      periodA = {
        start: lastWeekStart.toISOString(),
        end: lastWeekEnd.toISOString(),
        label: 'last week'
      };
      periodB = {
        start: thisWeekStart.toISOString(),
        end: now.toISOString(),
        label: 'this week'
      };
      break;

    case 'monthly':
    default:
      // This month vs 3 months ago
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const threeMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0);

      periodA = {
        start: threeMonthsAgo.toISOString(),
        end: threeMonthsAgoEnd.toISOString(),
        label: threeMonthsAgo.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
      periodB = {
        start: thisMonthStart.toISOString(),
        end: now.toISOString(),
        label: 'this month'
      };
      break;
  }

  return { periodA, periodB };
}

/**
 * Detect contradictions in entity facts
 * e.g., "works_at: Google" in January, "works_at: Anthropic" now
 */
async function detectFactContradictions(user_id, periodA, periodB, entityId = null) {
  const contradictions = [];

  // Get facts from period A
  let queryA = supabase
    .from('entity_facts')
    .select(`
      id, entity_id, predicate, object_text, confidence, created_at,
      user_entities!inner(name, entity_type)
    `)
    .eq('user_id', user_id)
    .gte('created_at', periodA.start)
    .lte('created_at', periodA.end)
    .gte('confidence', 0.6);

  if (entityId) queryA = queryA.eq('entity_id', entityId);

  const { data: factsA } = await queryA;

  // Get facts from period B
  let queryB = supabase
    .from('entity_facts')
    .select(`
      id, entity_id, predicate, object_text, confidence, created_at,
      user_entities!inner(name, entity_type)
    `)
    .eq('user_id', user_id)
    .gte('created_at', periodB.start)
    .lte('created_at', periodB.end)
    .gte('confidence', 0.6);

  if (entityId) queryB = queryB.eq('entity_id', entityId);

  const { data: factsB } = await queryB;

  if (!factsA?.length || !factsB?.length) return contradictions;

  // Group facts by entity + predicate
  const factMapA = groupFactsByKey(factsA);
  const factMapB = groupFactsByKey(factsB);

  // Find contradictions
  for (const [key, factA] of Object.entries(factMapA)) {
    const factB = factMapB[key];
    if (!factB) continue;

    // Same entity + predicate, different value
    if (factA.object_text !== factB.object_text) {
      const daysDiff = Math.abs(
        (new Date(factB.created_at) - new Date(factA.created_at)) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff >= MIN_DAYS_APART) {
        const confidence = Math.min(factA.confidence, factB.confidence);

        if (confidence >= MIN_CONFIDENCE) {
          contradictions.push({
            type: 'fact_change',
            entityName: factA.user_entities.name,
            entityType: factA.user_entities.entity_type,
            predicate: factA.predicate,
            before: {
              value: factA.object_text,
              date: factA.created_at,
              periodLabel: periodA.label
            },
            after: {
              value: factB.object_text,
              date: factB.created_at,
              periodLabel: periodB.label
            },
            confidence,
            summary: `Your ${factA.predicate.replace(/_/g, ' ')} for ${factA.user_entities.name} changed from "${factA.object_text}" to "${factB.object_text}"`
          });
        }
      }
    }
  }

  return contradictions;
}

/**
 * Detect sentiment evolutions for entities
 */
async function detectSentimentEvolutions(user_id, periodA, periodB, entityId = null) {
  const evolutions = [];

  // Get entity sentiments - we need to calculate from notes mentioning entities
  // For now, use entity sentiment_average and look for significant changes

  let query = supabase
    .from('user_entities')
    .select('id, name, entity_type, sentiment_average, mention_count, updated_at')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .gt('mention_count', 2); // Only entities with enough data

  if (entityId) query = query.eq('id', entityId);

  const { data: entities } = await query;
  if (!entities?.length) return evolutions;

  // For each entity, check notes sentiment over time
  for (const entity of entities) {
    // Get notes mentioning this entity in period A
    const { data: notesA } = await supabase
      .from('notes')
      .select('id, sentiment, created_at')
      .eq('user_id', user_id)
      .gte('created_at', periodA.start)
      .lte('created_at', periodA.end)
      .textSearch('content', entity.name, { type: 'plain' });

    // Get notes mentioning this entity in period B
    const { data: notesB } = await supabase
      .from('notes')
      .select('id, sentiment, created_at')
      .eq('user_id', user_id)
      .gte('created_at', periodB.start)
      .lte('created_at', periodB.end)
      .textSearch('content', entity.name, { type: 'plain' });

    if (!notesA?.length || !notesB?.length) continue;

    const avgSentimentA = calculateAvgSentiment(notesA);
    const avgSentimentB = calculateAvgSentiment(notesB);

    if (avgSentimentA === null || avgSentimentB === null) continue;

    const sentimentDelta = avgSentimentB - avgSentimentA;

    if (Math.abs(sentimentDelta) >= SENTIMENT_THRESHOLD) {
      const trend = sentimentDelta > 0 ? 'improving' : 'declining';
      const percentChange = Math.round(Math.abs(sentimentDelta) * 100);

      evolutions.push({
        type: 'sentiment_shift',
        entityName: entity.name,
        entityType: entity.entity_type,
        before: {
          sentiment: avgSentimentA,
          noteCount: notesA.length,
          periodLabel: periodA.label
        },
        after: {
          sentiment: avgSentimentB,
          noteCount: notesB.length,
          periodLabel: periodB.label
        },
        trend,
        delta: sentimentDelta,
        confidence: Math.min(0.9, 0.5 + (notesA.length + notesB.length) * 0.05),
        summary: `Your sentiment about ${entity.name} has ${trend === 'improving' ? 'improved' : 'declined'} by ${percentChange}%`
      });
    }
  }

  return evolutions;
}

/**
 * Detect theme/topic evolutions from note content
 */
async function detectThemeEvolutions(user_id, periodA, periodB) {
  const evolutions = [];

  // Get category distributions for both periods
  const { data: notesA } = await supabase
    .from('notes')
    .select('category, sentiment')
    .eq('user_id', user_id)
    .gte('created_at', periodA.start)
    .lte('created_at', periodA.end);

  const { data: notesB } = await supabase
    .from('notes')
    .select('category, sentiment')
    .eq('user_id', user_id)
    .gte('created_at', periodB.start)
    .lte('created_at', periodB.end);

  if (!notesA?.length || !notesB?.length) return evolutions;

  // Calculate category sentiments
  const categoryStatsA = calculateCategoryStats(notesA);
  const categoryStatsB = calculateCategoryStats(notesB);

  // Find significant shifts in category sentiment
  for (const category of Object.keys(categoryStatsB)) {
    const statsA = categoryStatsA[category];
    const statsB = categoryStatsB[category];

    if (!statsA || !statsB) continue;
    if (statsA.count < 2 || statsB.count < 2) continue;

    const sentimentDelta = statsB.avgSentiment - statsA.avgSentiment;

    if (Math.abs(sentimentDelta) >= SENTIMENT_THRESHOLD) {
      const trend = sentimentDelta > 0 ? 'improving' : 'declining';

      evolutions.push({
        type: 'category_shift',
        category,
        before: {
          avgSentiment: statsA.avgSentiment,
          noteCount: statsA.count,
          periodLabel: periodA.label
        },
        after: {
          avgSentiment: statsB.avgSentiment,
          noteCount: statsB.count,
          periodLabel: periodB.label
        },
        trend,
        delta: sentimentDelta,
        confidence: 0.75,
        summary: `Your ${category} notes have become more ${trend === 'improving' ? 'positive' : 'negative'}`
      });
    }
  }

  return evolutions;
}

/**
 * Get contradictions for MIRROR context
 * Called when user mentions an entity in conversation
 */
async function getContradictionsForEntity(user_id, entityName) {
  // Find entity
  const { data: entity } = await supabase
    .from('user_entities')
    .select('id, name, entity_type')
    .eq('user_id', user_id)
    .ilike('name', entityName)
    .maybeSingle();

  if (!entity) return { contradictions: [], evolutions: [] };

  // Get all-time contradictions for this entity
  const periodA = {
    start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
    end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 1 month ago
    label: 'earlier'
  };

  const periodB = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 1 month ago
    end: new Date().toISOString(),
    label: 'recently'
  };

  const factContradictions = await detectFactContradictions(user_id, periodA, periodB, entity.id);
  const sentimentEvolutions = await detectSentimentEvolutions(user_id, periodA, periodB, entity.id);

  return {
    contradictions: factContradictions,
    evolutions: sentimentEvolutions
  };
}

/**
 * Format contradictions for injection into LLM context
 */
function formatForContext(results) {
  if (!results.contradictions.length && !results.sentimentShifts.length && !results.evolutions.length) {
    return null;
  }

  let context = '<user_evolutions>\n';

  if (results.contradictions.length > 0) {
    context += 'FACT CHANGES:\n';
    for (const c of results.contradictions.slice(0, 3)) {
      context += `- ${c.summary}\n`;
      context += `  (${c.before.periodLabel}: "${c.before.value}" → ${c.after.periodLabel}: "${c.after.value}")\n`;
    }
  }

  if (results.sentimentShifts.length > 0) {
    context += '\nSENTIMENT SHIFTS:\n';
    for (const s of results.sentimentShifts.slice(0, 3)) {
      context += `- ${s.summary}\n`;
    }
  }

  if (results.evolutions.length > 0) {
    context += '\nTHEME EVOLUTIONS:\n';
    for (const e of results.evolutions.slice(0, 3)) {
      context += `- ${e.summary}\n`;
    }
  }

  context += '</user_evolutions>';

  return context;
}

// Helper functions

function groupFactsByKey(facts) {
  const map = {};
  for (const fact of facts) {
    const key = `${fact.entity_id}:${fact.predicate}`;
    // Keep the most recent fact for each key
    if (!map[key] || new Date(fact.created_at) > new Date(map[key].created_at)) {
      map[key] = fact;
    }
  }
  return map;
}

function calculateAvgSentiment(notes) {
  const sentiments = notes
    .map(n => parseSentiment(n.sentiment))
    .filter(s => s !== null);

  if (sentiments.length === 0) return null;
  return sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
}

function parseSentiment(sentiment) {
  if (typeof sentiment === 'number') return sentiment;
  if (sentiment === 'positive') return 0.7;
  if (sentiment === 'negative') return 0.3;
  if (sentiment === 'mixed' || sentiment === 'neutral') return 0.5;
  return null;
}

function calculateCategoryStats(notes) {
  const stats = {};

  for (const note of notes) {
    const cat = note.category || 'uncategorized';
    if (!stats[cat]) {
      stats[cat] = { count: 0, sentiments: [] };
    }
    stats[cat].count++;
    const s = parseSentiment(note.sentiment);
    if (s !== null) stats[cat].sentiments.push(s);
  }

  // Calculate averages
  for (const cat of Object.keys(stats)) {
    const s = stats[cat].sentiments;
    stats[cat].avgSentiment = s.length > 0
      ? s.reduce((a, b) => a + b, 0) / s.length
      : 0.5;
  }

  return stats;
}

module.exports = {
  detectContradictions,
  getContradictionsForEntity,
  formatForContext,
  getTimePeriods
};
