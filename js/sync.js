/**
 * Inscript - Cloud Sync Module
 * Handles Supabase sync with end-to-end encryption
 * Phase 5F: Added tombstone system to prevent deleted note resurrection
 */

// ═══════════════════════════════════════════
// TOMBSTONE SYSTEM - Prevents deleted notes from resurrecting
// ═══════════════════════════════════════════
const DELETED_NOTES_KEY = 'digital-twin-deleted-notes';

/**
 * Mark a note as deleted (tombstone)
 */
function markAsDeleted(noteId) {
  const deleted = getDeletedNoteIds();
  if (!deleted.includes(noteId)) {
    deleted.push(noteId);
    // Keep only last 500 tombstones to prevent unbounded growth
    const trimmed = deleted.slice(-500);
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(trimmed));
    console.log('[Sync] Tombstone added:', noteId);
  }
}

/**
 * Get list of deleted note IDs
 */
function getDeletedNoteIds() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_NOTES_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Check if a note was deleted
 */
function isDeleted(noteId) {
  return getDeletedNoteIds().includes(noteId);
}

/**
 * Clear tombstone after successful cloud deletion
 */
function clearDeletedMarker(noteId) {
  const deleted = getDeletedNoteIds().filter(id => id !== noteId);
  localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(deleted));
  console.log('[Sync] Tombstone cleared:', noteId);
}

const Sync = {
  supabase: null,
  user: null,
  syncInterval: null,
  lastSyncKey: 'dt_last_sync',
  isSyncing: false,
  onSyncComplete: null,  // Callback for when sync completes
  realtimeChannel: null, // Supabase Realtime channel for instant sync
  realtimeDebounce: null, // Debounce timer for rapid changes

  /**
   * Initialize sync module
   */
  async init() {
    // Check if Supabase client is available
    if (!window.supabase) {
      console.warn('Supabase client not loaded');
      return;
    }

    // Check if we have valid environment config
    if (!window.ENV || !window.ENV.SUPABASE_URL || window.ENV.SUPABASE_URL === 'https://placeholder.supabase.co') {
      console.warn('Supabase not configured - running in offline mode');
      return;
    }

    try {
      // Create client with explicit persistence options
      this.supabase = window.supabase.createClient(
        window.ENV.SUPABASE_URL,
        window.ENV.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            storageKey: 'digital-twin-auth',
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      // Check for existing session
      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (session) {
        console.log('[Sync] Session restored from storage');
        this.user = session.user;

        // CRITICAL: Verify user ownership - prevent data leakage between accounts
        await this.verifyUserOwnership(session.user.id);

        this.startSync();
        this.updateSyncStatus('connected');
        // Update UI to reflect authenticated state
        this.updateAuthUI();
      } else if (error) {
        console.log('[Sync] Session error, attempting refresh:', error.message);
        // Try to refresh the session
        const { data: { session: refreshedSession } } = await this.supabase.auth.refreshSession();
        if (refreshedSession) {
          console.log('[Sync] Session refreshed successfully');
          this.user = refreshedSession.user;

          // CRITICAL: Verify user ownership
          await this.verifyUserOwnership(refreshedSession.user.id);

          this.startSync();
          this.updateSyncStatus('connected');
          this.updateAuthUI();
        }
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Sync] Auth state changed:', event);
        if (event === 'SIGNED_IN') {
          // CRITICAL: Verify user ownership before loading any data
          await this.verifyUserOwnership(session.user.id);
          this.user = session.user;

          this.startSync();
          this.updateSyncStatus('connected');
          this.updateAuthUI();
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refresh - same user, just update session
          this.user = session.user;
          this.startSync();
          this.updateSyncStatus('connected');
          this.updateAuthUI();
        } else if (event === 'SIGNED_OUT') {
          this.user = null;
          this.stopSync();
          this.updateSyncStatus('disconnected');
          this.updateAuthUI();
        }
      });
    } catch (error) {
      console.error('Sync init error:', error);
    }
  },

  /**
   * Update auth UI after session changes
   */
  updateAuthUI() {
    if (typeof UI !== 'undefined' && UI.updateAuthUI) {
      UI.updateAuthUI();
    }
  },

  /**
   * Sign up with email and password
   */
  async signUp(email, password) {
    if (!this.supabase) throw new Error('Supabase not initialized');

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.user) {
      this.user = data.user;
    }

    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    if (!this.supabase) throw new Error('Supabase not initialized');

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    this.user = data.user;

    this.startSync();
    return data;
  },

  /**
   * Sign out - CRITICAL: Clear ALL local data to prevent data leakage
   */
  async signOut() {
    if (!this.supabase) return;

    console.log('[Sync] Signing out - clearing ALL local data');

    // Stop sync first
    this.stopSync();

    // Clear ALL localStorage
    const keyCount = localStorage.length;
    localStorage.clear();
    console.log('[Sync] Cleared ALL localStorage:', keyCount, 'keys removed');

    // Clear IndexedDB (notes database)
    try {
      const databases = ['digital-twin', 'digital-twin-db', 'dt-db', 'notes-db'];
      for (const dbName of databases) {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onsuccess = () => console.log('[Sync] Deleted IndexedDB:', dbName);
        deleteRequest.onerror = () => console.warn('[Sync] Failed to delete IndexedDB:', dbName);
      }
    } catch (e) {
      console.warn('[Sync] IndexedDB cleanup error:', e);
    }

    // Clear any caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[Sync] Cleared all caches');
      } catch (e) {
        console.warn('[Sync] Cache cleanup error:', e);
      }
    }

    // Sign out from Supabase
    await this.supabase.auth.signOut();
    this.user = null;

    console.log('[Sync] Sign out complete - all local data cleared');
  },

  /**
   * CRITICAL: Verify user ownership - prevent data leakage between accounts
   * Clears local data if a different user is signing in
   * @param {string} currentUserId - The user ID to verify
   */
  async verifyUserOwnership(currentUserId) {
    const storedUserId = localStorage.getItem('user_id');

    console.log('[Sync] Verifying user ownership:', { stored: storedUserId, current: currentUserId });

    if (storedUserId && storedUserId !== currentUserId) {
      console.log('[Sync] USER CHANGED - clearing all local data to prevent data leakage');

      // CRITICAL: Clear ALL localStorage
      const keyCount = localStorage.length;
      localStorage.clear();
      console.log('[Sync] Cleared ALL localStorage:', keyCount, 'keys removed');

      // Clear IndexedDB (notes database)
      try {
        const databases = ['digital-twin', 'digital-twin-db', 'dt-db', 'notes-db'];
        for (const dbName of databases) {
          await new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            deleteRequest.onsuccess = () => {
              console.log('[Sync] Deleted IndexedDB:', dbName);
              resolve();
            };
            deleteRequest.onerror = () => {
              console.warn('[Sync] Failed to delete IndexedDB:', dbName);
              resolve(); // Continue even on error
            };
            deleteRequest.onblocked = () => {
              console.warn('[Sync] IndexedDB deletion blocked:', dbName);
              resolve();
            };
          });
        }
      } catch (e) {
        console.warn('[Sync] IndexedDB cleanup error:', e);
      }

      // Clear any caches
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('[Sync] Cleared all caches');
        } catch (e) {
          console.warn('[Sync] Cache cleanup error:', e);
        }
      }

      // Reset DB module to reinitialize with empty database
      if (typeof DB !== 'undefined' && DB.initDB) {
        await DB.initDB();
        console.log('[Sync] Reinitialized DB module');
      }

      console.log('[Sync] Local data cleared for new user');
    }

    // Store current user ID for future verification
    localStorage.setItem('user_id', currentUserId);
    console.log('[Sync] User ownership verified, ID stored');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.user !== null;
  },

  /**
   * Get current user email
   */
  getUserEmail() {
    return this.user?.email || null;
  },

  // ==================
  // SYNC LOGIC
  // ==================

  /**
   * Start periodic sync + Realtime subscription
   */
  startSync() {
    // Initial sync
    this.syncNow();

    // Sync every 30 seconds (fallback for reliability)
    this.syncInterval = setInterval(() => this.syncNow(), 30000);

    // Sync when coming back online
    window.addEventListener('online', () => this.syncNow());

    // Setup Supabase Realtime for instant cross-device sync
    this.setupRealtimeSubscription();
  },

  /**
   * Setup Supabase Realtime subscription for instant cross-device sync
   * Listens for INSERT/UPDATE/DELETE on notes table for current user
   */
  setupRealtimeSubscription() {
    if (!this.supabase || !this.user) {
      console.log('[Sync] Cannot setup Realtime: no supabase or user');
      return;
    }

    // Clean up existing subscription if any
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
    }

    console.log('[Sync] Setting up Realtime subscription for user:', this.user.id);

    this.realtimeChannel = this.supabase
      .channel('notes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${this.user.id}`
        },
        (payload) => {
          console.log('[Sync] Realtime event:', payload.eventType, payload.new?.id || payload.old?.id);

          // Debounce rapid changes (e.g., multiple quick saves)
          if (this.realtimeDebounce) {
            clearTimeout(this.realtimeDebounce);
          }

          this.realtimeDebounce = setTimeout(() => {
            this.handleRealtimeChange(payload);
          }, 500);
        }
      )
      .subscribe((status) => {
        console.log('[Sync] Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Sync] Realtime connected - instant cross-device sync enabled');
        }
      });
  },

  /**
   * Handle a Realtime change event
   * @param {Object} payload - Supabase Realtime payload
   */
  async handleRealtimeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    try {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        // Check if note was soft-deleted - treat as a delete, not an insert/update
        if (newRecord.deleted_at) {
          console.log('[Sync] Realtime: note was deleted, removing locally:', newRecord.id);
          await DB.deleteNote(newRecord.id);
          if (typeof NotesCache !== 'undefined') {
            NotesCache.removeNote(newRecord.id);
          }
          window.dispatchEvent(new CustomEvent('sync-complete', {
            detail: { timestamp: new Date().toISOString(), source: 'realtime' }
          }));
          return;
        }

        // Check if this is our own change (already in IndexedDB)
        const existingNote = await DB.getNoteById(newRecord.id);
        const localUpdated = existingNote?.timestamps?.updated_at;
        const remoteUpdated = newRecord.updated_at;

        // Skip if local is newer or same (we made this change)
        if (localUpdated && new Date(localUpdated) >= new Date(remoteUpdated)) {
          console.log('[Sync] Realtime: skipping own change for', newRecord.id);
          return;
        }

        // Decrypt and save the new/updated note
        if (newRecord.encrypted_data) {
          const decrypted = await Auth.decrypt(newRecord.encrypted_data);
          decrypted._syncStatus = 'synced';
          decrypted._localChanges = false;
          await DB.saveNote(decrypted, { fromSync: true });
          console.log('[Sync] Realtime: saved note from other device:', newRecord.id);

          // Update NotesCache
          if (typeof NotesCache !== 'undefined') {
            if (eventType === 'INSERT') {
              NotesCache.addNote(decrypted);
            } else {
              // For updates, refresh the cache
              const allNotes = await DB.getAllNotes();
              NotesCache.set(allNotes);
            }
          }

          // Trigger UI refresh
          window.dispatchEvent(new CustomEvent('sync-complete', {
            detail: { timestamp: new Date().toISOString(), source: 'realtime' }
          }));
        }
      } else if (eventType === 'DELETE') {
        // Handle deletion from other device
        const noteId = oldRecord?.id;
        if (noteId) {
          await DB.deleteNote(noteId);
          if (typeof NotesCache !== 'undefined') {
            NotesCache.removeNote(noteId);
          }
          console.log('[Sync] Realtime: deleted note from other device:', noteId);

          window.dispatchEvent(new CustomEvent('sync-complete', {
            detail: { timestamp: new Date().toISOString(), source: 'realtime' }
          }));
        }
      }
    } catch (error) {
      console.error('[Sync] Realtime handler error:', error);
      // Fall back to full sync on error
      this.syncNow();
    }
  },

  /**
   * Stop periodic sync and Realtime subscription
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Clean up Realtime subscription
    if (this.realtimeChannel && this.supabase) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
      console.log('[Sync] Realtime subscription removed');
    }

    if (this.realtimeDebounce) {
      clearTimeout(this.realtimeDebounce);
      this.realtimeDebounce = null;
    }
  },

  /**
   * Perform sync now
   */
  async syncNow() {
    if (!this.user || !Auth.encryptionKey || this.isSyncing) return;

    this.isSyncing = true;
    this.updateSyncStatus('syncing');

    // Phase 16 Polish: Update header sync indicator
    if (typeof SyncStatus !== 'undefined') {
      SyncStatus.set('syncing');
    }
    window.dispatchEvent(new CustomEvent('sync-start'));

    try {
      // 1. Push local changes to cloud
      await this.pushChanges();

      // 2. Pull remote changes
      await this.pullChanges();

      // 3. Sync TwinProfile (patterns, etc.)
      await this.syncTwinProfile();

      // Update last sync time
      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
      this.updateSyncStatus('connected');
      console.log('Sync complete');

      // Phase 16 Polish: Update header sync indicator
      if (typeof SyncStatus !== 'undefined') {
        SyncStatus.set('synced');
      }

      // Fire sync complete callback if registered
      if (this.onSyncComplete && typeof this.onSyncComplete === 'function') {
        try {
          this.onSyncComplete();
        } catch (e) {
          console.warn('[Sync] onSyncComplete callback error:', e);
        }
      }

      // Emit custom event for multiple listeners (UI, TwinUI, etc.)
      window.dispatchEvent(new CustomEvent('sync-complete', {
        detail: { timestamp: new Date().toISOString() }
      }));
    } catch (error) {
      console.error('Sync error:', error);
      this.updateSyncStatus('error');

      // Phase 16 Polish: Update header sync indicator on error
      if (typeof SyncStatus !== 'undefined') {
        SyncStatus.set('error');
      }
      window.dispatchEvent(new CustomEvent('sync-error'));
    } finally {
      this.isSyncing = false;
    }
  },

  /**
   * Sync TwinProfile between local and cloud
   */
  async syncTwinProfile() {
    if (typeof TwinProfile === 'undefined') return;

    try {
      const localProfile = await TwinProfile.load();
      const hasLocalPatterns = Array.isArray(localProfile?.patterns) && localProfile.patterns.length > 0;

      // Try to load from cloud
      const cloudProfile = await TwinProfile.loadFromCloud();

      if (cloudProfile) {
        const hasCloudPatterns = Array.isArray(cloudProfile.patterns) && cloudProfile.patterns.length > 0;
        const cloudUpdated = cloudProfile.meta?.lastUpdated || cloudProfile.patternsDetectedAt;
        const localUpdated = localProfile?.meta?.lastUpdated || localProfile?.patternsDetectedAt;

        // If cloud has patterns and local doesn't, or cloud is newer
        if ((hasCloudPatterns && !hasLocalPatterns) ||
            (cloudUpdated && localUpdated && new Date(cloudUpdated) > new Date(localUpdated))) {
          // Merge cloud data into local
          if (hasCloudPatterns) {
            localProfile.patterns = cloudProfile.patterns;
            localProfile.patternsConfidence = cloudProfile.patternsConfidence;
            localProfile.patternsDetectedAt = cloudProfile.patternsDetectedAt;
            localProfile.patternsSuggestion = cloudProfile.patternsSuggestion;
          }
          await TwinProfile.save(localProfile);
          console.log('[Sync] TwinProfile restored from cloud');
        }
      } else if (hasLocalPatterns) {
        // Push local to cloud if cloud is empty
        await TwinProfile.syncToCloud();
        console.log('[Sync] TwinProfile pushed to cloud');
      }
    } catch (error) {
      console.warn('[Sync] TwinProfile sync error:', error);
    }
  },

  /**
   * Push local changes to cloud
   * OPTIMIZED: Process notes in parallel batches for faster sync
   */
  async pushChanges() {
    // Get all local notes
    const localNotes = await DB.getAllNotes();

    // Filter to only notes that need sync
    const notesToSync = localNotes.filter(note =>
      note._syncStatus !== 'synced' || note._localChanges
    );

    if (notesToSync.length === 0) return;

    console.log('[Sync] Pushing', notesToSync.length, 'notes...');

    // Process in parallel batches of 5 for faster sync
    const BATCH_SIZE = 5;
    for (let i = 0; i < notesToSync.length; i += BATCH_SIZE) {
      const batch = notesToSync.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(batch.map(async (note) => {
        try {
          // Encrypt note before upload
          const encrypted = await Auth.encrypt(note);

          // Upsert to Supabase
          // Include note_type so meetings/decisions are queryable
          const { error } = await this.supabase
            .from('notes')
            .upsert({
              id: note.id,
              user_id: this.user.id,
              encrypted_data: encrypted,
              note_type: note.note_type || null,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

          if (!error) {
            // Mark as synced locally
            note._syncStatus = 'synced';
            note._localChanges = false;
            await DB.saveNote(note, { fromSync: true });
          }
        } catch (error) {
          console.error('Push error for note:', note.id, error);
        }
      }));
    }
  },

  /**
   * Pull remote changes
   * Phase 5F: Filter out tombstoned notes to prevent resurrection
   */
  async pullChanges() {
    // Get last sync timestamp
    let lastSync = localStorage.getItem(this.lastSyncKey) || '1970-01-01T00:00:00Z';

    // New device check: if no local notes, pull everything from cloud
    const localNotes = await DB.getAllNotes();
    if (localNotes.length === 0) {
      lastSync = '1970-01-01T00:00:00Z';
    }

    // Fetch updated notes from cloud
    const { data: remoteNotes, error } = await this.supabase
      .from('notes')
      .select('*')
      .eq('user_id', this.user.id)
      .gt('updated_at', lastSync)
      .is('deleted_at', null);

    if (error) throw error;

    // Get tombstoned note IDs
    const deletedIds = getDeletedNoteIds();

    // Filter out tombstoned notes first
    const notesToProcess = (remoteNotes || []).filter(note => !deletedIds.includes(note.id));
    const tombstonedNotes = (remoteNotes || []).filter(note => deletedIds.includes(note.id));

    // Clean up tombstoned notes in background (non-blocking)
    if (tombstonedNotes.length > 0) {
      Promise.allSettled(tombstonedNotes.map(async (remoteNote) => {
        try {
          await this.supabase
            .from('notes')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', remoteNote.id);
          clearDeletedMarker(remoteNote.id);
        } catch (err) {
          console.warn('[Sync] Failed to cleanup cloud note:', remoteNote.id);
        }
      }));
    }

    if (notesToProcess.length === 0) return;

    console.log('[Sync] Pulling', notesToProcess.length, 'notes...');

    // Process in parallel batches of 5 for faster sync
    const BATCH_SIZE = 5;
    for (let i = 0; i < notesToProcess.length; i += BATCH_SIZE) {
      const batch = notesToProcess.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(batch.map(async (remoteNote) => {
        try {
          // Decrypt
          const decrypted = await Auth.decrypt(remoteNote.encrypted_data);
          decrypted._syncStatus = 'synced';
          decrypted._localChanges = false;

          // FIX: Merge note_type from Supabase column (not in encrypted_data)
          // This preserves meeting/decision type after sync
          if (remoteNote.note_type && !decrypted.note_type) {
            decrypted.note_type = remoteNote.note_type;
            decrypted.type = remoteNote.note_type; // Also set type for consistency
          }

          // Check if local version exists
          const localNote = await DB.getNoteById(decrypted.id);

          if (!localNote) {
            // New note from cloud
            await DB.saveNote(decrypted, { fromSync: true });
            console.log('[Sync] Saved new note from cloud:', decrypted.id);
          } else {
            // Check if remote is newer
            const localUpdated = localNote.timestamps?.updated_at || localNote.timestamps?.created_at;
            if (new Date(remoteNote.updated_at) > new Date(localUpdated)) {
              await DB.saveNote(decrypted, { fromSync: true });
              console.log('[Sync] Updated note from cloud:', decrypted.id);
            }
          }
        } catch (error) {
          console.error('[Sync] DECRYPT FAILED for note:', remoteNote.id, error.message);
        }
      }));
    }
  },

  // ==================
  // SALT SYNC (for cross-device encryption)
  // ==================

  /**
   * Save encryption salt to cloud
   * Called when user creates PIN on first device
   */
  async saveSalt(salt) {
    if (!this.user || !this.supabase) return;

    try {
      const { error } = await this.supabase
        .from('user_salts')
        .upsert({
          user_id: this.user.id,
          encryption_salt: salt,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Failed to save salt to cloud:', error);
      } else {
        console.log('[Sync] Salt saved to cloud');
      }
    } catch (error) {
      console.error('saveSalt error:', error);
    }
  },

  /**
   * Fetch encryption salt from cloud
   * Called when user creates PIN on new device (after signing in)
   */
  async fetchSalt() {
    if (!this.user || !this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('user_salts')
        .select('encryption_salt')
        .eq('user_id', this.user.id)
        .maybeSingle();

      if (error || !data) {
        console.log('[Sync] No salt found in cloud');
        return null;
      }

      console.log('[Sync] Salt fetched from cloud');
      return data.encryption_salt;
    } catch (error) {
      console.error('fetchSalt error:', error);
      return null;
    }
  },

  /**
   * Delete note from cloud with tombstone tracking
   * Phase 5F: Prevents deleted notes from resurrecting during sync
   */
  async deleteNote(noteId) {
    console.log('[Sync] Deleting note:', noteId);

    // STEP 1: Mark as deleted FIRST (tombstone prevents resurrection)
    markAsDeleted(noteId);

    // STEP 2: Delete from cloud (soft delete)
    if (this.user && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('notes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', noteId);

        if (error) {
          console.error('[Sync] Cloud delete error:', error);
          // Tombstone remains, so note won't resurrect even if cloud delete fails
        } else {
          console.log('[Sync] Cloud delete successful:', noteId);
          // Clear tombstone after successful cloud delete
          clearDeletedMarker(noteId);
        }
      } catch (error) {
        console.error('[Sync] Cloud delete exception:', error);
        // Tombstone remains
      }
    }

    // STEP 3: Delete locally
    try {
      await DB.deleteNote(noteId);
      console.log('[Sync] Local delete successful:', noteId);
    } catch (error) {
      console.error('[Sync] Local delete error:', error);
    }
  },

  /**
   * Get last sync time formatted
   */
  getLastSyncTime() {
    const lastSync = localStorage.getItem(this.lastSyncKey);
    if (!lastSync) return 'Never';

    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return date.toLocaleDateString();
  },

  /**
   * Update sync status in UI
   */
  updateSyncStatus(status) {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;

    const statusText = {
      'connected': '● Connected',
      'syncing': '○ Syncing...',
      'disconnected': '○ Offline',
      'error': '○ Sync error'
    };

    statusEl.textContent = statusText[status] || status;
    statusEl.className = `sync-status sync-status-${status}`;
  }
};

// Export for global access
window.Sync = Sync;
