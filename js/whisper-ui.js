/**
 * Whisper UI - Quick Capture Mode
 * Phase 15: Experience Transformation
 *
 * Provides frictionless note capture without triggering full reflection.
 * Supports text and voice input.
 * All whispers are E2E encrypted using the same key as notes.
 */

const WhisperUI = {
  // State
  isOpen: false,
  isSaving: false,
  selectedWhispers: new Set(),
  whisperHistory: [],

  // Voice recording state
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  audioStream: null,

  // Speech recognition state (for real-time preview)
  recognition: null,
  useSpeechRecognition: false,
  baseTranscript: '',

  /**
   * Initialize Whisper UI
   */
  init() {
    console.log('[WhisperUI] Initializing...');
    this.injectHTML();
    this.attachListeners();
    this.initSpeechRecognition();
    console.log('[WhisperUI] Initialized');
  },

  /**
   * Initialize Web Speech API for real-time transcription preview
   */
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.log('[WhisperUI] Speech recognition not supported, using Whisper only');
      this.useSpeechRecognition = false;
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const textarea = document.getElementById('whisper-input');
      if (!textarea) return;

      let interimTranscript = '';
      let finalTranscript = this.baseTranscript || '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          this.baseTranscript = finalTranscript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show final + interim text
      textarea.value = finalTranscript + interimTranscript;

      // Enable submit button if we have content
      const submitBtn = document.getElementById('whisper-submit');
      if (submitBtn) {
        submitBtn.disabled = !textarea.value.trim();
      }
    };

    this.recognition.onerror = (event) => {
      console.log('[WhisperUI] Speech recognition error:', event.error);
      // Continue with Whisper-only mode on error
    };

    this.recognition.onend = () => {
      // Restart if still recording (recognition auto-stops after silence)
      if (this.isRecording && this.useSpeechRecognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.log('[WhisperUI] Could not restart recognition');
        }
      }
    };

    this.useSpeechRecognition = true;
    console.log('[WhisperUI] Speech recognition initialized');
  },

  /**
   * Inject HTML templates
   */
  injectHTML() {
    // Whisper overlay
    if (!document.getElementById('whisper-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'whisper-overlay';
      overlay.className = 'whisper-overlay';
      overlay.innerHTML = `
        <div class="whisper-modal">
          <div class="whisper-header">
            <h2 class="whisper-title">Whisper</h2>
            <button class="whisper-close" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="whisper-form">
            <div class="whisper-input-container">
              <textarea
                id="whisper-input"
                class="whisper-input"
                placeholder="Quick thought..."
                rows="3"
                maxlength="500"
                aria-label="Whisper content"
              ></textarea>
              <button type="button" class="whisper-mic-btn" id="whisper-mic-btn" aria-label="Record voice">
                <svg class="mic-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <svg class="stop-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
            </div>
            <p class="whisper-hint">No reflection. Just captured.</p>
            <button id="whisper-submit" class="whisper-submit" disabled>
              Save
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Whisper confirmation
    if (!document.getElementById('whisper-confirmation')) {
      const confirmation = document.createElement('div');
      confirmation.id = 'whisper-confirmation';
      confirmation.className = 'whisper-confirmation';
      confirmation.innerHTML = `
        <div class="whisper-confirmation__content">
          <div class="whisper-confirmation__check">&#10003;</div>
          <p class="whisper-confirmation__text">Heard</p>
        </div>
      `;
      document.body.appendChild(confirmation);
    }

    // Selection bar (for batch reflect)
    if (!document.getElementById('whisper-selection-bar')) {
      const selectionBar = document.createElement('div');
      selectionBar.id = 'whisper-selection-bar';
      selectionBar.className = 'whisper-selection-bar';
      selectionBar.innerHTML = `
        <span class="whisper-selection-bar__count">0 selected</span>
        <button class="whisper-selection-bar__btn whisper-selection-bar__btn--reflect">Reflect</button>
        <button class="whisper-selection-bar__btn whisper-selection-bar__btn--clear">&times;</button>
      `;
      document.body.appendChild(selectionBar);
    }
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Global click handler
    document.addEventListener('click', (e) => {
      // Whisper trigger button
      if (e.target.closest('.whisper-trigger')) {
        this.open();
        return;
      }

      // Close button
      if (e.target.closest('.whisper-close')) {
        this.close();
        return;
      }

      // Overlay background click
      if (e.target.id === 'whisper-overlay') {
        this.close();
        return;
      }

      // Submit button
      if (e.target.id === 'whisper-submit' || e.target.closest('#whisper-submit')) {
        this.save();
        return;
      }

      // Whisper item selection (in history)
      const whisperItem = e.target.closest('.whisper-item');
      if (whisperItem && !e.target.closest('.whisper-item__entity')) {
        const id = whisperItem.dataset.id;
        if (id) this.toggleSelection(id);
        return;
      }

      // Batch reflect button
      if (e.target.closest('.whisper-selection-bar__btn--reflect')) {
        this.batchReflect();
        return;
      }

      // Clear selection button
      if (e.target.closest('.whisper-selection-bar__btn--clear')) {
        this.clearSelection();
        return;
      }

      // Mic button for voice recording
      if (e.target.closest('#whisper-mic-btn')) {
        e.preventDefault();
        this.toggleVoiceRecording();
        return;
      }
    });

    // Input change handler
    const input = document.getElementById('whisper-input');
    if (input) {
      input.addEventListener('input', (e) => {
        const submitBtn = document.getElementById('whisper-submit');
        if (submitBtn) {
          submitBtn.disabled = !e.target.value.trim();
        }
      });

      // Enter key to submit (with shift for newline)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (e.target.value.trim()) {
            this.save();
          }
        }
      });
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  },

  /**
   * Open whisper mode
   */
  open() {
    const overlay = document.getElementById('whisper-overlay');
    const input = document.getElementById('whisper-input');
    const modal = overlay?.querySelector('.whisper-modal');

    if (overlay) {
      overlay.classList.add('whisper-overlay--visible');
      this.isOpen = true;

      // Reset scroll position
      if (modal) {
        modal.scrollTop = 0;
      }

      // Focus input after animation, prevent scroll jump
      setTimeout(() => {
        if (input) {
          input.value = '';
          input.focus({ preventScroll: true });
        }
      }, 100);
    }
  },

  /**
   * Close whisper mode
   */
  close() {
    const overlay = document.getElementById('whisper-overlay');
    if (overlay) {
      overlay.classList.remove('whisper-overlay--visible');
      this.isOpen = false;
    }

    // Stop any active recording
    if (this.isRecording) {
      this.stopVoiceRecording(false); // Don't transcribe on close
    }
  },

  // ===== VOICE RECORDING =====

  /**
   * Toggle voice recording on/off
   */
  toggleVoiceRecording() {
    if (this.isRecording) {
      this.stopVoiceRecording(true);
    } else {
      this.startVoiceRecording();
    }
  },

  /**
   * Start voice recording with real-time transcription preview
   */
  async startVoiceRecording() {
    console.log('[WhisperUI] Starting voice recording...');

    const textarea = document.getElementById('whisper-input');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      this.audioStream = stream;
      this.audioChunks = [];

      // Determine best audio format
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('[WhisperUI] MediaRecorder stopped');
      };

      // Collect chunks every second for better Whisper fallback
      this.mediaRecorder.start(1000);

      // Start speech recognition for real-time preview
      if (this.useSpeechRecognition && this.recognition) {
        // Store current text as base
        this.baseTranscript = textarea ? textarea.value : '';
        try {
          this.recognition.start();
          console.log('[WhisperUI] Speech recognition started');
        } catch (e) {
          console.log('[WhisperUI] Recognition already running');
        }
      }

      this.isRecording = true;
      this.updateMicButtonState();

      // Add visual indicator for live transcription
      if (textarea) {
        textarea.classList.add('transcribing');
      }

      console.log('[WhisperUI] Recording started');

    } catch (error) {
      console.error('[WhisperUI] Mic access error:', error);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Could not access microphone');
      }
    }
  },

  /**
   * Stop voice recording and optionally transcribe
   * @param {boolean} shouldTranscribe - Whether to send for transcription
   */
  async stopVoiceRecording(shouldTranscribe = true) {
    console.log('[WhisperUI] Stopping voice recording...');

    const textarea = document.getElementById('whisper-input');

    // Stop speech recognition first
    if (this.recognition) {
      try {
        this.recognition.stop();
        console.log('[WhisperUI] Speech recognition stopped');
      } catch (e) {
        // Already stopped
      }
    }

    // Remove visual indicator
    if (textarea) {
      textarea.classList.remove('transcribing');
    }

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.isRecording = false;
      this.updateMicButtonState();
      return;
    }

    // Create a promise to wait for the recorder to stop
    const stopPromise = new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        resolve();
      };
    });

    this.mediaRecorder.stop();
    await stopPromise;

    // Stop audio stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.isRecording = false;
    this.updateMicButtonState();

    // Only use Whisper fallback if speech recognition didn't capture anything
    // This saves API calls when live transcription worked
    if (shouldTranscribe && this.audioChunks.length > 0) {
      const hasContent = textarea && textarea.value.trim().length > 0;
      const hadContentBefore = this.baseTranscript && this.baseTranscript.trim().length > 0;
      const speechRecognitionWorked = hasContent && !hadContentBefore;

      if (!hasContent || !this.useSpeechRecognition) {
        // No content or speech recognition not available - use Whisper
        console.log('[WhisperUI] Using Whisper for transcription');
        const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
        await this.transcribeAudio(audioBlob);
      } else {
        console.log('[WhisperUI] Speech recognition captured content, skipping Whisper');
      }
    }

    // Reset base transcript
    this.baseTranscript = '';

    this.audioChunks = [];
  },

  /**
   * Transcribe audio blob and append to textarea
   * @param {Blob} audioBlob - The recorded audio
   */
  async transcribeAudio(audioBlob) {
    const input = document.getElementById('whisper-input');
    const submitBtn = document.getElementById('whisper-submit');

    if (!input) return;

    // Show transcribing state
    const originalPlaceholder = input.placeholder;
    input.placeholder = 'Transcribing...';
    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'whisper-recording.webm');

      // Get user ID if available
      const userId = await this.getUserId();
      if (userId) {
        formData.append('userId', userId);
      }

      const response = await fetch('/api/transcribe-voice', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.text) {
        // Append transcribed text
        const currentText = input.value.trim();
        const separator = currentText ? ' ' : '';
        input.value = currentText + separator + result.text;

        // Enable submit if we have content
        if (submitBtn) {
          submitBtn.disabled = !input.value.trim();
        }

        console.log('[WhisperUI] Transcription complete:', result.text.length, 'chars');
      } else {
        throw new Error(result.error?.message || 'Transcription failed');
      }

    } catch (error) {
      console.error('[WhisperUI] Transcription error:', error);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Could not transcribe audio');
      }
    } finally {
      input.placeholder = originalPlaceholder;
      if (submitBtn) {
        submitBtn.disabled = !input.value.trim();
      }
    }
  },

  /**
   * Update mic button visual state
   */
  updateMicButtonState() {
    const micBtn = document.getElementById('whisper-mic-btn');
    if (!micBtn) return;

    const micIcon = micBtn.querySelector('.mic-icon');
    const stopIcon = micBtn.querySelector('.stop-icon');

    if (this.isRecording) {
      micBtn.classList.add('recording');
      if (micIcon) micIcon.style.display = 'none';
      if (stopIcon) stopIcon.style.display = 'block';
    } else {
      micBtn.classList.remove('recording');
      if (micIcon) micIcon.style.display = 'block';
      if (stopIcon) stopIcon.style.display = 'none';
    }
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
   * Save a whisper
   */
  async save() {
    if (this.isSaving) return;

    const input = document.getElementById('whisper-input');
    const content = input?.value?.trim();

    if (!content) return;

    this.isSaving = true;
    const submitBtn = document.getElementById('whisper-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      // Encrypt content
      const encrypted = await this.encryptWhisper(content);

      // Get user ID and auth token
      const userId = await this.getUserId();
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        throw new Error('No auth token available');
      }

      // Save to API
      const response = await fetch('/api/whisper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content_encrypted: encrypted.content,
          iv: encrypted.iv
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save whisper');
      }

      console.log('[WhisperUI] Whisper saved:', data.id);

      // Show confirmation
      this.close();
      this.showConfirmation();

      // Clear input
      if (input) input.value = '';

    } catch (error) {
      console.error('[WhisperUI] Save error:', error);
      UI.showToast('Couldn\'t save whisper — try again');
    } finally {
      this.isSaving = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Heard';
      }
    }
  },

  /**
   * Show confirmation animation
   */
  showConfirmation() {
    const confirmation = document.getElementById('whisper-confirmation');
    if (confirmation) {
      confirmation.classList.add('whisper-confirmation--visible');

      // Hide after delay
      setTimeout(() => {
        confirmation.classList.remove('whisper-confirmation--visible');
      }, 1500);
    }
  },

  /**
   * Load whisper history
   */
  async loadHistory(container) {
    try {
      const userId = await this.getUserId();
      if (!userId) {
        this.renderEmptyState(container);
        return;
      }

      // Get auth token for API call
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        console.warn('[WhisperUI] No auth token available');
        this.renderEmptyState(container);
        return;
      }

      const response = await fetch(`/api/whisper?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load whispers');
      }

      this.whisperHistory = data.whispers || [];

      if (this.whisperHistory.length === 0) {
        this.renderEmptyState(container);
      } else {
        await this.renderHistory(container);
      }
    } catch (error) {
      console.error('[WhisperUI] Load history error:', error);
      this.renderEmptyState(container, 'Unable to load whispers');
    }
  },

  /**
   * Render whisper history
   */
  async renderHistory(container) {
    if (!container) return;

    const items = await Promise.all(
      this.whisperHistory.map(async (whisper) => {
        // Decrypt content
        let content = '';
        let isEncrypted = false;
        try {
          content = await this.decryptWhisper(whisper.content_encrypted, whisper.iv);
        } catch (e) {
          console.warn('[WhisperUI] Could not decrypt whisper:', whisper.id);
          isEncrypted = true;
        }

        const time = this.formatTime(whisper.created_at);
        const isSelected = this.selectedWhispers.has(whisper.id);
        const entities = whisper.entities_extracted || [];

        // Encrypted whispers show differently and can't be selected
        if (isEncrypted) {
          return `
            <div class="whisper-item whisper-item--encrypted" data-id="${whisper.id}">
              <p class="whisper-item__content whisper-item__content--encrypted">Encrypted on another device</p>
              <div class="whisper-item__meta">
                <span class="whisper-item__time">${time}</span>
              </div>
            </div>
          `;
        }

        return `
          <div class="whisper-item ${isSelected ? 'whisper-item--selected' : ''}" data-id="${whisper.id}">
            <p class="whisper-item__content">${this.escapeHtml(content)}</p>
            <div class="whisper-item__meta">
              <span class="whisper-item__time">${time}</span>
              ${entities.length > 0 ? `
                <div class="whisper-item__entities">
                  ${entities.slice(0, 3).map(e => `<span class="whisper-item__entity">${e}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      })
    );

    container.innerHTML = `
      <div class="whisper-history__header">
        <h3 class="whisper-history__title">Recent Whispers</h3>
        <button class="whisper-history__reflect-btn" ${this.selectedWhispers.size === 0 ? 'disabled' : ''}>
          Reflect on Selected
        </button>
      </div>
      <div class="whisper-list">
        ${items.join('')}
      </div>
    `;
  },

  /**
   * Render empty state
   */
  renderEmptyState(container, message) {
    if (!container) return;

    container.innerHTML = `
      <div class="whisper-empty">
        <p class="whisper-empty__message">${message || 'Your whispers will appear here'}</p>
        <p class="whisper-empty__hint">Quick thoughts, no reflection needed.</p>
      </div>
    `;
  },

  /**
   * Toggle whisper selection
   */
  toggleSelection(id) {
    // Don't allow selecting encrypted whispers
    const item = document.querySelector(`.whisper-item[data-id="${id}"]`);
    if (item && item.classList.contains('whisper-item--encrypted')) {
      return;
    }

    if (this.selectedWhispers.has(id)) {
      this.selectedWhispers.delete(id);
    } else {
      this.selectedWhispers.add(id);
    }

    // Update UI
    if (item) {
      item.classList.toggle('whisper-item--selected', this.selectedWhispers.has(id));
    }

    this.updateSelectionBar();
  },

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedWhispers.clear();

    // Update UI
    document.querySelectorAll('.whisper-item--selected').forEach(item => {
      item.classList.remove('whisper-item--selected');
    });

    this.updateSelectionBar();
  },

  /**
   * Update selection bar visibility and count
   */
  updateSelectionBar() {
    const bar = document.getElementById('whisper-selection-bar');
    if (!bar) return;

    const count = this.selectedWhispers.size;

    if (count > 0) {
      bar.classList.add('whisper-selection-bar--visible');
      bar.querySelector('.whisper-selection-bar__count').textContent = `${count} selected`;
    } else {
      bar.classList.remove('whisper-selection-bar--visible');
    }
  },

  /**
   * Batch reflect on selected whispers
   */
  async batchReflect() {
    if (this.selectedWhispers.size === 0) return;

    const reflectBtn = document.querySelector('.whisper-selection-bar__btn--reflect');
    if (reflectBtn) {
      reflectBtn.disabled = true;
      reflectBtn.textContent = 'Reflecting...';
    }

    try {
      const userId = await this.getUserId();
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        throw new Error('No auth token available');
      }

      // Get decrypted contents
      const whisperIds = Array.from(this.selectedWhispers);
      const decryptedContents = [];

      for (const id of whisperIds) {
        const whisper = this.whisperHistory.find(w => w.id === id);
        if (whisper) {
          try {
            const content = await this.decryptWhisper(whisper.content_encrypted, whisper.iv);
            decryptedContents.push(content);
          } catch (e) {
            console.warn('[WhisperUI] Could not decrypt whisper:', id);
          }
        }
      }

      if (decryptedContents.length === 0) {
        throw new Error('No whispers could be decrypted');
      }

      // Call batch reflect API
      const response = await fetch('/api/whisper-reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          whisper_ids: whisperIds,
          decrypted_contents: decryptedContents
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reflection');
      }

      console.log('[WhisperUI] Batch reflection generated');

      // Show reflection in a modal or dialog
      this.showReflection(data.reflection);

      // Clear selection
      this.clearSelection();

    } catch (error) {
      console.error('[WhisperUI] Batch reflect error:', error);
      UI.showToast('Couldn\'t generate reflection — try again');
    } finally {
      if (reflectBtn) {
        reflectBtn.disabled = false;
        reflectBtn.textContent = 'Reflect';
      }
    }
  },

  /**
   * Show reflection result
   */
  showReflection(reflection) {
    // Create a simple modal for the reflection
    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">Reflection</h3>
          <button class="modal__close">&times;</button>
        </div>
        <div class="modal__body">
          <p class="reflection-text">${this.escapeHtml(reflection)}</p>
        </div>
      </div>
    `;

    // Close handler
    modal.addEventListener('click', (e) => {
      if (e.target.closest('.modal__close') || e.target === modal) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
  },

  // ===== ENCRYPTION HELPERS =====

  /**
   * Encrypt whisper content
   * Returns { content: base64, iv: base64 }
   */
  async encryptWhisper(plaintext) {
    // Use PIN encryption key if available, fall back to Auth
    const key = this.getEncryptionKey();
    if (!key) {
      throw new Error('Encryption key not available');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );

    return {
      content: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
  },

  /**
   * Decrypt whisper content
   */
  async decryptWhisper(contentB64, ivB64) {
    const key = this.getEncryptionKey();
    if (!key) {
      throw new Error('Encryption key not available');
    }

    const content = Uint8Array.from(atob(contentB64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      content
    );

    return new TextDecoder().decode(decrypted);
  },

  /**
   * Get encryption key
   */
  getEncryptionKey() {
    // Try PIN first, then Auth
    if (typeof PIN !== 'undefined' && PIN.encryptionKey) {
      return PIN.encryptionKey;
    }
    if (typeof Auth !== 'undefined' && Auth.encryptionKey) {
      return Auth.encryptionKey;
    }
    return null;
  },

  // ===== HELPERS =====

  /**
   * Get user ID
   */
  async getUserId() {
    if (typeof Sync !== 'undefined' && Sync.user?.id) {
      return Sync.user.id;
    }
    return null;
  },

  /**
   * Format timestamp
   */
  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WhisperUI.init());
} else {
  WhisperUI.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WhisperUI;
}
