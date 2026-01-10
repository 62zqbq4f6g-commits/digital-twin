/**
 * Digital Twin - Camera/Image Capture Handler
 * Handles image selection, preview, and Vision API processing
 */

const Camera = {
  currentImage: null,
  isRecordingContext: false,
  contextRecognition: null,
  contextTranscript: '',

  /**
   * Initialize camera module
   */
  init() {
    this.setupEventListeners();
    this.setupContextVoice();
  },

  /**
   * Set up event listeners for image capture
   */
  setupEventListeners() {
    const imageBtn = document.getElementById('image-btn');
    const imageInput = document.getElementById('image-input');
    const removeBtn = document.getElementById('remove-image');
    const processBtn = document.getElementById('process-image-btn');

    imageBtn?.addEventListener('click', () => imageInput?.click());
    imageInput?.addEventListener('change', (e) => this.handleImageSelect(e));
    removeBtn?.addEventListener('click', () => this.clearImage());
    processBtn?.addEventListener('click', () => this.processImage());
  },

  /**
   * Set up voice input for context
   */
  setupContextVoice() {
    const voiceBtn = document.getElementById('image-voice-btn');
    if (!voiceBtn) return;

    // Check if speech recognition is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      voiceBtn.style.display = 'none';
      return;
    }

    // Set up speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.contextRecognition = new SpeechRecognition();
    this.contextRecognition.continuous = true;
    this.contextRecognition.interimResults = true;
    this.contextRecognition.lang = 'en-US';

    this.contextRecognition.onstart = () => this.onContextRecordStart();
    this.contextRecognition.onend = () => this.onContextRecordEnd();
    this.contextRecognition.onresult = (e) => this.onContextResult(e);
    this.contextRecognition.onerror = (e) => this.onContextError(e);

    voiceBtn.addEventListener('click', () => this.toggleContextVoice());
  },

  /**
   * Toggle context voice recording
   */
  toggleContextVoice() {
    if (this.isRecordingContext) {
      this.stopContextVoice();
    } else {
      this.startContextVoice();
    }
  },

  /**
   * Start context voice recording
   */
  startContextVoice() {
    if (!this.contextRecognition || this.isRecordingContext) return;
    this.contextTranscript = '';
    try {
      this.contextRecognition.start();
    } catch (e) {
      console.error('Failed to start context voice:', e);
    }
  },

  /**
   * Stop context voice recording
   */
  stopContextVoice() {
    if (!this.contextRecognition || !this.isRecordingContext) return;
    this.contextRecognition.stop();
  },

  /**
   * Handle context recording start
   */
  onContextRecordStart() {
    this.isRecordingContext = true;
    const btn = document.getElementById('image-voice-btn');
    btn?.classList.add('recording');
  },

  /**
   * Handle context recording end
   */
  onContextRecordEnd() {
    this.isRecordingContext = false;
    const btn = document.getElementById('image-voice-btn');
    const contextInput = document.getElementById('image-context');
    const transcriptDisplay = document.getElementById('image-transcript-display');

    btn?.classList.remove('recording');

    // Transfer transcript to context input
    if (this.contextTranscript.trim() && contextInput) {
      // Append to existing text with a space
      const existing = contextInput.value.trim();
      contextInput.value = existing ? `${existing} ${this.contextTranscript.trim()}` : this.contextTranscript.trim();
    }

    // Clear transcript display
    if (transcriptDisplay) {
      transcriptDisplay.textContent = '';
      transcriptDisplay.classList.remove('visible');
    }
  },

  /**
   * Handle context voice results
   */
  onContextResult(event) {
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

    if (finalTranscript) {
      this.contextTranscript += finalTranscript;
    }

    // Show interim results
    const transcriptDisplay = document.getElementById('image-transcript-display');
    if (transcriptDisplay) {
      const displayText = this.contextTranscript + interimTranscript;
      transcriptDisplay.textContent = displayText;
      transcriptDisplay.classList.toggle('visible', displayText.length > 0);
    }
  },

  /**
   * Handle context voice errors
   */
  onContextError(event) {
    console.error('Context voice error:', event.error);
    this.isRecordingContext = false;
    const btn = document.getElementById('image-voice-btn');
    btn?.classList.remove('recording');

    if (event.error === 'not-allowed') {
      UI.showToast('Microphone access denied');
    }
  },

  /**
   * Handle image file selection
   * @param {Event} event - File input change event
   */
  handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select an image file');
      return;
    }

    // Validate file size (max 5MB for API)
    if (file.size > 5 * 1024 * 1024) {
      UI.showToast('Image too large. Max 5MB.');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentImage = {
        base64: e.target.result,
        type: file.type,
        name: file.name
      };
      this.showPreview();
    };
    reader.readAsDataURL(file);
  },

  /**
   * Show image preview and switch to image section
   */
  showPreview() {
    const previewImg = document.getElementById('image-preview');
    const captureSection = document.getElementById('capture-section');
    const imageSection = document.getElementById('image-section');

    if (previewImg && this.currentImage) {
      previewImg.src = this.currentImage.base64;
    }

    captureSection?.classList.add('hidden');
    imageSection?.classList.remove('hidden');
  },

  /**
   * Clear current image and return to capture view
   */
  clearImage() {
    // Stop voice recording if active
    if (this.isRecordingContext) {
      this.stopContextVoice();
    }
    this.contextTranscript = '';

    this.currentImage = null;
    const captureSection = document.getElementById('capture-section');
    const imageSection = document.getElementById('image-section');
    const imageInput = document.getElementById('image-input');
    const contextInput = document.getElementById('image-context');
    const transcriptDisplay = document.getElementById('image-transcript-display');

    captureSection?.classList.remove('hidden');
    imageSection?.classList.add('hidden');

    if (imageInput) imageInput.value = '';
    if (contextInput) contextInput.value = '';
    if (transcriptDisplay) {
      transcriptDisplay.textContent = '';
      transcriptDisplay.classList.remove('visible');
    }
  },

  /**
   * Process image through Vision API
   */
  async processImage() {
    if (!this.currentImage) return;

    const contextInput = document.getElementById('image-context');
    const context = contextInput?.value || '';

    UI.showProcessing('Analyzing image...');

    try {
      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: this.currentImage.base64,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error('Vision API failed');
      }

      const result = await response.json();

      // Create and save note
      const note = this.createImageNote(result);
      await DB.saveNote(note);

      UI.hideProcessing();
      UI.showToast('Image processed!');
      this.clearImage();

      // Show the result in note detail
      UI.openNoteDetail(note.id);

    } catch (error) {
      console.error('Vision processing error:', error);
      UI.hideProcessing();
      UI.showToast('Failed to process image');
    }
  },

  /**
   * Create note object from vision result
   * @param {Object} visionResult - Result from Vision API
   * @returns {Object} Note object
   */
  createImageNote(visionResult) {
    const now = new Date();

    return {
      id: DB.generateId(),
      version: '1.0',
      timestamps: {
        created_at: now.toISOString(),
        input_date: now.toISOString().split('T')[0],
        input_time: now.toTimeString().slice(0, 5),
        input_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' })
      },
      input: {
        type: 'image',
        raw_text: visionResult.extracted_text || '',
        image_description: visionResult.description,
        image_thumbnail: this.currentImage.base64
      },
      classification: {
        category: visionResult.category || 'personal',
        confidence: visionResult.confidence || 0.7,
        reasoning: 'Classified by Vision API'
      },
      extracted: {
        title: visionResult.title || 'Image Capture',
        topics: visionResult.topics || [],
        action_items: visionResult.action_items || [],
        sentiment: visionResult.sentiment || 'neutral',
        people: visionResult.people || []
      },
      refined: {
        summary: visionResult.summary || visionResult.description,
        formatted_output: visionResult.formatted_output || `# ${visionResult.title}\n\n${visionResult.description}`
      }
    };
  }
};

// Export for global access
window.Camera = Camera;
