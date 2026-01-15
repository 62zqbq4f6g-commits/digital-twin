/**
 * Follow-Up System - Accountability loop for actions
 * Phase 8: "Did You Do It?" Follow-up
 */

window.FollowUp = {
  // How long to wait before following up on an action (hours)
  FOLLOW_UP_DELAY_HOURS: 24,

  /**
   * Check for pending follow-ups and show prompt if needed
   * @returns {number} Number of actions due for follow-up
   */
  async checkPendingFollowUps() {
    try {
      const pendingActions = await this.getPendingActions();
      const dueForFollowUp = pendingActions.filter(a => this.isDueForFollowUp(a));

      if (dueForFollowUp.length > 0) {
        this.showFollowUpPrompt(dueForFollowUp);
      }

      console.log(`[FollowUp] ${dueForFollowUp.length} actions due for follow-up`);
      return dueForFollowUp.length;

    } catch (error) {
      console.error('[FollowUp] Error checking pending follow-ups:', error);
      return 0;
    }
  },

  /**
   * Get all pending actions that are old enough for follow-up
   */
  async getPendingActions() {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        return [];
      }

      const userId = await this.getUserId();
      if (!userId) return [];

      // Calculate cutoff time (24 hours ago)
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - this.FOLLOW_UP_DELAY_HOURS);

      const { data, error } = await Sync.supabase
        .from('action_signals')
        .select('*')
        .eq('user_id', userId)
        .is('completed_at', null)
        .lt('created_at', cutoff.toISOString())
        .is('follow_up_response', null);

      if (error) {
        console.warn('[FollowUp] Error fetching pending actions:', error.message);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('[FollowUp] getPendingActions error:', error);
      return [];
    }
  },

  /**
   * Check if an action is due for follow-up
   * @param {Object} action - Action object
   * @returns {boolean}
   */
  isDueForFollowUp(action) {
    if (action.follow_up_shown_at) {
      // Don't show again within 24 hours
      const lastShown = new Date(action.follow_up_shown_at);
      const hoursSince = (Date.now() - lastShown.getTime()) / (1000 * 60 * 60);
      return hoursSince >= this.FOLLOW_UP_DELAY_HOURS;
    }
    return true;
  },

  /**
   * Show the follow-up prompt modal
   * @param {Array} actions - Actions to follow up on
   */
  showFollowUpPrompt(actions) {
    // Remove existing modal
    this.closeModal();

    const modal = document.createElement('div');
    modal.className = 'modal follow-up-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="FollowUp.dismissAll()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Quick check-in</h3>
          <button class="close-btn" onclick="FollowUp.dismissAll()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="follow-up-intro">You had ${actions.length} action${actions.length > 1 ? 's' : ''} pending:</p>
          <div class="follow-up-actions">
            ${actions.map(a => this.renderFollowUpAction(a)).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="FollowUp.dismissAll()">Ask me later</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Mark as shown
    actions.forEach(a => this.markFollowUpShown(a.id));

    console.log('[FollowUp] Showing follow-up prompt for', actions.length, 'actions');
  },

  /**
   * Render a single follow-up action
   * @param {Object} action - Action object
   * @returns {string} HTML string
   */
  renderFollowUpAction(action) {
    const actionText = action.action_text || action.action || 'Unknown action';
    const actionId = action.id || action.action_id;

    return `
      <div class="follow-up-action" data-action-id="${actionId}">
        <p class="action-text">${this.escapeHtml(actionText)}</p>
        <div class="follow-up-buttons">
          <button class="btn-success" onclick="FollowUp.respond('${actionId}', 'done')">
            Done
          </button>
          <button class="btn-secondary" onclick="FollowUp.respond('${actionId}', 'working')">
            Still working
          </button>
          <button class="btn-ghost" onclick="FollowUp.respond('${actionId}', 'wont_do')">
            Won't do
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Handle user response to a follow-up
   * @param {string} actionId - Action ID
   * @param {string} response - 'done', 'working', or 'wont_do'
   */
  async respond(actionId, response) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.error('[FollowUp] Supabase not available');
        return;
      }

      const userId = await this.getUserId();
      if (!userId) return;

      const updates = {
        follow_up_response: response,
        updated_at: new Date().toISOString()
      };

      // If marked as done, set completed_at
      if (response === 'done') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await Sync.supabase
        .from('action_signals')
        .update(updates)
        .eq('id', actionId)
        .eq('user_id', userId);

      if (error) {
        console.error('[FollowUp] Error updating action:', error);
        return;
      }

      // Remove this action from modal
      const actionEl = document.querySelector(`[data-action-id="${actionId}"]`);
      if (actionEl) {
        actionEl.remove();
      }

      // Check if modal should close
      const remaining = document.querySelectorAll('.follow-up-action');
      if (remaining.length === 0) {
        this.closeModal();
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast(response === 'done' ? 'Nice work!' : 'Got it!');
        }
      }

      console.log('[FollowUp] Action responded:', actionId, response);

    } catch (error) {
      console.error('[FollowUp] respond error:', error);
    }
  },

  /**
   * Mark an action's follow-up as shown
   * @param {string} actionId - Action ID
   */
  async markFollowUpShown(actionId) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return;

      await Sync.supabase
        .from('action_signals')
        .update({ follow_up_shown_at: new Date().toISOString() })
        .eq('id', actionId);

    } catch (error) {
      console.warn('[FollowUp] Error marking follow-up shown:', error);
    }
  },

  /**
   * Dismiss all follow-ups and close modal
   */
  dismissAll() {
    this.closeModal();
    console.log('[FollowUp] Dismissed all follow-ups');
  },

  /**
   * Close the follow-up modal
   */
  closeModal() {
    const modal = document.querySelector('.follow-up-modal');
    if (modal) modal.remove();
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
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Initialize the follow-up system
   */
  init() {
    console.log('[FollowUp] Initialized');
  }
};
