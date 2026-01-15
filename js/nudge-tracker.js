/**
 * Nudge Tracker - Learn which nudge types work best for this user
 * Phase 8: Nudge Effectiveness Tracking
 */

window.NudgeTracker = {
  // Known nudge types
  NUDGE_TYPES: ['commitment', 'reminder', 'question', 'motivation', 'deadline'],

  /**
   * Track that a nudge was shown
   * @param {string} nudgeType - Type of nudge shown
   */
  async trackShown(nudgeType) {
    if (!nudgeType) return;
    await this.incrementStat(nudgeType, 'shown_count');
  },

  /**
   * Track that a nudge was clicked/interacted with
   * @param {string} nudgeType - Type of nudge clicked
   */
  async trackClicked(nudgeType) {
    if (!nudgeType) return;
    await this.incrementStat(nudgeType, 'clicked_count');
  },

  /**
   * Track that an action with this nudge type was completed
   * @param {string} nudgeType - Type of nudge on completed action
   */
  async trackCompleted(nudgeType) {
    if (!nudgeType) return;
    await this.incrementStat(nudgeType, 'completed_count');
    await this.recalculateScore(nudgeType);
  },

  /**
   * Increment a stat for a nudge type
   * @param {string} nudgeType - Type of nudge
   * @param {string} field - Field to increment
   */
  async incrementStat(nudgeType, field) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return;

      const userId = await this.getUserId();
      if (!userId) return;

      // Try to get existing record
      const { data: existing, error: fetchError } = await Sync.supabase
        .from('nudge_effectiveness')
        .select('*')
        .eq('user_id', userId)
        .eq('nudge_type', nudgeType)
        .maybeSingle();

      if (fetchError) {
        // Table might not exist yet - silently fail
        console.warn('[NudgeTracker] Could not fetch nudge stats:', fetchError.message);
        return;
      }

      if (existing) {
        // Update existing record
        await Sync.supabase
          .from('nudge_effectiveness')
          .update({
            [field]: (existing[field] || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert new record
        await Sync.supabase
          .from('nudge_effectiveness')
          .insert({
            user_id: userId,
            nudge_type: nudgeType,
            [field]: 1,
            shown_count: field === 'shown_count' ? 1 : 0,
            clicked_count: field === 'clicked_count' ? 1 : 0,
            completed_count: field === 'completed_count' ? 1 : 0
          });
      }

      console.log(`[NudgeTracker] Incremented ${field} for ${nudgeType}`);

    } catch (error) {
      console.warn('[NudgeTracker] incrementStat error:', error.message);
    }
  },

  /**
   * Recalculate effectiveness score for a nudge type
   * @param {string} nudgeType - Type of nudge to recalculate
   */
  async recalculateScore(nudgeType) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return;

      const userId = await this.getUserId();
      if (!userId) return;

      const { data, error } = await Sync.supabase
        .from('nudge_effectiveness')
        .select('*')
        .eq('user_id', userId)
        .eq('nudge_type', nudgeType)
        .maybeSingle();

      if (error || !data) return;

      if (data.shown_count > 0) {
        const score = data.completed_count / data.shown_count;

        await Sync.supabase
          .from('nudge_effectiveness')
          .update({ effectiveness_score: score })
          .eq('id', data.id);

        console.log(`[NudgeTracker] Recalculated score for ${nudgeType}: ${score.toFixed(2)}`);
      }

    } catch (error) {
      console.warn('[NudgeTracker] recalculateScore error:', error.message);
    }
  },

  /**
   * Get the best performing nudge type for this user
   * @returns {string|null} Best nudge type or null
   */
  async getBestNudgeType() {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return null;

      const userId = await this.getUserId();
      if (!userId) return null;

      const { data, error } = await Sync.supabase
        .from('nudge_effectiveness')
        .select('nudge_type, effectiveness_score')
        .eq('user_id', userId)
        .gt('shown_count', 2) // Need at least 3 samples
        .order('effectiveness_score', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;

      return data[0].nudge_type;

    } catch (error) {
      console.warn('[NudgeTracker] getBestNudgeType error:', error.message);
      return null;
    }
  },

  /**
   * Get full nudge preferences for this user
   * @returns {Object} Preferences object with best, worst, and stats
   */
  async getNudgePreferences() {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return {};

      const userId = await this.getUserId();
      if (!userId) return {};

      const { data, error } = await Sync.supabase
        .from('nudge_effectiveness')
        .select('*')
        .eq('user_id', userId);

      if (error || !data || data.length === 0) return {};

      // Sort by effectiveness score
      const sorted = data
        .filter(d => d.shown_count > 0)
        .sort((a, b) => b.effectiveness_score - a.effectiveness_score);

      if (sorted.length === 0) return {};

      return {
        best: sorted[0]?.nudge_type || null,
        worst: sorted[sorted.length - 1]?.nudge_type || null,
        stats: data.reduce((acc, d) => {
          acc[d.nudge_type] = {
            shown: d.shown_count || 0,
            clicked: d.clicked_count || 0,
            completed: d.completed_count || 0,
            score: d.effectiveness_score || 0
          };
          return acc;
        }, {})
      };

    } catch (error) {
      console.warn('[NudgeTracker] getNudgePreferences error:', error.message);
      return {};
    }
  },

  /**
   * Get current user ID
   */
  async getUserId() {
    if (typeof Sync === 'undefined' || !Sync.supabase) return null;
    const { data: { user } } = await Sync.supabase.auth.getUser();
    return user?.id || null;
  },

  /**
   * Initialize the nudge tracker
   */
  init() {
    console.log('[NudgeTracker] Initialized');
  }
};
