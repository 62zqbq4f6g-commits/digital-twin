/**
 * Inscript - Chat UI Module
 * Handles the "Go Deeper" chat bottom sheet (Socratic dialogue)
 * Extracted from ui.js for modularity (Phase 10.9)
 */

const ChatUI = {
  // Chat state
  chatHistory: [],
  currentChatMode: 'clarify',
  currentChatNoteId: null,

  /**
   * Open chat as a bottom sheet overlay
   * @param {string} noteId - Note ID
   */
  async open(noteId) {
    this.currentChatNoteId = noteId;

    // Create bottom sheet if it doesn't exist
    let overlay = document.getElementById('chat-overlay');
    let sheet = document.getElementById('chat-bottom-sheet');

    if (!sheet) {
      // Create overlay
      overlay = document.createElement('div');
      overlay.id = 'chat-overlay';
      overlay.className = 'chat-overlay';
      overlay.addEventListener('click', () => this.close());
      document.body.appendChild(overlay);

      // Create bottom sheet
      sheet = document.createElement('div');
      sheet.id = 'chat-bottom-sheet';
      sheet.className = 'chat-bottom-sheet';
      sheet.innerHTML = `
        <div class="drag-handle"></div>
        <div class="chat-sheet-header">GO DEEPER</div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" class="chat-input" placeholder="What's on your mind..." />
          <button class="chat-send-btn" id="chat-send-btn" aria-label="Send">
            <span>→</span>
          </button>
        </div>
      `;
      document.body.appendChild(sheet);

      // Add event listeners
      document.getElementById('chat-send-btn').addEventListener('click', () => {
        this.sendMessage(this.currentChatNoteId);
      });

      document.getElementById('chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage(this.currentChatNoteId);
        }
      });
    }

    // Load existing chat history
    const note = await DB.getNoteById(noteId);
    this.chatHistory = note?.chat?.messages || note?.chatHistory || [];

    // Generate opening message if needed
    if (this.chatHistory.length === 0 && note) {
      const openingMessage = this.generateOpeningMessage(note);
      this.chatHistory.push({
        role: 'assistant',
        content: openingMessage,
        timestamp: new Date().toISOString()
      });

      // Save to note
      note.chat = {
        messages: this.chatHistory,
        startedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString()
      };
      await DB.saveNote(note);
    }

    // Render messages
    this.renderMessages();

    // Show with animation
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      sheet.classList.add('open');
    });

    // Focus input after animation
    setTimeout(() => {
      document.getElementById('chat-input')?.focus();
    }, 300);
  },

  /**
   * Close chat bottom sheet
   */
  close() {
    const overlay = document.getElementById('chat-overlay');
    const sheet = document.getElementById('chat-bottom-sheet');

    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('open');

    this.currentChatNoteId = null;
  },

  /**
   * Generate contextual opening message based on note type
   * @param {Object} note - Note object
   * @returns {string} Opening message
   */
  generateOpeningMessage(note) {
    const analysis = note.analysis || {};
    const title = (analysis.title || 'this').toLowerCase();
    const isDecision = analysis.decision?.isDecision;
    const isPersonal = analysis.noteType === 'personal' || analysis.whatThisReveals;

    if (isDecision) {
      return `You're considering ${title}. What's the core tension for you?`;
    } else if (isPersonal) {
      return `You shared something personal. What's sitting with you about this?`;
    } else {
      return `What aspect of "${title}" would you like to think through?`;
    }
  },

  /**
   * Render chat messages in bottom sheet
   */
  renderMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    if (this.chatHistory.length === 0) {
      messagesContainer.innerHTML = `
        <div class="chat-welcome">
          <p>What would you like to explore?</p>
        </div>
      `;
      return;
    }

    let html = '';
    this.chatHistory.forEach(msg => {
      const role = msg.role === 'twin' ? 'assistant' : msg.role;
      const roleClass = role === 'user' ? 'user-message' : 'assistant-message';
      html += `
        <div class="chat-message ${roleClass}">
          <div class="chat-message-content">${this.escapeHtml(msg.content)}</div>
        </div>
      `;
    });

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  /**
   * Send a chat message
   * @param {string} noteId - Note ID
   */
  async sendMessage(noteId) {
    const chatInput = document.getElementById('chat-input');
    const userMessage = chatInput?.value?.trim();

    if (!userMessage || !noteId) return;

    const note = await DB.getNoteById(noteId);
    if (!note) return;

    // Add user message
    this.chatHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    chatInput.value = '';
    this.renderMessages();

    // Show typing indicator
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML += `
      <div class="chat-message assistant-message typing-indicator">
        <div class="chat-message-content">...</div>
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteContent: note.analysis?.cleanedInput || note.input?.raw_text || '',
          noteAnalysis: note.analysis,
          chatHistory: this.chatHistory.slice(0, -1),
          userMessage: userMessage,
          mode: this.currentChatMode
        })
      });

      if (!response.ok) throw new Error('Chat API failed');

      const data = await response.json();

      this.chatHistory.push({
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp
      });

      // Save to note
      note.chat = note.chat || { startedAt: new Date().toISOString() };
      note.chat.messages = this.chatHistory;
      note.chat.lastMessageAt = new Date().toISOString();
      note.chatHistory = this.chatHistory;
      await DB.saveNote(note);

      this.renderMessages();

      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Chat error:', error);
      this.chatHistory.push({
        role: 'assistant',
        content: "I'm having trouble connecting. Try again in a moment.",
        timestamp: new Date().toISOString()
      });
      this.renderMessages();
    }
  },

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Export for global access
window.ChatUI = ChatUI;
