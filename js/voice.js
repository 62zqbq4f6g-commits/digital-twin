/**
 * Inscript - Voice Input Module
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
   * Safari-compatible: detects browser and adjusts settings
   */
  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Detect Safari (uses webkit prefix)
    const isSafari = !window.SpeechRecognition && window.webkitSpeechRecognition;
    console.log('[Voice] Browser detection - Safari:', isSafari);

    // Configuration
    // Safari note: continuous mode may not work well on mobile Safari
    this.recognition.continuous = !isSafari; // Disable continuous for Safari
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    // Safari fix: If not continuous, we need to restart on end
    this.isSafari = isSafari;

    // Event handlers
    this.recognition.onstart = () => {
      console.log('[Voice] Recognition started');
      this.onRecordingStart();
    };

    this.recognition.onend = () => {
      console.log('[Voice] Recognition ended, isRecording:', this.isRecording);
      // Safari fix: If still recording but recognition ended, restart
      if (this.isSafari && this.isRecording && this.transcript) {
        console.log('[Voice] Safari: Recognition ended with transcript, populating input');
        this.isRecording = false;
        this.onRecordingEnd();
      } else if (this.isSafari && this.isRecording) {
        console.log('[Voice] Safari: Restarting recognition');
        try {
          this.recognition.start();
        } catch (e) {
          console.warn('[Voice] Safari restart failed:', e);
          this.onRecordingEnd();
        }
      } else {
        this.onRecordingEnd();
      }
    };

    this.recognition.onresult = (event) => {
      console.log('[Voice] Got result event');
      this.onResult(event);
    };

    this.recognition.onerror = (event) => {
      console.error('[Voice] Error:', event.error);
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
      UI.showToast('Couldn\'t start recording — check microphone');
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
   * Phase 11.5: Auto-punctuate voice transcript
   * Adds capitalization and basic punctuation for cleaner text
   * Conservative approach: only applies safe transformations
   * @param {string} text - Raw transcript from speech recognition
   * @returns {string} - Punctuated transcript
   */
  autoPunctuate(text) {
    if (!text || !text.trim()) return text;

    let result = text.trim();

    // 1. Fix common contractions (Web Speech API sometimes splits them)
    result = result.replace(/\bi m\b/gi, "I'm");
    result = result.replace(/\bdon t\b/gi, "don't");
    result = result.replace(/\bwon t\b/gi, "won't");
    result = result.replace(/\bcan t\b/gi, "can't");
    result = result.replace(/\bisn t\b/gi, "isn't");
    result = result.replace(/\baren t\b/gi, "aren't");
    result = result.replace(/\bdoesn t\b/gi, "doesn't");
    result = result.replace(/\bdidn t\b/gi, "didn't");
    result = result.replace(/\bwasn t\b/gi, "wasn't");
    result = result.replace(/\bweren t\b/gi, "weren't");
    result = result.replace(/\bhaven t\b/gi, "haven't");
    result = result.replace(/\bhasn t\b/gi, "hasn't");
    result = result.replace(/\bit s\b/gi, "it's");
    result = result.replace(/\bthat s\b/gi, "that's");
    result = result.replace(/\bwhat s\b/gi, "what's");
    result = result.replace(/\bhere s\b/gi, "here's");
    result = result.replace(/\bthere s\b/gi, "there's");
    result = result.replace(/\blet s\b/gi, "let's");
    result = result.replace(/\bi ve\b/gi, "I've");
    result = result.replace(/\bi d\b/gi, "I'd");
    result = result.replace(/\bi ll\b/gi, "I'll");
    result = result.replace(/\byou re\b/gi, "you're");
    result = result.replace(/\bwe re\b/gi, "we're");
    result = result.replace(/\bthey re\b/gi, "they're");
    result = result.replace(/\bwould ve\b/gi, "would've");
    result = result.replace(/\bcould ve\b/gi, "could've");
    result = result.replace(/\bshould ve\b/gi, "should've");

    // 2. Ensure standalone "I" is always capitalized
    result = result.replace(/\bi\b/g, 'I');

    // 3. Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);

    // 4. Clean up multiple spaces
    result = result.replace(/\s+/g, ' ');

    // 5. Add period at end if no punctuation exists
    if (!/[.!?]$/.test(result)) {
      result += '.';
    }

    // 6. Capitalize after existing periods
    result = result.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());

    console.log('[Voice] Auto-punctuated:', result.substring(0, 80));
    return result;
  },

  /**
   * Phase 4.7: Populate input field with transcript
   * User can edit before sending
   * Safari-compatible: dispatches input event after setting value
   */
  populateInputWithTranscript(transcript) {
    const input = document.getElementById('notes-quick-input') || this.textInput;

    // Phase 11.5: Apply auto-punctuation
    const punctuatedTranscript = this.autoPunctuate(transcript);
    console.log('[Voice] Safari fix: populating input with transcript:', punctuatedTranscript?.substring(0, 50));

    if (input) {
      // Set the value with punctuated transcript
      input.value = punctuatedTranscript;
      input.disabled = false;

      // Safari fix: Dispatch input event to notify any listeners
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Safari fix: Also dispatch change event for good measure
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Focus and move cursor to end
      input.focus();

      // Safari fix: Use setTimeout to ensure focus works on mobile Safari
      setTimeout(() => {
        input.setSelectionRange(input.value.length, input.value.length);
      }, 100);

      console.log('[Voice] Input value set to:', input.value?.substring(0, 50));
    } else {
      console.error('[Voice] No input element found!');
    }

    // Store voice data in case we need it when sending (use punctuated version)
    window.pendingVoiceData = {
      transcript: punctuatedTranscript,
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
