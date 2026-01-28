/**
 * Phase 9: Profile UI for TWIN Tab
 * Displays user profile, preferences, and edit modals
 */

window.UIProfile = {
  // Cached profile data
  profile: null,
  noteCount: 0,

  // Tone options
  TONE_OPTIONS: [
    { value: 'DIRECT', title: 'Direct and efficient', subtitle: 'Get to the point, no fluff' },
    { value: 'WARM', title: 'Warm and supportive', subtitle: 'Gentle, encouraging' },
    { value: 'CHALLENGING', title: 'Challenge me', subtitle: 'Push back, ask hard questions' },
    { value: 'ADAPTIVE', title: 'Let it adapt', subtitle: 'Match my energy each time' }
  ],

  /**
   * Initialize profile UI
   */
  async init() {
    await this.loadProfile();
  },

  /**
   * Load profile from Supabase
   * Loads from BOTH user_profiles AND onboarding_data to get complete data
   */
  async loadProfile() {
    if (!Sync.supabase || !Sync.user) {
      console.log('[UIProfile] No Supabase user');
      return null;
    }

    try {
      // Load from BOTH tables in parallel
      const [profileResult, onboardingResult, notesResult] = await Promise.all([
        // Get user_profiles (for preferences like tone, life_context, boundaries)
        Sync.supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', Sync.user.id)
          .maybeSingle(),
        // Get onboarding_data (for life_seasons, mental_focus, seeded_people)
        Sync.supabase
          .from('onboarding_data')
          .select('*')
          .eq('user_id', Sync.user.id)
          .maybeSingle(),
        // Get note count for preferences unlock
        Sync.supabase
          .from('notes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', Sync.user.id)
          .is('deleted_at', null)
      ]);

      const profile = profileResult.data || {};
      const onboarding = onboardingResult.data || {};

      // Helper to convert legacy UPPERCASE values to lowercase IDs
      const toLowerIds = (arr) => (arr || []).map(v => v?.toLowerCase?.() || v);

      // Get life_seasons: prefer onboarding_data, fallback to legacy role_types/role_type
      let lifeSeasons = [];
      if (onboarding.life_seasons?.length > 0) {
        lifeSeasons = onboarding.life_seasons;
      } else if (profile.role_types?.length > 0) {
        lifeSeasons = toLowerIds(profile.role_types);
      } else if (profile.role_type) {
        lifeSeasons = toLowerIds([profile.role_type]);
      }

      // Get mental_focus: prefer onboarding_data, fallback to legacy goals
      let mentalFocus = [];
      if (onboarding.mental_focus?.length > 0) {
        mentalFocus = onboarding.mental_focus;
      } else if (profile.goals?.length > 0) {
        // Map legacy goal IDs to mental_focus IDs
        const goalMapping = {
          'SELF_UNDERSTANDING': 'myself',
          'ORGANIZE': 'work',
          'PROCESS': 'relationships',
          'DECIDE': 'decision',
          'REMEMBER': 'future',
          'CREATE': 'project'
        };
        mentalFocus = profile.goals.map(g => goalMapping[g] || g.toLowerCase());
      }

      // Merge: onboarding data takes priority for onboarding fields
      this.profile = {
        ...profile,
        // Use onboarding data for these fields (source of truth)
        name: onboarding.name || profile.name,
        life_seasons: lifeSeasons,
        mental_focus: mentalFocus,
        seeded_people: onboarding.seeded_people || [],
        depth_answer: onboarding.depth_answer || null
      };

      // Store onboarding data separately for edit modals
      this.onboardingData = onboarding;

      this.noteCount = notesResult.count || 0;

      // Check if preferences should be unlocked
      if (this.noteCount >= 5 && profile && !profile.preferences_unlocked_at) {
        await Sync.supabase
          .from('user_profiles')
          .update({ preferences_unlocked_at: new Date().toISOString() })
          .eq('user_id', Sync.user.id);
        this.profile.preferences_unlocked_at = new Date().toISOString();
      }

      console.log('[UIProfile] Profile loaded:', this.profile?.name, 'life_seasons:', this.profile?.life_seasons, 'notes:', this.noteCount);
      return this.profile;

    } catch (err) {
      console.warn('[UIProfile] Failed to load profile:', err.message);
      return null;
    }
  },

  /**
   * Render the About You section - Card-based editorial layout
   */
  renderAboutYouSection() {
    if (!this.profile) {
      return `
        <section class="twin-card">
          <h2 class="twin-card__header">About You</h2>
          <div class="twin-card__content">
            <p class="twin-empty-editorial">Complete onboarding to set up your profile</p>
          </div>
        </section>
      `;
    }

    // Use life_seasons from onboarding_data (primary source)
    const lifeSeasonsLabel = this.formatLifeSeasons(this.profile.life_seasons);
    // Use mental_focus from onboarding_data (primary source)
    const mentalFocusLabel = this.formatMentalFocus(this.profile.mental_focus);

    return `
      <section class="twin-card">
        <h2 class="twin-card__header">About You</h2>
        <div class="twin-card__content">
          <div class="profile-field">
            <div class="profile-field__label">Your Name</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${this.escapeHtml(this.profile.name || 'Not set')}</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('name')">Edit</button>
            </div>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">Describe Your Days</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${lifeSeasonsLabel}</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('role')">Edit</button>
            </div>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">You're Here To</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${mentalFocusLabel}</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('goals')">Edit</button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Render the Preferences section (unlocks after 5 notes) - Card-based layout
   */
  renderPreferencesSection() {
    const isUnlocked = this.noteCount >= 5;

    if (!isUnlocked) {
      return `
        <section class="twin-card">
          <h2 class="twin-card__header">Your Preferences</h2>
          <div class="twin-card__content" style="text-align: center; padding: var(--space-4) 0;">
            <div style="font-size: 1.5rem; margin-bottom: var(--space-2);">🔒</div>
            <p class="twin-empty-editorial">Unlocks after 5 notes</p>
            <p style="font: 400 0.75rem/1.4 var(--font-sans); color: var(--ink-400); margin-top: var(--space-2);">
              You have ${this.noteCount} note${this.noteCount !== 1 ? 's' : ''}
            </p>
          </div>
        </section>
      `;
    }

    const toneLabel = this.profile?.tone ? this.formatTone(this.profile.tone) : 'Not set';
    const contextPreview = this.profile?.life_context
      ? this.truncate(this.profile.life_context, 50)
      : 'Not set';
    const keyPeopleCount = 0; // Will be fetched from user_key_people
    const boundariesCount = this.profile?.boundaries?.length || 0;

    return `
      <section class="twin-card">
        <h2 class="twin-card__header">Your Preferences</h2>
        <div class="twin-card__content">
          <div class="profile-field">
            <div class="profile-field__label">How I Speak to You</div>
            <div class="profile-field__row">
              <span class="profile-field__value ${!this.profile?.tone ? 'profile-field__value--empty' : ''}">${toneLabel}</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('tone')">${this.profile?.tone ? 'Edit' : 'Add'}</button>
            </div>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">What's On Your Plate</div>
            <div class="profile-field__row">
              <span class="profile-field__value ${!this.profile?.life_context ? 'profile-field__value--empty' : ''}">${contextPreview}</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('context')">${this.profile?.life_context ? 'Edit' : 'Add'}</button>
            </div>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">Key People</div>
            <div class="profile-field__row">
              <span class="profile-field__value" id="key-people-count">${keyPeopleCount} people</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('people')">Edit</button>
            </div>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">Topics to Avoid</div>
            <div class="profile-field__row">
              <span class="profile-field__value ${boundariesCount === 0 ? 'profile-field__value--empty' : ''}">${boundariesCount === 0 ? 'None set' : boundariesCount + ' topics'}</span>
              <button class="profile-field__edit" onclick="UIProfile.openEditModal('boundaries')">${boundariesCount === 0 ? 'Add' : 'Edit'}</button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Open edit modal for a specific field
   */
  openEditModal(field) {
    const modalFunctions = {
      'name': () => this.showNameModal(),
      'role': () => this.showRoleModal(),
      'goals': () => this.showGoalsModal(),
      'tone': () => this.showToneModal(),
      'context': () => this.showContextModal(),
      'people': () => this.showPeopleModal(),
      'boundaries': () => this.showBoundariesModal()
    };

    if (modalFunctions[field]) {
      modalFunctions[field]();
    }
  },

  /**
   * Show modal overlay
   */
  showModal(title, bodyHtml, footerHtml = '') {
    // Remove existing modal
    this.closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-new';
    overlay.id = 'profile-modal-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeModal();
    };

    overlay.innerHTML = `
      <div class="modal-new">
        <div class="modal-new__header">
          <h3 class="modal-new__title">${title}</h3>
          <button class="modal-new__close" onclick="UIProfile.closeModal()">×</button>
        </div>
        <div class="modal-new__body">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="modal-new__footer">${footerHtml}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay-new--visible');
    });
  },

  /**
   * Close modal
   */
  closeModal() {
    const overlay = document.getElementById('profile-modal-overlay');
    if (overlay) {
      overlay.classList.remove('modal-overlay-new--visible');
      setTimeout(() => overlay.remove(), 200);
    }
  },

  /**
   * Name edit modal
   */
  showNameModal() {
    const body = `
      <div class="field-group">
        <label for="modal-name-input" class="sr-only">Your name</label>
        <input
          type="text"
          id="modal-name-input"
          class="input-new"
          value="${this.escapeHtml(this.profile?.name || '')}"
          placeholder="Your name"
          autofocus
          aria-label="Your name"
        >
      </div>
    `;

    const footer = `
      <button class="btn-primary-new" onclick="UIProfile.saveName()">SAVE</button>
    `;

    this.showModal('YOUR NAME', body, footer);
    setTimeout(() => document.getElementById('modal-name-input')?.focus(), 100);
  },

  async saveName() {
    const input = document.getElementById('modal-name-input');
    const value = input?.value.trim();

    if (!value) return;

    try {
      // Save to BOTH tables to keep them in sync
      await Promise.all([
        Sync.supabase
          .from('user_profiles')
          .update({ name: value })
          .eq('user_id', Sync.user.id),
        Sync.supabase
          .from('onboarding_data')
          .update({ name: value })
          .eq('user_id', Sync.user.id)
      ]);

      this.profile.name = value;
      this.closeModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Name saved:', value);
    } catch (err) {
      console.error('[UIProfile] Failed to save name:', err);
    }
  },

  /**
   * Role edit modal - Uses LIFE_SEASONS from onboarding
   * Multi-select (1-3)
   */
  showRoleModal() {
    // Initialize from life_seasons (from onboarding_data)
    const currentSeasons = Array.isArray(this.profile?.life_seasons)
      ? [...this.profile.life_seasons]
      : [];
    this._selectedRoles = currentSeasons;

    // Use LIFE_SEASONS from Onboarding module
    const seasonOptions = typeof Onboarding !== 'undefined' && Onboarding.LIFE_SEASONS
      ? Onboarding.LIFE_SEASONS
      : [
          { id: 'building', label: 'Building something new' },
          { id: 'leading', label: 'Leading others' },
          { id: 'learning', label: 'Learning / Growing' },
          { id: 'transition', label: 'In transition' },
          { id: 'caring', label: 'Caring for others' },
          { id: 'creating', label: 'Creating' },
          { id: 'healing', label: 'Healing / Recovering' },
          { id: 'exploring', label: 'Exploring' },
          { id: 'settling', label: 'Settling in' },
          { id: 'fresh', label: 'Starting fresh' }
        ];

    const options = seasonOptions.map(opt => {
      const isSelected = currentSeasons.includes(opt.id);
      return `
        <button class="selection-option ${isSelected ? 'selected' : ''}"
             data-value="${opt.id}"
             onclick="UIProfile.toggleRoleOption('${opt.id}', this)">
          <span class="selection-title">${opt.label}</span>
        </button>
      `;
    }).join('');

    const body = `
      <p class="modal-hint" style="color: var(--ink-400); margin-bottom: var(--space-4);">Select 1–3 that fit</p>
      <div class="selection-list">${options}</div>
      <p class="modal-error" id="role-modal-error" style="display: none; color: var(--ink-400); margin-top: var(--space-3);">Maximum 3 selections</p>
    `;
    const footer = `<button class="btn-primary" id="role-save-btn" onclick="UIProfile.saveRole()" ${currentSeasons.length > 0 ? '' : 'disabled'}>Save</button>`;

    this.showModal('What describes your days?', body, footer);
  },

  toggleRoleOption(value, element) {
    const idx = this._selectedRoles.indexOf(value);
    const errorEl = document.getElementById('role-modal-error');
    const saveBtn = document.getElementById('role-save-btn');

    if (idx > -1) {
      // Deselect
      this._selectedRoles.splice(idx, 1);
      element.classList.remove('selected');
    } else {
      // Select (max 3)
      if (this._selectedRoles.length >= 3) {
        if (errorEl) {
          errorEl.style.display = 'block';
          setTimeout(() => { errorEl.style.display = 'none'; }, 2000);
        }
        return;
      }
      this._selectedRoles.push(value);
      element.classList.add('selected');
    }

    if (errorEl) errorEl.style.display = 'none';
    if (saveBtn) saveBtn.disabled = this._selectedRoles.length === 0;
    console.log('[UIProfile] Life seasons selected:', this._selectedRoles);
  },

  async saveRole() {
    if (!this._selectedRoles || this._selectedRoles.length === 0) return;

    // Phase 9.2: Show loading state
    console.log('[Loading] Showing: Updating...');
    window.showProcessingOverlay?.('Updating...');

    try {
      // FIX: Use upsert to handle case where row doesn't exist
      const { error } = await Sync.supabase
        .from('onboarding_data')
        .upsert({
          user_id: Sync.user.id,
          life_seasons: this._selectedRoles,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[UIProfile] Supabase error saving life seasons:', error);
        UI.showToast?.('Failed to save. Please try again.');
        return;
      }

      // Verify the save worked by re-loading
      const { data: verifyData } = await Sync.supabase
        .from('onboarding_data')
        .select('life_seasons')
        .eq('user_id', Sync.user.id)
        .maybeSingle();

      console.log('[UIProfile] Verified saved life_seasons:', verifyData?.life_seasons);

      this.profile.life_seasons = this._selectedRoles;
      this.closeModal();
      this.refreshProfileDisplay();
      UI.showToast?.('Saved');
      console.log('[UIProfile] Life seasons saved:', this._selectedRoles);
    } catch (err) {
      console.error('[UIProfile] Failed to save life seasons:', err);
      UI.showToast?.('Failed to save. Please try again.');
    } finally {
      console.log('[Loading] Hiding');
      window.hideProcessingOverlay?.();
    }
  },

  /**
   * Goals edit modal - Uses MENTAL_FOCUS from onboarding
   * Allow 1-3 selections
   */
  showGoalsModal() {
    // Use MENTAL_FOCUS from Onboarding module
    const focusOptions = typeof Onboarding !== 'undefined' && Onboarding.MENTAL_FOCUS
      ? Onboarding.MENTAL_FOCUS
      : [
          { id: 'work', label: 'Work' },
          { id: 'relationships', label: 'Relationships' },
          { id: 'health', label: 'Health' },
          { id: 'money', label: 'Money' },
          { id: 'family', label: 'Family' },
          { id: 'decision', label: 'A decision' },
          { id: 'future', label: 'The future' },
          { id: 'myself', label: 'Myself' },
          { id: 'project', label: 'A project' },
          { id: 'loss', label: 'Something I lost' }
        ];

    const currentFocus = this.profile?.mental_focus || [];

    const pills = focusOptions.map(opt => {
      const isSelected = currentFocus.includes(opt.id);
      return `
        <div class="goal-pill ${isSelected ? 'goal-pill--selected' : ''}"
             onclick="UIProfile.toggleGoalOption('${opt.id}', this)">
          ${opt.label}
        </div>
      `;
    }).join('');

    const body = `
      <p class="text-caption text-muted" style="margin-bottom: var(--space-4);">Select up to 3 that are on your mind</p>
      <div class="goal-grid">${pills}</div>
      <p class="onboarding-error" id="modal-goals-error" style="display: none;"></p>
    `;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.saveGoals()">SAVE</button>`;

    this.showModal('WHAT\'S ON YOUR MIND?', body, footer);
    this._selectedGoals = [...currentFocus];
  },

  toggleGoalOption(value, element) {
    const idx = this._selectedGoals.indexOf(value);
    const errorEl = document.getElementById('modal-goals-error');

    if (idx > -1) {
      this._selectedGoals.splice(idx, 1);
      element.classList.remove('goal-pill--selected');
    } else {
      if (this._selectedGoals.length >= 3) {
        errorEl.textContent = 'Maximum 3 selections';
        errorEl.style.display = 'block';
        setTimeout(() => { errorEl.style.display = 'none'; }, 2000);
        return;
      }
      this._selectedGoals.push(value);
      element.classList.add('goal-pill--selected');
    }
    errorEl.style.display = 'none';
  },

  async saveGoals() {
    if (this._selectedGoals.length === 0) return;

    // Phase 9.2: Show loading state
    console.log('[Loading] Showing: Updating...');
    window.showProcessingOverlay?.('Updating...');

    try {
      // FIX: Use upsert to handle case where row doesn't exist
      const { error } = await Sync.supabase
        .from('onboarding_data')
        .upsert({
          user_id: Sync.user.id,
          mental_focus: this._selectedGoals,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[UIProfile] Supabase error saving mental focus:', error);
        UI.showToast?.('Failed to save. Please try again.');
        return;
      }

      // Verify the save worked by re-loading
      const { data: verifyData } = await Sync.supabase
        .from('onboarding_data')
        .select('mental_focus')
        .eq('user_id', Sync.user.id)
        .maybeSingle();

      console.log('[UIProfile] Verified saved mental_focus:', verifyData?.mental_focus);

      this.profile.mental_focus = this._selectedGoals;
      this.closeModal();
      this.refreshProfileDisplay();
      UI.showToast?.('Saved');
      console.log('[UIProfile] Mental focus saved:', this._selectedGoals);
    } catch (err) {
      console.error('[UIProfile] Failed to save goals:', err);
      UI.showToast?.('Failed to save. Please try again.');
    } finally {
      console.log('[Loading] Hiding');
      window.hideProcessingOverlay?.();
    }
  },

  /**
   * Tone edit modal
   */
  showToneModal() {
    const options = this.TONE_OPTIONS.map(opt => {
      const isSelected = this.profile?.tone === opt.value;
      return `
        <div class="option-card ${isSelected ? 'option-card--selected' : ''}"
             onclick="UIProfile.selectToneOption('${opt.value}', this)">
          <div class="option-card__title">${opt.title}</div>
          <div class="option-card__subtitle">${opt.subtitle}</div>
        </div>
      `;
    }).join('');

    const body = `<div class="role-options">${options}</div>`;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.saveTone()">SAVE</button>`;

    this.showModal('HOW SHOULD I SPEAK TO YOU?', body, footer);
    this._selectedTone = this.profile?.tone;
  },

  selectToneOption(value, element) {
    document.querySelectorAll('.option-card').forEach(card => {
      card.classList.remove('option-card--selected');
    });
    element.classList.add('option-card--selected');
    this._selectedTone = value;
  },

  async saveTone() {
    if (!this._selectedTone) return;

    // Phase 9.2: Show loading state
    console.log('[Loading] Showing: Updating...');
    window.showProcessingOverlay?.('Updating...');

    try {
      await Sync.supabase
        .from('user_profiles')
        .update({ tone: this._selectedTone })
        .eq('user_id', Sync.user.id);

      this.profile.tone = this._selectedTone;
      this.closeModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Tone saved:', this._selectedTone);
    } catch (err) {
      console.error('[UIProfile] Failed to save tone:', err);
    } finally {
      console.log('[Loading] Hiding');
      window.hideProcessingOverlay?.();
    }
  },

  /**
   * Life context edit modal
   */
  showContextModal() {
    const currentValue = this.profile?.life_context || '';
    const body = `
      <p class="modal-new__subtitle">A sentence about what you're navigating right now</p>
      <div class="field-group">
        <label for="modal-context-input" class="sr-only">Life context</label>
        <textarea
          id="modal-context-input"
          class="textarea-new"
          placeholder="Raising a seed round while trying to be present for my family..."
          maxlength="200"
          aria-label="Life context"
        >${this.escapeHtml(currentValue)}</textarea>
        <div class="char-count"><span id="context-char-count">${currentValue.length}</span> / 200</div>
      </div>
    `;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.saveContext()">SAVE</button>`;

    this.showModal("WHAT'S ON YOUR PLATE?", body, footer);

    // Setup char counter
    const textarea = document.getElementById('modal-context-input');
    const counter = document.getElementById('context-char-count');
    textarea.addEventListener('input', () => {
      counter.textContent = textarea.value.length;
    });
    textarea.focus();
  },

  async saveContext() {
    const textarea = document.getElementById('modal-context-input');
    const value = textarea?.value.trim();

    try {
      await Sync.supabase
        .from('user_profiles')
        .update({ life_context: value || null })
        .eq('user_id', Sync.user.id);

      this.profile.life_context = value || null;
      this.closeModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Context saved');
    } catch (err) {
      console.error('[UIProfile] Failed to save context:', err);
    }
  },

  /**
   * Key people edit modal
   */
  async showPeopleModal() {
    // Fetch key people from database
    let keyPeople = [];
    try {
      const { data } = await Sync.supabase
        .from('user_key_people')
        .select('*')
        .eq('user_id', Sync.user.id)
        .order('created_at', { ascending: false });
      keyPeople = data || [];
    } catch (err) {
      console.warn('[UIProfile] Failed to load key people:', err);
    }

    const peopleList = keyPeople.length > 0
      ? keyPeople.map(p => `
          <div class="entity-item" data-person-id="${p.id}">
            <div class="entity-item__name">${this.escapeHtml(p.name)}</div>
            <div class="entity-item__meta">
              <span>${this.escapeHtml(p.relationship)}</span>
              <button class="entity-item__edit" onclick="UIProfile.removePerson('${p.id}')">×</button>
            </div>
          </div>
        `).join('')
      : '<p class="entity-empty">No key people added yet</p>';

    const body = `
      <p class="modal-new__subtitle">People your Twin should know about</p>
      <div class="entity-list" id="people-list">
        ${peopleList}
      </div>
      <div class="mt-4">
        <button class="btn-text-new" onclick="UIProfile.showAddPersonForm()">+ Add person</button>
        <div id="add-person-form" style="display: none; margin-top: var(--space-3);">
          <div class="field-group">
            <label for="new-person-name" class="sr-only">Person's name</label>
            <input type="text" id="new-person-name" class="input-new" placeholder="Name" aria-label="Person's name">
          </div>
          <div class="field-group">
            <label for="new-person-relationship" class="sr-only">Relationship</label>
            <input type="text" id="new-person-relationship" class="input-new" placeholder="Relationship (e.g., cofounder, friend)" aria-label="Relationship">
          </div>
          <div style="display: flex; gap: var(--space-2);">
            <button class="btn-secondary-new" onclick="UIProfile.hideAddPersonForm()">Cancel</button>
            <button class="btn-primary-new" onclick="UIProfile.addPerson()">Add</button>
          </div>
        </div>
      </div>
    `;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.closeModal()">DONE</button>`;

    this.showModal('KEY PEOPLE', body, footer);
  },

  showAddPersonForm() {
    document.getElementById('add-person-form').style.display = 'block';
    document.getElementById('new-person-name').focus();
  },

  hideAddPersonForm() {
    document.getElementById('add-person-form').style.display = 'none';
    document.getElementById('new-person-name').value = '';
    document.getElementById('new-person-relationship').value = '';
  },

  async addPerson() {
    const name = document.getElementById('new-person-name').value.trim();
    const relationship = document.getElementById('new-person-relationship').value.trim();

    if (!name || !relationship) return;

    try {
      const insertData = {
        user_id: Sync.user.id,
        name: name,
        relationship: relationship,
        added_via: 'profile'
      };

      // Encrypt sensitive data if PIN encryption is available
      if (typeof PIN !== 'undefined' && PIN.encryptionKey) {
        const sensitiveData = { name, relationship };
        const encrypted = await PIN.encrypt(JSON.stringify(sensitiveData));
        insertData.encrypted_data = encrypted;
        console.log('[UIProfile] Encrypting key person data');
      }

      const { data, error } = await Sync.supabase
        .from('user_key_people')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Re-render modal
      this.showPeopleModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Person added:', name, PIN?.encryptionKey ? '[encrypted]' : '');
    } catch (err) {
      console.error('[UIProfile] Failed to add person:', err);
    }
  },

  async removePerson(personId) {
    try {
      await Sync.supabase
        .from('user_key_people')
        .delete()
        .eq('id', personId)
        .eq('user_id', Sync.user.id);

      // Re-render modal
      this.showPeopleModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Person removed:', personId);
    } catch (err) {
      console.error('[UIProfile] Failed to remove person:', err);
    }
  },

  /**
   * Boundaries edit modal
   */
  showBoundariesModal() {
    const boundaries = this.profile?.boundaries || [];
    const tags = boundaries.map(b => `
      <span class="tag-pill">
        ${this.escapeHtml(b)}
        <button class="tag-pill__remove" onclick="UIProfile.removeBoundary('${this.escapeHtml(b)}')">×</button>
      </span>
    `).join('');

    const body = `
      <p class="modal-new__subtitle">Your Twin won't probe these topics</p>
      <div id="boundaries-tags" style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4);">
        ${tags || '<span class="text-caption text-muted">No topics added</span>'}
      </div>
      <div style="display: flex; gap: var(--space-2);">
        <label for="new-boundary-input" class="sr-only">Add boundary topic</label>
        <input type="text" id="new-boundary-input" class="input-new" placeholder="Add topic..." style="flex: 1;" aria-label="Add boundary topic">
        <button class="btn-secondary-new" onclick="UIProfile.addBoundary()">+</button>
      </div>
    `;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.closeModal()">DONE</button>`;

    this.showModal('TOPICS TO AVOID', body, footer);

    // Enter key to add
    document.getElementById('new-boundary-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addBoundary();
    });
  },

  async addBoundary() {
    const input = document.getElementById('new-boundary-input');
    const value = input.value.trim();

    if (!value) return;

    const boundaries = this.profile?.boundaries || [];
    if (boundaries.includes(value)) {
      input.value = '';
      return;
    }

    boundaries.push(value);

    try {
      await Sync.supabase
        .from('user_profiles')
        .update({ boundaries: boundaries })
        .eq('user_id', Sync.user.id);

      this.profile.boundaries = boundaries;
      this.showBoundariesModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Boundary added:', value);
    } catch (err) {
      console.error('[UIProfile] Failed to add boundary:', err);
    }
  },

  async removeBoundary(value) {
    const boundaries = (this.profile?.boundaries || []).filter(b => b !== value);

    try {
      await Sync.supabase
        .from('user_profiles')
        .update({ boundaries: boundaries })
        .eq('user_id', Sync.user.id);

      this.profile.boundaries = boundaries;
      this.showBoundariesModal();
      this.refreshProfileDisplay();
      console.log('[UIProfile] Boundary removed:', value);
    } catch (err) {
      console.error('[UIProfile] Failed to remove boundary:', err);
    }
  },

  /**
   * Refresh profile display in TWIN tab
   * FIX: Added logging and alternative element selectors
   */
  refreshProfileDisplay() {
    console.log('[UIProfile] Refreshing profile display...');
    console.log('[UIProfile] Current life_seasons:', this.profile?.life_seasons);
    console.log('[UIProfile] Current mental_focus:', this.profile?.mental_focus);

    // Try multiple possible element IDs/selectors for about section
    let aboutSection = document.getElementById('about-me-section');
    if (!aboutSection) {
      aboutSection = document.querySelector('.about-you-section, [data-section="about"]');
    }

    if (aboutSection) {
      aboutSection.innerHTML = this.renderAboutYouSection();
      console.log('[UIProfile] Updated about section');
    } else {
      console.warn('[UIProfile] About section element not found');
    }

    // Try multiple possible element IDs/selectors for preferences
    let prefsSection = document.getElementById('preferences-section');
    if (!prefsSection) {
      prefsSection = document.querySelector('.preferences-section, [data-section="preferences"]');
    }

    if (prefsSection) {
      prefsSection.innerHTML = this.renderPreferencesSection();
      console.log('[UIProfile] Updated preferences section');
    } else {
      console.log('[UIProfile] Preferences section element not found (may not exist yet)');
    }

    // Update key people count
    this.updateKeyPeopleCount();
  },

  async updateKeyPeopleCount() {
    try {
      // Use regular select instead of HEAD request (head: true) which can cause 502 errors
      const { data, error } = await Sync.supabase
        .from('user_key_people')
        .select('id')
        .eq('user_id', Sync.user.id);

      if (error) {
        console.warn('[UIProfile] Key people count error:', error);
        return;
      }

      const count = data?.length || 0;
      const countEl = document.getElementById('key-people-count');
      if (countEl) {
        countEl.textContent = `${count} people`;
      }
    } catch (err) {
      console.warn('[UIProfile] Failed to update people count:', err);
    }
  },

  // Helper functions
  formatRoleType(roleType) {
    const labels = {
      'BUILDING': 'Building something',
      'LEADING': 'Leading others',
      'MAKING': 'Deep in the work',
      'LEARNING': 'Learning & exploring',
      'JUGGLING': 'Juggling multiple things',
      'TRANSITIONING': 'Between chapters'
    };
    // Handle array of roles (multi-select)
    if (Array.isArray(roleType)) {
      if (roleType.length === 0) return 'Not set';
      return roleType.map(r => labels[r] || r).join(', ');
    }
    // Handle single role (legacy)
    return labels[roleType] || roleType || 'Not set';
  },

  formatGoals(goals) {
    if (!goals || goals.length === 0) return 'Not set';
    const labels = {
      'DECISIONS': 'Think through decisions',
      'PROCESS': 'Process what happened',
      'ORGANIZE': 'Stay on top of things',
      'SELF_UNDERSTANDING': 'Understand myself better',
      'REMEMBER': 'Remember what matters',
      'EXPLORING': 'Just exploring'
    };
    return goals.map(g => labels[g] || g).join(', ');
  },

  /**
   * Format life_seasons array to display labels
   * Maps onboarding IDs (e.g., 'building') to labels (e.g., 'Building something new')
   */
  formatLifeSeasons(seasons) {
    if (!seasons || seasons.length === 0) return 'Not set';

    // Use Onboarding.LIFE_SEASONS if available, otherwise use local mapping
    const getLabel = (id) => {
      if (typeof Onboarding !== 'undefined' && Onboarding.LIFE_SEASONS) {
        const found = Onboarding.LIFE_SEASONS.find(s => s.id === id);
        if (found) return found.label;
      }
      // Fallback labels
      const labels = {
        'building': 'Building something new',
        'leading': 'Leading others',
        'learning': 'Learning / Growing',
        'transition': 'In transition',
        'caring': 'Caring for others',
        'creating': 'Creating',
        'healing': 'Healing / Recovering',
        'exploring': 'Exploring',
        'settling': 'Settling in',
        'fresh': 'Starting fresh'
      };
      return labels[id] || id;
    };

    return seasons.map(getLabel).join(', ');
  },

  /**
   * Format mental_focus array to display labels
   * Maps onboarding IDs (e.g., 'work') to labels (e.g., 'Work')
   */
  formatMentalFocus(focuses) {
    if (!focuses || focuses.length === 0) return 'Not set';

    // Use Onboarding.MENTAL_FOCUS if available, otherwise use local mapping
    const getLabel = (id) => {
      if (typeof Onboarding !== 'undefined' && Onboarding.MENTAL_FOCUS) {
        const found = Onboarding.MENTAL_FOCUS.find(f => f.id === id);
        if (found) return found.label;
      }
      // Fallback labels
      const labels = {
        'work': 'Work',
        'relationships': 'Relationships',
        'health': 'Health',
        'money': 'Money',
        'family': 'Family',
        'decision': 'A decision',
        'future': 'The future',
        'myself': 'Myself',
        'project': 'A project',
        'loss': 'Something I lost'
      };
      return labels[id] || id;
    };

    return focuses.map(getLabel).join(', ');
  },

  formatTone(tone) {
    const labels = {
      'DIRECT': 'Direct and efficient',
      'WARM': 'Warm and supportive',
      'CHALLENGING': 'Challenge me',
      'ADAPTIVE': 'Adaptive'
    };
    return labels[tone] || tone;
  },

  truncate(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION PREFERENCES (Phase 17)
  // ═══════════════════════════════════════════════════════════════════════════

  notificationPrefs: null,

  /**
   * Load notification preferences from API
   */
  async loadNotificationPrefs() {
    if (!Sync.user?.id) return null;

    try {
      const response = await fetch(`/api/memory-moments/preferences?user_id=${Sync.user.id}`);
      if (response.ok) {
        const data = await response.json();
        this.notificationPrefs = data.preferences || {};
        return this.notificationPrefs;
      }
    } catch (err) {
      console.warn('[UIProfile] Failed to load notification prefs:', err);
    }
    return null;
  },

  /**
   * Save notification preferences
   */
  async saveNotificationPrefs(updates) {
    if (!Sync.user?.id) return false;

    try {
      const response = await fetch(`/api/memory-moments/preferences?user_id=${Sync.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        // Update local cache
        this.notificationPrefs = { ...this.notificationPrefs, ...updates };
        return true;
      }
    } catch (err) {
      console.error('[UIProfile] Failed to save notification prefs:', err);
    }
    return false;
  },

  /**
   * Render notification preferences section for STATS tab
   */
  renderNotificationPrefsSection() {
    const prefs = this.notificationPrefs || {};
    const momentsEnabled = prefs.memory_moments_enabled !== false;
    const reportsEnabled = prefs.monthly_report_enabled !== false;
    const timezone = prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const quietStart = prefs.quiet_hours_start || '22:00';
    const quietEnd = prefs.quiet_hours_end || '08:00';

    return `
      <section class="twin-card">
        <h2 class="twin-card__header">Notifications</h2>
        <div class="twin-card__content">
          <div class="profile-field">
            <div class="profile-field__label">Memory Moments</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${momentsEnabled ? 'On' : 'Off'}</span>
              <button class="profile-field__toggle ${momentsEnabled ? 'profile-field__toggle--on' : ''}"
                      onclick="UIProfile.toggleMoments()"
                      aria-label="Toggle Memory Moments">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </button>
            </div>
            <p class="profile-field__hint">Proactive reminders about people and memories</p>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">Monthly Reports</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${reportsEnabled ? 'On' : 'Off'}</span>
              <button class="profile-field__toggle ${reportsEnabled ? 'profile-field__toggle--on' : ''}"
                      onclick="UIProfile.toggleReports()"
                      aria-label="Toggle Monthly Reports">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </button>
            </div>
            <p class="profile-field__hint">State of You summary on the 1st of each month</p>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">Quiet Hours</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${quietStart} – ${quietEnd}</span>
              <button class="profile-field__edit" onclick="UIProfile.showQuietHoursModal()">Edit</button>
            </div>
            <p class="profile-field__hint">No moments during these hours</p>
          </div>

          <div class="profile-field">
            <div class="profile-field__label">Timezone</div>
            <div class="profile-field__row">
              <span class="profile-field__value">${this.formatTimezone(timezone)}</span>
              <button class="profile-field__edit" onclick="UIProfile.showTimezoneModal()">Edit</button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Toggle Memory Moments on/off
   */
  async toggleMoments() {
    const current = this.notificationPrefs?.memory_moments_enabled !== false;
    const newValue = !current;

    const success = await this.saveNotificationPrefs({ memory_moments_enabled: newValue });
    if (success) {
      this.refreshNotificationPrefsDisplay();
      UI.showToast(newValue ? 'Memory Moments enabled' : 'Memory Moments disabled');
    }
  },

  /**
   * Toggle Monthly Reports on/off
   */
  async toggleReports() {
    const current = this.notificationPrefs?.monthly_report_enabled !== false;
    const newValue = !current;

    const success = await this.saveNotificationPrefs({ monthly_report_enabled: newValue });
    if (success) {
      this.refreshNotificationPrefsDisplay();
      UI.showToast(newValue ? 'Monthly reports enabled' : 'Monthly reports disabled');
    }
  },

  /**
   * Show quiet hours edit modal
   */
  showQuietHoursModal() {
    const prefs = this.notificationPrefs || {};
    const quietStart = prefs.quiet_hours_start || '22:00';
    const quietEnd = prefs.quiet_hours_end || '08:00';

    const body = `
      <p class="modal-new__subtitle">Your Twin won't surface moments during these hours</p>
      <div class="field-group" style="margin-bottom: var(--space-4);">
        <label for="quiet-start-input" class="field-label">Start (no moments after)</label>
        <input type="time" id="quiet-start-input" class="input-new" value="${quietStart}">
      </div>
      <div class="field-group">
        <label for="quiet-end-input" class="field-label">End (moments resume)</label>
        <input type="time" id="quiet-end-input" class="input-new" value="${quietEnd}">
      </div>
    `;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.saveQuietHours()">SAVE</button>`;

    this.showModal('QUIET HOURS', body, footer);
  },

  /**
   * Save quiet hours
   */
  async saveQuietHours() {
    const startInput = document.getElementById('quiet-start-input');
    const endInput = document.getElementById('quiet-end-input');

    const quietStart = startInput?.value || '22:00';
    const quietEnd = endInput?.value || '08:00';

    const success = await this.saveNotificationPrefs({
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd
    });

    if (success) {
      this.closeModal();
      this.refreshNotificationPrefsDisplay();
      UI.showToast('Quiet hours updated');
    }
  },

  /**
   * Show timezone edit modal
   */
  showTimezoneModal() {
    const currentTz = this.notificationPrefs?.timezone ||
                      Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Common timezones
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Singapore',
      'Australia/Sydney',
      'Pacific/Auckland'
    ];

    const options = timezones.map(tz => {
      const isSelected = tz === currentTz;
      return `<option value="${tz}" ${isSelected ? 'selected' : ''}>${this.formatTimezone(tz)}</option>`;
    }).join('');

    const body = `
      <p class="modal-new__subtitle">Used for timing moments and reports</p>
      <div class="field-group">
        <select id="timezone-select" class="input-new">
          ${options}
        </select>
      </div>
      <p class="text-caption text-muted" style="margin-top: var(--space-2);">
        Current: ${this.formatTimezone(currentTz)}
      </p>
    `;
    const footer = `<button class="btn-primary-new" onclick="UIProfile.saveTimezone()">SAVE</button>`;

    this.showModal('TIMEZONE', body, footer);
  },

  /**
   * Save timezone
   */
  async saveTimezone() {
    const select = document.getElementById('timezone-select');
    const timezone = select?.value;

    if (!timezone) return;

    const success = await this.saveNotificationPrefs({ timezone });

    if (success) {
      this.closeModal();
      this.refreshNotificationPrefsDisplay();
      UI.showToast('Timezone updated');
    }
  },

  /**
   * Format timezone for display
   */
  formatTimezone(tz) {
    if (!tz) return 'Not set';
    // Convert "America/New_York" to "New York (EST)"
    try {
      const parts = tz.split('/');
      const city = parts[parts.length - 1].replace(/_/g, ' ');
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short'
      });
      const tzAbbr = formatter.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
      return `${city} (${tzAbbr})`;
    } catch (e) {
      return tz;
    }
  },

  /**
   * Refresh notification preferences display
   */
  refreshNotificationPrefsDisplay() {
    const section = document.getElementById('notification-prefs-section');
    if (section) {
      section.innerHTML = this.renderNotificationPrefsSection();
    }
  }
};
