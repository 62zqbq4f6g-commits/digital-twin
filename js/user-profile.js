/**
 * User Profile - Self-awareness for the Twin
 * Phase 8: About Me Profile
 * Allows Twin to know who the user is and personalize all interactions
 */

window.UserProfile = {
  profile: null,
  _loaded: false,

  /**
   * Load profile from Supabase, decrypt with PIN
   */
  async load() {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.warn('[UserProfile] Supabase not available');
        return null;
      }

      // Use Sync.user directly (already set by Sync.init()) instead of making another API call
      const user = Sync.user;

      if (!user) {
        console.warn('[UserProfile] No authenticated user (Sync.user is null)');
        return null;
      }

      console.log('[UserProfile] Loading for user:', user.id);

      const { data, error } = await Sync.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[UserProfile] Load error:', error);
        return null;
      }

      if (data) {
        // Decrypt fields
        this.profile = {
          id: data.id,
          userId: data.user_id,
          displayName: data.display_name_encrypted ?
            await this._decrypt(data.display_name_encrypted) : '',
          aboutMe: data.about_me_encrypted ?
            await this._decrypt(data.about_me_encrypted) : '',
          selfDescriptors: data.self_descriptors || [],
          preferences: data.preferences || {},
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      } else {
        // No profile yet
        this.profile = {
          userId: user.id,
          displayName: '',
          aboutMe: '',
          selfDescriptors: [],
          preferences: {}
        };
      }

      this._loaded = true;
      console.log('[UserProfile] Loaded:', this.profile.displayName || '(no name)');
      return this.profile;

    } catch (error) {
      console.error('[UserProfile] Load failed:', error);
      return null;
    }
  },

  /**
   * Save profile updates to Supabase
   * @param {Object} updates - { displayName, aboutMe, selfDescriptors, preferences }
   */
  async save(updates) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.error('[UserProfile] Supabase not available');
        return false;
      }

      // Use Sync.user directly (already set by Sync.init()) instead of making another API call
      const user = Sync.user;

      if (!user) {
        console.error('[UserProfile] No authenticated user (Sync.user is null)');
        return false;
      }

      console.log('[UserProfile] Saving for user:', user.id);

      // Merge updates with current profile
      if (!this.profile) {
        this.profile = {
          userId: user.id,
          displayName: '',
          aboutMe: '',
          selfDescriptors: [],
          preferences: {}
        };
      }

      if (updates.displayName !== undefined) {
        this.profile.displayName = updates.displayName;
      }
      if (updates.aboutMe !== undefined) {
        this.profile.aboutMe = updates.aboutMe;
      }
      if (updates.selfDescriptors !== undefined) {
        this.profile.selfDescriptors = updates.selfDescriptors;
      }
      if (updates.preferences !== undefined) {
        this.profile.preferences = { ...this.profile.preferences, ...updates.preferences };
      }

      // Encrypt sensitive fields
      const encryptedData = {
        user_id: user.id,
        display_name_encrypted: this.profile.displayName ?
          await this._encrypt(this.profile.displayName) : null,
        about_me_encrypted: this.profile.aboutMe ?
          await this._encrypt(this.profile.aboutMe) : null,
        self_descriptors: this.profile.selfDescriptors,
        preferences: this.profile.preferences,
        updated_at: new Date().toISOString()
      };

      // Upsert to Supabase
      const { error } = await Sync.supabase
        .from('user_profiles')
        .upsert(encryptedData, { onConflict: 'user_id' });

      if (error) {
        console.error('[UserProfile] Save error:', error);
        return false;
      }

      console.log('[UserProfile] Saved successfully');
      return true;

    } catch (error) {
      console.error('[UserProfile] Save failed:', error);
      return false;
    }
  },

  /**
   * Get formatted context for analysis prompts
   * @returns {Object} { userName, aboutMe, descriptors }
   */
  async getContextForAnalysis() {
    // Load if not loaded
    if (!this._loaded) {
      await this.load();
    }

    if (!this.profile || !this.profile.displayName) {
      return null;
    }

    return {
      userName: this.profile.displayName,
      aboutMe: this.profile.aboutMe || '',
      descriptors: this.profile.selfDescriptors || []
    };
  },

  /**
   * Check if note content is describing self (selfie or "I am..." statements)
   * @param {string} noteContent - Raw note content
   * @param {boolean} hasImage - Whether note has an image
   * @returns {boolean}
   */
  isDescribingSelf(noteContent, hasImage = false) {
    if (!noteContent) return false;

    const content = noteContent.toLowerCase();

    // Self-reference patterns
    const selfPatterns = [
      /^i am\b/,
      /^i'm\b/,
      /^i feel\b/,
      /^i look\b/,
      /^i think\b/,
      /^i want\b/,
      /^i need\b/,
      /\bme today\b/,
      /\bmy face\b/,
      /\bmyself\b/,
      /\bthis is me\b/,
      /\bhow i look\b/,
      /\bhow i feel\b/
    ];

    const isSelfReferencing = selfPatterns.some(pattern => pattern.test(content));

    // If has image and first-person language, likely selfie
    if (hasImage && isSelfReferencing) {
      return true;
    }

    // Strong self-description starters
    if (/^(i am|i'm) (a |an |feeling |looking )/.test(content)) {
      return true;
    }

    return false;
  },

  /**
   * Encrypt a string using PIN encryption
   * @param {string} plaintext
   * @returns {string} Encrypted string
   */
  async _encrypt(plaintext) {
    if (!plaintext) return null;

    if (typeof PIN !== 'undefined' && PIN.encrypt) {
      return await PIN.encrypt(plaintext);
    }

    // Fallback: return as-is (not ideal but prevents data loss)
    console.warn('[UserProfile] PIN encryption not available');
    return plaintext;
  },

  /**
   * Decrypt a string using PIN decryption
   * @param {string} ciphertext
   * @returns {string} Decrypted string
   */
  async _decrypt(ciphertext) {
    if (!ciphertext) return null;

    if (typeof PIN !== 'undefined' && PIN.decrypt) {
      try {
        return await PIN.decrypt(ciphertext);
      } catch (e) {
        // Decryption can fail if key changed or data is corrupted - graceful fallback
        console.warn('[UserProfile] Decryption failed (key mismatch or corrupted data):', e.message || e);
        return null;
      }
    }

    // Fallback: return as-is (unencrypted data)
    return ciphertext;
  },

  /**
   * Initialize - called on app load
   */
  async init() {
    console.log('[UserProfile] Initializing...');
    await this.load();
    console.log('[UserProfile] Initialized');
  },

  /**
   * Clear profile (for logout)
   */
  clear() {
    this.profile = null;
    this._loaded = false;
    console.log('[UserProfile] Cleared');
  }
};
