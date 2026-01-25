/**
 * js/loading-messages.js - Contextual Loading Messages
 *
 * Warm, contextual messages that rotate during loading states.
 * Makes users feel good with on-brand messaging.
 *
 * Style: poetic, lowercase, editorial (Cormorant Garamond italic)
 */

window.LoadingMessages = {
  // MIRROR tab loading
  mirror: [
    "reflecting on your patterns...",
    "connecting the threads...",
    "finding what matters most...",
    "listening between the lines...",
    "gathering your insights...",
    "seeing you clearly...",
    "tuning into your world...",
    "remembering what you've shared...",
    "tracing the connections...",
    "holding space for you..."
  ],

  // TWIN tab loading
  twin: [
    "building your portrait...",
    "assembling what makes you, you...",
    "mapping your universe...",
    "discovering your patterns...",
    "understanding your story...",
    "learning who you are...",
    "piecing together your world...",
    "finding the shape of you..."
  ],

  // Notes loading
  notes: [
    "gathering your thoughts...",
    "bringing back your notes...",
    "loading your reflections...",
    "retrieving your moments...",
    "finding your memories...",
    "collecting what you've shared..."
  ],

  // Analysis/reflection generation
  analysis: [
    "sitting with this...",
    "thinking alongside you...",
    "finding meaning...",
    "connecting dots...",
    "reflecting with you...",
    "listening carefully...",
    "processing what you shared...",
    "understanding deeply..."
  ],

  // Chat/conversation
  chat: [
    "considering your question...",
    "thinking about this...",
    "reflecting on that...",
    "finding the right words...",
    "gathering my thoughts...",
    "weighing what to say...",
    "formulating a response..."
  ],

  // Voice input
  voice: [
    "listening closely...",
    "hearing you...",
    "catching every word...",
    "taking it all in..."
  ],

  // Image processing
  image: [
    "seeing what's here...",
    "looking closely...",
    "studying the details...",
    "understanding the image..."
  ],

  // Generic fallback
  generic: [
    "one moment...",
    "almost there...",
    "working on it...",
    "just a second...",
    "bear with me..."
  ],

  // Meeting enhancement (TASK-005)
  meeting: [
    "weaving your thoughts together...",
    "finding the threads...",
    "structuring the conversation...",
    "connecting to your history...",
    "enhancing with context...",
    "organizing the chaos...",
    "turning fragments into form...",
    "reading between your lines...",
    "gathering what matters...",
    "building the picture..."
  ],

  // Note enhancement
  note: [
    "listening to your thoughts...",
    "finding the meaning...",
    "connecting the dots...",
    "reflecting on your words...",
    "understanding the context...",
    "weaving your narrative...",
    "discovering patterns...",
    "building understanding..."
  ],

  /**
   * Get a random message for a context
   * @param {string} context - The loading context (mirror, twin, notes, analysis, chat, etc.)
   * @returns {string} A random message for the context
   */
  get(context = 'generic') {
    const messages = this[context] || this.generic;
    return messages[Math.floor(Math.random() * messages.length)];
  },

  /**
   * Start message rotation on an element
   * @param {string} context - The loading context
   * @param {HTMLElement} element - The element to update
   * @param {number} interval - Rotation interval in ms (default 3000)
   * @returns {Function} Cleanup function to stop rotation
   */
  startRotation(context, element, interval = 3000) {
    if (!element) return () => {};

    // Set initial message
    element.textContent = this.get(context);

    // Rotate messages
    const timer = setInterval(() => {
      // Fade out
      element.style.opacity = '0';

      setTimeout(() => {
        // Change text while invisible
        element.textContent = this.get(context);
        // Fade in
        element.style.opacity = '1';
      }, 150);
    }, interval);

    // Return cleanup function
    return () => clearInterval(timer);
  },

  /**
   * Create a loading message element with dots
   * @param {string} context - The loading context
   * @returns {string} HTML string for the loading element
   */
  createHTML(context) {
    const message = this.get(context);
    return `
      <div class="loading-message-container">
        <span class="loading-message" style="transition: opacity 0.15s ease;">${message}</span>
        <span class="loading-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </span>
      </div>
    `;
  }
};

/**
 * LoadingMessagesRotator class
 * Class-based interface for meeting/note enhancement loading states
 * Displays rotating contextual messages with fade animation
 */
class LoadingMessagesRotator {
  /**
   * @param {HTMLElement} container - Container to render messages into
   * @param {string} type - 'meeting' or 'note'
   */
  constructor(container, type = 'meeting') {
    this.container = container;
    this.type = type;
    this.currentIndex = 0;
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Get messages array for current type
   */
  get messages() {
    return window.LoadingMessages[this.type] || window.LoadingMessages.generic;
  }

  /**
   * Start rotating messages
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Shuffle starting index for variety
    this.currentIndex = Math.floor(Math.random() * this.messages.length);

    this.render();

    // Rotate every 3 seconds
    this.interval = setInterval(() => {
      this.fadeOut(() => {
        this.currentIndex = (this.currentIndex + 1) % this.messages.length;
        this.render();
        this.fadeIn();
      });
    }, 3000);

    console.log(`[LoadingMessagesRotator] Started (${this.type})`);
  }

  /**
   * Stop rotating messages
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;

    // Fade out before clearing
    this.fadeOut(() => {
      if (this.container) {
        this.container.innerHTML = '';
      }
    });

    console.log('[LoadingMessagesRotator] Stopped');
  }

  /**
   * Render current message
   */
  render() {
    if (!this.container) return;

    const message = this.messages[this.currentIndex];
    this.container.innerHTML = `
      <div class="loading-container">
        <p class="loading-message" id="loading-rotator-msg">${message}</p>
      </div>
    `;
  }

  /**
   * Fade out animation
   * @param {Function} callback - Called after fade completes
   */
  fadeOut(callback) {
    const msgEl = this.container?.querySelector('#loading-rotator-msg');
    if (msgEl) {
      msgEl.style.opacity = '0';
      setTimeout(callback, 150);
    } else {
      callback();
    }
  }

  /**
   * Fade in animation
   */
  fadeIn() {
    const msgEl = this.container?.querySelector('#loading-rotator-msg');
    if (msgEl) {
      msgEl.style.opacity = '1';
    }
  }
}

// Make class globally available
window.LoadingMessagesRotator = LoadingMessagesRotator;

console.log('[LoadingMessages] Module loaded');
