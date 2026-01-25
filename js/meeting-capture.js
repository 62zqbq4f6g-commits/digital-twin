/**
 * Meeting Capture UI Component
 * Phase 16: Enhancement System - TASK-001
 *
 * State machine for meeting capture:
 * - EMPTY: placeholders visible, enhance button disabled
 * - CAPTURING: content exists, enhance button enabled
 * - ENHANCING: input readonly, loading message shown
 * - ENHANCED: show enhanced output
 */

const MeetingCapture = {
  container: null,
  state: 'empty', // empty | capturing | enhancing | enhanced

  // Callback for when enhancement is complete
  onEnhanceComplete: null,

  /**
   * Initialize the meeting capture component
   * @param {HTMLElement} container - Container element to render into
   * @param {Object} options - Optional configuration
   */
  init(container, options = {}) {
    this.container = container;
    this.state = 'empty';
    this.onEnhanceComplete = options.onEnhanceComplete || null;

    this.render();
    this.attachListeners();

    console.log('[MeetingCapture] Initialized');
  },

  /**
   * Render the meeting capture UI
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="meeting-capture">
        <input
          type="text"
          class="meeting-title-input"
          id="mc-title"
          placeholder="meeting title (optional)"
          aria-label="Meeting title"
        />

        <input
          type="text"
          class="meeting-attendees-input"
          id="mc-attendees"
          placeholder="who was there?"
          aria-label="Meeting attendees"
        />

        <div class="meeting-content-area">
          <textarea
            class="meeting-content-textarea"
            id="mc-content"
            placeholder="what happened? type freely or use voice..."
            aria-label="Meeting notes"
          ></textarea>
          <button
            class="meeting-voice-button"
            id="mc-voice-btn"
            type="button"
            aria-label="Voice input"
            title="Voice input (coming soon)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        </div>

        <button
          class="meeting-enhance-button"
          id="mc-enhance-btn"
          type="button"
          disabled
        >
          ENHANCE NOTES
        </button>

        <div class="meeting-loading hidden" id="mc-loading">
          <div class="meeting-loading-spinner"></div>
          <p class="meeting-loading-text">Enhancing your notes...</p>
        </div>

        <div class="meeting-enhanced-output hidden" id="mc-output">
          <!-- Enhanced output will be rendered here -->
        </div>
      </div>
    `;
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    const textarea = this.container.querySelector('#mc-content');
    const enhanceBtn = this.container.querySelector('#mc-enhance-btn');
    const voiceBtn = this.container.querySelector('#mc-voice-btn');
    const titleInput = this.container.querySelector('#mc-title');
    const attendeesInput = this.container.querySelector('#mc-attendees');

    // Content change listener
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.updateState();
      });
    }

    // Title and attendees don't affect state, but track for data
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        // Optional: could add title to state logic
      });
    }

    if (attendeesInput) {
      attendeesInput.addEventListener('input', () => {
        // Optional: could add attendee suggestions
      });
    }

    // Enhance button
    if (enhanceBtn) {
      enhanceBtn.addEventListener('click', () => this.enhance());

      // Keyboard accessibility
      enhanceBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.enhance();
        }
      });
    }

    // Voice button (placeholder for now)
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        console.log('[MeetingCapture] Voice input clicked - TASK-006');
        // TODO: Implement in TASK-006
      });
    }
  },

  /**
   * Update component state based on content
   */
  updateState() {
    const textarea = this.container.querySelector('#mc-content');
    const hasContent = textarea && textarea.value.trim().length > 0;

    if (this.state === 'enhancing' || this.state === 'enhanced') {
      return; // Don't change state during/after enhancement
    }

    this.setState(hasContent ? 'capturing' : 'empty');
  },

  /**
   * Set component state
   * @param {string} newState - New state value
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    const enhanceBtn = this.container.querySelector('#mc-enhance-btn');
    const textarea = this.container.querySelector('#mc-content');
    const titleInput = this.container.querySelector('#mc-title');
    const attendeesInput = this.container.querySelector('#mc-attendees');
    const loading = this.container.querySelector('#mc-loading');
    const output = this.container.querySelector('#mc-output');

    // Update enhance button
    if (enhanceBtn) {
      enhanceBtn.disabled = newState === 'empty' || newState === 'enhancing';

      if (newState === 'enhancing') {
        enhanceBtn.textContent = 'ENHANCING...';
      } else if (newState === 'enhanced') {
        enhanceBtn.textContent = 'ENHANCED';
        enhanceBtn.classList.add('enhanced');
      } else {
        enhanceBtn.textContent = 'ENHANCE NOTES';
        enhanceBtn.classList.remove('enhanced');
      }
    }

    // Update inputs readonly state
    const isReadonly = newState === 'enhancing' || newState === 'enhanced';
    if (textarea) textarea.readOnly = isReadonly;
    if (titleInput) titleInput.readOnly = isReadonly;
    if (attendeesInput) attendeesInput.readOnly = isReadonly;

    // Update loading visibility
    if (loading) {
      loading.classList.toggle('hidden', newState !== 'enhancing');
    }

    // Update output visibility
    if (output) {
      output.classList.toggle('hidden', newState !== 'enhanced');
    }

    console.log(`[MeetingCapture] State: ${oldState} → ${newState}`);
  },

  /**
   * Get current form data
   * @returns {Object} Form data
   */
  getData() {
    return {
      title: this.container.querySelector('#mc-title')?.value || '',
      attendees: this.container.querySelector('#mc-attendees')?.value || '',
      content: this.container.querySelector('#mc-content')?.value || '',
    };
  },

  /**
   * Trigger enhancement
   */
  async enhance() {
    if (this.state !== 'capturing') return;

    const data = this.getData();
    if (!data.content.trim()) return;

    console.log('[MeetingCapture] Enhancing...', data);
    this.setState('enhancing');

    try {
      // TODO: Implement actual API call in TASK-002
      // For now, simulate enhancement with a delay
      await this.simulateEnhancement(data);

      this.setState('enhanced');

      if (this.onEnhanceComplete) {
        this.onEnhanceComplete(data);
      }
    } catch (error) {
      console.error('[MeetingCapture] Enhancement failed:', error);
      this.setState('capturing'); // Allow retry
      this.showError('Enhancement failed. Please try again.');
    }
  },

  /**
   * Simulate enhancement (placeholder for TASK-002)
   * @param {Object} data - Form data
   */
  async simulateEnhancement(data) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show placeholder output
    const output = this.container.querySelector('#mc-output');
    if (output) {
      output.innerHTML = `
        <div class="meeting-enhanced-content">
          <h3 class="meeting-enhanced-title">${data.title || 'Meeting Notes'}</h3>
          ${data.attendees ? `<p class="meeting-enhanced-attendees">Attendees: ${data.attendees}</p>` : ''}
          <div class="meeting-enhanced-body">
            <p class="meeting-enhanced-placeholder">
              <em>Enhanced output will appear here once the API is connected (TASK-002).</em>
            </p>
            <p class="meeting-enhanced-raw">
              <strong>Raw input:</strong><br>
              ${data.content.replace(/\n/g, '<br>')}
            </p>
          </div>
        </div>
      `;
    }
  },

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const output = this.container.querySelector('#mc-output');
    if (output) {
      output.innerHTML = `
        <div class="meeting-error">
          <p>${message}</p>
        </div>
      `;
      output.classList.remove('hidden');
    }
  },

  /**
   * Reset the component to initial state
   */
  reset() {
    const textarea = this.container.querySelector('#mc-content');
    const titleInput = this.container.querySelector('#mc-title');
    const attendeesInput = this.container.querySelector('#mc-attendees');
    const output = this.container.querySelector('#mc-output');

    if (textarea) {
      textarea.value = '';
      textarea.readOnly = false;
    }
    if (titleInput) {
      titleInput.value = '';
      titleInput.readOnly = false;
    }
    if (attendeesInput) {
      attendeesInput.value = '';
      attendeesInput.readOnly = false;
    }
    if (output) {
      output.innerHTML = '';
      output.classList.add('hidden');
    }

    this.setState('empty');
    console.log('[MeetingCapture] Reset');
  },

  /**
   * Destroy the component
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.state = 'empty';
    console.log('[MeetingCapture] Destroyed');
  }
};

// Make globally available
window.MeetingCapture = MeetingCapture;
