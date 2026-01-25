/**
 * Enhanced Output Display Component
 * Phase 16: TASK-004 - Enhanced meeting output with streaming support
 *
 * Displays enhanced meeting notes with:
 * - Progressive streaming content
 * - Section headers (DISCUSSED, ACTION ITEMS, NOTED)
 * - Inscript Context section
 * - Action buttons (Try Again, Save)
 */

class EnhanceDisplay {
  constructor(container) {
    this.container = container;
    this.content = '';
    this.context = [];
    this.metadata = null;
    this.noteId = null;
    this.processingTime = 0;
    this.onTryAgainCallback = null;
    this.onSaveCallback = null;

    // Initialize container structure
    this.init();
  }

  /**
   * Initialize the display container structure
   */
  init() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="enhanced-output">
        <div class="enhanced-header">
          <div class="enhanced-header-left">
            <h3 class="enhanced-title" id="ed-title">Processing...</h3>
            <p class="enhanced-date" id="ed-date"></p>
          </div>
          <span class="enhanced-badge">enhanced</span>
        </div>
        <div class="enhanced-body" id="ed-body">
          <div class="enhanced-streaming-cursor"></div>
        </div>
        <div class="inscript-context hidden" id="ed-context">
          <h4 class="inscript-context-header">INSCRIPT CONTEXT</h4>
          <div class="inscript-context-items" id="ed-context-items"></div>
        </div>
        <div class="enhanced-actions hidden" id="ed-actions">
          <button class="btn-ghost" id="ed-try-again" type="button">Try Again</button>
          <button class="btn-primary" id="ed-save" type="button">Save</button>
        </div>
      </div>
    `;

    this.container.classList.remove('hidden');

    // Cache DOM references
    this.titleEl = this.container.querySelector('#ed-title');
    this.dateEl = this.container.querySelector('#ed-date');
    this.bodyEl = this.container.querySelector('#ed-body');
    this.contextEl = this.container.querySelector('#ed-context');
    this.contextItemsEl = this.container.querySelector('#ed-context-items');
    this.actionsEl = this.container.querySelector('#ed-actions');
    this.tryAgainBtn = this.container.querySelector('#ed-try-again');
    this.saveBtn = this.container.querySelector('#ed-save');

    // Attach button listeners
    this.tryAgainBtn?.addEventListener('click', () => {
      if (this.onTryAgainCallback) this.onTryAgainCallback();
    });

    this.saveBtn?.addEventListener('click', () => {
      if (this.onSaveCallback) this.onSaveCallback(this.noteId, this.content, this.metadata);
    });

    console.log('[EnhanceDisplay] Initialized');
  }

  /**
   * Set metadata from API response
   * @param {Object} metadata - Title, date, attendees
   */
  setMetadata(metadata) {
    this.metadata = metadata;
    this.renderHeader();
  }

  /**
   * Append streaming content
   * @param {string} text - Content chunk to append
   */
  appendContent(text) {
    this.content += text;
    this.renderContent();
  }

  /**
   * Add a context item (for Inscript Context section)
   * @param {Object} item - Context item with type, text, subtext, link
   */
  addContextItem(item) {
    this.context.push(item);
    this.renderContext();
  }

  /**
   * Mark streaming as complete
   * @param {string} noteId - Generated note ID
   * @param {number} processingTime - Time in ms
   */
  complete(noteId, processingTime) {
    this.noteId = noteId;
    this.processingTime = processingTime;

    // Update date with processing time
    if (this.dateEl && this.metadata?.date) {
      const seconds = (processingTime / 1000).toFixed(1);
      this.dateEl.textContent = `${this.metadata.date} • Enhanced in ${seconds}s`;
    }

    // Remove streaming cursor
    const cursor = this.bodyEl?.querySelector('.enhanced-streaming-cursor');
    if (cursor) cursor.remove();

    // Show action buttons
    this.renderActions();

    console.log(`[EnhanceDisplay] Complete - noteId: ${noteId}, time: ${processingTime}ms`);
  }

  /**
   * Render the header section
   */
  renderHeader() {
    if (!this.metadata) return;

    if (this.titleEl) {
      this.titleEl.textContent = this.metadata.title || 'Meeting Notes';
    }

    if (this.dateEl) {
      let dateStr = this.metadata.date || new Date().toISOString().split('T')[0];
      if (this.metadata.attendees?.length) {
        dateStr += ` • ${this.metadata.attendees.join(', ')}`;
      }
      this.dateEl.textContent = dateStr;
    }
  }

  /**
   * Render the main content body
   */
  renderContent() {
    if (!this.bodyEl) return;

    const formattedHtml = this.formatContent(this.content);

    // Preserve streaming cursor if not complete
    const cursorHtml = this.noteId ? '' : '<span class="enhanced-streaming-cursor"></span>';

    this.bodyEl.innerHTML = formattedHtml + cursorHtml;
  }

  /**
   * Format content with proper HTML structure
   * @param {string} content - Raw content from API
   * @returns {string} Formatted HTML
   */
  formatContent(content) {
    let html = content
      // Remove h1 headers (title shown in header)
      .replace(/^#\s+.+\n?/gm, '')
      // Date line with bold
      .replace(/\*\*Date:\*\*/g, '<strong>Date:</strong>')
      // Markdown h2 headers (## DISCUSSED)
      .replace(/^##\s+([A-Z][A-Z\s]*[A-Z])\s*$/gm, '<h4 class="enhanced-section-header">$1</h4>')
      // Bold headers (**DISCUSSED**)
      .replace(/\*\*([A-Z][A-Z\s]+)\*\*/g, '<h4 class="enhanced-section-header">$1</h4>')
      // Regular bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Action items with arrow
      .replace(/^→\s+(.+)$/gm, '<div class="enhanced-action-item"><span class="action-arrow">→</span> $1</div>')
      // Warning items
      .replace(/^⚠️\s*(.+)$/gm, '<div class="enhanced-warning-item"><span class="warning-icon">⚠️</span> $1</div>')
      // Bullet points
      .replace(/^[-•]\s+(.+)$/gm, '<div class="enhanced-bullet-item"><span class="bullet">•</span> $1</div>')
      // Line breaks
      .replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Render the Inscript Context section
   */
  renderContext() {
    if (!this.contextEl || !this.contextItemsEl || this.context.length === 0) return;

    this.contextEl.classList.remove('hidden');

    const itemsHtml = this.context.map(item => {
      const icon = this.getContextIcon(item.type);
      const linkHtml = item.link
        ? `<a href="${item.link}" class="context-link" target="_blank">View</a>`
        : '';
      const subtextHtml = item.subtext
        ? `<span class="subtext">${item.subtext}</span>`
        : '';

      return `
        <div class="inscript-context-item">
          <span class="context-icon">${icon}</span>
          <span class="context-text">${item.text}</span>
          ${linkHtml}
          ${subtextHtml}
        </div>
      `;
    }).join('');

    this.contextItemsEl.innerHTML = itemsHtml;
  }

  /**
   * Get icon for context item type
   * @param {string} type - info, warning, link
   * @returns {string} Icon character
   */
  getContextIcon(type) {
    switch (type) {
      case 'warning': return '⚠️';
      case 'link': return '🔗';
      case 'info':
      default: return 'ℹ️';
    }
  }

  /**
   * Render action buttons
   */
  renderActions() {
    if (!this.actionsEl) return;
    this.actionsEl.classList.remove('hidden');
  }

  /**
   * Set callback for Try Again button
   * @param {Function} callback
   */
  onTryAgain(callback) {
    this.onTryAgainCallback = callback;
  }

  /**
   * Set callback for Save button
   * @param {Function} callback - Receives (noteId, content, metadata)
   */
  onSave(callback) {
    this.onSaveCallback = callback;
  }

  /**
   * Show error state
   * @param {string} message - Error message
   * @param {string} rawInput - Original input to preserve
   */
  showError(message, rawInput) {
    if (!this.bodyEl) return;

    this.bodyEl.innerHTML = `
      <div class="enhanced-error">
        <p class="enhanced-error-message">${message}</p>
        ${rawInput ? `
          <div class="enhanced-error-raw">
            <p class="enhanced-error-label">Your original notes:</p>
            <pre class="enhanced-error-content">${rawInput}</pre>
          </div>
        ` : ''}
      </div>
    `;

    // Show try again button on error
    if (this.actionsEl) {
      this.actionsEl.classList.remove('hidden');
      if (this.saveBtn) this.saveBtn.style.display = 'none';
    }
  }

  /**
   * Reset the display
   */
  reset() {
    this.content = '';
    this.context = [];
    this.metadata = null;
    this.noteId = null;
    this.processingTime = 0;
    this.init();
  }

  /**
   * Destroy the display
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container.classList.add('hidden');
    }
  }
}

// Make globally available
window.EnhanceDisplay = EnhanceDisplay;
