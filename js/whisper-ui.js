/**
 * Whisper UI - Quick Capture Mode
 * Phase 15: Experience Transformation
 *
 * Provides frictionless note capture without triggering full reflection.
 * V1 is TEXT-ONLY (no voice support per FIX 3).
 * All whispers are E2E encrypted using the same key as notes.
 */

const WhisperUI = {
  // State
  isOpen: false,
  isSaving: false,
  selectedWhispers: new Set(),
  whisperHistory: [],

  /**
   * Initialize Whisper UI
   */
  init() {
    console.log('[WhisperUI] Initializing...');
    this.injectHTML();
    this.attachListeners();
    console.log('[WhisperUI] Initialized');
  },

  /**
   * Inject HTML templates
   */
  injectHTML() {
    // Whisper overlay
    if (!document.getElementById('whisper-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'whisper-overlay';
      overlay.className = 'whisper-overlay';
      overlay.innerHTML = `
        <div class="whisper-modal">
          <div class="whisper-header">
            <h3 class="whisper-title">Whisper Mode</h3>
            <button class="whisper-close" aria-label="Close">&times;</button>
          </div>
          <div class="whisper-input-container">
            <textarea
              id="whisper-input"
              class="whisper-input"
              placeholder="Quick thought..."
              rows="3"
              maxlength="500"
            ></textarea>
          </div>
          <button id="whisper-submit" class="whisper-submit" disabled>
            Heard
          </button>
          <p class="whisper-hint">No reflection. Just captured.</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Whisper confirmation
    if (!document.getElementById('whisper-confirmation')) {
      const confirmation = document.createElement('div');
      confirmation.id = 'whisper-confirmation';
      confirmation.className = 'whisper-confirmation';
      confirmation.innerHTML = `
        <div class="whisper-confirmation__content">
          <div class="whisper-confirmation__check">&#10003;</div>
          <p class="whisper-confirmation__text">Heard</p>
        </div>
      `;
      document.body.appendChild(confirmation);
    }

    // Selection bar (for batch reflect)
    if (!document.getElementById('whisper-selection-bar')) {
      const selectionBar = document.createElement('div');
      selectionBar.id = 'whisper-selection-bar';
      selectionBar.className = 'whisper-selection-bar';
      selectionBar.innerHTML = `
        <span class="whisper-selection-bar__count">0 selected</span>
        <button class="whisper-selection-bar__btn whisper-selection-bar__btn--reflect">Reflect</button>
        <button class="whisper-selection-bar__btn whisper-selection-bar__btn--clear">&times;</button>
      `;
      document.body.appendChild(selectionBar);
    }
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Global click handler
    document.addEventListener('click', (e) => {
      // Whisper trigger button
      if (e.target.closest('.whisper-trigger')) {
        this.open();
        return;
      }

      // Close button
      if (e.target.closest('.whisper-close')) {
        this.close();
        return;
      }

      // Overlay background click
      if (e.target.id === 'whisper-overlay') {
        this.close();
        return;
      }

      // Submit button
      if (e.target.id === 'whisper-submit' || e.target.closest('#whisper-submit')) {
        this.save();
        return;
      }

      // Whisper item selection (in history)
      const whisperItem = e.target.closest('.whisper-item');
      if (whisperItem && !e.target.closest('.whisper-item__entity')) {
        const id = whisperItem.dataset.id;
        if (id) this.toggleSelection(id);
        return;
      }

      // Batch reflect button
      if (e.target.closest('.whisper-selection-bar__btn--reflect')) {
        this.batchReflect();
        return;
      }

      // Clear selection button
      if (e.target.closest('.whisper-selection-bar__btn--clear')) {
        this.clearSelection();
        return;
      }
    });

    // Input change handler
    const input = document.getElementById('whisper-input');
    if (input) {
      input.addEventListener('input', (e) => {
        const submitBtn = document.getElementById('whisper-submit');
        if (submitBtn) {
          submitBtn.disabled = !e.target.value.trim();
        }
      });

      // Enter key to submit (with shift for newline)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (e.target.value.trim()) {
            this.save();
          }
        }
      });
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  },

  /**
   * Open whisper mode
   */
  open() {
    const overlay = document.getElementById('whisper-overlay');
    const input = document.getElementById('whisper-input');

    if (overlay) {
      overlay.classList.add('whisper-overlay--visible');
      this.isOpen = true;

      // Focus input after animation
      setTimeout(() => {
        if (input) {
          input.value = '';
          input.focus();
        }
      }, 100);
    }
  },

  /**
   * Close whisper mode
   */
  close() {
    const overlay = document.getElementById('whisper-overlay');
    if (overlay) {
      overlay.classList.remove('whisper-overlay--visible');
      this.isOpen = false;
    }
  },

  /**
   * Save a whisper
   */
  async save() {
    if (this.isSaving) return;

    const input = document.getElementById('whisper-input');
    const content = input?.value?.trim();

    if (!content) return;

    this.isSaving = true;
    const submitBtn = document.getElementById('whisper-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      // Encrypt content
      const encrypted = await this.encryptWhisper(content);

      // Get user ID
      const userId = await this.getUserId();
      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Save to API
      const response = await fetch('/api/whisper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          content_encrypted: encrypted.content,
          iv: encrypted.iv
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save whisper');
      }

      console.log('[WhisperUI] Whisper saved:', data.id);

      // Show confirmation
      this.close();
      this.showConfirmation();

      // Clear input
      if (input) input.value = '';

    } catch (error) {
      console.error('[WhisperUI] Save error:', error);
      alert('Failed to save whisper. Please try again.');
    } finally {
      this.isSaving = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Heard';
      }
    }
  },

  /**
   * Show confirmation animation
   */
  showConfirmation() {
    const confirmation = document.getElementById('whisper-confirmation');
    if (confirmation) {
      confirmation.classList.add('whisper-confirmation--visible');

      // Hide after delay
      setTimeout(() => {
        confirmation.classList.remove('whisper-confirmation--visible');
      }, 1500);
    }
  },

  /**
   * Load whisper history
   */
  async loadHistory(container) {
    try {
      const userId = await this.getUserId();
      if (!userId) {
        this.renderEmptyState(container);
        return;
      }

      const response = await fetch(`/api/whisper?user_id=${userId}&limit=50`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load whispers');
      }

      this.whisperHistory = data.whispers || [];

      if (this.whisperHistory.length === 0) {
        this.renderEmptyState(container);
      } else {
        await this.renderHistory(container);
      }
    } catch (error) {
      console.error('[WhisperUI] Load history error:', error);
      this.renderEmptyState(container, 'Unable to load whispers');
    }
  },

  /**
   * Render whisper history
   */
  async renderHistory(container) {
    if (!container) return;

    const items = await Promise.all(
      this.whisperHistory.map(async (whisper) => {
        // Decrypt content
        let content = '';
        try {
          content = await this.decryptWhisper(whisper.content_encrypted, whisper.iv);
        } catch (e) {
          content = '[Unable to decrypt]';
        }

        const time = this.formatTime(whisper.created_at);
        const isSelected = this.selectedWhispers.has(whisper.id);
        const entities = whisper.entities_extracted || [];

        return `
          <div class="whisper-item ${isSelected ? 'whisper-item--selected' : ''}" data-id="${whisper.id}">
            <p class="whisper-item__content">${this.escapeHtml(content)}</p>
            <div class="whisper-item__meta">
              <span class="whisper-item__time">${time}</span>
              ${entities.length > 0 ? `
                <div class="whisper-item__entities">
                  ${entities.slice(0, 3).map(e => `<span class="whisper-item__entity">${e}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      })
    );

    container.innerHTML = `
      <div class="whisper-history__header">
        <h3 class="whisper-history__title">Recent Whispers</h3>
        <button class="whisper-history__reflect-btn" ${this.selectedWhispers.size === 0 ? 'disabled' : ''}>
          Reflect on Selected
        </button>
      </div>
      <div class="whisper-list">
        ${items.join('')}
      </div>
    `;
  },

  /**
   * Render empty state
   */
  renderEmptyState(container, message) {
    if (!container) return;

    container.innerHTML = `
      <div class="whisper-empty">
        <p class="whisper-empty__message">${message || 'Your whispers will appear here'}</p>
        <p class="whisper-empty__hint">Quick thoughts, no reflection needed.</p>
      </div>
    `;
  },

  /**
   * Toggle whisper selection
   */
  toggleSelection(id) {
    if (this.selectedWhispers.has(id)) {
      this.selectedWhispers.delete(id);
    } else {
      this.selectedWhispers.add(id);
    }

    // Update UI
    const item = document.querySelector(`.whisper-item[data-id="${id}"]`);
    if (item) {
      item.classList.toggle('whisper-item--selected', this.selectedWhispers.has(id));
    }

    this.updateSelectionBar();
  },

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedWhispers.clear();

    // Update UI
    document.querySelectorAll('.whisper-item--selected').forEach(item => {
      item.classList.remove('whisper-item--selected');
    });

    this.updateSelectionBar();
  },

  /**
   * Update selection bar visibility and count
   */
  updateSelectionBar() {
    const bar = document.getElementById('whisper-selection-bar');
    if (!bar) return;

    const count = this.selectedWhispers.size;

    if (count > 0) {
      bar.classList.add('whisper-selection-bar--visible');
      bar.querySelector('.whisper-selection-bar__count').textContent = `${count} selected`;
    } else {
      bar.classList.remove('whisper-selection-bar--visible');
    }
  },

  /**
   * Batch reflect on selected whispers
   */
  async batchReflect() {
    if (this.selectedWhispers.size === 0) return;

    const reflectBtn = document.querySelector('.whisper-selection-bar__btn--reflect');
    if (reflectBtn) {
      reflectBtn.disabled = true;
      reflectBtn.textContent = 'Reflecting...';
    }

    try {
      const userId = await this.getUserId();
      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Get decrypted contents
      const whisperIds = Array.from(this.selectedWhispers);
      const decryptedContents = [];

      for (const id of whisperIds) {
        const whisper = this.whisperHistory.find(w => w.id === id);
        if (whisper) {
          try {
            const content = await this.decryptWhisper(whisper.content_encrypted, whisper.iv);
            decryptedContents.push(content);
          } catch (e) {
            console.warn('[WhisperUI] Could not decrypt whisper:', id);
          }
        }
      }

      if (decryptedContents.length === 0) {
        throw new Error('No whispers could be decrypted');
      }

      // Call batch reflect API
      const response = await fetch('/api/whisper-reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          whisper_ids: whisperIds,
          decrypted_contents: decryptedContents
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reflection');
      }

      console.log('[WhisperUI] Batch reflection generated');

      // Show reflection in a modal or dialog
      this.showReflection(data.reflection);

      // Clear selection
      this.clearSelection();

    } catch (error) {
      console.error('[WhisperUI] Batch reflect error:', error);
      alert('Failed to generate reflection. Please try again.');
    } finally {
      if (reflectBtn) {
        reflectBtn.disabled = false;
        reflectBtn.textContent = 'Reflect';
      }
    }
  },

  /**
   * Show reflection result
   */
  showReflection(reflection) {
    // Create a simple modal for the reflection
    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">Reflection</h3>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <p class="reflection-text">${this.escapeHtml(reflection)}</p>
        </div>
      </div>
    `;

    // Close handler
    modal.addEventListener('click', (e) => {
      if (e.target.closest('.modal__close') || e.target === modal) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
  },

  // ===== ENCRYPTION HELPERS =====

  /**
   * Encrypt whisper content
   * Returns { content: base64, iv: base64 }
   */
  async encryptWhisper(plaintext) {
    // Use PIN encryption key if available, fall back to Auth
    const key = this.getEncryptionKey();
    if (!key) {
      throw new Error('Encryption key not available');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );

    return {
      content: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
  },

  /**
   * Decrypt whisper content
   */
  async decryptWhisper(contentB64, ivB64) {
    const key = this.getEncryptionKey();
    if (!key) {
      throw new Error('Encryption key not available');
    }

    const content = Uint8Array.from(atob(contentB64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      content
    );

    return new TextDecoder().decode(decrypted);
  },

  /**
   * Get encryption key
   */
  getEncryptionKey() {
    // Try PIN first, then Auth
    if (typeof PIN !== 'undefined' && PIN.encryptionKey) {
      return PIN.encryptionKey;
    }
    if (typeof Auth !== 'undefined' && Auth.encryptionKey) {
      return Auth.encryptionKey;
    }
    return null;
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
   * Format timestamp
   */
  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WhisperUI.init());
} else {
  WhisperUI.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WhisperUI;
}
