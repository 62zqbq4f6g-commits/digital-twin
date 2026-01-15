/**
 * Entity Memory - Stores and retrieves entities from Supabase
 * Phase 6: Activate Memory System
 */

const EntityMemory = {
  // Phase 8: Local cache for quick lookups
  _entities: [],
  _loaded: false,

  /**
   * Phase 8: Get current user ID
   */
  async getUserId() {
    if (typeof Sync === 'undefined' || !Sync.supabase) return null;
    const { data: { user } } = await Sync.supabase.auth.getUser();
    return user?.id || null;
  },

  /**
   * Phase 8: Get a single entity by ID
   * @param {string} entityId - Entity UUID
   * @returns {Object|null} Entity or null
   */
  async getEntity(entityId) {
    // First check local cache
    if (this._entities.length > 0) {
      const cached = this._entities.find(e => e.id === entityId);
      if (cached) return cached;
    }

    // Fetch from Supabase if not in cache
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return null;

      const { data, error } = await Sync.supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .maybeSingle();

      if (error || !data) return null;

      // Decrypt name
      return {
        ...data,
        name: await this.decryptName(data.name_encrypted),
        details: data.metadata?.species || data.metadata?.context || '',
        relationship_to_user: data.relationship_to_user || ''
      };
    } catch (error) {
      console.error('[EntityMemory] getEntity error:', error);
      return null;
    }
  },

  /**
   * Phase 8: Update an entity with corrections
   * @param {string} entityId - Entity UUID
   * @param {Object} updates - { name, type, relationship_to_user, details }
   * @returns {Object|null} Updated entity or null
   */
  async updateEntity(entityId, updates) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return null;

      const entity = await this.getEntity(entityId);
      if (!entity) return null;

      // Track what changed for learning
      const changes = [];
      for (const [key, value] of Object.entries(updates)) {
        if (entity[key] !== value && value !== undefined) {
          changes.push({
            field: key,
            old: entity[key],
            new: value
          });
        }
      }

      // Build Supabase update
      const supabaseUpdate = {
        user_corrected: true,
        updated_at: new Date().toISOString()
      };

      // Handle name change (needs encryption)
      if (updates.name && updates.name !== entity.name) {
        supabaseUpdate.name_encrypted = await this.encryptName(updates.name);
      }

      // Handle type change
      if (updates.type) {
        supabaseUpdate.type = updates.type;
      }

      // Handle relationship_to_user
      if (updates.relationship_to_user !== undefined) {
        supabaseUpdate.relationship_to_user = updates.relationship_to_user;
      }

      // Handle details - store in metadata
      if (updates.details !== undefined) {
        const currentMetadata = entity.metadata || {};
        supabaseUpdate.metadata = {
          ...currentMetadata,
          context: updates.details,
          species: updates.type === 'pet' ? updates.details : currentMetadata.species
        };
      }

      // Update Supabase
      const { error } = await Sync.supabase
        .from('entities')
        .update(supabaseUpdate)
        .eq('id', entityId);

      if (error) {
        console.error('[EntityMemory] Update failed:', error);
        return null;
      }

      // Store corrections for learning
      await this.storeCorrections(entityId, changes);

      // Update local cache
      const updatedEntity = { ...entity, ...updates };
      const cacheIndex = this._entities.findIndex(e => e.id === entityId);
      if (cacheIndex >= 0) {
        this._entities[cacheIndex] = updatedEntity;
      }

      console.log(`[EntityMemory] Updated entity: ${updates.name || entity.name}`);
      return updatedEntity;

    } catch (error) {
      console.error('[EntityMemory] updateEntity error:', error);
      return null;
    }
  },

  /**
   * Phase 8: Store corrections for learning
   * @param {string} entityId - Entity UUID
   * @param {Array} changes - Array of { field, old, new }
   */
  async storeCorrections(entityId, changes) {
    try {
      const userId = await this.getUserId();
      if (!userId || changes.length === 0) return;

      const corrections = changes.map(c => ({
        user_id: userId,
        entity_id: entityId,
        field_changed: c.field,
        old_value: String(c.old || ''),
        new_value: String(c.new || ''),
        created_at: new Date().toISOString()
      }));

      const { error } = await Sync.supabase
        .from('entity_corrections')
        .insert(corrections);

      if (error) {
        // Table might not exist yet - that's OK
        console.warn('[EntityMemory] Could not store corrections:', error.message);
      } else {
        console.log(`[EntityMemory] Stored ${corrections.length} corrections`);
      }
    } catch (error) {
      console.warn('[EntityMemory] storeCorrections error:', error);
    }
  },

  /**
   * Phase 8: Delete an entity
   * @param {string} entityId - Entity UUID
   */
  async deleteEntity(entityId) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return;

      const { error } = await Sync.supabase
        .from('entities')
        .delete()
        .eq('id', entityId);

      if (error) {
        console.error('[EntityMemory] Delete failed:', error);
        return;
      }

      // Remove from local cache
      this._entities = this._entities.filter(e => e.id !== entityId);
      console.log('[EntityMemory] Entity deleted');

    } catch (error) {
      console.error('[EntityMemory] deleteEntity error:', error);
    }
  },

  /**
   * Store entities extracted from a note
   * @param {Object} entities - { people: [], dates: [], places: [] }
   * @param {string} noteId - The note ID these entities came from
   * @param {string} noteContent - The note content for context detection
   */
  async storeEntities(entities, noteId, noteContent = '') {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.log('[EntityMemory] Supabase not available');
        return;
      }

      const { data: { user } } = await Sync.supabase.auth.getUser();
      if (!user) {
        console.log('[EntityMemory] No user logged in');
        return;
      }

      const now = new Date().toISOString();
      const entitiesToStore = [];

      // Check if note content suggests pet context
      const isPetNote = /\b(dog|cat|pet|vet|veterinary|puppy|kitten)\b/i.test(noteContent);

      // Process people
      if (entities.people && Array.isArray(entities.people)) {
        for (const person of entities.people) {
          const name = typeof person === 'string' ? person : person.name;
          if (!name || name.length < 2) continue;

          // Determine if this "person" is actually a pet
          const context = typeof person === 'object' ? person.context || '' : '';
          const isPet = isPetNote || this.isPetContext(context, noteContent);

          entitiesToStore.push({
            user_id: user.id,
            type: isPet ? 'pet' : 'person',
            name_encrypted: await this.encryptName(name),
            metadata: {
              original_name: name,
              source_note: noteId,
              context: context || null,
              species: isPet ? this.detectSpecies(noteContent) : null
            },
            first_seen: now,
            last_seen: now
          });
        }
      }

      // Process places
      if (entities.places && Array.isArray(entities.places)) {
        for (const place of entities.places) {
          const name = typeof place === 'string' ? place : place.name;
          if (!name || name.length < 2) continue;

          entitiesToStore.push({
            user_id: user.id,
            type: 'place',
            name_encrypted: await this.encryptName(name),
            metadata: {
              original_name: name,
              source_note: noteId
            },
            first_seen: now,
            last_seen: now
          });
        }
      }

      // Process projects (if present)
      if (entities.projects && Array.isArray(entities.projects)) {
        for (const project of entities.projects) {
          const name = typeof project === 'string' ? project : project.name;
          if (!name || name.length < 2) continue;

          entitiesToStore.push({
            user_id: user.id,
            type: 'project',
            name_encrypted: await this.encryptName(name),
            metadata: {
              original_name: name,
              source_note: noteId
            },
            first_seen: now,
            last_seen: now
          });
        }
      }

      if (entitiesToStore.length === 0) {
        console.log('[EntityMemory] No entities to store');
        return;
      }

      // Upsert entities (update if exists, insert if new)
      for (const entity of entitiesToStore) {
        await this.upsertEntity(entity, user.id);
      }

      console.log(`[EntityMemory] Stored ${entitiesToStore.length} entities`);

    } catch (error) {
      console.error('[EntityMemory] Error storing entities:', error);
    }
  },

  /**
   * Upsert a single entity (update last_seen if exists, insert if new)
   */
  async upsertEntity(entity, userId) {
    try {
      // Check if entity already exists (by name and type)
      // Use maybeSingle() to avoid 406 error when no row exists
      const { data: existing } = await Sync.supabase
        .from('entities')
        .select('id, metadata, first_seen')
        .eq('user_id', userId)
        .eq('type', entity.type)
        .eq('name_encrypted', entity.name_encrypted)
        .maybeSingle();

      if (existing) {
        // Update existing entity
        const updatedMetadata = {
          ...existing.metadata,
          ...entity.metadata,
          mention_count: (existing.metadata?.mention_count || 0) + 1,
          source_notes: [
            ...(existing.metadata?.source_notes || []),
            entity.metadata.source_note
          ].slice(-10) // Keep last 10 source notes
        };

        await Sync.supabase
          .from('entities')
          .update({
            metadata: updatedMetadata,
            last_seen: entity.last_seen
          })
          .eq('id', existing.id);

        console.log(`[EntityMemory] Updated entity: ${entity.metadata.original_name}`);
      } else {
        // Insert new entity
        entity.metadata.mention_count = 1;
        entity.metadata.source_notes = [entity.metadata.source_note];

        await Sync.supabase
          .from('entities')
          .insert(entity);

        console.log(`[EntityMemory] Created entity: ${entity.metadata.original_name}`);
      }
    } catch (error) {
      // Might fail on unique constraint, that's OK
      console.warn('[EntityMemory] Upsert warning:', error.message);
    }
  },

  /**
   * Create a single entity from UI (manual user creation)
   * This is separate from storeEntities() which handles analysis pipeline format
   * @param {Object} entityData - { name, type, relationship_to_user }
   * @returns {boolean} Success status
   */
  async createSingleEntity({ name, type = 'person', relationship_to_user = '' }) {
    try {
      if (!name || name.length < 2) {
        console.warn('[EntityMemory] Entity name too short');
        return false;
      }

      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.error('[EntityMemory] Supabase not available');
        return false;
      }

      const { data: { user } } = await Sync.supabase.auth.getUser();
      if (!user) {
        console.error('[EntityMemory] No user logged in');
        return false;
      }

      const now = new Date().toISOString();
      const encryptedName = await this.encryptName(name);

      // Check if entity already exists
      const { data: existing } = await Sync.supabase
        .from('entities')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('name_encrypted', encryptedName)
        .maybeSingle();

      if (existing) {
        // Update existing entity with new relationship
        const { error } = await Sync.supabase
          .from('entities')
          .update({
            relationship_to_user: relationship_to_user,
            metadata: {
              ...existing.metadata,
              user_corrected: true,
              last_updated: now
            },
            last_seen: now
          })
          .eq('id', existing.id);

        if (error) {
          console.error('[EntityMemory] Update failed:', error);
          return false;
        }

        console.log(`[EntityMemory] Updated entity: ${name}`);
      } else {
        // Create new entity
        const { error } = await Sync.supabase
          .from('entities')
          .insert({
            user_id: user.id,
            type: type,
            name_encrypted: encryptedName,
            relationship_to_user: relationship_to_user,
            metadata: {
              original_name: name,
              user_corrected: true,
              mention_count: 1,
              created_at: now
            },
            first_seen: now,
            last_seen: now
          });

        if (error) {
          console.error('[EntityMemory] Insert failed:', error);
          return false;
        }

        console.log(`[EntityMemory] Created entity: ${name}`);
      }

      // Refresh local cache
      await this.loadEntities();
      return true;

    } catch (error) {
      console.error('[EntityMemory] createSingleEntity error:', error);
      return false;
    }
  },

  /**
   * Load all entities for the current user
   * @returns {Array} Array of entities
   */
  async loadEntities() {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        return [];
      }

      const { data: { user } } = await Sync.supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await Sync.supabase
        .from('entities')
        .select('*')
        .eq('user_id', user.id)
        .order('last_seen', { ascending: false });

      if (error) {
        console.error('[EntityMemory] Load error:', error);
        return [];
      }

      // Decrypt names
      const entities = await Promise.all(data.map(async (entity) => ({
        ...entity,
        name: await this.decryptName(entity.name_encrypted),
        name_encrypted: undefined, // Don't expose encrypted version
        details: entity.metadata?.species || entity.metadata?.context || '',
        relationship_to_user: entity.relationship_to_user || ''
      })));

      // Phase 8: Update local cache
      this._entities = entities;
      this._loaded = true;

      console.log(`[EntityMemory] Loaded ${entities.length} entities`);
      return entities;

    } catch (error) {
      console.error('[EntityMemory] Error loading entities:', error);
      return [];
    }
  },

  /**
   * Get entities formatted for context injection
   * @returns {Object} Formatted context
   */
  async getContextForAnalysis() {
    const entities = await this.loadEntities();

    if (entities.length === 0) {
      return { knownEntities: [] };
    }

    // Group by type
    const grouped = {
      people: entities.filter(e => e.type === 'person'),
      pets: entities.filter(e => e.type === 'pet'),
      places: entities.filter(e => e.type === 'place'),
      projects: entities.filter(e => e.type === 'project')
    };

    // Phase 8: Format for prompt injection with relationship context
    const knownEntities = [];

    grouped.pets.forEach(pet => {
      // Visual Learning: Include visual descriptions in details
      let details = pet.metadata?.species || 'pet';
      if (pet.metadata?.visual_descriptions?.length > 0) {
        details += `. Visual: ${pet.metadata.visual_descriptions[0]}`;
      }

      knownEntities.push({
        name: pet.name,
        type: 'pet',
        details: details,
        relationship: pet.relationship_to_user || 'user\'s pet',
        userCorrected: pet.user_corrected || false,
        mentionCount: pet.metadata?.mention_count || 1
      });
    });

    grouped.people.forEach(person => {
      // Visual Learning: Include visual descriptions in details
      let details = person.metadata?.context || null;
      if (person.metadata?.visual_descriptions?.length > 0) {
        const visual = person.metadata.visual_descriptions[0];
        details = details ? `${details}. Visual: ${visual}` : `Visual: ${visual}`;
      }

      knownEntities.push({
        name: person.name,
        type: 'person',
        details: details,
        relationship: person.relationship_to_user || null,
        userCorrected: person.user_corrected || false,
        mentionCount: person.metadata?.mention_count || 1
      });
    });

    grouped.places.forEach(place => {
      // Visual Learning: Include visual descriptions in details
      let details = place.metadata?.context || null;
      if (place.metadata?.visual_descriptions?.length > 0) {
        const visual = place.metadata.visual_descriptions[0];
        details = details ? `${details}. Visual: ${visual}` : `Visual: ${visual}`;
      }

      knownEntities.push({
        name: place.name,
        type: 'place',
        details: details,
        relationship: place.relationship_to_user || null,
        userCorrected: place.user_corrected || false
      });
    });

    grouped.projects.forEach(project => {
      knownEntities.push({
        name: project.name,
        type: 'project',
        details: project.metadata?.context || null,
        relationship: project.relationship_to_user || null,
        userCorrected: project.user_corrected || false
      });
    });

    return {
      knownEntities,
      summary: this.generateMemorySummary(grouped)
    };
  },

  /**
   * Generate a human-readable memory summary
   */
  generateMemorySummary(grouped) {
    const parts = [];

    if (grouped.pets.length > 0) {
      const petNames = grouped.pets.map(p => `${p.name} (${p.metadata?.species || 'pet'})`);
      parts.push(`Pets: ${petNames.join(', ')}`);
    }

    if (grouped.people.length > 0) {
      const topPeople = grouped.people.slice(0, 5).map(p => p.name);
      parts.push(`People mentioned: ${topPeople.join(', ')}`);
    }

    if (grouped.projects.length > 0) {
      const topProjects = grouped.projects.slice(0, 3).map(p => p.name);
      parts.push(`Projects: ${topProjects.join(', ')}`);
    }

    return parts.join('. ');
  },

  /**
   * Encrypt entity name using PIN encryption
   */
  async encryptName(name) {
    try {
      if (typeof PIN !== 'undefined' && PIN.encryptionKey) {
        return await PIN.encrypt(name);
      }
      // Fallback: base64 encode (not secure, but works without PIN)
      return btoa(unescape(encodeURIComponent(name)));
    } catch (error) {
      console.warn('[EntityMemory] Encryption failed, using fallback');
      return btoa(unescape(encodeURIComponent(name)));
    }
  },

  /**
   * Decrypt entity name
   */
  async decryptName(encrypted) {
    try {
      if (typeof PIN !== 'undefined' && PIN.encryptionKey) {
        return await PIN.decrypt(encrypted);
      }
      // Fallback: base64 decode
      return decodeURIComponent(escape(atob(encrypted)));
    } catch (error) {
      console.warn('[EntityMemory] Decryption failed');
      return '[Unknown]';
    }
  },

  /**
   * Detect if context suggests a pet
   */
  isPetContext(context, noteContent) {
    const petKeywords = /\b(dog|cat|pet|puppy|kitten|vet|veterinary|animal|fur|bark|meow|walk|feed|collar|leash)\b/i;
    return petKeywords.test(context) || petKeywords.test(noteContent || '');
  },

  /**
   * Detect species from context
   */
  detectSpecies(context) {
    const lower = (context || '').toLowerCase();
    if (lower.includes('dog') || lower.includes('puppy')) return 'dog';
    if (lower.includes('cat') || lower.includes('kitten')) return 'cat';
    if (lower.includes('bird')) return 'bird';
    if (lower.includes('fish')) return 'fish';
    return 'pet';
  },

  /**
   * Learn from user correction
   * @param {string} entityName - The entity being corrected
   * @param {Object} correction - { type: 'pet', species: 'dog', ... }
   */
  async applyCorrection(entityName, correction) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) return;

      const { data: { user } } = await Sync.supabase.auth.getUser();
      if (!user) return;

      const encryptedName = await this.encryptName(entityName);

      // Find the entity (use maybeSingle to avoid 406 when not found)
      const { data: existing } = await Sync.supabase
        .from('entities')
        .select('*')
        .eq('user_id', user.id)
        .eq('name_encrypted', encryptedName)
        .maybeSingle();

      if (existing) {
        // Update with correction
        const updatedMetadata = {
          ...existing.metadata,
          ...correction,
          corrected_at: new Date().toISOString(),
          corrected_by: 'user'
        };

        await Sync.supabase
          .from('entities')
          .update({
            type: correction.type || existing.type,
            metadata: updatedMetadata
          })
          .eq('id', existing.id);

        console.log(`[EntityMemory] Applied correction to ${entityName}`);
      } else {
        // Create new entity from correction
        await Sync.supabase
          .from('entities')
          .insert({
            user_id: user.id,
            type: correction.type || 'unknown',
            name_encrypted: encryptedName,
            metadata: {
              original_name: entityName,
              ...correction,
              created_from: 'correction'
            },
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          });

        console.log(`[EntityMemory] Created entity from correction: ${entityName}`);
      }
    } catch (error) {
      console.error('[EntityMemory] Correction error:', error);
    }
  },

  // ═══════════════════════════════════════════════════════════
  // VISUAL LEARNING: Store and merge visual descriptions
  // ═══════════════════════════════════════════════════════════

  /**
   * Store or update an entity with visual description from image
   * @param {Object} entity - { name, type, relationship_to_user }
   * @param {string} visualDescription - Visual description from image analysis
   */
  async storeEntityWithVisual(entity, visualDescription) {
    if (!visualDescription || !entity.name) {
      console.log('[EntityMemory] storeEntityWithVisual: missing data');
      return;
    }

    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.log('[EntityMemory] Supabase not available for visual storage');
        return;
      }

      const userId = await this.getUserId();
      if (!userId) {
        console.log('[EntityMemory] No user logged in for visual storage');
        return;
      }

      // Load entities if not loaded
      if (!this._loaded) {
        await this.loadEntities();
      }

      // Check if entity already exists (case-insensitive match)
      const existing = this._entities.find(
        e => e.name.toLowerCase() === entity.name.toLowerCase()
      );

      if (existing) {
        // Update existing entity with visual info and relationship if provided
        console.log(`[EntityMemory] Merging visual into existing entity: ${existing.name}`);
        await this.mergeVisualDescription(existing.id, visualDescription, existing, entity.relationship_to_user);
      } else {
        // Create new entity with visual
        console.log(`[EntityMemory] Creating new entity with visual: ${entity.name}`);
        await this.createEntityWithVisual(entity, visualDescription, userId);
      }

    } catch (error) {
      console.error('[EntityMemory] storeEntityWithVisual error:', error);
    }
  },

  /**
   * Merge visual description into existing entity
   * @param {string} entityId - Entity UUID
   * @param {string} visualDescription - New visual description
   * @param {Object} entity - Existing entity object
   * @param {string} relationshipToUser - Optional relationship to update (e.g., "my dog")
   */
  async mergeVisualDescription(entityId, visualDescription, entity, relationshipToUser = null) {
    try {
      if (!entityId || !visualDescription) return;

      // Get current details/metadata
      const currentDetails = entity.details || '';
      const currentMetadata = entity.metadata || {};

      // Check if this visual description is already stored
      const existingVisuals = currentMetadata.visual_descriptions || [];
      const normalizedNew = visualDescription.toLowerCase().trim();

      // Check for duplicate or very similar description
      const isDuplicate = existingVisuals.some(v => {
        const normalizedExisting = v.toLowerCase().trim();
        return normalizedExisting === normalizedNew ||
               normalizedExisting.includes(normalizedNew) ||
               normalizedNew.includes(normalizedExisting);
      });

      if (isDuplicate && !relationshipToUser) {
        console.log(`[EntityMemory] Visual already stored for ${entity.name}`);
        return;
      }

      // Build updated visual descriptions array
      const updatedVisuals = isDuplicate ? existingVisuals : [...existingVisuals, visualDescription].slice(-5);

      // Build new details string
      let newDetails;
      if (currentDetails.includes('Visual:')) {
        // Already has visual info, append new observation
        newDetails = isDuplicate ? currentDetails : `${currentDetails}; ${visualDescription}`;
      } else if (currentDetails) {
        // Has other details, add visual section
        newDetails = isDuplicate ? currentDetails : `${currentDetails}. Visual: ${visualDescription}`;
      } else {
        // No existing details
        newDetails = `Visual: ${visualDescription}`;
      }

      // Update metadata with visual descriptions array
      const updatedMetadata = {
        ...currentMetadata,
        visual_descriptions: updatedVisuals,
        last_visual_update: new Date().toISOString()
      };

      // Build update object
      const updateObj = {
        metadata: updatedMetadata,
        last_seen: new Date().toISOString()
      };

      // Add relationship_to_user if provided and not already set
      if (relationshipToUser && (!entity.relationship_to_user || entity.relationship_to_user === '')) {
        updateObj.relationship_to_user = relationshipToUser;
        console.log(`[EntityMemory] Setting relationship_to_user: "${relationshipToUser}" for ${entity.name}`);
      }

      // Update in database
      const { error } = await Sync.supabase
        .from('entities')
        .update(updateObj)
        .eq('id', entityId);

      if (error) {
        console.error('[EntityMemory] mergeVisualDescription error:', error);
        return;
      }

      // Update local cache
      const cacheIndex = this._entities.findIndex(e => e.id === entityId);
      if (cacheIndex >= 0) {
        this._entities[cacheIndex].details = newDetails;
        this._entities[cacheIndex].metadata = updatedMetadata;
        if (relationshipToUser) {
          this._entities[cacheIndex].relationship_to_user = relationshipToUser;
        }
      }

      console.log(`[EntityMemory] Updated visual for ${entity.name}: "${visualDescription}"`);

    } catch (error) {
      console.error('[EntityMemory] mergeVisualDescription error:', error);
    }
  },

  /**
   * Create new entity with visual description
   * @param {Object} entity - { name, type, relationship_to_user }
   * @param {string} visualDescription - Visual description from image
   * @param {string} userId - User UUID
   */
  async createEntityWithVisual(entity, visualDescription, userId) {
    try {
      const encryptedName = await this.encryptName(entity.name);
      const now = new Date().toISOString();

      const metadata = {
        original_name: entity.name,
        visual_descriptions: [visualDescription],
        created_from: 'visual_learning',
        first_visual_update: now,
        last_visual_update: now,
        mention_count: 1
      };

      // Add species for pets
      if (entity.type === 'pet') {
        metadata.species = this.detectSpecies(visualDescription);
      }

      const insertData = {
        user_id: userId,
        name_encrypted: encryptedName,
        type: entity.type,
        metadata: metadata,
        first_seen: now,
        last_seen: now
      };

      // Add relationship_to_user if provided
      if (entity.relationship_to_user) {
        insertData.relationship_to_user = entity.relationship_to_user;
        console.log(`[EntityMemory] Creating entity with relationship: "${entity.relationship_to_user}"`);
      }

      const { data, error } = await Sync.supabase
        .from('entities')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[EntityMemory] createEntityWithVisual error:', error);
        return;
      }

      // Add to local cache
      const newEntity = {
        id: data.id,
        name: entity.name,
        type: entity.type,
        details: `Visual: ${visualDescription}`,
        metadata: metadata,
        relationship_to_user: entity.relationship_to_user || '',
        first_seen: now,
        last_seen: now
      };

      this._entities.push(newEntity);

      console.log(`[EntityMemory] Created entity with visual: ${entity.name} (${entity.type})${entity.relationship_to_user ? ` - "${entity.relationship_to_user}"` : ''}`);

    } catch (error) {
      console.error('[EntityMemory] createEntityWithVisual error:', error);
    }
  }
};

// Make globally available
window.EntityMemory = EntityMemory;
