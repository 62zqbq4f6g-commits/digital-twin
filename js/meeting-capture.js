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
    this.startTime = Date.now();

    try {
      // Get user ID for API call
      const userId = typeof Sync !== 'undefined' && Sync.user?.id ? Sync.user.id : null;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Parse attendees from comma-separated string
      const attendeesList = data.attendees
        ? data.attendees.split(',').map(a => a.trim()).filter(Boolean)
        : [];

      // Call the enhance-meeting API with streaming
      const response = await fetch('/api/enhance-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawInput: data.content,
          title: data.title || null,
          attendees: attendeesList,
          userId: userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Enhancement failed');
      }

      // Handle SSE streaming response
      await this.handleStreamingResponse(response, data);

      this.setState('enhanced');

      if (this.onEnhanceComplete) {
        this.onEnhanceComplete(data);
      }
    } catch (error) {
      console.error('[MeetingCapture] Enhancement failed:', error);
      this.setState('capturing'); // Allow retry
      this.showError(error.message || 'Enhancement failed. Please try again.');
    }
  },

  /**
   * Handle SSE streaming response from enhance-meeting API
   * @param {Response} response - Fetch response
   * @param {Object} data - Original form data
   */
  async handleStreamingResponse(response, data) {
    const output = this.container.querySelector('#mc-output');
    if (!output) return;

    // Prepare output container
    output.innerHTML = `
      <div class="meeting-enhanced-content">
        <div class="meeting-enhanced-header">
          <h3 class="meeting-enhanced-title" id="mc-enhanced-title">Processing...</h3>
          <p class="meeting-enhanced-meta" id="mc-enhanced-meta"></p>
        </div>
        <div class="meeting-enhanced-body" id="mc-enhanced-body">
          <div class="meeting-streaming-cursor"></div>
        </div>
      </div>
    `;
    output.classList.remove('hidden');

    const titleEl = output.querySelector('#mc-enhanced-title');
    const metaEl = output.querySelector('#mc-enhanced-meta');
    const bodyEl = output.querySelector('#mc-enhanced-body');

    let fullContent = '';
    let processingTime = 0;

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));

              switch (eventData.type) {
                case 'metadata':
                  // Update title and meta
                  if (titleEl && eventData.metadata?.title) {
                    titleEl.textContent = eventData.metadata.title;
                  }
                  if (metaEl && eventData.metadata?.date) {
                    const attendeesStr = eventData.metadata.attendees?.length
                      ? ` • ${eventData.metadata.attendees.join(', ')}`
                      : '';
                    metaEl.textContent = eventData.metadata.date + attendeesStr;
                  }
                  break;

                case 'content':
                  // Append streaming content
                  fullContent += eventData.text;
                  if (bodyEl) {
                    bodyEl.innerHTML = this.formatEnhancedContent(fullContent);
                  }
                  break;

                case 'done':
                  // Enhancement complete
                  processingTime = eventData.processingTime || (Date.now() - this.startTime);
                  console.log(`[MeetingCapture] Enhanced in ${processingTime}ms`);

                  // Add timing info
                  if (metaEl) {
                    const seconds = (processingTime / 1000).toFixed(1);
                    metaEl.textContent += ` • Enhanced in ${seconds}s`;
                  }
                  break;

                case 'error':
                  throw new Error(eventData.error?.message || 'Enhancement failed');
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              if (parseError.message !== 'Enhancement failed') {
                console.warn('[MeetingCapture] Parse error:', parseError);
              } else {
                throw parseError;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * Format enhanced content with proper markdown-like styling
   * @param {string} content - Raw content from API
   * @returns {string} Formatted HTML
   */
  formatEnhancedContent(content) {
    // Convert markdown-style headers to HTML
    let html = content
      // Markdown h1 headers like # Meeting Minutes (remove entirely - title shown in header)
      .replace(/^#\s+.+\n?/gm, '')
      // Markdown h2 headers like ## DISCUSSED or ## NOTED (case insensitive)
      .replace(/^##\s+([A-Z]+(?:\s+[A-Z]+)*)\s*$/gm, '<h4 class="meeting-section-header">$1</h4>')
      // Bold headers like **DISCUSSED**
      .replace(/\*\*([A-Z][A-Z\s]+)\*\*/g, '<h4 class="meeting-section-header">$1</h4>')
      // Regular bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Bullet points (- or • at start of line)
      .replace(/^[-•]\s+/gm, '<span class="meeting-bullet">•</span> ')
      // Line breaks
      .replace(/\n/g, '<br>');

    return html;
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
