/**
 * Voice Input Component
 * Phase 16: TASK-006 - Browser-based audio recording
 *
 * States:
 * - IDLE: Ready to record (gray mic icon)
 * - RECORDING: Active recording (black bg, white icon, pulse)
 * - TRANSCRIBING: Processing audio (loading state)
 *
 * Max recording: 2 minutes (auto-stop)
 */

class VoiceInput {
  /**
   * @param {HTMLElement} button - The voice button element
   * @param {Object} options - Configuration options
   * @param {Function} options.onRecordingComplete - Callback with audio blob
   * @param {Function} options.onError - Callback for errors
   * @param {Function} options.onStateChange - Callback for state changes
   * @param {number} options.maxDuration - Max recording time in ms (default: 120000)
   */
  constructor(button, options = {}) {
    this.button = button;
    this.onRecordingComplete = options.onRecordingComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.maxDuration = options.maxDuration || 120000; // 2 minutes

    this.state = 'idle'; // idle | recording | transcribing
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.autoStopTimeout = null;
    this.durationEl = null;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    if (!this.button) {
      console.error('[VoiceInput] No button provided');
      return;
    }

    // Create duration display element
    this.createDurationDisplay();

    // Attach event listeners
    this.attachListeners();

    // Set initial state
    this.updateUI();

    console.log('[VoiceInput] Initialized');
  }

  /**
   * Create the duration display element
   */
  createDurationDisplay() {
    // Find or create container for duration
    const container = this.button.parentElement;
    if (!container) return;

    // Check if duration element already exists
    this.durationEl = container.querySelector('.recording-duration');
    if (!this.durationEl) {
      this.durationEl = document.createElement('div');
      this.durationEl.className = 'recording-duration';
      this.durationEl.setAttribute('aria-live', 'polite');
      container.appendChild(this.durationEl);
    }
    this.durationEl.style.display = 'none';
  }

  /**
   * Attach event listeners
   */
  attachListeners() {
    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });

    // Keyboard accessibility
    this.button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Toggle recording state
   */
  async toggle() {
    if (this.state === 'idle') {
      await this.startRecording();
    } else if (this.state === 'recording') {
      this.stopRecording();
    }
    // Don't toggle if transcribing - wait for completion
  }

  /**
   * Start recording audio
   */
  async startRecording() {
    try {
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording not supported in this browser');
      }

      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      // Determine best audio format
      const mimeType = this.getSupportedMimeType();

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
      });
      this.chunks = [];

      // Handle data available
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        this.handleRecordingComplete();
      };

      // Handle errors
      this.mediaRecorder.onerror = (e) => {
        console.error('[VoiceInput] MediaRecorder error:', e);
        this.handleError(new Error('Recording failed'));
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.state = 'recording';
      this.startTime = Date.now();
      this.startTimer();
      this.updateUI();
      this.onStateChange(this.state);

      // Auto-stop at max duration
      this.autoStopTimeout = setTimeout(() => {
        if (this.state === 'recording') {
          console.log('[VoiceInput] Auto-stopping at max duration');
          this.stopRecording();
        }
      }, this.maxDuration);

      console.log('[VoiceInput] Recording started');

    } catch (error) {
      console.error('[VoiceInput] Failed to start recording:', error);
      this.handleError(error);
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.state === 'recording') {
      // Clear auto-stop timeout
      if (this.autoStopTimeout) {
        clearTimeout(this.autoStopTimeout);
        this.autoStopTimeout = null;
      }

      this.stopTimer();
      this.mediaRecorder.stop();
      this.state = 'transcribing';
      this.updateUI();
      this.onStateChange(this.state);

      console.log('[VoiceInput] Recording stopped');
    }
  }

  /**
   * Handle recording completion
   */
  handleRecordingComplete() {
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Create audio blob
    const mimeType = this.getSupportedMimeType();
    const blob = new Blob(this.chunks, { type: mimeType });
    this.chunks = [];

    console.log(`[VoiceInput] Recording complete: ${(blob.size / 1024).toFixed(1)}KB`);

    // Call completion callback
    this.onRecordingComplete(blob);
  }

  /**
   * Handle errors
   * @param {Error} error
   */
  handleError(error) {
    this.cleanup();
    this.state = 'idle';
    this.updateUI();
    this.onStateChange(this.state);

    // Provide user-friendly error messages
    let message = 'Recording failed';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message = 'Microphone permission denied. Please allow access to record.';
    } else if (error.name === 'NotFoundError') {
      message = 'No microphone found. Please connect a microphone.';
    } else if (error.message) {
      message = error.message;
    }

    this.onError(new Error(message));
  }

  /**
   * Get supported audio MIME type
   * @returns {string}
   */
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Start the duration timer
   */
  startTimer() {
    if (this.durationEl) {
      this.durationEl.style.display = 'block';
      this.updateTimer();
    }

    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
  }

  /**
   * Stop the duration timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.durationEl) {
      this.durationEl.style.display = 'none';
    }
  }

  /**
   * Update the duration display
   */
  updateTimer() {
    if (!this.startTime || !this.durationEl) return;

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

    this.durationEl.textContent = formatted;

    // Update button aria-label for accessibility
    this.button.setAttribute('aria-label', `Recording: ${formatted}. Click to stop.`);
  }

  /**
   * Update UI based on current state
   */
  updateUI() {
    if (!this.button) return;

    // Remove all state classes
    this.button.classList.remove('idle', 'recording', 'transcribing');

    // Add current state class
    this.button.classList.add(this.state);

    // Update aria attributes
    switch (this.state) {
      case 'idle':
        this.button.setAttribute('aria-label', 'Start voice recording');
        this.button.setAttribute('aria-pressed', 'false');
        break;
      case 'recording':
        this.button.setAttribute('aria-pressed', 'true');
        break;
      case 'transcribing':
        this.button.setAttribute('aria-label', 'Transcribing audio...');
        this.button.setAttribute('aria-busy', 'true');
        break;
    }

    // Update button content based on state
    this.updateButtonContent();
  }

  /**
   * Update button icon/content based on state
   */
  updateButtonContent() {
    if (!this.button) return;

    const svg = this.button.querySelector('svg');
    if (!svg) return;

    if (this.state === 'transcribing') {
      // Show loading spinner
      this.button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="voice-spinner">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
            <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
          </circle>
        </svg>
      `;
    } else {
      // Show mic icon
      this.button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      `;
    }
  }

  /**
   * Set state to idle (called after transcription completes)
   */
  setIdle() {
    this.state = 'idle';
    this.updateUI();
    this.onStateChange(this.state);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopTimer();

    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.chunks = [];
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.cleanup();
    if (this.durationEl && this.durationEl.parentElement) {
      this.durationEl.remove();
    }
    console.log('[VoiceInput] Destroyed');
  }
}

// Make globally available
window.VoiceInput = VoiceInput;
