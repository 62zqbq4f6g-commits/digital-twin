/**
 * js/pattern-verification.js - Phase 13D: Pattern Verification UI
 *
 * Handles pattern verification UI in three layers:
 * 1. Knowledge Pulse (after saving note)
 * 2. Inline in reflections (contextually relevant)
 * 3. TWIN tab (persistent list)
 */

class PatternVerification {
  constructor() {
    this.patterns = [];
    this.isLoading = false;
  }

  /**
   * Initialize pattern verification
   */
  init() {
    console.log('[PatternVerification] Initialized');
  }

  /**
   * Load user's patterns from API
   */
  async loadPatterns() {
    if (!Sync?.user?.id) return [];

    try {
      const response = await fetch(`/api/user-patterns?user_id=${Sync.user.id}`);
      if (!response.ok) throw new Error('Failed to load patterns');

      const data = await response.json();
      this.patterns = data.patterns || [];
      return this.patterns;
    } catch (error) {
      console.error('[PatternVerification] Load error:', error);
      return [];
    }
  }

  /**
   * Get surfaceable pattern for reflection (Layer 2)
   * @param {string} noteContent - Content of the current note
   */
  async getSurfaceablePattern(noteContent = '') {
    if (!Sync?.user?.id) return null;

    try {
      const response = await fetch(
        `/api/user-patterns?user_id=${Sync.user.id}&surfaceable=true&context=${encodeURIComponent(noteContent.substring(0, 200))}`
      );
      if (!response.ok) return null;

      const data = await response.json();
      return data.pattern || null;
    } catch (error) {
      console.warn('[PatternVerification] Get surfaceable error:', error);
      return null;
    }
  }

  /**
   * Confirm a pattern
   * @param {string} patternId - Pattern ID
   */
  async confirmPattern(patternId) {
    if (!Sync?.user?.id) return false;

    try {
      const response = await fetch('/api/user-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Sync.user.id,
          pattern_id: patternId,
          action: 'confirm'
        })
      });

      if (!response.ok) throw new Error('Failed to confirm pattern');

      // Track signal
      if (typeof SignalTracker !== 'undefined') {
        SignalTracker.trackPatternConfirmed(patternId, 'user_verified');
      }

      // Update local state
      const pattern = this.patterns.find(p => p.id === patternId);
      if (pattern) {
        pattern.status = 'confirmed';
        pattern.confirmed_at = new Date().toISOString();
      }

      return true;
    } catch (error) {
      console.error('[PatternVerification] Confirm error:', error);
      return false;
    }
  }

  /**
   * Reject a pattern
   * @param {string} patternId - Pattern ID
   * @param {string} reason - Optional rejection reason
   */
  async rejectPattern(patternId, reason = '') {
    if (!Sync?.user?.id) return false;

    try {
      const response = await fetch('/api/user-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Sync.user.id,
          pattern_id: patternId,
          action: 'reject',
          feedback: reason
        })
      });

      if (!response.ok) throw new Error('Failed to reject pattern');

      // Track signal
      if (typeof SignalTracker !== 'undefined') {
        SignalTracker.trackPatternRejected(patternId, 'user_rejected', reason);
      }

      // Update local state
      const pattern = this.patterns.find(p => p.id === patternId);
      if (pattern) {
        pattern.status = 'rejected';
        pattern.rejected_at = new Date().toISOString();
      }

      return true;
    } catch (error) {
      console.error('[PatternVerification] Reject error:', error);
      return false;
    }
  }

  /**
   * Render inline pattern verification for reflection (Layer 2)
   * @param {object} pattern - Pattern to verify
   */
  renderInlineVerification(pattern) {
    if (!pattern) return '';

    return `
      <div class="pattern-inline" data-pattern-id="${pattern.id}">
        <div class="pattern-inline-divider"></div>
        <div class="pattern-inline-content">
          <span class="pattern-inline-icon">◆</span>
          <p class="pattern-inline-text">${this.escapeHtml(pattern.description)}</p>
          <p class="pattern-inline-question">Does that resonate?</p>
          <div class="pattern-inline-buttons">
            <button
              class="pattern-btn pattern-btn-confirm"
              onclick="window.PatternVerification.handleInlineConfirm('${pattern.id}')"
              aria-label="Confirm this pattern resonates"
            >
              That resonates
            </button>
            <button
              class="pattern-btn pattern-btn-reject"
              onclick="window.PatternVerification.handleInlineReject('${pattern.id}')"
              aria-label="Reject this pattern"
            >
              Not quite
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render patterns section for TWIN tab (Layer 3)
   */
  renderTwinSection() {
    if (!this.patterns || this.patterns.length === 0) {
      return `
        <div class="patterns-empty">
          <p>No patterns detected yet. Keep sharing, and I'll notice the threads.</p>
        </div>
      `;
    }

    const detected = this.patterns.filter(p => p.status === 'detected');
    const confirmed = this.patterns.filter(p => p.status === 'confirmed');
    const rejected = this.patterns.filter(p => p.status === 'rejected');

    return `
      <div class="patterns-section">
        ${detected.length > 0 ? `
          <div class="patterns-group">
            <h4 class="patterns-group-title">PATTERNS I'VE NOTICED</h4>
            ${detected.map(p => this.renderPatternCard(p, 'detected')).join('')}
          </div>
        ` : ''}

        ${confirmed.length > 0 ? `
          <div class="patterns-group">
            <h4 class="patterns-group-title">CONFIRMED</h4>
            ${confirmed.map(p => this.renderPatternCard(p, 'confirmed')).join('')}
          </div>
        ` : ''}

        ${rejected.length > 0 ? `
          <div class="patterns-group patterns-group-dismissed">
            <h4 class="patterns-group-title">DISMISSED</h4>
            ${rejected.map(p => this.renderPatternCard(p, 'rejected')).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render a single pattern card
   */
  renderPatternCard(pattern, status) {
    const confidencePercent = Math.round((pattern.confidence || 0.5) * 100);
    const confidenceBars = Math.round(confidencePercent / 10);

    if (status === 'confirmed') {
      return `
        <div class="pattern-card pattern-card-confirmed">
          <div class="pattern-card-header">
            <span class="pattern-card-icon">✓</span>
            <span class="pattern-card-label">CONFIRMED</span>
          </div>
          <p class="pattern-card-text">${this.escapeHtml(pattern.shortDescription || pattern.description)}</p>
        </div>
      `;
    }

    if (status === 'rejected') {
      return `
        <div class="pattern-card pattern-card-rejected">
          <div class="pattern-card-header">
            <span class="pattern-card-icon">×</span>
            <span class="pattern-card-label">DISMISSED</span>
          </div>
          <p class="pattern-card-text">${this.escapeHtml(pattern.shortDescription || pattern.description)}</p>
        </div>
      `;
    }

    // Detected pattern with verification buttons
    return `
      <div class="pattern-card" data-pattern-id="${pattern.id}">
        <div class="pattern-card-header">
          <span class="pattern-card-icon">◆</span>
          <span class="pattern-card-title">${this.escapeHtml(pattern.shortDescription || 'Pattern detected')}</span>
        </div>
        <p class="pattern-card-text">${this.escapeHtml(pattern.description)}</p>

        <div class="pattern-card-confidence">
          <span class="pattern-confidence-label">Confidence:</span>
          <div class="pattern-confidence-bar">
            <div class="pattern-confidence-fill" style="width: ${confidencePercent}%"></div>
          </div>
          <span class="pattern-confidence-value">${confidencePercent}%</span>
        </div>

        ${pattern.evidenceCount ? `
          <p class="pattern-card-evidence">Based on ${pattern.evidenceCount} occurrences</p>
        ` : ''}

        <div class="pattern-card-buttons">
          <button
            class="pattern-btn pattern-btn-confirm"
            onclick="window.PatternVerification.handleCardConfirm('${pattern.id}')"
            aria-label="Confirm this pattern"
          >
            That resonates
          </button>
          <button
            class="pattern-btn pattern-btn-reject"
            onclick="window.PatternVerification.handleCardReject('${pattern.id}')"
            aria-label="Reject this pattern"
          >
            Not quite
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Handle inline confirmation
   */
  async handleInlineConfirm(patternId) {
    const element = document.querySelector(`[data-pattern-id="${patternId}"]`);
    if (element) {
      element.classList.add('pattern-confirming');
    }

    const success = await this.confirmPattern(patternId);

    if (success && element) {
      element.innerHTML = `
        <div class="pattern-inline-confirmed">
          <span class="pattern-confirmed-icon">✓</span>
          <span class="pattern-confirmed-text">Thanks. I'll remember that.</span>
        </div>
      `;
      element.classList.remove('pattern-confirming');
      element.classList.add('pattern-confirmed');
    }
  }

  /**
   * Handle inline rejection
   */
  async handleInlineReject(patternId) {
    const element = document.querySelector(`[data-pattern-id="${patternId}"]`);

    // Show feedback prompt
    if (element) {
      element.innerHTML = `
        <div class="pattern-inline-feedback">
          <p class="pattern-feedback-prompt">What didn't fit?</p>
          <textarea
            class="pattern-feedback-input"
            id="pattern-feedback-${patternId}"
            placeholder="Optional: Help me understand better..."
            rows="2"
          ></textarea>
          <div class="pattern-feedback-buttons">
            <button
              class="pattern-btn pattern-btn-submit"
              onclick="window.PatternVerification.submitInlineRejection('${patternId}')"
            >
              Submit
            </button>
            <button
              class="pattern-btn pattern-btn-skip"
              onclick="window.PatternVerification.skipInlineRejection('${patternId}')"
            >
              Skip
            </button>
          </div>
        </div>
      `;
    }
  }

  /**
   * Submit inline rejection with feedback
   */
  async submitInlineRejection(patternId) {
    const feedbackInput = document.getElementById(`pattern-feedback-${patternId}`);
    const reason = feedbackInput?.value?.trim() || '';

    await this.rejectPattern(patternId, reason);

    const element = document.querySelector(`[data-pattern-id="${patternId}"]`);
    if (element) {
      element.innerHTML = `
        <div class="pattern-inline-rejected">
          <span class="pattern-rejected-text">Got it. I'll reconsider.</span>
        </div>
      `;
      element.classList.add('pattern-rejected');
    }
  }

  /**
   * Skip inline rejection feedback
   */
  async skipInlineRejection(patternId) {
    await this.rejectPattern(patternId, '');

    const element = document.querySelector(`[data-pattern-id="${patternId}"]`);
    if (element) {
      element.innerHTML = `
        <div class="pattern-inline-rejected">
          <span class="pattern-rejected-text">Got it. I'll reconsider.</span>
        </div>
      `;
      element.classList.add('pattern-rejected');
    }
  }

  /**
   * Handle card confirmation (TWIN tab)
   */
  async handleCardConfirm(patternId) {
    const success = await this.confirmPattern(patternId);

    if (success) {
      // Refresh the TWIN patterns section
      this.refreshTwinPatterns();
    }
  }

  /**
   * Handle card rejection (TWIN tab)
   */
  async handleCardReject(patternId) {
    const card = document.querySelector(`[data-pattern-id="${patternId}"]`);

    if (card) {
      // Transform card to show feedback input
      const buttonsDiv = card.querySelector('.pattern-card-buttons');
      if (buttonsDiv) {
        buttonsDiv.innerHTML = `
          <div class="pattern-card-feedback">
            <textarea
              class="pattern-feedback-input"
              id="pattern-card-feedback-${patternId}"
              placeholder="What didn't fit? (optional)"
              rows="2"
            ></textarea>
            <div class="pattern-feedback-buttons">
              <button
                class="pattern-btn pattern-btn-submit"
                onclick="window.PatternVerification.submitCardRejection('${patternId}')"
              >
                Dismiss
              </button>
              <button
                class="pattern-btn pattern-btn-cancel"
                onclick="window.PatternVerification.cancelCardRejection('${patternId}')"
              >
                Cancel
              </button>
            </div>
          </div>
        `;
      }
    }
  }

  /**
   * Submit card rejection with feedback
   */
  async submitCardRejection(patternId) {
    const feedbackInput = document.getElementById(`pattern-card-feedback-${patternId}`);
    const reason = feedbackInput?.value?.trim() || '';

    const success = await this.rejectPattern(patternId, reason);

    if (success) {
      this.refreshTwinPatterns();
    }
  }

  /**
   * Cancel card rejection
   */
  cancelCardRejection(patternId) {
    this.refreshTwinPatterns();
  }

  /**
   * Refresh TWIN tab patterns section
   */
  async refreshTwinPatterns() {
    await this.loadPatterns();

    const container = document.getElementById('twin-patterns-container');
    if (container) {
      container.innerHTML = this.renderTwinSection();
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize global instance
const patternVerificationInstance = new PatternVerification();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    patternVerificationInstance.init();
  });
} else {
  patternVerificationInstance.init();
}

// Make available globally
window.PatternVerification = patternVerificationInstance;
