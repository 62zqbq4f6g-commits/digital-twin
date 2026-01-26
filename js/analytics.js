/**
 * Analytics - Simple Event Tracking
 * Phase 17: Sends events to analytics_events table
 */

const Analytics = {
  // Queue events if not ready yet
  _queue: [],
  _ready: false,

  /**
   * Initialize analytics
   */
  init() {
    this._ready = true;
    // Process queued events
    while (this._queue.length > 0) {
      const { name, properties } = this._queue.shift();
      this._send(name, properties);
    }
    console.log('[Analytics] Initialized');
  },

  /**
   * Track an event
   * @param {string} name - Event name (e.g., 'note_created', 'meeting_saved')
   * @param {object} properties - Event properties
   */
  track(name, properties = {}) {
    if (!this._ready) {
      this._queue.push({ name, properties });
      return;
    }
    this._send(name, properties);
  },

  /**
   * Send event to backend
   */
  async _send(name, properties) {
    // Skip if no user
    if (!Sync?.user?.id) return;

    try {
      const { error } = await Sync.supabase
        .from('analytics_events')
        .insert({
          user_id: Sync.user.id,
          event_name: name,
          properties: properties,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.warn('[Analytics] Failed to track:', name, error.message);
      }
    } catch (err) {
      // Silent fail - analytics shouldn't break the app
      console.warn('[Analytics] Error:', err.message);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  noteCreated(noteId, source = 'text') {
    this.track('note_created', { note_id: noteId, source });
  },

  meetingSaved(meetingId, attendeeCount) {
    this.track('meeting_saved', { meeting_id: meetingId, attendee_count: attendeeCount });
  },

  decisionSaved(decisionId) {
    this.track('decision_saved', { decision_id: decisionId });
  },

  whisperSaved(whisperId) {
    this.track('whisper_saved', { whisper_id: whisperId });
  },

  tabViewed(tabName) {
    this.track('tab_viewed', { tab: tabName });
  },

  patternConfirmed(patternId) {
    this.track('pattern_confirmed', { pattern_id: patternId });
  },

  patternRejected(patternId) {
    this.track('pattern_rejected', { pattern_id: patternId });
  },

  momentEngaged(momentId, momentType) {
    this.track('moment_engaged', { moment_id: momentId, moment_type: momentType });
  },

  momentDismissed(momentId, momentType) {
    this.track('moment_dismissed', { moment_id: momentId, moment_type: momentType });
  },

  reportViewed(reportMonth) {
    this.track('report_viewed', { report_month: reportMonth });
  },

  ambientRecordingStarted(mode) {
    this.track('ambient_recording_started', { mode });
  },

  ambientRecordingCompleted(durationSeconds) {
    this.track('ambient_recording_completed', { duration_seconds: durationSeconds });
  },

  onboardingCompleted() {
    this.track('onboarding_completed', {});
  },

  searchPerformed(query, resultCount) {
    this.track('search_performed', { query_length: query.length, result_count: resultCount });
  }
};

// Export for global access
window.Analytics = Analytics;
