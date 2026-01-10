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

  // Currently displayed note
  currentNote: null,

  /**
   * Initialize UI - set up event listeners
   */
  init() {
    this.setupNavigation();
    this.setupTextInput();
    this.setupNotesFilters();
    this.setupNotesSearch();
    this.setupNoteDetail();
    this.setupSettings();
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
  },

  /**
   * Open note detail view
   * @param {string} noteId - Note ID
   */
  async openNoteDetail(noteId) {
    try {
      // Get note from database
      const note = await DB.getNoteById(noteId);
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

      // Render formatted output as HTML
      const formattedOutput = note.refined?.formatted_output || '';
      document.getElementById('note-detail-body').innerHTML = this.renderMarkdown(formattedOutput);

      // Show detail screen
      document.getElementById('screen-note-detail').classList.remove('hidden');

    } catch (error) {
      console.error('Failed to open note detail:', error);
      this.showToast('Failed to open note');
    }
  },

  /**
   * Close note detail view
   */
  closeNoteDetail() {
    document.getElementById('screen-note-detail').classList.add('hidden');
    this.currentNote = null;
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
    a.download = `digital-twin-${this.currentNote.id}.json`;
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
   */
  async confirmDeleteNote() {
    if (!this.currentNote) return;

    try {
      await DB.deleteNote(this.currentNote.id);
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
  },

  /**
   * Show clear data confirmation dialog
   */
  showClearDataDialog() {
    document.getElementById('clear-data-dialog').classList.remove('hidden');
  },

  /**
   * Hide clear data confirmation dialog
   */
  hideClearDataDialog() {
    document.getElementById('clear-data-dialog').classList.add('hidden');
  },

  /**
   * Confirm and clear all data
   */
  async confirmClearAllData() {
    try {
      await DB.clearAllNotes();
      this.hideClearDataDialog();
      this.allNotes = [];
      this.showToast('All data cleared');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showToast('Failed to clear data');
    }
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
      const filename = `digital-twin-backup-${date}.json`;

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
  }
};

// Export for global access
window.UI = UI;
