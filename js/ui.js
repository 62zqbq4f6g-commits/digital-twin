/**
 * Digital Twin - UI Controller
 * Handles navigation and screen management
 */

const UI = {
  // Current active screen
  currentScreen: 'capture',

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

  /**
   * Initialize UI - set up event listeners
   */
  init() {
    this.setupNavigation();
    this.setupTextInput();
    this.setupNotesFilters();
    this.setupNotesSearch();
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
   * Process note through App pipeline
   * @param {string} text - Raw text input
   * @param {string} inputType - 'text' or 'voice'
   */
  async processNote(text, inputType) {
    // Use App.processNote for full pipeline processing
    return await App.processNote(text, inputType);
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

    // Load notes when switching to notes screen
    if (screenName === 'notes') {
      this.loadNotes();
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

    // Show/hide empty state
    if (filteredNotes.length === 0) {
      notesList.innerHTML = '';
      notesList.classList.add('hidden');
      emptyState.classList.remove('hidden');
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
    const time = note.timestamps?.input_time || '';
    const preview = (note.refined?.summary || '').substring(0, 100);

    return `
      <div class="note-card" data-note-id="${note.id}">
        <div class="category-badge">
          <span>${icon}</span>
          <span>${category}</span>
        </div>
        <div class="note-card-header">
          <h4 class="note-card-title">${this.escapeHtml(title)}</h4>
          <span class="note-card-time">${time}</span>
        </div>
        <p class="note-card-preview">${this.escapeHtml(preview)}</p>
      </div>
    `;
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
   * Open note detail view
   * @param {string} noteId - Note ID
   */
  openNoteDetail(noteId) {
    // This will be implemented in DT-012
    console.log('Opening note detail:', noteId);
    // For now, store the selected note ID for DT-012
    this.selectedNoteId = noteId;
  }
};

// Export for global access
window.UI = UI;
