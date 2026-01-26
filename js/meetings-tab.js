/**
 * INSCRIPT: Meetings Tab UI
 * Phase 17 - TASK-024
 *
 * Beautiful interface for browsing and querying meetings
 * within the YOU tab.
 */

const MeetingsTab = {
  container: null,
  meetings: [],
  userId: null,
  initialized: false,

  /**
   * Initialize the meetings tab
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Options
   */
  init(container, options = {}) {
    if (!container) {
      console.error('[MeetingsTab] No container provided');
      return;
    }

    this.container = container;
    this.userId = options.userId || Sync?.user?.id;
    this.initialized = true;

    console.log('[MeetingsTab] Initializing...');
    this.render();
    this.attachListeners();
  },

  /**
   * Render the meetings tab structure
   */
  render() {
    this.container.innerHTML = `
      <div class="meetings-tab">
        <!-- Search Section -->
        <div class="meetings-search-section">
          <div class="meetings-search-wrapper">
            <input
              type="text"
              class="meetings-search-input"
              placeholder="Search meetings or ask a question..."
              aria-label="Search meetings"
            />
            <button class="meetings-search-btn" aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
          </div>

          <div class="meetings-query-hints">
            <span class="hints-label">Try asking:</span>
            <button class="hint-chip" role="button" tabindex="0">"What did Sarah say about the budget?"</button>
            <button class="hint-chip" role="button" tabindex="0">"Action items from this week"</button>
          </div>
        </div>

        <!-- Query Response (hidden by default) -->
        <div class="meetings-query-response" style="display: none;"></div>

        <!-- Meeting List -->
        <div class="meetings-list-section">
          <div class="meetings-list-header">
            <h3 class="meetings-section-title">THIS WEEK</h3>
            <button class="meetings-new-btn" aria-label="New Meeting">+ New Meeting</button>
          </div>

          <div class="meetings-list" data-period="this-week"></div>

          <h3 class="meetings-section-title">LAST WEEK</h3>
          <div class="meetings-list" data-period="last-week"></div>

          <h3 class="meetings-section-title">EARLIER</h3>
          <div class="meetings-list" data-period="earlier"></div>
        </div>

        <!-- Empty State -->
        <div class="meetings-empty-state" style="display: none;">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h3 class="empty-title">No meetings yet</h3>
          <p class="empty-desc">Capture your first meeting to build your memory.</p>
          <button class="meetings-empty-cta">Start Listening</button>
        </div>

        <!-- Loading State -->
        <div class="meetings-loading" style="display: none;">
          <div class="meeting-card-skeleton shimmer"></div>
          <div class="meeting-card-skeleton shimmer"></div>
          <div class="meeting-card-skeleton shimmer"></div>
        </div>
      </div>
    `;
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Search input - Enter key
    const searchInput = this.container.querySelector('.meetings-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSearch(searchInput.value);
        }
      });
    }

    // Search button click
    const searchBtn = this.container.querySelector('.meetings-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const input = this.container.querySelector('.meetings-search-input');
        this.handleSearch(input?.value || '');
      });
    }

    // Hint chips
    this.container.querySelectorAll('.hint-chip').forEach(chip => {
      const handler = () => {
        const input = this.container.querySelector('.meetings-search-input');
        if (input) {
          input.value = chip.textContent.replace(/"/g, '');
          this.handleSearch(input.value);
        }
      };
      chip.addEventListener('click', handler);
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    // New Meeting button
    const newMeetingBtn = this.container.querySelector('.meetings-new-btn');
    if (newMeetingBtn) {
      newMeetingBtn.addEventListener('click', () => this.openNewMeeting());
    }

    // Empty state CTA - Start Listening opens AmbientRecorder
    const emptyCta = this.container.querySelector('.meetings-empty-cta');
    if (emptyCta) {
      emptyCta.addEventListener('click', () => this.openAmbientRecorder());
    }
  },

  /**
   * Open ambient recorder for capturing meetings
   */
  openAmbientRecorder() {
    console.log('[MeetingsTab] Opening ambient recorder');

    if (typeof AmbientRecorder !== 'undefined') {
      const userId = this.userId || Sync?.user?.id || 'anonymous';

      AmbientRecorder.open({
        userId: userId,
        onComplete: async (result) => {
          console.log('[MeetingsTab] Ambient recording complete:', result);

          // Refresh the meetings list
          await this.refresh();

          // Show success feedback
          if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Meeting captured and enhanced');
          }
        },
      });
    } else {
      console.warn('[MeetingsTab] AmbientRecorder not available, falling back to MeetingCapture');
      this.openNewMeeting();
    }
  },

  /**
   * Get skeleton HTML for loading state
   */
  getSkeletonHTML() {
    return `
      <div class="meetings-skeleton">
        <div class="meeting-card-skeleton"></div>
        <div class="meeting-card-skeleton"></div>
        <div class="meeting-card-skeleton"></div>
      </div>
    `;
  },

  /**
   * Load meetings from database
   */
  async load() {
    if (!this.initialized) {
      console.warn('[MeetingsTab] Not initialized');
      return;
    }

    console.log('[MeetingsTab] Loading meetings...');

    // Show skeleton immediately in the this-week list
    const thisWeekList = this.container.querySelector('.meetings-list[data-period="this-week"]');
    if (thisWeekList) {
      thisWeekList.innerHTML = this.getSkeletonHTML();
    }

    // Hide empty state during load
    const emptyState = this.container.querySelector('.meetings-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    try {
      this.meetings = await this.fetchMeetings();
      this.renderMeetings();
    } catch (error) {
      console.error('[MeetingsTab] Failed to load meetings:', error);
      this.showError('Failed to load meetings');
    }
  },

  /**
   * Fetch meetings from IndexedDB/Supabase
   */
  async fetchMeetings() {
    // Try IndexedDB first (encrypted local cache)
    const localMeetings = await this.fetchLocalMeetings();
    if (localMeetings.length > 0) {
      return localMeetings;
    }

    // Fall back to Supabase if user is authenticated
    if (this.userId && typeof Sync !== 'undefined' && Sync.supabase) {
      return await this.fetchRemoteMeetings();
    }

    return [];
  },

  /**
   * Fetch meetings from IndexedDB
   */
  async fetchLocalMeetings() {
    if (typeof DB === 'undefined' || !DB.getAllNotes) {
      return [];
    }

    try {
      const notes = await DB.getAllNotes();
      return notes
        .filter(n => n.note_type === 'meeting')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.warn('[MeetingsTab] Local fetch error:', error);
      return [];
    }
  },

  /**
   * Fetch meetings from Supabase
   */
  async fetchRemoteMeetings() {
    try {
      const { data, error } = await Sync.supabase
        .from('notes')
        .select('id, content, created_at, note_type, meeting_metadata, enhanced_content, enhancement_metadata')
        .eq('user_id', this.userId)
        .eq('note_type', 'meeting')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[MeetingsTab] Supabase error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[MeetingsTab] Remote fetch error:', error);
      return [];
    }
  },

  /**
   * Render meetings into grouped sections
   */
  renderMeetings() {
    const listSection = this.container.querySelector('.meetings-list-section');
    const emptyState = this.container.querySelector('.meetings-empty-state');

    if (this.meetings.length === 0) {
      listSection.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    listSection.style.display = 'block';
    emptyState.style.display = 'none';

    const grouped = this.groupMeetingsByPeriod(this.meetings);

    ['this-week', 'last-week', 'earlier'].forEach(period => {
      const list = this.container.querySelector(`[data-period="${period}"]`);
      const meetings = grouped[period] || [];

      if (meetings.length === 0) {
        list.innerHTML = '<p class="no-meetings">None recorded</p>';
      } else {
        list.innerHTML = meetings.map(m => this.renderMeetingCard(m)).join('');
      }
    });

    // Attach card click listeners
    this.container.querySelectorAll('.meeting-card').forEach(card => {
      card.addEventListener('click', () => {
        const noteId = card.dataset.noteId;
        this.openMeeting(noteId);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const noteId = card.dataset.noteId;
          this.openMeeting(noteId);
        }
      });
    });
  },

  /**
   * Render a single meeting card
   */
  renderMeetingCard(meeting) {
    const date = new Date(meeting.created_at);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

    // Extract metadata
    const metadata = meeting.meeting_metadata || meeting.enhancement_metadata || {};
    const title = metadata.title || this.extractTitle(meeting.content) || 'Untitled Meeting';
    const actionCount = metadata.action_items?.length || this.countActionItems(meeting.content);
    const summary = this.getSummary(meeting);

    return `
      <div class="meeting-card" data-note-id="${meeting.id}" role="button" tabindex="0">
        <div class="meeting-card-header">
          <h4 class="meeting-card-title">${this.escapeHtml(title)}</h4>
          <span class="meeting-card-date">${dateStr}</span>
        </div>
        <p class="meeting-card-summary">${this.escapeHtml(summary)}</p>
        ${actionCount > 0 ? `<span class="meeting-card-meta">${actionCount} action item${actionCount !== 1 ? 's' : ''}</span>` : ''}
      </div>
    `;
  },

  /**
   * Extract title from content
   */
  extractTitle(content) {
    if (!content) return null;
    // Look for ## TITLE or first heading
    const match = content.match(/^##?\s*(.+)$/m);
    if (match) return match[1].replace(/[*_#]/g, '').trim();
    // Fall back to first line
    const firstLine = content.split('\n')[0];
    return firstLine?.slice(0, 50) || null;
  },

  /**
   * Count action items in content
   */
  countActionItems(content) {
    if (!content) return 0;
    const actionMatch = content.match(/ACTION ITEMS?[\s\S]*?(?=##|$)/i);
    if (!actionMatch) return 0;
    const items = actionMatch[0].match(/^[-•*]\s+.+$/gm);
    return items?.length || 0;
  },

  /**
   * Get summary from meeting
   */
  getSummary(meeting) {
    const metadata = meeting.meeting_metadata || meeting.enhancement_metadata || {};

    // Try topics from metadata
    if (metadata.topics?.length > 0) {
      return metadata.topics.slice(0, 3).join(', ');
    }

    // Try to extract DISCUSSED section
    const content = meeting.enhanced_content || meeting.content || '';
    const discussedMatch = content.match(/DISCUSSED[\s\S]*?(?=##|ACTION|$)/i);
    if (discussedMatch) {
      const items = discussedMatch[0].match(/^[-•*]\s+(.+)$/gm);
      if (items) {
        return items.slice(0, 3).map(i => i.replace(/^[-•*]\s+/, '')).join(', ');
      }
    }

    // Fall back to content preview
    const clean = content.replace(/^#+\s*.+$/gm, '').replace(/\n+/g, ' ').trim();
    return clean.substring(0, 100) + (clean.length > 100 ? '...' : '');
  },

  /**
   * Group meetings by time period
   */
  groupMeetingsByPeriod(meetings) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    return {
      'this-week': meetings.filter(m => new Date(m.created_at) >= startOfWeek),
      'last-week': meetings.filter(m => {
        const d = new Date(m.created_at);
        return d >= startOfLastWeek && d < startOfWeek;
      }),
      'earlier': meetings.filter(m => new Date(m.created_at) < startOfLastWeek),
    };
  },

  /**
   * Handle search/query
   */
  async handleSearch(query) {
    if (!query.trim()) {
      this.hideQueryResponse();
      return;
    }

    // Check if it's a natural language question
    const isQuestion = query.includes('?') ||
      /^(what|when|who|where|why|how|did|do|does|can|could|tell me|show me|find)/i.test(query);

    if (isQuestion) {
      await this.performAIQuery(query);
    } else {
      this.performTextSearch(query);
    }
  },

  /**
   * Perform AI query across meetings via /api/query-meetings
   * TASK-028: Query Response UI Integration
   */
  async performAIQuery(query) {
    const responseDiv = this.container.querySelector('.meetings-query-response');
    responseDiv.style.display = 'block';
    responseDiv.innerHTML = `
      <div class="query-loading">
        <div class="query-loading-text" style="font-family: 'Cormorant Garamond', serif; font-style: italic; color: #6B6B6B;">
          Searching your meetings...
        </div>
        <div class="shimmer" style="height: 16px; width: 60%; margin-top: 12px; border-radius: 4px;"></div>
      </div>
    `;

    try {
      // Call the AI-powered query-meetings API
      const userId = this.userId || Sync?.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/query-meetings?q=${encodeURIComponent(query)}&userId=${userId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Query failed');
      }

      // Render the AI response
      this.renderQueryResponse(responseDiv, result, query);

    } catch (error) {
      console.error('[MeetingsTab] Query error:', error);

      // Fall back to local search if API fails
      console.log('[MeetingsTab] Falling back to local search');
      const results = this.searchMeetingsLocally(query);
      this.renderLocalSearchResults(responseDiv, results, query);
    }
  },

  /**
   * Render AI query response from /api/query-meetings
   */
  renderQueryResponse(responseDiv, result, query) {
    if (result.type === 'no_results') {
      responseDiv.innerHTML = `
        <div class="query-answer">
          <p class="answer-text" style="font-family: 'Cormorant Garamond', serif; font-style: italic; color: #6B6B6B;">
            ${this.escapeHtml(result.answer)}
          </p>
        </div>
      `;
      return;
    }

    // AI answer with sources
    const sourcesHtml = result.sources?.length > 0
      ? `
        <div class="answer-sources" style="margin-top: 16px;">
          <span class="sources-label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #999; display: block; margin-bottom: 8px;">Sources</span>
          ${result.sources.map(source => `
            <button class="source-btn" data-note-id="${source.noteId}" style="
              display: block;
              width: 100%;
              text-align: left;
              padding: 12px;
              margin-bottom: 8px;
              background: #FAFAFA;
              border: 1px solid #E5E5E5;
              border-radius: 8px;
              cursor: pointer;
              transition: background 0.15s;
            ">
              <span class="source-title" style="font-weight: 500; display: block;">${this.escapeHtml(source.title)}</span>
              <span class="source-date" style="font-size: 12px; color: #666;">${source.date}</span>
              ${source.snippet ? `<p class="source-snippet" style="font-size: 13px; color: #666; margin-top: 4px; line-height: 1.4;">"${this.escapeHtml(source.snippet)}"</p>` : ''}
            </button>
          `).join('')}
        </div>
      `
      : '';

    responseDiv.innerHTML = `
      <div class="query-answer" style="padding: 20px; background: #FAFAFA; border-radius: 12px; border: 1px solid #E5E5E5;">
        <p class="answer-text" style="font-family: 'Cormorant Garamond', serif; font-size: 17px; line-height: 1.6; color: #333;">
          ${this.escapeHtml(result.answer)}
        </p>
        ${sourcesHtml}
        <span class="query-time" style="font-size: 11px; color: #999; display: block; margin-top: 12px;">
          ${result.processingTime}ms
        </span>
      </div>
    `;

    // Attach source click listeners
    responseDiv.querySelectorAll('.source-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openMeeting(btn.dataset.noteId);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#F0F0F0';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#FAFAFA';
      });
    });
  },

  /**
   * Render local search results (fallback when API unavailable)
   */
  renderLocalSearchResults(responseDiv, results, query) {
    if (results.length === 0) {
      responseDiv.innerHTML = `
        <div class="query-answer">
          <p class="answer-text" style="font-family: 'Cormorant Garamond', serif; font-style: italic; color: #6B6B6B;">
            No relevant meetings found for "${this.escapeHtml(query)}"
          </p>
        </div>
      `;
      return;
    }

    responseDiv.innerHTML = `
      <div class="query-answer" style="padding: 20px; background: #FAFAFA; border-radius: 12px; border: 1px solid #E5E5E5;">
        <p class="answer-text" style="font-size: 14px; color: #666; margin-bottom: 12px;">
          Found ${results.length} meeting${results.length !== 1 ? 's' : ''} matching your search:
        </p>
        <div class="answer-sources">
          ${results.slice(0, 5).map(m => {
            const title = m.meeting_metadata?.title || this.extractTitle(m.content) || 'Meeting';
            const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `
              <button class="source-btn" data-note-id="${m.id}" style="
                display: block;
                width: 100%;
                text-align: left;
                padding: 12px;
                margin-bottom: 8px;
                background: white;
                border: 1px solid #E5E5E5;
                border-radius: 8px;
                cursor: pointer;
              ">
                <span style="font-weight: 500;">${this.escapeHtml(title)}</span>
                <span style="font-size: 12px; color: #666; margin-left: 8px;">${date}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Attach source click listeners
    responseDiv.querySelectorAll('.source-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openMeeting(btn.dataset.noteId);
      });
    });
  },

  /**
   * Search meetings locally by text
   */
  searchMeetingsLocally(query) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    return this.meetings.filter(meeting => {
      const content = (meeting.content || '') + ' ' + (meeting.enhanced_content || '');
      const contentLower = content.toLowerCase();

      // Check if any query word matches
      return queryWords.some(word => contentLower.includes(word));
    }).sort((a, b) => {
      // Score by number of matching words
      const contentA = ((a.content || '') + ' ' + (a.enhanced_content || '')).toLowerCase();
      const contentB = ((b.content || '') + ' ' + (b.enhanced_content || '')).toLowerCase();
      const scoreA = queryWords.filter(w => contentA.includes(w)).length;
      const scoreB = queryWords.filter(w => contentB.includes(w)).length;
      return scoreB - scoreA;
    });
  },

  /**
   * Perform text-based search (filters visible cards)
   */
  performTextSearch(query) {
    this.hideQueryResponse();

    const queryLower = query.toLowerCase();
    const cards = this.container.querySelectorAll('.meeting-card');

    cards.forEach(card => {
      const title = card.querySelector('.meeting-card-title')?.textContent || '';
      const summary = card.querySelector('.meeting-card-summary')?.textContent || '';
      const matches = title.toLowerCase().includes(queryLower) ||
                      summary.toLowerCase().includes(queryLower);
      card.style.display = matches ? 'block' : 'none';
    });
  },

  /**
   * Hide query response
   */
  hideQueryResponse() {
    const responseDiv = this.container.querySelector('.meetings-query-response');
    if (responseDiv) {
      responseDiv.style.display = 'none';
    }
  },

  /**
   * Show/hide loading state
   */
  showLoading(show) {
    const loading = this.container.querySelector('.meetings-loading');
    const listSection = this.container.querySelector('.meetings-list-section');
    const emptyState = this.container.querySelector('.meetings-empty-state');

    if (loading) loading.style.display = show ? 'block' : 'none';
    if (listSection) listSection.style.display = show ? 'none' : 'block';
    if (emptyState) emptyState.style.display = 'none';
  },

  /**
   * Show error message
   */
  showError(message) {
    const listSection = this.container.querySelector('.meetings-list-section');
    if (listSection) {
      listSection.innerHTML = `<p class="meetings-error">${message}</p>`;
    }
  },

  /**
   * Open meeting note
   */
  openMeeting(noteId) {
    if (!noteId) return;
    console.log('[MeetingsTab] Opening meeting:', noteId);

    // Use global UI if available
    if (typeof UI !== 'undefined' && UI.viewNote) {
      UI.viewNote(noteId);
    } else {
      window.location.hash = `#note/${noteId}`;
    }
  },

  /**
   * Open new meeting capture
   */
  openNewMeeting() {
    console.log('[MeetingsTab] Opening new meeting capture');

    // Try MeetingCapture first
    if (typeof MeetingCapture !== 'undefined') {
      const modal = document.getElementById('meeting-capture-modal');
      if (modal) {
        modal.classList.remove('hidden');
        MeetingCapture.reset?.();
        return;
      }
    }

    // Fall back to UI method
    if (typeof UI !== 'undefined' && UI.openMeetingCapture) {
      UI.openMeetingCapture();
    }
  },

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Refresh meetings list
   */
  async refresh() {
    await this.load();
  }
};

// Make globally available
window.MeetingsTab = MeetingsTab;
