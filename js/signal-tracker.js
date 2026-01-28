/**
 * js/signal-tracker.js - Phase 13C: Signal Tracking
 * Captures user activity signals for MIRROR intelligence
 */

class SignalTrackerClass {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.batchInterval = 5000; // Batch signals every 5 seconds
    this.maxQueueSize = 50;
  }

  /**
   * Initialize signal tracker
   */
  init() {
    // Start batch processing
    setInterval(() => this.processBatch(), this.batchInterval);

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.track('session_pause', {});
      } else {
        this.track('session_resume', {});
      }
    });

    console.log('[SignalTracker] Initialized');
  }

  /**
   * Track a signal
   * @param {string} signalType - Type of signal
   * @param {object} signalData - Signal data
   */
  track(signalType, signalData = {}) {
    if (!Sync?.user?.id) return;

    const signal = {
      signal_type: signalType,
      signal_data: {
        ...signalData,
        timestamp: new Date().toISOString(),
        session_id: this.getSessionId()
      },
      user_id: Sync.user.id,
      queued_at: Date.now()
    };

    this.queue.push(signal);

    // Trim queue if too large
    if (this.queue.length > this.maxQueueSize) {
      this.queue = this.queue.slice(-this.maxQueueSize);
    }

    // Log for debugging
    console.log(`[SignalTracker] Queued: ${signalType}`, signalData);
  }

  /**
   * Process queued signals in batch
   */
  async processBatch() {
    if (this.isProcessing || this.queue.length === 0 || !Sync?.user?.id) return;

    this.isProcessing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        this.queue = [...batch, ...this.queue].slice(-this.maxQueueSize);
        this.isProcessing = false;
        return;
      }

      const response = await fetch('/api/signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          signals: batch
        })
      });

      if (!response.ok) {
        // Re-queue failed signals
        this.queue = [...batch, ...this.queue].slice(-this.maxQueueSize);
        console.warn('[SignalTracker] Batch failed, re-queued');
      }
    } catch (error) {
      // Re-queue on error
      this.queue = [...batch, ...this.queue].slice(-this.maxQueueSize);
      console.warn('[SignalTracker] Batch error:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get or create session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('inscript_session_id');
    if (!sessionId) {
      const randomBytes = crypto.getRandomValues(new Uint8Array(8));
      const random = Array.from(randomBytes).map(b => b.toString(36)).join('').substring(0, 9);
      sessionId = `session_${Date.now()}_${random}`;
      sessionStorage.setItem('inscript_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Track note created
   */
  trackNoteCreated(noteId, noteData) {
    this.track('note_created', {
      note_id: noteId,
      has_image: !!noteData.imageUrl,
      has_voice: !!noteData.audioUrl,
      content_length: noteData.content?.length || 0,
      hour_of_day: new Date().getHours(),
      day_of_week: new Date().getDay()
    });
  }

  /**
   * Track entity clicked
   */
  trackEntityClicked(entityId, entityName, entityType) {
    this.track('entity_clicked', {
      entity_id: entityId,
      entity_name: entityName,
      entity_type: entityType
    });
  }

  /**
   * Track entity card viewed
   */
  trackEntityCardViewed(entityId, viewDuration) {
    this.track('entity_card_viewed', {
      entity_id: entityId,
      view_duration_ms: viewDuration
    });
  }

  /**
   * Track pattern confirmed
   */
  trackPatternConfirmed(patternId, patternType) {
    this.track('pattern_confirmed', {
      pattern_id: patternId,
      pattern_type: patternType
    });
  }

  /**
   * Track pattern rejected
   */
  trackPatternRejected(patternId, patternType, reason) {
    this.track('pattern_rejected', {
      pattern_id: patternId,
      pattern_type: patternType,
      reason: reason
    });
  }

  /**
   * Track reflection feedback
   */
  trackReflectionFeedback(noteId, feedbackType, feedbackValue) {
    this.track('reflection_feedback', {
      note_id: noteId,
      feedback_type: feedbackType, // 'thumbs_up', 'thumbs_down', 'edited'
      feedback_value: feedbackValue
    });
  }

  /**
   * Track MIRROR conversation opened
   */
  trackMirrorOpened(conversationId, openingType) {
    this.track('mirror_opened', {
      conversation_id: conversationId,
      opening_type: openingType
    });
  }

  /**
   * Track MIRROR message sent
   */
  trackMirrorMessage(conversationId, role, messageLength) {
    this.track('mirror_message', {
      conversation_id: conversationId,
      role: role,
      message_length: messageLength
    });
  }

  /**
   * Track note detail viewed
   */
  trackNoteViewed(noteId, viewSource) {
    this.track('note_viewed', {
      note_id: noteId,
      view_source: viewSource // 'list', 'search', 'twin', 'mirror'
    });
  }

  /**
   * Track search performed
   */
  trackSearch(query, resultCount) {
    this.track('search', {
      query_length: query?.length || 0,
      result_count: resultCount
    });
  }

  /**
   * Track tab switched
   */
  trackTabSwitch(fromTab, toTab) {
    this.track('tab_switch', {
      from_tab: fromTab,
      to_tab: toTab
    });
  }

  /**
   * Get recent signals summary for context
   */
  async getRecentSignalsSummary() {
    if (!Sync?.user?.id) return null;

    try {
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) return null;

      const response = await fetch(`/api/signals?summary=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('[SignalTracker] Failed to get summary:', error);
    }
    return null;
  }
}

// Initialize global instance
const SignalTracker = new SignalTrackerClass();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SignalTracker.init());
} else {
  SignalTracker.init();
}

// Make available globally
window.SignalTracker = SignalTracker;
