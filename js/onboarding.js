/**
 * Digital Twin - Onboarding Flow
 * Welcomes new users and guides their first experience
 */

window.Onboarding = {
  STORAGE_KEY_PREFIX: 'onboarding_complete_',

  /**
   * Get storage key for current user
   */
  getStorageKey() {
    const userId = Sync.user?.id;
    if (!userId) return null;
    return this.STORAGE_KEY_PREFIX + userId;
  },

  /**
   * Check if onboarding should be shown
   * Returns true if: user signed in, no notes, onboarding not completed
   */
  shouldShow() {
    // Must have a user (either Supabase or local PIN)
    const storageKey = this.getStorageKey();
    if (!storageKey) return false;

    // Check if already completed
    const completed = localStorage.getItem(storageKey);
    if (completed === 'true') return false;

    // Check if user has notes
    const hasNotes = DB.notes && DB.notes.length > 0;
    if (hasNotes) {
      // User has notes, mark onboarding as complete
      this.markComplete();
      return false;
    }

    return true;
  },

  /**
   * Mark onboarding as complete for current user
   */
  markComplete() {
    const storageKey = this.getStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
  },

  /**
   * Start the onboarding flow
   */
  start() {
    console.log('[Onboarding] Starting onboarding flow');
    this.showWelcome();
  },

  /**
   * Screen 1: Welcome
   */
  showWelcome() {
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content">
          <h1 class="onboarding-title">Welcome to<br>Your Mirror in Code</h1>
          <p class="onboarding-description">A digital version of you, trained by your daily inputs, growing smarter over time.</p>
          <button class="btn-primary onboarding-btn" onclick="Onboarding.showAboutYou()">Get Started</button>
        </div>
      </div>
    `;
  },

  /**
   * Screen 2: About You
   */
  showAboutYou() {
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content">
          <h2 class="onboarding-heading">What should I call you?</h2>
          <input
            type="text"
            id="onboarding-name"
            class="onboarding-input"
            placeholder="Your name"
            autocomplete="off"
          >

          <h2 class="onboarding-heading onboarding-heading-spaced">Tell me a bit about yourself</h2>
          <p class="onboarding-optional">Optional</p>
          <textarea
            id="onboarding-about"
            class="onboarding-textarea"
            placeholder="I'm a founder, dog lover, based in Singapore..."
            rows="3"
          ></textarea>

          <div class="onboarding-buttons">
            <button class="btn-secondary" onclick="Onboarding.showFirstNote()">Skip</button>
            <button class="btn-primary" onclick="Onboarding.saveAboutAndContinue()">Continue</button>
          </div>
        </div>
      </div>
    `;

    // Focus name input
    document.getElementById('onboarding-name').focus();
  },

  /**
   * Save About You data and continue
   * Saves immediately to prevent data loss if user closes app
   */
  async saveAboutAndContinue() {
    const name = document.getElementById('onboarding-name').value.trim();
    const about = document.getElementById('onboarding-about').value.trim();

    if (name || about) {
      try {
        // Check if UserProfile exists and user is signed into Supabase
        if (typeof UserProfile !== 'undefined' && Sync.user) {
          await UserProfile.save({
            display_name: name,
            about_me: about
          });
          console.log('[Onboarding] Saved user profile to Supabase');
        } else {
          // Store locally if not signed in
          localStorage.setItem('onboarding_name', name);
          localStorage.setItem('onboarding_about', about);
          console.log('[Onboarding] Saved user profile locally');
        }
      } catch (error) {
        console.error('[Onboarding] Failed to save profile:', error);
        // Store locally as fallback
        localStorage.setItem('onboarding_name', name);
        localStorage.setItem('onboarding_about', about);
      }
    }

    this.showFirstNote();
  },

  /**
   * Screen 3: First Note
   */
  showFirstNote() {
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content onboarding-content-wide">
          <h2 class="onboarding-heading">Capture your first thought</h2>
          <p class="onboarding-description">What's on your mind?</p>

          <textarea
            id="onboarding-note"
            class="onboarding-note-input"
            placeholder="Start typing..."
            rows="4"
          ></textarea>

          <p class="onboarding-hint">You can also try voice or add a photo later</p>

          <button class="btn-primary onboarding-btn" onclick="Onboarding.saveFirstNote()">Save</button>
        </div>
      </div>
    `;

    document.getElementById('onboarding-note').focus();
  },

  /**
   * Save first note and show success
   */
  async saveFirstNote() {
    const noteContent = document.getElementById('onboarding-note').value.trim();

    if (!noteContent) {
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Please enter something first');
      } else {
        alert('Please enter something first');
      }
      return;
    }

    // Show loading state
    const btn = document.querySelector('.onboarding-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    try {
      // Create note using App.processNote for full pipeline (analysis, etc.)
      if (typeof App !== 'undefined' && App.processNote) {
        await App.processNote(noteContent, 'text');
      } else if (typeof DB !== 'undefined') {
        // Fallback to direct DB save with proper structure
        const note = {
          id: DB.generateId ? DB.generateId() : Date.now().toString(),
          content: noteContent,
          type: 'text',
          created_at: new Date().toISOString(),
          input: {
            type: 'text',
            raw_text: noteContent
          },
          // Include refined data for display
          refined: {
            summary: noteContent.substring(0, 100) + (noteContent.length > 100 ? '...' : ''),
            actions: []
          },
          classification: {
            category: 'personal_reflection'
          }
        };
        await DB.saveNote(note);
      }

      console.log('[Onboarding] First note saved');
      this.showSuccess();
    } catch (error) {
      console.error('[Onboarding] Failed to save note:', error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save';
      }
      if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError('Could not save note. Please try again.');
      } else {
        alert('Could not save note. Please try again.');
      }
    }
  },

  /**
   * Screen 4: Success
   * Uses Vogue minimalist styling with wide letter-spacing
   * Shows loading line that fills over 2 seconds before transition
   */
  showSuccess() {
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="onboarding-screen">
        <div class="onboarding-content">
          <h2 class="onboarding-success-title">Perfect.</h2>
          <p class="onboarding-success-text">I'll remember this.</p>
          <div class="onboarding-loading-line"></div>
        </div>
      </div>
    `;

    // Mark complete and transition to app after 2 seconds
    this.markComplete();

    setTimeout(() => {
      console.log('[Onboarding] Transitioning to app');
      this.complete();
    }, 2000);
  },

  /**
   * Complete onboarding and load normal app
   * Uses reload to restore proper DOM structure
   */
  complete() {
    console.log('[Onboarding] Complete, reloading app');
    location.reload();
  }
};
