// js/entity-cards.js
// Entity Cards - Click any entity to see accumulated knowledge

class EntityCards {
  constructor() {
    this.overlay = null;
    this.init();
  }

  init() {
    // Create overlay if not exists
    if (!document.getElementById('entity-card-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'entity-card-overlay';
      overlay.className = 'entity-card-overlay';
      document.body.appendChild(overlay);
    }
    this.overlay = document.getElementById('entity-card-overlay');

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // Global click handler for entity links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('entity-link') || e.target.classList.contains('pulse-item-entity')) {
        const entityName = e.target.dataset.entity;
        if (entityName) {
          e.preventDefault();
          e.stopPropagation();
          this.open(entityName);
        }
      }
    });
  }

  async open(entityName) {
    console.log('[EntityCards] Opening card for:', entityName);

    // Show loading state
    this.overlay.innerHTML = `
      <div class="entity-card">
        <button class="entity-card-close" onclick="window.EntityCards.close()">✕</button>
        <div class="entity-card-header">
          <div class="entity-card-avatar">...</div>
          <h2 class="entity-card-name">LOADING</h2>
        </div>
      </div>
    `;
    this.overlay.classList.add('visible');

    // Fetch entity data
    const entity = await this.fetchEntity(entityName);

    if (!entity) {
      console.warn('[EntityCards] Entity not found:', entityName);
      this.renderNotFound(entityName);
      return;
    }

    this.render(entity);
  }

  close() {
    this.overlay.classList.remove('visible');
  }

  async fetchEntity(entityName) {
    try {
      // Fetch from user_entities table
      const { data, error } = await window.supabase
        .from('user_entities')
        .select('*')
        .ilike('name', `%${entityName}%`)
        .limit(1)
        .single();

      if (error) {
        console.error('[EntityCards] Error fetching entity:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[EntityCards] Fetch error:', err);
      return null;
    }
  }

  renderNotFound(entityName) {
    const initial = entityName.charAt(0).toUpperCase();

    this.overlay.innerHTML = `
      <div class="entity-card">
        <button class="entity-card-close" onclick="window.EntityCards.close()">✕</button>

        <div class="entity-card-header">
          <div class="entity-card-avatar">${initial}</div>
          <h2 class="entity-card-name">${entityName.toUpperCase()}</h2>
          <p class="entity-card-relationship">Unknown</p>
        </div>

        <div class="entity-card-section">
          <h3 class="entity-card-section-title">Not Yet Known</h3>
          <p class="entity-card-section-content">
            Inscript hasn't learned enough about ${entityName} yet. Keep writing notes that mention them, and their card will fill in over time.
          </p>
        </div>

        <div class="entity-card-footer">
          <span class="entity-card-stats">0 mentions</span>
        </div>
      </div>
    `;
  }

  render(entity) {
    const initial = entity.name.charAt(0).toUpperCase();
    const relationship = entity.relationship || entity.entity_type || 'Person';
    const context = entity.compressed_context || entity.recent_context || '';
    const pattern = entity.pattern || '';
    const recentQuote = entity.last_mention_context || '';
    const recentDate = entity.updated_at ? this.formatDate(entity.updated_at) : '';
    const mentions = entity.mention_count || 0;
    const since = entity.created_at ? this.formatMonth(entity.created_at) : '';

    this.overlay.innerHTML = `
      <div class="entity-card">
        <button class="entity-card-close" onclick="window.EntityCards.close()">✕</button>

        <div class="entity-card-header">
          <div class="entity-card-avatar">${initial}</div>
          <h2 class="entity-card-name">${entity.name.toUpperCase()}</h2>
          <p class="entity-card-relationship">${this.capitalizeFirst(relationship)}</p>
        </div>

        ${context ? `
        <div class="entity-card-section">
          <h3 class="entity-card-section-title">Context</h3>
          <p class="entity-card-section-content">${context}</p>
        </div>
        ` : ''}

        ${pattern ? `
        <div class="entity-card-section">
          <h3 class="entity-card-section-title">Pattern</h3>
          <p class="entity-card-section-content">${pattern}</p>
        </div>
        ` : ''}

        ${recentQuote ? `
        <div class="entity-card-section">
          <h3 class="entity-card-section-title">Recent</h3>
          <p class="entity-card-quote">"${recentQuote}"</p>
          ${recentDate ? `<span class="entity-card-quote-date">— ${recentDate}</span>` : ''}
        </div>
        ` : ''}

        <div class="entity-card-footer">
          <span class="entity-card-stats">${mentions} mention${mentions !== 1 ? 's' : ''}${since ? ` · Since ${since}` : ''}</span>
        </div>
      </div>
    `;
  }

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatMonth(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '");
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.EntityCards = new EntityCards();
  });
} else {
  window.EntityCards = new EntityCards();
}
