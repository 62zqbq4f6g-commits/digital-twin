/**
 * Digital Twin - Cloud Sync Module
 * Handles Supabase sync with end-to-end encryption
 */

const Sync = {
  supabase: null,
  user: null,
  syncInterval: null,
  lastSyncKey: 'dt_last_sync',
  isSyncing: false,

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
    if (!window.ENV || window.ENV.SUPABASE_URL === 'https://placeholder.supabase.co') {
      console.warn('Supabase not configured - running in offline mode');
      return;
    }

    try {
      this.supabase = window.supabase.createClient(
        window.ENV.SUPABASE_URL,
        window.ENV.SUPABASE_ANON_KEY
      );

      // Check for existing session
      const { data: { session } } = await this.supabase.auth.getSession();

      if (session) {
        this.user = session.user;
        this.startSync();
        this.updateSyncStatus('connected');
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          this.user = session.user;
          this.startSync();
          this.updateSyncStatus('connected');
        } else if (event === 'SIGNED_OUT') {
          this.user = null;
          this.stopSync();
          this.updateSyncStatus('disconnected');
        }
      });
    } catch (error) {
      console.error('Sync init error:', error);
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
   * Sign out
   */
  async signOut() {
    if (!this.supabase) return;

    await this.supabase.auth.signOut();
    this.user = null;
    this.stopSync();
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
   * Start periodic sync
   */
  startSync() {
    // Initial sync
    this.syncNow();

    // Sync every 30 seconds
    this.syncInterval = setInterval(() => this.syncNow(), 30000);

    // Sync when coming back online
    window.addEventListener('online', () => this.syncNow());
  },

  /**
   * Stop periodic sync
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  },

  /**
   * Perform sync now
   */
  async syncNow() {
    if (!this.user || !PIN.encryptionKey || this.isSyncing) return;

    this.isSyncing = true;
    this.updateSyncStatus('syncing');

    try {
      // 1. Push local changes to cloud
      await this.pushChanges();

      // 2. Pull remote changes
      await this.pullChanges();

      // Update last sync time
      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
      this.updateSyncStatus('connected');
      console.log('Sync complete');
    } catch (error) {
      console.error('Sync error:', error);
      this.updateSyncStatus('error');
    } finally {
      this.isSyncing = false;
    }
  },

  /**
   * Push local changes to cloud
   */
  async pushChanges() {
    // Get all local notes
    const localNotes = await DB.getAllNotes();

    for (const note of localNotes) {
      // Check if needs sync (not yet synced or has local changes)
      if (note._syncStatus === 'synced' && !note._localChanges) continue;

      try {
        // Encrypt note before upload
        const encrypted = await PIN.encrypt(note);

        // Upsert to Supabase
        const { error } = await this.supabase
          .from('notes')
          .upsert({
            id: note.id,
            user_id: this.user.id,
            encrypted_data: encrypted,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (!error) {
          // Mark as synced locally
          note._syncStatus = 'synced';
          note._localChanges = false;
          await DB.saveNote(note);
        }
      } catch (error) {
        console.error('Push error for note:', note.id, error);
      }
    }
  },

  /**
   * Pull remote changes
   */
  async pullChanges() {
    // Get last sync timestamp
    const lastSync = localStorage.getItem(this.lastSyncKey) || '1970-01-01T00:00:00Z';

    // Fetch updated notes from cloud
    const { data: remoteNotes, error } = await this.supabase
      .from('notes')
      .select('*')
      .eq('user_id', this.user.id)
      .gt('updated_at', lastSync)
      .is('deleted_at', null);

    if (error) throw error;

    for (const remoteNote of remoteNotes || []) {
      try {
        // Decrypt
        const decrypted = await PIN.decrypt(remoteNote.encrypted_data);
        decrypted._syncStatus = 'synced';
        decrypted._localChanges = false;

        // Check if local version exists
        const localNote = await DB.getNoteById(decrypted.id);

        if (!localNote) {
          // New note from cloud
          await DB.saveNote(decrypted);
        } else {
          // Check if remote is newer
          const localUpdated = localNote.timestamps?.updated_at || localNote.timestamps?.created_at;
          if (new Date(remoteNote.updated_at) > new Date(localUpdated)) {
            await DB.saveNote(decrypted);
          }
        }
      } catch (error) {
        console.error('Pull error for note:', remoteNote.id, error);
      }
    }
  },

  /**
   * Delete note from cloud
   */
  async deleteNote(noteId) {
    // Soft delete in cloud
    if (this.user && this.supabase) {
      try {
        await this.supabase
          .from('notes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', noteId);
      } catch (error) {
        console.error('Cloud delete error:', error);
      }
    }

    // Delete locally
    await DB.deleteNote(noteId);
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
