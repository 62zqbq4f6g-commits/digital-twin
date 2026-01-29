/**
 * PROFILE TO FACTS CONVERTER
 *
 * Converts structured user profile data into SPO (Subject-Predicate-Object) triples
 * for storage in the knowledge graph.
 *
 * Handles data from:
 * - Onboarding (name, life_seasons, mental_focus, depth_answer, value_priorities, seeded_people)
 * - YOU tab (tone, life_context, boundaries, role edits)
 * - User profiles (any profile field changes)
 *
 * @module lib/extraction/profile-converter
 */

/**
 * Convert profile data to facts
 * Returns array of { predicate, object, confidence, context? } objects
 *
 * @param {object} profileData - Profile data from onboarding or YOU tab
 * @returns {Array<object>} Array of fact objects
 */
export function convertProfileToFacts(profileData) {
  const facts = [];

  // Name
  if (profileData.name) {
    facts.push({
      predicate: 'is_named',
      object: profileData.name,
      confidence: 1.0
    });
  }

  // Life seasons (current life phase)
  if (profileData.life_seasons && Array.isArray(profileData.life_seasons)) {
    for (const season of profileData.life_seasons) {
      facts.push({
        predicate: 'life_phase',
        object: normalizeLifeSeason(season),
        confidence: 1.0,
        context: 'User selected during onboarding/profile'
      });
    }
  }

  // Role type (single selection)
  if (profileData.role_type) {
    facts.push({
      predicate: 'current_role',
      object: normalizeRoleType(profileData.role_type),
      confidence: 1.0
    });
  }

  // Mental focus areas
  if (profileData.mental_focus && Array.isArray(profileData.mental_focus)) {
    for (const focus of profileData.mental_focus) {
      facts.push({
        predicate: 'focused_on',
        object: normalizeMentalFocus(focus),
        confidence: 1.0,
        context: 'Primary mental focus area'
      });
    }
  }

  // Goals
  if (profileData.goals && Array.isArray(profileData.goals)) {
    for (const goal of profileData.goals) {
      facts.push({
        predicate: 'goal',
        object: normalizeGoal(goal),
        confidence: 1.0
      });
    }
  }

  // Value priorities (ranked)
  if (profileData.value_priorities && Array.isArray(profileData.value_priorities)) {
    profileData.value_priorities.forEach((value, index) => {
      facts.push({
        predicate: 'values',
        object: normalizeValue(value),
        confidence: 1.0 - (index * 0.1), // Higher confidence for higher priority
        context: `Priority rank: ${index + 1}`
      });
    });
  }

  // Depth question answer (free text - extract key insights)
  if (profileData.depth_answer && profileData.depth_answer.length > 20) {
    facts.push({
      predicate: 'self_reflection',
      object: profileData.depth_answer.substring(0, 500), // Limit length
      confidence: 1.0,
      context: profileData.depth_question || 'Depth question response'
    });
  }

  // Tone preference
  if (profileData.tone) {
    facts.push({
      predicate: 'prefers_tone',
      object: profileData.tone,
      confidence: 1.0
    });
  }

  // Life context (free text)
  if (profileData.life_context && profileData.life_context.length > 10) {
    facts.push({
      predicate: 'life_context',
      object: profileData.life_context,
      confidence: 1.0
    });
  }

  // Boundaries (topics to avoid)
  if (profileData.boundaries && Array.isArray(profileData.boundaries)) {
    for (const boundary of profileData.boundaries) {
      facts.push({
        predicate: 'avoids_topic',
        object: boundary,
        confidence: 1.0,
        context: 'User-defined boundary'
      });
    }
  }

  // Communication style
  if (profileData.communication_style) {
    facts.push({
      predicate: 'communication_style',
      object: profileData.communication_style,
      confidence: 1.0
    });
  }

  // Formality preference
  if (profileData.formality) {
    facts.push({
      predicate: 'prefers_formality',
      object: profileData.formality,
      confidence: 1.0
    });
  }

  // Verbosity preference
  if (profileData.verbosity) {
    facts.push({
      predicate: 'prefers_verbosity',
      object: profileData.verbosity,
      confidence: 1.0
    });
  }

  return facts;
}

/**
 * Convert key person to facts and behavioral predicates
 *
 * @param {string} name - Person's name
 * @param {string} relationship - Relationship type
 * @param {string} notes - Optional notes about the person
 * @returns {Array<object>} Array of fact objects
 */
export function convertKeyPersonToFacts(name, relationship, notes = '') {
  const facts = [];
  const lowerRel = relationship.toLowerCase();

  // Base relationship fact
  facts.push({
    predicate: 'knows',
    object: name,
    context: relationship,
    confidence: 1.0,
    isBehavior: false
  });

  // Map relationship to behavioral predicates
  const behaviorMappings = {
    // Mentor relationships
    'mentor': [
      { predicate: 'learns_from', isBehavior: true },
      { predicate: 'trusts_opinion_of', isBehavior: true },
      { predicate: 'seeks_advice_from', isBehavior: true }
    ],
    'advisor': [
      { predicate: 'seeks_advice_from', isBehavior: true },
      { predicate: 'trusts_opinion_of', isBehavior: true }
    ],

    // Close relationships
    'close friend': [
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true }
    ],
    'best friend': [
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'confides_in', isBehavior: true }
    ],
    'friend': [
      { predicate: 'trusts', isBehavior: true }
    ],

    // Family relationships
    'family': [
      { predicate: 'relies_on', isBehavior: true }
    ],
    'parent': [
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'trusts', isBehavior: true }
    ],
    'mother': [
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'trusts', isBehavior: true }
    ],
    'father': [
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'trusts', isBehavior: true }
    ],
    'sibling': [
      { predicate: 'trusts', isBehavior: true }
    ],
    'brother': [
      { predicate: 'trusts', isBehavior: true }
    ],
    'sister': [
      { predicate: 'trusts', isBehavior: true }
    ],

    // Partner relationships
    'partner': [
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'confides_in', isBehavior: true }
    ],
    'spouse': [
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'confides_in', isBehavior: true }
    ],
    'wife': [
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'confides_in', isBehavior: true }
    ],
    'husband': [
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true },
      { predicate: 'confides_in', isBehavior: true }
    ],

    // Work relationships
    'colleague': [
      { predicate: 'collaborates_with', isBehavior: true }
    ],
    'coworker': [
      { predicate: 'collaborates_with', isBehavior: true }
    ],
    'cofounder': [
      { predicate: 'collaborates_with', isBehavior: true },
      { predicate: 'trusts', isBehavior: true },
      { predicate: 'relies_on', isBehavior: true }
    ],
    'manager': [
      { predicate: 'reports_to', isBehavior: false }
    ],
    'boss': [
      { predicate: 'reports_to', isBehavior: false }
    ],
    'report': [
      { predicate: 'manages', isBehavior: false }
    ],
    'direct report': [
      { predicate: 'manages', isBehavior: false }
    ],
    'client': [
      { predicate: 'works_with', isBehavior: false }
    ],

    // Inspiration
    'inspiration': [
      { predicate: 'inspired_by', isBehavior: true }
    ],
    'role model': [
      { predicate: 'inspired_by', isBehavior: true },
      { predicate: 'learns_from', isBehavior: true }
    ],

    // Therapist/Coach
    'therapist': [
      { predicate: 'confides_in', isBehavior: true },
      { predicate: 'seeks_advice_from', isBehavior: true }
    ],
    'coach': [
      { predicate: 'learns_from', isBehavior: true },
      { predicate: 'seeks_advice_from', isBehavior: true }
    ]
  };

  // Add behavioral predicates based on relationship
  const behaviors = behaviorMappings[lowerRel] || [];
  for (const behavior of behaviors) {
    facts.push({
      predicate: behavior.predicate,
      object: name,
      context: `${relationship} relationship`,
      confidence: 0.9, // Slightly lower since inferred from relationship
      isBehavior: behavior.isBehavior
    });
  }

  // Add notes if provided
  if (notes && notes.length > 5) {
    facts.push({
      predicate: 'note_about',
      object: notes,
      context: `About ${name}`,
      confidence: 1.0,
      isBehavior: false
    });
  }

  return facts;
}

/**
 * Normalize life season values
 */
function normalizeLifeSeason(season) {
  const mapping = {
    'building': 'building_career',
    'leading': 'leadership_role',
    'learning': 'learning_phase',
    'transition': 'life_transition',
    'caring': 'caregiving',
    'creating': 'creative_work',
    'healing': 'healing_recovery',
    'exploring': 'exploration',
    'settling': 'settling_down',
    'fresh start': 'new_beginning',
    'fresh_start': 'new_beginning'
  };
  return mapping[season.toLowerCase()] || season.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Normalize role type values
 */
function normalizeRoleType(role) {
  const mapping = {
    'building': 'entrepreneur_builder',
    'leading': 'leader_manager',
    'making': 'creator_maker',
    'learning': 'learner_student',
    'juggling': 'multi_role',
    'transitioning': 'in_transition'
  };
  return mapping[role.toLowerCase()] || role.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Normalize mental focus values
 */
function normalizeMentalFocus(focus) {
  const mapping = {
    'work': 'work_career',
    'relationships': 'relationships',
    'health': 'health_wellness',
    'money': 'finances',
    'family': 'family',
    'decision': 'decision_making',
    'future': 'future_planning',
    'myself': 'self_development',
    'project': 'specific_project',
    'loss': 'processing_loss'
  };
  return mapping[focus.toLowerCase()] || focus.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Normalize goal values
 */
function normalizeGoal(goal) {
  const mapping = {
    'decisions': 'make_better_decisions',
    'process': 'process_thoughts',
    'organize': 'organize_thinking',
    'self understanding': 'understand_self',
    'self_understanding': 'understand_self',
    'remember': 'capture_memories',
    'exploring': 'explore_ideas'
  };
  return mapping[goal.toLowerCase()] || goal.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Normalize value priorities
 */
function normalizeValue(value) {
  const mapping = {
    'health': 'health_wellness',
    'family': 'family_relationships',
    'work': 'career_work',
    'financial': 'financial_security',
    'creative': 'creativity_expression',
    'growth': 'personal_growth'
  };
  return mapping[value.toLowerCase()] || value.toLowerCase().replace(/\s+/g, '_');
}

export default {
  convertProfileToFacts,
  convertKeyPersonToFacts
};
