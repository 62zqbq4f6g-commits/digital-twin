/**
 * Digital Twin - UI Controller
 * Handles navigation and screen management
 */

const UI = {
  // Current active screen
  currentScreen: 'capture',

  // Processing state
  isProcessing: false,

  /**
   * Initialize UI - set up event listeners
   */
  init() {
    this.setupNavigation();
    this.setupTextInput();
    this.showScreen('capture');
  },

  /**
   * Set up text input handlers
   */
  setupTextInput() {
    const textInput = document.getElementById('text-input');
    const submitBtn = document.getElementById('submit-btn');
    const container = document.querySelector('.text-input-container');

    if (!textInput || !submitBtn) return;

    // Auto-expand textarea
    textInput.addEventListener('input', () => {
      this.autoExpandTextarea(textInput);
    });

    // Submit on button click
    submitBtn.addEventListener('click', () => {
      this.handleSubmit();
    });

    // Submit on Enter (Shift+Enter for newline)
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSubmit();
      }
    });
  },

  /**
   * Auto-expand textarea based on content
   * @param {HTMLTextAreaElement} textarea
   */
  autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  },

  /**
   * Handle text submission
   */
  async handleSubmit() {
    const textInput = document.getElementById('text-input');
    const container = document.querySelector('.text-input-container');
    const text = textInput.value.trim();

    // Don't submit empty text
    if (!text || this.isProcessing) return;

    // Set processing state
    this.setProcessing(true);

    try {
      // Call placeholder processNote function (will be implemented in DT-010)
      await this.processNote(text, 'text');

      // Clear input
      textInput.value = '';
      this.autoExpandTextarea(textInput);

      // Show success feedback
      this.showToast('Note saved!');
    } catch (error) {
      console.error('Failed to save note:', error);
      this.showToast('Failed to save note');
    } finally {
      this.setProcessing(false);
    }
  },

  /**
   * Set processing state (disabled UI)
   * @param {boolean} processing
   */
  setProcessing(processing) {
    this.isProcessing = processing;
    const container = document.querySelector('.text-input-container');
    const submitBtn = document.getElementById('submit-btn');

    if (container) {
      container.classList.toggle('disabled', processing);
    }
    if (submitBtn) {
      submitBtn.disabled = processing;
    }
  },

  /**
   * Placeholder processNote function (will be replaced in DT-010)
   * @param {string} text - Raw text input
   * @param {string} inputType - 'text' or 'voice'
   */
  async processNote(text, inputType) {
    // Placeholder - just save raw note to DB for now
    const note = {
      input: {
        type: inputType,
        raw_text: text
      },
      timestamps: {
        created_at: new Date().toISOString(),
        input_date: new Date().toISOString().slice(0, 10),
        input_time: new Date().toTimeString().slice(0, 5),
        input_timezone: 'Asia/Singapore',
        day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' })
      },
      classification: {
        category: 'personal',
        confidence: 0.5,
        reasoning: 'Placeholder classification'
      },
      extracted: {
        title: text.slice(0, 50),
        topics: [],
        action_items: [],
        sentiment: 'neutral',
        people: []
      },
      refined: {
        summary: text,
        formatted_output: text
      }
    };

    return await DB.saveNote(note);
  },

  /**
   * Set up navigation tab click handlers
   */
  setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');

    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const screenName = tab.dataset.screen;
        if (screenName) {
          this.showScreen(screenName);
        }
      });
    });
  },

  /**
   * Show a specific screen, hide all others
   * @param {string} screenName - Name of screen to show (capture, notes, settings)
   */
  showScreen(screenName) {
    // Get all screens
    const screens = document.querySelectorAll('.screen');
    const navTabs = document.querySelectorAll('.nav-tab');

    // Hide all screens
    screens.forEach(screen => {
      screen.classList.add('hidden');
    });

    // Remove active class from all tabs
    navTabs.forEach(tab => {
      tab.classList.remove('active');
    });

    // Show the selected screen
    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) {
      targetScreen.classList.remove('hidden');
    }

    // Activate the corresponding nav tab
    const targetTab = document.querySelector(`.nav-tab[data-screen="${screenName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
    }

    // Update current screen
    this.currentScreen = screenName;
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms (default 1500)
   */
  showToast(message, duration = 1500) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger show animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Hide and remove after duration
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        toast.remove();
      }, 150);
    }, duration);
  }
};

// Export for global access
window.UI = UI;
