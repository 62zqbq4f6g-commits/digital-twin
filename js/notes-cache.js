/**
 * js/notes-cache.js - Instant Note Loading Cache
 *
 * Implements "stale while revalidate" pattern:
 * 1. Show cached notes IMMEDIATELY (< 100ms)
 * 2. Fetch fresh notes in background
 * 3. Update UI silently if data changed
 *
 * Uses localStorage for synchronous, instant access
 */

const CACHE_KEY = 'inscript_notes_cache';
const CACHE_TIMESTAMP_KEY = 'inscript_notes_cache_ts';
const CACHE_VERSION_KEY = 'inscript_notes_cache_v';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHED_NOTES = 100; // Limit to prevent localStorage bloat

window.NotesCache = {
  /**
   * Get cached notes (synchronous, instant)
   * @returns {Array|null} Cached notes or null if no valid cache
   */
  get() {
    try {
      // Check version
      const version = localStorage.getItem(CACHE_VERSION_KEY);
      if (version !== CACHE_VERSION.toString()) {
        this.clear();
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      const age = Date.now() - parseInt(timestamp || '0');

      // Return null if cache is too old
      if (age > CACHE_MAX_AGE) {
        console.log('[NotesCache] Cache expired, clearing');
        this.clear();
        return null;
      }

      const notes = JSON.parse(cached);
      console.log(`[NotesCache] Retrieved ${notes.length} cached notes (age: ${Math.round(age / 1000)}s)`);
      return notes;
    } catch (e) {
      console.error('[NotesCache] Error reading cache:', e);
      this.clear();
      return null;
    }
  },

  /**
   * Save notes to cache
   * @param {Array} notes - Notes to cache
   */
  set(notes) {
    try {
      if (!Array.isArray(notes)) return;

      // Limit cache size
      const toCache = notes.slice(0, MAX_CACHED_NOTES);

      // Store minimal data for fast loading
      const minimalNotes = toCache.map(note => ({
        id: note.id,
        timestamps: note.timestamps,
        extracted: note.extracted,
        analysis: note.analysis ? {
          title: note.analysis.title,
          summary: note.analysis.summary,
          category: note.analysis.category,
          tier: note.analysis.tier,
          heard: note.analysis.heard,
          noticed: note.analysis.noticed
        } : null,
        input: note.input ? {
          type: note.input.type,
          raw_text: note.input.raw_text?.substring(0, 500) // Limit text size
        } : null,
        classification: note.classification,
        // Meeting metadata (required for meetings tab)
        type: note.type,
        note_type: note.note_type,
        meeting: note.meeting,
        content: note.content?.substring(0, 500),
        enhanced_content: note.enhanced_content?.substring(0, 500)
      }));

      localStorage.setItem(CACHE_KEY, JSON.stringify(minimalNotes));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION.toString());

      console.log(`[NotesCache] Cached ${minimalNotes.length} notes`);
    } catch (e) {
      console.error('[NotesCache] Error writing cache:', e);
      // If quota exceeded, clear and try with fewer notes
      if (e.name === 'QuotaExceededError') {
        this.clear();
        try {
          const reduced = notes.slice(0, 20);
          localStorage.setItem(CACHE_KEY, JSON.stringify(reduced));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
          localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION.toString());
        } catch (e2) {
          console.error('[NotesCache] Still failed after reducing:', e2);
        }
      }
    }
  },

  /**
   * Add a single note to cache (for optimistic updates)
   * @param {Object} note - Note to add
   */
  addNote(note) {
    const notes = this.get() || [];
    // Add to beginning (newest first)
    notes.unshift({
      id: note.id,
      timestamps: note.timestamps,
      extracted: note.extracted,
      analysis: note.analysis,
      input: note.input,
      classification: note.classification,
      // Meeting metadata
      type: note.type,
      note_type: note.note_type,
      meeting: note.meeting,
      content: note.content?.substring(0, 500),
      enhanced_content: note.enhanced_content?.substring(0, 500),
      _optimistic: note._optimistic || false
    });
    this.set(notes);
  },

  /**
   * Update a note in cache
   * @param {string|Object} noteIdOrNote - Note ID or full note object
   * @param {Object} [updates] - Fields to update (if first param is ID)
   */
  updateNote(noteIdOrNote, updates) {
    const notes = this.get() || [];

    // Handle both signatures: updateNote(note) and updateNote(noteId, updates)
    let noteId, updateData;
    if (typeof noteIdOrNote === 'object' && noteIdOrNote.id) {
      noteId = noteIdOrNote.id;
      updateData = {
        timestamps: noteIdOrNote.timestamps,
        extracted: noteIdOrNote.extracted,
        analysis: noteIdOrNote.analysis,
        input: noteIdOrNote.input,
        classification: noteIdOrNote.classification,
        type: noteIdOrNote.type,
        note_type: noteIdOrNote.note_type,
        meeting: noteIdOrNote.meeting,
        content: noteIdOrNote.content?.substring(0, 500),
        enhanced_content: noteIdOrNote.enhanced_content?.substring(0, 500)
      };
    } else {
      noteId = noteIdOrNote;
      updateData = updates;
    }

    const index = notes.findIndex(n => n.id === noteId);
    if (index !== -1) {
      notes[index] = { ...notes[index], ...updateData };
      this.set(notes);
      console.log(`[NotesCache] Updated note ${noteId}`);
    }
  },

  /**
   * Remove a note from cache
   * @param {string} noteId - Note ID to remove
   */
  removeNote(noteId) {
    const notes = this.get() || [];
    const filtered = notes.filter(n => n.id !== noteId);
    if (filtered.length !== notes.length) {
      this.set(filtered);
      console.log(`[NotesCache] Removed note ${noteId}`);
    }
  },

  /**
   * Replace optimistic note with real note
   * @param {string} tempId - Temporary ID of optimistic note
   * @param {Object} realNote - The real note from server
   */
  replaceOptimistic(tempId, realNote) {
    const notes = this.get() || [];
    const index = notes.findIndex(n => n.id === tempId);
    if (index !== -1) {
      notes[index] = {
        id: realNote.id,
        timestamps: realNote.timestamps,
        extracted: realNote.extracted,
        analysis: realNote.analysis,
        input: realNote.input,
        classification: realNote.classification
      };
      this.set(notes);
      console.log(`[NotesCache] Replaced optimistic ${tempId} with ${realNote.id}`);
    }
  },

  /**
   * Clear all cached data
   */
  clear() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
    console.log('[NotesCache] Cache cleared');
  },

  /**
   * Get cache age in seconds
   * @returns {number} Age in seconds, or Infinity if no cache
   */
  getAge() {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return Infinity;
    return (Date.now() - parseInt(timestamp)) / 1000;
  },

  /**
   * Check if notes have changed between cached and fresh
   * @param {Array} cached - Cached notes
   * @param {Array} fresh - Fresh notes from DB
   * @returns {boolean} True if notes have changed
   */
  hasChanged(cached, fresh) {
    if (!cached || !fresh) return true;
    if (cached.length !== fresh.length) return true;

    // Quick check: compare first note's id and timestamps
    if (cached[0]?.id !== fresh[0]?.id) return true;
    if (cached[0]?.timestamps?.updated_at !== fresh[0]?.timestamps?.updated_at) return true;

    // Check last note too for deletions at end
    const lastCached = cached[cached.length - 1];
    const lastFresh = fresh[fresh.length - 1];
    if (lastCached?.id !== lastFresh?.id) return true;

    return false;
  }
};

console.log('[NotesCache] Module loaded');
