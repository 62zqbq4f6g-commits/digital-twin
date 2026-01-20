/**
 * Inscript - UI Controller
 * Handles navigation and screen management
 */

const UI = {
  // Current active screen (Phase 4C: default to notes)
  currentScreen: 'notes',

  // Previous screen for back navigation
  previousScreen: 'notes',

  // Processing state
  isProcessing: false,

  // Notes list state
  allNotes: [],
  currentFilter: 'all',
  currentSearch: '',

  // Category icons
  categoryIcons: {
    personal: '🏠',
    work: '💼',
    health: '💪',
    ideas: '💡'
  },

  // Currently displayed note
  currentNote: null,

  /**
   * Initialize UI - set up event listeners
   */
  init() {
    this.setupNavigation();
    this.setupTextInput();
    this.setupNotesCapture(); // Phase 4C: Quick capture in Notes screen
    this.setupNotesFilters();
    this.setupNotesSearch();
    this.setupNoteDetail();
    this.setupSettings();
    this.showScreen('notes'); // Phase 4C: Default to notes
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
   * Process note through App pipeline
   * @param {string} text - Raw text input
   * @param {string} inputType - 'text' or 'voice'
   */
  async processNote(text, inputType) {
    // Use App.processNote for full pipeline processing
    return await App.processNote(text, inputType);
  },

  /**
   * Phase 4.5: Process image note with optional caption
   * @param {string} imageDataUrl - Base64 image data
   * @param {string} caption - Optional caption/context
   */
  async processImageNote(imageDataUrl, caption) {
    console.log('processImageNote called');
    console.log('Image data length:', imageDataUrl?.length);
    console.log('Caption:', caption);

    try {
      // Call vision API with image and caption
      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          context: caption || ''
        })
      });

      if (!response.ok) {
        throw new Error('Vision API failed: ' + response.status);
      }

      const visionResult = await response.json();
      console.log('Vision API response:', visionResult);

      // Create note object
      const note = this.createImageNoteFromVision(visionResult, imageDataUrl, caption);

      console.log('Saving note with image:', note.id);
      console.log('Image URL saved:', note.input.image_url ? 'YES (' + note.input.image_url.length + ' chars)' : 'NO');

      // Save to DB
      await DB.save('notes', note);

      // Store entities from vision (with relationship_to_user)
      if (visionResult.entities && visionResult.entities.length > 0 && typeof EntityMemory !== 'undefined') {
        console.log('[UI] Storing entities from vision:', visionResult.entities);
        for (const entity of visionResult.entities) {
          try {
            // Use a simple visual description since vision.js doesn't extract XML visual descriptions
            const visualDesc = visionResult.description || 'From photo';
            await EntityMemory.storeEntityWithVisual(
              {
                name: entity.name,
                type: entity.type,
                relationship_to_user: entity.relationship_to_user
              },
              visualDesc
            );
          } catch (err) {
            console.warn('[UI] Entity storage failed:', err.message);
          }
        }
      }

      // Sync if available
      if (typeof Sync !== 'undefined') {
        await Sync.pushChanges();
      }

      return note;
    } catch (error) {
      console.error('Image processing failed:', error);
      throw error;
    }
  },

  /**
   * Create note object from vision result
   * @param {Object} visionResult - Result from Vision API
   * @param {string} imageDataUrl - Original image data
   * @param {string} caption - User provided caption
   */
  createImageNoteFromVision(visionResult, imageDataUrl, caption) {
    const now = new Date();
    const id = `dt_${now.toISOString().slice(0, 10).replace(/-/g, '')}_${now.toTimeString().slice(0, 8).replace(/:/g, '')}_${Math.random().toString(36).substring(2, 5)}`;

    return {
      id,
      version: '1.0',
      timestamps: {
        created_at: now.toISOString(),
        input_date: now.toISOString().slice(0, 10),
        input_time: now.toTimeString().slice(0, 5),
        input_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' })
      },
      input: {
        type: 'image',
        raw_text: caption || '',
        image_url: imageDataUrl,
        image_description: visionResult.description
      },
      classification: {
        category: visionResult.category || 'personal',
        confidence: visionResult.confidence || 0.7,
        reasoning: 'Classified by Vision API'
      },
      extracted: {
        title: visionResult.title || 'Image Capture',
        topics: visionResult.topics || [],
        action_items: visionResult.action_items || [],
        sentiment: visionResult.sentiment || 'neutral',
        people: visionResult.people || []
      },
      refined: {
        summary: visionResult.summary || visionResult.description,
        formatted_output: visionResult.formatted_output || `# ${visionResult.title}\n\n${visionResult.description}`
      },
      analysis: {
        cleanedInput: caption || null,
        summary: visionResult.summary || visionResult.description,
        title: visionResult.title || 'Image Capture',
        actions: visionResult.action_items || [],
        category: visionResult.category || 'personal'
      }
    };
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

    // Screen-specific logic
    if (screenName === 'notes') {
      this.loadNotes();
    } else if (screenName === 'capture') {
      // Reset capture screen to default state (show capture-section, hide image-section)
      this.resetCaptureScreen();
    } else if (screenName === 'twin') {
      // Refresh Twin tab display
      if (typeof TwinUI !== 'undefined') {
        TwinUI.refresh();
      }
    } else if (screenName === 'actions') {
      // Phase 4C: Refresh Actions tab display
      if (typeof ActionsUI !== 'undefined') {
        ActionsUI.refresh();
      }
    }
  },

  /**
   * Reset capture screen to default state
   */
  resetCaptureScreen() {
    const captureSection = document.getElementById('capture-section');
    const imageSection = document.getElementById('image-section');

    // Show capture section, hide image section
    captureSection?.classList.remove('hidden');
    imageSection?.classList.add('hidden');

    // Clear any image state if Camera is available
    if (typeof Camera !== 'undefined' && Camera.clearImage) {
      Camera.currentImage = null;
      // Reset image input
      const imageInput = document.getElementById('image-input');
      const contextInput = document.getElementById('image-context');
      const transcriptDisplay = document.getElementById('image-transcript-display');

      if (imageInput) imageInput.value = '';
      if (contextInput) contextInput.value = '';
      if (transcriptDisplay) {
        transcriptDisplay.textContent = '';
        transcriptDisplay.classList.remove('visible');
      }
    }
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
  },

  // Phase 11.2: Editorial loading messages (poetic, lowercase, Cormorant Garamond)
  LOADING_MESSAGES: {
    note: "sitting with this...",
    voice: "listening closely...",
    image: "seeing what's here...",
    reflect: "going deeper...",
    save: "holding this...",
    auth: "one moment...",
    onboarding: "preparing your space...",
    delete: "letting go...",
    sync: "finding you...",
    analyze: "thinking alongside you..."
  },

  /**
   * Phase 9.3: Show loading overlay with contextual message
   * @param {string} type - Type of loading (note, voice, image, reflect, save, auth, onboarding, delete)
   */
  showLoading(type = 'note') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (!overlay) return;

    const message = this.LOADING_MESSAGES[type] || this.LOADING_MESSAGES.note;
    if (textEl) textEl.textContent = message;
    overlay.classList.add('visible');
  },

  /**
   * Phase 9.3: Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
  },

  /**
   * Phase 9.1: Show feedback toast with editorial copy
   * @param {'approve'|'reject'} type - Type of feedback
   */
  showFeedbackToast(type) {
    const toast = document.getElementById('feedback-toast');
    if (!toast) return;

    const textEl = toast.querySelector('.feedback-toast__text');
    const text = type === 'approve'
      ? "Noted — I'll remember this resonates"
      : "Got it — I'll adjust";

    textEl.textContent = text;
    toast.classList.add('feedback-toast--visible');

    setTimeout(() => {
      toast.classList.remove('feedback-toast--visible');
    }, 2500);
  },

  /**
   * Show error toast message (v5.3.0)
   * @param {string} message - Error message to display
   * @param {object} options - Optional settings
   * @param {string} options.retry - Function string to call on retry
   * @param {number} options.duration - How long to show (ms), default 5000
   */
  showError(message, options = {}) {
    const { retry = null, duration = 5000 } = options;

    // Remove any existing toast
    this.hideToast();

    const toast = document.createElement('div');
    toast.className = 'toast-v2 toast-error';
    toast.id = 'app-toast';

    let retryHTML = '';
    if (retry) {
      retryHTML = `<button class="toast-btn" onclick="${retry}; UI.hideToast();">Retry</button>`;
    }

    toast.innerHTML = `
      <p class="toast-message">${message}</p>
      ${retryHTML}
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Auto-hide if no retry button
    if (!retry) {
      setTimeout(() => {
        this.hideToast();
      }, duration);
    }
  },

  /**
   * Show success toast message (v5.3.0)
   * @param {string} message - Success message to display
   * @param {number} duration - How long to show (ms), default 3000
   */
  showSuccess(message, duration = 3000) {
    // Remove any existing toast
    this.hideToast();

    const toast = document.createElement('div');
    toast.className = 'toast-v2 toast-success';
    toast.id = 'app-toast';

    toast.innerHTML = `<p class="toast-message">${message}</p>`;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    setTimeout(() => {
      this.hideToast();
    }, duration);
  },

  /**
   * Hide current toast (v5.3.0)
   */
  hideToast() {
    const existing = document.getElementById('app-toast');
    if (existing) {
      existing.classList.remove('toast-visible');
      setTimeout(() => {
        existing.remove();
      }, 300);
    }
  },

  /**
   * Render empty state for a given section (v5.3.0)
   * @param {string} type - 'notes', 'actions', 'twin', or 'search'
   * @param {string} searchQuery - Optional search query for search empty state
   * @returns {string} HTML string
   */
  renderEmptyState(type, searchQuery = '') {
    const states = {
      notes: {
        title: 'No notes yet',
        description: 'Capture your first thought',
        action: {
          label: 'Create Note',
          onclick: 'UI.focusNoteInput()'
        }
      },
      actions: {
        title: 'No actions yet',
        description: 'Actions will appear when you capture tasks and commitments in your notes',
        action: null
      },
      twin: {
        title: 'Your Twin is learning',
        description: 'The more you share, the smarter it gets',
        action: null
      },
      search: {
        title: `No results for "${searchQuery}"`,
        description: 'Try a different search term',
        action: null
      }
    };

    const state = states[type];
    if (!state) {
      console.error('[UI] Unknown empty state type:', type);
      return '';
    }

    let actionHTML = '';
    if (state.action) {
      actionHTML = `<button class="empty-state-btn" onclick="${state.action.onclick}">${state.action.label}</button>`;
    }

    return `
      <div class="empty-state">
        <h3 class="empty-state-title">${state.title}</h3>
        <p class="empty-state-description">${state.description}</p>
        ${actionHTML}
      </div>
    `;
  },

  /**
   * Focus the note input field (v5.3.0)
   */
  focusNoteInput() {
    const input = document.getElementById('notes-quick-input');
    if (input) {
      input.focus();
    }
  },

  /**
   * Phase 4.1: Set up quick capture in Notes screen with better feedback
   */
  setupNotesCapture() {
    const quickInput = document.getElementById('notes-quick-input');
    const voiceBtn = document.getElementById('notes-voice-btn');
    const cameraBtn = document.getElementById('notes-camera-btn');

    // Phase 4.5.2: Enter key triggers submit button
    const submitBtn = document.getElementById('notes-submit-btn');
    if (quickInput && submitBtn) {
      quickInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitBtn.click();
        }
      });
    }

    // Phase 4.7: Voice button - toggle recording with proper UI state
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (typeof Voice !== 'undefined') {
          // Set the transcript display to notes area
          Voice.transcriptDisplay = document.getElementById('notes-transcript-display');

          // Also set the text input for transcript transfer
          Voice.textInput = document.getElementById('notes-quick-input');

          // Toggle recording
          Voice.toggle();

          // Phase 4.7: Update visual feedback immediately and reliably
          setTimeout(() => {
            if (Voice.isRecording) {
              voiceBtn.classList.add('recording');
              voiceBtn.setAttribute('aria-pressed', 'true');
            } else {
              voiceBtn.classList.remove('recording');
              voiceBtn.setAttribute('aria-pressed', 'false');
            }
          }, 50);
        }
      });
    }

    // Camera button - show inline picker bottom sheet
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        this.showCameraOptions();
      });
    }

    // Phase 4.7.1: Submit button - handles text, voice (including while recording), and images
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        // Check if actively recording
        const isActivelyRecording = typeof Voice !== 'undefined' && Voice.isRecording;

        let text = quickInput?.value?.trim() || '';
        const imageData = window.pendingImageData || this.pendingImageData;
        let voiceData = window.pendingVoiceData;
        const hasImage = !!imageData;

        // Phase 4.7.1: If actively recording, stop and get transcript
        if (isActivelyRecording) {
          console.log('Send while recording - stopping and processing...');

          // Stop recording immediately
          Voice.stopRecording();
          Voice.stopRecordingUI();

          // Show immediate feedback
          if (quickInput) {
            quickInput.value = 'Processing voice...';
            quickInput.disabled = true;
          }
          submitBtn.disabled = true;

          // Show processing overlay immediately
          window.showProcessingOverlay?.('Your twin is listening...');
          this.setProcessing(true);

          // Wait briefly for final transcript to settle
          await new Promise(resolve => setTimeout(resolve, 300));

          // Get the transcript (either from Voice module or input field)
          text = Voice.transcript?.trim() || quickInput?.value?.trim() || '';

          // Mark as voice note
          voiceData = {
            transcript: text,
            type: 'voice',
            timestamp: Date.now()
          };
          window.pendingVoiceData = voiceData;

          console.log('Got transcript from recording:', text.substring(0, 50));
        }

        const hasVoice = !!voiceData;

        // Phase 4.7.1: Debug logging
        console.log('Submit processing', { hasText: !!text, hasImage, hasVoice, wasRecording: isActivelyRecording });

        // Phase 4.7.1: Stop recording UI state (ensure it's stopped)
        if (typeof Voice !== 'undefined' && Voice.stopRecordingUI) {
          Voice.stopRecordingUI();
        }

        // Must have either text or pending image
        if (!text && !hasImage) {
          console.log('Nothing to submit');
          window.hideProcessingOverlay?.();
          this.setProcessing(false);
          if (quickInput) {
            quickInput.disabled = false;
            quickInput.value = '';
            quickInput.placeholder = "What's on your mind?";
          }
          submitBtn.disabled = false;
          return;
        }

        if (this.isProcessing && !isActivelyRecording) {
          console.log('Already processing');
          return;
        }

        // Disable inputs (if not already disabled from recording flow)
        if (quickInput && !isActivelyRecording) {
          quickInput.disabled = true;
          quickInput.value = '';
        } else if (quickInput) {
          quickInput.value = ''; // Clear "Processing voice..." text
        }
        submitBtn.disabled = true;

        // Phase 4.5.5: Hide thumbnail BEFORE showing overlay
        if (hasImage) {
          const preview = document.getElementById('notes-image-preview');
          if (preview) {
            preview.style.display = 'none';
            console.log('Thumbnail hidden');
          }
        }

        // Phase 11.2: Editorial loading messages (poetic, lowercase)
        let overlayMessage = 'sitting with this...';
        if (hasImage) {
          overlayMessage = 'seeing what\'s here...';
        } else if (hasVoice) {
          overlayMessage = 'listening closely...';
        }

        // Update overlay if already showing, otherwise show it
        if (!isActivelyRecording) {
          console.log('Showing overlay:', overlayMessage);
          window.showProcessingOverlay?.(overlayMessage);
          this.setProcessing(true);
        } else {
          // Update existing overlay message
          const overlayText = document.querySelector('.processing-text, .overlay-text');
          if (overlayText) overlayText.textContent = overlayMessage;
        }

        try {
          if (hasImage) {
            console.log('Processing image with caption...');
            await this.processImageNote(imageData, text);
          } else {
            // Phase 4.7.1: Use 'voice' type if this was a voice note
            const inputType = hasVoice ? 'voice' : 'text';
            console.log(`Processing ${inputType} note...`);
            await this.processNote(text, inputType);
          }

          // Clear pending data after successful processing
          this.pendingImageData = null;
          window.pendingImageData = null;
          window.pendingVoiceData = null;

          // Clear Voice transcript
          if (typeof Voice !== 'undefined') {
            Voice.transcript = '';
          }

          // Success
          window.hideProcessingOverlay?.();
          window.showToast?.('Saved ✓');

          // Refresh notes list
          await this.loadNotes();

        } catch (error) {
          console.error('Failed to save note:', error);
          window.hideProcessingOverlay?.();
          window.showToast?.('Failed to save. Try again.');

          // Re-show preview if image submission failed
          if (hasImage) {
            const preview = document.getElementById('notes-image-preview');
            if (preview) preview.style.display = 'flex';
          }

          // Restore text on failure
          if (text && quickInput) {
            quickInput.value = text;
          }
        } finally {
          // Re-enable inputs
          if (quickInput) {
            quickInput.disabled = false;
            quickInput.placeholder = "What's on your mind?";
          }
          submitBtn.disabled = false;
          this.setProcessing(false);
        }
      });
    }

    // Header settings button
    const headerSettingsBtn = document.getElementById('header-settings-btn');
    if (headerSettingsBtn) {
      headerSettingsBtn.addEventListener('click', () => {
        this.showScreen('settings');
      });
    }

    // Capture screen back button
    const captureBackBtn = document.getElementById('capture-back-btn');
    if (captureBackBtn) {
      captureBackBtn.addEventListener('click', () => {
        this.showScreen('notes');
      });
    }
  },

  /**
   * Set up filter tab click handlers
   */
  setupNotesFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');

    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active state
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update filter and render
        this.currentFilter = tab.dataset.category;
        this.renderNotes();
      });
    });
  },

  /**
   * Set up search input handler
   */
  setupNotesSearch() {
    const searchInput = document.getElementById('notes-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      this.currentSearch = e.target.value.toLowerCase().trim();
      this.renderNotes();
    });
  },

  /**
   * Load notes from database
   */
  async loadNotes() {
    try {
      this.allNotes = await DB.getAllNotes();
      this.renderNotes();
    } catch (error) {
      console.error('Failed to load notes:', error);
      this.allNotes = [];
      this.renderNotes();
    }
  },

  /**
   * Filter notes by category and search
   * @returns {Array} Filtered notes
   */
  getFilteredNotes() {
    let notes = [...this.allNotes];

    // Filter by category
    if (this.currentFilter !== 'all') {
      notes = notes.filter(note =>
        note.classification && note.classification.category === this.currentFilter
      );
    }

    // Filter by search
    if (this.currentSearch) {
      notes = notes.filter(note => {
        const title = (note.extracted?.title || '').toLowerCase();
        const summary = (note.refined?.summary || '').toLowerCase();
        return title.includes(this.currentSearch) || summary.includes(this.currentSearch);
      });
    }

    return notes;
  },

  /**
   * Get date group label for a note
   * @param {string} dateStr - ISO date string
   * @returns {string} Group label (TODAY, YESTERDAY, or formatted date)
   */
  getDateGroup(dateStr) {
    const noteDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset times to compare dates only
    const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (noteDateOnly.getTime() === todayOnly.getTime()) {
      return 'TODAY';
    } else if (noteDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'YESTERDAY';
    } else {
      return noteDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: noteDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      }).toUpperCase();
    }
  },

  /**
   * Group notes by date
   * @param {Array} notes - Notes to group
   * @returns {Object} Notes grouped by date label
   */
  groupNotesByDate(notes) {
    const groups = {};

    notes.forEach(note => {
      const dateStr = note.timestamps?.created_at || new Date().toISOString();
      const group = this.getDateGroup(dateStr);

      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(note);
    });

    return groups;
  },

  /**
   * Render notes list
   */
  renderNotes() {
    const notesList = document.getElementById('notes-list');
    const emptyState = document.getElementById('notes-empty');

    if (!notesList || !emptyState) return;

    const filteredNotes = this.getFilteredNotes();

    // Show/hide empty state with elegant content
    if (filteredNotes.length === 0) {
      notesList.innerHTML = '';
      notesList.classList.add('hidden');
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = `
        <span class="notes-empty-icon">✎</span>
        <p class="notes-empty-title">Your thoughts, organized</p>
        <p class="notes-empty-text">Tap the mic to start capturing</p>
      `;
      return;
    }

    emptyState.classList.add('hidden');
    notesList.classList.remove('hidden');

    // Group notes by date
    const groups = this.groupNotesByDate(filteredNotes);

    // Build HTML
    let html = '';
    for (const [groupLabel, groupNotes] of Object.entries(groups)) {
      html += `
        <div class="notes-date-group">
          <h3 class="notes-date-header">${groupLabel}</h3>
          ${groupNotes.map(note => this.renderNoteCard(note)).join('')}
        </div>
      `;
    }

    notesList.innerHTML = html;

    // Add click handlers to note cards
    notesList.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', () => {
        const noteId = card.dataset.noteId;
        console.log('[UI] Note card clicked, noteId:', noteId);
        this.openNoteDetail(noteId);
      });
    });
  },

  /**
   * Render a single note card
   * @param {Object} note - Note object
   * @returns {string} HTML string
   */
  renderNoteCard(note) {
    const category = note.classification?.category || 'personal';
    const icon = this.categoryIcons[category] || '📝';
    const title = note.extracted?.title || 'Untitled Note';
    const timestamp = this.formatNoteListTimestamp(note.timestamps?.created_at || note.created_at);

    // Get user's original words - prioritize fields that contain user input
    // AVOID: note.summary, note.content, note.refined (these are AI-generated)
    // PREFER: raw_text, raw_content, text (user-authored fields)
    const rawText = note.input?.raw_text ||
                    note.input?.raw_content ||
                    note.text ||  // Legacy field for very old notes
                    '';

    // Normalize whitespace and prepare preview
    const normalizedText = rawText.replace(/\s+/g, ' ').trim();

    // Generate preview with proper handling
    let preview;
    if (!normalizedText) {
      // No original text available - show placeholder instead of AI summary
      preview = '(no preview)';
    } else if (normalizedText.length <= 80) {
      preview = normalizedText;
    } else {
      // Truncate at word boundary to avoid mid-word cuts
      // Using safer truncation that handles unicode better
      const truncated = normalizedText.substring(0, 80).trim();
      // Find last space to avoid cutting mid-word
      const lastSpace = truncated.lastIndexOf(' ');
      preview = (lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated) + '...';
    }
    const hasComment = note.feedback?.comment ? true : false;
    // Phase 4.5.3: Check all possible image locations
    const imageData = note.imageData || note.input?.image_thumbnail || note.input?.image_url || note.input?.image_data;

    return `
      <div class="note-card ${imageData ? 'has-thumbnail' : ''}" data-note-id="${note.id}">
        ${imageData ? `<div class="note-card-thumbnail"><img src="${imageData}" alt="" /></div>` : ''}
        <div class="note-card-content">
          <div class="category-badge">
            <span>${icon}</span>
            <span>${category}</span>
            ${hasComment ? '<span class="note-comment-indicator" title="Has feedback">●</span>' : ''}
          </div>
          <div class="note-card-header">
            <h4 class="note-card-title">${this.escapeHtml(title)}</h4>
            <span class="note-card-time">${timestamp}</span>
          </div>
          <p class="note-card-preview">${this.escapeHtml(preview)}</p>
        </div>
      </div>
    `;
  },

  /**
   * Format timestamp for notes list (e.g., "Today · 19:23" or "Jan 11 · 19:23")
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted timestamp
   */
  formatNoteListTimestamp(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    if (isToday) return `Today · ${timeStr}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday · ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    return `${dateStr} · ${timeStr}`;
  },

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Phase 12: Escape HTML but make entity names clickable
   * @param {string} text - Text to escape
   * @param {Array} entities - Array of entity objects with name property
   * @returns {string} Escaped text with clickable entity links
   */
  escapeHtmlWithEntities(text, entities) {
    if (!text) return '';

    // First escape the HTML
    let escaped = this.escapeHtml(text);

    // If no entities provided, try to get them from the current note
    if (!entities || entities.length === 0) {
      const note = this.currentNote;
      if (note?.analysis?.entities?.people) {
        entities = note.analysis.entities.people.map(name => ({ name }));
      }
      // Also include visual entities
      if (note?.analysis?.visualEntities) {
        entities = (entities || []).concat(note.analysis.visualEntities);
      }
    }

    if (!entities || entities.length === 0) return escaped;

    // Sort by name length descending to avoid partial replacements
    const sortedEntities = [...entities].sort((a, b) =>
      (b.name?.length || 0) - (a.name?.length || 0)
    );

    // Replace entity names with clickable spans
    for (const entity of sortedEntities) {
      if (!entity.name) continue;
      const name = entity.name;
      // Create a case-insensitive regex that matches whole words
      const regex = new RegExp(`\\b(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
      escaped = escaped.replace(regex, (match) =>
        `<span class="entity-link" data-entity="${name.toLowerCase()}">${match}</span>`
      );
    }

    return escaped;
  },

  /**
   * Phase 5A.6: Enter edit mode for "What You Shared" section
   * @param {HTMLElement} button - Edit button element
   */
  enterEditShared(button) {
    const section = button.closest('.what-you-shared-section');
    const contentEl = section.querySelector('.shared-content');
    const currentText = contentEl.textContent;

    // Hide original content and edit button
    contentEl.style.display = 'none';
    button.style.display = 'none';

    // Create edit container with textarea and action buttons
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.innerHTML = `
      <textarea class="edit-shared-textarea">${currentText}</textarea>
      <div class="edit-actions">
        <button class="save-link" type="button">Save</button>
        <span class="edit-divider">·</span>
        <button class="cancel-link" type="button">Cancel</button>
      </div>
    `;

    section.appendChild(editContainer);

    // Focus textarea and move cursor to end
    const textarea = editContainer.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  },

  /**
   * Phase 5A.6: Cancel edit mode
   * @param {HTMLElement} section - The what-you-shared section
   */
  cancelEditShared(section) {
    // Remove edit container
    const editContainer = section.querySelector('.edit-container');
    if (editContainer) {
      editContainer.remove();
    }

    // Show original content and edit button
    const contentEl = section.querySelector('.shared-content');
    const editBtn = section.querySelector('.edit-shared-btn');

    if (contentEl) contentEl.style.display = '';
    if (editBtn) editBtn.style.display = '';

    console.log('Edit cancelled');
  },

  /**
   * Phase 5A.6: Save edit for "What You Shared" section
   * @param {HTMLElement} section - The what-you-shared section
   */
  async saveEditShared(section) {
    const textarea = section.querySelector('.edit-shared-textarea');
    const contentEl = section.querySelector('.shared-content');
    const editBtn = section.querySelector('.edit-shared-btn');
    const noteId = section.dataset.noteId;
    const newText = textarea.value.trim();

    try {
      // Update note in DB
      const note = await DB.getNoteById(noteId);
      if (note) {
        // Save the edited text immediately
        if (note.analysis) {
          note.analysis.cleanedInput = newText;
          note.analysis.whatYouShared = newText;
        }
        if (note.input) {
          note.input.raw_text = newText;
        }
        await DB.save('notes', note);

        // Phase 5A.5: Re-analyze with updated text using tasteful overlay
        window.showUpdatingOverlay?.();

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: {
                type: note.input?.type || 'text',
                content: newText,
                duration: note.input?.duration
              },
              context: {
                category: note.analysis?.category,
                isEdit: true
              }
            })
          });

          if (response.ok) {
            const newAnalysis = await response.json();

            // Merge new analysis, keeping the edited transcript
            note.analysis = {
              ...note.analysis,
              ...newAnalysis,
              whatYouShared: newText,
              cleanedInput: newText
            };

            // Save updated note with new analysis
            await DB.save('notes', note);

            // Sync if available
            if (typeof Sync !== 'undefined') {
              await Sync.pushChanges();
            }

            // Re-render the note detail with updated analysis
            await this.openNoteDetail(note.id);
            this.showToast('Updated ✓');
          } else {
            // API failed but text was saved
            this.showToast('Saved (analysis unchanged)');
          }
        } catch (analyzeError) {
          console.error('Re-analysis failed:', analyzeError);
          this.showToast('Saved (analysis unchanged)');
        } finally {
          window.hideUpdatingOverlay?.();
        }

        // Sync if available (in case analysis didn't run)
        if (typeof Sync !== 'undefined') {
          await Sync.pushChanges();
        }
      }

      // Update UI (only if still in edit mode - openNoteDetail may have re-rendered)
      const currentEditContainer = section.querySelector('.edit-container');
      if (currentEditContainer) {
        contentEl.textContent = newText;
        contentEl.style.display = '';
        currentEditContainer.remove();
        if (editBtn) editBtn.style.display = '';
      }
    } catch (error) {
      console.error('Failed to save edit:', error);
      this.showToast('Failed to save');
    }
  },

  /**
   * Phase 5A.6: Toggle edit mode for "What You Shared" section (legacy handler)
   * @param {HTMLElement} button - Edit button element
   */
  async toggleEditShared(button) {
    // Now just enters edit mode - save/cancel handled by click delegation
    this.enterEditShared(button);
  },

  /**
   * Phase 7: Toggle edit mode for Summary section
   * @param {HTMLElement} button - Edit button element
   */
  toggleEditSummary(button) {
    this.enterEditSummary(button);
  },

  /**
   * Phase 7: Enter edit mode for Summary section
   * @param {HTMLElement} button - Edit button element
   */
  enterEditSummary(button) {
    const section = button.closest('.summary-section');
    const contentEl = section.querySelector('.summary-content');
    const currentText = contentEl.textContent;

    // Hide original content and edit button
    contentEl.style.display = 'none';
    button.style.display = 'none';

    // Create edit container with textarea and action buttons
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container edit-summary-container';
    editContainer.innerHTML = `
      <textarea class="edit-output-textarea">${currentText}</textarea>
      <div class="edit-actions">
        <button class="save-summary-link" type="button">Save</button>
        <span class="edit-divider">·</span>
        <button class="cancel-summary-link" type="button">Cancel</button>
      </div>
    `;

    section.appendChild(editContainer);

    // Focus textarea and move cursor to end
    const textarea = editContainer.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  },

  /**
   * Phase 7: Cancel edit mode for Summary
   * @param {HTMLElement} section - The summary section
   */
  cancelEditSummary(section) {
    const editContainer = section.querySelector('.edit-summary-container');
    if (editContainer) {
      editContainer.remove();
    }
    const contentEl = section.querySelector('.summary-content');
    const editBtn = section.querySelector('.edit-output-btn');
    if (contentEl) contentEl.style.display = '';
    if (editBtn) editBtn.style.display = '';
  },

  /**
   * Phase 7: Save edit for Summary section and track with Feedback system
   * @param {HTMLElement} section - The summary section
   */
  async saveEditSummary(section) {
    const textarea = section.querySelector('.edit-output-textarea');
    const contentEl = section.querySelector('.summary-content');
    const editBtn = section.querySelector('.edit-output-btn');
    const noteId = section.dataset.noteId;
    const newText = textarea.value.trim();
    const originalText = contentEl.textContent;

    try {
      // Track the edit with Feedback system BEFORE saving
      if (typeof Feedback !== 'undefined' && newText !== originalText) {
        await Feedback.trackEdit(noteId, 'summary', originalText, newText);
      }

      // Update note in DB
      const note = await DB.getNoteById(noteId);
      if (note && note.analysis) {
        note.analysis.summary = newText;
        await DB.save('notes', note);

        // Sync if available
        if (typeof Sync !== 'undefined') {
          await Sync.pushChanges();
        }

        this.showToast('Summary updated ✓');
      }

      // Update UI
      contentEl.textContent = newText;
      contentEl.style.display = '';
      const editContainer = section.querySelector('.edit-summary-container');
      if (editContainer) editContainer.remove();
      if (editBtn) editBtn.style.display = '';

    } catch (error) {
      console.error('Failed to save summary edit:', error);
      this.showToast('Failed to save');
    }
  },

  /**
   * Phase 7: Toggle edit mode for Insight section
   * @param {HTMLElement} button - Edit button element
   */
  toggleEditInsight(button) {
    this.enterEditInsight(button);
  },

  /**
   * Phase 7: Enter edit mode for Insight section
   * @param {HTMLElement} button - Edit button element
   */
  enterEditInsight(button) {
    const section = button.closest('.insight-section');
    const contentEl = section.querySelector('.insight-content');
    const currentText = contentEl.textContent;

    // Hide original content and edit button
    contentEl.style.display = 'none';
    button.style.display = 'none';

    // Create edit container with textarea and action buttons
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container edit-insight-container';
    editContainer.innerHTML = `
      <textarea class="edit-output-textarea">${currentText}</textarea>
      <div class="edit-actions">
        <button class="save-insight-link" type="button">Save</button>
        <span class="edit-divider">·</span>
        <button class="cancel-insight-link" type="button">Cancel</button>
      </div>
    `;

    section.appendChild(editContainer);

    // Focus textarea and move cursor to end
    const textarea = editContainer.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  },

  /**
   * Phase 7: Cancel edit mode for Insight
   * @param {HTMLElement} section - The insight section
   */
  cancelEditInsight(section) {
    const editContainer = section.querySelector('.edit-insight-container');
    if (editContainer) {
      editContainer.remove();
    }
    const contentEl = section.querySelector('.insight-content');
    const editBtn = section.querySelector('.edit-insight-btn');
    if (contentEl) contentEl.style.display = '';
    if (editBtn) editBtn.style.display = '';
  },

  /**
   * Phase 7: Save edit for Insight section and track with Feedback system
   * @param {HTMLElement} section - The insight section
   */
  async saveEditInsight(section) {
    const textarea = section.querySelector('.edit-output-textarea');
    const contentEl = section.querySelector('.insight-content');
    const editBtn = section.querySelector('.edit-insight-btn');
    const noteId = section.dataset.noteId;
    const newText = textarea.value.trim();
    const originalText = contentEl.textContent;

    try {
      // Track the edit with Feedback system BEFORE saving
      if (typeof Feedback !== 'undefined' && newText !== originalText) {
        await Feedback.trackEdit(noteId, 'insight', originalText, newText);
      }

      // Update note in DB
      const note = await DB.getNoteById(noteId);
      if (note && note.analysis) {
        note.analysis.insight = newText;
        await DB.save('notes', note);

        // Sync if available
        if (typeof Sync !== 'undefined') {
          await Sync.pushChanges();
        }

        this.showToast('Insight updated ✓');
      }

      // Update UI
      contentEl.textContent = newText;
      contentEl.style.display = '';
      const editContainer = section.querySelector('.edit-insight-container');
      if (editContainer) editContainer.remove();
      if (editBtn) editBtn.style.display = '';

    } catch (error) {
      console.error('Failed to save insight edit:', error);
      this.showToast('Failed to save');
    }
  },

  /**
   * Set up note detail event handlers
   */
  setupNoteDetail() {
    // Back button
    const backBtn = document.getElementById('note-detail-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closeNoteDetail());
    }

    // Copy button
    const copyBtn = document.getElementById('note-detail-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyNoteToClipboard());
    }

    // Export button
    const exportBtn = document.getElementById('note-detail-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportNoteAsJson());
    }

    // Delete button
    const deleteBtn = document.getElementById('note-detail-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.showDeleteDialog());
    }

    // Delete dialog buttons
    const cancelBtn = document.getElementById('delete-cancel');
    const confirmBtn = document.getElementById('delete-confirm');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideDeleteDialog());
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmDeleteNote());
    }

    // Phase 5A.6: Event delegation for edit mode Save/Cancel buttons
    document.addEventListener('click', async (e) => {
      // Handle Save click for "What You Shared"
      if (e.target.classList.contains('save-link')) {
        e.preventDefault();
        const section = e.target.closest('.what-you-shared-section');
        if (section) {
          await this.saveEditShared(section);
        }
      }

      // Handle Cancel click for "What You Shared"
      if (e.target.classList.contains('cancel-link')) {
        e.preventDefault();
        const section = e.target.closest('.what-you-shared-section');
        if (section) {
          this.cancelEditShared(section);
        }
      }

      // Phase 7: Handle Save click for Summary
      if (e.target.classList.contains('save-summary-link')) {
        e.preventDefault();
        const section = e.target.closest('.summary-section');
        if (section) {
          await this.saveEditSummary(section);
        }
      }

      // Phase 7: Handle Cancel click for Summary
      if (e.target.classList.contains('cancel-summary-link')) {
        e.preventDefault();
        const section = e.target.closest('.summary-section');
        if (section) {
          this.cancelEditSummary(section);
        }
      }

      // Phase 7: Handle Save click for Insight
      if (e.target.classList.contains('save-insight-link')) {
        e.preventDefault();
        const section = e.target.closest('.insight-section');
        if (section) {
          await this.saveEditInsight(section);
        }
      }

      // Phase 7: Handle Cancel click for Insight
      if (e.target.classList.contains('cancel-insight-link')) {
        e.preventDefault();
        const section = e.target.closest('.insight-section');
        if (section) {
          this.cancelEditInsight(section);
        }
      }
    });
  },

  /**
   * Open note detail view
   * @param {string} noteId - Note ID
   */
  async openNoteDetail(noteId) {
    console.log('[UI] openNoteDetail called with noteId:', noteId);
    try {
      // Get note from database
      const note = await DB.getNoteById(noteId);
      console.log('[UI] DB.getNoteById result:', note ? 'found' : 'NOT FOUND', note?.id);
      if (!note) {
        this.showToast('Note not found');
        return;
      }

      this.currentNote = note;

      // Populate detail view
      const category = note.classification?.category || 'personal';
      const icon = this.categoryIcons[category] || '📝';

      document.getElementById('note-detail-icon').textContent = icon;
      document.getElementById('note-detail-category-label').textContent = category;
      document.getElementById('note-detail-title').textContent = note.extracted?.title || 'Untitled Note';

      // Format timestamp
      const timestamp = this.formatDetailTimestamp(note.timestamps);
      document.getElementById('note-detail-timestamp').textContent = timestamp;

      // Phase 4.5.3: Build image HTML - check all possible image locations
      const imageData = note.imageData || note.input?.image_thumbnail || note.input?.image_url || note.input?.image_data;
      const imageHtml = imageData ? `
        <div class="note-detail-image">
          <img src="${imageData}" alt="Note image" />
        </div>
      ` : '';

      // Check for Phase 3a analysis format
      if (note.analysis?.summary) {
        // Render new Phase 3a format (Summary + Insight + Question + Feedback)
        // Prepend image if it exists
        document.getElementById('note-detail-body').innerHTML = imageHtml + this.renderPhase3aOutput(note);
        this.attachPhase3aListeners(note.id);
      } else {
        // Fallback to old format - prepend image if exists
        const formattedOutput = note.refined?.formatted_output || '';
        document.getElementById('note-detail-body').innerHTML = imageHtml + this.renderMarkdown(formattedOutput);
      }

      // Phase 7.1: Capture original output for Tinker feedback tracking
      if (typeof Feedback !== 'undefined' && note.analysis) {
        Feedback.captureOriginalOutput(note.id, note.analysis, note);
      }

      // Show detail screen
      document.getElementById('screen-note-detail').classList.remove('hidden');

    } catch (error) {
      console.error('Failed to open note detail:', error);
      this.showToast('Failed to open note');
    }
  },

  /**
   * Close note detail view - returns to previous screen
   */
  closeNoteDetail() {
    // Phase 7.1: Clear feedback tracking for this note
    if (typeof Feedback !== 'undefined' && this.currentNote?.id) {
      Feedback.clearOriginalOutput(this.currentNote.id);
    }

    document.getElementById('screen-note-detail').classList.add('hidden');
    this.currentNote = null;

    // Return to previous screen (actions or notes)
    if (this.previousScreen === 'actions') {
      this.showScreen('actions');
      this.previousScreen = 'notes'; // Reset
    }
  },

  /**
   * Render Phase 3b output format - Enhanced with Original, Actions, Shareability, Decision Lens
   * Phase 4A: Added personal output mode for emotional/reflective notes
   * @param {Object} note - Note object with analysis
   * @returns {string} HTML string
   */
  renderPhase3aOutput(note) {
    const analysis = note.analysis || {};
    const feedback = note.feedback || {};
    const isDecision = analysis.decision?.isDecision || analysis.decision?.is_decision || analysis.type === 'decision';
    const isResolved = analysis.decision?.resolved;

    // Phase 8.8: Check if this is a tiered response (has new schema fields)
    const isTieredResponse = analysis.heard || analysis.tier;

    // Phase 4A: Check if this is a personal-mode note
    const isPersonalMode = analysis.noteType === 'personal' || analysis.whatThisReveals;

    // Phase 8.8: Render tiered format for ALL notes with tiered schema
    // This takes priority over legacy personal/productive distinction
    if (isTieredResponse) {
      console.log('[UI] Phase 8.8 - Rendering tiered response:', {
        tier: analysis.tier,
        heard: analysis.heard?.substring(0, 30),
        noteType: analysis.noteType
      });
      return this.renderPersonalOutput(note);
    }

    // Phase 4A: Render personal format if applicable (legacy fallback)
    if (isPersonalMode) {
      return this.renderPersonalOutput(note);
    }

    let html = '<div class="phase3a-output">';

    // Phase 7: Show preference indicator if preferences were applied
    if (analysis.preferencesApplied) {
      html += `
        <div class="preferences-indicator">
          <span class="preferences-icon">✨</span>
          <span class="preferences-text">Based on your preferences</span>
        </div>
      `;
    }

    // IMAGE section - show if note has imageData
    const imageData = note.imageData || note.input?.image_thumbnail;
    if (imageData) {
      html += `
        <div class="note-image-container">
          <img src="${imageData}" alt="Note image" class="note-image" />
        </div>
      `;
    }

    // ORIGINAL section (cleanedInput) - Phase 5A.1: with edit capability
    const originalText = analysis.cleanedInput || note.input?.raw_text || '';
    if (originalText) {
      html += `
        <div class="note-section what-you-shared-section" data-note-id="${note.id}">
          <div class="note-section-header">
            WHAT YOU SHARED
            <button class="edit-shared-btn" onclick="UI.toggleEditShared(this)">Edit</button>
          </div>
          <div class="note-original shared-content">${this.escapeHtml(originalText)}</div>
        </div>
      `;
    }

    // SUMMARY section - Phase 7: with edit capability for feedback tracking
    if (analysis.summary) {
      html += `
        <div class="note-section summary-section" data-note-id="${note.id}">
          <div class="note-section-header">
            SUMMARY
            <button class="edit-output-btn" onclick="UI.toggleEditSummary(this)">Edit</button>
          </div>
          <div class="output-summary summary-content">${this.escapeHtml(analysis.summary)}</div>
        </div>
      `;
    }

    // Phase 8: Entity chips section - clickable to edit
    const entities = analysis.entities || {};
    const allEntities = [
      ...(entities.people || []).map(name => ({ name, type: 'person' })),
      ...(entities.pets || []).map(name => ({ name, type: 'pet' })),
      ...(entities.places || []).map(name => ({ name, type: 'place' })),
      ...(entities.projects || []).map(name => ({ name, type: 'project' }))
    ];

    if (allEntities.length > 0) {
      html += `
        <div class="note-section entities-section">
          <div class="note-section-header">MENTIONED</div>
          <div class="entity-chips">
            ${allEntities.map(e => `
              <span class="entity-chip entity-chip-${e.type}"
                    onclick="UI.openEntityByName('${this.escapeHtml(e.name)}', '${e.type}')"
                    title="Click to edit">
                ${this.escapeHtml(e.name)}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Insight (italic, with divider) - Phase 7: with edit capability for feedback tracking
    if (analysis.insight) {
      html += `
        <div class="output-divider"></div>
        <div class="insight-section" data-note-id="${note.id}">
          <div class="insight-header">
            <span class="insight-label">INSIGHT</span>
            <button class="edit-output-btn edit-insight-btn" onclick="UI.toggleEditInsight(this)">Edit</button>
          </div>
          <div class="output-insight insight-content">${this.escapeHtml(analysis.insight)}</div>
        </div>
      `;
    }

    // Question (bold, with divider) + Answer section
    if (analysis.question) {
      html += `
        <div class="output-divider"></div>
        <div class="question-section">
          <div class="output-question">${this.escapeHtml(analysis.question)}</div>
          ${!note.questionAnswer?.answer ? `
            <button class="answer-question-btn" data-action="show-answer-input">ANSWER</button>
          ` : ''}
        </div>
      `;

      // Answer container (hidden by default)
      html += `<div id="answer-container" class="answer-container" style="display: none;"></div>`;

      // If note already has an answer, display it
      if (note.questionAnswer?.answer) {
        html += `
          <div class="note-answer">
            <div class="note-section-header">YOUR ANSWER</div>
            <div class="answer-text">"${this.escapeHtml(note.questionAnswer.answer)}"</div>
            <span class="edit-answer-link" data-action="edit-answer">Edit</span>
          </div>
        `;
      }
    }

    // DECISION LENS section (only if decision detected)
    if (isDecision && analysis.decision) {
      const dec = analysis.decision;
      html += `
        <div class="note-decision-lens">
          <div class="note-section-header">DECISION LENS</div>
          ${dec.type ? `<div class="decision-type">Type: <strong>${this.capitalizeFirst(dec.type)}</strong></div>` : ''}
          ${dec.hiddenAssumption ? `<div class="decision-assumption"><em>Hidden assumption:</em> ${this.escapeHtml(dec.hiddenAssumption)}</div>` : ''}
          ${dec.insight ? `<div class="decision-guidance">${this.escapeHtml(dec.insight)}</div>` : ''}
          ${dec.options && dec.options.length > 0 ? `<div class="decision-options">Options: ${dec.options.map(o => this.escapeHtml(o)).join(' vs ')}</div>` : ''}
        </div>
      `;
    }

    // ACTIONS section (if actions exist)
    const actions = analysis.actions || [];
    const actionsCompleted = analysis.actionsCompleted || [];
    if (actions.length > 0) {
      html += `
        <div class="note-section">
          <div class="note-section-header">ACTIONS</div>
          <ul class="note-actions-list">
            ${actions.map((action, i) => {
              const isChecked = actionsCompleted.includes(i);
              return `
              <li class="${isChecked ? 'completed' : ''}">
                <input type="checkbox" id="action-${i}" class="action-checkbox" data-index="${i}" ${isChecked ? 'checked' : ''}>
                <label for="action-${i}">${this.escapeHtml(typeof action === 'string' ? action : action.action || action.text || 'Unknown action')}</label>
              </li>
            `;
            }).join('')}
          </ul>
        </div>
      `;
    }

    // Shareability indicator
    const shareability = analysis.shareability || {};
    if (shareability.ready !== undefined) {
      const shareClass = shareability.ready ? 'ready' : 'needs-work';
      const shareIcon = shareability.ready ? '✓' : '○';
      const shareLabel = shareability.ready ? 'READY TO SHARE' : 'NEEDS REFINEMENT';
      html += `
        <div class="note-shareability ${shareClass}">
          <span class="shareability-icon">${shareIcon}</span>
          <span class="shareability-label">${shareLabel}</span>
          ${shareability.reason ? `<span class="shareability-reason">— ${this.escapeHtml(shareability.reason)}</span>` : ''}
        </div>
      `;
    }

    // Feedback buttons
    const likedClass = feedback.rating === 'liked' ? 'active' : '';
    const dislikedClass = feedback.rating === 'disliked' ? 'active' : '';

    html += `
      <div class="feedback-buttons">
        <button class="feedback-btn feedback-btn--reject ${dislikedClass}" data-action="dislike" aria-label="Not quite">
          <span class="feedback-btn__icon">✕</span>
          <span>Not quite</span>
        </button>
        <button class="feedback-btn feedback-btn--approve ${likedClass}" data-action="like" aria-label="Resonates">
          <span class="feedback-btn__icon">✓</span>
          <span>Resonates</span>
        </button>
      </div>
      <div class="feedback-comment-row" style="margin-top: var(--space-3); text-align: center;">
        <button class="btn-text" data-action="comment" aria-label="Add comment">Add feedback</button>
      </div>
    `;

    // Show saved comment if exists
    if (feedback.comment) {
      html += `
        <div class="feedback-saved-comment">
          <span class="feedback-comment-label">Your feedback:</span>
          <span class="feedback-comment-text">${this.escapeHtml(feedback.comment)}</span>
        </div>
      `;
    }

    // Comment input (hidden by default, pre-populate if exists)
    const existingComment = feedback.comment || '';
    html += `
      <div class="feedback-comment-container hidden" id="feedback-comment-container">
        <textarea class="feedback-comment-input" id="feedback-comment-input" placeholder="What could be better?" maxlength="200" rows="2">${this.escapeHtml(existingComment)}</textarea>
        <button class="feedback-comment-submit" id="feedback-comment-submit">Done</button>
      </div>
    `;

    // Phase 4.1: Think Through This button - opens bottom sheet chat
    html += `
      <div class="output-divider"></div>
      <button class="think-through-btn" data-action="think-through">THINK THROUGH THIS</button>
    `;

    // Decision buttons (if decision) - always toggleable
    if (isDecision) {
      const decision = analysis.decision || {};
      const thinkingClass = decision.status === 'thinking' ? 'active' : '';
      const decidedClass = decision.resolved ? 'active' : '';

      html += `
        <div class="decision-buttons">
          <button class="decision-btn ${thinkingClass}" data-action="still-thinking">STILL THINKING</button>
          <button class="decision-btn ${decidedClass}" data-action="decided">DECIDED</button>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * Render personal output format (Phase 4A)
   * For emotional/reflective notes - warm, insightful, not functional
   * @param {Object} note - Note object with analysis
   * @returns {string} HTML string
   */
  renderPersonalOutput(note) {
    const analysis = note.analysis || {};
    const feedback = note.feedback || {};

    // Phase 8.8 DEBUG: Log analysis object
    console.log('[UI] renderPersonalOutput - analysis keys:', Object.keys(analysis));
    console.log('[UI] renderPersonalOutput - analysis.heard:', analysis.heard);
    console.log('[UI] renderPersonalOutput - analysis.noticed:', analysis.noticed);
    console.log('[UI] renderPersonalOutput - analysis.tier:', analysis.tier);
    console.log('[UI] renderPersonalOutput - analysis.summary:', analysis.summary);

    let html = '<div class="phase3a-output personal-output">';

    // Phase 7: Show preference indicator if preferences were applied
    if (analysis.preferencesApplied) {
      html += `
        <div class="preferences-indicator">
          <span class="preferences-icon">✨</span>
          <span class="preferences-text">Based on your preferences</span>
        </div>
      `;
    }

    // IMAGE section - show if note has imageData
    const imageData = note.imageData || note.input?.image_thumbnail;
    if (imageData) {
      html += `
        <div class="note-image-container">
          <img src="${imageData}" alt="Note image" class="note-image" />
        </div>
      `;
    }

    // MOOD indicator (Phase 4A)
    if (analysis.mood) {
      html += `
        <div class="note-mood">
          <span class="mood-label">${this.escapeHtml(analysis.mood)}</span>
        </div>
      `;
    }

    // Phase 8.8: Check if this is a tiered response
    const isTieredResponse = analysis.heard || analysis.tier;

    // Phase 8.8 DEBUG: Detailed logging
    console.log('[UI] Phase 8.8 isTieredResponse check:', {
      isTieredResponse,
      hasHeard: !!analysis.heard,
      heardValue: analysis.heard,
      hasTier: !!analysis.tier,
      tierValue: analysis.tier,
      hasNoticed: !!analysis.noticed,
      noticedValue: analysis.noticed,
      hasExperiment: !!analysis.experiment,
      experimentValue: analysis.experiment
    });

    if (isTieredResponse) {
      // ═══════════════════════════════════════════
      // PHASE 8.8: TIERED RESPONSE RENDERING
      // ═══════════════════════════════════════════

      // WHAT YOU SHARED section (original content for context)
      const originalContent = note.input?.raw_text || analysis.cleanedInput || '';
      if (originalContent) {
        html += `
          <div class="note-section what-you-shared-section">
            <div class="note-section-header">WHAT YOU SHARED</div>
            <div class="note-original-content">"${this.escapeHtml(originalContent)}"</div>
          </div>
        `;
      }

      // WHAT I HEARD section (always present in tiered responses)
      if (analysis.heard) {
        html += `
          <div class="note-section heard-section">
            <div class="note-section-header">WHAT I HEARD</div>
            <div class="personal-heard">${this.escapeHtmlWithEntities(analysis.heard)}</div>
          </div>
        `;
      }

      // WHAT I NOTICED section (Standard/Deep tiers)
      if (analysis.noticed) {
        html += `
          <div class="note-section noticed-section">
            <div class="note-section-header">WHAT I NOTICED</div>
            <div class="personal-noticed">${this.escapeHtmlWithEntities(analysis.noticed)}</div>
          </div>
        `;
      }

      // A POSSIBILITY section (Deep tier - hidden_assumption)
      if (analysis.hidden_assumption) {
        html += `
          <div class="note-section assumption-section">
            <div class="note-section-header">A POSSIBILITY</div>
            <div class="personal-assumption">${this.escapeHtmlWithEntities(analysis.hidden_assumption)}</div>
          </div>
        `;
      }

      // A QUESTION FOR YOU section
      const question = analysis.question || analysis.questionToSitWith;
      if (question) {
        html += `
          <div class="note-section question-section">
            <div class="note-section-header">A QUESTION FOR YOU</div>
            <div class="personal-question">${this.escapeHtmlWithEntities(question)}</div>
          </div>
        `;

        // If note already has an answer, display it
        if (note.questionAnswer?.answer) {
          html += `
            <div class="note-section reflection-section">
              <div class="note-section-header">YOUR RESPONSE</div>
              <div class="note-original-content">"${this.escapeHtml(note.questionAnswer.answer)}"</div>
              <span class="edit-answer-link" data-action="edit-answer">Edit</span>
            </div>
          `;
        } else {
          // Always show inline response input for notes with questions (all tiers)
          html += `
            <div class="note-question__response" id="reflection-input-container">
              <input
                type="text"
                class="note-question__input"
                id="reflection-textarea"
                placeholder="Type your response..."
              />
              <button class="note-question__submit" id="reflection-submit-btn">→</button>
            </div>
          `;
        }
      }

      // Answer container for legacy toggle (hidden)
      html += `<div id="answer-container" class="answer-container" style="display: none;"></div>`;

      // SOMETHING TO TRY section (Standard/Deep tiers - experiment)
      if (analysis.experiment) {
        html += `
          <div class="note-section experiment-section">
            <div class="note-section-header">SOMETHING TO TRY</div>
            <div class="personal-experiment">${this.escapeHtml(analysis.experiment)}</div>
          </div>
        `;
      }

      // INVITE section removed - was "Share more if you'd like me to dig deeper"

    } else {
      // ═══════════════════════════════════════════
      // LEGACY PERSONAL NOTE RENDERING
      // For backward compatibility with old notes
      // ═══════════════════════════════════════════

      // WHAT YOU SHARED section (whatYouShared - cleaned transcript preserving emotional tone)
      // Phase 5A.1: with edit capability
      const whatYouShared = analysis.whatYouShared || analysis.cleanedInput || note.input?.raw_text || '';
      if (whatYouShared) {
        html += `
          <div class="note-section what-you-shared-section" data-note-id="${note.id}">
            <div class="note-section-header">
              WHAT YOU SHARED
              <button class="edit-shared-btn" onclick="UI.toggleEditShared(this)">Edit</button>
            </div>
            <div class="note-original personal-original shared-content">${this.escapeHtml(whatYouShared)}</div>
          </div>
        `;
      }

      // WHAT THIS REVEALS section (Phase 4A - the key differentiator)
      if (analysis.whatThisReveals) {
        html += `
          <div class="note-section">
            <div class="note-section-header">WHAT THIS REVEALS</div>
            <div class="personal-reveals">${this.escapeHtml(analysis.whatThisReveals)}</div>
          </div>
        `;
      }

      // A QUESTION TO SIT WITH section (Phase 4A)
      const question = analysis.questionToSitWith || analysis.question;
      if (question) {
        html += `
          <div class="note-section">
            <div class="note-section-header">A QUESTION TO SIT WITH</div>
            <div class="personal-question">${this.escapeHtml(question)}</div>
          </div>
        `;

        // Answer container (hidden by default)
        html += `<div id="answer-container" class="answer-container" style="display: none;"></div>`;

        // If note already has an answer, display it
        if (note.questionAnswer?.answer) {
          html += `
            <div class="note-answer">
              <div class="note-section-header">YOUR REFLECTION</div>
              <div class="answer-text">"${this.escapeHtml(note.questionAnswer.answer)}"</div>
              <span class="edit-answer-link" data-action="edit-answer">Edit</span>
            </div>
          `;
        } else {
          html += `
            <button class="answer-question-btn personal-reflect-btn" data-action="show-answer-input">REFLECT</button>
          `;
        }
      }
    }

    // MEMORY TAGS section (Phase 4A)
    const memoryTags = analysis.memoryTags || [];
    if (memoryTags.length > 0) {
      html += `
        <div class="note-section memory-tags-section">
          <div class="note-section-header">MEMORY TAGS</div>
          <div class="memory-tags">
            ${memoryTags.map(tag => `<span class="memory-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    // Feedback buttons
    const likedClass = feedback.rating === 'liked' ? 'active' : '';
    const dislikedClass = feedback.rating === 'disliked' ? 'active' : '';

    html += `
      <div class="feedback-buttons">
        <button class="feedback-btn feedback-btn--reject ${dislikedClass}" data-action="dislike" aria-label="Not quite">
          <span class="feedback-btn__icon">✕</span>
          <span>Not quite</span>
        </button>
        <button class="feedback-btn feedback-btn--approve ${likedClass}" data-action="like" aria-label="Resonates">
          <span class="feedback-btn__icon">✓</span>
          <span>Resonates</span>
        </button>
      </div>
      <div class="feedback-comment-row" style="margin-top: var(--space-3); text-align: center;">
        <button class="btn-text" data-action="comment" aria-label="Add comment">Add feedback</button>
      </div>
    `;

    // Show saved comment if exists
    if (feedback.comment) {
      html += `
        <div class="feedback-saved-comment">
          <span class="feedback-comment-label">Your feedback:</span>
          <span class="feedback-comment-text">${this.escapeHtml(feedback.comment)}</span>
        </div>
      `;
    }

    // Comment input (hidden by default)
    const existingComment = feedback.comment || '';
    html += `
      <div class="feedback-comment-container hidden" id="feedback-comment-container">
        <textarea class="feedback-comment-input" id="feedback-comment-input" placeholder="What could be better?" maxlength="200" rows="2">${this.escapeHtml(existingComment)}</textarea>
        <button class="feedback-comment-submit" id="feedback-comment-submit">Done</button>
      </div>
    `;

    // Phase 4.1: Think Through This button - opens bottom sheet chat
    html += `
      <div class="output-divider"></div>
      <button class="think-through-btn" data-action="think-through">THINK THROUGH THIS</button>
    `;

    html += '</div>';
    return html;
  },

  /**
   * Attach event listeners for Phase 3b interactive elements
   * @param {string} noteId - Note ID
   */
  attachPhase3aListeners(noteId) {
    const body = document.getElementById('note-detail-body');

    // Feedback buttons
    body.querySelectorAll('.feedback-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        if (action === 'like') {
          this.rateFeedback(noteId, 'liked');
        } else if (action === 'dislike') {
          this.rateFeedback(noteId, 'disliked');
        } else if (action === 'comment') {
          this.showCommentInput();
        }
      });
    });

    // ANSWER button (dedicated button below question)
    const answerBtn = body.querySelector('[data-action="show-answer-input"]');
    if (answerBtn) {
      answerBtn.addEventListener('click', () => {
        this.toggleAnswerInput(noteId, false);
      });
    }

    // Edit answer link
    const editAnswerLink = body.querySelector('[data-action="edit-answer"]');
    if (editAnswerLink) {
      editAnswerLink.addEventListener('click', () => {
        this.toggleAnswerInput(noteId, true);
      });
    }

    // Inline reflection submit button (new design)
    const reflectionSubmitBtn = document.getElementById('reflection-submit-btn');
    if (reflectionSubmitBtn) {
      reflectionSubmitBtn.addEventListener('click', () => {
        this.submitInlineReflection(noteId);
      });
    }

    // Reflection input - submit on Enter
    const reflectionTextarea = document.getElementById('reflection-textarea');
    if (reflectionTextarea) {
      reflectionTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submitInlineReflection(noteId);
        }
      });
    }

    // Comment submit button
    const submitBtn = document.getElementById('feedback-comment-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.submitComment(noteId);
      });
    }

    // Action checkboxes
    body.querySelectorAll('.action-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.toggleActionComplete(noteId, index, e.target.checked);
      });
    });

    // Decision buttons
    const stillThinkingBtn = body.querySelector('[data-action="still-thinking"]');
    if (stillThinkingBtn) {
      stillThinkingBtn.addEventListener('click', () => {
        this.markDecisionThinking(noteId);
      });
    }

    const decidedBtn = body.querySelector('[data-action="decided"]');
    if (decidedBtn) {
      decidedBtn.addEventListener('click', () => {
        this.markDecisionResolved(noteId);
      });
    }

    // Track decision button (legacy)
    const trackBtn = document.getElementById('track-decision-btn');
    if (trackBtn) {
      trackBtn.addEventListener('click', () => {
        this.trackDecision(noteId);
      });
    }

    // Phase 4.1: Think Through This button - opens bottom sheet chat
    const thinkThroughBtn = body.querySelector('[data-action="think-through"]');
    if (thinkThroughBtn) {
      thinkThroughBtn.addEventListener('click', () => {
        this.openChatBottomSheet(noteId);
      });
    }
  },

  /**
   * Toggle "still thinking" status (can be toggled on/off)
   * @param {string} noteId - Note ID
   */
  async markDecisionThinking(noteId) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note || !note.analysis) return;

      // Initialize decision object if needed
      if (!note.analysis.decision) {
        note.analysis.decision = {};
      }

      // Toggle thinking status - can deselect to have no selection
      const wasThinking = note.analysis.decision.status === 'thinking';
      note.analysis.decision.status = wasThinking ? null : 'thinking';
      note.analysis.decision.statusAt = new Date().toISOString();
      // Clear resolved if selecting thinking
      if (!wasThinking) {
        note.analysis.decision.resolved = false;
        note.analysis.decision.resolvedAt = null;
      }

      await DB.saveNote(note);

      // Update UI immediately - silent toggle (no toast)
      const body = document.getElementById('note-detail-body');
      const thinkingBtn = body?.querySelector('[data-action="still-thinking"]');
      const decidedBtn = body?.querySelector('[data-action="decided"]');

      if (thinkingBtn) {
        thinkingBtn.classList.toggle('active', !wasThinking);
      }
      if (decidedBtn && !wasThinking) {
        decidedBtn.classList.remove('active');
      }

      // Trigger cloud sync (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Failed to toggle thinking status:', error);
    }
  },

  /**
   * Toggle decision as resolved (can be toggled on/off)
   * @param {string} noteId - Note ID
   */
  async markDecisionResolved(noteId) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note || !note.analysis) return;

      // Initialize decision object if needed
      if (!note.analysis.decision) {
        note.analysis.decision = {};
      }

      // Toggle resolved status - can deselect to have no selection
      const wasResolved = note.analysis.decision.resolved;
      note.analysis.decision.resolved = !wasResolved;
      note.analysis.decision.status = wasResolved ? null : 'decided';
      note.analysis.decision.resolvedAt = wasResolved ? null : new Date().toISOString();

      await DB.saveNote(note);

      // Update UI immediately - silent toggle (no toast)
      const body = document.getElementById('note-detail-body');
      const decidedBtn = body?.querySelector('[data-action="decided"]');
      const thinkingBtn = body?.querySelector('[data-action="still-thinking"]');

      if (decidedBtn) {
        decidedBtn.classList.toggle('active', !wasResolved);
      }
      if (thinkingBtn && !wasResolved) {
        thinkingBtn.classList.remove('active');
      }

      // Trigger cloud sync (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Failed to toggle decision:', error);
    }
  },

  /**
   * Toggle action item completion
   * @param {string} noteId - Note ID
   * @param {number} actionIndex - Index of the action
   * @param {boolean} completed - Whether the action is completed
   */
  async toggleActionComplete(noteId, actionIndex, completed) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note || !note.analysis) return;

      // Initialize actionsCompleted array if needed
      if (!note.analysis.actionsCompleted) {
        note.analysis.actionsCompleted = [];
      }

      if (completed) {
        // Add to completed array if not already there
        if (!note.analysis.actionsCompleted.includes(actionIndex)) {
          note.analysis.actionsCompleted.push(actionIndex);
        }
      } else {
        // Remove from completed array
        note.analysis.actionsCompleted = note.analysis.actionsCompleted.filter(i => i !== actionIndex);
      }

      await DB.saveNote(note);

      // Update visual state
      const checkbox = document.getElementById(`action-${actionIndex}`);
      if (checkbox) {
        const li = checkbox.closest('li');
        if (li) {
          li.classList.toggle('completed', completed);
        }
      }

      // Trigger cloud sync (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Failed to toggle action:', error);
    }
  },

  /**
   * Save like/dislike feedback
   * @param {string} noteId - Note ID
   * @param {string} rating - 'liked' or 'disliked'
   */
  async rateFeedback(noteId, rating) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note) return;

      // Toggle if same rating
      const currentRating = note.feedback?.rating;
      const newRating = currentRating === rating ? null : rating;

      note.feedback = {
        ...note.feedback,
        rating: newRating,
        feedback_at: new Date().toISOString()
      };

      await DB.saveNote(note);

      // Update UI immediately
      const body = document.getElementById('note-detail-body');
      body.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.classList.remove('active');
        if (newRating && btn.dataset.action === (newRating === 'liked' ? 'like' : 'dislike')) {
          btn.classList.add('active');
        }
      });

      // Show editorial feedback toast (Phase 9.1)
      if (newRating) {
        this.showFeedbackToast(newRating === 'liked' ? 'approve' : 'reject');
      } else {
        this.showToast('Feedback cleared');
      }

      // Process feedback for learning in background (non-blocking)
      if (typeof Feedback !== 'undefined' && newRating) {
        Feedback.processFeedback(note, newRating, null).catch(e => console.error('Feedback processing error:', e));
      }

      // Trigger cloud sync in background (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Failed to save feedback:', error);
      this.showToast('Failed to save feedback');
    }
  },

  /**
   * Show comment input
   */
  showCommentInput() {
    const container = document.getElementById('feedback-comment-container');
    if (container) {
      container.classList.remove('hidden');
      const input = document.getElementById('feedback-comment-input');
      if (input) input.focus();
    }
  },

  /**
   * Submit comment feedback
   * @param {string} noteId - Note ID
   */
  async submitComment(noteId) {
    const input = document.getElementById('feedback-comment-input');
    const comment = input?.value?.trim();

    if (!comment) {
      this.showToast('Please enter a comment');
      return;
    }

    try {
      const note = await DB.getNoteById(noteId);
      if (!note) return;

      note.feedback = {
        ...note.feedback,
        comment,
        feedback_at: new Date().toISOString()
      };

      await DB.saveNote(note);

      // Hide comment input
      const container = document.getElementById('feedback-comment-container');
      if (container) container.classList.add('hidden');
      if (input) input.value = '';

      // Show toast immediately
      this.showToast('Feedback saved');

      // Process feedback in background (non-blocking)
      if (typeof Feedback !== 'undefined') {
        Feedback.processFeedback(note, 'commented', comment).catch(e => console.error('Feedback processing error:', e));
      }

      // Trigger cloud sync in background (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Failed to save comment:', error);
      this.showToast('Failed to save comment');
    }
  },

  /**
   * Toggle answer input below question (Phase 3c)
   * @param {string} noteId - Note ID
   * @param {boolean} isEdit - Whether editing an existing answer
   */
  toggleAnswerInput(noteId, isEdit = false) {
    const answerContainer = document.getElementById('answer-container');
    const answerBtn = document.querySelector('[data-action="show-answer-input"]');

    if (!answerContainer) {
      console.log('[UI] Answer container not found');
      return;
    }

    // Toggle visibility
    if (answerContainer.style.display === 'none' || answerContainer.style.display === '') {
      answerContainer.style.display = 'block';
      answerContainer.innerHTML = `
        <div class="answer-input-wrapper">
          <textarea
            id="answer-input"
            placeholder="Your answer..."
            rows="3"
          ></textarea>
          <button class="submit-answer-btn" id="submit-answer-btn">SUBMIT</button>
        </div>
      `;

      // Hide the ANSWER button
      if (answerBtn) {
        answerBtn.style.display = 'none';
      }

      // Attach submit listener
      const submitBtn = document.getElementById('submit-answer-btn');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => this.submitAnswer(noteId));
      }

      // Focus the input
      const input = document.getElementById('answer-input');
      if (input) {
        setTimeout(() => input.focus(), 100);
      }

      // Hide the existing answer display if editing
      if (isEdit) {
        const answerDisplay = document.querySelector('.note-answer');
        if (answerDisplay) answerDisplay.style.display = 'none';
      }
    } else {
      answerContainer.style.display = 'none';
      answerContainer.innerHTML = '';

      // Show the ANSWER button again
      if (answerBtn) {
        answerBtn.style.display = 'inline-block';
      }
    }
  },

  /**
   * Submit answer to question and refine note (Phase 3c)
   * For personal notes: Uses REFLECT mode - tier upgrade with deeper analysis
   * For task notes: Uses REFINE mode - action refinement
   * @param {string} noteId - Note ID
   */
  async submitAnswer(noteId) {
    const answerInput = document.getElementById('answer-input');
    const answer = answerInput?.value?.trim();

    if (!answer) {
      this.showToast('Please enter an answer');
      return;
    }

    // Get the note
    const note = await DB.getNoteById(noteId);
    if (!note) return;

    // Determine if this is a personal note (use REFLECT mode) or task note (use REFINE mode)
    const isPersonalNote = note.classification?.category === 'personal_reflection' ||
                           note.classification?.category === 'personal' ||
                           note.analysis?.tier; // Tiered notes are personal

    console.log('[UI] submitAnswer - isPersonalNote:', isPersonalNote, 'tier:', note.analysis?.tier);

    // Store the answer/reflection
    note.questionAnswer = {
      answer: answer,
      answeredAt: new Date().toISOString()
    };

    // Show loading state
    answerInput.disabled = true;
    const submitBtn = document.getElementById('submit-answer-btn');
    if (submitBtn) {
      submitBtn.textContent = isPersonalNote ? 'GOING DEEPER...' : 'REFINING...';
      submitBtn.disabled = true;
    }

    try {
      if (isPersonalNote) {
        // REFLECT MODE - Tier upgrade with deeper analysis
        const upgradedAnalysis = await this.reflectAndUpgrade(note, answer);

        // Merge upgraded analysis with existing
        if (upgradedAnalysis) {
          // Preserve original heard, update with new deeper sections
          const originalHeard = note.analysis?.heard;
          note.analysis = {
            ...note.analysis,
            ...upgradedAnalysis,
            // Keep original heard as reference
            originalHeard: originalHeard,
            // Mark as upgraded
            upgradedFromReflection: true,
            upgradedAt: new Date().toISOString()
          };
          console.log('[UI] Reflection upgraded analysis - new tier:', note.analysis.tier);
        }

        this.showToast('Going deeper...');

      } else {
        // REFINE MODE - Action refinement for task notes
        const refined = await this.refineWithAnswer(note, answer);

        // Update note with refined data
        if (refined.summary) {
          note.analysis.summary = refined.summary;
        }
        if (refined.actions && refined.actions.length > 0) {
          note.analysis.actions = refined.actions;
        }

        this.showToast('Note refined!');
      }

      // Save updated note
      await DB.saveNote(note);

      // Re-render the note detail
      this.openNoteDetail(noteId);

      // Trigger cloud sync (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Reflection/Refine failed:', error);
      this.showToast('Processing failed, answer saved');

      // Restore button
      if (submitBtn) {
        submitBtn.textContent = 'SUBMIT';
        submitBtn.disabled = false;
      }
      answerInput.disabled = false;

      // Still save the answer even if refine fails
      await DB.saveNote(note);

      // Re-render to show the answer
      this.openNoteDetail(noteId);

      // Trigger cloud sync (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }
    }
  },

  /**
   * Call API to reflect and upgrade tier (REFLECT feature)
   * @param {Object} note - Note object
   * @param {string} reflection - User's reflection text
   */
  async reflectAndUpgrade(note, reflection) {
    const inputContent = note.input?.raw_text || note.analysis?.cleanedInput || '';
    const originalTier = note.analysis?.tier || 'quick';
    const question = note.analysis?.question || note.analysis?.questionToSitWith || '';

    console.log('[UI] reflectAndUpgrade - originalTier:', originalTier, 'input:', inputContent.substring(0, 50));

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          content: inputContent,
          type: note.input?.type || 'text'
        },
        context: {
          reflection: reflection,
          originalTier: originalTier,
          question: question
        },
        mode: 'reflect'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[UI] Reflect API failed:', errorText);
      throw new Error('Reflect API failed');
    }

    return response.json();
  },

  /**
   * Submit inline reflection (new UI design)
   * @param {string} noteId - Note ID
   */
  async submitInlineReflection(noteId) {
    const textarea = document.getElementById('reflection-textarea');
    const reflection = textarea?.value?.trim();

    if (!reflection) {
      this.showToast('Please enter a reflection');
      return;
    }

    // Get the note
    const note = await DB.getNoteById(noteId);
    if (!note) return;

    // Store the reflection
    note.questionAnswer = {
      answer: reflection,
      answeredAt: new Date().toISOString()
    };

    // Show loading state
    textarea.disabled = true;
    const submitBtn = document.getElementById('reflection-submit-btn');
    if (submitBtn) {
      submitBtn.textContent = '...';
      submitBtn.disabled = true;
    }

    console.log('[UI] submitInlineReflection - starting reflection upgrade');

    try {
      // REFLECT MODE - Tier upgrade with deeper analysis
      const upgradedAnalysis = await this.reflectAndUpgrade(note, reflection);

      // Merge upgraded analysis with existing
      if (upgradedAnalysis) {
        const originalHeard = note.analysis?.heard;
        note.analysis = {
          ...note.analysis,
          ...upgradedAnalysis,
          originalHeard: originalHeard,
          upgradedFromReflection: true,
          upgradedAt: new Date().toISOString()
        };
        console.log('[UI] Reflection upgraded - new tier:', note.analysis.tier);
      }

      // Save updated note
      await DB.saveNote(note);

      this.showToast('Going deeper...');

      // Re-render the note detail
      this.openNoteDetail(noteId);

      // Trigger cloud sync (non-blocking)
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('[UI] Reflection failed:', error);
      this.showToast('Processing failed, reflection saved');

      // Restore button
      if (submitBtn) {
        submitBtn.textContent = 'REFLECT';
        submitBtn.disabled = false;
      }
      textarea.disabled = false;

      // Still save the reflection even if upgrade fails
      await DB.saveNote(note);
      this.openNoteDetail(noteId);

      // Trigger cloud sync
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }
    }
  },

  /**
   * Call API to refine note with answer (Phase 3c)
   * @param {Object} note - Note object
   * @param {string} answer - User's answer
   */
  async refineWithAnswer(note, answer) {
    const inputContent = note.input?.raw_text || note.analysis?.cleanedInput || '';

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          content: inputContent,
          type: note.input?.type || 'text'
        },
        context: {
          question: note.analysis?.question,
          answer: answer
        },
        mode: 'refine'
      })
    });

    if (!response.ok) {
      throw new Error('Refine API failed');
    }

    return response.json();
  },

  /**
   * Track a decision from note detail
   * @param {string} noteId - Note ID
   */
  async trackDecision(noteId) {
    try {
      if (typeof DecisionTracker !== 'undefined') {
        await DecisionTracker.trackDecision(noteId);

        // Update button to show tracked status
        const btn = document.getElementById('track-decision-btn');
        if (btn) {
          btn.outerHTML = '<span class="decision-tracked-badge">Tracked • Deliberating</span>';
        }

        this.showToast('Decision tracked');
      } else {
        this.showToast('Decision tracking unavailable');
      }
    } catch (error) {
      console.error('Failed to track decision:', error);
      this.showToast('Failed to track decision');
    }
  },

  // ============================================
  // Phase 4.1: Chat Bottom Sheet - Socratic Dialogue
  // ============================================

  // Chat state
  chatHistory: [],
  currentChatMode: 'clarify',
  currentChatNoteId: null,

  /**
   * Open chat as a bottom sheet overlay
   * @param {string} noteId - Note ID
   */
  async openChatBottomSheet(noteId) {
    this.currentChatNoteId = noteId;

    // Create bottom sheet if it doesn't exist
    let overlay = document.getElementById('chat-overlay');
    let sheet = document.getElementById('chat-bottom-sheet');

    if (!sheet) {
      // Create overlay
      overlay = document.createElement('div');
      overlay.id = 'chat-overlay';
      overlay.className = 'chat-overlay';
      overlay.addEventListener('click', () => this.closeChatBottomSheet());
      document.body.appendChild(overlay);

      // Create bottom sheet
      sheet = document.createElement('div');
      sheet.id = 'chat-bottom-sheet';
      sheet.className = 'chat-bottom-sheet';
      sheet.innerHTML = `
        <div class="drag-handle"></div>
        <div class="chat-sheet-header">THINKING THROUGH</div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" class="chat-input" placeholder="What's on your mind..." />
          <button class="chat-send-btn" id="chat-send-btn" aria-label="Send">
            <span>→</span>
          </button>
        </div>
      `;
      document.body.appendChild(sheet);

      // Add event listeners
      document.getElementById('chat-send-btn').addEventListener('click', () => {
        this.sendChatMessage(this.currentChatNoteId);
      });

      document.getElementById('chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendChatMessage(this.currentChatNoteId);
        }
      });
    }

    // Load existing chat history
    const note = await DB.getNoteById(noteId);
    this.chatHistory = note?.chat?.messages || note?.chatHistory || [];

    // Generate opening message if needed
    if (this.chatHistory.length === 0 && note) {
      const openingMessage = this.generateChatOpeningMessage(note);
      this.chatHistory.push({
        role: 'assistant',
        content: openingMessage,
        timestamp: new Date().toISOString()
      });

      // Save to note
      note.chat = {
        messages: this.chatHistory,
        startedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString()
      };
      await DB.saveNote(note);
    }

    // Render messages
    this.renderChatMessages();

    // Show with animation
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      sheet.classList.add('open');
    });

    // Focus input after animation
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
    }, 300);
  },

  /**
   * Close chat bottom sheet
   */
  closeChatBottomSheet() {
    const overlay = document.getElementById('chat-overlay');
    const sheet = document.getElementById('chat-bottom-sheet');

    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('open');

    this.currentChatNoteId = null;
  },

  /**
   * Generate contextual opening message based on note type
   * @param {Object} note - Note object
   * @returns {string} Opening message
   */
  generateChatOpeningMessage(note) {
    const analysis = note.analysis || {};
    const title = (analysis.title || 'this').toLowerCase();
    const isDecision = analysis.decision?.isDecision;
    const isPersonal = analysis.noteType === 'personal' || analysis.whatThisReveals;

    if (isDecision) {
      return `You're considering ${title}. What's the core tension for you?`;
    } else if (isPersonal) {
      return `You shared something personal. What's sitting with you about this?`;
    } else {
      return `What aspect of "${title}" would you like to think through?`;
    }
  },

  /**
   * Render chat messages in bottom sheet
   */
  renderChatMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    if (this.chatHistory.length === 0) {
      messagesContainer.innerHTML = `
        <div class="chat-welcome">
          <p>What would you like to explore?</p>
        </div>
      `;
      return;
    }

    let html = '';
    this.chatHistory.forEach(msg => {
      const role = msg.role === 'twin' ? 'assistant' : msg.role;
      const roleClass = role === 'user' ? 'user-message' : 'assistant-message';
      html += `
        <div class="chat-message ${roleClass}">
          <div class="chat-message-content">${this.escapeHtml(msg.content)}</div>
        </div>
      `;
    });

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  /**
   * Send a chat message
   * @param {string} noteId - Note ID
   */
  async sendChatMessage(noteId) {
    const chatInput = document.getElementById('chat-input');
    const userMessage = chatInput?.value?.trim();

    if (!userMessage || !noteId) return;

    const note = await DB.getNoteById(noteId);
    if (!note) return;

    // Add user message
    this.chatHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    chatInput.value = '';
    this.renderChatMessages();

    // Show typing indicator
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML += `
      <div class="chat-message assistant-message typing-indicator">
        <div class="chat-message-content">...</div>
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteContent: note.analysis?.cleanedInput || note.input?.raw_text || '',
          noteAnalysis: note.analysis,
          chatHistory: this.chatHistory.slice(0, -1),
          userMessage: userMessage,
          mode: this.currentChatMode
        })
      });

      if (!response.ok) throw new Error('Chat API failed');

      const data = await response.json();

      this.chatHistory.push({
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp
      });

      // Save to note
      note.chat = note.chat || { startedAt: new Date().toISOString() };
      note.chat.messages = this.chatHistory;
      note.chat.lastMessageAt = new Date().toISOString();
      note.chatHistory = this.chatHistory;
      await DB.saveNote(note);

      this.renderChatMessages();

      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Chat error:', error);
      this.chatHistory.push({
        role: 'assistant',
        content: "I'm having trouble connecting. Try again in a moment.",
        timestamp: new Date().toISOString()
      });
      this.renderChatMessages();
    }
  },

  /**
   * Capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Format timestamp for detail view
   * @param {Object} timestamps - Timestamps object
   * @returns {string} Formatted timestamp
   */
  formatDetailTimestamp(timestamps) {
    if (!timestamps) return '';

    const parts = [];

    // Day of week
    if (timestamps.day_of_week) {
      parts.push(timestamps.day_of_week);
    }

    // Date
    if (timestamps.input_date) {
      const date = new Date(timestamps.input_date);
      parts.push(date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }));
    }

    // Time and timezone
    if (timestamps.input_time) {
      const tz = timestamps.input_timezone || 'SGT';
      parts.push(`${timestamps.input_time} ${tz.replace('Asia/', '')}`);
    }

    return parts.join(' • ');
  },

  /**
   * Simple markdown to HTML renderer
   * @param {string} markdown - Markdown text
   * @returns {string} HTML string
   */
  renderMarkdown(markdown) {
    if (!markdown) return '';

    let html = this.escapeHtml(markdown);

    // Headings (must come before other patterns)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Checkboxes (☐ and ☑)
    html = html.replace(/^☐ (.+)$/gm, '<li>☐ $1</li>');
    html = html.replace(/^☑ (.+)$/gm, '<li>☑ $1</li>');

    // Bullet points
    html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Paragraphs (lines with content not already in tags)
    html = html.replace(/^(?!<[huplo]|<li|<hr)(.+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Fix newlines
    html = html.replace(/\n/g, '');

    return html;
  },

  /**
   * Copy note to clipboard
   */
  async copyNoteToClipboard() {
    if (!this.currentNote) return;

    const text = this.currentNote.refined?.formatted_output || '';

    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied!');
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showToast('Failed to copy');
    }
  },

  /**
   * Export note as JSON file
   */
  exportNoteAsJson() {
    if (!this.currentNote) return;

    const json = JSON.stringify(this.currentNote, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `inscript-${this.currentNote.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Exported!');
  },

  /**
   * Show delete confirmation dialog
   */
  showDeleteDialog() {
    document.getElementById('delete-dialog').classList.remove('hidden');
  },

  /**
   * Hide delete confirmation dialog
   */
  hideDeleteDialog() {
    document.getElementById('delete-dialog').classList.add('hidden');
  },

  /**
   * Confirm and delete the note
   * Phase 8.7: Fixed to use Sync.deleteNote for cloud persistence
   */
  async confirmDeleteNote() {
    if (!this.currentNote) return;

    try {
      // Phase 8.7: Use Sync.deleteNote to delete from cloud AND local
      // This prevents deleted notes from reappearing after re-login
      if (typeof Sync !== 'undefined' && Sync.deleteNote) {
        await Sync.deleteNote(this.currentNote.id);
      } else {
        // Fallback to local-only delete if Sync not available
        await DB.deleteNote(this.currentNote.id);
      }
      this.hideDeleteDialog();
      this.closeNoteDetail();
      this.loadNotes();
      this.showToast('Note deleted');
    } catch (error) {
      console.error('Failed to delete note:', error);
      this.showToast('Failed to delete');
    }
  },

  /**
   * Set up settings screen event handlers
   */
  setupSettings() {
    // Export All button
    const exportAllBtn = document.getElementById('export-all-btn');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => this.exportAllNotes());
    }

    // Clear Data button
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => this.showClearDataDialog());
    }

    // Clear Data dialog buttons
    const clearCancelBtn = document.getElementById('clear-data-cancel');
    const clearConfirmBtn = document.getElementById('clear-data-confirm');

    if (clearCancelBtn) {
      clearCancelBtn.addEventListener('click', () => this.hideClearDataDialog());
    }

    if (clearConfirmBtn) {
      clearConfirmBtn.addEventListener('click', () => this.confirmClearAllData());
    }

    // Sign In button
    const signInBtn = document.getElementById('sign-in-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => this.showAuthModal('signin'));
    }

    // Sign Up link
    const signUpLink = document.getElementById('sign-up-link');
    if (signUpLink) {
      signUpLink.addEventListener('click', () => this.showAuthModal('signup'));
    }

    // Sign Out button
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this.handleSignOut());
    }

    // Change PIN button
    const changePinBtn = document.getElementById('change-pin-btn');
    if (changePinBtn) {
      changePinBtn.addEventListener('click', () => this.handleChangePIN());
    }

    // Setup auth modal
    this.setupAuthModal();

    // Update auth UI state
    this.updateAuthUI();
  },

  /**
   * Update auth-related UI elements
   */
  updateAuthUI() {
    const emailEl = document.getElementById('account-email');
    const signInBtn = document.getElementById('sign-in-btn');
    const signUpLink = document.getElementById('sign-up-link');
    const authLink = document.querySelector('.settings-auth-link');
    const signOutBtn = document.getElementById('sign-out-btn');
    const authButtons = document.getElementById('auth-buttons');

    if (typeof Sync !== 'undefined' && Sync.isAuthenticated()) {
      if (emailEl) emailEl.textContent = Sync.getUserEmail();
      if (signInBtn) signInBtn.classList.add('hidden');
      if (authLink) authLink.classList.add('hidden');
      if (signOutBtn) signOutBtn.classList.remove('hidden');
    } else {
      if (emailEl) emailEl.textContent = 'Not signed in';
      if (signInBtn) signInBtn.classList.remove('hidden');
      if (authLink) authLink.classList.remove('hidden');
      if (signOutBtn) signOutBtn.classList.add('hidden');
    }
  },

  /**
   * Show auth modal
   * @param {string} mode - 'signin' or 'signup' (default: 'signin')
   */
  showAuthModal(mode = 'signin') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    // Reset forms
    this.resetAuthForms();

    // Show requested form
    if (mode === 'signup') {
      document.getElementById('auth-signin').classList.add('hidden');
      document.getElementById('auth-signup').classList.remove('hidden');
    } else {
      document.getElementById('auth-signin').classList.remove('hidden');
      document.getElementById('auth-signup').classList.add('hidden');
    }

    // Show modal
    modal.classList.remove('hidden');

    // Focus email input
    setTimeout(() => {
      const emailInput = mode === 'signup'
        ? document.getElementById('signup-email')
        : document.getElementById('signin-email');
      emailInput?.focus();
    }, 100);
  },

  /**
   * Hide auth modal
   */
  hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      this.resetAuthForms();
    }
  },

  /**
   * Reset auth forms
   */
  resetAuthForms() {
    // Clear sign-in form
    const signinEmail = document.getElementById('signin-email');
    const signinPassword = document.getElementById('signin-password');
    const signinError = document.getElementById('signin-error');
    if (signinEmail) signinEmail.value = '';
    if (signinPassword) signinPassword.value = '';
    if (signinError) {
      signinError.textContent = '';
      signinError.classList.add('hidden');
    }

    // Clear sign-up form
    const signupEmail = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    const signupConfirm = document.getElementById('signup-confirm');
    const signupError = document.getElementById('signup-error');
    if (signupEmail) signupEmail.value = '';
    if (signupPassword) signupPassword.value = '';
    if (signupConfirm) signupConfirm.value = '';
    if (signupError) {
      signupError.textContent = '';
      signupError.classList.add('hidden');
    }

    // Re-enable buttons
    const signinSubmit = document.getElementById('signin-submit');
    const signupSubmit = document.getElementById('signup-submit');
    if (signinSubmit) signinSubmit.disabled = false;
    if (signupSubmit) signupSubmit.disabled = false;
  },

  /**
   * Setup auth modal event handlers
   */
  setupAuthModal() {
    // Close button
    const closeBtn = document.getElementById('auth-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideAuthModal());
    }

    // Switch to sign-up
    const showSignup = document.getElementById('show-signup');
    if (showSignup) {
      showSignup.addEventListener('click', () => {
        document.getElementById('auth-signin').classList.add('hidden');
        document.getElementById('auth-signup').classList.remove('hidden');
        document.getElementById('signup-email')?.focus();
      });
    }

    // Switch to sign-in
    const showSignin = document.getElementById('show-signin');
    if (showSignin) {
      showSignin.addEventListener('click', () => {
        document.getElementById('auth-signup').classList.add('hidden');
        document.getElementById('auth-signin').classList.remove('hidden');
        document.getElementById('signin-email')?.focus();
      });
    }

    // Sign-in form submit
    const signinSubmit = document.getElementById('signin-submit');
    if (signinSubmit) {
      signinSubmit.addEventListener('click', () => this.handleSignIn());
    }

    // Sign-up form submit
    const signupSubmit = document.getElementById('signup-submit');
    if (signupSubmit) {
      signupSubmit.addEventListener('click', () => this.handleSignUp());
    }

    // Enter key handling for sign-in
    const signinPassword = document.getElementById('signin-password');
    if (signinPassword) {
      signinPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSignIn();
      });
    }

    // Enter key handling for sign-up
    const signupConfirm = document.getElementById('signup-confirm');
    if (signupConfirm) {
      signupConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSignUp();
      });
    }
  },

  /**
   * Handle sign-in form submission
   */
  async handleSignIn() {
    const emailInput = document.getElementById('signin-email');
    const passwordInput = document.getElementById('signin-password');
    const errorEl = document.getElementById('signin-error');
    const submitBtn = document.getElementById('signin-submit');

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    // Validation
    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent = 'Please enter email and password';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Disable button
    if (submitBtn) submitBtn.disabled = true;

    try {
      await Sync.signIn(email, password);

      // Initialize sync after successful sign-in
      await Sync.init();

      this.hideAuthModal();
      this.updateAuthUI();
      this.showToast('Signed in successfully');
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Sign in failed';
        errorEl.classList.remove('hidden');
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  /**
   * Handle sign-up form submission
   */
  async handleSignUp() {
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm');
    const errorEl = document.getElementById('signup-error');
    const submitBtn = document.getElementById('signup-submit');

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const confirm = confirmInput?.value;

    // Validation
    if (!email || !password || !confirm) {
      if (errorEl) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (password.length < 6) {
      if (errorEl) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (password !== confirm) {
      if (errorEl) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Disable button
    if (submitBtn) submitBtn.disabled = true;

    try {
      await Sync.signUp(email, password);

      this.hideAuthModal();
      this.showToast('Account created! Check email to confirm.');
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Sign up failed';
        errorEl.classList.remove('hidden');
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  /**
   * Show sign in prompt (legacy - now opens modal)
   */
  showSignInPrompt() {
    this.showAuthModal();
  },

  /**
   * Handle sign out
   */
  async handleSignOut() {
    const confirmed = confirm('Sign out of cloud sync?');
    if (confirmed && typeof Sync !== 'undefined') {
      await Sync.signOut();
      this.updateAuthUI();
      this.showToast('Signed out');
    }
  },

  /**
   * Show clear data confirmation dialog with "type DELETE" requirement
   */
  showClearDataDialog() {
    // Remove existing modal if any
    const existingModal = document.getElementById('delete-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'delete-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-title">Delete All My Data</div>
        <div class="modal-message">
          This will permanently delete ALL your data including notes, entities,
          and everything the Twin has learned. Your account will remain but the
          Twin will start fresh. This cannot be undone.
        </div>
        <div class="modal-input-label">Type DELETE to confirm:</div>
        <input type="text" id="delete-confirm-input" class="modal-input" placeholder="DELETE" autocomplete="off" spellcheck="false">
        <div class="modal-buttons">
          <button class="modal-btn cancel" id="modal-cancel-btn">Cancel</button>
          <button class="modal-btn danger" id="confirm-delete-btn" disabled>
            Delete Everything
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('delete-confirm-input');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    // Enable button only when "DELETE" is typed
    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value !== 'DELETE';
    });

    // Cancel button closes modal
    cancelBtn.addEventListener('click', () => this.hideClearDataDialog());

    // Confirm button executes clear
    confirmBtn.addEventListener('click', () => this.confirmClearAllData());

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hideClearDataDialog();
    });

    input.focus();
  },

  /**
   * Hide clear data confirmation dialog
   */
  hideClearDataDialog() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.remove();
    // Also hide the old dialog if it exists
    const oldDialog = document.getElementById('clear-data-dialog');
    if (oldDialog) oldDialog.classList.add('hidden');
  },

  /**
   * Phase 4.6.2: Robust delete ALL data - local AND cloud
   * With proper timeouts and error handling
   */
  async confirmClearAllData() {
    this.hideClearDataDialog();

    // Show deleting overlay
    this.showDeletingOverlay();

    const errors = [];

    try {
      // Step 1: Try to delete from Supabase (with timeout)
      console.log('Step 1: Deleting cloud data...');

      try {
        await Promise.race([
          this.deleteCloudData(),
          this.deleteTimeout(10000, 'Cloud delete timeout')
        ]);
        console.log('Cloud data deleted');
      } catch (cloudError) {
        console.warn('Cloud delete failed (continuing):', cloudError);
        errors.push('Cloud: ' + cloudError.message);
      }

      // Step 2: Clear IndexedDB
      console.log('Step 2: Clearing IndexedDB...');

      try {
        await Promise.race([
          this.clearIndexedDB(),
          this.deleteTimeout(5000, 'IndexedDB timeout')
        ]);
        console.log('IndexedDB cleared');
      } catch (dbError) {
        console.warn('IndexedDB clear failed (continuing):', dbError);
        errors.push('IndexedDB: ' + dbError.message);
      }

      // Step 3: Clear storage
      console.log('Step 3: Clearing storage...');

      try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('Storage cleared');
      } catch (storageError) {
        console.warn('Storage clear failed:', storageError);
        errors.push('Storage: ' + storageError.message);
      }

      // Step 4: Clear caches
      console.log('Step 4: Clearing caches...');

      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('Caches cleared');
        }
      } catch (cacheError) {
        console.warn('Cache clear failed:', cacheError);
        errors.push('Cache: ' + cacheError.message);
      }

      // Step 5: Unregister service worker
      console.log('Step 5: Unregistering service worker...');

      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
          console.log('Service worker unregistered');
        }
      } catch (swError) {
        console.warn('SW unregister failed:', swError);
        errors.push('ServiceWorker: ' + swError.message);
      }

      // Done
      console.log('Delete complete. Errors:', errors);

      this.hideDeletingOverlay();

      if (errors.length > 0) {
        alert('Data deleted with some warnings.\n\nThe app will now reload.');
      } else {
        alert('All data deleted successfully.');
      }

      // Reload
      window.location.href = window.location.origin + '?cleared=' + Date.now();

    } catch (error) {
      console.error('Delete failed:', error);
      this.hideDeletingOverlay();
      alert('Delete failed: ' + error.message + '\n\nPlease try again.');
    }
  },

  /**
   * Timeout helper for delete operations
   */
  deleteTimeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message || 'Timeout')), ms);
    });
  },

  /**
   * Delete cloud data from Supabase
   */
  async deleteCloudData() {
    // Check if Sync module exists with supabase client
    if (typeof Sync === 'undefined' || !Sync.supabase) {
      console.log('No Supabase client found, skipping cloud delete');
      return;
    }

    // Get current user
    const { data: { user } } = await Sync.supabase.auth.getUser();

    if (!user) {
      console.log('No user logged in, skipping cloud delete');
      return;
    }

    console.log('Deleting data for user:', user.id);

    // Delete from tables in order (to respect foreign keys)
    // Includes all user data tables for complete reset
    const tables = [
      'note_embeddings',
      'suggestions',
      'relationships',
      'quality_learning',
      'output_feedback',
      'entity_corrections',
      'nudge_effectiveness',
      'action_signals',
      'entities',
      'decisions',
      'sync_state',
      'notes',
      'user_profiles',
      'twin_profiles'
    ];

    for (const table of tables) {
      try {
        const { error } = await Sync.supabase
          .from(table)
          .delete()
          .eq('user_id', user.id);

        if (error) {
          console.warn(`Failed to delete from ${table}:`, error.message);
        } else {
          console.log(`Deleted from ${table}`);
        }
      } catch (e) {
        console.warn(`Error deleting from ${table}:`, e);
      }
    }
  },

  /**
   * Clear all IndexedDB databases
   */
  async clearIndexedDB() {
    // Method 1: Use indexedDB.databases() if available
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();

      for (const db of databases) {
        if (db.name) {
          await new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = () => {
              console.log('Deleted DB:', db.name);
              resolve();
            };
            req.onerror = () => {
              console.warn('Failed to delete DB:', db.name);
              resolve(); // Continue anyway
            };
            req.onblocked = () => {
              console.warn('DB delete blocked:', db.name);
              resolve(); // Continue anyway
            };
          });
        }
      }
    }

    // Method 2: Try known database names
    const knownDatabases = ['digital-twin', 'digital-twin-db', 'dt-db', 'notes-db'];

    for (const dbName of knownDatabases) {
      try {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase(dbName);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      } catch (e) {
        // Ignore
      }
    }

    // Method 3: Clear via DB class if available
    if (typeof DB !== 'undefined') {
      try {
        if (DB.clearAllNotes) await DB.clearAllNotes();
        if (DB.deleteTwinProfile) await DB.deleteTwinProfile();
      } catch (e) {
        console.warn('DB.clear failed:', e);
      }
    }
  },

  /**
   * Show deleting overlay
   */
  showDeletingOverlay() {
    // Remove existing
    this.hideDeletingOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'deleting-overlay';
    overlay.className = 'deleting-overlay';
    overlay.innerHTML = `
      <div class="deleting-content">
        <div class="deleting-spinner"></div>
        <span class="deleting-text">Deleting...</span>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  /**
   * Hide deleting overlay
   */
  hideDeletingOverlay() {
    const overlay = document.getElementById('deleting-overlay');
    if (overlay) overlay.remove();
  },

  /**
   * Export all notes as JSON backup file
   */
  async exportAllNotes() {
    try {
      const jsonString = await DB.exportAllNotes();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Generate filename with date
      const date = new Date().toISOString().slice(0, 10);
      const filename = `inscript-backup-${date}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('Backup exported!');
    } catch (error) {
      console.error('Failed to export:', error);
      this.showToast('Failed to export');
    }
  },

  /**
   * Show processing overlay with spinner
   * @param {string} message - Message to display
   */
  showProcessing(message = 'Processing...') {
    let overlay = document.getElementById('processing-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'processing-overlay';
      overlay.className = 'processing-overlay';
      overlay.innerHTML = `
        <div class="processing-spinner"></div>
        <p class="processing-text">${message}</p>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.processing-text').textContent = message;
      overlay.classList.remove('hidden');
    }
  },

  /**
   * Hide processing overlay
   */
  hideProcessing() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  },

  // ============================================
  // Camera Bottom Sheet (Phase 4.2)
  // ============================================

  /**
   * Pending image for notes capture
   */
  pendingImage: null,

  /**
   * Show camera options bottom sheet
   */
  showCameraOptions() {
    const sheet = document.createElement('div');
    sheet.className = 'camera-sheet';
    sheet.innerHTML = `
      <div class="camera-sheet-overlay" onclick="UI.closeCameraSheet()"></div>
      <div class="camera-sheet-content">
        <div class="drag-handle"></div>
        <button class="camera-option" onclick="UI.takePhoto()">
          <span>📷</span> Take Photo
        </button>
        <button class="camera-option" onclick="UI.chooseFromLibrary()">
          <span>🖼️</span> Photo Library
        </button>
        <button class="camera-option" onclick="UI.chooseFile()">
          <span>📁</span> Choose File
        </button>
        <button class="camera-option cancel" onclick="UI.closeCameraSheet()">
          Cancel
        </button>
      </div>
    `;
    document.body.appendChild(sheet);

    // Trigger animation
    requestAnimationFrame(() => {
      sheet.classList.add('open');
    });
  },

  /**
   * Close camera sheet
   */
  closeCameraSheet() {
    const sheet = document.querySelector('.camera-sheet');
    if (sheet) {
      sheet.classList.remove('open');
      setTimeout(() => sheet.remove(), 300);
    }
  },

  /**
   * Take photo with camera (front camera for selfie)
   */
  takePhoto() {
    this.closeCameraSheet();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'user'; // 'user' for front camera, 'environment' for back
    input.onchange = (e) => this.handleCameraImageSelected(e);
    input.click();
  },

  /**
   * Choose from photo library
   */
  chooseFromLibrary() {
    this.closeCameraSheet();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.handleCameraImageSelected(e);
    input.click();
  },

  /**
   * Choose any file
   */
  chooseFile() {
    this.closeCameraSheet();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.onchange = (e) => this.handleCameraImageSelected(e);
    input.click();
  },

  /**
   * Phase 4.5.6: Handle image selection with extensive debugging
   */
  async handleCameraImageSelected(event) {
    console.log('=== IMAGE CAPTURE START ===');
    const file = event.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Processing file:', file.name, file.size, 'bytes');

    try {
      // Read file as data URL
      const rawData = await this.readFileAsDataURL(file);
      console.log('File read complete, length:', rawData?.length);

      if (!rawData) {
        console.error('No data from file read');
        return;
      }

      // Compress
      console.log('Compressing image...');
      const compressed = await this.compressImage(rawData);
      console.log('Compression complete, length:', compressed?.length);

      if (!compressed) {
        console.error('Compression returned null');
        return;
      }

      // Store and show preview
      this.pendingImageData = compressed;
      window.pendingImageData = compressed;

      console.log('Showing preview...');
      this.showImagePreviewFromDataUrl(compressed);
      console.log('=== IMAGE CAPTURE COMPLETE ===');

    } catch (err) {
      console.error('Image capture failed:', err);
      this.showToast('Could not load image');
    }
  },

  /**
   * Phase 4.5.6: Read file as data URL
   */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('FileReader onload fired');
        resolve(e.target.result);
      };
      reader.onerror = (e) => {
        console.error('FileReader error:', e);
        reject(e);
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Phase 4.5.7: Load image with retry logic
   * @param {string} src - Image source
   * @param {number} maxRetries - Max retry attempts
   * @returns {Promise<HTMLImageElement>} Loaded image element
   */
  async loadImageWithRetry(src, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Image load attempt ${attempt}/${maxRetries}`);

        const result = await new Promise((resolve, reject) => {
          const img = new Image();

          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 3000);

          img.onload = () => {
            clearTimeout(timeout);
            resolve(img);
          };

          img.onerror = (e) => {
            clearTimeout(timeout);
            reject(new Error('Image load failed'));
          };

          img.src = src;
        });

        console.log('Image loaded successfully');
        return result;

      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry
        await new Promise(r => setTimeout(r, 500));
      }
    }
  },

  /**
   * Phase 4.5.7: Compress image with retry logic
   * @param {string} dataUrl - Image data URL
   * @returns {Promise<string>} Compressed data URL
   */
  async compressImage(dataUrl) {
    try {
      // Try to load image with retry
      const img = await this.loadImageWithRetry(dataUrl, 2);

      const maxSize = 1200;
      let width = img.width;
      let height = img.height;

      console.log('Original dimensions:', width, 'x', height);

      // Only resize if larger
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        console.log('Resized to:', width, 'x', height);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', 0.7);

      console.log('Compression result:', {
        original: dataUrl.length,
        compressed: compressed.length,
        reduction: Math.round((1 - compressed.length / dataUrl.length) * 100) + '%'
      });

      return compressed;

    } catch (error) {
      console.error('Compression failed, using original:', error);
      return dataUrl;
    }
  },

  /**
   * Phase 4.5.7: Show image preview with X button ON thumbnail corner
   * @param {string} dataUrl - Image data URL
   */
  showImagePreviewFromDataUrl(dataUrl) {
    console.log('showImagePreviewFromDataUrl called');

    if (!dataUrl) {
      console.error('No image data to preview');
      return false;
    }

    // Store globally
    window.pendingImageData = dataUrl;
    this.pendingImageData = dataUrl;

    let preview = document.getElementById('notes-image-preview');

    // Create preview container if it doesn't exist
    if (!preview) {
      const captureRow = document.querySelector('.notes-capture-row');
      if (captureRow) {
        preview = document.createElement('div');
        preview.id = 'notes-image-preview';
        preview.className = 'notes-image-preview';
        captureRow.parentNode.insertBefore(preview, captureRow);
        console.log('Created preview container');
      }
    }

    if (preview) {
      // Phase 4.5.7: Show loading state first
      preview.innerHTML = `
        <div class="preview-thumb loading">
          <div class="preview-loading"></div>
        </div>
      `;
      preview.style.display = 'flex';

      // Then load the actual image
      const img = new Image();
      img.onload = () => {
        console.log('Preview image loaded');
        // Phase 4.5.7: X button INSIDE thumbnail wrapper, positioned absolute on corner
        preview.innerHTML = `
          <div class="preview-thumb">
            <img src="${dataUrl}" alt="Preview">
            <button class="preview-remove" onclick="UI.removeImagePreview()" aria-label="Remove">×</button>
          </div>
        `;
      };
      img.onerror = () => {
        console.error('Preview image failed to load');
        preview.innerHTML = `
          <div class="preview-thumb error">
            <span>!</span>
            <button class="preview-remove" onclick="UI.removeImagePreview()" aria-label="Remove">×</button>
          </div>
        `;
      };
      img.src = dataUrl;

    } else {
      console.error('Could not find or create preview container');
      return false;
    }

    // Focus input for caption
    const input = document.getElementById('notes-quick-input');
    if (input) {
      input.placeholder = 'Add a caption...';
      input.focus();
    }

    return true;
  },

  /**
   * Show image preview near input bar (legacy)
   */
  showImagePreview(file) {
    const preview = document.getElementById('notes-image-preview');
    if (!preview) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <div class="preview-thumbnail">
          <img src="${e.target.result}" alt="Preview">
          <button class="remove-image" onclick="UI.removeImagePreview()">×</button>
        </div>
      `;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  },

  /**
   * Phase 4.5.4: Remove image preview with proper cleanup
   */
  removeImagePreview() {
    console.log('removeImagePreview called');

    const preview = document.getElementById('notes-image-preview');
    if (preview) {
      preview.style.display = 'none';
      const img = preview.querySelector('img');
      if (img) img.src = '';
    }

    this.pendingImage = null;
    this.pendingImageData = null;
    window.pendingImageData = null;

    // Reset input placeholder
    const input = document.getElementById('notes-quick-input');
    if (input) {
      input.placeholder = "What's on your mind?";
    }
  },

  /**
   * Phase 4.5.4: Show processing overlay
   * @param {string} message - Message to display
   */
  showProcessingOverlay(message) {
    // Remove existing overlay if any
    this.hideProcessingOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'processing-overlay';
    overlay.className = 'processing-overlay';
    overlay.innerHTML = `
      <div class="processing-content">
        <div class="processing-spinner"></div>
        <span class="processing-text">${message}</span>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  /**
   * Phase 4.5.4: Hide processing overlay
   */
  hideProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.remove();
  },

  // ============================================
  // Phase 8: Entity Editor Modal
  // ============================================

  /**
   * Open entity editor modal
   * @param {string} entityId - Entity UUID
   */
  async openEntityEditor(entityId) {
    if (typeof EntityMemory === 'undefined') {
      console.error('[UI] EntityMemory not available');
      return;
    }

    const entity = await EntityMemory.getEntity(entityId);
    if (!entity) {
      this.showToast('Entity not found');
      return;
    }

    // Remove existing modal
    this.closeEntityEditor();

    const modal = document.createElement('div');
    modal.id = 'entity-editor-modal';
    modal.className = 'modal entity-editor-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="UI.closeEntityEditor()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Entity</h3>
          <button class="close-btn" onclick="UI.closeEntityEditor()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Name</label>
            <input type="text" id="entity-name" value="${this.escapeHtml(entity.name || '')}">
          </div>
          <div class="field">
            <label>Type</label>
            <select id="entity-type">
              <option value="person" ${entity.type === 'person' ? 'selected' : ''}>Person</option>
              <option value="pet" ${entity.type === 'pet' ? 'selected' : ''}>Pet</option>
              <option value="place" ${entity.type === 'place' ? 'selected' : ''}>Place</option>
              <option value="project" ${entity.type === 'project' ? 'selected' : ''}>Project</option>
              <option value="company" ${entity.type === 'company' ? 'selected' : ''}>Company</option>
              <option value="other" ${entity.type === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="field">
            <label>Relationship to You</label>
            <input type="text" id="entity-relationship"
              value="${this.escapeHtml(entity.relationship_to_user || '')}"
              placeholder="e.g., my co-founder, my dog, client">
          </div>
          <div class="field">
            <label>Details</label>
            <textarea id="entity-details" placeholder="Any other details...">${this.escapeHtml(entity.details || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-danger" onclick="UI.deleteEntity('${entityId}')">Delete</button>
          <button class="btn-secondary" onclick="UI.closeEntityEditor()">Cancel</button>
          <button class="btn-primary" onclick="UI.saveEntity('${entityId}')">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus name input
    setTimeout(() => {
      document.getElementById('entity-name')?.focus();
    }, 100);
  },

  /**
   * Save entity changes
   * @param {string} entityId - Entity UUID
   */
  async saveEntity(entityId) {
    const updates = {
      name: document.getElementById('entity-name')?.value || '',
      type: document.getElementById('entity-type')?.value || 'person',
      relationship_to_user: document.getElementById('entity-relationship')?.value || '',
      details: document.getElementById('entity-details')?.value || ''
    };

    if (!updates.name.trim()) {
      this.showToast('Name is required');
      return;
    }

    const result = await EntityMemory.updateEntity(entityId, updates);

    if (result) {
      this.showToast('Entity updated');
      this.closeEntityEditor();
      // Refresh current note if displayed
      if (this.currentNote) {
        await this.refreshNoteDetail(this.currentNote.id);
      }
    } else {
      this.showToast('Update failed');
    }
  },

  /**
   * Delete an entity
   * @param {string} entityId - Entity UUID
   */
  async deleteEntity(entityId) {
    if (!confirm('Delete this entity? This cannot be undone.')) {
      return;
    }

    await EntityMemory.deleteEntity(entityId);
    this.showToast('Entity deleted');
    this.closeEntityEditor();

    // Refresh current note if displayed
    if (this.currentNote) {
      await this.refreshNoteDetail(this.currentNote.id);
    }
  },

  /**
   * Close entity editor modal
   */
  closeEntityEditor() {
    const modal = document.getElementById('entity-editor-modal');
    if (modal) modal.remove();
  },

  /**
   * Open entity editor by name - looks up entity and opens editor
   * @param {string} name - Entity name to search for
   * @param {string} type - Entity type hint
   */
  async openEntityByName(name, type) {
    if (typeof EntityMemory === 'undefined') {
      this.showToast('Entity system not available');
      return;
    }

    // Search for entity by name in loaded entities
    const entities = EntityMemory._entities || [];
    const entity = entities.find(e =>
      e.name && e.name.toLowerCase() === name.toLowerCase()
    );

    if (entity && entity.id) {
      await this.openEntityEditor(entity.id);
    } else {
      // Entity not in memory - offer to create it
      this.showCreateEntityPrompt(name, type);
    }
  },

  /**
   * Show prompt to create a new entity
   * @param {string} name - Suggested entity name
   * @param {string} type - Suggested entity type
   */
  showCreateEntityPrompt(name, type) {
    const modal = document.createElement('div');
    modal.id = 'entity-create-modal';
    modal.className = 'modal entity-editor-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="UI.closeCreateEntityModal()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Entity</h3>
          <button class="close-btn" onclick="UI.closeCreateEntityModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px; color: var(--text-secondary);">
            "${this.escapeHtml(name)}" isn't saved yet. Would you like to add it?
          </p>
          <div class="field">
            <label>Name</label>
            <input type="text" id="new-entity-name" value="${this.escapeHtml(name)}">
          </div>
          <div class="field">
            <label>Type</label>
            <select id="new-entity-type">
              <option value="person" ${type === 'person' ? 'selected' : ''}>Person</option>
              <option value="pet" ${type === 'pet' ? 'selected' : ''}>Pet</option>
              <option value="place" ${type === 'place' ? 'selected' : ''}>Place</option>
              <option value="project" ${type === 'project' ? 'selected' : ''}>Project</option>
              <option value="company">Company</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <label>Relationship to You</label>
            <input type="text" id="new-entity-relationship" placeholder="e.g., my co-founder, my dog">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="UI.closeCreateEntityModal()">Cancel</button>
          <button class="btn-primary" onclick="UI.createEntity()">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /**
   * Create a new entity from the create modal
   */
  async createEntity() {
    const name = document.getElementById('new-entity-name')?.value?.trim();
    const type = document.getElementById('new-entity-type')?.value || 'person';
    const relationship = document.getElementById('new-entity-relationship')?.value?.trim();

    if (!name) {
      this.showToast('Name is required');
      return;
    }

    if (typeof EntityMemory !== 'undefined' && EntityMemory.createSingleEntity) {
      // Use the dedicated method for UI-created entities
      const success = await EntityMemory.createSingleEntity({
        name: name,
        type: type,
        relationship_to_user: relationship
      });

      if (success) {
        this.showToast('Entity saved');
        this.closeCreateEntityModal();
        // Refresh the note detail to show updated entity
        if (this.currentNoteId) {
          await this.showNoteDetail(this.currentNoteId);
        }
      } else {
        this.showToast('Failed to save entity');
      }
    } else {
      this.showToast('Could not save entity');
    }
  },

  /**
   * Close create entity modal
   */
  closeCreateEntityModal() {
    const modal = document.getElementById('entity-create-modal');
    if (modal) modal.remove();
  },

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Refresh note detail view
   * @param {string} noteId - Note ID
   */
  async refreshNoteDetail(noteId) {
    const note = await DB.getNoteById(noteId);
    if (note) {
      this.currentNote = note;
      this.renderNoteDetail(note);
    }
  },

  /**
   * Sign out and show auth screen
   */
  async lockApp() {
    console.log('[UI] Signing out...');

    if (typeof Auth !== 'undefined') {
      await Auth.signOut();
    }

    console.log('[UI] Signed out');
  }
};

// Phase 10.9: Delegation to modular components for backward compatibility
// Chat delegations
UI.openChatBottomSheet = function(noteId) { return ChatUI.open(noteId); };
UI.closeChatBottomSheet = function() { return ChatUI.close(); };

// Camera delegations
UI.showCameraOptions = function() { return CameraUI.showOptions(); };
UI.closeCameraSheet = function() { return CameraUI.closeSheet(); };
UI.takePhoto = function() { return CameraUI.takePhoto(); };
UI.chooseFromLibrary = function() { return CameraUI.chooseFromLibrary(); };
UI.chooseFile = function() { return CameraUI.chooseFile(); };
UI.handleCameraImageSelected = function(e) { return CameraUI.handleImageSelected(e); };
UI.showImagePreviewFromDataUrl = function(url) { return CameraUI.showPreview(url); };
UI.removeImagePreview = function() { return CameraUI.removePreview(); };

// Entity delegations
UI.openEntityEditor = function(id) { return EntityUI.openEditor(id); };
UI.closeEntityEditor = function() { return EntityUI.closeEditor(); };
UI.openEntityByName = function(name, type) { return EntityUI.openByName(name, type); };
UI.showCreateEntityPrompt = function(name, type) { return EntityUI.showCreatePrompt(name, type); };
UI.createEntity = function() { return EntityUI.create(); };
UI.closeCreateEntityModal = function() { return EntityUI.closeCreateModal(); };
UI.saveEntity = function(id) { return EntityUI.save(id); };
UI.deleteEntity = function(id) { return EntityUI.delete(id); };

// Export for global access
window.UI = UI;

// Phase 6.0.6: Global overlay functions - mobile-optimized with spinner
window.showProcessingOverlay = function(message) {
  console.log('[Overlay] Show:', message);

  window.hideProcessingOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'processing-overlay';
  overlay.className = 'processing-overlay';

  // Phase 6.0.6: Full-screen overlay with spinner - works on mobile
  overlay.innerHTML = `
    <div class="processing-content">
      <div class="processing-spinner"></div>
      <span class="processing-text">${message || 'sitting with this...'}</span>
    </div>
  `;

  // Prevent touch scrolling while overlay is visible
  overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  document.body.appendChild(overlay);
  console.log('[Overlay] Added to DOM');
};

window.updateProcessingOverlay = function(message) {
  const textEl = document.querySelector('#processing-overlay .processing-text');
  if (textEl) {
    textEl.textContent = message;
    console.log('[Overlay] Updated:', message);
  }
};

window.hideProcessingOverlay = function() {
  const overlay = document.getElementById('processing-overlay');
  if (overlay) {
    overlay.remove();
    console.log('[Overlay] Removed');
  }
};

// Phase 5A.5: Tasteful updating overlay - whisper-quiet
window.showUpdatingOverlay = function() {
  window.hideUpdatingOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'updating-overlay';
  overlay.className = 'updating-overlay';
  overlay.innerHTML = `
    <div class="updating-indicator">
      <span class="updating-dot"></span>
      <span class="updating-word">updating</span>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.hideUpdatingOverlay = function() {
  const overlay = document.getElementById('updating-overlay');
  if (overlay) overlay.remove();
};

window.showToast = function(message) {
  console.log('showToast:', message);

  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
};
