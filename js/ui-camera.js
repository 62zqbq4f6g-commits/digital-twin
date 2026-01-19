/**
 * Inscript - Camera UI Module
 * Handles image capture, selection, and preview
 * Extracted from ui.js for modularity (Phase 10.9)
 */

const CameraUI = {
  // Pending image data
  pendingImage: null,
  pendingImageData: null,

  /**
   * Show camera options bottom sheet
   */
  showOptions() {
    const sheet = document.createElement('div');
    sheet.className = 'camera-sheet';
    sheet.innerHTML = `
      <div class="camera-sheet-overlay" onclick="CameraUI.closeSheet()"></div>
      <div class="camera-sheet-content">
        <div class="drag-handle"></div>
        <button class="camera-option" onclick="CameraUI.takePhoto()">
          <span>📷</span> Take Photo
        </button>
        <button class="camera-option" onclick="CameraUI.chooseFromLibrary()">
          <span>🖼️</span> Photo Library
        </button>
        <button class="camera-option" onclick="CameraUI.chooseFile()">
          <span>📁</span> Choose File
        </button>
        <button class="camera-option cancel" onclick="CameraUI.closeSheet()">
          Cancel
        </button>
      </div>
    `;
    document.body.appendChild(sheet);

    // Trigger animation
    requestAnimationFrame(() => {
      sheet.classList.add('open');
    });
  },

  /**
   * Close camera sheet
   */
  closeSheet() {
    const sheet = document.querySelector('.camera-sheet');
    if (sheet) {
      sheet.classList.remove('open');
      setTimeout(() => sheet.remove(), 300);
    }
  },

  /**
   * Take photo with camera (front camera for selfie)
   */
  takePhoto() {
    this.closeSheet();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'user'; // 'user' for front camera, 'environment' for back
    input.onchange = (e) => this.handleImageSelected(e);
    input.click();
  },

  /**
   * Choose from photo library
   */
  chooseFromLibrary() {
    this.closeSheet();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.handleImageSelected(e);
    input.click();
  },

  /**
   * Choose any file
   */
  chooseFile() {
    this.closeSheet();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.onchange = (e) => this.handleImageSelected(e);
    input.click();
  },

  /**
   * Handle image selection with compression
   */
  async handleImageSelected(event) {
    console.log('[CameraUI] Image capture start');
    const file = event.target.files[0];
    if (!file) {
      console.log('[CameraUI] No file selected');
      return;
    }

    console.log('[CameraUI] Processing file:', file.name, file.size, 'bytes');

    try {
      // Read file as data URL
      const rawData = await this.readFileAsDataURL(file);
      console.log('[CameraUI] File read complete, length:', rawData?.length);

      if (!rawData) {
        console.error('[CameraUI] No data from file read');
        return;
      }

      // Compress
      console.log('[CameraUI] Compressing image...');
      const compressed = await this.compressImage(rawData);
      console.log('[CameraUI] Compression complete, length:', compressed?.length);

      if (!compressed) {
        console.error('[CameraUI] Compression returned null');
        return;
      }

      // Store and show preview
      this.pendingImageData = compressed;
      window.pendingImageData = compressed;

      console.log('[CameraUI] Showing preview...');
      this.showPreview(compressed);
      console.log('[CameraUI] Image capture complete');

    } catch (err) {
      console.error('[CameraUI] Image capture failed:', err);
      UI.showToast('Could not load image');
    }
  },

  /**
   * Read file as data URL
   */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('[CameraUI] FileReader onload fired');
        resolve(e.target.result);
      };
      reader.onerror = (e) => {
        console.error('[CameraUI] FileReader error:', e);
        reject(e);
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Load image with retry logic
   * @param {string} src - Image source
   * @param {number} maxRetries - Max retry attempts
   * @returns {Promise<HTMLImageElement>} Loaded image element
   */
  async loadImageWithRetry(src, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[CameraUI] Image load attempt ${attempt}/${maxRetries}`);

        const result = await new Promise((resolve, reject) => {
          const img = new Image();

          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 3000);

          img.onload = () => {
            clearTimeout(timeout);
            resolve(img);
          };

          img.onerror = (e) => {
            clearTimeout(timeout);
            reject(new Error('Image load failed'));
          };

          img.src = src;
        });

        console.log('[CameraUI] Image loaded successfully');
        return result;

      } catch (error) {
        console.warn(`[CameraUI] Attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry
        await new Promise(r => setTimeout(r, 500));
      }
    }
  },

  /**
   * Compress image with retry logic
   * @param {string} dataUrl - Image data URL
   * @returns {Promise<string>} Compressed data URL
   */
  async compressImage(dataUrl) {
    try {
      // Try to load image with retry
      const img = await this.loadImageWithRetry(dataUrl, 2);

      const maxSize = 1200;
      let width = img.width;
      let height = img.height;

      console.log('[CameraUI] Original dimensions:', width, 'x', height);

      // Only resize if larger
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        console.log('[CameraUI] Resized to:', width, 'x', height);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', 0.7);

      console.log('[CameraUI] Compression result:', {
        original: dataUrl.length,
        compressed: compressed.length,
        reduction: Math.round((1 - compressed.length / dataUrl.length) * 100) + '%'
      });

      return compressed;

    } catch (error) {
      console.error('[CameraUI] Compression failed, using original:', error);
      return dataUrl;
    }
  },

  /**
   * Show image preview with X button
   * @param {string} dataUrl - Image data URL
   */
  showPreview(dataUrl) {
    console.log('[CameraUI] showPreview called');

    if (!dataUrl) {
      console.error('[CameraUI] No image data to preview');
      return false;
    }

    // Store globally
    window.pendingImageData = dataUrl;
    this.pendingImageData = dataUrl;

    let preview = document.getElementById('notes-image-preview');

    // Create preview container if it doesn't exist
    if (!preview) {
      const captureRow = document.querySelector('.notes-capture-row');
      if (captureRow) {
        preview = document.createElement('div');
        preview.id = 'notes-image-preview';
        preview.className = 'notes-image-preview';
        captureRow.parentNode.insertBefore(preview, captureRow);
        console.log('[CameraUI] Created preview container');
      }
    }

    if (preview) {
      // Show loading state first
      preview.innerHTML = `
        <div class="preview-thumb loading">
          <div class="preview-loading"></div>
        </div>
      `;
      preview.style.display = 'flex';

      // Then load the actual image
      const img = new Image();
      img.onload = () => {
        console.log('[CameraUI] Preview image loaded');
        preview.innerHTML = `
          <div class="preview-thumb">
            <img src="${dataUrl}" alt="Preview">
            <button class="preview-remove" onclick="CameraUI.removePreview()" aria-label="Remove">×</button>
          </div>
        `;
      };
      img.onerror = () => {
        console.error('[CameraUI] Preview image failed to load');
        preview.innerHTML = `
          <div class="preview-thumb error">
            <span>!</span>
            <button class="preview-remove" onclick="CameraUI.removePreview()" aria-label="Remove">×</button>
          </div>
        `;
      };
      img.src = dataUrl;

    } else {
      console.error('[CameraUI] Could not find or create preview container');
      return false;
    }

    // Focus input for caption
    const input = document.getElementById('notes-quick-input');
    if (input) {
      input.placeholder = 'Add a caption...';
      input.focus();
    }

    return true;
  },

  /**
   * Remove image preview with proper cleanup
   */
  removePreview() {
    console.log('[CameraUI] removePreview called');

    const preview = document.getElementById('notes-image-preview');
    if (preview) {
      preview.style.display = 'none';
      const img = preview.querySelector('img');
      if (img) img.src = '';
    }

    this.pendingImage = null;
    this.pendingImageData = null;
    window.pendingImageData = null;

    // Reset input placeholder
    const input = document.getElementById('notes-quick-input');
    if (input) {
      input.placeholder = "What's on your mind?";
    }
  },

  /**
   * Show processing overlay
   * @param {string} message - Message to display
   */
  showProcessingOverlay(message) {
    // Remove existing overlay if any
    this.hideProcessingOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'processing-overlay';
    overlay.className = 'processing-overlay';
    overlay.innerHTML = `
      <div class="processing-content">
        <div class="processing-spinner"></div>
        <span class="processing-text">${message}</span>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  /**
   * Hide processing overlay
   */
  hideProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.remove();
  }
};

// Export for global access
window.CameraUI = CameraUI;

// Backward compatibility - delegate to UI object
window.showProcessingOverlay = function(message) {
  CameraUI.showProcessingOverlay(message);
};

window.hideProcessingOverlay = function() {
  CameraUI.hideProcessingOverlay();
};
