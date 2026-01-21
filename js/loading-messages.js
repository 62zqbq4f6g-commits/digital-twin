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

console.log('[LoadingMessages] Module loaded');
