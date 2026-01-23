// js/knowledge-pulse.js
// Knowledge Pulse - Simple save confirmation
// Simplified: Just shows "✓ Saved" - no patterns or learning items

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
   * Show simple "Saved" confirmation
   * Learning data is intentionally ignored - patterns belong in TWIN tab
   */
  show(learning) {
    this.container.innerHTML = `<span class="pulse-check">✓</span> Saved`;
    this.container.classList.add('visible');

    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.hide(), 2000);
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
