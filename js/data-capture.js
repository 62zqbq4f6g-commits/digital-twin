/**
 * INSCRIPT: Data Capture Module
 * Phase 18 - T4 Bug Fix Sprint
 *
 * Central module for capturing user data for personalization.
 * All data stored in user_settings table for MIRROR context.
 */

const DataCapture = {
  // ============================================
  // USAGE TRACKING
  // ============================================

  /**
   * Track feature usage
   * @param {string} feature - Feature name (e.g., 'create_note', 'mirror_chat')
   * @param {Object} metadata - Optional metadata
   */
  async trackFeatureUse(feature, metadata = {}) {
    if (!Sync?.supabase || !Sync?.user?.id) return;

    try {
      const currentCount = await this._getUsageCount(feature);
      const value = JSON.stringify({
        count: currentCount + 1,
        last_used: new Date().toISOString(),
        ...metadata
      });

      await Sync.supabase
        .from('user_settings')
        .upsert({
          user_id: Sync.user.id,
          setting_key: `usage_${feature}`,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,setting_key' });

      console.log('[DataCapture] Tracked feature:', feature);
    } catch (error) {
      console.warn('[DataCapture] Failed to track feature:', error);
    }
  },

  /**
   * Get current usage count for a feature
   * @private
   */
  async _getUsageCount(feature) {
    if (!Sync?.supabase || !Sync?.user?.id) return 0;

    try {
      const { data } = await Sync.supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', Sync.user.id)
        .eq('setting_key', `usage_${feature}`)
        .single();

      if (data?.setting_value) {
        const parsed = JSON.parse(data.setting_value);
        return parsed.count || 0;
      }
    } catch {
      // Ignore errors - return 0
    }
    return 0;
  },

  // ============================================
  // FEEDBACK SIGNALS
  // ============================================

  /**
   * Track feedback on AI responses
   * @param {string} messageId - Message ID
   * @param {string} feedback - 'positive', 'negative', 'copied', 'edited'
   * @param {Object} context - Optional context
   */
  async trackFeedback(messageId, feedback, context = {}) {
    if (!Sync?.supabase || !Sync?.user?.id) return;

    try {
      await Sync.supabase
        .from('user_settings')
        .insert({
          user_id: Sync.user.id,
          setting_key: `feedback_${messageId}_${Date.now()}`,
          setting_value: JSON.stringify({
            feedback,
            timestamp: new Date().toISOString(),
            ...context
          })
        });

      console.log('[DataCapture] Tracked feedback:', feedback, 'for message:', messageId);
    } catch (error) {
      console.warn('[DataCapture] Failed to track feedback:', error);
    }
  },

  // ============================================
  // PREFERENCES
  // ============================================

  /**
   * Save user preference
   * @param {string} key - Preference key
   * @param {*} value - Preference value
   */
  async savePreference(key, value) {
    if (!Sync?.supabase || !Sync?.user?.id) {
      // Fallback to localStorage
      localStorage.setItem(`dt_pref_${key}`, JSON.stringify(value));
      return true;
    }

    try {
      const { error } = await Sync.supabase
        .from('user_settings')
        .upsert({
          user_id: Sync.user.id,
          setting_key: `pref_${key}`,
          setting_value: typeof value === 'string' ? value : JSON.stringify(value),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,setting_key' });

      if (error) throw error;
      console.log('[DataCapture] Saved preference:', key);
      return true;
    } catch (error) {
      console.warn('[DataCapture] Failed to save preference:', error);
      // Fallback to localStorage
      localStorage.setItem(`dt_pref_${key}`, JSON.stringify(value));
      return false;
    }
  },

  /**
   * Load user preference
   * @param {string} key - Preference key
   * @param {*} defaultValue - Default value if not found
   */
  async loadPreference(key, defaultValue = null) {
    if (!Sync?.supabase || !Sync?.user?.id) {
      // Fallback to localStorage
      const stored = localStorage.getItem(`dt_pref_${key}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return stored;
        }
      }
      return defaultValue;
    }

    try {
      const { data } = await Sync.supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', Sync.user.id)
        .eq('setting_key', `pref_${key}`)
        .single();

      if (!data?.setting_value) return defaultValue;

      try {
        return JSON.parse(data.setting_value);
      } catch {
        return data.setting_value;
      }
    } catch {
      // Fallback to localStorage
      const stored = localStorage.getItem(`dt_pref_${key}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return stored;
        }
      }
      return defaultValue;
    }
  },

  /**
   * Load all user preferences (for MIRROR context)
   */
  async loadAllPreferences() {
    if (!Sync?.supabase || !Sync?.user?.id) return {};

    try {
      const { data } = await Sync.supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .eq('user_id', Sync.user.id)
        .like('setting_key', 'pref_%');

      if (!data) return {};

      const prefs = {};
      for (const row of data) {
        const key = row.setting_key.replace('pref_', '');
        try {
          prefs[key] = JSON.parse(row.setting_value);
        } catch {
          prefs[key] = row.setting_value;
        }
      }

      return prefs;
    } catch (error) {
      console.warn('[DataCapture] Failed to load preferences:', error);
      return {};
    }
  },

  // ============================================
  // SESSION TRACKING
  // ============================================

  /**
   * Track session start
   */
  async trackSessionStart() {
    if (!Sync?.supabase || !Sync?.user?.id) return;

    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      await Sync.supabase
        .from('user_settings')
        .upsert({
          user_id: Sync.user.id,
          setting_key: 'last_session',
          setting_value: JSON.stringify({
            started: new Date().toISOString(),
            device: isMobile ? 'mobile' : 'desktop',
            userAgent: navigator.userAgent.substring(0, 200)
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,setting_key' });

      console.log('[DataCapture] Session start tracked');
    } catch (error) {
      console.warn('[DataCapture] Failed to track session:', error);
    }
  },

  /**
   * Track session end (called on page unload)
   */
  trackSessionEnd() {
    if (!Sync?.supabase || !Sync?.user?.id) return;

    // Use sendBeacon for reliability on page unload
    const data = JSON.stringify({
      user_id: Sync.user.id,
      ended: new Date().toISOString()
    });

    // Store in localStorage for next session to pick up
    localStorage.setItem('dt_last_session_end', data);
  },

  // ============================================
  // DATA SUMMARY FOR MIRROR
  // ============================================

  /**
   * Get user data summary for MIRROR context
   */
  async getUserDataSummary() {
    if (!Sync?.supabase || !Sync?.user?.id) return null;

    try {
      const [preferences, usageData, stats] = await Promise.all([
        this.loadAllPreferences(),
        this._getUsageSummary(),
        this._getContentStats()
      ]);

      return {
        preferences,
        usage: usageData,
        stats
      };
    } catch (error) {
      console.warn('[DataCapture] Failed to get data summary:', error);
      return null;
    }
  },

  /**
   * Get usage summary
   * @private
   */
  async _getUsageSummary() {
    if (!Sync?.supabase || !Sync?.user?.id) return {};

    try {
      const { data } = await Sync.supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .eq('user_id', Sync.user.id)
        .like('setting_key', 'usage_%');

      if (!data) return {};

      const usage = {};
      for (const row of data) {
        const feature = row.setting_key.replace('usage_', '');
        try {
          usage[feature] = JSON.parse(row.setting_value);
        } catch {
          usage[feature] = row.setting_value;
        }
      }

      return usage;
    } catch {
      return {};
    }
  },

  /**
   * Get content stats (notes, entities, patterns counts)
   * @private
   */
  async _getContentStats() {
    if (!Sync?.supabase || !Sync?.user?.id) return {};

    try {
      const [notesResult, entitiesResult, patternsResult] = await Promise.all([
        Sync.supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', Sync.user.id),
        Sync.supabase
          .from('user_entities')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', Sync.user.id),
        Sync.supabase
          .from('user_patterns')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', Sync.user.id)
      ]);

      return {
        notes: notesResult.count || 0,
        entities: entitiesResult.count || 0,
        patterns: patternsResult.count || 0
      };
    } catch {
      return { notes: 0, entities: 0, patterns: 0 };
    }
  },

  // ============================================
  // ONBOARDING DATA
  // ============================================

  /**
   * Save onboarding responses
   * @param {Object} responses - Onboarding responses
   */
  async saveOnboardingData(responses) {
    await this.savePreference('onboarding', responses);
    console.log('[DataCapture] Onboarding data saved');
  },

  /**
   * Load onboarding responses
   */
  async loadOnboardingData() {
    return await this.loadPreference('onboarding', null);
  },

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize data capture (call on app start)
   */
  init() {
    console.log('[DataCapture] Initializing...');

    // Track session start when user is authenticated
    if (Sync?.user?.id) {
      this.trackSessionStart();
    }

    // Listen for auth changes
    if (Sync?.supabase) {
      Sync.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          this.trackSessionStart();
        }
      });
    }

    // Track session end on page unload
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
    });

    console.log('[DataCapture] Initialized');
  }
};

// Make globally available
window.DataCapture = DataCapture;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay init to ensure Sync is ready
  setTimeout(() => {
    DataCapture.init();
  }, 1000);
});
