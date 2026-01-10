/**
 * Digital Twin - Camera/Image Capture Handler
 * Handles image selection, preview, and Vision API processing
 */

const Camera = {
  currentImage: null,

  /**
   * Initialize camera module
   */
  init() {
    this.setupEventListeners();
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
    this.currentImage = null;
    const captureSection = document.getElementById('capture-section');
    const imageSection = document.getElementById('image-section');
    const imageInput = document.getElementById('image-input');
    const contextInput = document.getElementById('image-context');

    captureSection?.classList.remove('hidden');
    imageSection?.classList.add('hidden');

    if (imageInput) imageInput.value = '';
    if (contextInput) contextInput.value = '';
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
