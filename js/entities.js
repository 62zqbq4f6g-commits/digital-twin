/**
 * Phase 9: Entity System
 * Auto-detection, confirmation prompts, and YOUR WORLD display
 */

window.Entities = {
  // Relationship options for confirmation
  RELATIONSHIP_OPTIONS: [
    'cofounder', 'colleague', 'friend', 'family', 'partner', 'mentor', 'client', 'other'
  ],

  // Cached entities
  entities: null,

  /**
   * Phase 10.1: Detect if new entity info conflicts with existing entity
   * Returns conflict type or null
   */
  detectConflict(newEntity, existingEntity) {
    if (!newEntity || !existingEntity) return null;

    // Only check for conflicts on entities with the same name
    if (newEntity.name?.toLowerCase() !== existingEntity.name?.toLowerCase()) {
      return null;
    }

    // Check for job/company change (includes present tense for real-time updates)
    const jobChangeIndicators = [
      'started at', 'starting at', 'joined', 'joining', 'new job', 'now at',
      'left', 'leaving', 'moved to', 'moving to', 'is at', 'working at',
      'head of', 'cto', 'ceo', 'founder', 'will be', 'going to'
    ];
    const contextLower = (newEntity.context || '').toLowerCase();
    const hasJobChange = jobChangeIndicators.some(indicator => contextLower.includes(indicator));

    // Check if the existing context mentions a different company
    const existingContexts = existingEntity.context_notes || [];
    const existingContextLower = existingContexts.join(' ').toLowerCase();

    // Extract company names from contexts (simple pattern matching)
    // Supports both past tense (joined, left) and present progressive (joining, leaving)
    const companyPattern = /at\s+(\w+)|join(?:ed|ing)\s+(\w+)|leav(?:e|ing)\s+(\w+)|left\s+(\w+)|start(?:ed|ing)\s+at\s+(\w+)|mov(?:ed|ing)\s+to\s+(\w+)/gi;
    const extractCompany = (m) => (m[1] || m[2] || m[3] || m[4] || m[5] || m[6])?.toLowerCase();
    const newCompanies = [...contextLower.matchAll(companyPattern)].map(extractCompany).filter(Boolean);
    const existingCompanies = [...existingContextLower.matchAll(companyPattern)].map(extractCompany).filter(Boolean);

    // If new context mentions a company not in existing contexts, might be a change
    if (hasJobChange && newCompanies.length > 0 && existingCompanies.length > 0) {
      const differentCompany = newCompanies.some(nc => !existingCompanies.includes(nc));
      if (differentCompany) {
        return {
          type: 'supersede',
          reason: 'job_change',
          oldFact: existingContexts[existingContexts.length - 1] || 'previous role',
          newFact: newEntity.context
        };
      }
    }

    return null;
  },

  /**
   * Phase 10.1: Sync entity with conflict detection
   * Handles superseding old information when conflicts detected
   */
  async syncEntityWithConflictDetection(entity, userId, noteContent) {
    if (!Sync.supabase || !userId || !entity.name) return null;

    try {
      // Check if entity already exists (case-insensitive match)
      const { data: existing, error: fetchError } = await Sync.supabase
        .from('user_entities')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', entity.name)
        .eq('status', 'active')
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.warn('[Entities] Error fetching entity:', fetchError.message);
        return null;
      }

      if (existing) {
        // Check for conflicts
        const conflict = this.detectConflict(entity, existing);

        if (conflict && conflict.type === 'supersede') {
          console.log('[Entities] Conflict detected for', entity.name, ':', conflict.reason);

          // Create new entity with updated info
          const { data: newEntity, error: insertError } = await Sync.supabase
            .from('user_entities')
            .insert({
              user_id: userId,
              name: entity.name,
              entity_type: entity.type || existing.entity_type || 'person',
              context_notes: [entity.context || noteContent.substring(0, 200)],
              relationship: existing.relationship,
              confirmed: existing.confirmed,
              sentiment_average: entity.sentiment || null,
              supersedes_id: existing.id
            })
            .select()
            .single();

          if (insertError) {
            console.warn('[Entities] Failed to create superseding entity:', insertError.message);
            return null;
          }

          // Mark old entity as superseded
          await Sync.supabase
            .from('user_entities')
            .update({
              status: 'superseded',
              superseded_by: newEntity.id,
              superseded_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          console.log('[Entities] Entity superseded:', entity.name, 'old ID:', existing.id, 'new ID:', newEntity.id);
          return { type: 'superseded', entity: newEntity };
        }

        // No conflict - just update existing
        const newContextNotes = [...(existing.context_notes || []), entity.context].slice(-10);
        const newMentionCount = (existing.mention_count || 1) + 1;
        const newSentiment = existing.sentiment_average !== null
          ? (existing.sentiment_average * existing.mention_count + (entity.sentiment || 0)) / newMentionCount
          : (entity.sentiment || 0);

        await Sync.supabase
          .from('user_entities')
          .update({
            mention_count: newMentionCount,
            last_mentioned_at: new Date().toISOString(),
            context_notes: newContextNotes,
            sentiment_average: Math.round(newSentiment * 100) / 100
          })
          .eq('id', existing.id);

        console.log('[Entities] Updated entity:', entity.name, 'mentions:', newMentionCount);
        return { type: 'updated', entity: existing };

      } else {
        // Create new entity
        const { data: newEntity, error: insertError } = await Sync.supabase
          .from('user_entities')
          .insert({
            user_id: userId,
            name: entity.name,
            entity_type: entity.type || 'other',
            context_notes: entity.context ? [entity.context] : [],
            sentiment_average: entity.sentiment || null
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            console.log('[Entities] Entity already exists (race condition):', entity.name);
            return null;
          }
          console.warn('[Entities] Failed to insert entity:', insertError.message);
          return null;
        }

        console.log('[Entities] Created new entity:', entity.name, 'type:', entity.type);
        return { type: 'created', entity: newEntity };
      }
    } catch (err) {
      console.warn('[Entities] Error in syncEntityWithConflictDetection:', entity.name, err.message);
      return null;
    }
  },

  /**
   * Process extracted entities from analysis
   * Called after note analysis completes
   */
  async processExtractedEntities(extractedEntities, userId, noteContent) {
    if (!extractedEntities || extractedEntities.length === 0) return [];
    if (!Sync.supabase || !userId) return [];

    const newPeople = [];

    // Phase 10.1: Use conflict-aware sync for each entity
    for (const entity of extractedEntities) {
      try {
        const result = await this.syncEntityWithConflictDetection(entity, userId, noteContent);

        // Track new person entities for confirmation prompt
        if (result && result.type === 'created' && entity.type === 'person') {
          newPeople.push({
            id: result.entity.id,
            name: entity.name,
            context: entity.context
          });
        }
      } catch (err) {
        console.warn('[Entities] Error processing entity:', entity.name, err.message);
      }
    }

    return newPeople;
  },

  /**
   * Render entity confirmation prompt
   * Shows after note analysis when new people are detected
   */
  renderEntityPrompt(entityName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const optionButtons = this.RELATIONSHIP_OPTIONS.map(rel =>
      `<button class="entity-prompt__option" onclick="Entities.confirmEntity('${this.escapeHtml(entityName)}', '${rel}')">${rel}</button>`
    ).join('');

    const promptHtml = `
      <div class="entity-prompt" id="entity-prompt-${this.escapeHtml(entityName)}">
        <p class="entity-prompt__question">
          I noticed you mentioned <strong>${this.escapeHtml(entityName)}</strong>. Who is this to you?
        </p>
        <div class="entity-prompt__options">
          ${optionButtons}
        </div>
        <div class="entity-prompt__dismiss">
          <button class="entity-prompt__dismiss-btn" onclick="Entities.dismissEntity('${this.escapeHtml(entityName)}', false)">Skip</button>
          <button class="entity-prompt__dismiss-btn" onclick="Entities.dismissEntity('${this.escapeHtml(entityName)}', true)">Don't ask again</button>
        </div>
      </div>
    `;

    // Append to container
    container.insertAdjacentHTML('beforeend', promptHtml);
  },

  /**
   * Confirm entity relationship
   */
  async confirmEntity(entityName, relationship) {
    if (!Sync.supabase || !Sync.user) return;

    try {
      // Update entity
      await Sync.supabase
        .from('user_entities')
        .update({
          relationship: relationship,
          confirmed: true
        })
        .eq('user_id', Sync.user.id)
        .eq('name', entityName);

      // Also add to key_people
      await Sync.supabase
        .from('user_key_people')
        .upsert({
          user_id: Sync.user.id,
          name: entityName,
          relationship: relationship,
          added_via: 'confirmed'
        }, { onConflict: 'user_id,name' });

      console.log('[Entities] Confirmed entity:', entityName, 'as', relationship);

      // Hide prompt
      this.hideEntityPrompt(entityName);

      // Show toast
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast(`Got it — ${entityName} is your ${relationship}`);
      }
    } catch (err) {
      console.error('[Entities] Failed to confirm entity:', err);
    }
  },

  /**
   * Dismiss entity prompt
   */
  async dismissEntity(entityName, dontAskAgain = false) {
    if (dontAskAgain && Sync.supabase && Sync.user) {
      try {
        await Sync.supabase
          .from('user_entities')
          .update({ dismissed: true })
          .eq('user_id', Sync.user.id)
          .eq('name', entityName);

        console.log('[Entities] Dismissed entity permanently:', entityName);
      } catch (err) {
        console.warn('[Entities] Failed to dismiss entity:', err);
      }
    }

    this.hideEntityPrompt(entityName);
  },

  /**
   * Hide entity prompt
   */
  hideEntityPrompt(entityName) {
    const prompt = document.getElementById(`entity-prompt-${this.escapeHtml(entityName)}`);
    if (prompt) {
      prompt.remove();
    }
  },

  /**
   * Load all entities for current user
   */
  async loadEntities() {
    if (!Sync.supabase || !Sync.user) return null;

    try {
      const { data: entities, error } = await Sync.supabase
        .from('user_entities')
        .select('*')
        .eq('user_id', Sync.user.id)
        .eq('dismissed', false)
        .order('mention_count', { ascending: false });

      if (error) throw error;

      this.entities = {
        people: entities.filter(e => e.entity_type === 'person'),
        projects: entities.filter(e => e.entity_type === 'project'),
        places: entities.filter(e => e.entity_type === 'place'),
        pets: entities.filter(e => e.entity_type === 'pet'),
        other: entities.filter(e => e.entity_type === 'other')
      };

      console.log('[Entities] Loaded entities:', {
        people: this.entities.people.length,
        projects: this.entities.projects.length,
        places: this.entities.places.length
      });

      return this.entities;
    } catch (err) {
      console.warn('[Entities] Failed to load entities:', err.message);
      return null;
    }
  },

  /**
   * Render YOUR WORLD section for TWIN tab
   */
  renderYourWorldSection() {
    if (!this.entities) {
      return `
        <div class="your-world">
          <h3 class="section-header">Your World</h3>
          <p class="entity-empty">Your world will appear here as you write.</p>
        </div>
      `;
    }

    const { people, projects, places, pets } = this.entities;
    const hasSomething = people.length > 0 || projects.length > 0 || places.length > 0 || pets.length > 0;

    if (!hasSomething) {
      return `
        <div class="your-world">
          <h3 class="section-header">Your World</h3>
          <p class="entity-empty">Your world will appear here as you write.</p>
        </div>
      `;
    }

    let html = '<div class="your-world">';

    // Filter job titles from people (UX fix)
    const JOB_TITLE_KEYWORDS = ['manager', 'engineer', 'director', 'analyst', 'consultant', 'developer', 'designer', 'lead', 'senior', 'junior', 'head of', 'vp', 'ceo', 'cto', 'cfo'];
    const filteredPeople = people.filter(p => {
      const nameLower = (p.name || '').toLowerCase();
      return !JOB_TITLE_KEYWORDS.some(title => nameLower.includes(title));
    });

    // KEY PEOPLE section (limit to 5, use person cards)
    if (filteredPeople.length > 0) {
      const displayPeople = filteredPeople.slice(0, 5);
      const hasMore = filteredPeople.length > 5;

      html += `
        <div class="entity-group">
          <div class="entity-group__header">
            <span class="twin-section-title">Key People</span>
            ${hasMore ? `<a class="section-see-all" onclick="UIProfile.openEditModal('people')">See all ${filteredPeople.length}</a>` : ''}
          </div>
          <div class="person-cards">
            ${displayPeople.map(p => this.renderPersonCard(p)).join('')}
          </div>
        </div>
      `;
    }

    // YOUR WORLD section (entities as pills - projects, places, pets combined)
    const allEntities = [
      ...projects.slice(0, 3).map(p => ({ ...p, type: 'project' })),
      ...places.slice(0, 3).map(p => ({ ...p, type: 'place' })),
      ...pets.slice(0, 3).map(p => ({ ...p, type: 'pet' }))
    ];

    if (allEntities.length > 0) {
      const hasMoreProjects = projects.length > 3;
      const hasMorePlaces = places.length > 3;
      const hasMorePets = pets.length > 3;
      const totalMore = (hasMoreProjects ? projects.length - 3 : 0) +
                       (hasMorePlaces ? places.length - 3 : 0) +
                       (hasMorePets ? pets.length - 3 : 0);

      html += `
        <div class="entity-group" style="margin-top: 32px;">
          <div class="entity-group__header">
            <span class="twin-section-title">Your World</span>
            ${totalMore > 0 ? `<a class="section-see-all">+${totalMore} more</a>` : ''}
          </div>
          <div class="entity-pills-container">
            ${allEntities.map(e => this.renderEntityPill(e)).join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * Render single entity item
   */
  renderEntityItem(entity, showConfirm = true) {
    const isUnconfirmed = entity.entity_type === 'person' && !entity.confirmed && !entity.dismissed;

    let metaHtml = '';
    if (entity.relationship) {
      metaHtml += `<span class="entity-item__relationship">${this.escapeHtml(entity.relationship)}</span> · `;
    } else if (isUnconfirmed && showConfirm) {
      metaHtml += `<span class="entity-item__unknown">?</span> · `;
    }
    metaHtml += `<span class="entity-item__mentions">${entity.mention_count}×</span>`;

    if (isUnconfirmed && showConfirm) {
      metaHtml += `<button class="btn-text-new" onclick="Entities.promptEntityRelationship('${this.escapeHtml(entity.name)}')">Add context</button>`;
    } else {
      metaHtml += `<button class="entity-item__edit" onclick="Entities.openEntityEdit('${entity.id}')">✎</button>`;
    }

    return `
      <div class="entity-item">
        <div class="entity-item__name">${this.escapeHtml(entity.name)}</div>
        <div class="entity-item__meta">${metaHtml}</div>
      </div>
    `;
  },

  /**
   * SuperDesign: Render person card with avatar
   */
  renderPersonCard(person) {
    const initial = (person.name || '?').charAt(0).toUpperCase();
    const role = person.relationship || '';
    const name = this.escapeHtml(person.name || 'Unknown');

    return `
      <div class="person-card" onclick="Entities.openEntityEdit('${person.id}')">
        <div class="person-avatar">${initial}</div>
        <div class="person-info">
          <span class="person-name">${name}</span>
          ${role ? `<span class="person-role">${this.escapeHtml(role)}</span>` : ''}
        </div>
        <span class="person-chevron">›</span>
      </div>
    `;
  },

  /**
   * SuperDesign: Render entity pill (for projects, places, pets)
   */
  renderEntityPill(entity) {
    const name = this.escapeHtml(entity.name || 'Unknown');
    const type = entity.type || entity.entity_type || 'item';

    return `
      <span class="entity-pill" onclick="Entities.openEntityEdit('${entity.id}')">
        <span class="entity-name">${name}</span>
        <span class="entity-type">${type}</span>
      </span>
    `;
  },

  /**
   * Prompt for entity relationship (inline)
   */
  promptEntityRelationship(entityName) {
    // Show modal for relationship selection
    const options = this.RELATIONSHIP_OPTIONS.map(rel =>
      `<button class="entity-prompt__option" onclick="Entities.confirmEntity('${this.escapeHtml(entityName)}', '${rel}')">${rel}</button>`
    ).join('');

    const body = `
      <p class="modal-new__subtitle">Who is ${this.escapeHtml(entityName)} to you?</p>
      <div class="entity-prompt__options" style="justify-content: center;">${options}</div>
      <div style="text-align: center; margin-top: var(--space-4);">
        <button class="btn-text-new" onclick="Entities.dismissEntity('${this.escapeHtml(entityName)}', true); UIProfile.closeModal();">Don't ask again</button>
      </div>
    `;

    UIProfile.showModal(`ADD CONTEXT FOR ${entityName.toUpperCase()}`, body);
  },

  /**
   * Open entity edit modal
   */
  async openEntityEdit(entityId) {
    if (!Sync.supabase || !Sync.user) return;

    try {
      const { data: entity, error } = await Sync.supabase
        .from('user_entities')
        .select('*')
        .eq('id', entityId)
        .eq('user_id', Sync.user.id)
        .single();

      if (error) throw error;

      const firstSeen = entity.first_mentioned_at
        ? new Date(entity.first_mentioned_at).toLocaleDateString()
        : 'Unknown';
      const lastSeen = entity.last_mentioned_at
        ? new Date(entity.last_mentioned_at).toLocaleDateString()
        : 'Unknown';

      // Phase 11.6: Web search URL for entity
      const searchQuery = encodeURIComponent(entity.name);
      const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

      const body = `
        <div class="field-group">
          <label class="label-new">relationship</label>
          <input type="text" id="entity-edit-relationship" class="input-new"
                 value="${this.escapeHtml(entity.relationship || '')}"
                 placeholder="e.g., cofounder, friend">
        </div>

        <div style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--ink-100);">
          <p class="text-caption text-muted">mentioned ${entity.mention_count} times</p>
          <p class="text-caption text-muted">first: ${firstSeen} · last: ${lastSeen}</p>
        </div>

        <div style="margin-top: var(--space-4); display: flex; justify-content: space-between; align-items: center;">
          <a href="${searchUrl}" target="_blank" rel="noopener" class="btn-text-new" style="text-decoration: none;">learn more →</a>
          <button class="btn-text-new" style="color: var(--error);" onclick="Entities.removeEntity('${entityId}')">remove</button>
        </div>
      `;

      const footer = `<button class="btn-primary-new" onclick="Entities.saveEntityEdit('${entityId}')">save</button>`;

      UIProfile.showModal(entity.name.toUpperCase(), body, footer);

    } catch (err) {
      console.error('[Entities] Failed to load entity for edit:', err);
    }
  },

  /**
   * Save entity edit
   */
  async saveEntityEdit(entityId) {
    const relationship = document.getElementById('entity-edit-relationship')?.value.trim();

    try {
      await Sync.supabase
        .from('user_entities')
        .update({
          relationship: relationship || null,
          confirmed: !!relationship
        })
        .eq('id', entityId)
        .eq('user_id', Sync.user.id);

      console.log('[Entities] Entity updated:', entityId);
      UIProfile.closeModal();

      // Refresh entities display
      await this.loadEntities();
      this.refreshYourWorldDisplay();
    } catch (err) {
      console.error('[Entities] Failed to save entity:', err);
    }
  },

  /**
   * Remove entity (sets dismissed=true)
   */
  async removeEntity(entityId) {
    try {
      await Sync.supabase
        .from('user_entities')
        .update({ dismissed: true })
        .eq('id', entityId)
        .eq('user_id', Sync.user.id);

      console.log('[Entities] Entity removed:', entityId);
      UIProfile.closeModal();

      // Refresh entities display
      await this.loadEntities();
      this.refreshYourWorldDisplay();
    } catch (err) {
      console.error('[Entities] Failed to remove entity:', err);
    }
  },

  /**
   * Refresh YOUR WORLD display
   */
  refreshYourWorldDisplay() {
    const container = document.getElementById('your-world-section');
    if (container) {
      container.innerHTML = this.renderYourWorldSection();
    }
  },

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // ===========================================
  // PHASE 10.2: Mem0-Quality Memory Functions
  // ===========================================

  // Change indicator patterns for conflict detection
  CHANGE_PATTERNS: {
    job: [
      /(\w+)\s+(?:started|starting|joined|joining|is now|now)\s+(?:at|with)\s+(\w+)/gi,
      /(\w+)\s+(?:left|leaving|quit|quitting)\s+(\w+)/gi,
      /(\w+)\s+(?:is|became|becomes)\s+(?:the\s+)?(?:new\s+)?(\w+)\s+(?:at|of)\s+(\w+)/gi,
      /(\w+)\s+(?:got|getting)\s+(?:a\s+)?(?:new\s+)?job\s+(?:at|with)\s+(\w+)/gi,
      /(\w+)\s+(?:works|working)\s+(?:at|for)\s+(\w+)/gi
    ],
    location: [
      /(\w+)\s+(?:moved|moving|relocated|relocating)\s+to\s+(\w+)/gi,
      /(\w+)\s+(?:is\s+)?(?:now\s+)?(?:in|living\s+in)\s+(\w+)/gi
    ],
    relationship: [
      /(\w+)\s+(?:got\s+)?(?:married|engaged)\s+(?:to\s+)?(\w+)?/gi,
      /(\w+)\s+(?:and\s+)?(\w+)\s+(?:broke\s+up|divorced|separated)/gi,
      /(\w+)\s+(?:is\s+)?(?:now\s+)?(?:dating|seeing)\s+(\w+)/gi
    ],
    status: [
      /(\w+)\s+(?:is\s+)?(?:now\s+)?(?:pregnant|expecting)/gi,
      /(\w+)\s+(?:had|having)\s+(?:a\s+)?baby/gi,
      /(\w+)\s+(?:graduated|retiring|retired)/gi
    ]
  },

  // Relationship extraction patterns
  RELATIONSHIP_PATTERNS: [
    { pattern: /(\w+)\s+(?:works|working)\s+(?:at|for)\s+(\w+)/gi, predicate: 'works_at', subjectType: 'person', objectType: 'company' },
    { pattern: /(\w+)\s+is\s+(?:the\s+)?(?:CEO|CTO|CFO|COO|founder|cofounder|co-founder)\s+(?:of|at)\s+(\w+)/gi, predicate: 'leads', subjectType: 'person', objectType: 'company' },
    { pattern: /(\w+)\s+(?:knows|met)\s+(\w+)/gi, predicate: 'knows', subjectType: 'person', objectType: 'person' },
    { pattern: /(\w+)\s+(?:is\s+)?(?:married|engaged)\s+to\s+(\w+)/gi, predicate: 'partner_of', subjectType: 'person', objectType: 'person' },
    { pattern: /(\w+)\s+(?:lives|living)\s+(?:in|at)\s+(\w+)/gi, predicate: 'lives_in', subjectType: 'person', objectType: 'place' },
    { pattern: /(\w+)\s+(?:is\s+)?(?:friends?\s+with|close\s+to)\s+(\w+)/gi, predicate: 'friends_with', subjectType: 'person', objectType: 'person' },
    { pattern: /(\w+)\s+(?:reports|reporting)\s+to\s+(\w+)/gi, predicate: 'reports_to', subjectType: 'person', objectType: 'person' },
    { pattern: /(\w+)\s+(?:manages|managing)\s+(\w+)/gi, predicate: 'manages', subjectType: 'person', objectType: 'person' },
    { pattern: /(\w+)\s+(?:invested|investing)\s+in\s+(\w+)/gi, predicate: 'invested_in', subjectType: 'person', objectType: 'company' }
  ],

  /**
   * PART 2: Scan note text for entity updates BEFORE analysis
   * This runs pre-analysis to catch updates to known entities
   * @param {string} noteText - The raw note text
   * @param {string} userId - User ID
   * @returns {Array} Array of detected updates
   */
  async scanForEntityUpdates(noteText, userId) {
    if (!noteText || !userId || !Sync.supabase) return [];

    try {
      // Load known entities if not cached
      if (!this.entities) {
        await this.loadEntities();
      }

      if (!this.entities) return [];

      // Get all entity names (people, projects, places, pets)
      const allEntities = [
        ...(this.entities.people || []),
        ...(this.entities.projects || []),
        ...(this.entities.places || []),
        ...(this.entities.pets || []),
        ...(this.entities.other || [])
      ];

      if (allEntities.length === 0) return [];

      const updates = [];
      const textLower = noteText.toLowerCase();

      // Check each known entity for mentions with change indicators
      for (const entity of allEntities) {
        const nameLower = entity.name.toLowerCase();

        // Skip if entity not mentioned in note
        if (!textLower.includes(nameLower)) continue;

        // Check each change pattern type
        for (const [changeType, patterns] of Object.entries(this.CHANGE_PATTERNS)) {
          for (const pattern of patterns) {
            // Reset regex lastIndex
            pattern.lastIndex = 0;

            let match;
            while ((match = pattern.exec(noteText)) !== null) {
              const matchedName = match[1]?.toLowerCase();

              // Check if this match is about our known entity
              if (matchedName === nameLower ||
                  matchedName?.includes(nameLower) ||
                  nameLower.includes(matchedName || '')) {

                updates.push({
                  entityId: entity.id,
                  entityName: entity.name,
                  entityType: entity.entity_type,
                  changeType: changeType,
                  matchedText: match[0],
                  newValue: match[2] || match[3] || null,
                  context: noteText.substring(
                    Math.max(0, match.index - 50),
                    Math.min(noteText.length, match.index + match[0].length + 50)
                  ),
                  existingContexts: entity.context_notes || []
                });

                console.log('[Entities] Phase 10.2 - Detected update for', entity.name, ':', changeType, match[0]);
              }
            }
          }
        }
      }

      return updates;
    } catch (err) {
      console.warn('[Entities] Phase 10.2 - scanForEntityUpdates error:', err.message);
      return [];
    }
  },

  /**
   * PART 2: Process detected entity updates
   * Creates superseding records for significant changes
   * @param {Array} updates - Array of detected updates from scanForEntityUpdates
   * @param {string} userId - User ID
   * @param {string} noteText - Original note text for context
   */
  async processEntityUpdates(updates, userId, noteText) {
    if (!updates || updates.length === 0 || !userId || !Sync.supabase) return;

    for (const update of updates) {
      try {
        // Fetch current entity state
        const { data: existing, error } = await Sync.supabase
          .from('user_entities')
          .select('*')
          .eq('id', update.entityId)
          .single();

        if (error || !existing) continue;

        // Determine if this is a superseding change
        const isSupersedingChange = ['job', 'location', 'relationship'].includes(update.changeType);

        if (isSupersedingChange) {
          // Create new entity record with updated info
          const { data: newEntity, error: insertError } = await Sync.supabase
            .from('user_entities')
            .insert({
              user_id: userId,
              name: existing.name,
              entity_type: existing.entity_type,
              context_notes: [...(existing.context_notes || []), update.context].slice(-10),
              relationship: existing.relationship,
              confirmed: existing.confirmed,
              supersedes_id: existing.id,
              mention_count: 1,
              first_mentioned_at: new Date().toISOString(),
              last_mentioned_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.warn('[Entities] Phase 10.2 - Failed to create superseding entity:', insertError.message);
            continue;
          }

          // Mark old entity as superseded
          await Sync.supabase
            .from('user_entities')
            .update({
              status: 'superseded',
              superseded_by: newEntity.id,
              superseded_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          console.log('[Entities] Phase 10.2 - Superseded entity:', existing.name, 'reason:', update.changeType);
        } else {
          // Just add context note for status changes
          const newContextNotes = [...(existing.context_notes || []), update.context].slice(-10);

          await Sync.supabase
            .from('user_entities')
            .update({
              context_notes: newContextNotes,
              last_mentioned_at: new Date().toISOString(),
              mention_count: (existing.mention_count || 1) + 1
            })
            .eq('id', existing.id);

          console.log('[Entities] Phase 10.2 - Updated entity context:', existing.name);
        }
      } catch (err) {
        console.warn('[Entities] Phase 10.2 - processEntityUpdates error:', err.message);
      }
    }
  },

  /**
   * PART 3: Extract relationships from note text
   * @param {string} text - Note text
   * @param {string} userId - User ID
   * @returns {Array} Extracted relationships
   */
  async extractRelationships(text, userId) {
    if (!text || !userId) return [];

    const relationships = [];

    for (const { pattern, predicate, subjectType, objectType } of this.RELATIONSHIP_PATTERNS) {
      // Reset regex
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const subjectName = match[1]?.trim();
        const objectName = match[2]?.trim();

        if (subjectName && objectName && subjectName.length > 1 && objectName.length > 1) {
          relationships.push({
            subject_name: subjectName,
            predicate: predicate,
            object_name: objectName,
            subject_type: subjectType,
            object_type: objectType,
            source_note: text.substring(0, 200),
            confidence: 0.7
          });

          console.log('[Entities] Phase 10.2 - Extracted relationship:', subjectName, predicate, objectName);
        }
      }
    }

    return relationships;
  },

  /**
   * PART 3: Store relationships in database with superseding logic
   * @param {Array} relationships - Extracted relationships
   * @param {string} userId - User ID
   */
  async storeRelationships(relationships, userId) {
    if (!relationships || relationships.length === 0 || !userId || !Sync.supabase) return;

    for (const rel of relationships) {
      try {
        // Look up entity IDs
        const { data: subjectEntity } = await Sync.supabase
          .from('user_entities')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', rel.subject_name)
          .eq('status', 'active')
          .maybeSingle();

        const { data: objectEntity } = await Sync.supabase
          .from('user_entities')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', rel.object_name)
          .eq('status', 'active')
          .maybeSingle();

        // Check for existing relationship
        const { data: existing } = await Sync.supabase
          .from('entity_relationships')
          .select('id, predicate')
          .eq('user_id', userId)
          .ilike('subject_name', rel.subject_name)
          .eq('status', 'active')
          .maybeSingle();

        // If existing relationship with different predicate, supersede it
        if (existing && existing.predicate !== rel.predicate) {
          // Mark old relationship as superseded
          await Sync.supabase
            .from('entity_relationships')
            .update({ status: 'superseded', updated_at: new Date().toISOString() })
            .eq('id', existing.id);

          console.log('[Entities] Phase 10.2 - Superseded relationship:', rel.subject_name, existing.predicate, '->', rel.predicate);
        }

        // Insert new relationship (or skip if same predicate exists)
        if (!existing || existing.predicate !== rel.predicate) {
          await Sync.supabase
            .from('entity_relationships')
            .insert({
              user_id: userId,
              subject_entity_id: subjectEntity?.id || null,
              subject_name: rel.subject_name,
              predicate: rel.predicate,
              object_entity_id: objectEntity?.id || null,
              object_name: rel.object_name,
              confidence: rel.confidence,
              source_note: rel.source_note
            });

          console.log('[Entities] Phase 10.2 - Stored relationship:', rel.subject_name, rel.predicate, rel.object_name);
        }
      } catch (err) {
        console.warn('[Entities] Phase 10.2 - storeRelationships error:', err.message);
      }
    }
  },

  /**
   * PART 4: Consolidate entity memory for entities with 3+ mentions
   * Generates summaries and extracts topics
   * @param {string} entityId - Entity ID to consolidate
   * @param {string} userId - User ID
   */
  async consolidateEntityMemory(entityId, userId) {
    if (!entityId || !userId || !Sync.supabase) return null;

    try {
      // Fetch entity with context notes
      const { data: entity, error } = await Sync.supabase
        .from('user_entities')
        .select('*')
        .eq('id', entityId)
        .eq('user_id', userId)
        .single();

      if (error || !entity) return null;

      // Only consolidate if 3+ mentions and not recently consolidated
      if ((entity.mention_count || 0) < 3) return null;

      const lastConsolidated = entity.last_consolidated_at
        ? new Date(entity.last_consolidated_at)
        : null;
      const hoursSinceConsolidation = lastConsolidated
        ? (Date.now() - lastConsolidated.getTime()) / (1000 * 60 * 60)
        : Infinity;

      // Skip if consolidated within last 24 hours
      if (hoursSinceConsolidation < 24) return null;

      // Extract topics from context notes
      const topics = this.extractTopics(entity.context_notes || []);

      // Generate summary from context notes
      const summary = this.generateEntitySummary(entity);

      // Update entity with consolidated data
      await Sync.supabase
        .from('user_entities')
        .update({
          summary: summary,
          topics: topics,
          last_consolidated_at: new Date().toISOString()
        })
        .eq('id', entityId);

      console.log('[Entities] Phase 10.2 - Consolidated memory for:', entity.name, 'topics:', topics);

      return { summary, topics };
    } catch (err) {
      console.warn('[Entities] Phase 10.2 - consolidateEntityMemory error:', err.message);
      return null;
    }
  },

  /**
   * PART 4: Extract topics from context notes
   * @param {Array} contextNotes - Array of context note strings
   * @returns {Array} Extracted topics
   */
  extractTopics(contextNotes) {
    if (!contextNotes || contextNotes.length === 0) return [];

    const topicKeywords = {
      'startup': ['startup', 'founder', 'founding', 'venture', 'seed', 'series'],
      'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'gpt', 'claude'],
      'engineering': ['code', 'coding', 'engineering', 'developer', 'software', 'tech', 'programming'],
      'design': ['design', 'designer', 'ui', 'ux', 'user experience', 'figma'],
      'business': ['business', 'revenue', 'growth', 'strategy', 'market'],
      'product': ['product', 'feature', 'roadmap', 'launch', 'release'],
      'investment': ['investor', 'investment', 'funding', 'raise', 'valuation'],
      'health': ['health', 'fitness', 'workout', 'diet', 'wellness'],
      'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel'],
      'family': ['family', 'kids', 'children', 'parents', 'wife', 'husband'],
      'work': ['work', 'job', 'office', 'meeting', 'project', 'deadline']
    };

    const allText = contextNotes.join(' ').toLowerCase();
    const foundTopics = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => allText.includes(kw))) {
        foundTopics.push(topic);
      }
    }

    return foundTopics.slice(0, 5); // Limit to top 5 topics
  },

  /**
   * PART 4: Generate entity summary from context notes
   * @param {Object} entity - Entity object with context_notes
   * @returns {string} Generated summary
   */
  generateEntitySummary(entity) {
    if (!entity) return '';

    const parts = [];

    // Add name and type
    parts.push(entity.name);

    // Add relationship if known
    if (entity.relationship) {
      parts.push(`(${entity.relationship})`);
    }

    // Add mention count
    parts.push(`- mentioned ${entity.mention_count || 1} times`);

    // Extract key facts from recent contexts
    const contexts = entity.context_notes || [];
    if (contexts.length > 0) {
      // Take last 3 contexts
      const recentContexts = contexts.slice(-3);
      const contextSummary = recentContexts.map(c => c.substring(0, 100)).join('; ');
      parts.push(`Recent: ${contextSummary}`);
    }

    return parts.join(' ');
  },

  /**
   * PART 4: Batch consolidate entities for a user
   * Run periodically or on-demand
   * @param {string} userId - User ID
   */
  async batchConsolidateEntities(userId) {
    if (!userId || !Sync.supabase) return;

    try {
      // Get entities with 3+ mentions that haven't been consolidated recently
      const { data: entities, error } = await Sync.supabase
        .from('user_entities')
        .select('id, name, mention_count, last_consolidated_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('mention_count', 3)
        .order('mention_count', { ascending: false })
        .limit(10);

      if (error || !entities) return;

      console.log('[Entities] Phase 10.2 - Batch consolidating', entities.length, 'entities');

      for (const entity of entities) {
        await this.consolidateEntityMemory(entity.id, userId);
      }
    } catch (err) {
      console.warn('[Entities] Phase 10.2 - batchConsolidateEntities error:', err.message);
    }
  },

  /**
   * Get relationships for an entity
   * @param {string} entityName - Entity name
   * @param {string} userId - User ID
   * @returns {Array} Relationships involving this entity
   */
  async getEntityRelationships(entityName, userId) {
    if (!entityName || !userId || !Sync.supabase) return [];

    try {
      const { data: relationships, error } = await Sync.supabase
        .from('entity_relationships')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .or(`subject_name.ilike.${entityName},object_name.ilike.${entityName}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return relationships || [];
    } catch (err) {
      console.warn('[Entities] Phase 10.2 - getEntityRelationships error:', err.message);
      return [];
    }
  },

  /**
   * Get entities by topic for proactive relevance
   * @param {string} topic - Topic to search for
   * @param {string} userId - User ID
   * @returns {Array} Entities matching the topic
   */
  async getEntitiesByTopic(topic, userId) {
    if (!topic || !userId || !Sync.supabase) return [];

    try {
      const { data: entities, error } = await Sync.supabase
        .from('user_entities')
        .select('id, name, entity_type, topics, summary')
        .eq('user_id', userId)
        .eq('status', 'active')
        .contains('topics', [topic])
        .order('mention_count', { ascending: false })
        .limit(5);

      if (error) throw error;

      return entities || [];
    } catch (err) {
      console.warn('[Entities] Phase 10.2 - getEntitiesByTopic error:', err.message);
      return [];
    }
  },

  // ============================================
  // PHASE 10.4: LLM-Powered Entity Extraction
  // ============================================

  /**
   * Use LLM for entity extraction instead of regex
   * @param {string} userId - User ID
   * @param {string} noteText - Note text to analyze
   * @returns {Object} Extraction result with entities, relationships, changes
   */
  async extractEntitiesWithLLM(userId, noteText) {
    if (!noteText || !userId || !Sync.supabase) {
      return { entities: [], relationships: [], changes_detected: [] };
    }

    try {
      // Get known entities to help LLM identify existing ones
      const { data: knownEntities } = await Sync.supabase
        .from('user_entities')
        .select('name, entity_type, relationship')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(50);

      const response = await fetch('/api/extract-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: noteText,
          knownEntities: knownEntities || []
        })
      });

      if (!response.ok) {
        console.error('[Entities] Phase 10.4 - LLM extraction failed:', response.status);
        return { entities: [], relationships: [], changes_detected: [] };
      }

      const result = await response.json();
      console.log('[Entities] Phase 10.4 - LLM extracted:', result);

      return result;

    } catch (err) {
      console.error('[Entities] Phase 10.4 - LLM extraction error:', err);
      return { entities: [], relationships: [], changes_detected: [] };
    }
  },

  /**
   * Process LLM extraction results - sync entities and relationships
   * @param {string} userId - User ID
   * @param {Object} extraction - LLM extraction result
   * @param {string} noteText - Original note text
   */
  async processLLMExtraction(userId, extraction, noteText) {
    const { entities = [], relationships = [], changes_detected = [] } = extraction;

    // Process each extracted entity
    for (const entity of entities) {
      await this.syncEntityWithLLMData(userId, entity);
    }

    // Store relationships
    if (relationships.length > 0) {
      await this.storeRelationships(
        relationships.map(r => ({
          subject_name: r.subject,
          predicate: r.predicate,
          object_name: r.object,
          role: r.role
        })),
        userId
      );
    }

    // Process detected changes
    for (const change of changes_detected) {
      console.log(`[Entities] Phase 10.4 - LLM detected change: ${change.entity} ${change.change_type}: ${change.old_value} -> ${change.new_value}`);
      await this.processEntityUpdates([{
        entityName: change.entity,
        changeType: change.change_type,
        newContext: noteText,
        existingContext: []
      }], userId, noteText);
    }

    return { entities, relationships, changes_detected };
  },

  /**
   * Sync entity with LLM-extracted data
   * @param {string} userId - User ID
   * @param {Object} entity - Extracted entity object
   */
  async syncEntityWithLLMData(userId, entity) {
    if (!entity.name || !userId || !Sync.supabase) return;

    try {
      // Check for existing entity
      const { data: existing } = await Sync.supabase
        .from('user_entities')
        .select('id, mention_count, context_notes')
        .eq('user_id', userId)
        .ilike('name', entity.name)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        // Update existing entity
        const newContextNotes = [...(existing.context_notes || []), entity.context].filter(Boolean).slice(-10);

        await Sync.supabase
          .from('user_entities')
          .update({
            mention_count: (existing.mention_count || 1) + 1,
            context_notes: newContextNotes,
            relationship: entity.relationship || undefined,
            sentiment_average: entity.sentiment === 'positive' ? 0.7 : entity.sentiment === 'negative' ? -0.7 : 0,
            last_mentioned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        console.log(`[Entities] Phase 10.4 - Updated ${entity.name} via LLM`);

        // Generate embedding for updated entity
        if (window.Embeddings) {
          const embeddingText = [entity.name, entity.context || ''].join(' ');
          window.Embeddings.storeEntityEmbedding(existing.id, embeddingText, Sync.supabase)
            .catch(err => console.error('[Entities] Embedding error:', err));
        }
      } else {
        // Create new entity
        const { data: newEntity } = await Sync.supabase
          .from('user_entities')
          .insert({
            user_id: userId,
            name: entity.name,
            entity_type: entity.type || 'person',
            relationship: entity.relationship,
            context_notes: entity.context ? [entity.context] : [],
            mention_count: 1,
            status: 'active',
            first_mentioned_at: new Date().toISOString(),
            last_mentioned_at: new Date().toISOString()
          })
          .select()
          .single();

        console.log(`[Entities] Phase 10.4 - Created ${entity.name} via LLM`);

        // Generate embedding for new entity
        if (window.Embeddings && newEntity) {
          const embeddingText = [entity.name, entity.context || ''].join(' ');
          window.Embeddings.storeEntityEmbedding(newEntity.id, embeddingText, Sync.supabase)
            .catch(err => console.error('[Entities] Embedding error:', err));
        }
      }
    } catch (err) {
      console.error('[Entities] Phase 10.4 - syncEntityWithLLMData error:', err);
    }
  },

  // ============================================
  // PHASE 10.5: LLM Memory Compression
  // ============================================

  /**
   * Consolidate entity memory using LLM for intelligent summaries
   * @param {string} userId - User ID
   * @param {string} entityId - Entity ID to consolidate
   */
  async consolidateEntityMemoryWithLLM(userId, entityId) {
    if (!userId || !entityId || !Sync.supabase) return null;

    try {
      // Get entity with context
      const { data: entity } = await Sync.supabase
        .from('user_entities')
        .select('name, entity_type, context_notes, relationship')
        .eq('id', entityId)
        .single();

      if (!entity || !entity.context_notes || entity.context_notes.length < 3) {
        console.log(`[Entities] Phase 10.5 - Skipping LLM consolidation for ${entity?.name}: insufficient context`);
        return null;
      }

      // Get relationships for this entity
      const { data: relationships } = await Sync.supabase
        .from('entity_relationships')
        .select('predicate, object_name, role')
        .eq('user_id', userId)
        .eq('subject_name', entity.name)
        .eq('status', 'active');

      // Call compression API
      const response = await fetch('/api/compress-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName: entity.name,
          entityType: entity.entity_type,
          contextNotes: entity.context_notes.slice(-10),
          relationships: relationships || []
        })
      });

      if (!response.ok) {
        console.error('[Entities] Phase 10.5 - LLM compression failed:', response.status);
        return null;
      }

      const { summary } = await response.json();

      // Update entity with LLM summary
      await Sync.supabase
        .from('user_entities')
        .update({
          summary,
          last_consolidated_at: new Date().toISOString()
        })
        .eq('id', entityId);

      // Update embedding with new summary
      if (window.Embeddings) {
        const embeddingText = `${entity.name}. ${summary}`;
        await window.Embeddings.storeEntityEmbedding(entityId, embeddingText, Sync.supabase);
      }

      console.log(`[Entities] Phase 10.5 - LLM consolidated ${entity.name}: ${summary.substring(0, 50)}...`);
      return summary;

    } catch (err) {
      console.error('[Entities] Phase 10.5 - LLM consolidation error:', err);
      return null;
    }
  },

  /**
   * Batch consolidate entities using LLM
   * @param {string} userId - User ID
   */
  async batchConsolidateWithLLM(userId) {
    if (!userId || !Sync.supabase) return 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      // Get entities that need consolidation
      const { data: entities } = await Sync.supabase
        .from('user_entities')
        .select('id, name, mention_count')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('mention_count', 3)
        .or(`last_consolidated_at.is.null,last_consolidated_at.lt.${oneDayAgo}`)
        .order('mention_count', { ascending: false })
        .limit(5);

      if (!entities || entities.length === 0) {
        console.log('[Entities] Phase 10.5 - No entities need LLM consolidation');
        return 0;
      }

      console.log(`[Entities] Phase 10.5 - LLM consolidating ${entities.length} entities`);

      let count = 0;
      for (const entity of entities) {
        const result = await this.consolidateEntityMemoryWithLLM(userId, entity.id);
        if (result) count++;
        // Rate limit - 1 second between API calls
        await new Promise(r => setTimeout(r, 1000));
      }

      return count;
    } catch (err) {
      console.error('[Entities] Phase 10.5 - batchConsolidateWithLLM error:', err);
      return 0;
    }
  },

  // ============================================
  // PHASE 10.6: Cross-Memory Reasoning
  // ============================================

  /**
   * Infer connections between entities
   * @param {string} userId - User ID
   * @param {Object} supabase - Supabase client
   * @returns {Array} Generated inferences
   */
  async inferEntityConnections(userId, supabase) {
    if (!userId || !supabase) {
      console.log('[Entities] Phase 10.6 - Missing userId or supabase');
      return [];
    }

    // Get entities with enough context
    const { data: entities } = await supabase
      .from('user_entities')
      .select('id, name, entity_type, summary, context_notes, mention_count')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('mention_count', 2)
      .order('mention_count', { ascending: false })
      .limit(20);

    if (!entities || entities.length < 2) {
      console.log('[Entities] Phase 10.6 - Not enough entities for inference');
      return [];
    }

    // Get existing relationships
    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select('subject_name, predicate, object_name')
      .eq('user_id', userId)
      .eq('status', 'active');

    // Get recent notes for context
    const { data: recentNotes } = await supabase
      .from('notes')
      .select('content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    try {
      const response = await fetch('/api/infer-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entities,
          relationships: relationships || [],
          recentNotes: recentNotes || []
        })
      });

      if (!response.ok) {
        console.error('[Entities] Phase 10.6 - Inference API failed:', response.status);
        return [];
      }

      const { inferences } = await response.json();

      // Store inferences
      for (const inference of inferences) {
        await this.storeInference(userId, inference, supabase);
      }

      console.log(`[Entities] Phase 10.6 - Stored ${inferences.length} new inferences`);
      return inferences;

    } catch (err) {
      console.error('[Entities] Phase 10.6 - Inference error:', err);
      return [];
    }
  },

  /**
   * Store an inference in the database
   * @param {string} userId - User ID
   * @param {Object} inference - Inference object
   * @param {Object} supabase - Supabase client
   */
  async storeInference(userId, inference, supabase) {
    if (!userId || !supabase || !inference) return null;

    // Check for duplicate
    const { data: existing } = await supabase
      .from('memory_inferences')
      .select('id')
      .eq('user_id', userId)
      .eq('inference', inference.inference)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      console.log('[Entities] Phase 10.6 - Inference already exists, skipping');
      return null;
    }

    const { data, error } = await supabase
      .from('memory_inferences')
      .insert({
        user_id: userId,
        inference_type: inference.type,
        subject_entities: inference.entities,
        inference: inference.inference,
        confidence: inference.confidence,
        supporting_evidence: [{ reasoning: inference.reasoning }],
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[Entities] Phase 10.6 - Store inference error:', error);
      return null;
    }

    console.log(`[Entities] Phase 10.6 - Stored inference: ${inference.inference.substring(0, 50)}...`);
    return data;
  },

  /**
   * Get active inferences for context injection
   * @param {string} userId - User ID
   * @param {Array} entityNames - Entity names to filter by
   * @param {Object} supabase - Supabase client
   * @returns {Array} Relevant inferences
   */
  async getInferencesForContext(userId, entityNames, supabase) {
    if (!userId || !supabase || !entityNames || entityNames.length === 0) return [];

    const { data: inferences } = await supabase
      .from('memory_inferences')
      .select('inference_type, subject_entities, inference, confidence')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .overlaps('subject_entities', entityNames)
      .order('confidence', { ascending: false })
      .limit(5);

    return inferences || [];
  },

  // ============================================
  // PHASE 10.7: Importance Classification
  // ============================================

  IMPORTANCE_SCORES: {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
    trivial: 0.1
  },

  /**
   * Classify importance of an entity
   * @param {string} userId - User ID
   * @param {string} entityId - Entity ID
   * @param {Object} supabase - Supabase client
   */
  async classifyEntityImportance(userId, entityId, supabase) {
    if (!userId || !entityId || !supabase) return null;

    const { data: entity } = await supabase
      .from('user_entities')
      .select('name, entity_type, relationship, context_notes, mention_count')
      .eq('id', entityId)
      .single();

    if (!entity) {
      console.log('[Entities] Phase 10.7 - Entity not found for importance classification');
      return null;
    }

    // Quick heuristic for obvious cases
    const quickImportance = this.getQuickImportance(entity);
    if (quickImportance) {
      await this.updateEntityImportance(entityId, quickImportance, supabase);
      return quickImportance;
    }

    // Use LLM for nuanced classification
    try {
      const response = await fetch('/api/classify-importance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity })
      });

      if (!response.ok) {
        console.error('[Entities] Phase 10.7 - Importance API failed:', response.status);
        return null;
      }

      const result = await response.json();
      await this.updateEntityImportance(entityId, result, supabase);

      console.log(`[Entities] Phase 10.7 - Classified ${entity.name}: ${result.importance}`);
      return result;

    } catch (err) {
      console.error('[Entities] Phase 10.7 - Importance classification error:', err);
      return null;
    }
  },

  /**
   * Quick heuristic for obvious importance levels
   * @param {Object} entity - Entity data
   */
  getQuickImportance(entity) {
    const name = entity.name.toLowerCase();
    const relationship = (entity.relationship || '').toLowerCase();

    // Critical: family, partner
    if (relationship.match(/mom|dad|mother|father|parent|wife|husband|partner|spouse|child|son|daughter/)) {
      return { importance: 'critical', importance_score: 1.0, reasoning: 'Family member' };
    }

    // Critical: self-references
    if (name === 'me' || name === 'i' || name === 'myself') {
      return { importance: 'critical', importance_score: 1.0, reasoning: 'Self-reference' };
    }

    // High: pets
    if (entity.entity_type === 'pet' || relationship.match(/pet|dog|cat/)) {
      return { importance: 'high', importance_score: 0.8, reasoning: 'Pet' };
    }

    // High: best friend, close friend
    if (relationship.match(/best friend|close friend|bff/)) {
      return { importance: 'high', importance_score: 0.8, reasoning: 'Close friend' };
    }

    // High frequency = higher importance
    if (entity.mention_count >= 10) {
      return { importance: 'high', importance_score: 0.8, reasoning: 'Frequently mentioned' };
    }

    // Low frequency = lower importance
    if (entity.mention_count <= 1) {
      return { importance: 'low', importance_score: 0.3, reasoning: 'Single mention' };
    }

    return null; // Use LLM for nuanced cases
  },

  /**
   * Update entity importance in database
   * @param {string} entityId - Entity ID
   * @param {Object} classification - Classification result
   * @param {Object} supabase - Supabase client
   */
  async updateEntityImportance(entityId, classification, supabase) {
    const { error } = await supabase
      .from('user_entities')
      .update({
        importance: classification.importance,
        importance_score: classification.importance_score,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId);

    if (error) {
      console.error('[Entities] Phase 10.7 - Update importance error:', error);
    }
  },

  /**
   * Batch classify entities that haven't been classified
   * @param {string} userId - User ID
   * @param {Object} supabase - Supabase client
   */
  async batchClassifyImportance(userId, supabase) {
    if (!userId || !supabase) return 0;

    const { data: entities } = await supabase
      .from('user_entities')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or('importance.is.null,importance.eq.medium')
      .order('mention_count', { ascending: false })
      .limit(10);

    if (!entities || entities.length === 0) {
      console.log('[Entities] Phase 10.7 - No entities need importance classification');
      return 0;
    }

    console.log(`[Entities] Phase 10.7 - Classifying importance for ${entities.length} entities`);

    let count = 0;
    for (const entity of entities) {
      await this.classifyEntityImportance(userId, entity.id, supabase);
      count++;
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }

    return count;
  },

  /**
   * Get entities sorted by importance for context
   * @param {string} userId - User ID
   * @param {Object} supabase - Supabase client
   * @param {number} limit - Max entities to return
   */
  async getEntitiesByImportance(userId, supabase, limit = 15) {
    if (!userId || !supabase) return [];

    const { data: entities } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('importance_score', { ascending: false })
      .order('mention_count', { ascending: false })
      .limit(limit);

    return entities || [];
  },

  // ============================================
  // PHASE 10.8: Automatic Forgetting
  // ============================================

  DECAY_CONFIG: {
    // Days until importance starts decaying
    gracePeriodsByImportance: {
      critical: Infinity, // Never decay
      high: 90,
      medium: 30,
      low: 14,
      trivial: 7
    },
    // How much to reduce importance_score per decay cycle
    decayRates: {
      critical: 0,
      high: 0.05,
      medium: 0.1,
      low: 0.15,
      trivial: 0.2
    },
    // Minimum score before archiving
    archiveThreshold: 0.1,
    // Days between decay cycles
    decayCyclesDays: 7
  },

  /**
   * Apply decay to stale entities
   * @param {string} userId - User ID
   * @param {Object} supabase - Supabase client
   */
  async applyMemoryDecay(userId, supabase) {
    if (!userId || !supabase) return { decayed: 0, archived: 0 };

    const decayCutoff = new Date(Date.now() - this.DECAY_CONFIG.decayCyclesDays * 24 * 60 * 60 * 1000).toISOString();

    // Get entities due for decay
    const { data: entities } = await supabase
      .from('user_entities')
      .select('id, name, importance, importance_score, last_mentioned_at, last_decay_at, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('importance', 'critical') // Never decay critical
      .lt('last_decay_at', decayCutoff);

    if (!entities || entities.length === 0) {
      console.log('[Entities] Phase 10.8 - No entities need decay');
      return { decayed: 0, archived: 0 };
    }

    console.log(`[Entities] Phase 10.8 - Processing decay for ${entities.length} entities`);

    let decayed = 0;
    let archived = 0;

    for (const entity of entities) {
      const result = await this.decayEntity(entity, supabase);
      if (result === 'decayed') decayed++;
      if (result === 'archived') archived++;
    }

    console.log(`[Entities] Phase 10.8 - Decay complete: ${decayed} decayed, ${archived} archived`);
    return { decayed, archived };
  },

  /**
   * Decay a single entity
   * @param {Object} entity - Entity data
   * @param {Object} supabase - Supabase client
   */
  async decayEntity(entity, supabase) {
    const importance = entity.importance || 'medium';
    const gracePeriod = this.DECAY_CONFIG.gracePeriodsByImportance[importance];
    const decayRate = this.DECAY_CONFIG.decayRates[importance];

    // Check if entity is within grace period
    const lastMentioned = new Date(entity.last_mentioned_at || entity.created_at);
    const daysSinceMention = (Date.now() - lastMentioned.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceMention < gracePeriod) {
      // Update last_decay_at but don't decay
      await supabase
        .from('user_entities')
        .update({ last_decay_at: new Date().toISOString() })
        .eq('id', entity.id);
      return 'skipped';
    }

    // Apply decay
    const currentScore = entity.importance_score || 0.5;
    const newScore = Math.max(0, currentScore - decayRate);

    // Check if should archive
    if (newScore < this.DECAY_CONFIG.archiveThreshold) {
      await supabase
        .from('user_entities')
        .update({
          status: 'archived',
          importance_score: newScore,
          last_decay_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      console.log(`[Entities] Phase 10.8 - Archived ${entity.name} (score: ${newScore.toFixed(2)})`);
      return 'archived';
    }

    // Update with decayed score
    await supabase
      .from('user_entities')
      .update({
        importance_score: newScore,
        last_decay_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', entity.id);

    console.log(`[Entities] Phase 10.8 - Decayed ${entity.name}: ${currentScore.toFixed(2)} → ${newScore.toFixed(2)}`);
    return 'decayed';
  },

  /**
   * Refresh entity (reset decay when mentioned)
   * @param {string} entityId - Entity ID
   * @param {Object} supabase - Supabase client
   */
  async refreshEntity(entityId, supabase) {
    if (!entityId || !supabase) return;

    const { data: entity } = await supabase
      .from('user_entities')
      .select('importance, importance_score')
      .eq('id', entityId)
      .single();

    if (!entity) return;

    // Restore score based on importance
    const baseScore = this.IMPORTANCE_SCORES[entity.importance] || 0.5;
    const newScore = Math.max(entity.importance_score || 0.5, baseScore);

    await supabase
      .from('user_entities')
      .update({
        importance_score: newScore,
        last_mentioned_at: new Date().toISOString(),
        last_decay_at: new Date().toISOString()
      })
      .eq('id', entityId);

    console.log(`[Entities] Phase 10.8 - Refreshed entity ${entityId}: score → ${newScore.toFixed(2)}`);
  },

  /**
   * Clean up expired inferences
   * @param {string} userId - User ID
   * @param {Object} supabase - Supabase client
   */
  async cleanupExpiredInferences(userId, supabase) {
    if (!userId || !supabase) return 0;

    const { data, error } = await supabase
      .from('memory_inferences')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('[Entities] Phase 10.8 - Cleanup inferences error:', error);
      return 0;
    }

    console.log('[Entities] Phase 10.8 - Expired inferences cleaned up');
    return data?.length || 0;
  },

  /**
   * Run full memory maintenance
   * @param {string} userId - User ID
   * @param {Object} supabase - Supabase client
   */
  async runMemoryMaintenance(userId, supabase) {
    if (!userId || !supabase) {
      console.log('[Entities] Phase 10.8 - Missing userId or supabase');
      return null;
    }

    console.log('[Entities] Phase 10.8 - Starting memory maintenance...');

    const results = {
      decay: await this.applyMemoryDecay(userId, supabase),
      inferencesExpired: await this.cleanupExpiredInferences(userId, supabase),
      importanceClassified: await this.batchClassifyImportance(userId, supabase),
      inferencesGenerated: (await this.inferEntityConnections(userId, supabase)).length
    };

    console.log('[Entities] Phase 10.8 - Memory maintenance complete:', results);
    return results;
  }
};
