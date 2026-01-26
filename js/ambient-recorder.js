/**
 * Ambient Recorder Module
 * Phase 17 - TASK-019: Ambient listening interface for capturing meetings
 *
 * Features:
 * - Mode selection: Room (mic) vs Video Call (tab audio)
 * - Full-screen recording with timer
 * - Inline notes during recording
 * - End & Enhance flow
 * - Shimmer loading state (per design system)
 */

const AmbientRecorder = {
  // State
  state: 'idle', // idle | selecting | recording | processing | complete
  mode: null, // 'room' | 'tab_audio'
  mediaRecorder: null,
  audioChunks: [],
  startTime: null,
  timerInterval: null,
  userNotes: '',
  audioStream: null,
  userId: null,

  // Callbacks
  onComplete: null,
  onClose: null,

  // Version
  VERSION: '1.2.0',

  /**
   * Check if running on mobile device
   * @returns {boolean}
   */
  isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  },

  /**
   * Initialize the ambient recorder
   */
  init() {
    // Add keyboard shortcut (Cmd/Ctrl + Shift + L)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.openWithDefaults();
      }
    });

    // Set up button click listener
    const ambientBtn = document.getElementById('ambient-btn');
    if (ambientBtn) {
      ambientBtn.addEventListener('click', () => this.openWithDefaults());
    }

    console.log('[AmbientRecorder] Initialized v' + this.VERSION);
  },

  /**
   * Open with default settings (auto-detects user and sets up completion handler)
   */
  openWithDefaults() {
    const userId = typeof Sync !== 'undefined' && Sync.user?.id ? Sync.user.id : 'anonymous';

    this.open({
      userId: userId,
      onComplete: async (result) => {
        console.log('[AmbientRecorder] Recording complete:', result);

        // Refresh notes list if the note was created
        if (result.noteId && typeof UI !== 'undefined' && UI.loadNotes) {
          UI.loadNotes();
        }

        // Show success notification if available
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Meeting captured and enhanced');
        }
      },
    });
  },

  /**
   * Open the ambient recorder modal
   * @param {Object} options - Configuration options
   * @param {string} options.userId - User ID for API calls
   * @param {Function} options.onComplete - Callback when recording complete
   * @param {Function} options.onClose - Callback when modal closed
   */
  open(options = {}) {
    this.userId = options.userId || Sync?.user?.id || 'anonymous';
    this.onComplete = options.onComplete || null;
    this.onClose = options.onClose || null;

    // Reset state
    this.state = 'selecting';
    this.mode = null;
    this.audioChunks = [];
    this.userNotes = '';
    this.startTime = null;

    // Create and show modal
    this.createModal();
    this.showState('selecting');

    console.log('[AmbientRecorder] Opened for user:', this.userId);
  },

  /**
   * Create the modal structure
   */
  createModal() {
    // Remove existing modal if present
    const existing = document.getElementById('ambient-recorder-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ambient-recorder-modal';
    modal.className = 'ambient-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Ambient Recording');

    modal.innerHTML = `
      <div class="ambient-modal-content">
        <!-- Close button -->
        <button class="ambient-close-btn" aria-label="Close" data-action="close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <!-- Mode Selection State -->
        <div class="ambient-state" data-state="selecting">
          <h2 class="ambient-title">Start Listening</h2>
          <p class="ambient-subtitle">${this.isMobile()
            ? 'Use your device microphone to capture the room'
            : 'Choose how to capture audio'
          }</p>

          <div class="ambient-modes">
            <button class="ambient-mode-btn" data-mode="room" role="button" tabindex="0">
              <span class="mode-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </span>
              <span class="mode-label">Room</span>
              <span class="mode-desc">Use device microphone</span>
            </button>

            ${!this.isMobile() ? `
            <button class="ambient-mode-btn" data-mode="tab_audio" role="button" tabindex="0">
              <span class="mode-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </span>
              <span class="mode-label">Video Call</span>
              <span class="mode-desc">Capture browser tab audio</span>
            </button>
            ` : ''}
          </div>

          <button class="ambient-cancel-btn" data-action="close">Cancel</button>
        </div>

        <!-- Recording State -->
        <div class="ambient-state" data-state="recording" style="display: none;">
          <div class="ambient-indicator">
            <span class="recording-dot" aria-hidden="true"></span>
            <span class="recording-label">LISTENING</span>
          </div>

          <div class="ambient-timer" aria-live="polite" aria-atomic="true">00:00</div>

          <div class="ambient-notes-container">
            <label class="ambient-notes-label" for="ambient-notes-input">
              Add notes while listening (optional)
            </label>
            <textarea
              id="ambient-notes-input"
              class="ambient-notes-input"
              placeholder="Key points, action items, observations..."
              aria-describedby="notes-hint"
            ></textarea>
            <span id="notes-hint" class="visually-hidden">
              These notes will be combined with the transcription
            </span>
          </div>

          <button class="ambient-end-btn" data-action="end">End & Enhance</button>
        </div>

        <!-- Processing State -->
        <div class="ambient-state" data-state="processing" style="display: none;">
          <div class="ambient-processing-content">
            <div class="ambient-shimmer-container">
              <div class="ambient-shimmer-bar"></div>
              <div class="ambient-shimmer-bar short"></div>
              <div class="ambient-shimmer-bar"></div>
            </div>
            <p class="processing-message">transcribing your conversation...</p>
          </div>
        </div>

        <!-- Error State -->
        <div class="ambient-state" data-state="error" style="display: none;">
          <div class="ambient-error-content">
            <h3 class="error-title">Unable to access audio</h3>
            <p class="error-message"></p>
            <button class="ambient-retry-btn" data-action="retry">Try Again</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Attach listeners
    this.attachListeners(modal);

    // Focus trap
    this.trapFocus(modal);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  },

  /**
   * Attach event listeners to modal
   * @param {HTMLElement} modal - The modal element
   */
  attachListeners(modal) {
    // Close button and cancel
    modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Mode selection
    modal.querySelectorAll('.ambient-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectMode(btn.dataset.mode);
        }
      });
    });

    // End recording
    modal.querySelector('[data-action="end"]')?.addEventListener('click', () => {
      this.stopRecording();
    });

    // Retry button
    modal.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      this.showState('selecting');
    });

    // Notes input
    const notesInput = modal.querySelector('.ambient-notes-input');
    if (notesInput) {
      notesInput.addEventListener('input', (e) => {
        this.userNotes = e.target.value;
      });
    }

    // Escape key to close
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });

    // Click outside to close (only in selecting state)
    modal.addEventListener('click', (e) => {
      if (e.target === modal && this.state === 'selecting') {
        this.close();
      }
    });
  },

  /**
   * Trap focus within modal
   * @param {HTMLElement} modal - The modal element
   */
  trapFocus(modal) {
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    // Focus first element
    setTimeout(() => firstFocusable?.focus(), 100);

    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    });
  },

  /**
   * Show a specific state
   * @param {string} stateName - The state to show
   */
  showState(stateName) {
    const modal = document.getElementById('ambient-recorder-modal');
    if (!modal) return;

    this.state = stateName;

    // Hide all states
    modal.querySelectorAll('.ambient-state').forEach(el => {
      el.style.display = 'none';
    });

    // Show requested state
    const stateEl = modal.querySelector(`[data-state="${stateName}"]`);
    if (stateEl) {
      stateEl.style.display = 'flex';
    }

    // Hide close button during recording/processing
    const closeBtn = modal.querySelector('.ambient-close-btn');
    if (closeBtn) {
      closeBtn.style.display = (stateName === 'recording' || stateName === 'processing')
        ? 'none'
        : 'flex';
    }
  },

  /**
   * Select recording mode and start
   * @param {string} mode - 'room' or 'tab_audio'
   */
  async selectMode(mode) {
    this.mode = mode;
    console.log('[AmbientRecorder] Mode selected:', mode);

    try {
      if (mode === 'room') {
        await this.startRoomRecording();
      } else if (mode === 'tab_audio') {
        await this.startTabRecording();
      }
    } catch (error) {
      console.error('[AmbientRecorder] Failed to start recording:', error);
      this.showError(error);
    }
  },

  /**
   * Start room recording (device microphone)
   */
  async startRoomRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      this.startRecordingWithStream(stream);
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      }
      throw error;
    }
  },

  /**
   * Start tab audio recording (browser tab)
   */
  async startTabRecording() {
    try {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Tab audio capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required by API
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Check if audio track was captured
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('No audio was shared. Please select a tab with audio and check "Share audio".');
      }

      // Stop video track to save resources (we only need audio)
      stream.getVideoTracks().forEach(track => track.stop());

      this.startRecordingWithStream(stream);
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing was cancelled. Please try again and select a tab to share.');
      }
      throw error;
    }
  },

  /**
   * Start recording with the given stream
   * @param {MediaStream} stream - The audio stream
   */
  startRecordingWithStream(stream) {
    this.audioStream = stream;

    // Determine best audio format
    const mimeType = this.getSupportedMimeType();
    console.log('[AmbientRecorder] Using mime type:', mimeType);

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
    });

    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
        console.log('[AmbientRecorder] Chunk received:', e.data.size, 'bytes');
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log('[AmbientRecorder] Recording stopped, processing...');
      const blob = new Blob(this.audioChunks, { type: mimeType });
      stream.getTracks().forEach(track => track.stop());
      this.processRecording(blob);
    };

    this.mediaRecorder.onerror = (e) => {
      console.error('[AmbientRecorder] MediaRecorder error:', e.error);
      this.showError(new Error('Recording failed. Please try again.'));
    };

    // Start recording with 30s chunks for long recordings
    this.mediaRecorder.start(30000);
    this.startTime = Date.now();
    this.startTimer();
    this.showState('recording');

    console.log('[AmbientRecorder] Recording started');
  },

  /**
   * Get supported mime type for audio recording
   * @returns {string} Supported mime type
   */
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  },

  /**
   * Start the duration timer
   */
  startTimer() {
    const timerEl = document.querySelector('.ambient-timer');
    if (!timerEl) return;

    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  },

  /**
   * Stop the recording
   */
  stopRecording() {
    console.log('[AmbientRecorder] Stopping recording...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    clearInterval(this.timerInterval);
    this.showState('processing');
  },

  /**
   * Process the completed recording
   * @param {Blob} audioBlob - The recorded audio blob
   */
  async processRecording(audioBlob) {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    const sessionId = crypto.randomUUID();

    console.log('[AmbientRecorder] Processing recording:', {
      size: audioBlob.size,
      type: audioBlob.type,
      duration: duration,
      mode: this.mode,
      hasNotes: this.userNotes.length > 0,
      sessionId: sessionId,
    });

    try {
      // Update processing message
      this.updateProcessingMessage('uploading audio...');

      // For MVP, upload entire blob as single chunk
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('userId', this.userId);
      formData.append('sessionId', sessionId);
      formData.append('chunkIndex', '0');
      formData.append('totalChunks', '1');
      formData.append('mode', this.mode);
      formData.append('duration', duration.toString());

      // Upload audio
      const uploadRes = await fetch('/api/upload-audio-chunk', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        // Handle both old format (error.error.message) and new format (error)
        const errorMsg = errorData.error?.message || errorData.error || errorData.message || 'Upload failed';
        console.error('[AmbientRecorder] Upload error:', errorData);
        throw new Error(`${errorMsg} (${uploadRes.status})`);
      }

      const uploadData = await uploadRes.json();
      console.log('[AmbientRecorder] Upload complete:', uploadData);

      // Update processing message
      this.updateProcessingMessage('transcribing your conversation...');

      // Process and enhance
      const processRes = await fetch('/api/process-ambient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId: this.userId,
          userNotes: this.userNotes,
          meetingTitle: `Meeting ${new Date().toLocaleDateString()}`,
          mode: this.mode,
          duration: duration,
        }),
      });

      if (!processRes.ok) {
        const error = await processRes.json().catch(() => ({}));
        throw new Error(error.message || 'Processing failed: ' + processRes.status);
      }

      // Handle SSE response
      const result = await this.handleSSEResponse(processRes);

      // Call completion callback with result
      if (this.onComplete) {
        try {
          await this.onComplete({
            ...result,
            duration,
            mode: this.mode,
            userNotes: this.userNotes,
            sessionId,
          });
        } catch (error) {
          console.error('[AmbientRecorder] onComplete error:', error);
        }
      }

      // Close modal after processing
      this.close();

    } catch (error) {
      console.error('[AmbientRecorder] Processing failed:', error);
      this.showError(error);
    }
  },

  /**
   * Handle SSE response from process-ambient API
   * @param {Response} response - Fetch response
   * @returns {Object} Processed result
   */
  async handleSSEResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let transcript = '';
    let enhancedContent = '';
    let noteId = null;
    let threads = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'status':
                this.updateProcessingMessage(data.message || 'processing...');
                break;
              case 'transcript':
                transcript = data.text;
                this.updateProcessingMessage('enhancing your notes...');
                break;
              case 'content':
                enhancedContent += data.text;
                break;
              case 'threads':
                threads = data.items || [];
                break;
              case 'note_created':
                noteId = data.noteId;
                console.log('[AmbientRecorder] Note created:', noteId);
                break;
              case 'done':
                console.log('[AmbientRecorder] Processing complete');
                break;
              case 'error':
                throw new Error(data.error?.message || 'Processing failed');
            }
          } catch (parseError) {
            // Skip malformed JSON
            if (parseError.message !== 'Processing failed') {
              console.warn('[AmbientRecorder] SSE parse error:', parseError);
            } else {
              throw parseError;
            }
          }
        }
      }
    }

    return {
      transcript,
      enhancedContent,
      noteId,
      threads,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Update the processing message
   * @param {string} message - Message to display
   */
  updateProcessingMessage(message) {
    const messageEl = document.querySelector('.processing-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  },

  /**
   * Show error state
   * @param {Error} error - The error
   */
  showError(error) {
    const modal = document.getElementById('ambient-recorder-modal');
    if (!modal) return;

    const errorMessage = modal.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.textContent = error.message || 'An unexpected error occurred.';
    }

    this.showState('error');
  },

  /**
   * Close the modal
   */
  close() {
    console.log('[AmbientRecorder] Closing...');

    // Stop any active recording
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop audio stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // Clear timer
    clearInterval(this.timerInterval);

    // Remove modal
    const modal = document.getElementById('ambient-recorder-modal');
    if (modal) {
      modal.remove();
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Reset state
    this.state = 'idle';
    this.mode = null;
    this.audioChunks = [];
    this.userNotes = '';

    // Call close callback
    if (this.onClose) {
      this.onClose();
    }
  },
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AmbientRecorder.init());
} else {
  AmbientRecorder.init();
}

// Make globally available
window.AmbientRecorder = AmbientRecorder;
