/**
 * INSCRIPT: Privacy Controls UI
 *
 * T3 Frontend Lead - Sprint 2
 * OWNER: T3
 *
 * Features:
 * - Privacy management section in Settings
 * - Toggle entities and notes as private
 * - Integrates with ExportUI privacy indicator
 *
 * Design System:
 * - Black/white/silver only
 * - 1px borders
 * - Inter font for UI
 * - Playfair Display for headings
 */

const PrivacyControls = {

  /**
   * Initialize privacy controls
   */
  init() {
    this.injectPrivacySection();
    this.loadPrivateItems();
    console.log('[PrivacyControls] Initialized');
  },

  /**
   * Inject privacy management section into Settings
   */
  injectPrivacySection() {
    const container = document.querySelector('#screen-settings');
    if (!container) return;

    // Check if already exists
    if (document.getElementById('privacy-management-section')) return;

    const section = document.createElement('div');
    section.id = 'privacy-management-section';
    section.className = 'settings-section privacy-section';
    section.innerHTML = `
      <h2 class="settings-heading privacy-title">PRIVACY CONTROLS</h2>

      <p class="privacy-description">
        Mark items as private to exclude them from exports.
        Private items stay in Inscript but won't be shared.
      </p>

      <div class="privacy-tabs">
        <button class="privacy-tab active" data-tab="entities">People & Projects</button>
        <button class="privacy-tab" data-tab="notes">Notes</button>
      </div>

      <div id="privacy-list" class="privacy-list">
        <div class="privacy-loading">Loading...</div>
      </div>
    `;

    // Insert after export section
    const exportSection = document.getElementById('export-section');
    if (exportSection && exportSection.nextSibling) {
      container.insertBefore(section, exportSection.nextSibling);
    } else {
      // Fallback: insert before danger zone
      const dangerZone = container.querySelector('.settings-danger-zone');
      if (dangerZone) {
        container.insertBefore(section, dangerZone);
      } else {
        container.appendChild(section);
      }
    }

    // Bind tab events
    section.querySelectorAll('.privacy-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  },

  /**
   * Switch between entities and notes tabs
   */
  switchTab(tab) {
    document.querySelectorAll('.privacy-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    this.loadPrivateItems(tab);
  },

  /**
   * Load items for privacy management
   */
  async loadPrivateItems(tab = 'entities') {
    const list = document.getElementById('privacy-list');
    if (!list) return;

    list.innerHTML = '<div class="privacy-loading">Loading...</div>';

    const token = await this.getAuthToken();
    if (!token) {
      list.innerHTML = '<div class="privacy-empty">Please sign in to manage privacy</div>';
      return;
    }

    try {
      // Determine endpoint based on tab
      const endpoint = tab === 'entities' ? '/api/entities' : '/api/notes';
      const response = await fetch(`${endpoint}?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load items');
      }

      const data = await response.json();
      // Handle both array response and {data: []} response
      const items = Array.isArray(data) ? data : (data.data || data.items || []);
      this.renderPrivacyList(items, tab);

    } catch (err) {
      console.error('[PrivacyControls] Load failed:', err);
      list.innerHTML = '<div class="privacy-error">Failed to load items</div>';
    }
  },

  /**
   * Render the privacy list
   */
  renderPrivacyList(items, tab) {
    const list = document.getElementById('privacy-list');
    if (!list) return;

    if (!items?.length) {
      list.innerHTML = `<div class="privacy-empty">No ${tab === 'entities' ? 'people or projects' : 'notes'} found</div>`;
      return;
    }

    list.innerHTML = items.map(item => {
      const name = item.name || item.title || (item.content?.substring(0, 50) + '...') || 'Untitled';
      const isPrivate = item.privacy_level === 'private';
      const type = tab === 'entities' ? (item.entity_type || 'entity') : 'note';

      return `
        <div class="privacy-item ${isPrivate ? 'is-private' : ''}" data-id="${item.id}" data-type="${tab}">
          <div class="privacy-item-info">
            <span class="privacy-item-name">${this.escapeHtml(name)}</span>
            ${tab === 'entities' ? `<span class="privacy-item-type">${type}</span>` : ''}
          </div>
          <label class="privacy-toggle">
            <input type="checkbox"
                   ${isPrivate ? 'checked' : ''}
                   onchange="PrivacyControls.togglePrivacy('${item.id}', '${tab}', this.checked)">
            <span class="privacy-toggle-label">Private</span>
          </label>
        </div>
      `;
    }).join('');
  },

  /**
   * Toggle privacy level for an item
   */
  async togglePrivacy(id, type, isPrivate) {
    const token = await this.getAuthToken();
    if (!token) return;

    const table = type === 'entities' ? 'user_entities' : 'notes';
    const newLevel = isPrivate ? 'private' : 'internal';

    try {
      const response = await fetch('/api/update-privacy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table, id, privacy_level: newLevel })
      });

      if (!response.ok) throw new Error('Failed to update');

      // Update UI
      const item = document.querySelector(`.privacy-item[data-id="${id}"]`);
      if (item) {
        item.classList.toggle('is-private', isPrivate);
      }

      // Refresh export privacy indicator
      if (window.ExportUI) {
        ExportUI.fetchPrivacySummary();
      }

      console.log(`[PrivacyControls] ${id} set to ${newLevel}`);

    } catch (err) {
      console.error('[PrivacyControls] Toggle failed:', err);
      // Revert checkbox
      const checkbox = document.querySelector(`.privacy-item[data-id="${id}"] input`);
      if (checkbox) checkbox.checked = !isPrivate;
    }
  },

  /**
   * Get auth token
   */
  async getAuthToken() {
    // Try Sync.supabase first
    if (typeof Sync !== 'undefined' && Sync.supabase) {
      const { data: { session } } = await Sync.supabase.auth.getSession();
      return session?.access_token;
    }
    // Fallback to window.supabase
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session?.access_token;
    }
    return null;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
};

// Make available globally
window.PrivacyControls = PrivacyControls;
