/**
 * js/memory-decrypt.js - Client-side Decryption for Derived Data
 *
 * Decrypts encrypted memory data (entities, patterns, summaries, key people)
 * using the user's encryption key. This enables zero-knowledge storage
 * where only the client can read derived memories.
 */

const MemoryDecrypt = {
  /**
   * Decrypt a single encrypted blob
   * Format: "iv:authTag:encrypted" (all base64)
   * @param {string} encryptedString - The encrypted data
   * @returns {Object|null} Decrypted JSON object or null on failure
   */
  async decrypt(encryptedString) {
    if (!encryptedString) return null;

    try {
      // Get encryption key from Auth
      const key = await this.getEncryptionKey();
      if (!key) {
        console.warn('[MemoryDecrypt] No encryption key available');
        return null;
      }

      // Check if this looks like our encrypted format (contains colons)
      if (typeof encryptedString !== 'string' || !encryptedString.includes(':')) {
        // Not encrypted - return as-is (backwards compatibility)
        if (typeof encryptedString === 'string') {
          try {
            return JSON.parse(encryptedString);
          } catch {
            return encryptedString;
          }
        }
        return encryptedString;
      }

      // Parse encrypted format: iv:authTag:ciphertext
      const parts = encryptedString.split(':');
      if (parts.length !== 3) {
        console.warn('[MemoryDecrypt] Invalid encrypted format');
        return null;
      }

      const [ivB64, authTagB64, ciphertextB64] = parts;

      // Decode from base64
      const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
      const authTag = Uint8Array.from(atob(authTagB64), c => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));

      // Combine ciphertext and authTag for AES-GCM
      const combined = new Uint8Array(ciphertext.length + authTag.length);
      combined.set(ciphertext);
      combined.set(authTag, ciphertext.length);

      // Decrypt using AES-GCM
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        combined
      );

      // Parse JSON result
      const text = new TextDecoder().decode(decrypted);
      return JSON.parse(text);

    } catch (error) {
      console.warn('[MemoryDecrypt] Decrypt failed:', error.message);
      return null;
    }
  },

  /**
   * Get the encryption key from Auth module
   * @returns {CryptoKey|null}
   */
  async getEncryptionKey() {
    if (typeof Auth !== 'undefined' && Auth.encryptionKey) {
      return Auth.encryptionKey;
    }
    if (typeof PIN !== 'undefined' && PIN.encryptionKey) {
      return PIN.encryptionKey;
    }
    return null;
  },

  /**
   * Decrypt array of entities, merging with unencrypted metadata
   * @param {Array} entities - Array of entity records from DB
   * @returns {Array} Decrypted entities
   */
  async decryptEntities(entities) {
    if (!entities || !Array.isArray(entities)) return [];

    const results = await Promise.all(entities.map(async (entity) => {
      // Check if entity has encrypted_data field
      if (entity.encrypted_data) {
        const decrypted = await this.decrypt(entity.encrypted_data);
        if (decrypted) {
          return {
            // Unencrypted metadata (kept for queries)
            id: entity.id,
            user_id: entity.user_id,
            entity_type: entity.entity_type,
            status: entity.status,
            mention_count: entity.mention_count,
            importance_score: entity.importance_score,
            first_mentioned_at: entity.first_mentioned_at,
            last_mentioned_at: entity.last_mentioned_at,
            created_at: entity.created_at,
            // Decrypted sensitive data
            ...decrypted
          };
        }
      }

      // Return as-is if no encrypted_data (backwards compatibility)
      return entity;
    }));

    return results.filter(e => e !== null);
  },

  /**
   * Decrypt array of patterns, merging with confidence/status
   * @param {Array} patterns - Array of pattern records from DB
   * @returns {Array} Decrypted patterns
   */
  async decryptPatterns(patterns) {
    if (!patterns || !Array.isArray(patterns)) return [];

    const results = await Promise.all(patterns.map(async (pattern) => {
      if (pattern.encrypted_data) {
        const decrypted = await this.decrypt(pattern.encrypted_data);
        if (decrypted) {
          return {
            // Unencrypted metadata
            id: pattern.id,
            user_id: pattern.user_id,
            pattern_type: pattern.pattern_type,
            confidence: pattern.confidence,
            status: pattern.status,
            created_at: pattern.created_at,
            // Decrypted content
            ...decrypted
          };
        }
      }
      return pattern;
    }));

    return results.filter(p => p !== null);
  },

  /**
   * Decrypt array of category summaries, keeping category unencrypted
   * @param {Array} summaries - Array of summary records from DB
   * @returns {Array} Decrypted summaries
   */
  async decryptSummaries(summaries) {
    if (!summaries || !Array.isArray(summaries)) return [];

    const results = await Promise.all(summaries.map(async (summary) => {
      if (summary.encrypted_data) {
        const decrypted = await this.decrypt(summary.encrypted_data);
        if (decrypted) {
          return {
            // Unencrypted metadata
            id: summary.id,
            user_id: summary.user_id,
            category: summary.category,
            entity_count: summary.entity_count,
            updated_at: summary.updated_at,
            // Decrypted content
            ...decrypted
          };
        }
      }
      return summary;
    }));

    return results.filter(s => s !== null);
  },

  /**
   * Decrypt array of key people
   * @param {Array} people - Array of key people records from DB
   * @returns {Array} Decrypted key people
   */
  async decryptKeyPeople(people) {
    if (!people || !Array.isArray(people)) return [];

    const results = await Promise.all(people.map(async (person) => {
      if (person.encrypted_data) {
        const decrypted = await this.decrypt(person.encrypted_data);
        if (decrypted) {
          return {
            // Unencrypted metadata
            id: person.id,
            user_id: person.user_id,
            added_via: person.added_via,
            created_at: person.created_at,
            // Decrypted content
            ...decrypted
          };
        }
      }
      return person;
    }));

    return results.filter(p => p !== null);
  },

  /**
   * Main function: Fetch and decrypt all memory data for a user
   * @param {string} userId - User ID
   * @returns {Object} { entities, patterns, summaries, keyPeople }
   */
  async getDecryptedMemory(userId) {
    if (!userId) {
      console.warn('[MemoryDecrypt] No userId provided');
      return { entities: [], patterns: [], summaries: [], keyPeople: [] };
    }

    if (typeof Sync === 'undefined' || !Sync.supabase) {
      console.warn('[MemoryDecrypt] Supabase not available');
      return { entities: [], patterns: [], summaries: [], keyPeople: [] };
    }

    try {
      console.log('[MemoryDecrypt] Fetching memory data for user:', userId);

      // Fetch all 4 tables in parallel
      const [entitiesRes, patternsRes, summariesRes, keyPeopleRes] = await Promise.all([
        Sync.supabase
          .from('user_entities')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('importance_score', { ascending: false })
          .limit(30),

        Sync.supabase
          .from('user_patterns')
          .select('*')
          .eq('user_id', userId)
          .gte('confidence', 0.5)
          .order('confidence', { ascending: false })
          .limit(15),

        Sync.supabase
          .from('category_summaries')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(10),

        Sync.supabase
          .from('user_key_people')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      // Log any errors
      if (entitiesRes.error) console.warn('[MemoryDecrypt] Entities error:', entitiesRes.error.message);
      if (patternsRes.error) console.warn('[MemoryDecrypt] Patterns error:', patternsRes.error.message);
      if (summariesRes.error) console.warn('[MemoryDecrypt] Summaries error:', summariesRes.error.message);
      if (keyPeopleRes.error) console.warn('[MemoryDecrypt] KeyPeople error:', keyPeopleRes.error.message);

      // Decrypt all data in parallel
      const [entities, patterns, summaries, keyPeople] = await Promise.all([
        this.decryptEntities(entitiesRes.data || []),
        this.decryptPatterns(patternsRes.data || []),
        this.decryptSummaries(summariesRes.data || []),
        this.decryptKeyPeople(keyPeopleRes.data || [])
      ]);

      console.log('[MemoryDecrypt] Decrypted:', {
        entities: entities.length,
        patterns: patterns.length,
        summaries: summaries.length,
        keyPeople: keyPeople.length
      });

      return { entities, patterns, summaries, keyPeople };

    } catch (error) {
      console.error('[MemoryDecrypt] Error fetching memory:', error);
      return { entities: [], patterns: [], summaries: [], keyPeople: [] };
    }
  },

  /**
   * Build context block for API calls (formatted string)
   * @param {Object} memory - Decrypted memory from getDecryptedMemory
   * @param {Object} profile - User profile (onboarding + preferences)
   * @returns {string} Formatted context string
   */
  buildContextBlock(memory, profile = {}) {
    const parts = [];

    // User name
    if (profile.name) {
      parts.push(`User's name: ${profile.name}`);
    }

    // Role types
    if (profile.role_types?.length > 0) {
      const labels = {
        'BUILDING': 'building something new',
        'LEADING': 'leading others',
        'MAKING': 'deep in the work',
        'LEARNING': 'learning and exploring',
        'JUGGLING': 'juggling multiple things',
        'TRANSITIONING': 'between chapters'
      };
      const formatted = profile.role_types.map(r => labels[r] || r.toLowerCase()).join(', ');
      parts.push(`How they describe their days: ${formatted}`);
    }

    // Goals
    if (profile.goals?.length > 0) {
      const labels = {
        'DECISIONS': 'think through decisions',
        'PROCESS': 'process what happened',
        'ORGANIZE': 'stay on top of things',
        'SELF_UNDERSTANDING': 'understand yourself better',
        'REMEMBER': 'remember what matters',
        'EXPLORING': 'explore'
      };
      const formatted = profile.goals.map(g => labels[g] || g.toLowerCase()).join(', ');
      parts.push(`They're here to: ${formatted}`);
    }

    // Tone
    if (profile.tone) {
      const labels = {
        'DIRECT': 'direct and efficient',
        'WARM': 'warm and supportive',
        'CHALLENGING': 'challenging',
        'ADAPTIVE': 'adaptive to your energy'
      };
      parts.push(`Preferred tone: ${labels[profile.tone] || profile.tone}`);
    }

    // Life context
    if (profile.life_context) {
      parts.push(`What's on their plate: ${profile.life_context}`);
    }

    // Key people
    if (memory.keyPeople?.length > 0) {
      parts.push('');
      parts.push('KEY PEOPLE:');
      memory.keyPeople.forEach(p => {
        parts.push(`- ${p.name}: ${p.relationship || 'important person'}`);
      });
    }

    // Category summaries
    if (memory.summaries?.length > 0) {
      parts.push('');
      parts.push('What you know about them:');
      memory.summaries.forEach(s => {
        parts.push(`- ${s.category.replace('_', ' ')}: ${s.summary}`);
      });
    }

    // Top entities (non-key-people)
    const keyPeopleNames = new Set(memory.keyPeople.map(p => p.name?.toLowerCase()));
    const otherEntities = memory.entities.filter(e =>
      !keyPeopleNames.has(e.name?.toLowerCase())
    ).slice(0, 10);

    if (otherEntities.length > 0) {
      parts.push('');
      parts.push('People and topics from their notes:');
      otherEntities.forEach(e => {
        const rel = e.relationship ? ` (${e.relationship})` : '';
        const mentions = e.mention_count > 1 ? `, mentioned ${e.mention_count}x` : '';
        parts.push(`- ${e.name} [${e.entity_type}${rel}${mentions}]`);
      });
    }

    // Patterns
    if (memory.patterns?.length > 0) {
      parts.push('');
      parts.push('Patterns observed:');
      memory.patterns.forEach(p => {
        parts.push(`- ${p.short_description} (${Math.round(p.confidence * 100)}% confidence)`);
      });
    }

    return parts.join('\n');
  }
};

// Export for global access
window.MemoryDecrypt = MemoryDecrypt;
