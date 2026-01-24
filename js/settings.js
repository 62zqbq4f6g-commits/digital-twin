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
    const confirmed = confirm('Sign out of your account?');
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
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Current PIN is incorrect.');
      } else {
        alert('Current PIN is incorrect.');
      }
      return;
    }

    // Validate new PIN
    if (newPIN.length < 4) {
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('PIN must be at least 4 digits.');
      } else {
        alert('PIN must be at least 4 digits.');
      }
      return;
    }

    if (newPIN !== confirmPIN) {
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('New PINs do not match.');
      } else {
        alert('New PINs do not match.');
      }
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
    const firstConfirm = confirm(
      'This will permanently delete ALL your data including notes, entities, and everything the Twin has learned. This cannot be undone.\n\nAre you sure?'
    );

    if (!firstConfirm) return;

    // Second confirmation: require typing DELETE
    const typed = prompt('To confirm deletion, please type DELETE in all caps:');

    if (typed !== 'DELETE') {
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Deletion cancelled. You must type DELETE to confirm.');
      }
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
      const notes = await DB.getAllNotes();

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
        setTimeout(() => {
          if (registration.waiting) {
            const shouldUpdate = confirm('A new version is available. Would you like to update now?');
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
  }
};
