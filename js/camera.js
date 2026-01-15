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

    console.log('[Camera] Setting up listeners:', {
      imageBtn: !!imageBtn,
      imageInput: !!imageInput,
      removeBtn: !!removeBtn,
      processBtn: !!processBtn
    });

    imageBtn?.addEventListener('click', () => {
      console.log('[Camera] Image button clicked');
      imageInput?.click();
    });
    imageInput?.addEventListener('change', (e) => {
      console.log('[Camera] Image selected:', e.target.files?.length);
      this.handleImageSelect(e);
    });
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
   * Compress an image file to reduce size for API upload
   * @param {File} file - Original image file
   * @param {number} maxSize - Max width/height in pixels (default 1024)
   * @param {number} quality - JPEG quality 0-1 (default 0.8)
   * @returns {Promise<Blob>} Compressed image blob
   */
  compressImage(file, maxSize = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            console.log('[Camera] Compressed:', Math.round(file.size / 1024), 'KB →', Math.round(blob.size / 1024), 'KB');
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  },

  /**
   * Handle image file selection
   * @param {Event} event - File input change event
   */
  async handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select an image file');
      return;
    }

    console.log('[Camera] Original file size:', Math.round(file.size / 1024), 'KB');

    try {
      // Compress large images (>300KB or from camera which are typically large)
      let imageToProcess = file;
      if (file.size > 300 * 1024) {
        UI.showToast('Compressing image...');
        imageToProcess = await this.compressImage(file, 1024, 0.7);
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        this.currentImage = {
          base64: e.target.result,
          type: 'image/jpeg', // After compression, always JPEG
          name: file.name
        };
        this.showPreview();
      };
      reader.readAsDataURL(imageToProcess);

    } catch (error) {
      console.error('[Camera] Compression error:', error);
      UI.showToast('Failed to process image');
    }
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
    console.log('[Camera] Processing image, currentImage:', !!this.currentImage);
    if (!this.currentImage) {
      console.error('[Camera] No image to process');
      UI.showToast('No image selected');
      return;
    }

    const contextInput = document.getElementById('image-context');
    const context = contextInput?.value || '';

    UI.showProcessing('Analyzing image...');

    try {
      console.log('[Camera] Calling Vision API...');
      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: this.currentImage.base64,
          context: context
        })
      });

      console.log('[Camera] Vision API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Camera] Vision API error:', errorData);
        const errorMsg = errorData.details || errorData.error || 'Unknown error';
        UI.hideProcessing();
        UI.showToast(`API Error: ${errorMsg.substring(0, 50)}`);
        return;
      }

      const result = await response.json();
      console.log('[Camera] Vision result:', result);

      // Check if result has an error property
      if (result.error) {
        console.error('[Camera] Vision API returned error:', result);
        UI.hideProcessing();
        UI.showToast(`Error: ${result.error}`);
        return;
      }

      // Create and save note
      const note = this.createImageNote(result);
      await DB.saveNote(note);

      // Store entities from vision (with relationship_to_user)
      if (result.entities && result.entities.length > 0 && typeof EntityMemory !== 'undefined') {
        console.log('[Camera] Storing entities from vision:', result.entities);
        for (const entity of result.entities) {
          try {
            const visualDesc = result.description || 'From photo';
            await EntityMemory.storeEntityWithVisual(
              {
                name: entity.name,
                type: entity.type,
                relationship_to_user: entity.relationship_to_user
              },
              visualDesc
            );
          } catch (err) {
            console.warn('[Camera] Entity storage failed:', err.message);
          }
        }
      }

      UI.hideProcessing();
      UI.showToast('Image processed!');
      this.clearImage();

      // Show the result in note detail
      UI.openNoteDetail(note.id);

    } catch (error) {
      console.error('[Camera] Vision processing error:', error);
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

    // Get original context and cleaned version
    const originalContext = visionResult.original_context || '';
    const cleanedContext = visionResult.cleaned_context || originalContext;
    const ocrText = visionResult.extracted_text || '';

    // Combine context and OCR text for raw_text
    const rawText = originalContext || ocrText;

    return {
      id: DB.generateId(),
      version: '1.0',
      imageData: this.currentImage.base64, // Store compressed image for display
      timestamps: {
        created_at: now.toISOString(),
        input_date: now.toISOString().split('T')[0],
        input_time: now.toTimeString().slice(0, 5),
        input_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' })
      },
      input: {
        type: 'image',
        raw_text: rawText,
        image_description: visionResult.description,
        extracted_text: ocrText
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
      },
      // Add analysis section so Phase3a format renders with ORIGINAL section
      analysis: {
        cleanedInput: cleanedContext || null,
        summary: visionResult.summary || visionResult.description,
        title: visionResult.title || 'Image Capture',
        actions: visionResult.action_items || [],
        category: visionResult.category || 'personal'
      }
    };
  }
};

// Export for global access
window.Camera = Camera;
