// js/knowledge-pulse.js
// Knowledge Pulse - Shows what Inscript learned after each note save

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

  show(learning) {
    if (!learning || this.isEmpty(learning)) {
      this.showSimple();
      return;
    }

    const items = this.buildItems(learning);

    this.container.innerHTML = `
      <div class="pulse-header">Saved</div>
      ${items.length > 0 ? `<div class="pulse-items">${items.join('')}</div>` : ''}
    `;

    // Bind entity clicks
    this.container.querySelectorAll('.pulse-item-entity').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const entityName = el.dataset.entity;
        this.openEntityCard(entityName);
      });
    });

    this.container.classList.add('visible');

    // Auto-hide after 4 seconds
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.hide(), 4000);
  }

  showSimple() {
    this.container.innerHTML = `<div class="pulse-header">Saved</div>`;
    this.container.classList.add('visible');
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.hide(), 2000);
  }

  hide() {
    this.container.classList.remove('visible');
    if (this.timeout) clearTimeout(this.timeout);
  }

  isEmpty(learning) {
    return !learning.entities_extracted?.length &&
           !learning.themes_detected?.length &&
           !learning.similar_notes?.length;
  }

  buildItems(learning) {
    const items = [];

    // New entities (highest priority)
    if (learning.entities_extracted) {
      for (const entity of learning.entities_extracted.slice(0, 2)) {
        const entityName = entity.name || 'Unknown';
        const relationship = entity.relationship ? ` is ${entity.relationship}` : '';
        const isNew = entity.is_new;

        items.push(`
          <div class="pulse-item">
            <span class="pulse-item-icon ${isNew ? 'primary' : ''}">◆</span>
            <span class="pulse-item-text">
              ${isNew ? 'Learned' : 'Updated'}: <span class="pulse-item-entity" data-entity="${entityName.toLowerCase()}">${entityName}</span>${relationship}
            </span>
          </div>
        `);
      }
    }

    // Themes
    if (learning.themes_detected && learning.themes_detected.length > 0 && items.length < 3) {
      const theme = learning.themes_detected[0];
      items.push(`
        <div class="pulse-item">
          <span class="pulse-item-icon">○</span>
          <span class="pulse-item-text">Noticed: ${theme} theme</span>
        </div>
      `);
    }

    // Similar notes
    if (learning.similar_notes?.length && items.length < 3) {
      const similar = learning.similar_notes[0];
      const date = similar.date ? new Date(similar.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'earlier';
      items.push(`
        <div class="pulse-item">
          <span class="pulse-item-icon">○</span>
          <span class="pulse-item-text">Connected: Similar to note from ${date}</span>
        </div>
      `);
    }

    return items;
  }

  openEntityCard(entityName) {
    // Trigger entity card modal
    if (window.EntityCards) {
      window.EntityCards.open(entityName);
    }
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
