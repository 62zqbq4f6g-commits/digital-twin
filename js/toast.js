/**
 * INSCRIPT: Toast & Undo System
 *
 * Phase 16 Polish — Delete undo + Sync indicator
 *
 * Design System Compliance:
 * - Black (#1A1A1A) for toast background
 * - 1px borders with rgba(255,255,255,0.25)
 * - 200ms ease-out transitions
 * - Inter font family
 */

// ============================================
// UNDO TOAST COMPONENT
// ============================================

const UndoToast = {
  activeToast: null,
  activeTimeout: null,

  /**
   * Show undo toast with action buttons
   * @param {string} message - Toast message
   * @param {function} onUndo - Callback when undo is clicked
   * @param {function} onConfirm - Callback when timeout expires (action confirmed)
   * @param {number} duration - Time before auto-confirm (default 5000ms)
   */
  show(message, onUndo, onConfirm, duration = 5000) {
    // Remove any existing toast
    this.hide(true);

    const toast = document.createElement('div');
    toast.className = 'undo-toast';
    toast.innerHTML = `
      <span class="undo-toast-message">${message}</span>
      <button class="undo-toast-btn" type="button">Undo</button>
    `;

    document.body.appendChild(toast);
    this.activeToast = toast;

    // Animate in (double rAF for reliable animation)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });
    });

    // Set timeout for auto-confirm
    this.activeTimeout = setTimeout(() => {
      this.hide();
      if (onConfirm) {
        try {
          onConfirm();
        } catch (e) {
          console.error('[UndoToast] onConfirm error:', e);
        }
      }
    }, duration);

    // Handle undo click
    const undoBtn = toast.querySelector('.undo-toast-btn');
    undoBtn.onclick = () => {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
      this.hide();
      if (onUndo) {
        try {
          onUndo();
        } catch (e) {
          console.error('[UndoToast] onUndo error:', e);
        }
      }
    };

    // Handle keyboard (Enter/Space on button, Escape to dismiss)
    undoBtn.onkeydown = (e) => {
      if (e.key === 'Escape') {
        clearTimeout(this.activeTimeout);
        this.hide();
        if (onConfirm) onConfirm();
      }
    };

    // Focus the undo button for accessibility
    setTimeout(() => undoBtn.focus(), 250);
  },

  /**
   * Hide the active toast
   * @param {boolean} immediate - Skip animation
   */
  hide(immediate = false) {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }

    if (this.activeToast) {
      const toast = this.activeToast;
      this.activeToast = null;

      if (immediate) {
        toast.remove();
      } else {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 200);
      }
    }
  }
};

// ============================================
// SYNC STATUS INDICATOR
// ============================================

const SyncStatus = {
  fadeTimeout: null,

  /**
   * Update sync status indicator
   * @param {'syncing'|'synced'|'error'|'hidden'} status
   */
  set(status) {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;

    // Clear any pending fade timeout
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // Reset classes
    indicator.className = 'sync-indicator';

    switch (status) {
      case 'syncing':
        indicator.classList.add('syncing');
        break;

      case 'synced':
        indicator.classList.add('synced');
        // Fade out after 2 seconds
        this.fadeTimeout = setTimeout(() => {
          indicator.classList.remove('synced');
        }, 2000);
        break;

      case 'error':
        indicator.classList.add('error');
        // Fade out after 3 seconds
        this.fadeTimeout = setTimeout(() => {
          indicator.classList.remove('error');
        }, 3000);
        break;

      case 'hidden':
      default:
        // Just reset (already done above)
        break;
    }
  },

  /**
   * Initialize sync status listeners
   */
  init() {
    // Listen for sync events from Sync.js
    window.addEventListener('sync-start', () => {
      this.set('syncing');
    });

    window.addEventListener('sync-complete', () => {
      this.set('synced');
    });

    window.addEventListener('sync-error', () => {
      this.set('error');
    });

    console.log('[SyncStatus] Initialized');
  }
};

// ============================================
// DELETE WITH UNDO
// ============================================

/**
 * Delete a note with undo capability
 * @param {string} noteId - Note ID to delete
 * @param {Object} options - Optional callbacks
 */
async function deleteNoteWithUndo(noteId, options = {}) {
  const { onComplete, onUndo: customOnUndo } = options;

  try {
    // Get note data for potential restore
    const note = await DB.getNoteById(noteId);
    if (!note) {
      console.error('[deleteNoteWithUndo] Note not found:', noteId);
      return;
    }

    // Remove from cache immediately (optimistic)
    if (typeof NotesCache !== 'undefined') {
      NotesCache.removeNote(noteId);
    }

    // Animate out from UI
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    if (noteElement) {
      noteElement.style.opacity = '0';
      noteElement.style.transform = 'translateX(-20px)';
      noteElement.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out';
      setTimeout(() => {
        noteElement.style.display = 'none';
      }, 200);
    }

    // Close any open note detail
    if (typeof UI !== 'undefined' && UI.closeNoteDetail) {
      UI.closeNoteDetail();
    }

    // Hide delete dialog if open
    if (typeof UI !== 'undefined' && UI.hideDeleteDialog) {
      UI.hideDeleteDialog();
    }

    // Show undo toast
    UndoToast.show(
      'Note deleted',
      // On Undo
      async () => {
        console.log('[deleteNoteWithUndo] Undo triggered');

        // Restore note to database
        await DB.saveNote(note);

        // Invalidate cache
        if (typeof NotesManager !== 'undefined') {
          NotesManager.invalidate();
        }

        // Refresh UI
        if (typeof UI !== 'undefined' && UI.loadNotes) {
          UI.loadNotes();
        }

        // Show confirmation
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Note restored');
        }

        // Custom callback
        if (customOnUndo) customOnUndo(note);
      },
      // On Confirm (after timeout)
      async () => {
        console.log('[deleteNoteWithUndo] Delete confirmed');

        try {
          // Actually delete from cloud and local
          if (typeof Sync !== 'undefined' && Sync.deleteNote) {
            await Sync.deleteNote(noteId);
          } else {
            await DB.deleteNote(noteId);
          }

          // Invalidate cache
          if (typeof NotesManager !== 'undefined') {
            NotesManager.invalidate();
          }

          // Trigger sync
          if (typeof Sync !== 'undefined' && Sync.pushPendingChanges) {
            Sync.pushPendingChanges();
          }

          // Custom callback
          if (onComplete) onComplete();

        } catch (error) {
          console.error('[deleteNoteWithUndo] Delete error:', error);
          if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Couldn\'t delete — try again');
          }
        }
      }
    );

  } catch (error) {
    console.error('[deleteNoteWithUndo] Error:', error);
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Couldn\'t delete — try again');
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.UndoToast = UndoToast;
  window.SyncStatus = SyncStatus;
  window.deleteNoteWithUndo = deleteNoteWithUndo;
}
