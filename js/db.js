/**
 * Digital Twin - IndexedDB Database Layer
 * Following schema from CLAUDE.md section 6
 */

const DB_NAME = 'digital-twin';
const DB_VERSION = 3;
const STORE_NAME = 'notes';
const TWIN_STORE_NAME = 'twin_profile';
const QUALITY_STORE_NAME = 'quality_learning';

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
      const oldVersion = event.oldVersion;

      // Version 1: Create notes store
      if (oldVersion < 1) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_date', 'timestamps.input_date', { unique: false });
        store.createIndex('by_category', 'classification.category', { unique: false });
        store.createIndex('by_created', 'timestamps.created_at', { unique: false });
      }

      // Version 2: Create twin_profile store
      if (oldVersion < 2) {
        const twinStore = database.createObjectStore(TWIN_STORE_NAME, { keyPath: 'id' });
        twinStore.createIndex('by_updated', 'meta.lastUpdated', { unique: false });
      }

      // Version 3: Create quality_learning store
      if (oldVersion < 3) {
        database.createObjectStore(QUALITY_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save a note to the database
 * Auto-generates ID if missing, adds timestamps.created_at if missing
 * @param {Object} note - Note object
 * @param {Object} options - Save options
 * @param {boolean} options.fromSync - If true, preserve sync status (called by sync module)
 * @returns {Promise<Object>} Saved note with ID
 */
function saveNote(note, options = {}) {
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
      // Always update timestamps.updated_at for sync tracking
      note.timestamps.updated_at = new Date().toISOString();

      // Mark as having local changes for cloud sync
      // If called from sync module (fromSync=true), preserve the sync status
      // Otherwise, mark as pending to trigger re-sync
      if (!options.fromSync) {
        note._syncStatus = 'pending';
        note._localChanges = true;
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

/**
 * Save twin profile to database
 * @param {Object} profile - Twin profile object
 * @returns {Promise<Object>} Saved profile
 */
function saveTwinProfile(profile) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([TWIN_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(TWIN_STORE_NAME);

      // Ensure profile has an ID
      if (!profile.id) {
        profile.id = 'default';
      }

      const request = store.put(profile);

      request.onsuccess = () => {
        resolve(profile);
      };

      request.onerror = () => {
        reject(new Error('Failed to save twin profile'));
      };
    }).catch(reject);
  });
}

/**
 * Load twin profile from database
 * @param {string} id - Profile ID (default: 'default')
 * @returns {Promise<Object|null>} Profile object or null
 */
function loadTwinProfile(id = 'default') {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([TWIN_STORE_NAME], 'readonly');
      const store = transaction.objectStore(TWIN_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to load twin profile'));
      };
    }).catch(reject);
  });
}

/**
 * Delete twin profile from database
 * @param {string} id - Profile ID (default: 'default')
 * @returns {Promise<void>}
 */
function deleteTwinProfile(id = 'default') {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([TWIN_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(TWIN_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete twin profile'));
      };
    }).catch(reject);
  });
}

/**
 * Generic get from any store
 * @param {string} storeName - Store name
 * @param {string} id - Object ID
 * @returns {Promise<Object|null>}
 */
function get(storeName, id) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get from ${storeName}`));
      };
    }).catch(reject);
  });
}

/**
 * Generic save to any store
 * @param {string} storeName - Store name
 * @param {Object} object - Object to save (must have id field)
 * @returns {Promise<Object>}
 */
function save(storeName, object) {
  return new Promise((resolve, reject) => {
    initDB().then((database) => {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(object);

      request.onsuccess = () => {
        resolve(object);
      };

      request.onerror = () => {
        reject(new Error(`Failed to save to ${storeName}`));
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
  generateId,
  saveTwinProfile,
  loadTwinProfile,
  deleteTwinProfile,
  get,
  save
};
