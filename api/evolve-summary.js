/**
 * MEM0 GAP 1: Evolving Category Summaries
 * Prose summaries per category that get REWRITTEN (not appended) as new info arrives
 *
 * PHASE 19 EXPANSION: Full User State
 * - Include user behaviors (trusts, relies_on, learns_from)
 * - Include entity qualities (helps_with, mentors, supports)
 * - Generate behavioral profile summaries
 * - Provide complete context for AI systems
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { encryptForStorage, isValidKey } from './lib/encryption-edge.js';

const anthropic = new Anthropic();

// Category keywords for entity classification
const CATEGORY_KEYWORDS = {
  work_life: [
    'work', 'job', 'office', 'meeting', 'project', 'deadline', 'boss', 'colleague',
    'salary', 'promotion', 'career', 'company', 'startup', 'client', 'presentation',
    'email', 'slack', 'zoom', 'conference', 'coworker', 'manager', 'team'
  ],
  personal_life: [
    'home', 'apartment', 'house', 'weekend', 'hobby', 'free time', 'relax', 'vacation',
    'birthday', 'celebration', 'party', 'movie', 'book', 'music', 'game', 'fun'
  ],
  health_wellness: [
    'health', 'doctor', 'exercise', 'workout', 'gym', 'run', 'sleep', 'diet',
    'meditation', 'stress', 'anxiety', 'therapy', 'mental health', 'illness',
    'medicine', 'hospital', 'wellness', 'fitness', 'yoga', 'nutrition'
  ],
  relationships: [
    'friend', 'family', 'partner', 'spouse', 'dating', 'marriage', 'boyfriend',
    'girlfriend', 'husband', 'wife', 'parent', 'child', 'sibling', 'mom', 'dad',
    'brother', 'sister', 'cousin', 'relationship', 'love', 'breakup'
  ],
  goals_aspirations: [
    'goal', 'dream', 'aspiration', 'plan', 'future', 'want', 'wish', 'hope',
    'ambition', 'target', 'milestone', 'achieve', 'success', 'resolution'
  ],
  preferences: [
    'like', 'love', 'prefer', 'favorite', 'enjoy', 'hate', 'dislike', 'want',
    'need', 'taste', 'style', 'choice', 'opinion'
  ],
  beliefs_values: [
    'believe', 'think', 'value', 'important', 'principle', 'moral', 'ethics',
    'religion', 'spiritual', 'philosophy', 'meaning', 'purpose'
  ],
  skills_expertise: [
    'skill', 'expert', 'learn', 'know', 'experience', 'talent', 'ability',
    'proficient', 'master', 'certification', 'training', 'education'
  ],
  projects: [
    'project', 'build', 'create', 'develop', 'launch', 'ship', 'product',
    'feature', 'app', 'website', 'startup', 'side project', 'mvp'
  ],
  challenges: [
    'challenge', 'problem', 'struggle', 'difficulty', 'obstacle', 'issue',
    'concern', 'worry', 'fear', 'anxiety', 'stress', 'conflict', 'stuck'
  ]
};

// Phase 19: Behavioral categories for user behaviors
const BEHAVIORAL_CATEGORIES = {
  trust_network: ['trusts_opinion_of', 'relies_on', 'learns_from', 'seeks_advice_from'],
  support_system: ['supported_by', 'mentored_by', 'energized_by', 'helped_by'],
  challenges: ['conflicted_about', 'avoids', 'drained_by', 'challenged_by'],
  inspiration: ['inspired_by', 'admires', 'collaborates_with'],
  feelings: ['feels_about', 'appreciates', 'misses']
};

/**
 * Classify an entity into a category based on its content
 */
function classifyEntity(entity) {
  const textToAnalyze = [
    entity.name || '',
    entity.summary || '',
    ...(entity.context_notes || [])
  ].join(' ').toLowerCase();

  const scores = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = keywords.filter(kw => textToAnalyze.includes(kw)).length;
  }

  // Find category with highest score
  let maxScore = 0;
  let bestCategory = 'general';

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  // Only assign category if there's meaningful signal
  return maxScore >= 1 ? bestCategory : 'general';
}

/**
 * Phase 19: Get user behaviors from database
 */
async function getUserBehaviors(supabase, userId) {
  const { data, error } = await supabase
    .from('user_behaviors')
    .select('predicate, entity_name, topic, sentiment, confidence, reinforcement_count')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('confidence', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[evolve-summary] Error fetching behaviors:', error.code);
    return [];
  }
  return data || [];
}

/**
 * Phase 19: Get entity qualities from database
 */
async function getEntityQualities(supabase, userId) {
  const { data, error } = await supabase
    .from('entity_qualities')
    .select('entity_name, predicate, object, confidence, reinforcement_count')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('confidence', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[evolve-summary] Error fetching qualities:', error.code);
    return [];
  }
  return data || [];
}

/**
 * Phase 19: Classify behavior into behavioral category
 */
function classifyBehavior(predicate) {
  for (const [category, predicates] of Object.entries(BEHAVIORAL_CATEGORIES)) {
    if (predicates.includes(predicate)) {
      return category;
    }
  }
  return 'general';
}

/**
 * Phase 19: Evolve behavioral profile summary
 * Generates a prose summary of how the user relates to the people/things in their life
 */
async function evolveBehavioralProfile(existingProfile, behaviors, qualities) {
  if (behaviors.length === 0 && qualities.length === 0) {
    return existingProfile || null;
  }

  // Format behaviors
  const behaviorLines = behaviors.slice(0, 15).map(b => {
    const predicate = b.predicate.replace(/_/g, ' ');
    const topicPart = b.topic ? ` (re: ${b.topic})` : '';
    const strength = b.reinforcement_count > 2 ? ' (strong)' : '';
    return `- User ${predicate} ${b.entity_name}${topicPart}${strength}`;
  }).join('\n');

  // Format qualities
  const qualityLines = qualities.slice(0, 15).map(q => {
    const predicate = q.predicate.replace(/_/g, ' ');
    const strength = q.reinforcement_count > 2 ? ' (strong)' : '';
    return `- ${q.entity_name} ${predicate}: ${q.object}${strength}`;
  }).join('\n');

  const prompt = `You are maintaining a behavioral profile summary for a user.

${existingProfile ? `CURRENT PROFILE:\n${existingProfile}\n\n` : 'No existing profile yet.\n\n'}NEW BEHAVIORAL DATA:

User's relationships with people/things:
${behaviorLines || 'None'}

How people/things relate to user:
${qualityLines || 'None'}

YOUR TASK:
Write a cohesive prose profile (3-5 sentences) that captures:
1. Who this person trusts and relies on
2. Who supports and helps them
3. Any tensions or challenges in relationships
4. Sources of inspiration or energy

Guidelines:
- Write in third person ("This person...")
- Focus on patterns, not lists
- If new info contradicts existing, use new info
- Keep it warm but insightful
- This is for AI context, so be specific

Write ONLY the profile, no preamble:`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });

    const profile = response.content[0]?.text?.trim();
    return profile || existingProfile || null;
  } catch (error) {
    console.error('[evolve-summary] Claude error for behavioral profile:', error.message);
    return existingProfile || null;
  }
}

/**
 * Phase 19: Generate full user context for AI systems
 * Combines identity, entities, behaviors, patterns into one coherent summary
 */
async function getFullUserProfile(supabase, userId) {
  // Gather all data in parallel
  const [
    categorySummaries,
    behaviors,
    qualities,
    patterns,
    onboarding,
    keyPeople
  ] = await Promise.all([
    getCategorySummaries(supabase, userId),
    getUserBehaviors(supabase, userId),
    getEntityQualities(supabase, userId),
    getPatterns(supabase, userId),
    getOnboarding(supabase, userId),
    getKeyPeople(supabase, userId)
  ]);

  // Get or evolve behavioral profile
  const { data: existingBehavioral } = await supabase
    .from('category_summaries')
    .select('summary')
    .eq('user_id', userId)
    .eq('category', 'behavioral_profile')
    .single();

  const behavioralProfile = await evolveBehavioralProfile(
    existingBehavioral?.summary || null,
    behaviors,
    qualities
  );

  // Save updated behavioral profile
  if (behavioralProfile) {
    await supabase
      .from('category_summaries')
      .upsert({
        user_id: userId,
        category: 'behavioral_profile',
        summary: behavioralProfile,
        entity_count: behaviors.length + qualities.length,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,category' });
  }

  return {
    identity: {
      name: onboarding?.name || null,
      role: onboarding?.role_type || null,
      goals: onboarding?.goals || [],
      lifeContext: onboarding?.life_seasons || [],
      tone: onboarding?.tone || 'warm'
    },
    keyPeople: keyPeople.map(p => ({
      name: p.name,
      relationship: p.relationship
    })),
    categorySummaries: categorySummaries.reduce((acc, s) => {
      acc[s.category] = s.summary;
      return acc;
    }, {}),
    behavioralProfile,
    behaviors: behaviors.slice(0, 20).map(b => ({
      predicate: b.predicate,
      entity: b.entity_name,
      topic: b.topic,
      sentiment: b.sentiment
    })),
    entityQualities: qualities.slice(0, 20).map(q => ({
      entity: q.entity_name,
      predicate: q.predicate,
      object: q.object
    })),
    patterns: patterns.slice(0, 10).map(p => ({
      type: p.pattern_type,
      description: p.short_description || p.description,
      confidence: p.confidence
    })),
    meta: {
      behaviorCount: behaviors.length,
      qualityCount: qualities.length,
      patternCount: patterns.length,
      categoryCount: categorySummaries.length
    }
  };
}

/**
 * Helper: Get patterns for user
 */
async function getPatterns(supabase, userId) {
  const { data, error } = await supabase
    .from('user_patterns')
    .select('pattern_type, description, short_description, confidence')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('confidence', 0.6)
    .order('confidence', { ascending: false })
    .limit(20);

  if (error) return [];
  return data || [];
}

/**
 * Helper: Get onboarding data
 */
async function getOnboarding(supabase, userId) {
  const { data } = await supabase
    .from('onboarding_data')
    .select('*')
    .eq('user_id', userId)
    .single();

  return data || null;
}

/**
 * Helper: Get key people
 */
async function getKeyPeople(supabase, userId) {
  const { data } = await supabase
    .from('user_key_people')
    .select('name, relationship')
    .eq('user_id', userId)
    .limit(10);

  return data || [];
}

/**
 * Evolve a category summary using Claude
 * Key Mem0 innovation: REWRITE the summary, don't append
 */
async function evolveCategorySummary(existingSummary, newEntities, category) {
  const entityContext = newEntities.map(e => {
    const contexts = e.context_notes?.slice(-3) || [];
    return `- ${e.name} (${e.entity_type}): ${e.summary || contexts.join('; ')}`;
  }).join('\n');

  const prompt = `You are maintaining a personal knowledge summary for a user's ${category.replace('_', ' ')} category.

${existingSummary ? `CURRENT SUMMARY:\n${existingSummary}\n\n` : 'No existing summary yet.\n\n'}NEW INFORMATION:
${entityContext}

YOUR TASK:
Write a new, cohesive prose summary (2-4 sentences) that incorporates ALL relevant information.
- If new info CONTRADICTS existing info, use the new info (it's more recent)
- If new info ADDS TO existing info, integrate it smoothly
- Keep it personal and warm, like a friend's notes
- Focus on what matters most to this person
- Don't just list facts - tell a story

Write ONLY the new summary, no preamble:`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const summary = response.content[0]?.text?.trim();
    return summary || existingSummary || '';
  } catch (error) {
    console.error('[evolve-summary] Claude error:', error);
    return existingSummary || '';
  }
}

/**
 * Update category summaries for a user based on recent entities
 */
async function updateCategorySummaries(supabase, userId, entities, encryptionKey = null) {
  const results = { updated: [], created: [], errors: [] };

  // Group entities by category
  const entitiesByCategory = {};
  for (const entity of entities) {
    const category = classifyEntity(entity);
    if (!entitiesByCategory[category]) {
      entitiesByCategory[category] = [];
    }
    entitiesByCategory[category].push(entity);
  }

  // Process each category with entities
  for (const [category, categoryEntities] of Object.entries(entitiesByCategory)) {
    if (categoryEntities.length === 0) continue;

    try {
      // Get existing summary for this category
      const { data: existing } = await supabase
        .from('category_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .single();

      // Evolve the summary
      const newSummary = await evolveCategorySummary(
        existing?.summary || null,
        categoryEntities,
        category
      );

      if (!newSummary) continue;

      // Track entities included in this summary
      const lastEntities = categoryEntities.slice(-5).map(e => ({
        id: e.id,
        name: e.name,
        added_at: new Date().toISOString()
      }));

      // Prepare encrypted data if encryption is enabled
      let encryptedData = null;
      if (encryptionKey) {
        const sensitiveData = {
          summary: newSummary,
          themes: categoryEntities.map(e => e.name)
        };
        encryptedData = await encryptForStorage(sensitiveData, encryptionKey);
      }

      if (existing) {
        // Update existing summary
        const updateData = {
          summary: newSummary,
          entity_count: (existing.entity_count || 0) + categoryEntities.length,
          last_entities: lastEntities,
          updated_at: new Date().toISOString()
        };
        if (encryptedData) {
          updateData.encrypted_data = encryptedData;
        }

        const { error } = await supabase
          .from('category_summaries')
          .update(updateData)
          .eq('id', existing.id);

        if (error) {
          results.errors.push({ category, error: error.message });
        } else {
          results.updated.push({ category, summary: newSummary.substring(0, 100) + '...' });
        }
      } else {
        // Create new summary
        const insertData = {
          user_id: userId,
          category,
          summary: newSummary,
          entity_count: categoryEntities.length,
          last_entities: lastEntities
        };
        if (encryptedData) {
          insertData.encrypted_data = encryptedData;
        }

        const { error } = await supabase
          .from('category_summaries')
          .insert(insertData);

        if (error) {
          results.errors.push({ category, error: error.message });
        } else {
          results.created.push({ category, summary: newSummary.substring(0, 100) + '...' });
        }
      }
    } catch (err) {
      console.error(`[evolve-summary] Error processing ${category}:`, err);
      results.errors.push({ category, error: err.message });
    }
  }

  return results;
}

/**
 * Get all category summaries for a user
 */
async function getCategorySummaries(supabase, userId) {
  const { data, error } = await supabase
    .from('category_summaries')
    .select('category, summary, entity_count, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[evolve-summary] Error fetching summaries:', error);
    return [];
  }

  return data || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, entities, action } = req.body;

  // Get encryption key from body or header
  const encryptionKey = req.body.encryptionKey || req.headers['x-encryption-key'];

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  // Validate encryption key if provided
  const hasValidEncryption = encryptionKey && isValidKey(encryptionKey);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (action === 'get') {
      // Get existing summaries
      const summaries = await getCategorySummaries(supabase, userId);
      return res.json({ summaries });
    }

    // Phase 19: Get full user profile for AI context
    if (action === 'full_profile') {
      const profile = await getFullUserProfile(supabase, userId);
      return res.json({ profile });
    }

    // Phase 19: Evolve behavioral profile only
    if (action === 'evolve_behavioral') {
      const behaviors = await getUserBehaviors(supabase, userId);
      const qualities = await getEntityQualities(supabase, userId);

      const { data: existingBehavioral } = await supabase
        .from('category_summaries')
        .select('summary')
        .eq('user_id', userId)
        .eq('category', 'behavioral_profile')
        .single();

      const behavioralProfile = await evolveBehavioralProfile(
        existingBehavioral?.summary || null,
        behaviors,
        qualities
      );

      if (behavioralProfile) {
        await supabase
          .from('category_summaries')
          .upsert({
            user_id: userId,
            category: 'behavioral_profile',
            summary: behavioralProfile,
            entity_count: behaviors.length + qualities.length,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,category' });
      }

      return res.json({
        success: true,
        behavioralProfile,
        behaviorCount: behaviors.length,
        qualityCount: qualities.length
      });
    }

    if (!entities || entities.length === 0) {
      return res.status(400).json({ error: 'entities array required for update' });
    }

    // Update summaries with new entities (with encryption if available)
    const results = await updateCategorySummaries(supabase, userId, entities, hasValidEncryption ? encryptionKey : null);

    console.log('[evolve-summary] Updated summaries:', {
      updated: results.updated.length,
      created: results.created.length,
      errors: results.errors.length
    });

    return res.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('[evolve-summary] Handler error:', error);
    return res.status(500).json({ error: 'Summary evolution failed' });
  }
}

// Export utilities for use in other modules
export {
  classifyEntity,
  evolveCategorySummary,
  updateCategorySummaries,
  getCategorySummaries,
  CATEGORY_KEYWORDS,
  // Phase 19: Behavioral profile exports
  BEHAVIORAL_CATEGORIES,
  classifyBehavior,
  getUserBehaviors,
  getEntityQualities,
  evolveBehavioralProfile,
  getFullUserProfile
};
