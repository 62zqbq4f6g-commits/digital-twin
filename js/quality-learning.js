/**
 * Quality Learning System
 * Tracks user feedback and improves output quality over time
 */

const QualityLearning = {
  STORE_NAME: 'quality_learning',

  /**
   * Get or create learning profile for current user
   */
  async getProfile() {
    try {
      const profile = await DB.get(this.STORE_NAME, 'profile');
      if (profile) return profile;

      // Create default profile
      const defaultProfile = {
        id: 'profile',
        examples: {
          liked: [],
          disliked: []
        },
        preferences: {
          likes: {},
          dislikes: {}
        },
        metrics: {
          total_outputs: 0,
          total_feedback: 0,
          positive_count: 0,
          positive_rate: 0,
          trend: 'new',
          history: []
        },
        updated_at: new Date().toISOString()
      };

      await DB.save(this.STORE_NAME, defaultProfile);
      return defaultProfile;
    } catch (error) {
      console.error('[QualityLearning] Failed to get profile:', error);
      return this.getDefaultProfile();
    }
  },

  /**
   * Get default profile structure
   */
  getDefaultProfile() {
    return {
      id: 'profile',
      examples: { liked: [], disliked: [] },
      preferences: { likes: {}, dislikes: {} },
      metrics: {
        total_outputs: 0,
        total_feedback: 0,
        positive_count: 0,
        positive_rate: 0,
        trend: 'new',
        history: []
      }
    };
  },

  /**
   * Record that an output was generated
   */
  async recordOutput() {
    try {
      const profile = await this.getProfile();
      profile.metrics.total_outputs++;
      profile.updated_at = new Date().toISOString();
      await DB.save(this.STORE_NAME, profile);
    } catch (error) {
      console.error('[QualityLearning] Failed to record output:', error);
    }
  },

  /**
   * Store feedback example and update preferences
   * @param {Object} note - The note object
   * @param {string} rating - 'liked' or 'disliked'
   * @param {string} reason - Classified reason code
   * @param {string} comment - User's optional comment
   */
  async storeFeedback(note, rating, reason, comment = null) {
    try {
      const profile = await this.getProfile();

      // Create example object
      const example = {
        id: `ex_${Date.now()}`,
        input: (note.input?.raw_content || note.input?.raw_text || '').substring(0, 300),
        output: {
          summary: note.analysis?.summary || '',
          insight: note.analysis?.insight || '',
          question: note.analysis?.question || null
        },
        reason: reason,
        comment: comment,
        note_type: note.analysis?.type || 'observation',
        feedback_at: new Date().toISOString()
      };

      // Add to appropriate pool
      if (rating === 'liked') {
        profile.examples.liked.push(example);
        // Keep only last 15 liked examples
        if (profile.examples.liked.length > 15) {
          profile.examples.liked = profile.examples.liked.slice(-15);
        }
        // Increment preference weight
        profile.preferences.likes[reason] = (profile.preferences.likes[reason] || 0) + 1;
        profile.metrics.positive_count++;
      } else {
        profile.examples.disliked.push(example);
        // Keep only last 10 disliked examples
        if (profile.examples.disliked.length > 10) {
          profile.examples.disliked = profile.examples.disliked.slice(-10);
        }
        // Increment dislike weight
        profile.preferences.dislikes[reason] = (profile.preferences.dislikes[reason] || 0) + 1;
      }

      // Update metrics
      profile.metrics.total_feedback++;
      profile.metrics.positive_rate = profile.metrics.total_feedback > 0
        ? Math.round((profile.metrics.positive_count / profile.metrics.total_feedback) * 100)
        : 0;

      // Calculate trend
      profile.metrics.trend = this.calculateTrend(profile);

      // Update weekly history
      this.updateHistory(profile);

      profile.updated_at = new Date().toISOString();
      await DB.save(this.STORE_NAME, profile);

      // Sync to cloud if available
      await this.syncToCloud(profile);

      return profile;
    } catch (error) {
      console.error('[QualityLearning] Failed to store feedback:', error);
      throw error;
    }
  },

  /**
   * Calculate trend based on recent feedback
   */
  calculateTrend(profile) {
    const history = profile.metrics.history || [];
    if (history.length < 2) return 'new';

    const recent = history.slice(-3);
    if (recent.length < 2) return 'stable';

    const oldRate = recent[0].positive_rate;
    const newRate = recent[recent.length - 1].positive_rate;

    if (newRate > oldRate + 5) return 'improving';
    if (newRate < oldRate - 5) return 'declining';
    return 'stable';
  },

  /**
   * Update weekly history
   */
  updateHistory(profile) {
    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${this.getWeekNumber(now)}`;

    const history = profile.metrics.history || [];
    const existingWeek = history.find(h => h.week === weekKey);

    if (existingWeek) {
      existingWeek.positive_rate = profile.metrics.positive_rate;
      existingWeek.feedback_count = profile.metrics.total_feedback;
    } else {
      history.push({
        week: weekKey,
        positive_rate: profile.metrics.positive_rate,
        feedback_count: profile.metrics.total_feedback
      });
      // Keep only last 12 weeks
      if (history.length > 12) {
        history.shift();
      }
    }

    profile.metrics.history = history;
  },

  /**
   * Get week number
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  /**
   * Get top preferences for prompt building
   */
  async getPreferencesForPrompt() {
    const profile = await this.getProfile();

    // Get top 3 likes
    const topLikes = Object.entries(profile.preferences.likes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pref]) => pref);

    // Get top 3 dislikes
    const topDislikes = Object.entries(profile.preferences.dislikes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pref]) => pref);

    return { topLikes, topDislikes };
  },

  /**
   * Get dynamic examples for prompt
   */
  async getDynamicExamples() {
    const profile = await this.getProfile();

    // Get most recent liked examples (up to 3)
    const likedExamples = (profile.examples.liked || []).slice(-3);

    // Get most recent disliked examples (up to 2)
    const dislikedExamples = (profile.examples.disliked || []).slice(-2);

    return { likedExamples, dislikedExamples };
  },

  /**
   * Get quality score and stats for UI
   */
  async getQualityStats() {
    const profile = await this.getProfile();

    return {
      positiveRate: profile.metrics.positive_rate || 0,
      totalFeedback: profile.metrics.total_feedback || 0,
      totalOutputs: profile.metrics.total_outputs || 0,
      trend: profile.metrics.trend || 'new',
      likedCount: (profile.examples.liked || []).length,
      dislikedCount: (profile.examples.disliked || []).length,
      topPreferences: await this.getPreferencesForPrompt(),
      history: profile.metrics.history || []
    };
  },

  /**
   * Sync profile to Supabase cloud
   */
  async syncToCloud(profile) {
    if (typeof Sync === 'undefined' || !Sync.isAuthenticated) return;

    try {
      const { supabase } = Sync;
      if (!supabase) return;

      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      await supabase.from('quality_learning').upsert({
        user_id: user.data.user.id,
        liked_examples: profile.examples.liked,
        disliked_examples: profile.examples.disliked,
        preference_likes: profile.preferences.likes,
        preference_dislikes: profile.preferences.dislikes,
        total_outputs: profile.metrics.total_outputs,
        total_feedback: profile.metrics.total_feedback,
        positive_count: profile.metrics.positive_count,
        metrics_history: profile.metrics.history,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('[QualityLearning] Cloud sync failed:', error.message);
    }
  },

  /**
   * Pull profile from cloud
   */
  async pullFromCloud() {
    if (typeof Sync === 'undefined' || !Sync.isAuthenticated) return null;

    try {
      const { supabase } = Sync;
      if (!supabase) return null;

      const user = await supabase.auth.getUser();
      if (!user.data.user) return null;

      const { data, error } = await supabase
        .from('quality_learning')
        .select('*')
        .eq('user_id', user.data.user.id)
        .maybeSingle();

      if (error || !data) return null;

      // Convert to local format
      const profile = {
        id: 'profile',
        examples: {
          liked: data.liked_examples || [],
          disliked: data.disliked_examples || []
        },
        preferences: {
          likes: data.preference_likes || {},
          dislikes: data.preference_dislikes || {}
        },
        metrics: {
          total_outputs: data.total_outputs || 0,
          total_feedback: data.total_feedback || 0,
          positive_count: data.positive_count || 0,
          positive_rate: data.total_feedback > 0
            ? Math.round((data.positive_count / data.total_feedback) * 100)
            : 0,
          trend: 'stable',
          history: data.metrics_history || []
        },
        updated_at: data.updated_at
      };

      await DB.save(this.STORE_NAME, profile);
      return profile;
    } catch (error) {
      console.warn('[QualityLearning] Cloud pull failed:', error.message);
      return null;
    }
  },

  // ============================================================
  // Phase 7: Preference Aggregation for Prompt Injection
  // ============================================================

  /**
   * Phase 7: Get user preferences formatted as XML for prompt injection
   * @returns {string} XML-formatted preferences block
   */
  async getPreferencesXML() {
    const profile = await this.getProfile();

    // Derive preferences from feedback patterns
    const preferences = this.derivePreferences(profile);

    if (!preferences.length && !preferences.tone && !preferences.format) {
      return ''; // No preferences to inject
    }

    let xml = '<user_preferences>\n';

    if (preferences.length) {
      xml += `  <preferred_length>${preferences.length}</preferred_length>\n`;
    }
    if (preferences.tone) {
      xml += `  <tone>${preferences.tone}</tone>\n`;
    }
    if (preferences.format) {
      xml += `  <format>${preferences.format}</format>\n`;
    }
    if (preferences.avoid && preferences.avoid.length > 0) {
      xml += `  <avoid>${preferences.avoid.join(', ')}</avoid>\n`;
    }

    xml += '</user_preferences>';

    console.log('[QualityLearning] Generated preferences XML');
    return xml;
  },

  /**
   * Phase 7: Derive user preferences from feedback patterns
   * @param {Object} profile - User's quality learning profile
   * @returns {Object} Derived preferences
   */
  derivePreferences(profile) {
    const prefs = {};
    const likes = profile.preferences.likes || {};
    const dislikes = profile.preferences.dislikes || {};

    // Derive length preference
    if (dislikes['too_verbose'] > 2 || dislikes['too_long'] > 2) {
      prefs.length = 'concise, under 50 words';
    } else if (likes['detailed'] > 2) {
      prefs.length = 'detailed explanations welcome';
    }

    // Derive tone preference
    if (dislikes['too_emotional'] > 1 || dislikes['tone_added'] > 1) {
      prefs.tone = 'direct, no emotional language';
    } else if (likes['supportive'] > 2) {
      prefs.tone = 'warm and supportive';
    }

    // Derive format preference
    if (likes['bullet_points'] > 2) {
      prefs.format = 'bullet points preferred';
    }

    // Build avoid list
    prefs.avoid = [];
    if (dislikes['too_generic'] > 2) prefs.avoid.push('generic observations');
    if (dislikes['obvious_observation'] > 2) prefs.avoid.push('obvious statements');
    if (dislikes['vague_question'] > 2) prefs.avoid.push('vague questions');

    return prefs;
  },

  /**
   * Phase 7: Get good examples formatted as XML for prompt injection
   * @param {string} noteType - Filter by note type (optional)
   * @param {number} limit - Maximum examples to return
   * @returns {string} XML-formatted good examples block
   */
  async getGoodExamplesXML(noteType = null, limit = 3) {
    const profile = await this.getProfile();
    let examples = profile.examples.liked || [];

    // Filter by note type if specified
    if (noteType) {
      examples = examples.filter(e => e.note_type === noteType);
    }

    // Get most recent examples
    examples = examples.slice(-limit);

    if (examples.length === 0) {
      return ''; // No examples to inject
    }

    let xml = '<good_examples>\n';
    xml += '<!-- The user liked these outputs. Use them as style guidance. -->\n';

    for (const ex of examples) {
      const reason = this.reasonToDescription(ex.reason, 'liked');
      xml += `  <example type="${ex.note_type || 'general'}">\n`;
      if (ex.output.summary) {
        xml += `    <summary>User liked: "${ex.output.summary}"</summary>\n`;
      }
      if (ex.output.insight) {
        xml += `    <insight>User liked: "${ex.output.insight}"</insight>\n`;
      }
      if (reason) {
        xml += `    <why>${reason}</why>\n`;
      }
      xml += `  </example>\n`;
    }

    xml += '</good_examples>';

    console.log(`[QualityLearning] Generated ${examples.length} good examples XML`);
    return xml;
  },

  /**
   * Phase 7: Get bad examples formatted as XML for prompt injection
   * @param {string} noteType - Filter by note type (optional)
   * @param {number} limit - Maximum examples to return
   * @returns {string} XML-formatted bad examples block
   */
  async getBadExamplesXML(noteType = null, limit = 2) {
    const profile = await this.getProfile();
    let examples = profile.examples.disliked || [];

    // Filter by note type if specified
    if (noteType) {
      examples = examples.filter(e => e.note_type === noteType);
    }

    // Get most recent examples
    examples = examples.slice(-limit);

    if (examples.length === 0) {
      return ''; // No examples to inject
    }

    let xml = '<bad_examples>\n';
    xml += '<!-- The user disliked these outputs. AVOID this style. -->\n';

    for (const ex of examples) {
      const reason = this.reasonToDescription(ex.reason, 'disliked');
      xml += `  <example type="${ex.note_type || 'general'}">\n`;
      if (ex.output.summary) {
        xml += `    <summary>User disliked: "${ex.output.summary}"</summary>\n`;
      }
      if (ex.output.insight) {
        xml += `    <insight>User disliked: "${ex.output.insight}"</insight>\n`;
      }
      if (reason) {
        xml += `    <why>${reason}</why>\n`;
      }
      xml += `  </example>\n`;
    }

    xml += '</bad_examples>';

    console.log(`[QualityLearning] Generated ${examples.length} bad examples XML`);
    return xml;
  },

  /**
   * Phase 7: Convert reason code to human-readable description
   * @param {string} reason - Reason code
   * @param {string} type - 'liked' or 'disliked'
   * @returns {string} Human-readable description
   */
  reasonToDescription(reason, type) {
    const descriptions = {
      // Liked reasons
      'specific_question': 'It asked a specific, thought-provoking question',
      'pattern_connection': 'It connected patterns the user hadn\'t noticed',
      'tension_surfacing': 'It surfaced a tension or tradeoff',
      'non_obvious_insight': 'The insight was non-obvious and valuable',
      'actionable': 'It was actionable and practical',
      // Disliked reasons
      'too_generic': 'It was too generic and obvious',
      'obvious_observation': 'It stated the obvious',
      'vague_question': 'The question was too vague',
      'too_verbose': 'It was too long and wordy',
      'too_emotional': 'It was overly emotional or fluffy'
    };
    return descriptions[reason] || '';
  },

  /**
   * Phase 7: Get complete preferences context for API
   * Returns all preference data formatted for prompt injection
   * @param {string} noteType - Optional note type filter
   * @returns {Object} Complete preferences context
   */
  async getPreferencesContext(noteType = null) {
    const [preferencesXML, goodExamplesXML, badExamplesXML, stats] = await Promise.all([
      this.getPreferencesXML(),
      this.getGoodExamplesXML(noteType),
      this.getBadExamplesXML(noteType),
      this.getQualityStats()
    ]);

    const hasPreferences = preferencesXML || goodExamplesXML || badExamplesXML;

    return {
      hasPreferences,
      preferencesXML,
      goodExamplesXML,
      badExamplesXML,
      stats,
      // Combined XML for easy injection
      combinedXML: hasPreferences
        ? [preferencesXML, goodExamplesXML, badExamplesXML].filter(Boolean).join('\n\n')
        : ''
    };
  },

  /**
   * Phase 7: Check if user has enough feedback to personalize
   * @returns {boolean} True if personalization is possible
   */
  async hasPersonalizationData() {
    const stats = await this.getQualityStats();
    // Need at least 3 feedback signals to start personalizing
    return stats.totalFeedback >= 3;
  }
};

// Make globally available
window.QualityLearning = QualityLearning;
