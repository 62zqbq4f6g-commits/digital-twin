/**
 * js/mirror.js - Phase 13B: MIRROR Tab
 * "Your reflection, looking back."
 *
 * Handles MIRROR tab UI and conversation flow
 */

class Mirror {
  constructor() {
    this.conversationId = null;
    this.messages = [];
    this.isLoading = false;
    this.noteCount = 0;
    this.container = null;
  }

  /**
   * Initialize MIRROR tab
   */
  init() {
    this.container = document.getElementById('mirror-container');
    if (!this.container) {
      console.warn('[Mirror] Container not found');
      return;
    }

    this.attachEventListeners();
    console.log('[Mirror] Initialized');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Input handling is done dynamically after render
  }

  /**
   * Open MIRROR tab - initialize or resume conversation
   */
  async open() {
    if (!Sync?.user?.id) {
      this.renderAuthRequired();
      return;
    }

    this.isLoading = true;
    this.render();

    try {
      const response = await fetch('/api/mirror?action=open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Sync.user.id })
      });

      if (!response.ok) {
        throw new Error(`Failed to open MIRROR: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Mirror] Opened:', data);

      this.conversationId = data.conversationId;
      this.noteCount = data.noteCount || 0;
      this.messages = data.previousMessages || [];

      // Track MIRROR opened
      if (typeof SignalTracker !== 'undefined') {
        SignalTracker.trackMirrorOpened(this.conversationId, data.opening?.type || 'presence');
      }

      // Add opening message if new conversation
      if (data.isNewConversation && data.opening?.message) {
        this.messages.push({
          id: 'opening',
          role: 'inscript',
          content: data.opening.message,
          type: 'prompt',
          promptButtons: data.opening.promptButtons
        });
      }

      this.isLoading = false;
      this.render();

    } catch (error) {
      console.error('[Mirror] Open error:', error);
      this.isLoading = false;
      this.renderError('Unable to connect. Please try again.');
    }
  }

  /**
   * Send a message
   */
  async sendMessage(content, context = null) {
    if (!content.trim() || !this.conversationId) return;

    // Add user message to UI immediately
    this.messages.push({
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      type: 'response'
    });

    // Track user message
    if (typeof SignalTracker !== 'undefined') {
      SignalTracker.trackMirrorMessage(this.conversationId, 'user', content.trim().length);
    }

    this.isLoading = true;
    this.render();
    this.scrollToBottom();

    try {
      const response = await fetch('/api/mirror?action=message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Sync.user.id,
          conversation_id: this.conversationId,
          message: content.trim(),
          context
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Mirror] Response:', data);

      // Add Inscript response
      this.messages.push({
        id: data.messageId,
        role: 'inscript',
        content: data.response.content,
        type: data.response.insightType,
        referencedNotes: data.response.referencedNotes
      });

      // Track Inscript response
      if (typeof SignalTracker !== 'undefined') {
        SignalTracker.trackMirrorMessage(this.conversationId, 'inscript', data.response.content?.length || 0);
      }

      this.isLoading = false;
      this.render();
      this.scrollToBottom();

    } catch (error) {
      console.error('[Mirror] Send error:', error);
      this.isLoading = false;

      // Add error message
      this.messages.push({
        id: 'error-' + Date.now(),
        role: 'inscript',
        content: "I'm having trouble thinking clearly right now. Can we try again?",
        type: 'error'
      });

      this.render();
    }
  }

  /**
   * Start fresh conversation
   */
  async startFresh() {
    if (this.conversationId) {
      // Close current conversation
      try {
        await fetch('/api/mirror?action=close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: Sync.user.id,
            conversation_id: this.conversationId
          })
        });
      } catch (error) {
        console.warn('[Mirror] Failed to close conversation:', error);
      }
    }

    // Reset state
    this.conversationId = null;
    this.messages = [];

    // Open new conversation
    await this.open();
  }

  /**
   * Handle prompt button click
   */
  async handlePromptButton(action, data = {}) {
    switch (action) {
      case 'explore':
      case 'continue':
        // User wants to explore the topic
        this.sendMessage("Yes, let's explore that.");
        break;

      case 'dismiss':
        // User dismisses the prompt
        this.sendMessage("Not right now. What else is on your mind?");
        break;

      case 'fresh':
        await this.startFresh();
        break;

      case 'confirm_pattern':
        if (data.patternId) {
          await this.confirmPattern(data.patternId);
          this.sendMessage("That resonates. Tell me more about what that means for you.");
        }
        break;

      case 'reject_pattern':
        if (data.patternId) {
          await this.rejectPattern(data.patternId);
          this.sendMessage("That doesn't quite fit. What would be more accurate?");
        }
        break;

      default:
        console.warn('[Mirror] Unknown action:', action);
    }
  }

  /**
   * Confirm pattern from MIRROR prompt
   */
  async confirmPattern(patternId) {
    try {
      await fetch('/api/user-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Sync.user.id,
          pattern_id: patternId,
          action: 'confirm'
        })
      });

      // Track signal
      if (typeof SignalTracker !== 'undefined') {
        SignalTracker.track('pattern_confirmed', { patternId });
      }
    } catch (error) {
      console.warn('[Mirror] Failed to confirm pattern:', error);
    }
  }

  /**
   * Reject pattern from MIRROR prompt
   */
  async rejectPattern(patternId) {
    try {
      await fetch('/api/user-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Sync.user.id,
          pattern_id: patternId,
          action: 'reject'
        })
      });

      // Track signal
      if (typeof SignalTracker !== 'undefined') {
        SignalTracker.track('pattern_rejected', { patternId });
      }
    } catch (error) {
      console.warn('[Mirror] Failed to reject pattern:', error);
    }
  }

  /**
   * Render MIRROR tab
   */
  render() {
    if (!this.container) return;

    if (this.isLoading && this.messages.length === 0) {
      this.container.innerHTML = this.renderLoading();
      return;
    }

    const isNewUser = this.noteCount < 5;
    const hasMessages = this.messages.length > 0;

    this.container.innerHTML = `
      <div class="mirror-wrapper">
        <header class="mirror-header">
          <h2 class="mirror-title">MIRROR</h2>
          ${hasMessages ? `
            <button class="mirror-refresh-btn" onclick="window.Mirror.startFresh()" aria-label="Start fresh conversation">
              <span class="mirror-refresh-icon">↻</span>
            </button>
          ` : ''}
        </header>

        <div class="mirror-conversation" id="mirror-conversation">
          ${!hasMessages && isNewUser ? this.renderNewUserState() : ''}
          ${!hasMessages && !isNewUser ? this.renderEmptyState() : ''}
          ${this.renderMessages()}
          ${this.isLoading ? this.renderTypingIndicator() : ''}
        </div>

        <div class="mirror-input-area">
          <div class="mirror-input-container">
            <textarea
              class="mirror-input"
              id="mirror-input"
              placeholder="${isNewUser ? "What's on your mind?" : "What would you like to explore?"}"
              rows="1"
              aria-label="Your message"
            ></textarea>
            <button class="mirror-send-btn" id="mirror-send-btn" aria-label="Send message">
              <span class="mirror-send-icon">→</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindInputHandlers();
  }

  /**
   * Render new user welcome state
   */
  renderNewUserState() {
    return `
      <div class="mirror-welcome">
        <div class="mirror-welcome-icon">◯</div>
        <h3 class="mirror-welcome-title">Mirror</h3>
        <p class="mirror-welcome-text">
          I'm still getting to know you.
        </p>
        <p class="mirror-welcome-text">
          The more you share in Notes, the richer our conversations will become.
        </p>
        <p class="mirror-welcome-text mirror-welcome-subtle">
          But I'm here whenever you want to talk.
        </p>
      </div>
    `;
  }

  /**
   * Render empty state (user has notes but no conversation)
   */
  renderEmptyState() {
    return `
      <div class="mirror-welcome">
        <div class="mirror-welcome-icon">◯</div>
        <h3 class="mirror-welcome-title">Mirror</h3>
        <p class="mirror-welcome-text">
          I'm here. What would you like to explore?
        </p>
      </div>
    `;
  }

  /**
   * Render conversation messages
   */
  renderMessages() {
    if (this.messages.length === 0) return '';

    return this.messages.map(msg => this.renderMessage(msg)).join('');
  }

  /**
   * Render a single message
   */
  renderMessage(msg) {
    const isInscript = msg.role === 'inscript';
    const bubbleClass = isInscript ? 'mirror-bubble-inscript' : 'mirror-bubble-user';

    let buttonsHtml = '';
    if (msg.promptButtons && msg.promptButtons.length > 0) {
      buttonsHtml = `
        <div class="mirror-prompt-buttons">
          ${msg.promptButtons.map(btn => `
            <button
              class="mirror-prompt-btn"
              onclick="window.Mirror.handlePromptButton('${btn.action}', ${JSON.stringify(btn).replace(/"/g, '&quot;')})"
              role="button"
            >
              ${this.escapeHtml(btn.label)}
            </button>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="mirror-message ${isInscript ? 'mirror-message-inscript' : 'mirror-message-user'}">
        <div class="mirror-bubble ${bubbleClass}">
          <p class="mirror-bubble-text">${this.escapeHtml(msg.content)}</p>
          ${buttonsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render typing indicator
   */
  renderTypingIndicator() {
    return `
      <div class="mirror-message mirror-message-inscript">
        <div class="mirror-bubble mirror-bubble-inscript mirror-typing">
          <span class="mirror-typing-dot"></span>
          <span class="mirror-typing-dot"></span>
          <span class="mirror-typing-dot"></span>
        </div>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    return `
      <div class="mirror-wrapper">
        <header class="mirror-header">
          <h2 class="mirror-title">MIRROR</h2>
        </header>
        <div class="mirror-loading">
          <div class="mirror-loading-spinner"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render auth required state
   */
  renderAuthRequired() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mirror-wrapper">
        <header class="mirror-header">
          <h2 class="mirror-title">MIRROR</h2>
        </header>
        <div class="mirror-auth-required">
          <p>Sign in to access MIRROR.</p>
        </div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError(message) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="mirror-wrapper">
        <header class="mirror-header">
          <h2 class="mirror-title">MIRROR</h2>
        </header>
        <div class="mirror-error">
          <p>${this.escapeHtml(message)}</p>
          <button class="mirror-retry-btn" onclick="window.Mirror.open()">Try again</button>
        </div>
      </div>
    `;
  }

  /**
   * Bind input handlers
   */
  bindInputHandlers() {
    const input = document.getElementById('mirror-input');
    const sendBtn = document.getElementById('mirror-send-btn');

    if (input) {
      // Auto-expand textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });

      // Send on Enter (Shift+Enter for newline)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSend());
    }
  }

  /**
   * Handle send button click
   */
  handleSend() {
    const input = document.getElementById('mirror-input');
    if (!input) return;

    const content = input.value.trim();
    if (content) {
      this.sendMessage(content);
      input.value = '';
      input.style.height = 'auto';
    }
  }

  /**
   * Scroll conversation to bottom
   */
  scrollToBottom() {
    const conversation = document.getElementById('mirror-conversation');
    if (conversation) {
      setTimeout(() => {
        conversation.scrollTop = conversation.scrollHeight;
      }, 100);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Refresh MIRROR tab
   */
  refresh() {
    this.open();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.Mirror = new Mirror();
    window.Mirror.init();
  });
} else {
  window.Mirror = new Mirror();
  window.Mirror.init();
}
