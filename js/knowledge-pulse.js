// js/knowledge-pulse.js
// Knowledge Pulse - Smart save confirmation with learning feedback
// Shows what Inscript learned from your note

class KnowledgePulse {
  constructor() {
    this.container = null;
    this.timeout = null;
    this.init();
  }

  init() {
    // Create container if not exists
    if (!document.getElementById('knowledge-pulse')) {
      const pulse = document.createElement('div');
      pulse.id = 'knowledge-pulse';
      pulse.className = 'knowledge-pulse';
      document.body.appendChild(pulse);
    }
    this.container = document.getElementById('knowledge-pulse');

    // Click to dismiss
    this.container.addEventListener('click', () => this.hide());
  }

  /**
   * Show save confirmation with learning context
   * @param {Object} data - Learning data from analysis
   * @param {Array} data.entities_extracted - People/things mentioned
   * @param {Array} data.themes_detected - Themes found
   * @param {Array} data.actions - Action items extracted (optional)
   */
  show(data) {
    // Build the message
    const message = this.buildMessage(data);

    this.container.innerHTML = message;
    this.container.classList.add('visible');

    // Auto-hide after delay (longer if there's learning to show)
    const hasLearning = data && (
      (data.entities_extracted && data.entities_extracted.length > 0) ||
      (data.actions && data.actions.length > 0)
    );

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.hide(), hasLearning ? 3500 : 2000);
  }

  /**
   * Build the message HTML based on what was learned
   */
  buildMessage(data) {
    // Base message
    let html = '<span class="pulse-check">✓</span>';

    // No data = simple save
    if (!data) {
      return html + ' Saved';
    }

    // Check what we learned
    const entities = data.entities_extracted || [];
    const actions = data.actions || [];
    const newPeople = entities.filter(e => e.type === 'person' && e.is_new);

    // Priority 1: New people mentioned
    if (newPeople.length > 0) {
      const names = newPeople.slice(0, 2).map(e => e.name).join(', ');
      const more = newPeople.length > 2 ? ` +${newPeople.length - 2}` : '';
      return html + ` Saved <span class="pulse-detail">· Noted: ${names}${more}</span>`;
    }

    // Priority 2: Actions extracted
    if (actions.length > 0) {
      const actionCount = actions.length;
      const actionText = actionCount === 1 ? '1 action' : `${actionCount} actions`;
      return html + ` Saved <span class="pulse-detail">· ${actionText} tracked</span>`;
    }

    // Priority 3: Any entities (places, dates, etc.)
    if (entities.length > 0) {
      const firstEntity = entities[0];
      return html + ` Saved <span class="pulse-detail">· Memory updated</span>`;
    }

    // Default: simple save
    return html + ' Saved';
  }

  hide() {
    this.container.classList.remove('visible');
    if (this.timeout) clearTimeout(this.timeout);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.KnowledgePulse = new KnowledgePulse();
  });
} else {
  window.KnowledgePulse = new KnowledgePulse();
}
