/**
 * Digital Twin - Voice Input Module
 * Uses Web Speech API for voice-to-text
 */

const Voice = {
  // State
  isRecording: false,
  recognition: null,
  silenceTimer: null,
  transcript: '',

  // Settings
  SILENCE_TIMEOUT: 10000, // 10 seconds

  /**
   * Initialize voice module
   */
  init() {
    this.voiceBtn = document.getElementById('voice-btn');
    this.voiceHint = document.querySelector('.voice-hint');
    this.transcriptDisplay = document.getElementById('transcript-display');
    this.textInput = document.getElementById('text-input');

    if (!this.isSupported()) {
      this.showUnsupportedMessage();
      return;
    }

    this.setupRecognition();
    this.setupEventListeners();
  },

  /**
   * Check if Web Speech API is supported
   * @returns {boolean}
   */
  isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  },

  /**
   * Show message for unsupported browsers
   */
  showUnsupportedMessage() {
    if (this.voiceHint) {
      this.voiceHint.textContent = 'Voice input not supported in this browser';
    }
    if (this.voiceBtn) {
      this.voiceBtn.disabled = true;
      this.voiceBtn.classList.add('disabled');
    }
  },

  /**
   * Set up SpeechRecognition instance
   */
  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configuration
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    // Event handlers
    this.recognition.onstart = () => {
      this.onRecordingStart();
    };

    this.recognition.onend = () => {
      this.onRecordingEnd();
    };

    this.recognition.onresult = (event) => {
      this.onResult(event);
    };

    this.recognition.onerror = (event) => {
      this.onError(event);
    };
  },

  /**
   * Set up button click handlers
   */
  setupEventListeners() {
    if (this.voiceBtn) {
      this.voiceBtn.addEventListener('click', () => {
        this.toggle();
      });
    }
  },

  /**
   * Toggle recording state
   */
  toggle() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  /**
   * Start voice recording
   */
  startRecording() {
    if (this.isRecording || !this.recognition) return;

    this.transcript = '';
    this.updateTranscriptDisplay('');

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      UI.showToast('Failed to start voice input');
    }
  },

  /**
   * Phase 4.7.1: Stop voice recording
   * Can be called externally (e.g., from submit button)
   */
  stopRecording() {
    if (!this.recognition) return;

    // Always clear timer and stop recognition
    this.clearSilenceTimer();

    if (this.isRecording) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Recognition stop error:', e);
      }
    }

    // Update state immediately (don't wait for onend event)
    this.isRecording = false;
  },

  /**
   * Phase 4.7.1: Called when recording starts
   */
  onRecordingStart() {
    this.isRecording = true;
    this.setButtonState('recording');
    this.updateHint('Listening... tap mic or send when done');
    this.resetSilenceTimer();
  },

  /**
   * Phase 4.7: Called when recording ends
   * Populates input field instead of auto-sending
   */
  onRecordingEnd() {
    this.isRecording = false;
    this.clearSilenceTimer();
    this.setButtonState('idle');
    this.updateHint('Tap to speak');

    // Clear transcript display
    this.updateTranscriptDisplay('');

    // Phase 4.7: Stop ALL recording UI states
    this.stopRecordingUI();

    // Phase 4.7: Populate input field instead of auto-sending
    if (this.transcript.trim()) {
      this.populateInputWithTranscript(this.transcript.trim());
    }
  },

  /**
   * Phase 4.7: Stop all recording UI states
   */
  stopRecordingUI() {
    // Remove recording class from all possible voice buttons
    const voiceBtns = document.querySelectorAll(
      '#notes-voice-btn, #voice-btn, .voice-btn, .notes-voice-btn, .mic-btn, [data-action="voice"]'
    );

    voiceBtns.forEach(btn => {
      btn.classList.remove('recording', 'is-recording', 'active');
      btn.setAttribute('aria-pressed', 'false');
    });

    // Stop any pulsing animation
    const pulseEls = document.querySelectorAll('.recording-pulse, .mic-pulse');
    pulseEls.forEach(el => el.remove());

    // Reset any recording indicator
    const indicators = document.querySelectorAll('.recording-indicator');
    indicators.forEach(ind => ind.style.display = 'none');

    console.log('Recording UI stopped');
  },

  /**
   * Phase 4.7: Populate input field with transcript
   * User can edit before sending
   */
  populateInputWithTranscript(transcript) {
    const input = document.getElementById('notes-quick-input') || this.textInput;

    if (input) {
      input.value = transcript;
      input.disabled = false;
      input.focus();

      // Move cursor to end
      input.setSelectionRange(input.value.length, input.value.length);

      console.log('Transcript populated in input:', transcript.substring(0, 50) + '...');
    }

    // Store voice data in case we need it when sending
    window.pendingVoiceData = {
      transcript: transcript,
      type: 'voice',
      timestamp: Date.now()
    };

    // Update hint
    this.updateHint('Edit if needed, then tap send');
  },

  /**
   * Legacy: Auto-process transcript (kept for backwards compatibility)
   * @param {string} transcript - Transcribed text
   * @deprecated Use populateInputWithTranscript instead
   */
  async autoProcessTranscript(transcript) {
    // Now just populates input - use populateInputWithTranscript
    this.populateInputWithTranscript(transcript);
  },

  /**
   * Handle speech recognition results
   * @param {SpeechRecognitionEvent} event
   */
  onResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    // Update stored transcript with final results
    if (finalTranscript) {
      this.transcript += finalTranscript;
    }

    // Display current state
    const displayText = this.transcript + interimTranscript;
    this.updateTranscriptDisplay(displayText);

    // Reset silence timer on any result
    this.resetSilenceTimer();
  },

  /**
   * Handle speech recognition errors
   * @param {SpeechRecognitionErrorEvent} event
   */
  onError(event) {
    console.error('Speech recognition error:', event.error);

    this.isRecording = false;
    this.clearSilenceTimer();
    this.setButtonState('idle');

    switch (event.error) {
      case 'not-allowed':
        this.updateHint('Microphone access denied');
        UI.showToast('Please allow microphone access');
        break;
      case 'no-speech':
        this.updateHint('No speech detected');
        break;
      case 'network':
        this.updateHint('Network error');
        UI.showToast('Network error - check connection');
        break;
      default:
        this.updateHint('Tap to speak');
    }
  },

  /**
   * Set button visual state
   * @param {'idle'|'recording'|'processing'} state
   */
  setButtonState(state) {
    if (!this.voiceBtn) return;

    // Remove all state classes
    this.voiceBtn.classList.remove('recording', 'processing');

    // Add new state class
    if (state !== 'idle') {
      this.voiceBtn.classList.add(state);
    }
  },

  /**
   * Update hint text below button
   * @param {string} text
   */
  updateHint(text) {
    if (this.voiceHint) {
      this.voiceHint.textContent = text;
    }
  },

  /**
   * Update transcript display
   * @param {string} text
   */
  updateTranscriptDisplay(text) {
    if (this.transcriptDisplay) {
      this.transcriptDisplay.textContent = text;
      this.transcriptDisplay.classList.toggle('visible', text.length > 0);
    }
  },

  /**
   * Reset silence timer (auto-stop after 10 seconds of silence)
   */
  resetSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, this.SILENCE_TIMEOUT);
  },

  /**
   * Clear silence timer
   */
  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
};

// Export for global access
window.Voice = Voice;
