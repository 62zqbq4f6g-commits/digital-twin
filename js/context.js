/**
 * Phase 9: Context Injection System
 * Builds user context for analysis prompts
 * Context depth scales with note count
 */

window.Context = {
  /**
   * Build user context string for analysis prompts
   * @param {string} userId - Supabase user ID
   * @returns {Promise<string>} Context string to prepend to prompts
   */
  async buildUserContext(userId) {
    if (!Sync.supabase || !userId) {
      return '';
    }

    try {
      // Fetch all relevant data in parallel
      const [profileResult, learningResult, keyPeopleResult, feedbackResult] = await Promise.all([
        Sync.supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
        Sync.supabase.from('user_learning_profile').select('*').eq('user_id', userId).single(),
        Sync.supabase.from('user_key_people').select('*').eq('user_id', userId),
        Sync.supabase.from('user_feedback').select('insight_type, feedback_type').eq('user_id', userId)
      ]);

      // Phase 10: Use relevance-scored entities if available
      let entities = [];
      if (typeof EntityMemory !== 'undefined' && EntityMemory.getEntitiesWithRelevance) {
        entities = await EntityMemory.getEntitiesWithRelevance(userId, Sync.supabase, 15);
        console.log('[Context] Using relevance-scored entities:', entities.length);
      } else {
        // Fallback to direct query
        const entitiesResult = await Sync.supabase
          .from('user_entities')
          .select('*')
          .eq('user_id', userId)
          .eq('dismissed', false)
          .order('mention_count', { ascending: false })
          .limit(15);
        entities = entitiesResult.data || [];
      }

      const profile = profileResult.data;
      const learning = learningResult.data;
      const keyPeople = keyPeopleResult.data || [];
      const feedback = feedbackResult.data || [];

      if (!profile) {
        console.log('[Context] No profile found');
        return '';
      }

      const noteCount = learning?.total_notes || 0;
      const contextLevel = this.getContextLevel(noteCount);

      console.log('[Context] Building context - level:', contextLevel, 'notes:', noteCount);

      // Build context string based on level
      let context = this.buildMinimalContext(profile);

      if (contextLevel !== 'MINIMAL') {
        context += this.buildBasicContext(profile, keyPeople);
      }

      if (contextLevel === 'GROWING' || contextLevel === 'FULL') {
        context += this.buildGrowingContext(entities, feedback);
      }

      if (contextLevel === 'FULL') {
        context += this.buildFullContext(learning);
      }

      // Add tone guidance
      if (profile.tone) {
        context += this.getToneGuidance(profile.tone);
      }

      return context;

    } catch (err) {
      console.warn('[Context] Failed to build context:', err.message);
      return '';
    }
  },

  /**
   * Determine context level based on note count
   */
  getContextLevel(noteCount) {
    if (noteCount <= 1) return 'MINIMAL';
    if (noteCount <= 5) return 'BASIC';
    if (noteCount <= 10) return 'GROWING';
    return 'FULL';
  },

  /**
   * Build minimal context (Note #1)
   */
  buildMinimalContext(profile) {
    if (!profile) return '';

    return `
USER CONTEXT:
- Name: ${profile.name}
- Mode: ${this.formatRoleType(profile.role_types || profile.role_type)}
- Here to: ${this.formatGoals(profile.goals)}
- Tone: ${profile.tone ? this.formatTone(profile.tone) : 'balanced (not specified)'}
`;
  },

  /**
   * Build basic context (Notes 2-5)
   */
  buildBasicContext(profile, keyPeople) {
    let context = '';

    if (profile.life_context) {
      context += `
CURRENT SITUATION:
${profile.life_context}
`;
    }

    if (keyPeople && keyPeople.length > 0) {
      context += `
KEY PEOPLE IN THEIR LIFE:
${keyPeople.map(p => `- ${p.name}: ${p.relationship}`).join('\n')}
`;
    }

    if (profile.boundaries && profile.boundaries.length > 0) {
      context += `
TOPICS TO AVOID (don't probe unless they bring up):
${profile.boundaries.join(', ')}
`;
    }

    return context;
  },

  /**
   * Build growing context (Notes 6-10)
   */
  buildGrowingContext(entities, feedback) {
    let context = '';

    // Top confirmed entities
    const confirmedEntities = entities.filter(e => e.confirmed || e.relationship);
    if (confirmedEntities.length > 0) {
      context += `
PEOPLE/THINGS THEY MENTION:
${confirmedEntities.slice(0, 8).map(e =>
  `- ${e.name} (${e.entity_type}): ${e.relationship || 'relationship unknown'}, mentioned ${e.mention_count}x`
).join('\n')}
`;
    }

    // Feedback patterns
    const approved = feedback.filter(f => f.feedback_type === 'approve');
    const rejected = feedback.filter(f => f.feedback_type === 'reject');

    if (approved.length > 0 || rejected.length > 0) {
      const approvedTypes = this.countInsightTypes(approved);
      const rejectedTypes = this.countInsightTypes(rejected);

      context += `
WHAT RESONATES WITH THEM:
${Object.entries(approvedTypes).slice(0, 3).map(([type, count]) => `- ${type}: ${count} approvals`).join('\n') || '- Still learning'}

WHAT DOESN'T LAND:
${Object.entries(rejectedTypes).slice(0, 3).map(([type, count]) => `- ${type}: ${count} rejections`).join('\n') || '- No rejections yet'}
`;
    }

    return context;
  },

  /**
   * Build full context (Notes 10+)
   */
  buildFullContext(learning) {
    if (!learning) return '';

    let context = '';

    // Vocabulary
    if (learning.common_phrases && learning.common_phrases.length > 0) {
      context += `
THEIR VOCABULARY:
- Style: ${learning.vocabulary_style || 'casual'}
- Phrases they use: ${learning.common_phrases.slice(0, 5).join(', ')}
`;
    }

    // Temporal patterns
    if (learning.temporal_patterns && Object.keys(learning.temporal_patterns).length > 0) {
      context += `
PATTERNS NOTICED:
${Object.entries(learning.temporal_patterns).map(([pattern, confidence]) =>
  `- ${pattern} (confidence: ${Math.round(confidence * 100)}%)`
).join('\n')}
`;
    }

    // Recurring themes
    if (learning.recurring_themes && Object.keys(learning.recurring_themes).length > 0) {
      context += `
RECURRING THEMES:
${Object.entries(learning.recurring_themes).map(([theme, data]) =>
  `- ${theme}: mentioned ${data.count || 0}x`
).join('\n')}
`;
    }

    // Action preferences
    if (learning.actions_completed > 0 || learning.actions_ignored > 0) {
      context += `
ACTION PATTERNS:
- Completed ${learning.actions_completed || 0} suggested actions
- Ignored ${learning.actions_ignored || 0} suggestions
${learning.action_types_completed?.length > 0 ? `- Types they act on: ${learning.action_types_completed.join(', ')}` : ''}
${learning.action_types_ignored?.length > 0 ? `- Types they skip: ${learning.action_types_ignored.join(', ')}` : ''}
`;
    }

    // Stats
    context += `
ENGAGEMENT:
- Total notes: ${learning.total_notes || 0}
- Feedback given: ${learning.total_approved || 0} approved, ${learning.total_rejected || 0} rejected
- Reflections: ${learning.total_reflections || 0}
`;

    return context;
  },

  /**
   * Get tone guidance for prompts
   */
  getToneGuidance(tone) {
    const guidance = {
      'DIRECT': `
TONE: Be direct and efficient. Get to the point. No fluff or excessive warmth.
- Short sentences
- Clear recommendations
- Skip pleasantries
`,
      'WARM': `
TONE: Be warm and supportive. Gentle encouragement.
- Acknowledge their feelings
- Use "you" frequently
- Soft language ("consider", "perhaps", "you might")
`,
      'CHALLENGING': `
TONE: Challenge them constructively. Push back. Ask hard questions.
- Question assumptions
- Don't accept surface explanations
- Be direct about contradictions
`,
      'ADAPTIVE': `
TONE: Match the energy of their note.
- If stressed, be calming
- If excited, share enthusiasm
- If analytical, be structured
`
    };

    return guidance[tone] || guidance['ADAPTIVE'];
  },

  /**
   * Record feedback for learning
   */
  async recordFeedback(noteId, feedbackType, userId, insightType) {
    if (!Sync.supabase || !userId) return;

    try {
      // Record individual feedback
      await Sync.supabase.from('user_feedback').insert({
        user_id: userId,
        note_id: noteId,
        feedback_type: feedbackType,
        insight_type: insightType || 'general'
      });

      // Update aggregated learning profile
      const { data: learning, error: fetchError } = await Sync.supabase
        .from('user_learning_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.warn('[Context] Error fetching learning profile:', fetchError.message);
        return;
      }

      // Create learning profile if it doesn't exist
      if (!learning) {
        await Sync.supabase.from('user_learning_profile').insert({
          user_id: userId,
          total_approved: feedbackType === 'approve' ? 1 : 0,
          total_rejected: feedbackType === 'reject' ? 1 : 0
        });
        return;
      }

      // Update counts
      const field = feedbackType === 'approve' ? 'approved_insight_types' : 'rejected_insight_types';
      const countField = feedbackType === 'approve' ? 'total_approved' : 'total_rejected';

      const currentTypes = learning[field] || {};
      if (insightType) {
        currentTypes[insightType] = (currentTypes[insightType] || 0) + 1;
      }

      await Sync.supabase
        .from('user_learning_profile')
        .update({
          [field]: currentTypes,
          [countField]: (learning[countField] || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log('[Context] Recorded feedback:', feedbackType, insightType);

    } catch (err) {
      console.error('[Context] Failed to record feedback:', err);
    }
  },

  /**
   * Increment note count in learning profile
   */
  async incrementNoteCount(userId) {
    if (!Sync.supabase || !userId) return;

    try {
      const { data: learning } = await Sync.supabase
        .from('user_learning_profile')
        .select('total_notes')
        .eq('user_id', userId)
        .single();

      if (learning) {
        await Sync.supabase
          .from('user_learning_profile')
          .update({
            total_notes: (learning.total_notes || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } else {
        await Sync.supabase.from('user_learning_profile').insert({
          user_id: userId,
          total_notes: 1
        });
      }

      console.log('[Context] Incremented note count');
    } catch (err) {
      console.warn('[Context] Failed to increment note count:', err);
    }
  },

  // Helper functions
  formatRoleType(roleType) {
    const descriptions = {
      'BUILDING': 'Building something (founder/creator mindset)',
      'LEADING': 'Leading others (manager/exec)',
      'MAKING': 'Deep in the work (specialist/maker)',
      'LEARNING': 'Learning & exploring',
      'JUGGLING': 'Juggling multiple things',
      'TRANSITIONING': 'Between chapters'
    };
    // Handle array of roles (multi-select)
    if (Array.isArray(roleType)) {
      if (roleType.length === 0) return 'Not specified';
      return roleType.map(r => descriptions[r] || r).join(', ');
    }
    // Handle single role (legacy)
    return descriptions[roleType] || roleType || 'Not specified';
  },

  formatGoals(goals) {
    if (!goals || goals.length === 0) return 'explore';
    const labels = {
      'DECISIONS': 'think through decisions',
      'PROCESS': 'process experiences',
      'ORGANIZE': 'stay organized',
      'SELF_UNDERSTANDING': 'understand themselves better',
      'REMEMBER': 'remember what matters',
      'EXPLORING': 'explore'
    };
    return goals.map(g => labels[g] || g).join(', ');
  },

  formatTone(tone) {
    const labels = {
      'DIRECT': 'direct and efficient',
      'WARM': 'warm and supportive',
      'CHALLENGING': 'challenging',
      'ADAPTIVE': 'adaptive'
    };
    return labels[tone] || tone || 'balanced';
  },

  countInsightTypes(feedbackArray) {
    return feedbackArray.reduce((acc, f) => {
      if (f.insight_type) {
        acc[f.insight_type] = (acc[f.insight_type] || 0) + 1;
      }
      return acc;
    }, {});
  }
};
