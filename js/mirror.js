/**
 * js/mirror.js - Phase 13B: MIRROR Tab
 * "Your reflection, looking back."
 *
 * Handles MIRROR tab UI and conversation flow
 */

/**
 * StreamingCursor - Manages blinking cursor during AI response (Issue #5)
 * Design System: 200ms ease-out transitions, Inter font
 */
const StreamingCursor = {
  cursorHTML: '<span class="streaming-cursor"></span>',

  /**
   * Add cursor to element (removes existing first)
   * @param {HTMLElement} element - Target element
   */
  add(element) {
    if (!element) return;
    this.remove(element);
    element.insertAdjacentHTML('beforeend', this.cursorHTML);
  },

  /**
   * Remove cursor from element
   * @param {HTMLElement} element - Target element
   */
  remove(element) {
    if (!element) return;
    const cursor = element.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();
  },

  /**
   * Insert text before cursor during streaming
   * @param {HTMLElement} element - Container element
   * @param {string} text - Text to append
   */
  appendText(element, text) {
    if (!element) return;
    const cursor = element.querySelector('.streaming-cursor');
    if (cursor) {
      cursor.insertAdjacentText('beforebegin', text);
    } else {
      element.insertAdjacentText('beforeend', text);
    }
  }
};

// Export for global access
window.StreamingCursor = StreamingCursor;

class Mirror {
  constructor() {
    this.conversationId = null;
    this.messages = [];
    this.isLoading = false;
    this.noteCount = 0;
    this.container = null;
    // Track notes created this session for immediate context
    this.sessionNotes = [];
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

    // Listen for new notes to track in session (for immediate MIRROR context)
    window.addEventListener('note-saved', (e) => {
      try {
        // Get raw text directly from event (before encryption)
        const rawText = e.detail?.rawText;
        const title = e.detail?.title || 'Recent note';

        if (!rawText || rawText.length < 10) return;

        // Add to session notes (keep last 5)
        this.sessionNotes.push({
          content: rawText.substring(0, 500), // Limit size
          created_at: new Date().toISOString(), // Use created_at to match API expectations
          timestamp: new Date().toISOString(), // Keep for backwards compatibility
          title: title
        });

        // Keep only last 10 session notes (increased from 5 for better context)
        if (this.sessionNotes.length > 10) {
          this.sessionNotes.shift();
        }

        console.log('[Mirror] Session note tracked:', this.sessionNotes.length, 'notes');
      } catch (err) {
        console.warn('[Mirror] Failed to track session note:', err.message);
      }
    });
  }

  /**
   * Fetch user context from client side (decrypted)
   * @returns {Object} Full user context for API
   */
  async getClientContext() {
    const userId = Sync?.user?.id;
    if (!userId || !Sync?.supabase) return {};

    try {
      // Fetch decrypted memory data
      const memory = typeof MemoryDecrypt !== 'undefined'
        ? await MemoryDecrypt.getDecryptedMemory(userId)
        : { entities: [], patterns: [], summaries: [], keyPeople: [] };

      // Fetch profile data (not encrypted)
      const [profileRes, onboardingRes] = await Promise.all([
        Sync.supabase
          .from('user_profiles')
          .select('name, role_type, role_types, goals, tone, life_context, boundaries')
          .eq('user_id', userId)
          .maybeSingle(),
        Sync.supabase
          .from('onboarding_data')
          .select('name, life_seasons, mental_focus, depth_question, depth_answer, seeded_people')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      const profile = {
        name: onboardingRes.data?.name || profileRes.data?.name || 'there',
        role_types: profileRes.data?.role_types || [],
        goals: profileRes.data?.goals || [],
        tone: profileRes.data?.tone || null,
        life_context: profileRes.data?.life_context || null,
        boundaries: profileRes.data?.boundaries || [],
        life_seasons: onboardingRes.data?.life_seasons || [],
        mental_focus: onboardingRes.data?.mental_focus || [],
        depth_question: onboardingRes.data?.depth_question || null,
        depth_answer: onboardingRes.data?.depth_answer || null,
        seeded_people: onboardingRes.data?.seeded_people || []
      };

      // Build context block
      const contextBlock = typeof MemoryDecrypt !== 'undefined'
        ? MemoryDecrypt.buildContextBlock(memory, profile)
        : '';

      console.log('[Mirror] Client context built:', {
        entitiesCount: memory.entities?.length || 0,
        patternsCount: memory.patterns?.length || 0,
        summariesCount: memory.summaries?.length || 0,
        keyPeopleCount: memory.keyPeople?.length || 0
      });

      return {
        memory,
        profile,
        contextBlock
      };

    } catch (error) {
      console.warn('[Mirror] Failed to get client context:', error);
      return {};
    }
  }

  /**
   * Load recent notes from local storage for historical context
   * This ensures Mirror has context even for notes saved before this session
   *
   * FIX: Uses correct property paths for IndexedDB notes:
   * - Date: note.timestamps.created_at (not note.created_at)
   * - Content: note.input?.raw_text || note.refined?.summary || note.content
   */
  async loadRecentNotesFromStorage() {
    try {
      // First, force a cache refresh to get latest notes
      if (typeof NotesManager !== 'undefined') {
        NotesManager.invalidate();
      }

      const allNotes = typeof NotesManager !== 'undefined'
        ? await NotesManager.getAll(true) // Force refresh
        : (typeof DB !== 'undefined' ? await DB.getAllNotes() : []);

      if (!allNotes || allNotes.length === 0) {
        console.log('[Mirror] No notes found in storage');
        return;
      }

      // Get last 10 notes by date - use correct timestamp path
      const recentNotes = allNotes
        .sort((a, b) => {
          const dateA = a.timestamps?.created_at || a.created_at || '';
          const dateB = b.timestamps?.created_at || b.created_at || '';
          return new Date(dateB) - new Date(dateA);
        })
        .slice(0, 10)
        .map(note => {
          // Get content from correct location - notes store content in different places
          const content = note.input?.raw_text
            || note.refined?.summary
            || note.content
            || note.analysis?.summary
            || '';
          const timestamp = note.timestamps?.created_at || note.created_at;
          const title = note.analysis?.title || note.title || 'Note';

          return {
            content: content.substring(0, 500),
            created_at: timestamp, // API expects created_at
            timestamp, // Keep for backwards compatibility
            title
          };
        })
        .filter(n => n.content && n.content.length > 10); // Only include notes with content

      // Log note ages for debugging
      if (recentNotes.length > 0) {
        const now = Date.now();
        const ages = recentNotes.map(n => {
          const age = Math.floor((now - new Date(n.timestamp)) / (1000 * 60 * 60 * 24));
          return `${age}d`;
        });
        console.log('[Mirror] Note ages:', ages.join(', '));
      }

      // Merge with session notes (session notes have priority for duplicates)
      const sessionIds = new Set(this.sessionNotes.map(n => n.timestamp));
      const historicalNotes = recentNotes.filter(n => !sessionIds.has(n.timestamp));

      // Combine: session notes first, then historical notes, max 15 total for richer context
      this.sessionNotes = [...this.sessionNotes, ...historicalNotes].slice(0, 15);

      // Log detailed info about notes being used for debugging
      console.log('[Mirror] Loaded notes. Total context notes:', this.sessionNotes.length);
      if (this.sessionNotes.length > 0) {
        const noteDetails = this.sessionNotes.slice(0, 5).map(n => ({
          title: n.title?.substring(0, 30),
          age: Math.floor((Date.now() - new Date(n.created_at || n.timestamp)) / (1000 * 60 * 60)) + 'h ago'
        }));
        console.log('[Mirror] Top 5 notes for context:', noteDetails);
      }
    } catch (error) {
      console.warn('[Mirror] Failed to load historical notes:', error);
    }
  }

  /**
   * Get auth token for API calls
   * @returns {Promise<string|null>} Access token
   */
  async getAuthToken() {
    if (typeof Sync !== 'undefined' && Sync.supabase) {
      const { data: { session } } = await Sync.supabase.auth.getSession();
      return session?.access_token;
    }
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session?.access_token;
    }
    return null;
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
      // Trigger sync to get latest notes from server before loading context
      if (typeof Sync !== 'undefined' && Sync.pullChanges) {
        try {
          await Sync.pullChanges();
          console.log('[Mirror] Synced latest notes from server');
        } catch (syncError) {
          console.warn('[Mirror] Sync failed, using local notes:', syncError.message);
        }
      }

      // Load recent notes from local storage (includes historical notes)
      await this.loadRecentNotesFromStorage();

      // Get client-side decrypted context
      const clientContext = await this.getClientContext();

      const token = await this.getAuthToken();
      const response = await fetch('/api/mirror?action=open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: Sync.user.id,
          clientContext // Send decrypted context from client
        })
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
      this.scrollToBottom();

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

    // Track feature usage for personalization
    if (typeof DataCapture !== 'undefined') {
      DataCapture.trackFeatureUse('mirror_chat', { messageLength: content.trim().length });
    }

    this.isLoading = true;
    this.render();
    this.scrollToBottom();

    try {
      // Get client-side decrypted context
      const clientContext = await this.getClientContext();
      const token = await this.getAuthToken();

      const response = await fetch('/api/mirror?action=message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: Sync.user.id,
          conversation_id: this.conversationId,
          message: content.trim(),
          context,
          clientContext, // Send decrypted context from client
          // Include recent session notes for immediate context
          recentSessionNotes: this.sessionNotes
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
        referencedNotes: data.response.referencedNotes,
        conversationMode: data.response.conversationMode,
        contextUsed: data.response.contextUsed
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
        const token = await this.getAuthToken();
        await fetch('/api/mirror?action=close', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
      // Start message rotation after DOM update
      requestAnimationFrame(() => this.startLoadingRotation());
      return;
    }

    // Stop rotation when no longer in loading state
    this.stopLoadingRotation();

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

        <div class="mirror-conversation" id="mirror-conversation" role="log" aria-live="polite" aria-label="Conversation with your digital twin">
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

    // Mode indicator for Inscript messages
    let modeIndicatorHtml = '';
    if (isInscript && msg.conversationMode) {
      const modeLabels = {
        'thinking': 'Thinking with you',
        'thinking_partner': 'Thinking with you',
        'research': 'Research mode',
        'knowledge': 'From memory'
      };
      const modeLabel = modeLabels[msg.conversationMode] || '';
      if (modeLabel) {
        modeIndicatorHtml = `<div class="mirror-mode-indicator">${modeLabel}</div>`;
      }
    }

    // Context used section for Inscript messages
    let contextUsedHtml = '';
    if (isInscript && msg.contextUsed && msg.contextUsed.length > 0) {
      contextUsedHtml = this.renderContextUsed(msg.contextUsed);
    }

    return `
      <div class="mirror-message ${isInscript ? 'mirror-message-inscript' : 'mirror-message-user'}" role="article" aria-label="${isInscript ? 'Inscript says' : 'You said'}">
        <div class="mirror-bubble ${bubbleClass}">
          ${modeIndicatorHtml}
          <p class="mirror-bubble-text">${this.escapeHtml(msg.content)}</p>
          ${buttonsHtml}
          ${contextUsedHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render context used section
   */
  renderContextUsed(contextUsed) {
    if (!contextUsed || contextUsed.length === 0) return '';

    const contextItems = contextUsed.slice(0, 5).map(item => {
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      switch (item.type) {
        case 'note':
          return `
            <div class="context-item">
              <span class="context-type">Note</span>
              <span class="context-date">${formatDate(item.date)}</span>
              <span class="context-preview">${this.escapeHtml(item.preview || '')}</span>
            </div>
          `;
        case 'entity':
          return `
            <div class="context-item">
              <span class="context-type">Person</span>
              <span class="context-value">${this.escapeHtml(item.name || '')}${item.value ? ` (${this.escapeHtml(item.value)})` : ''}</span>
            </div>
          `;
        case 'fact':
          return `
            <div class="context-item">
              <span class="context-type">Fact</span>
              <span class="context-value">${this.escapeHtml(item.value || '')}</span>
            </div>
          `;
        case 'pattern':
          return `
            <div class="context-item">
              <span class="context-type">Pattern</span>
              <span class="context-value">${this.escapeHtml(item.value || '')}</span>
            </div>
          `;
        case 'research':
          return `
            <div class="context-item">
              <span class="context-type">Search</span>
              <span class="context-value">${this.escapeHtml(item.label || '')}: ${this.escapeHtml(item.value || '')}</span>
            </div>
          `;
        case 'mentions':
          return `
            <div class="context-item">
              <span class="context-type">Refs</span>
              <span class="context-value">${this.escapeHtml(item.value || '')}</span>
            </div>
          `;
        case 'timeline':
          return `
            <div class="context-item">
              <span class="context-type">Time</span>
              <span class="context-value">${this.escapeHtml(item.value || '')}</span>
            </div>
          `;
        case 'people':
        case 'related':
          return `
            <div class="context-item">
              <span class="context-type">Related</span>
              <span class="context-value">${this.escapeHtml(item.value || '')}</span>
            </div>
          `;
        default:
          return `
            <div class="context-item">
              <span class="context-type">${this.escapeHtml(item.type || 'Info')}</span>
              <span class="context-value">${this.escapeHtml(item.value || item.label || '')}</span>
            </div>
          `;
      }
    }).join('');

    return `
      <details class="context-used">
        <summary class="context-used-toggle">
          <span class="context-used-label">Context used</span>
          <span class="context-used-count">${contextUsed.length} source${contextUsed.length !== 1 ? 's' : ''}</span>
        </summary>
        <div class="context-used-content">
          ${contextItems}
        </div>
      </details>
    `;
  }

  /**
   * Render typing indicator with animated dots
   */
  renderTypingIndicator() {
    return `
      <div class="mirror-message mirror-message-inscript" role="status" aria-label="Inscript is thinking" id="mirror-streaming-message">
        <div class="mirror-bubble mirror-bubble-inscript mirror-bubble-typing">
          <span class="mirror-typing-dots">
            <span class="mirror-typing-dot"></span>
            <span class="mirror-typing-dot"></span>
            <span class="mirror-typing-dot"></span>
          </span>
          <span class="sr-only">Inscript is thinking...</span>
        </div>
      </div>
    `;
  }

  /**
   * Render loading state with contextual messages
   */
  renderLoading() {
    // Get initial message
    const message = typeof LoadingMessages !== 'undefined'
      ? LoadingMessages.get('mirror')
      : 'reflecting...';

    return `
      <div class="mirror-wrapper">
        <header class="mirror-header">
          <h2 class="mirror-title">MIRROR</h2>
        </header>
        <div class="mirror-loading">
          <span class="mirror-loading-message">${message}</span>
          <span class="mirror-loading-dots">
            <span class="mirror-loading-dot"></span>
            <span class="mirror-loading-dot"></span>
            <span class="mirror-loading-dot"></span>
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Start loading message rotation
   */
  startLoadingRotation() {
    // Stop any existing rotation
    this.stopLoadingRotation();

    const messageEl = document.querySelector('.mirror-loading-message');
    if (messageEl && typeof LoadingMessages !== 'undefined') {
      this._loadingRotationCleanup = LoadingMessages.startRotation('mirror', messageEl, 3000);
    }
  }

  /**
   * Stop loading message rotation
   */
  stopLoadingRotation() {
    if (this._loadingRotationCleanup) {
      this._loadingRotationCleanup();
      this._loadingRotationCleanup = null;
    }
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
        <div class="mirror-error" role="alert">
          <div class="mirror-error-icon" aria-hidden="true">⚠</div>
          <p>${this.escapeHtml(message)}</p>
          <button class="mirror-retry-btn" onclick="window.Mirror.open()" aria-label="Retry connection">Try again</button>
        </div>
      </div>
    `;
  }

  /**
   * Show a temporary toast message
   */
  showToast(message, type = 'info') {
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(message);
    } else {
      console.log(`[Mirror Toast] ${message}`);
    }
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
