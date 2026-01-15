/**
 * Twin Profile - Core data structure representing the user
 * Manages storage, retrieval, and updates of the twin profile
 */

const TwinProfile = {
  STORE_NAME: 'twin_profile',
  PROFILE_ID: 'current',

  // Default empty profile structure (from PRD Section 6)
  getDefaultProfile() {
    return {
      id: this.PROFILE_ID,

      // IDENTITY - How you express yourself
      identity: {
        writing: {
          vocabulary: {
            frequent: [],
            avoided: [],
            signature: [],
            industryTerms: []
          },
          tone: {
            directness: 0.5,
            formality: 0.5,
            confidence: 0.5,
            provocative: 0.5,
            personal: 0.5
          },
          structure: {
            avgSentenceLength: 0,
            paragraphStyle: 'medium',
            usesLists: false,
            usesQuestions: false,
            usesEmojis: false
          },
          patterns: {
            opensWithHook: 0,
            endsWithCTA: 0,
            usesAnalogies: 0,
            usesData: 0
          },
          examples: {
            strongPosts: [],
            signaturePhrases: []
          }
        },
        speaking: {
          pace: 'medium',
          energy: 0.5,
          fillerWords: [],
          explanationStyle: 'direct',
          emphasisPatterns: []
        },
        visual: {
          subjectsPhotographed: [],
          aesthetic: 'minimal',
          whatMatters: []
        }
      },

      // BELIEFS - What you think
      beliefs: {
        opinions: [],
        values: [],
        contrarian: [],
        evolving: []
      },

      // PATTERNS - How you behave
      patterns: {
        temporal: {
          mostCreative: null,
          mostReflective: null,
          mostProductive: [],
          captureFrequency: {
            daily: 0,
            byHour: {},
            byDay: {}
          }
        },
        behavioral: {
          topicDistribution: {},
          inputPreference: { text: 0, voice: 0, image: 0 },
          sessionLength: 'short'
        },
        emotional: {
          baselineEnergy: 0.5,
          stressIndicators: [],
          excitementIndicators: []
        }
      },

      // RELATIONSHIPS - Who and what matters
      relationships: {
        people: [],
        projects: [],
        companies: []
      },

      // GOALS - What you want
      goals: {
        active: [],
        completed: [],
        recurring: []
      },

      // KNOWLEDGE - What you know
      knowledge: {
        expertise: [],
        learning: [],
        questions: []
      },

      // META
      meta: {
        version: '1.0',
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notesAnalyzed: 0,
        confidenceScore: 0,
        lastFullAnalysis: null
      }
    };
  },

  /**
   * Load profile from IndexedDB
   */
  async load() {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(this.PROFILE_ID);
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            // Return default profile if none exists
            resolve(this.getDefaultProfile());
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[TwinProfile] Load error:', error);
      return this.getDefaultProfile();
    }
  },

  /**
   * Save profile to IndexedDB
   */
  async save(profile) {
    try {
      profile.meta.lastUpdated = new Date().toISOString();

      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.put(profile);
        request.onsuccess = () => {
          console.log('[TwinProfile] Saved successfully');
          resolve(profile);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[TwinProfile] Save error:', error);
      throw error;
    }
  },

  /**
   * Update specific section of profile
   */
  async update(section, data) {
    const profile = await this.load();

    // Deep merge the section
    if (profile[section]) {
      profile[section] = this.deepMerge(profile[section], data);
    } else {
      profile[section] = data;
    }

    return this.save(profile);
  },

  /**
   * Get specific section of profile
   */
  async getSection(section) {
    const profile = await this.load();
    return profile[section] || null;
  },

  /**
   * Merge new data into profile (for incremental updates)
   */
  async merge(newData) {
    const profile = await this.load();
    const merged = this.deepMerge(profile, newData);
    merged.meta.notesAnalyzed = (profile.meta.notesAnalyzed || 0) + 1;
    merged.meta.confidenceScore = this.calculateConfidence(merged);
    return this.save(merged);
  },

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] instanceof Array) {
        // For arrays, merge unique values
        result[key] = this.mergeArrays(target[key] || [], source[key]);
      } else if (source[key] && typeof source[key] === 'object') {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined && source[key] !== null) {
        result[key] = source[key];
      }
    }

    return result;
  },

  /**
   * Merge arrays, avoiding duplicates for objects with name/id
   */
  mergeArrays(existing, incoming) {
    if (!incoming || incoming.length === 0) return existing;
    if (!existing || existing.length === 0) return incoming;

    const result = [...existing];

    for (const item of incoming) {
      if (typeof item === 'object' && item !== null) {
        // Find existing by name, id, or topic
        const key = item.name || item.id || item.topic || item.goal;
        const existingIndex = result.findIndex(e =>
          (e.name || e.id || e.topic || e.goal) === key
        );

        if (existingIndex >= 0) {
          // Update existing item
          result[existingIndex] = this.deepMerge(result[existingIndex], item);
        } else {
          result.push(item);
        }
      } else {
        // Primitive values - add if not exists
        if (!result.includes(item)) {
          result.push(item);
        }
      }
    }

    return result;
  },

  /**
   * Calculate confidence score based on data completeness
   */
  calculateConfidence(profile) {
    let score = 0;
    const weights = {
      notesAnalyzed: 0.3,
      entities: 0.2,
      beliefs: 0.15,
      patterns: 0.15,
      vocabulary: 0.1,
      relationships: 0.1
    };

    // Notes analyzed (max contribution at 50 notes)
    const notesFactor = Math.min(profile.meta.notesAnalyzed / 50, 1);
    score += notesFactor * weights.notesAnalyzed;

    // Entities (people, projects, companies)
    const entityCount =
      (profile.relationships.people?.length || 0) +
      (profile.relationships.projects?.length || 0) +
      (profile.relationships.companies?.length || 0);
    score += Math.min(entityCount / 20, 1) * weights.entities;

    // Beliefs
    const beliefCount =
      (profile.beliefs.opinions?.length || 0) +
      (profile.beliefs.values?.length || 0);
    score += Math.min(beliefCount / 10, 1) * weights.beliefs;

    // Patterns
    const hasPatterns =
      Object.keys(profile.patterns.temporal.captureFrequency.byHour || {}).length > 0;
    score += (hasPatterns ? 1 : 0) * weights.patterns;

    // Vocabulary
    const vocabCount =
      (profile.identity.writing.vocabulary.frequent?.length || 0) +
      (profile.identity.writing.vocabulary.signature?.length || 0);
    score += Math.min(vocabCount / 20, 1) * weights.vocabulary;

    // Relationships
    score += Math.min((profile.relationships.people?.length || 0) / 10, 1) * weights.relationships;

    return Math.round(score * 100) / 100;
  },

  /**
   * Sync profile to cloud (encrypted)
   */
  async syncToCloud() {
    if (typeof Sync === 'undefined' || !Sync.isAuthenticated()) {
      console.log('[TwinProfile] Not authenticated, skipping cloud sync');
      return;
    }

    try {
      const profile = await this.load();
      const encrypted = await PIN.encrypt(JSON.stringify(profile));

      await Sync.supabase
        .from('twin_profiles')
        .upsert({
          user_id: Sync.user.id,
          encrypted_profile: encrypted,
          version: profile.meta.version,
          notes_analyzed: profile.meta.notesAnalyzed,
          confidence_score: profile.meta.confidenceScore,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      console.log('[TwinProfile] Synced to cloud');
    } catch (error) {
      console.error('[TwinProfile] Cloud sync error:', error);
    }
  },

  /**
   * Load profile from cloud
   */
  async loadFromCloud() {
    if (typeof Sync === 'undefined' || !Sync.isAuthenticated()) {
      return null;
    }

    try {
      const { data, error } = await Sync.supabase
        .from('twin_profiles')
        .select('encrypted_profile')
        .eq('user_id', Sync.user.id)
        .maybeSingle();

      if (error || !data) {
        console.log('[TwinProfile] No cloud profile found');
        return null;
      }

      const decrypted = await PIN.decrypt(data.encrypted_profile);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[TwinProfile] Cloud load error:', error);
      return null;
    }
  },

  /**
   * Get IndexedDB database - use shared connection from DB module
   */
  async getDB() {
    // Use the shared DB connection to avoid version conflicts
    if (typeof DB !== 'undefined' && DB.initDB) {
      return DB.initDB();
    }

    // Fallback - should not happen in normal operation
    console.warn('[TwinProfile] DB module not available, using direct connection');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('digital-twin', 3);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TwinProfile = TwinProfile;
}
