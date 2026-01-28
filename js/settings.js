/**
 * Inscript - Settings Page
 * Handles all account, security, and data settings
 */

window.Settings = {
  /**
   * Show settings page
   */
  show() {
    console.log('[Settings] Opening settings page');

    const user = Sync.user;
    const container = document.getElementById('app');

    // Get sync status
    const syncStatus = this.getSyncStatus();

    container.innerHTML = `
      <div class="settings-page">
        <header class="settings-header">
          <button class="settings-back-btn" onclick="Settings.close()">
            <span class="settings-back-arrow">\u2190</span>
            <span>Back</span>
          </button>
          <h1 class="settings-title">Settings</h1>
          <div class="settings-header-spacer"></div>
        </header>

        <div class="settings-content">
          <section class="settings-section">
            <h2 class="settings-section-title">Account</h2>
            <div class="settings-item">
              <span class="settings-item-label">Email</span>
              <span class="settings-item-value">${user?.email || 'Not signed in'}</span>
            </div>
            ${syncStatus ? `<div class="settings-sync-status">${syncStatus}</div>` : ''}
            <button class="settings-btn btn-secondary" onclick="Settings.signOut()">
              Sign Out
            </button>
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">Security</h2>
            <button class="settings-btn btn-secondary" onclick="Settings.changePIN()">
              Change PIN
            </button>
            <button class="settings-btn btn-secondary" onclick="Settings.lockApp()">
              Lock App
            </button>
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">MIRROR</h2>
            <div class="settings-item">
              <span class="settings-item-label">Context Mode</span>
              <select id="context-mode-select" class="settings-select" onchange="Settings.setContextMode(this.value)">
                <option value="auto">Auto (Recommended)</option>
                <option value="rag">Fast (Lower cost)</option>
                <option value="full">Deep (Full memory)</option>
              </select>
            </div>
            <p class="settings-help">
              <strong>Auto:</strong> Smart routing — simple queries use fast retrieval, complex queries load your full memory.<br>
              <strong>Fast:</strong> Always use targeted retrieval. Cheaper but may miss context.<br>
              <strong>Deep:</strong> Always load your complete memory. More thorough but higher cost.
            </p>
          </section>

          <section class="settings-section settings-privacy">
            <h3 class="settings-section-title">Privacy & Security</h3>

            <div class="privacy-info">
              <div class="privacy-item">
                <span class="privacy-check">\u2713</span>
                <span>Encrypted at rest and in transit</span>
              </div>
              <div class="privacy-item">
                <span class="privacy-check">\u2713</span>
                <span>Protected by row-level security</span>
              </div>
              <div class="privacy-item">
                <span class="privacy-check">\u2713</span>
                <span>Never used for AI model training</span>
              </div>
              <div class="privacy-item">
                <span class="privacy-check">\u2713</span>
                <span>Never sold or shared with third parties</span>
              </div>
              <div class="privacy-item">
                <span class="privacy-check">\u2713</span>
                <span>Permanently deletable at any time</span>
              </div>
            </div>

            <div class="privacy-details">
              <h4>How AI analysis works</h4>
              <p>Your notes are processed by our AI to generate reflections.
              Under our AI provider's enterprise terms, your content is not
              used for training. After processing, only the insights remain.</p>
            </div>

            <div class="privacy-actions">
              <button class="settings-btn btn-secondary" onclick="Settings.exportData()">
                Export my data
              </button>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">Data</h2>
            <button class="settings-btn btn-danger" onclick="Settings.deleteAllData()">
              Delete All My Data
            </button>
            <p class="settings-warning">This will permanently delete all your notes and data.</p>
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">About</h2>
            <div class="settings-item">
              <span class="settings-item-label">Version</span>
              <span class="settings-item-value">${window.APP_VERSION || '8.8.0'}</span>
            </div>
            <button class="settings-btn btn-secondary" onclick="Settings.checkForUpdates()">
              Check for Updates
            </button>
            <p class="settings-tagline">Your Mirror in Code</p>
          </section>
        </div>
      </div>
    `;

    // EXPORT - T3: Initialize Export UI after settings page renders
    if (typeof ExportUI !== 'undefined') {
      setTimeout(() => ExportUI.init(), 0);
    }

    // Load context mode preference
    this.loadContextMode();
  },

  /**
   * Load context mode preference from server
   */
  async loadContextMode() {
    try {
      const token = await Sync.getToken();
      if (!token) return;

      const response = await fetch('/api/user-settings?key=mirror_context_mode', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mode = data.value || 'auto';
        const select = document.getElementById('context-mode-select');
        if (select) {
          select.value = mode;
        }
      }
    } catch (e) {
      console.error('[Settings] Failed to load context mode:', e);
    }
  },

  /**
   * Set context mode preference
   */
  async setContextMode(mode) {
    try {
      const token = await Sync.getToken();
      if (!token) {
        UI.showError('Not signed in');
        return;
      }

      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'mirror_context_mode',
          value: mode
        })
      });

      if (response.ok) {
        UI.showToast(`Context mode set to ${mode === 'auto' ? 'Auto' : mode === 'rag' ? 'Fast' : 'Deep'}`);
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      console.error('[Settings] Failed to save context mode:', e);
      UI.showError('Could not save setting');
    }
  },

  /**
   * Get sync status message
   */
  getSyncStatus() {
    try {
      const lastSync = localStorage.getItem('lastSyncTime');
      if (!lastSync) {
        return Sync.user ? 'Synced to cloud' : null;
      }

      const lastSyncDate = new Date(lastSync);
      const now = new Date();
      const diffMs = now - lastSyncDate;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) {
        return 'Synced just now';
      } else if (diffMins < 60) {
        return `Last synced ${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          return `Last synced ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        } else {
          return `Last synced ${lastSyncDate.toLocaleDateString()}`;
        }
      }
    } catch (e) {
      return null;
    }
  },

  /**
   * Close settings and return to app
   */
  close() {
    console.log('[Settings] Closing settings page');
    UI.init();
  },

  /**
   * Sign out of account
   */
  async signOut() {
    const confirmed = await UI.confirm('Sign out of your account?', {
      title: 'Sign Out',
      confirmText: 'Sign Out',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    console.log('[Settings] Signing out');

    try {
      await Sync.signOut();
      location.reload();
    } catch (error) {
      console.error('[Settings] Sign out failed:', error);
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Could not sign out. Please try again.');
      }
    }
  },

  /**
   * Change PIN
   */
  async changePIN() {
    console.log('[Settings] Change PIN requested');

    // Show PIN change UI
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="settings-page">
        <header class="settings-header">
          <button class="settings-back-btn" onclick="Settings.show()">
            <span class="settings-back-arrow">\u2190</span>
            <span>Back</span>
          </button>
          <h1 class="settings-title">Change PIN</h1>
          <div class="settings-header-spacer"></div>
        </header>

        <div class="settings-content">
          <section class="settings-section">
            <h2 class="settings-section-title">Enter Current PIN</h2>
            <input
              type="password"
              id="current-pin"
              class="settings-pin-input"
              placeholder="Current PIN"
              inputmode="numeric"
              maxlength="6"
            >
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">Enter New PIN</h2>
            <input
              type="password"
              id="new-pin"
              class="settings-pin-input"
              placeholder="New PIN (6 digits)"
              inputmode="numeric"
              maxlength="6"
            >
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">Confirm New PIN</h2>
            <input
              type="password"
              id="confirm-pin"
              class="settings-pin-input"
              placeholder="Confirm new PIN"
              inputmode="numeric"
              maxlength="6"
            >
          </section>

          <button class="settings-btn btn-primary" onclick="Settings.savePIN()">
            Save New PIN
          </button>
        </div>
      </div>
    `;

    document.getElementById('current-pin').focus();
  },

  /**
   * Save new PIN
   */
  async savePIN() {
    const currentPIN = document.getElementById('current-pin').value;
    const newPIN = document.getElementById('new-pin').value;
    const confirmPIN = document.getElementById('confirm-pin').value;

    // Validate current PIN
    const isCurrentValid = await PIN.verify(currentPIN);
    if (!isCurrentValid) {
      UI.showToast('Current PIN is incorrect');
      return;
    }

    // Validate new PIN
    if (newPIN.length < 4) {
      UI.showToast('PIN must be at least 4 digits');
      return;
    }

    if (newPIN !== confirmPIN) {
      UI.showToast('New PINs do not match');
      return;
    }

    // Save new PIN
    try {
      await PIN.save(newPIN);
      if (typeof UI !== 'undefined' && UI.showSuccess) {
        UI.showSuccess('PIN changed successfully.');
      }
      this.show();
    } catch (error) {
      console.error('[Settings] PIN change failed:', error);
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Could not change PIN. Please try again.');
      }
    }
  },

  /**
   * Lock the app
   */
  lockApp() {
    console.log('[Settings] Locking app');
    if (typeof UI !== 'undefined' && UI.lockApp) {
      UI.lockApp();
    } else if (typeof PIN !== 'undefined' && PIN.lock) {
      PIN.lock();
      location.reload();
    }
  },

  /**
   * Delete all user data with safety confirmation
   * Requires typing "DELETE" to confirm (per Abacus.ai feedback)
   */
  async deleteAllData() {
    // First confirmation
    const firstConfirm = await UI.confirm(
      'This will permanently delete ALL your data including notes, entities, and everything the Twin has learned. This cannot be undone.',
      {
        title: 'Delete All Data',
        confirmText: 'Continue',
        cancelText: 'Cancel',
        danger: true
      }
    );

    if (!firstConfirm) return;

    // Second confirmation: require typing DELETE
    const typed = await this.showDeletePrompt();

    if (typed !== 'DELETE') {
      UI.showToast('Deletion cancelled');
      return;
    }

    console.log('[Settings] Deleting all user data');

    try {
      // Delete from local DB
      if (typeof DB !== 'undefined' && DB.deleteAllUserData) {
        await DB.deleteAllUserData();
      }

      // Clear localStorage for this user
      const userId = Sync.user?.id;
      if (userId) {
        // Clear onboarding state
        localStorage.removeItem('onboarding_complete_' + userId);
      }

      if (typeof UI !== 'undefined' && UI.showSuccess) {
        UI.showSuccess('All data deleted.');
      }

      setTimeout(() => {
        location.reload();
      }, 1500);
    } catch (error) {
      console.error('[Settings] Delete failed:', error);
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Could not delete all data. Please try again.');
      }
    }
  },

  /**
   * Export all user data as JSON
   */
  async exportData() {
    console.log('[Settings] Exporting user data');

    try {
      // Get all notes from local DB
      const notes = await NotesManager.getAll();

      // Get twin profile
      const twinProfile = await DB.loadTwinProfile();

      // Get onboarding data if available
      let onboardingData = null;
      if (Sync.supabase && Sync.user) {
        const { data } = await Sync.supabase
          .from('onboarding_data')
          .select('*')
          .eq('user_id', Sync.user.id)
          .single();
        onboardingData = data;
      }

      // Build export object
      const exportObj = {
        exportDate: new Date().toISOString(),
        version: window.APP_VERSION || '8.0.0',
        notes: notes,
        twinProfile: twinProfile,
        onboardingData: onboardingData
      };

      // Create download
      const json = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscript-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (typeof UI !== 'undefined' && UI.showSuccess) {
        UI.showSuccess('Data exported successfully.');
      }
    } catch (error) {
      console.error('[Settings] Export failed:', error);
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Could not export data. Please try again.');
      }
    }
  },

  /**
   * Check for updates by forcing service worker update
   */
  async checkForUpdates() {
    console.log('[Settings] Checking for updates');

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();

        if (typeof UI !== 'undefined' && UI.showSuccess) {
          UI.showSuccess('Checking for updates...');
        }

        // Check if there's a waiting worker (new version available)
        setTimeout(async () => {
          if (registration.waiting) {
            const shouldUpdate = await UI.confirm('A new version is available. Would you like to update now?', {
              title: 'Update Available',
              confirmText: 'Update Now',
              cancelText: 'Later'
            });
            if (shouldUpdate) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              location.reload();
            }
          } else {
            if (typeof UI !== 'undefined' && UI.showSuccess) {
              UI.showSuccess('You have the latest version.');
            }
          }
        }, 1000);
      } else {
        if (typeof UI !== 'undefined' && UI.showSuccess) {
          UI.showSuccess('You have the latest version.');
        }
      }
    } catch (error) {
      console.error('[Settings] Update check failed:', error);
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Could not check for updates.');
      }
    }
  },

  /**
   * Show custom prompt dialog for DELETE confirmation
   * @returns {Promise<string>} The typed value
   */
  showDeletePrompt() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog">
          <h3 class="dialog-title">Confirm Deletion</h3>
          <p class="dialog-message">To confirm deletion, type DELETE in all caps:</p>
          <input
            type="text"
            id="delete-confirm-input"
            class="dialog-input"
            placeholder="Type DELETE"
            autocomplete="off"
          >
          <div class="dialog-actions">
            <button class="dialog-btn dialog-btn-cancel">Cancel</button>
            <button class="dialog-btn dialog-btn-danger">Delete Everything</button>
          </div>
        </div>
      `;

      const cancelBtn = overlay.querySelector('.dialog-btn-cancel');
      const confirmBtn = overlay.querySelector('.dialog-btn-danger');
      const input = overlay.querySelector('#delete-confirm-input');

      const cleanup = () => {
        overlay.remove();
      };

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve('');
      });

      confirmBtn.addEventListener('click', () => {
        const value = input.value.trim();
        cleanup();
        resolve(value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          cleanup();
          resolve(value);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve('');
        }
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve('');
        }
      });

      document.body.appendChild(overlay);
      input.focus();
    });
  }
};
