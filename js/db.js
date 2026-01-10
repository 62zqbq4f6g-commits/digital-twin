/**
 * Digital Twin - IndexedDB Database Layer
 * Following schema from CLAUDE.md section 6
 */

const DB_NAME = 'digital-twin';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db = null;

/**
 * Generate unique ID in format: dt_YYYYMMDD_HHMMSS_xxx
 * @returns {string} Unique ID
 */
function generateId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 5);
  return `dt_${date}_${time}_${random}`;
}

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>} Database instance
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create object store with keyPath 'id'
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });

      // Create indexes
      store.createIndex('by_date', 'timestamps.input_date', { unique: false });
      store.createIndex('by_category', 'classification.category', { unique: false });
      store.createIndex('by_created', 'timestamps.created_at', { unique: false });
    };
  });
}

/**
 * Save a note to the database
 * Auto-generates ID if missing, adds timestamps.created_at if missing
 * @param {Object} note - Note object
 * @returns {Promise<Object>} Saved note with ID
 */
function saveNote(note) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Auto-generate ID if missing
      if (!note.id) {
        note.id = generateId();
      }

      // Auto-add timestamps.created_at if missing
      if (!note.timestamps) {
        note.timestamps = {};
      }
      if (!note.timestamps.created_at) {
        note.timestamps.created_at = new Date().toISOString();
      }

      const request = store.put(note);

      request.onsuccess = () => {
        resolve(note);
      };

      request.onerror = () => {
        reject(new Error('Failed to save note'));
      };
    }).catch(reject);
  });
}

/**
 * Get all notes sorted by created_at descending (newest first)
 * @returns {Promise<Array>} Array of notes
 */
function getAllNotes() {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        // Sort by created_at descending (newest first)
        notes.sort((a, b) => {
          const dateA = a.timestamps?.created_at || '';
          const dateB = b.timestamps?.created_at || '';
          return dateB.localeCompare(dateA);
        });
        resolve(notes);
      };

      request.onerror = () => {
        reject(new Error('Failed to get notes'));
      };
    }).catch(reject);
  });
}

/**
 * Get notes by category
 * @param {string} category - Category to filter by
 * @returns {Promise<Array>} Array of notes in category
 */
function getNotesByCategory(category) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('by_category');
      const request = index.getAll(category);

      request.onsuccess = () => {
        const notes = request.result || [];
        // Sort by created_at descending
        notes.sort((a, b) => {
          const dateA = a.timestamps?.created_at || '';
          const dateB = b.timestamps?.created_at || '';
          return dateB.localeCompare(dateA);
        });
        resolve(notes);
      };

      request.onerror = () => {
        reject(new Error('Failed to get notes by category'));
      };
    }).catch(reject);
  });
}

/**
 * Get a single note by ID
 * @param {string} id - Note ID
 * @returns {Promise<Object|null>} Note object or null if not found
 */
function getNoteById(id) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get note'));
      };
    }).catch(reject);
  });
}

/**
 * Delete a note by ID
 * @param {string} id - Note ID
 * @returns {Promise<void>}
 */
function deleteNote(id) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete note'));
      };
    }).catch(reject);
  });
}

/**
 * Export all notes as JSON string (pretty-printed)
 * @returns {Promise<string>} JSON string of all notes
 */
function exportAllNotes() {
  return getAllNotes().then((notes) => {
    return JSON.stringify(notes, null, 2);
  });
}

/**
 * Clear all notes from the database
 * @returns {Promise<void>}
 */
function clearAllNotes() {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear notes'));
      };
    }).catch(reject);
  });
}

/**
 * Get notes by date range (for weekly digest)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of notes in date range
 */
function getNotesByDateRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('by_date');

      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const notes = request.result || [];
        // Sort by created_at descending
        notes.sort((a, b) => {
          const dateA = a.timestamps?.created_at || '';
          const dateB = b.timestamps?.created_at || '';
          return dateB.localeCompare(dateA);
        });
        resolve(notes);
      };

      request.onerror = () => {
        reject(new Error('Failed to get notes by date range'));
      };
    }).catch(reject);
  });
}

// Export functions for use in other modules
window.DB = {
  initDB,
  saveNote,
  getAllNotes,
  getNotesByCategory,
  getNoteById,
  deleteNote,
  exportAllNotes,
  clearAllNotes,
  getNotesByDateRange,
  generateId
};
