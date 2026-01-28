/**
 * Memory Moments UI - Proactive Memory Surfacing
 * Phase 15: Experience Transformation
 *
 * Displays proactive memory moments in an overlay/drawer (FIX 8).
 * Surfaces dormant entities, anniversaries, progress, and pattern shifts.
 */

const MemoryMomentsUI = {
  // State
  isOpen: false,
  isLoading: false,
  moments: [],
  pendingCount: 0,

  // Minimum days of usage before showing moments
  MIN_USAGE_DAYS: 14,

  /**
   * Initialize Memory Moments UI
   */
  init() {
    console.log('[MemoryMomentsUI] Initializing...');
    this.injectHTML();
    this.attachListeners();

    // Check for pending moments on load
    this.checkPendingCount();

    console.log('[MemoryMomentsUI] Initialized');
  },

  /**
   * Inject HTML templates
   */
  injectHTML() {
    // Overlay container
    if (!document.getElementById('memory-moments-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'memory-moments-overlay';
      overlay.className = 'memory-moments-overlay';
      overlay.innerHTML = `
        <div class="memory-moments-drawer">
          <div class="memory-moments__header">
            <h3 class="memory-moments__title">Moments</h3>
            <button class="memory-moments__close" aria-label="Close">&times;</button>
          </div>
          <div class="memory-moments__list" id="memory-moments-list">
            <!-- Moments will be rendered here -->
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Add trigger to NOTES tab header (if not exists)
    this.addTriggerButton();
  },

  /**
   * Add trigger button to app header
   */
  addTriggerButton() {
    const headerButtons = document.querySelector('.header-buttons');
    if (headerButtons && !document.getElementById('memory-moments-trigger')) {
      const trigger = document.createElement('button');
      trigger.id = 'memory-moments-trigger';
      trigger.className = 'memory-moments-trigger';
      trigger.setAttribute('aria-label', 'Memory Moments');
      trigger.innerHTML = `
        <span class="memory-moments-trigger__icon">&#128161;</span>
        <span class="memory-moments-trigger__badge memory-moments-trigger__badge--empty" id="memory-moments-badge">0</span>
      `;
      headerButtons.insertBefore(trigger, headerButtons.firstChild);
    }
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Global click handler
    document.addEventListener('click', (e) => {
      // Trigger button
      if (e.target.closest('.memory-moments-trigger')) {
        this.open();
        return;
      }

      // Close button
      if (e.target.closest('.memory-moments__close')) {
        this.close();
        return;
      }

      // Overlay background click
      if (e.target.id === 'memory-moments-overlay') {
        this.close();
        return;
      }

      // Engage button
      const engageBtn = e.target.closest('.moment-card__btn--engage');
      if (engageBtn) {
        const card = engageBtn.closest('.moment-card');
        if (card) {
          this.engage(card.dataset.id);
        }
        return;
      }

      // Dismiss button
      const dismissBtn = e.target.closest('.moment-card__btn--dismiss');
      if (dismissBtn) {
        const card = dismissBtn.closest('.moment-card');
        if (card) {
          this.dismiss(card.dataset.id);
        }
        return;
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  },

  /**
   * Open the moments drawer
   */
  async open() {
    const overlay = document.getElementById('memory-moments-overlay');
    if (!overlay) return;

    overlay.classList.add('memory-moments-overlay--visible');
    this.isOpen = true;

    // Load moments
    await this.loadMoments();
  },

  /**
   * Close the moments drawer
   */
  close() {
    const overlay = document.getElementById('memory-moments-overlay');
    if (overlay) {
      overlay.classList.remove('memory-moments-overlay--visible');
      this.isOpen = false;
    }
  },

  /**
   * Check pending moments count
   */
  async checkPendingCount() {
    try {
      const userId = await this.getUserId();
      if (!userId) return;

      // Check if user has enough usage history
      const hasEnoughHistory = await this.checkUsageHistory(userId);
      if (!hasEnoughHistory) {
        this.updateBadge(0);
        return;
      }

      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) return;

      const response = await fetch(`/api/memory-moments?status=pending&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (response.ok) {
        this.pendingCount = data.moments?.length || 0;
        this.updateBadge(this.pendingCount);
      }
    } catch (error) {
      console.warn('[MemoryMomentsUI] Could not check pending count:', error);
    }
  },

  /**
   * Check if user has enough usage history
   */
  async checkUsageHistory(userId) {
    try {
      // Check first note date
      if (typeof DB !== 'undefined') {
        const notes = await NotesManager.getAll();
        if (notes && notes.length > 0) {
          const oldestNote = notes.reduce((oldest, note) => {
            const noteDate = new Date(note.timestamp);
            return noteDate < oldest ? noteDate : oldest;
          }, new Date());

          const daysSinceFirst = Math.floor((new Date() - oldestNote) / (1000 * 60 * 60 * 24));
          return daysSinceFirst >= this.MIN_USAGE_DAYS;
        }
      }
      return false;
    } catch (error) {
      console.warn('[MemoryMomentsUI] Could not check usage history:', error);
      return false;
    }
  },

  /**
   * Update badge count
   */
  updateBadge(count) {
    const badge = document.getElementById('memory-moments-badge');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('memory-moments-trigger__badge--empty', count === 0);
    }
  },

  /**
   * Load moments from API
   */
  async loadMoments() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.renderLoading();

    try {
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        this.renderEmptyState('Please sign in to see moments');
        return;
      }

      const userId = await this.getUserId();

      // Check usage history
      const hasEnoughHistory = await this.checkUsageHistory(userId);
      if (!hasEnoughHistory) {
        this.renderEmptyState();
        return;
      }

      const response = await fetch(`/api/memory-moments?status=pending&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load moments');
      }

      this.moments = data.moments || [];

      if (this.moments.length === 0) {
        this.renderComplete();
      } else {
        this.renderMoments();
      }

      // Update badge
      this.pendingCount = this.moments.length;
      this.updateBadge(this.pendingCount);

    } catch (error) {
      console.error('[MemoryMomentsUI] Load error:', error);
      this.renderEmptyState('Unable to load moments');
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Render loading state
   */
  renderLoading() {
    const container = document.getElementById('memory-moments-list');
    if (!container) return;

    container.innerHTML = `
      <div class="memory-moments__loading">
        <div class="memory-moments__loading-spinner"></div>
        <p class="memory-moments__loading-text">Gathering moments...</p>
      </div>
    `;
  },

  /**
   * Render moments list
   */
  renderMoments() {
    const container = document.getElementById('memory-moments-list');
    if (!container) return;

    const cards = this.moments.map(moment => this.renderMomentCard(moment)).join('');
    container.innerHTML = cards;
  },

  /**
   * Render a single moment card
   */
  renderMomentCard(moment) {
    const typeLabel = this.getTypeLabel(moment.moment_type);
    const typeClass = `moment-card--${moment.moment_type.replace('_', '-')}`;

    // Related entity if available
    let entityHtml = '';
    if (moment.related_entity) {
      const initial = (moment.related_entity.name || '?')[0].toUpperCase();
      entityHtml = `
        <div class="moment-card__entity">
          <span class="moment-card__entity-avatar">${initial}</span>
          <span class="moment-card__entity-name">${this.escapeHtml(moment.related_entity.name)}</span>
          ${moment.related_entity.relationship ? `<span class="moment-card__entity-relationship">${this.escapeHtml(moment.related_entity.relationship)}</span>` : ''}
        </div>
      `;
    }

    return `
      <div class="moment-card ${typeClass}" data-id="${moment.id}">
        <p class="moment-card__type">${typeLabel}</p>
        <h4 class="moment-card__title">${this.escapeHtml(moment.title)}</h4>
        <p class="moment-card__content">${this.escapeHtml(moment.content)}</p>
        ${entityHtml}
        <div class="moment-card__divider"></div>
        <div class="moment-card__actions">
          <button class="moment-card__btn moment-card__btn--engage">Engage</button>
          <button class="moment-card__btn moment-card__btn--dismiss">Dismiss</button>
        </div>
      </div>
    `;
  },

  /**
   * Get human-readable type label
   */
  getTypeLabel(type) {
    switch (type) {
      case 'dormant_entity': return 'Checking In';
      case 'anniversary': return 'Anniversary';
      case 'progress': return 'Progress';
      case 'pattern_shift': return 'Pattern Shift';
      default: return 'Moment';
    }
  },

  /**
   * Render empty state
   */
  renderEmptyState(message) {
    const container = document.getElementById('memory-moments-list');
    if (!container) return;

    container.innerHTML = `
      <div class="memory-moments__empty">
        <p class="memory-moments__empty-message">
          ${message || 'Moments appear after 14+ days of notes'}
        </p>
        <p class="memory-moments__empty-hint">
          Keep writing, and your memories will come alive.
        </p>
      </div>
    `;
  },

  /**
   * Render "all caught up" state
   */
  renderComplete() {
    const container = document.getElementById('memory-moments-list');
    if (!container) return;

    container.innerHTML = `
      <div class="memory-moments__complete">
        <div class="memory-moments__complete-check">&#10003;</div>
        <p class="memory-moments__complete-message">All caught up</p>
      </div>
    `;
  },

  /**
   * Engage with a moment
   */
  async engage(momentId) {
    const card = document.querySelector(`.moment-card[data-id="${momentId}"]`);
    if (card) {
      card.classList.add('moment-card--engaging');
    }

    try {
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) return;

      const response = await fetch(`/api/memory-moments/${momentId}/engage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ moment_id: momentId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to engage');
      }

      console.log('[MemoryMomentsUI] Engaged with moment:', momentId);

      // Remove from list
      this.moments = this.moments.filter(m => m.id !== momentId);
      this.pendingCount = this.moments.length;
      this.updateBadge(this.pendingCount);

      // Update UI
      setTimeout(() => {
        if (this.moments.length === 0) {
          this.renderComplete();
        } else {
          this.renderMoments();
        }
      }, 300);

      // TODO: Navigate to related entity or note

    } catch (error) {
      console.error('[MemoryMomentsUI] Engage error:', error);
      if (card) {
        card.classList.remove('moment-card--engaging');
      }
    }
  },

  /**
   * Dismiss a moment
   */
  async dismiss(momentId) {
    const card = document.querySelector(`.moment-card[data-id="${momentId}"]`);
    if (card) {
      card.classList.add('moment-card--dismissing');
    }

    try {
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) return;

      const response = await fetch(`/api/memory-moments/${momentId}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ moment_id: momentId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to dismiss');
      }

      console.log('[MemoryMomentsUI] Dismissed moment:', momentId);

      // Remove from list
      this.moments = this.moments.filter(m => m.id !== momentId);
      this.pendingCount = this.moments.length;
      this.updateBadge(this.pendingCount);

      // Update UI
      setTimeout(() => {
        if (this.moments.length === 0) {
          this.renderComplete();
        } else {
          this.renderMoments();
        }
      }, 300);

    } catch (error) {
      console.error('[MemoryMomentsUI] Dismiss error:', error);
      if (card) {
        card.classList.remove('moment-card--dismissing');
      }
    }
  },

  // ===== HELPERS =====

  /**
   * Get user ID
   */
  async getUserId() {
    if (typeof Sync !== 'undefined' && Sync.user?.id) {
      return Sync.user.id;
    }
    return null;
  },

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Refresh moments (called when app becomes visible, etc.)
   */
  async refresh() {
    await this.checkPendingCount();
    if (this.isOpen) {
      await this.loadMoments();
    }
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MemoryMomentsUI.init());
} else {
  MemoryMomentsUI.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryMomentsUI;
}
