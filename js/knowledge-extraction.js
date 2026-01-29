/**
 * KNOWLEDGE EXTRACTION CLIENT
 *
 * Client-side module that hooks into all user input events
 * and routes them to the extraction API.
 *
 * Listens for:
 * - note-saved: Regular notes, meetings, voice transcripts
 * - profile-updated: YOU tab changes, onboarding data
 * - key-person-added: New key people
 * - key-person-updated: Key person edits
 * - settings-changed: User preferences
 *
 * All extraction is fire-and-forget to not block UI.
 *
 * @module js/knowledge-extraction
 */

const KnowledgeExtraction = {
  VERSION: '1.0.0',
  initialized: false,

  // Track recent extractions to avoid duplicates
  recentExtractions: new Map(),
  DEBOUNCE_MS: 5000, // Don't re-extract same item within 5 seconds

  /**
   * Initialize knowledge extraction hooks
   */
  init() {
    if (this.initialized) {
      console.log('[KnowledgeExtraction] Already initialized');
      return;
    }

    // Hook into note saves
    window.addEventListener('note-saved', (e) => this.handleNoteSaved(e));

    // Hook into profile updates
    window.addEventListener('profile-updated', (e) => this.handleProfileUpdated(e));

    // Hook into key people changes
    window.addEventListener('key-person-added', (e) => this.handleKeyPersonAdded(e));
    window.addEventListener('key-person-updated', (e) => this.handleKeyPersonUpdated(e));

    // Hook into settings changes
    window.addEventListener('settings-changed', (e) => this.handleSettingsChanged(e));

    // Hook into onboarding completion
    window.addEventListener('onboarding-complete', (e) => this.handleOnboardingComplete(e));

    this.initialized = true;
    console.log('[KnowledgeExtraction] Initialized v' + this.VERSION);
  },

  /**
   * Handle note-saved event
   * Extract knowledge from all note types
   */
  async handleNoteSaved(event) {
    const { noteId, content, title, noteType, inputType } = event.detail || {};

    if (!noteId || !content) {
      return;
    }

    // Debounce
    if (this.isDuplicate('note', noteId)) {
      console.log('[KnowledgeExtraction] Skipping duplicate note extraction:', noteId);
      return;
    }

    // Determine extraction type based on note/input type
    let type = 'note';
    if (noteType === 'meeting' || inputType === 'meeting') {
      type = 'meeting';
    } else if (inputType === 'voice' || inputType === 'whisper') {
      type = 'voice';
    } else if (inputType === 'ambient') {
      type = 'ambient';
    }

    console.log(`[KnowledgeExtraction] Extracting from ${type}:`, noteId);

    await this.extract(type, {
      noteId,
      content,
      title,
      noteType: type
    });
  },

  /**
   * Handle profile-updated event
   * Extract knowledge from profile changes
   */
  async handleProfileUpdated(event) {
    const profileData = event.detail || {};

    if (Object.keys(profileData).length === 0) {
      return;
    }

    // Debounce on profile
    if (this.isDuplicate('profile', 'current')) {
      console.log('[KnowledgeExtraction] Skipping duplicate profile extraction');
      return;
    }

    console.log('[KnowledgeExtraction] Extracting from profile update');

    await this.extract('profile', profileData);
  },

  /**
   * Handle key-person-added event
   */
  async handleKeyPersonAdded(event) {
    const { name, relationship, notes } = event.detail || {};

    if (!name || !relationship) {
      return;
    }

    // Debounce
    if (this.isDuplicate('key_person', name)) {
      return;
    }

    console.log('[KnowledgeExtraction] Extracting from key person:', name);

    await this.extract('key_person', {
      name,
      relationship,
      notes
    });
  },

  /**
   * Handle key-person-updated event
   */
  async handleKeyPersonUpdated(event) {
    const { name, relationship, notes, previousName } = event.detail || {};

    if (!name || !relationship) {
      return;
    }

    // Debounce
    if (this.isDuplicate('key_person', name)) {
      return;
    }

    console.log('[KnowledgeExtraction] Extracting from key person update:', name);

    await this.extract('key_person', {
      name,
      relationship,
      notes,
      isUpdate: true,
      previousName
    });
  },

  /**
   * Handle settings-changed event
   */
  async handleSettingsChanged(event) {
    const settings = event.detail || {};

    // Only extract relevant settings
    const relevantKeys = ['context_mode', 'tier', 'tone', 'verbosity'];
    const relevantSettings = {};
    let hasRelevant = false;

    for (const key of relevantKeys) {
      if (settings[key] !== undefined) {
        relevantSettings[key] = settings[key];
        hasRelevant = true;
      }
    }

    if (!hasRelevant) {
      return;
    }

    // Debounce
    if (this.isDuplicate('settings', 'current')) {
      return;
    }

    console.log('[KnowledgeExtraction] Extracting from settings');

    await this.extract('settings', relevantSettings);
  },

  /**
   * Handle onboarding-complete event
   * Full profile extraction after onboarding
   */
  async handleOnboardingComplete(event) {
    const onboardingData = event.detail || {};

    console.log('[KnowledgeExtraction] Extracting from onboarding completion');

    await this.extract('onboarding', onboardingData);
  },

  /**
   * Send extraction request to API
   * Fire-and-forget pattern
   */
  async extract(type, data) {
    try {
      const token = await this.getToken();
      if (!token) {
        console.warn('[KnowledgeExtraction] No auth token available');
        return;
      }

      // Fire and forget
      fetch('/api/extract-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          data,
          async: true // Don't wait for completion
        })
      }).then(res => {
        if (!res.ok) {
          console.warn('[KnowledgeExtraction] Extraction request failed:', res.status);
        }
      }).catch(err => {
        console.warn('[KnowledgeExtraction] Extraction request error:', err.message);
      });

      // Mark as extracted
      this.markExtracted(type, data.noteId || data.name || 'current');

    } catch (error) {
      console.error('[KnowledgeExtraction] Extract error:', error);
    }
  },

  /**
   * Check if item was recently extracted (debounce)
   */
  isDuplicate(type, id) {
    const key = `${type}:${id}`;
    const lastExtracted = this.recentExtractions.get(key);

    if (lastExtracted && Date.now() - lastExtracted < this.DEBOUNCE_MS) {
      return true;
    }

    return false;
  },

  /**
   * Mark item as extracted
   */
  markExtracted(type, id) {
    const key = `${type}:${id}`;
    this.recentExtractions.set(key, Date.now());

    // Cleanup old entries periodically
    if (this.recentExtractions.size > 100) {
      const cutoff = Date.now() - this.DEBOUNCE_MS * 2;
      for (const [k, v] of this.recentExtractions.entries()) {
        if (v < cutoff) {
          this.recentExtractions.delete(k);
        }
      }
    }
  },

  /**
   * Get auth token
   */
  async getToken() {
    // Try Sync module
    if (typeof Sync !== 'undefined' && Sync.getToken) {
      return Sync.getToken();
    }

    // Try supabase directly
    if (typeof supabase !== 'undefined') {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token;
    }

    return null;
  },

  /**
   * Manually trigger extraction for existing data
   * Useful for backfilling knowledge graph
   */
  async extractExisting(type, data) {
    console.log(`[KnowledgeExtraction] Manual extraction for ${type}`);
    return this.extract(type, data);
  }
};

// Auto-initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => KnowledgeExtraction.init());
} else {
  KnowledgeExtraction.init();
}

// Export for module use
window.KnowledgeExtraction = KnowledgeExtraction;
