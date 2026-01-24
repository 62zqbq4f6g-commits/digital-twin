/**
 * api/user-context.js - Unified User Context Fetcher
 *
 * Single source of truth for fetching ALL user data.
 * Used by: mirror.js, chat.js, analyze.js
 *
 * This ensures MIRROR and other APIs have access to:
 * - Onboarding data (name, life_seasons, mental_focus, depth Q&A, seeded people)
 * - Profile preferences (role_types, goals, tone, life_context, boundaries)
 * - Key People (manually added)
 * - Entities (extracted from notes)
 * - Patterns (detected)
 * - Category summaries (AI-generated)
 */

/**
 * Fetch complete user context from all data sources
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Object} Complete user context
 */
async function getUserFullContext(supabase, userId) {
  if (!supabase || !userId) {
    console.warn('[UserContext] Missing supabase or userId');
    return getEmptyContext();
  }

  console.log('[UserContext] Fetching full context for user:', userId);

  try {
    // Fetch ALL user data in parallel for efficiency
    const [
      profileRes,
      onboardingRes,
      keyPeopleRes,
      entitiesRes,
      patternsRes,
      summariesRes,
      noteCountRes
    ] = await Promise.all([
      // User profile (editable preferences from TWIN tab)
      supabase
        .from('user_profiles')
        .select('name, role_type, role_types, goals, tone, life_context, boundaries, preferences_unlocked_at')
        .eq('user_id', userId)
        .maybeSingle(),

      // Onboarding data (initial setup answers)
      supabase
        .from('onboarding_data')
        .select('name, life_seasons, mental_focus, depth_question, depth_answer, seeded_people')
        .eq('user_id', userId)
        .maybeSingle(),

      // Key People (user explicitly added - highest priority)
      supabase
        .from('user_key_people')
        .select('id, name, relationship, added_via, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Entities (extracted from notes via Mem0)
      supabase
        .from('user_entities')
        .select('name, entity_type, memory_type, relationship, context_notes, mention_count, sentiment_average, importance, importance_score, is_historical, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('importance_score', { ascending: false })
        .order('mention_count', { ascending: false })
        .limit(20),

      // Patterns (detected behavioral patterns)
      supabase
        .from('user_patterns')
        .select('id, pattern_type, short_description, long_description, confidence, status, created_at')
        .eq('user_id', userId)
        .gte('confidence', 0.5)
        .order('confidence', { ascending: false })
        .limit(10),

      // Category summaries (AI-generated knowledge)
      supabase
        .from('category_summaries')
        .select('category, summary, entity_count, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),

      // Note count (content is E2E encrypted)
      supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null)
    ]);

    // Log any errors but don't fail
    if (profileRes.error) console.warn('[UserContext] Profile error:', profileRes.error.message);
    if (onboardingRes.error) console.warn('[UserContext] Onboarding error:', onboardingRes.error.message);
    if (keyPeopleRes.error) console.warn('[UserContext] KeyPeople error:', keyPeopleRes.error.message);
    if (entitiesRes.error) console.warn('[UserContext] Entities error:', entitiesRes.error.message);
    if (patternsRes.error) console.warn('[UserContext] Patterns error:', patternsRes.error.message);
    if (summariesRes.error) console.warn('[UserContext] Summaries error:', summariesRes.error.message);

    const context = {
      // Raw data
      profile: profileRes.data || null,
      onboarding: onboardingRes.data || null,
      keyPeople: keyPeopleRes.data || [],
      entities: entitiesRes.data || [],
      patterns: patternsRes.data || [],
      summaries: summariesRes.data || [],
      noteCount: noteCountRes.count || 0,

      // Computed/merged fields for convenience
      userName: onboardingRes.data?.name || profileRes.data?.name || 'there',

      // Life context (prefer profile's editable version, fallback to onboarding)
      lifeSeasons: onboardingRes.data?.life_seasons || [],
      mentalFocus: onboardingRes.data?.mental_focus || [],
      depthQuestion: onboardingRes.data?.depth_question || null,
      depthAnswer: onboardingRes.data?.depth_answer || null,

      // Profile preferences (editable in TWIN tab)
      roleTypes: profileRes.data?.role_types || (profileRes.data?.role_type ? [profileRes.data.role_type] : []),
      goals: profileRes.data?.goals || [],
      tone: profileRes.data?.tone || null,
      lifeContext: profileRes.data?.life_context || null,
      boundaries: profileRes.data?.boundaries || [],

      // Seeded people from onboarding
      seededPeople: onboardingRes.data?.seeded_people || [],

      // Flags
      hasContext: !!(
        (noteCountRes.count > 0) ||
        (keyPeopleRes.data?.length > 0) ||
        (entitiesRes.data?.length > 0) ||
        onboardingRes.data ||
        profileRes.data
      )
    };

    console.log('[UserContext] Context loaded:', {
      userName: context.userName,
      noteCount: context.noteCount,
      keyPeopleCount: context.keyPeople.length,
      entitiesCount: context.entities.length,
      patternsCount: context.patterns.length,
      summariesCount: context.summaries.length,
      hasLifeContext: !!context.lifeContext,
      hasGoals: context.goals.length > 0,
      hasTone: !!context.tone
    });

    return context;

  } catch (err) {
    console.error('[UserContext] Error fetching context:', err);
    return getEmptyContext();
  }
}

/**
 * Get empty context structure (for error cases)
 */
function getEmptyContext() {
  return {
    profile: null,
    onboarding: null,
    keyPeople: [],
    entities: [],
    patterns: [],
    summaries: [],
    noteCount: 0,
    userName: 'there',
    lifeSeasons: [],
    mentalFocus: [],
    depthQuestion: null,
    depthAnswer: null,
    roleTypes: [],
    goals: [],
    tone: null,
    lifeContext: null,
    boundaries: [],
    seededPeople: [],
    hasContext: false
  };
}

/**
 * Format role types for display
 * @param {string[]} roleTypes - Array of role type values
 * @returns {string} Formatted string
 */
function formatRoleTypes(roleTypes) {
  if (!roleTypes || roleTypes.length === 0) return null;

  const labels = {
    'BUILDING': 'building something new',
    'LEADING': 'leading others',
    'MAKING': 'deep in the work',
    'LEARNING': 'learning and exploring',
    'JUGGLING': 'juggling multiple things',
    'TRANSITIONING': 'between chapters'
  };

  return roleTypes.map(r => labels[r] || r.toLowerCase()).join(', ');
}

/**
 * Format goals for display
 * @param {string[]} goals - Array of goal values
 * @returns {string} Formatted string
 */
function formatGoals(goals) {
  if (!goals || goals.length === 0) return null;

  const labels = {
    'DECISIONS': 'think through decisions',
    'PROCESS': 'process what happened',
    'ORGANIZE': 'stay on top of things',
    'SELF_UNDERSTANDING': 'understand yourself better',
    'REMEMBER': 'remember what matters',
    'EXPLORING': 'explore'
  };

  return goals.map(g => labels[g] || g.toLowerCase()).join(', ');
}

/**
 * Format tone preference for display
 * @param {string} tone - Tone value
 * @returns {string} Formatted string
 */
function formatTone(tone) {
  if (!tone) return null;

  const labels = {
    'DIRECT': 'direct and efficient',
    'WARM': 'warm and supportive',
    'CHALLENGING': 'challenging',
    'ADAPTIVE': 'adaptive to your energy'
  };

  return labels[tone] || tone.toLowerCase();
}

/**
 * Build a formatted context block for AI prompts
 * @param {Object} context - Full user context from getUserFullContext
 * @returns {string} Formatted context block for system prompt
 */
function buildContextBlock(context) {
  const parts = [];

  // Basic info
  parts.push(`User's name: ${context.userName}`);

  // Role types (how they describe their days)
  const roleTypesStr = formatRoleTypes(context.roleTypes);
  if (roleTypesStr) {
    parts.push(`How they describe their days: ${roleTypesStr}`);
  }

  // Goals (why they're here)
  const goalsStr = formatGoals(context.goals);
  if (goalsStr) {
    parts.push(`They're here to: ${goalsStr}`);
  }

  // Tone preference
  const toneStr = formatTone(context.tone);
  if (toneStr) {
    parts.push(`Preferred tone: ${toneStr}`);
  }

  // Life context (what's on their plate)
  if (context.lifeContext) {
    parts.push(`What's on their plate: ${context.lifeContext}`);
  }

  // Life seasons
  if (context.lifeSeasons?.length > 0) {
    parts.push(`Life season: ${context.lifeSeasons.join(', ')}`);
  }

  // Mental focus
  if (context.mentalFocus?.length > 0) {
    parts.push(`Currently focused on: ${context.mentalFocus.join(', ')}`);
  }

  // Depth question/answer (important context from onboarding)
  if (context.depthQuestion && context.depthAnswer) {
    parts.push(`When asked "${context.depthQuestion}", they said: "${context.depthAnswer}"`);
  }

  // Boundaries (topics to avoid)
  if (context.boundaries?.length > 0) {
    parts.push(`Topics to avoid: ${context.boundaries.join(', ')}`);
  }

  // Key People (highest priority - user explicitly added)
  if (context.keyPeople?.length > 0) {
    parts.push('');
    parts.push('KEY PEOPLE (user explicitly told you about these):');
    context.keyPeople.forEach(p => {
      parts.push(`- ${p.name}: ${p.relationship || 'important person'}`);
    });
  }

  // Seeded people from onboarding
  if (context.seededPeople?.length > 0) {
    const seededNotInKey = context.seededPeople.filter(sp =>
      !context.keyPeople.some(kp => kp.name.toLowerCase() === sp.name?.toLowerCase())
    );
    if (seededNotInKey.length > 0) {
      parts.push('');
      parts.push('People mentioned during onboarding:');
      seededNotInKey.forEach(p => {
        parts.push(`- ${p.name}: ${p.context || p.relationship || 'known person'}`);
      });
    }
  }

  // Category summaries (what we've learned)
  if (context.summaries?.length > 0) {
    parts.push('');
    parts.push('What you know about them:');
    context.summaries.forEach(s => {
      parts.push(`- ${s.category.replace('_', ' ')}: ${s.summary}`);
    });
  }

  // Entities (from their notes)
  const nonPersonEntities = context.entities?.filter(e =>
    e.entity_type !== 'person' ||
    !context.keyPeople.some(kp => kp.name.toLowerCase() === e.name?.toLowerCase())
  ).slice(0, 10);

  if (nonPersonEntities?.length > 0) {
    parts.push('');
    parts.push('Other people and topics from their notes:');
    nonPersonEntities.forEach(e => {
      const rel = e.relationship ? ` (${e.relationship})` : '';
      const mentions = e.mention_count > 1 ? `, mentioned ${e.mention_count}x` : '';
      parts.push(`- ${e.name} [${e.entity_type}${rel}${mentions}]`);
    });
  }

  // Patterns
  if (context.patterns?.length > 0) {
    parts.push('');
    parts.push('Patterns observed:');
    context.patterns.forEach(p => {
      parts.push(`- ${p.short_description} (${Math.round(p.confidence * 100)}% confidence)`);
    });
  }

  // Note activity
  parts.push('');
  parts.push(`Note activity: ${context.noteCount} notes recorded`);

  return parts.join('\n');
}

// Export for use in other API files
module.exports = {
  getUserFullContext,
  getEmptyContext,
  formatRoleTypes,
  formatGoals,
  formatTone,
  buildContextBlock
};
