/**
 * MEM0 GAP 1: Evolving Category Summaries
 * Prose summaries per category that get REWRITTEN (not appended) as new info arrives
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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
async function updateCategorySummaries(supabase, userId, entities) {
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

      if (existing) {
        // Update existing summary
        const { error } = await supabase
          .from('category_summaries')
          .update({
            summary: newSummary,
            entity_count: (existing.entity_count || 0) + categoryEntities.length,
            last_entities: lastEntities,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          results.errors.push({ category, error: error.message });
        } else {
          results.updated.push({ category, summary: newSummary.substring(0, 100) + '...' });
        }
      } else {
        // Create new summary
        const { error } = await supabase
          .from('category_summaries')
          .insert({
            user_id: userId,
            category,
            summary: newSummary,
            entity_count: categoryEntities.length,
            last_entities: lastEntities
          });

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

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

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

    if (!entities || entities.length === 0) {
      return res.status(400).json({ error: 'entities array required for update' });
    }

    // Update summaries with new entities
    const results = await updateCategorySummaries(supabase, userId, entities);

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
    return res.status(500).json({ error: error.message });
  }
}

// Export utilities for use in other modules
export { classifyEntity, evolveCategorySummary, updateCategorySummaries, getCategorySummaries, CATEGORY_KEYWORDS };
