/**
 * Auto-Enhance Module
 * Phase 17 - TASK-016: Automatically enhance personal notes on save
 *
 * Features:
 * - Triggers enhancement automatically after note save
 * - Excludes meetings (handled by meeting flow)
 * - Excludes short notes (< 20 characters)
 * - Excludes already enhanced notes
 * - Shows subtle UI indicators (shimmer during, badge after)
 * - Silent failure - never disrupts user
 */

const AutoEnhance = {
  // Track notes currently being enhanced
  enhancingNotes: new Set(),

  // Version for cache busting
  VERSION: '1.0.0',

  /**
   * Initialize auto-enhance module
   */
  init() {
    // Listen for note-saved events
    window.addEventListener('note-saved', (e) => {
      const noteId = e.detail?.noteId;
      if (noteId) {
        this.handleNoteSaved(noteId);
      }
    });

    console.log('[AutoEnhance] Initialized v' + this.VERSION);
  },

  /**
   * Handle note-saved event
   * @param {string} noteId - The saved note's ID
   */
  async handleNoteSaved(noteId) {
    try {
      // Get the note
      const note = await DB.getNoteById(noteId);
      if (!note) {
        console.warn('[AutoEnhance] Note not found:', noteId);
        return;
      }

      // Check if should auto-enhance
      if (!this.shouldAutoEnhance(note)) {
        console.log('[AutoEnhance] Skipping enhancement for:', noteId);
        return;
      }

      // Trigger enhancement
      console.log('[AutoEnhance] Triggering enhancement for:', noteId);
      this.triggerEnhancement(note);

    } catch (error) {
      console.error('[AutoEnhance] Error handling note:', error);
      // Silent fail - don't disrupt user
    }
  },

  /**
   * Check if a note should be auto-enhanced
   * @param {Object} note - The note object
   * @returns {boolean} - Whether to enhance
   */
  shouldAutoEnhance(note) {
    // 1. Don't enhance meetings (handled by meeting flow)
    if (note.input?.type === 'meeting') {
      console.log('[AutoEnhance] Skipping: meeting type');
      return false;
    }

    // 2. Don't enhance very short notes
    const content = note.input?.raw_text || note.input?.text || note.content || '';
    if (content.length < 20) {
      console.log('[AutoEnhance] Skipping: too short (' + content.length + ' chars)');
      return false;
    }

    // 3. Don't re-enhance
    if (note.auto_enhanced || note.enhancement_metadata?.enhanced) {
      console.log('[AutoEnhance] Skipping: already enhanced');
      return false;
    }

    // 4. Don't enhance if already in progress
    if (this.enhancingNotes.has(note.id)) {
      console.log('[AutoEnhance] Skipping: already enhancing');
      return false;
    }

    return true;
  },

  /**
   * Trigger enhancement for a note
   * @param {Object} note - The note object
   */
  async triggerEnhancement(note) {
    const noteId = note.id;

    // Mark as enhancing
    this.enhancingNotes.add(noteId);

    // Show enhancing indicator
    this.showEnhancingIndicator(noteId);

    try {
      // Get user ID
      const userId = Sync?.user?.id || 'anonymous';

      // Prepare content
      const content = note.input?.raw_text || note.input?.text || note.content || '';
      const noteType = note.classification?.category || 'note';

      console.log('[AutoEnhance] Calling API for:', noteId);

      // Call enhance-note API
      const response = await fetch('/api/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: noteId,
          content: content,
          noteType: noteType,
          userId: userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Enhancement API failed: ' + response.status);
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let enhancedContent = '';
      let threads = [];
      let reflectQuestion = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'content') {
                enhancedContent += data.text;
              } else if (data.type === 'threads') {
                threads = data.items || [];
              } else if (data.type === 'reflect') {
                reflectQuestion = data.question;
              } else if (data.type === 'done') {
                console.log('[AutoEnhance] Enhancement complete:', data.processingTime + 'ms');
              } else if (data.type === 'error') {
                throw new Error(data.error?.message || 'Enhancement failed');
              }
            } catch (parseError) {
              // Skip malformed JSON
            }
          }
        }
      }

      // Update local note with enhancement
      await this.updateLocalNote(noteId, enhancedContent, threads, reflectQuestion);

      // Show enhanced indicator
      this.showEnhancedIndicator(noteId);

    } catch (error) {
      console.error('[AutoEnhance] Enhancement failed:', error);
      // Silent fail - hide indicator, don't show error
      this.hideEnhancingIndicator(noteId);
    } finally {
      // Remove from enhancing set
      this.enhancingNotes.delete(noteId);
    }
  },

  /**
   * Update local note with enhanced content
   * @param {string} noteId - Note ID
   * @param {string} enhancedContent - Enhanced content from API
   * @param {Array} threads - Thread connections
   * @param {string|null} reflectQuestion - Reflection question
   */
  async updateLocalNote(noteId, enhancedContent, threads, reflectQuestion) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note) return;

      // Parse enhanced content to separate main content from THREADS/REFLECT
      const mainContent = this.extractMainContent(enhancedContent);

      // Update note with enhancement
      note.enhanced_content = mainContent;
      note.auto_enhanced = true;
      note.enhancement_metadata = {
        enhanced: true,
        enhancedAt: new Date().toISOString(),
        mode: 'personal',
        threads: threads,
        reflectQuestion: reflectQuestion,
      };

      // Save updated note
      await DB.saveNote(note);

      // Refresh note display if viewing this note
      this.refreshNoteDisplay(noteId, note);

      // Trigger sync
      if (typeof Sync !== 'undefined' && Sync.pushPendingChanges) {
        Sync.pushPendingChanges().catch(err => console.warn('[AutoEnhance] Sync error:', err));
      }

      console.log('[AutoEnhance] Note updated with enhancement:', noteId);

    } catch (error) {
      console.error('[AutoEnhance] Failed to update note:', error);
    }
  },

  /**
   * Extract main content (before THREADS/REFLECT sections)
   * @param {string} content - Full enhanced content
   * @returns {string} - Main content only
   */
  extractMainContent(content) {
    if (!content) return '';

    // Find where THREADS or REFLECT starts
    const threadsIndex = content.search(/###?\s*THREADS/i);
    const reflectIndex = content.search(/###?\s*REFLECT/i);

    let endIndex = content.length;
    if (threadsIndex > 0) endIndex = Math.min(endIndex, threadsIndex);
    if (reflectIndex > 0) endIndex = Math.min(endIndex, reflectIndex);

    // Remove header if present
    let main = content.slice(0, endIndex).trim();
    main = main.replace(/^###?\s*Enhanced\s*Note\s*/i, '').trim();

    return main;
  },

  /**
   * Refresh note display if currently viewing
   * @param {string} noteId - Note ID
   * @param {Object} note - Updated note
   */
  refreshNoteDisplay(noteId, note) {
    // Check if note detail modal is showing this note
    const detailModal = document.getElementById('note-detail');
    const currentNoteId = detailModal?.dataset?.noteId;

    if (currentNoteId === noteId && typeof UI !== 'undefined' && UI.showNoteDetail) {
      // Refresh the detail view
      UI.showNoteDetail(noteId);
    }

    // Refresh notes list if visible
    if (typeof UI !== 'undefined' && UI.loadNotes) {
      UI.loadNotes();
    }
  },

  /**
   * Show enhancing indicator on note card
   * @param {string} noteId - Note ID
   */
  showEnhancingIndicator(noteId) {
    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    if (card) {
      card.classList.add('enhancing');
    }

    // Also mark in the note list item
    const listItem = document.querySelector(`.note-item[data-id="${noteId}"]`);
    if (listItem) {
      listItem.classList.add('enhancing');
    }
  },

  /**
   * Hide enhancing indicator
   * @param {string} noteId - Note ID
   */
  hideEnhancingIndicator(noteId) {
    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    if (card) {
      card.classList.remove('enhancing');
    }

    const listItem = document.querySelector(`.note-item[data-id="${noteId}"]`);
    if (listItem) {
      listItem.classList.remove('enhancing');
    }
  },

  /**
   * Show enhanced indicator (badge that fades after 3s)
   * @param {string} noteId - Note ID
   */
  showEnhancedIndicator(noteId) {
    // Remove enhancing state
    this.hideEnhancingIndicator(noteId);

    const card = document.querySelector(`[data-note-id="${noteId}"]`);
    if (card) {
      card.classList.add('just-enhanced');

      // Fade out after 3s
      setTimeout(() => {
        card.classList.remove('just-enhanced');
      }, 3000);
    }

    const listItem = document.querySelector(`.note-item[data-id="${noteId}"]`);
    if (listItem) {
      listItem.classList.add('just-enhanced');

      setTimeout(() => {
        listItem.classList.remove('just-enhanced');
      }, 3000);
    }
  },
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AutoEnhance.init());
} else {
  AutoEnhance.init();
}

// Make globally available
window.AutoEnhance = AutoEnhance;
