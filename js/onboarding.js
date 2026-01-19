/**
 * Inscript Onboarding Flow
 * 7 Screens: Welcome → Name → Seasons → Focus → Depth → People → Privacy → WOW
 * Phase 11: Enhanced onboarding with entity seeding
 */

window.Onboarding = {
  currentStep: 0,
  container: null,

  data: {
    name: '',
    life_seasons: [],
    mental_focus: [],
    depth_question: '',
    depth_answer: '',
    seeded_people: []
  },

  // Configuration
  LIFE_SEASONS: [
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
  ],

  MENTAL_FOCUS: [
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
  ],

  DEPTH_QUESTIONS: {
    building: "What are you building?",
    transition: "What's changing for you right now?",
    caring: "Who are you caring for?",
    healing: "What are you working through?",
    creating: "What are you creating?",
    decision: "What decision is on your mind?",
    default: "What's one thing you'd want me to understand about your life right now?"
  },

  /**
   * Check if onboarding should be shown
   */
  async shouldShow() {
    // Must have a Supabase user
    if (!Sync.supabase || !Sync.user) {
      console.log('[Onboarding] No Supabase user, skipping');
      return false;
    }

    try {
      // Check onboarding_data table first
      const { data: onboardingData, error: onboardingError } = await Sync.supabase
        .from('onboarding_data')
        .select('completed_at')
        .eq('user_id', Sync.user.id)
        .single();

      if (!onboardingError && onboardingData && onboardingData.completed_at) {
        console.log('[Onboarding] Already completed (onboarding_data)');
        return false;
      }

      // Fallback: Check user_profiles table for legacy users
      const { data: profile, error: profileError } = await Sync.supabase
        .from('user_profiles')
        .select('onboarding_completed_at')
        .eq('user_id', Sync.user.id)
        .single();

      if (!profileError && profile && profile.onboarding_completed_at) {
        console.log('[Onboarding] Already completed (user_profiles)');
        return false;
      }

      // Check if user has existing notes (returning user)
      const { count, error: notesError } = await Sync.supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', Sync.user.id)
        .is('deleted_at', null);

      if (notesError) {
        console.warn('[Onboarding] Error checking notes:', notesError.message);
        return false;
      }

      // If user has notes but no profile, create profile and skip onboarding
      if (count > 0) {
        console.log('[Onboarding] Existing user with notes, creating minimal profile');
        await this.createMinimalProfile();
        return false;
      }

      // New user - show onboarding
      console.log('[Onboarding] New user, showing onboarding');
      return true;

    } catch (err) {
      console.warn('[Onboarding] Check failed:', err.message);
      return false;
    }
  },

  /**
   * Create minimal profile for existing users
   */
  async createMinimalProfile() {
    try {
      const userEmail = Sync.user.email || '';
      const name = userEmail.split('@')[0] || 'Friend';

      await Sync.supabase
        .from('user_profiles')
        .upsert({
          user_id: Sync.user.id,
          name: name,
          onboarding_completed_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    } catch (err) {
      console.warn('[Onboarding] Failed to create minimal profile:', err.message);
    }
  },

  /**
   * Initialize onboarding container
   */
  init() {
    this.container = document.getElementById('onboarding-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'onboarding-container';
      this.container.className = 'onboarding-overlay';
      document.body.appendChild(this.container);
    }
  },

  /**
   * Start onboarding flow
   */
  async start() {
    console.log('[Onboarding] Starting onboarding flow');
    this.init();
    this.currentStep = 0;
    this.data = {
      name: '',
      life_seasons: [],
      mental_focus: [],
      depth_question: '',
      depth_answer: '',
      seeded_people: []
    };
    this.render();

    // Fade in
    requestAnimationFrame(() => {
      this.container.classList.add('visible');
    });
  },

  /**
   * Render current step
   */
  render() {
    const steps = [
      this.renderWelcome,
      this.renderName,
      this.renderSeasons,
      this.renderFocus,
      this.renderDepth,
      this.renderPeople,
      this.renderPrivacy,
      this.renderWow
    ];

    const stepFn = steps[this.currentStep];
    if (stepFn) {
      this.container.innerHTML = stepFn.call(this);
      this.attachEventListeners();
    }
  },

  /**
   * Step 0: Welcome Screen
   */
  renderWelcome() {
    return `
      <div class="onboarding-screen onboarding-welcome">
        <div class="onboarding-content">
          <h1 class="onboarding-logo">INSCRIPT</h1>
          <p class="onboarding-tagline">Your mirror in code.</p>

          <div class="onboarding-intro">
            <p>I'm an AI that learns your world — the people,<br>
            patterns, and thoughts that make you who you are.</p>
          </div>

          <button class="onboarding-btn onboarding-btn-primary" data-action="next">
            Begin →
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Step 1: Name
   */
  renderName() {
    return `
      <div class="onboarding-screen onboarding-name">
        <div class="onboarding-header">
          <button class="onboarding-back" data-action="back">←</button>
          <span class="onboarding-progress">1 of 6</span>
        </div>

        <div class="onboarding-content">
          <h2 class="onboarding-question">What should I call you?</h2>

          <input
            type="text"
            class="onboarding-input"
            id="onboarding-name"
            placeholder="Your name"
            value="${this.data.name}"
            autocomplete="off"
          >

          <button class="onboarding-btn onboarding-btn-primary" data-action="next" ${!this.data.name ? 'disabled' : ''}>
            Continue →
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Step 2: Life Seasons
   */
  renderSeasons() {
    return `
      <div class="onboarding-screen onboarding-seasons">
        <div class="onboarding-header">
          <button class="onboarding-back" data-action="back">←</button>
          <span class="onboarding-progress">2 of 6</span>
        </div>

        <div class="onboarding-content">
          <h2 class="onboarding-question">What season of life are you in?</h2>
          <p class="onboarding-hint">Select all that resonate.</p>

          <div class="onboarding-options">
            ${this.LIFE_SEASONS.map(season => `
              <button
                class="onboarding-option ${this.data.life_seasons.includes(season.id) ? 'selected' : ''}"
                data-value="${season.id}"
                data-type="season"
              >
                ${season.label}
              </button>
            `).join('')}
          </div>

          <button class="onboarding-btn onboarding-btn-primary" data-action="next" ${this.data.life_seasons.length === 0 ? 'disabled' : ''}>
            Continue →
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Step 3: Mental Focus
   */
  renderFocus() {
    return `
      <div class="onboarding-screen onboarding-focus">
        <div class="onboarding-header">
          <button class="onboarding-back" data-action="back">←</button>
          <span class="onboarding-progress">3 of 6</span>
        </div>

        <div class="onboarding-content">
          <h2 class="onboarding-question">What's weighing on you lately?</h2>
          <p class="onboarding-hint">Pick up to 3.</p>

          <div class="onboarding-options onboarding-options-grid">
            ${this.MENTAL_FOCUS.map(focus => `
              <button
                class="onboarding-option ${this.data.mental_focus.includes(focus.id) ? 'selected' : ''}"
                data-value="${focus.id}"
                data-type="focus"
                ${this.data.mental_focus.length >= 3 && !this.data.mental_focus.includes(focus.id) ? 'disabled' : ''}
              >
                ${focus.label}
              </button>
            `).join('')}
          </div>

          <button class="onboarding-btn onboarding-btn-primary" data-action="next" ${this.data.mental_focus.length === 0 ? 'disabled' : ''}>
            Continue →
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Step 4: Depth Question
   */
  renderDepth() {
    const question = this.getDepthQuestion();

    return `
      <div class="onboarding-screen onboarding-depth">
        <div class="onboarding-header">
          <button class="onboarding-back" data-action="back">←</button>
          <span class="onboarding-progress">4 of 6</span>
        </div>

        <div class="onboarding-content">
          <h2 class="onboarding-question">${question}</h2>

          <textarea
            class="onboarding-textarea"
            id="onboarding-depth"
            placeholder="Even a few words helps me understand your world."
            rows="4"
          >${this.data.depth_answer}</textarea>

          <button class="onboarding-btn onboarding-btn-primary" data-action="next">
            Continue →
          </button>

          <p class="onboarding-skip-text">
            Not ready to share? That's okay.
            <button class="onboarding-skip" data-action="skip">Skip for now</button>
          </p>
        </div>
      </div>
    `;
  },

  /**
   * Step 5: Your People
   */
  renderPeople() {
    return `
      <div class="onboarding-screen onboarding-people">
        <div class="onboarding-header">
          <button class="onboarding-back" data-action="back">←</button>
          <span class="onboarding-progress">5 of 6</span>
        </div>

        <div class="onboarding-content">
          <h2 class="onboarding-question">Who might you mention when you write?</h2>
          <p class="onboarding-hint">Name at least one person I should recognize.</p>

          <div class="onboarding-people-list" id="people-list">
            ${this.data.seeded_people.length > 0
              ? this.data.seeded_people.map((person, i) => this.renderPersonInput(i, person)).join('')
              : this.renderPersonInput(0)
            }
          </div>

          <button class="onboarding-add-person" data-action="add-person">
            + Add someone else
          </button>

          <p class="onboarding-examples">
            Examples: "Jamie — partner" or "Dr. Lee — therapist" or just "Mom"
          </p>

          <button class="onboarding-btn onboarding-btn-primary" data-action="next">
            Continue →
          </button>

          <p class="onboarding-skip-text">
            <button class="onboarding-skip" data-action="skip">Skip for now</button>
          </p>
        </div>
      </div>
    `;
  },

  /**
   * Render person input row
   */
  renderPersonInput(index, person = { name: '', context: '' }) {
    const value = person.name ? (person.context ? `${person.name} — ${person.context}` : person.name) : '';
    return `
      <div class="onboarding-person-row" data-index="${index}">
        <input
          type="text"
          class="onboarding-input onboarding-person-input"
          placeholder="e.g., Marcus — close friend"
          value="${value}"
          data-index="${index}"
        >
      </div>
    `;
  },

  /**
   * Step 6: Privacy Promise
   */
  renderPrivacy() {
    return `
      <div class="onboarding-screen onboarding-privacy">
        <div class="onboarding-header">
          <button class="onboarding-back" data-action="back">←</button>
          <span class="onboarding-progress">6 of 6</span>
        </div>

        <div class="onboarding-content">
          <p class="onboarding-privacy-intro">Before we begin, a promise:</p>

          <h2 class="onboarding-privacy-headline">Your thoughts stay private.</h2>

          <div class="onboarding-privacy-divider"></div>

          <ul class="onboarding-privacy-list">
            <li>Your notes are never reviewed by our team.</li>
            <li>We don't sell or share your data.</li>
            <li>We don't use your content to train AI.</li>
          </ul>

          <p class="onboarding-privacy-tagline">Your world is yours alone.</p>

          <div class="onboarding-privacy-divider"></div>

          <button class="onboarding-btn onboarding-btn-primary" data-action="next">
            I'm ready →
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Step 7: WOW Screen
   */
  renderWow() {
    const insight = this.generateInsight();
    const contextWords = this.getContextWords();

    return `
      <div class="onboarding-screen onboarding-wow">
        <div class="onboarding-content">
          <div class="onboarding-world" id="world-visualization">
            <!-- Animated via JS -->
          </div>

          <div class="onboarding-wow-divider"></div>

          <p class="onboarding-wow-context">${contextWords}</p>

          <p class="onboarding-wow-insight">"${insight}"</p>

          <p class="onboarding-wow-tagline">Every note teaches me more about your world.</p>

          <button class="onboarding-btn onboarding-btn-primary" data-action="complete">
            Begin →
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Get depth question based on selections
   */
  getDepthQuestion() {
    const { life_seasons, mental_focus } = this.data;

    if (life_seasons.includes('building')) return this.DEPTH_QUESTIONS.building;
    if (life_seasons.includes('transition')) return this.DEPTH_QUESTIONS.transition;
    if (life_seasons.includes('caring')) return this.DEPTH_QUESTIONS.caring;
    if (life_seasons.includes('healing')) return this.DEPTH_QUESTIONS.healing;
    if (life_seasons.includes('creating')) return this.DEPTH_QUESTIONS.creating;
    if (mental_focus.includes('decision')) return this.DEPTH_QUESTIONS.decision;

    return this.DEPTH_QUESTIONS.default;
  },

  /**
   * Generate personalized insight
   */
  generateInsight() {
    const { life_seasons, mental_focus, seeded_people } = this.data;
    const peopleCount = seeded_people.filter(p => p && p.name).length;

    let seasonPhrase = '';
    if (life_seasons.includes('building')) {
      seasonPhrase = "building something new";
    } else if (life_seasons.includes('transition')) {
      seasonPhrase = "in the middle of a transition";
    } else if (life_seasons.includes('creating')) {
      seasonPhrase = "focused on creating";
    } else if (life_seasons.includes('healing')) {
      seasonPhrase = "on a healing journey";
    } else if (life_seasons.includes('learning')) {
      seasonPhrase = "in a season of learning";
    } else if (life_seasons.includes('caring')) {
      seasonPhrase = "caring for others";
    } else {
      seasonPhrase = "figuring things out";
    }

    let focusPhrase = '';
    if (mental_focus.includes('decision')) {
      focusPhrase = " in a time of decisions";
    } else if (mental_focus.includes('work')) {
      focusPhrase = " with work on your mind";
    } else if (mental_focus.includes('relationships')) {
      focusPhrase = " thinking about relationships";
    } else if (mental_focus.includes('future')) {
      focusPhrase = " thinking about the future";
    }

    let peoplePart = '';
    if (peopleCount > 0) {
      peoplePart = " You're not doing it alone.";
    }

    return `You're ${seasonPhrase}${focusPhrase}.${peoplePart}`;
  },

  /**
   * Get context words for WOW screen
   */
  getContextWords() {
    const words = [];

    this.data.life_seasons.slice(0, 2).forEach(id => {
      const season = this.LIFE_SEASONS.find(s => s.id === id);
      if (season) words.push(season.label.split(' ')[0]);
    });

    this.data.mental_focus.slice(0, 2).forEach(id => {
      const focus = this.MENTAL_FOCUS.find(f => f.id === id);
      if (focus) words.push(focus.label);
    });

    return words.join(' · ') || 'Your World';
  },

  /**
   * Animate WOW screen visualization
   */
  animateWorld() {
    const container = document.getElementById('world-visualization');
    if (!container) return;

    const { name, seeded_people } = this.data;
    const validPeople = seeded_people.filter(p => p && p.name);

    // Build SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 200');
    svg.setAttribute('class', 'world-svg');
    container.appendChild(svg);

    // Center node position
    const centerX = 150;
    const centerY = 60;

    // Create center node
    setTimeout(() => {
      const centerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      centerGroup.innerHTML = `
        <circle cx="${centerX}" cy="${centerY}" r="24" fill="var(--ink, #000)" class="world-node world-node-center"/>
        <text x="${centerX}" y="${centerY + 45}" text-anchor="middle" class="world-label">${name || 'You'}</text>
      `;
      svg.appendChild(centerGroup);
    }, 200);

    // Create people nodes
    const peoplePositions = [
      { x: 75, y: 150 },
      { x: 150, y: 170 },
      { x: 225, y: 150 }
    ];

    validPeople.slice(0, 3).forEach((person, i) => {
      const pos = peoplePositions[i];

      // Draw line
      setTimeout(() => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', centerX);
        line.setAttribute('y1', centerY + 24);
        line.setAttribute('x2', pos.x);
        line.setAttribute('y2', pos.y - 16);
        line.setAttribute('class', 'world-line');
        svg.appendChild(line);
      }, 400 + (i * 100));

      // Draw node
      setTimeout(() => {
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.innerHTML = `
          <circle cx="${pos.x}" cy="${pos.y}" r="16" fill="var(--ink, #000)" class="world-node"/>
          <text x="${pos.x}" y="${pos.y + 30}" text-anchor="middle" class="world-label">${person.name}</text>
        `;
        svg.appendChild(nodeGroup);
      }, 700 + (i * 200));
    });
  },

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Navigation buttons
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleAction(e.target.dataset.action));
    });

    // Name input
    const nameInput = document.getElementById('onboarding-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.data.name = e.target.value.trim();
        this.updateButtonState();
      });
      nameInput.focus();
    }

    // Depth textarea
    const depthInput = document.getElementById('onboarding-depth');
    if (depthInput) {
      depthInput.addEventListener('input', (e) => {
        this.data.depth_answer = e.target.value.trim();
        this.data.depth_question = this.getDepthQuestion();
        this.updateButtonState();
      });
    }

    // Option buttons (seasons, focus)
    this.container.querySelectorAll('.onboarding-option').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleOptionSelect(e.currentTarget));
    });

    // Person inputs
    this.container.querySelectorAll('.onboarding-person-input').forEach(input => {
      input.addEventListener('input', (e) => this.handlePersonInput(e.target));
      input.addEventListener('blur', (e) => this.handlePersonInput(e.target));
    });

    // Animate WOW screen
    if (this.currentStep === 7) {
      setTimeout(() => this.animateWorld(), 100);
    }
  },

  /**
   * Handle action buttons
   */
  handleAction(action) {
    switch (action) {
      case 'next':
        this.currentStep++;
        this.render();
        break;
      case 'back':
        this.currentStep--;
        this.render();
        break;
      case 'skip':
        this.currentStep++;
        this.render();
        break;
      case 'add-person':
        this.addPersonInput();
        break;
      case 'complete':
        this.complete();
        break;
    }
  },

  /**
   * Handle option selection (seasons, focus)
   */
  handleOptionSelect(target) {
    const value = target.dataset.value;
    const type = target.dataset.type;

    if (type === 'season') {
      if (this.data.life_seasons.includes(value)) {
        this.data.life_seasons = this.data.life_seasons.filter(v => v !== value);
      } else {
        this.data.life_seasons.push(value);
      }
    } else if (type === 'focus') {
      if (this.data.mental_focus.includes(value)) {
        this.data.mental_focus = this.data.mental_focus.filter(v => v !== value);
      } else if (this.data.mental_focus.length < 3) {
        this.data.mental_focus.push(value);
      }
    }

    this.render();
  },

  /**
   * Handle person input
   */
  handlePersonInput(input) {
    const index = parseInt(input.dataset.index);
    const value = input.value.trim();

    // Parse "Name — context" format
    const parts = value.split(/\s*[—-]\s*/);
    const name = parts[0]?.trim() || '';
    const context = parts[1]?.trim() || '';

    if (name) {
      this.data.seeded_people[index] = { name, context };
    } else {
      this.data.seeded_people[index] = null;
    }

    // Filter out empty entries and update indices
    this.data.seeded_people = this.data.seeded_people.filter(p => p && p.name);

    this.updateButtonState();
  },

  /**
   * Add new person input
   */
  addPersonInput() {
    const list = document.getElementById('people-list');
    const index = this.data.seeded_people.length;

    const div = document.createElement('div');
    div.innerHTML = this.renderPersonInput(index);
    list.appendChild(div.firstElementChild);

    // Attach event listener to new input
    const newInput = list.querySelector(`[data-index="${index}"]`);
    if (newInput) {
      newInput.addEventListener('input', (e) => this.handlePersonInput(e.target));
      newInput.addEventListener('blur', (e) => this.handlePersonInput(e.target));
      newInput.focus();
    }
  },

  /**
   * Update button state based on validation
   */
  updateButtonState() {
    const btn = this.container.querySelector('.onboarding-btn-primary[data-action="next"]');
    if (!btn) return;

    let isValid = true;

    switch (this.currentStep) {
      case 1: isValid = this.data.name.length > 0; break;
      case 2: isValid = this.data.life_seasons.length > 0; break;
      case 3: isValid = this.data.mental_focus.length > 0; break;
      default: isValid = true;
    }

    btn.disabled = !isValid;
  },

  /**
   * Complete onboarding
   */
  async complete() {
    if (!Sync.supabase || !Sync.user) {
      console.error('[Onboarding] No user for completion');
      return;
    }

    const userId = Sync.user.id;
    console.log('[Onboarding] Completing onboarding for user:', userId);

    try {
      // Save to onboarding_data table
      const { error: onboardingError } = await Sync.supabase
        .from('onboarding_data')
        .upsert({
          user_id: userId,
          name: this.data.name,
          life_seasons: this.data.life_seasons,
          mental_focus: this.data.mental_focus,
          depth_question: this.data.depth_question || this.getDepthQuestion(),
          depth_answer: this.data.depth_answer,
          seeded_people: this.data.seeded_people.filter(p => p && p.name),
          completed_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (onboardingError) {
        console.error('[Onboarding] Failed to save onboarding_data:', onboardingError);
      }

      // Also update user_profiles for backward compatibility
      const { error: profileError } = await Sync.supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          name: this.data.name,
          onboarding_completed_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('[Onboarding] Failed to save user_profiles:', profileError);
      }

      // Seed entities from people
      await this.seedEntities(userId);

      // Close onboarding
      this.container.classList.remove('visible');
      setTimeout(() => {
        if (this.container.parentNode) {
          this.container.remove();
        }
      }, 300);

      // Refresh the app
      if (window.App && typeof App.init === 'function') {
        console.log('[Onboarding] Refreshing app after completion');
        setTimeout(() => App.init(), 100);
      }

    } catch (err) {
      console.error('[Onboarding] Completion error:', err);
    }
  },

  /**
   * Seed entities from onboarding people
   */
  async seedEntities(userId) {
    const validPeople = this.data.seeded_people.filter(p => p && p.name);

    for (const person of validPeople) {
      try {
        await Sync.supabase.from('user_entities').upsert({
          user_id: userId,
          name: person.name,
          entity_type: 'person',
          relationship: person.context || null,
          source: 'onboarding',
          mention_count: 0,
          confidence: 0.9,
          metadata: { seeded: true }
        }, {
          onConflict: 'user_id,name'
        });

        console.log('[Onboarding] Seeded entity:', person.name);
      } catch (err) {
        console.warn('[Onboarding] Failed to seed entity:', person.name, err.message);
      }
    }
  }
};
