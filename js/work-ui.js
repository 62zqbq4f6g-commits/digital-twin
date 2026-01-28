/**
 * Work UI - Phase 14: Work Utility
 * Orchestrates the WORK tab with sub-tabs: PULSE | ACTIONS | MEETINGS | COMMITMENTS
 *
 * Replaces the old ACTIONS-only tab with a comprehensive work utility system.
 */

const WorkUI = {
  // Active sub-tab state
  activeTab: 'pulse',

  // Cache for commitments and meetings
  commitments: [],
  meetings: [],

  // Known entities for suggestions
  knownEntities: [],

  // Initialization flag
  initialized: false,

  // Save-in-progress flags
  isSavingMeeting: false,
  isSavingDecision: false,

  /**
   * Extract timestamp from a note object - handles various formats
   * @param {Object} note - Note object
   * @returns {string|null} ISO timestamp string or null
   */
  extractTimestamp(note) {
    if (!note) return null;

    // If timestamps is an object with created_at
    if (note.timestamps && typeof note.timestamps === 'object') {
      if (note.timestamps.created_at) return note.timestamps.created_at;
      if (note.timestamps.input_date) return note.timestamps.input_date;
    }

    // Direct created_at on note (from Supabase)
    if (note.created_at) return note.created_at;

    // Check meeting metadata
    if (note.meeting && note.meeting.date) return note.meeting.date;

    return null;
  },

  /**
   * Initialize Work UI
   */
  init() {
    if (this.initialized) {
      console.log('[WorkUI] Already initialized, skipping');
      return;
    }
    this.initialized = true;
    console.log('[WorkUI] Initializing...');
    this.attachTabListeners();
    this.attachModeListeners();
    this.attachModalListeners();
    this.loadKnownEntities();
  },

  /**
   * Attach sub-tab click listeners using event delegation
   */
  attachTabListeners() {
    const tabsContainer = document.querySelector('.work-tabs');
    if (!tabsContainer || tabsContainer._tabsListenerAttached) return;

    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.work-tab');
      if (tab) {
        const tabName = tab.dataset.workTab;
        this.switchTab(tabName);
      }
    });

    tabsContainer._tabsListenerAttached = true;
  },

  /**
   * Attach Meeting/Decision mode button listeners
   */
  attachModeListeners() {
    const meetingBtn = document.getElementById('meeting-mode-btn');
    const decisionBtn = document.getElementById('decision-mode-btn');
    const newMeetingBtn = document.getElementById('new-meeting-btn');

    if (meetingBtn) {
      meetingBtn.addEventListener('click', () => this.openMeetingModal());
    }

    if (decisionBtn) {
      decisionBtn.addEventListener('click', () => this.openDecisionModal());
    }

    // New Meeting button in MEETINGS sub-tab
    if (newMeetingBtn) {
      newMeetingBtn.addEventListener('click', () => this.openMeetingModal());
    }
  },

  /**
   * Attach modal close and save listeners
   */
  attachModalListeners() {
    // Meeting modal
    const meetingClose = document.getElementById('meeting-modal-close');
    const meetingSave = document.getElementById('meeting-save-btn');
    const meetingVoice = document.getElementById('meeting-voice-btn');
    const meetingInput = document.getElementById('meeting-attendees-input');

    if (meetingClose) {
      meetingClose.addEventListener('click', () => this.closeMeetingModal());
    }
    if (meetingSave) {
      meetingSave.addEventListener('click', () => this.saveMeeting());
    }
    if (meetingVoice) {
      meetingVoice.addEventListener('click', () => this.toggleMeetingVoice());
    }
    if (meetingInput) {
      meetingInput.addEventListener('input', (e) => this.handleAttendeeInput(e));
      meetingInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addAttendee(e.target.value.trim());
          e.target.value = '';
        }
      });
    }

    // Decision modal
    const decisionClose = document.getElementById('decision-modal-close');
    const decisionSave = document.getElementById('decision-save-btn');
    const decisionVoice = document.getElementById('decision-voice-btn');

    if (decisionClose) {
      decisionClose.addEventListener('click', () => this.closeDecisionModal());
    }
    if (decisionSave) {
      decisionSave.addEventListener('click', () => this.saveDecision());
    }
    if (decisionVoice) {
      decisionVoice.addEventListener('click', () => this.toggleDecisionVoice());
    }

    // Close modals on overlay click
    const meetingModal = document.getElementById('meeting-modal');
    const decisionModal = document.getElementById('decision-modal');

    if (meetingModal) {
      meetingModal.addEventListener('click', (e) => {
        if (e.target === meetingModal) this.closeMeetingModal();
      });
    }
    if (decisionModal) {
      decisionModal.addEventListener('click', (e) => {
        if (e.target === decisionModal) this.closeDecisionModal();
      });
    }

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMeetingModal();
        this.closeDecisionModal();
      }
    });
  },

  /**
   * Switch to a sub-tab
   */
  switchTab(tabName) {
    console.log('[WorkUI] Switching to tab:', tabName);
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.work-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.workTab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('.work-content').forEach(content => {
      content.classList.add('hidden');
    });

    const activeContent = document.getElementById(`work-${tabName}`);
    if (activeContent) {
      activeContent.classList.remove('hidden');
    }

    // Load content for the tab
    this.loadTabContent(tabName);
  },

  /**
   * Load content for a specific tab
   */
  async loadTabContent(tabName) {
    console.log('[WorkUI] loadTabContent:', tabName);
    switch (tabName) {
      case 'pulse':
        await this.loadPulse();
        break;
      case 'actions':
        // Actions are handled by ActionsUI, plus our extras (commitments/decisions)
        if (typeof ActionsUI !== 'undefined') {
          ActionsUI.refresh();
        }
        // Load commitments and decisions into actions view
        await this.loadActionsWithExtras();
        break;
      case 'meetings':
        console.log('[WorkUI] Loading meetings tab...');
        await this.loadMeetings();
        break;
      case 'commitments':
        await this.loadCommitments();
        break;
    }
  },

  /**
   * Refresh the work view (called when screen is shown)
   */
  async refresh() {
    console.log('[WorkUI] Refreshing...');
    await this.loadTabContent(this.activeTab);
  },

  // ═══════════════════════════════════════════════════════════
  // PULSE TAB
  // ═══════════════════════════════════════════════════════════

  /**
   * Load Morning Pulse data
   */
  async loadPulse() {
    const container = document.querySelector('.pulse-container');
    if (!container) return;

    // Show skeleton loading state
    container.innerHTML = `
      <div class="pulse-skeleton">
        <div class="skeleton skeleton-title" style="width: 50%; margin-bottom: 16px;"></div>
        <div class="skeleton skeleton-text" style="width: 100%; margin-bottom: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 90%; margin-bottom: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 70%; margin-bottom: 16px;"></div>
        <div class="skeleton skeleton-title" style="width: 40%; margin-bottom: 12px;"></div>
        <div class="skeleton skeleton-text" style="width: 80%; margin-bottom: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 60%;"></div>
      </div>
    `;

    try {
      // Try to fetch from API
      const response = await fetch('/api/pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Sync.user?.id })
      });

      if (response.ok) {
        const data = await response.json();
        this.renderPulse(data);
      } else {
        // Fallback to local generation
        const pulseData = await this.generateLocalPulse();
        this.renderPulse(pulseData);
      }
    } catch (error) {
      console.warn('[WorkUI] Pulse API error, using local fallback:', error);
      const pulseData = await this.generateLocalPulse();
      this.renderPulse(pulseData);
    }
  },

  /**
   * Generate pulse data locally - simplified for valuable summary
   * Phase 14.5: Synthesized insight instead of entity dump
   */
  async generateLocalPulse() {
    const notes = await NotesManager.getAll();
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Get this week's notes
    const weekNotes = notes.filter(n => {
      const created = new Date(n.timestamps?.created_at || n.created_at);
      return created > weekAgo;
    });

    // Count unique people mentioned this week
    const peopleSet = new Set();
    weekNotes.forEach(note => {
      const people = note.analysis?.entities?.people || note.extracted?.people || [];
      people.forEach(p => peopleSet.add(p.toLowerCase()));
    });

    // Get top 2 focuses from entities (people or projects with most mentions)
    const topFocuses = await this.getTopFocuses();

    return {
      greeting: this.getGreeting(),
      noteCount: weekNotes.length,
      peopleCount: peopleSet.size,
      topFocuses: topFocuses.slice(0, 2)
    };
  },

  /**
   * Get top focuses (entities mentioned most this week)
   */
  async getTopFocuses() {
    try {
      if (typeof Entities !== 'undefined' && Entities.getAll) {
        const entities = await Entities.getAll();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Filter to recently mentioned, sort by mention count
        return entities
          .filter(e => {
            const lastMentioned = new Date(e.last_mentioned_at || e.updated_at);
            return lastMentioned > weekAgo;
          })
          .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
          .slice(0, 2)
          .map(e => e.name);
      }
    } catch (e) {
      console.warn('[WorkUI] Could not load top focuses:', e);
    }
    return [];
  },

  /**
   * Get time-appropriate greeting
   */
  getGreeting() {
    const hour = new Date().getHours();
    const name = localStorage.getItem('dt_user_name') || '';

    let timeGreeting;
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    return name ? `${timeGreeting}, ${name}.` : `${timeGreeting}.`;
  },

  /**
   * Extract common themes from recent notes
   */
  extractThemes(notes) {
    const wordCounts = {};
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'just', 'also', 'than', 'so', 'very', 'really', 'think', 'feel', 'like', 'want', 'know', 'get', 'got', 'make', 'made']);

    notes.forEach(note => {
      const text = (note.content || '').toLowerCase();
      const words = text.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });

    return Object.entries(wordCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));
  },

  /**
   * Get recently mentioned people
   */
  async getRecentPeople() {
    try {
      if (typeof Entities !== 'undefined' && Entities.getAll) {
        const entities = await Entities.getAll();
        return entities
          .filter(e => e.entity_type === 'person')
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, 5)
          .map(e => ({
            name: e.name,
            context: e.context_summary || e.relationship || '',
            lastMentioned: e.updated_at
          }));
      }
    } catch (e) {
      console.warn('[WorkUI] Could not load entities:', e);
    }
    return [];
  },

  /**
   * Render the pulse UI - Phase 14.5: Synthesized summary
   * Simple, valuable, not a data dump
   */
  renderPulse(data) {
    const container = document.querySelector('.pulse-container');
    if (!container) return;

    const { greeting, noteCount, peopleCount, topFocuses } = data;

    // Build focus text
    let focusText = '';
    if (topFocuses && topFocuses.length > 0) {
      if (topFocuses.length === 1) {
        focusText = `This week you've been focused on <strong>${this.escapeHtml(topFocuses[0])}</strong>.`;
      } else {
        focusText = `This week you've been focused on <strong>${this.escapeHtml(topFocuses[0])}</strong> and <strong>${this.escapeHtml(topFocuses[1])}</strong>.`;
      }
    }

    // Build stats text
    let statsText = `${noteCount || 0} notes`;
    if (peopleCount > 0) {
      statsText += ` · ${peopleCount} people mentioned`;
    }

    const html = `
      <div class="pulse-content">
        <h1 class="pulse-greeting-large">${greeting}</h1>
        ${focusText ? `<p class="pulse-focus">${focusText}</p>` : ''}
        <p class="pulse-stats">${statsText}</p>
        <button class="pulse-cta-primary" onclick="document.querySelector('[data-screen=notes]').click()">
          Start writing
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  },

  getEffortIcon(effort) {
    const icons = { quick: '⚡', medium: '🎯', deep: '🔬' };
    return icons[effort] || '🎯';
  },

  formatRelativeDate(dateStr) {
    // Handle missing or invalid dates
    if (!dateStr) return 'Unknown date';

    const date = new Date(dateStr);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('[WorkUI] Invalid date string:', dateStr);
      return 'Unknown date';
    }

    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  },

  // ═══════════════════════════════════════════════════════════
  // MEETINGS TAB
  // ═══════════════════════════════════════════════════════════

  /**
   * Load meetings from notes
   */
  async loadMeetings() {
    const container = document.getElementById('meetings-list');
    if (!container) {
      console.warn('[WorkUI] meetings-list container not found');
      return;
    }

    // Show skeleton loading state
    container.innerHTML = Array(3).fill(0).map(() => `
      <div class="meeting-card skeleton-meeting-card">
        <div class="skeleton skeleton-title" style="width: 60%;"></div>
        <div class="skeleton skeleton-text" style="width: 100%; margin-top: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 40%; margin-top: 4px;"></div>
      </div>
    `).join('');

    const notes = await NotesManager.getAll();
    console.log('[WorkUI] loadMeetings - Total notes:', notes.length);

    // Filter notes that are meetings
    // Check: note.type === 'meeting' OR note.note_type === 'meeting' OR note.meeting exists OR content starts with "Meeting with"
    this.meetings = notes
      .filter(n => {
        const isMeetingType = n.type === 'meeting' || n.note_type === 'meeting';
        const hasMeetingData = !!n.meeting;
        const content = n.content || n.input?.raw_text || '';
        const contentStartsWithMeeting = content.toLowerCase().startsWith('meeting with');
        // Also check enhanced_content for meetings created via MeetingCapture
        const enhancedContent = n.enhanced_content || '';
        const hasEnhancedMeetingContent = enhancedContent.includes('## DISCUSSED') || enhancedContent.includes('## ACTION');

        const isMeeting = isMeetingType || hasMeetingData || contentStartsWithMeeting || hasEnhancedMeetingContent;

        if (isMeeting) {
          console.log('[WorkUI] Found meeting note:', {
            id: n.id,
            type: n.type,
            hasMeetingData,
            contentStart: content.substring(0, 50)
          });
        }

        return isMeeting;
      })
      .sort((a, b) => {
        // Handle both timestamp formats using helper
        const dateA = new Date(this.extractTimestamp(a) || 0);
        const dateB = new Date(this.extractTimestamp(b) || 0);
        return dateB - dateA;
      });

    console.log('[WorkUI] loadMeetings - Found meetings before dedup:', this.meetings.length);

    // Sort to prioritize notes with proper meeting metadata (type='meeting')
    // This ensures we keep the properly tagged version when deduplicating
    this.meetings.sort((a, b) => {
      // First sort by having meeting type/data (prefer these)
      const aHasMeetingData = a.type === 'meeting' || a.meeting ? 1 : 0;
      const bHasMeetingData = b.type === 'meeting' || b.meeting ? 1 : 0;
      if (bHasMeetingData !== aHasMeetingData) return bHasMeetingData - aHasMeetingData;

      // Then sort by date (newest first)
      const dateA = new Date(this.extractTimestamp(a) || 0);
      const dateB = new Date(this.extractTimestamp(b) || 0);
      return dateB - dateA;
    });

    // Deduplicate meetings based on content similarity
    const seenContent = new Set();
    this.meetings = this.meetings.filter(meeting => {
      const content = meeting.content || meeting.input?.raw_text || '';
      // Create a content key (first 100 chars, normalized, remove markers)
      const contentKey = content
        .substring(0, 100)
        .toLowerCase()
        .replace(/__meeting_\d+__/gi, '')
        .replace(/__decision_\d+__/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (seenContent.has(contentKey)) {
        console.log('[WorkUI] Filtering duplicate meeting:', meeting.id, '- keeping version with metadata');
        return false;
      }
      seenContent.add(contentKey);
      return true;
    });

    // Re-sort by date after deduplication
    this.meetings.sort((a, b) => {
      const dateA = new Date(this.extractTimestamp(a) || 0);
      const dateB = new Date(this.extractTimestamp(b) || 0);
      return dateB - dateA;
    });

    console.log('[WorkUI] loadMeetings - After dedup:', this.meetings.length);

    if (this.meetings.length === 0) {
      container.innerHTML = '<p class="meetings-empty">Record meetings to track attendees and outcomes</p>';
      return;
    }

    container.innerHTML = this.meetings.map(meeting => {
      // Get meeting metadata if it exists
      const meetingMeta = meeting.meeting || {};

      // Get raw content from note
      const rawContent = meeting.content || meeting.input?.raw_text || '';

      // Debug logging
      console.log('[WorkUI] Rendering meeting:', {
        id: meeting.id,
        hasMeetingMeta: !!meeting.meeting,
        metaTitle: meetingMeta.title,
        metaAttendees: meetingMeta.attendees,
        rawContentStart: rawContent.substring(0, 50)
      });

      // Extract attendees - prefer from metadata, then parse from content
      let attendees = meetingMeta.attendees || [];
      if (attendees.length === 0) {
        // Try to parse attendees from content
        // Handle both clean content and corrupted "Meeting with X:Meeting with X:" patterns
        const match = rawContent.match(/meeting with\s+([^:\n]+)/i);
        if (match && match[1]) {
          const namesPart = match[1].trim();
          if (namesPart.toLowerCase() !== 'team') {
            // Parse names separated by commas, semicolons, or "and"
            attendees = namesPart
              .replace(/\s+and\s+/gi, ',')  // Replace " and " with comma
              .split(/[,;]/)
              .map(n => n.trim())
              .filter(n => n && n.toLowerCase() !== 'team' && n.toLowerCase() !== 'and');
          }
        }
      }
      console.log('[WorkUI] Meeting attendees extracted:', {
        id: meeting.id,
        fromMeta: meetingMeta.attendees?.length > 0,
        attendees: attendees
      });

      // Build title from attendees
      let title = 'Meeting';
      if (attendees.length > 0) {
        title = `Meeting with ${attendees.join(', ')}`;
      } else if (meetingMeta.title && !meetingMeta.title.includes('team')) {
        title = meetingMeta.title;
      }

      // Extract discussion content (skip the "Meeting with X:" header line)
      let discussionContent = meetingMeta.content || '';
      if (!discussionContent && rawContent) {
        // Find content after the first line
        const firstNewline = rawContent.indexOf('\n');
        if (firstNewline > -1) {
          discussionContent = rawContent.substring(firstNewline + 1).trim();
        }
      }
      // Remove any markers from content
      discussionContent = discussionContent
        .replace(/__meeting_\d+__/gi, '')
        .replace(/__decision_\d+__/gi, '')
        .trim();

      // Create a preview (first 80 chars)
      const contentPreview = discussionContent.length > 80
        ? discussionContent.substring(0, 80) + '...'
        : discussionContent;

      // Get action items from meeting data or from analysis
      const actionItems = meetingMeta.actionItems || meeting.analysis?.actions || [];
      const actionCount = actionItems.length;
      const completed = meeting.analysis?.actionsCompleted || [];
      const openCount = actionCount - completed.length;

      // Get first open action item for preview
      let firstAction = '';
      if (actionItems.length > 0) {
        const firstItem = actionItems[0];
        let actionText = typeof firstItem === 'string' ? firstItem : firstItem.action || firstItem.text || '';
        // Clean up action text
        actionText = actionText.replace(/__meeting_\d+__/gi, '').replace(/__decision_\d+__/gi, '').trim();
        if (actionText.length > 60) actionText = actionText.substring(0, 60) + '...';
        firstAction = actionText;
      }

      // Handle timestamp - try multiple formats with robust fallback
      let formattedDate = 'Unknown date';
      const timestamp = this.extractTimestamp(meeting);
      if (timestamp) {
        try {
          const dateObj = new Date(timestamp);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });
          }
        } catch (e) {
          console.warn('[WorkUI] Date parse error:', timestamp);
        }
      }

      return `
        <div class="meeting-card" data-note-id="${meeting.id}">
          <div class="meeting-card-header" onclick="WorkUI.openMeetingDetail('${meeting.id}')">
            <div class="meeting-card-title">${title}</div>
            <div class="meeting-card-date">${formattedDate}</div>
          </div>
          ${contentPreview ? `
            <div class="meeting-card-preview" onclick="WorkUI.openMeetingDetail('${meeting.id}')">${contentPreview}</div>
          ` : ''}
          ${firstAction ? `
            <div class="meeting-card-action-preview" onclick="WorkUI.openMeetingDetail('${meeting.id}')">
              <span class="action-bullet">→</span> ${firstAction}
              ${openCount > 1 ? `<span class="more-actions">+${openCount - 1} more</span>` : ''}
            </div>
          ` : ''}
          <button class="meeting-delete-btn" data-meeting-id="${meeting.id}" aria-label="Delete meeting">
            <span>Delete</span>
          </button>
        </div>
      `;
    }).join('');

    // Attach delete button listeners (works better on mobile than inline onclick)
    const deleteButtons = container.querySelectorAll('.meeting-delete-btn');
    console.log('[WorkUI] Found delete buttons:', deleteButtons.length);

    deleteButtons.forEach(btn => {
      console.log('[WorkUI] Attaching listener to button with meeting ID:', btn.dataset.meetingId);
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[WorkUI] Delete button clicked');
        const meetingId = btn.dataset.meetingId;
        console.log('[WorkUI] Meeting ID:', meetingId);
        if (meetingId) {
          await this.deleteMeeting(meetingId);
        }
      });
      // Also add touch event for mobile
      btn.addEventListener('touchend', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[WorkUI] Delete button touched');
        const meetingId = btn.dataset.meetingId;
        if (meetingId) {
          await this.deleteMeeting(meetingId);
        }
      });
    });
  },

  /**
   * Open meeting detail view
   */
  openMeetingDetail(noteId) {
    console.log('[WorkUI] openMeetingDetail called with noteId:', noteId);
    // Open the note detail view
    if (typeof UI !== 'undefined' && UI.openNoteDetail) {
      UI.openNoteDetail(noteId);
    } else {
      console.error('[WorkUI] UI.openNoteDetail not available');
    }
  },

  /**
   * Delete a meeting (which is a note)
   */
  async deleteMeeting(noteId) {
    const confirmed = await UI.confirm('Delete this meeting?', {
      title: 'Delete Meeting',
      confirmText: 'Delete',
      cancelText: 'Keep',
      danger: true
    });

    if (!confirmed) return;

    console.log('[WorkUI] Deleting meeting:', noteId);

    try {
      // Use Sync.deleteNote for cloud + local deletion
      if (typeof Sync !== 'undefined' && Sync.deleteNote) {
        await Sync.deleteNote(noteId);
      } else {
        await DB.deleteNote(noteId);
      }

      // Remove from local cache
      if (typeof NotesCache !== 'undefined') {
        NotesCache.removeNote(noteId);
      }

      // Refresh meetings list with error handling
      try {
        await this.loadMeetings();
      } catch (loadError) {
        console.warn('[WorkUI] Failed to refresh meetings after delete:', loadError);
        // Still show success since delete worked
      }

      console.log('[WorkUI] Meeting deleted successfully');
      UI.showToast('Meeting deleted');
    } catch (error) {
      console.error('[WorkUI] Failed to delete meeting:', error);
      UI.showToast("Couldn't delete — try again");
    }
  },

  // ═══════════════════════════════════════════════════════════
  // COMMITMENTS TAB
  // ═══════════════════════════════════════════════════════════

  /**
   * Load commitments from notes
   */
  async loadCommitments() {
    const container = document.getElementById('commitments-list');
    if (!container) return;

    const notes = await NotesManager.getAll();
    this.commitments = [];

    // Extract commitments from all notes
    notes.forEach(note => {
      const actions = note.analysis?.actions || [];
      const completed = note.analysis?.actionsCompleted || [];

      actions.forEach((action, idx) => {
        if (action?.commitment && !completed.includes(idx)) {
          this.commitments.push({
            id: `${note.id}-${idx}`,
            text: action.commitment,
            actionText: typeof action === 'string' ? action : action.action || action.text,
            noteId: note.id,
            noteDate: note.created_at,
            actionIndex: idx
          });
        }
      });
    });

    // Sort by date (most recent first)
    this.commitments.sort((a, b) => new Date(b.noteDate) - new Date(a.noteDate));

    if (this.commitments.length === 0) {
      container.innerHTML = '<p class="commitments-empty">Decisions you\'re tracking will appear here</p>';
      return;
    }

    container.innerHTML = this.commitments.map(c => `
      <div class="commitment-card" data-commitment-id="${c.id}">
        <div class="commitment-text">"${c.text}"</div>
        <div class="commitment-meta">${this.formatRelativeDate(c.noteDate)}</div>
        <div class="commitment-actions">
          <button class="commitment-btn commitment-btn-done" onclick="WorkUI.resolveCommitment('${c.id}', 'done')">Done</button>
          <button class="commitment-btn commitment-btn-working" onclick="WorkUI.resolveCommitment('${c.id}', 'working')">Still working</button>
          <button class="commitment-btn commitment-btn-wont" onclick="WorkUI.resolveCommitment('${c.id}', 'wont')">Won't do</button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Resolve a commitment
   */
  async resolveCommitment(commitmentId, status) {
    const commitment = this.commitments.find(c => c.id === commitmentId);
    if (!commitment) return;

    const notes = await NotesManager.getAll();
    const note = notes.find(n => n.id === commitment.noteId);
    if (!note) return;

    // Mark the action as completed
    if (status === 'done' || status === 'wont') {
      if (!note.analysis) note.analysis = {};
      if (!note.analysis.actionsCompleted) note.analysis.actionsCompleted = [];

      if (!note.analysis.actionsCompleted.includes(commitment.actionIndex)) {
        note.analysis.actionsCompleted.push(commitment.actionIndex);
        await DB.saveNote(note);

        // Track signal for analytics
        if (typeof SignalTracker !== 'undefined') {
          SignalTracker.track('commitment_resolved', {
            status,
            commitmentId,
            noteId: commitment.noteId
          });
        }
      }
    }

    // Refresh the list
    await this.loadCommitments();

    // Show feedback
    if (typeof UI !== 'undefined' && UI.showToast) {
      const messages = {
        done: 'Commitment completed!',
        working: 'Keep going!',
        wont: 'Commitment removed'
      };
      UI.showToast(messages[status] || 'Updated');
    }
  },

  // ═══════════════════════════════════════════════════════════
  // MEETING MODAL
  // ═══════════════════════════════════════════════════════════

  meetingAttendees: [],
  meetingRecording: false,

  /**
   * Open the meeting modal
   */
  openMeetingModal() {
    const modal = document.getElementById('meeting-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.meetingAttendees = [];
      this.renderAttendeeChips();
      this.showAttendeeSuggestions();
      document.getElementById('meeting-content').value = '';
      document.getElementById('meeting-attendees-input').focus();
    }
  },

  /**
   * Close the meeting modal
   */
  closeMeetingModal() {
    const modal = document.getElementById('meeting-modal');
    if (modal) {
      modal.classList.add('hidden');
      this.stopMeetingVoice();
    }
  },

  /**
   * Load known entities for suggestions
   */
  async loadKnownEntities() {
    try {
      if (typeof Entities !== 'undefined' && Entities.getAll) {
        const entities = await Entities.getAll();
        this.knownEntities = entities
          .filter(e => e.entity_type === 'person')
          .map(e => e.name);
      }
    } catch (e) {
      console.warn('[WorkUI] Could not load known entities:', e);
    }
  },

  /**
   * Show attendee suggestions
   */
  showAttendeeSuggestions() {
    const container = document.getElementById('meeting-attendees-suggestions');
    if (!container || this.knownEntities.length === 0) return;

    const available = this.knownEntities.filter(name => !this.meetingAttendees.includes(name));
    if (available.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.innerHTML = available.slice(0, 5).map(name => `
      <button class="meeting-suggestion" onclick="WorkUI.addAttendee('${name}')">${name}</button>
    `).join('');
    container.classList.remove('hidden');
  },

  /**
   * Handle attendee input for filtering suggestions
   */
  handleAttendeeInput(e) {
    const value = e.target.value.toLowerCase();
    const container = document.getElementById('meeting-attendees-suggestions');
    if (!container) return;

    if (!value) {
      this.showAttendeeSuggestions();
      return;
    }

    const matches = this.knownEntities.filter(name =>
      name.toLowerCase().includes(value) && !this.meetingAttendees.includes(name)
    );

    if (matches.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.innerHTML = matches.slice(0, 5).map(name => `
      <button class="meeting-suggestion" onclick="WorkUI.addAttendee('${name}')">${name}</button>
    `).join('');
    container.classList.remove('hidden');
  },

  /**
   * Add an attendee
   */
  addAttendee(name) {
    if (!name || this.meetingAttendees.includes(name)) return;
    this.meetingAttendees.push(name);
    this.renderAttendeeChips();
    this.showAttendeeSuggestions();
    document.getElementById('meeting-attendees-input').value = '';
  },

  /**
   * Remove an attendee
   */
  removeAttendee(name) {
    this.meetingAttendees = this.meetingAttendees.filter(n => n !== name);
    this.renderAttendeeChips();
    this.showAttendeeSuggestions();
  },

  /**
   * Render attendee chips
   */
  renderAttendeeChips() {
    const container = document.getElementById('meeting-attendees-list');
    if (!container) return;

    container.innerHTML = this.meetingAttendees.map(name => `
      <span class="attendee-chip">
        ${name}
        <button class="attendee-remove" onclick="WorkUI.removeAttendee('${name}')" aria-label="Remove ${name}">×</button>
      </span>
    `).join('');
  },

  /**
   * Toggle voice recording for meeting
   */
  toggleMeetingVoice() {
    if (this.meetingRecording) {
      this.stopMeetingVoice();
    } else {
      this.startMeetingVoice();
    }
  },

  /**
   * Start voice recording for meeting
   */
  startMeetingVoice() {
    const btn = document.getElementById('meeting-voice-btn');
    const textarea = document.getElementById('meeting-content');
    const display = document.getElementById('meeting-transcript-display');

    if (!btn || !textarea) return;

    this.meetingRecording = true;
    btn.classList.add('recording');

    // Use Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.meetingRecognition = new SpeechRecognition();
      this.meetingRecognition.continuous = true;
      this.meetingRecognition.interimResults = true;

      let finalTranscript = textarea.value;

      this.meetingRecognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        textarea.value = finalTranscript;
        if (display) display.textContent = interimTranscript;
      };

      this.meetingRecognition.onerror = (event) => {
        console.warn('[WorkUI] Speech recognition error:', event.error);
        this.stopMeetingVoice();
      };

      this.meetingRecognition.onend = () => {
        if (this.meetingRecording) {
          // Restart if still recording
          this.meetingRecognition.start();
        }
      };

      this.meetingRecognition.start();
    }
  },

  /**
   * Stop voice recording for meeting
   */
  stopMeetingVoice() {
    const btn = document.getElementById('meeting-voice-btn');
    const display = document.getElementById('meeting-transcript-display');

    this.meetingRecording = false;
    if (btn) btn.classList.remove('recording');
    if (display) display.textContent = '';

    if (this.meetingRecognition) {
      this.meetingRecognition.stop();
      this.meetingRecognition = null;
    }
  },

  /**
   * Save the meeting
   */
  async saveMeeting() {
    // Prevent double saves - set flag IMMEDIATELY before any async work
    if (this.isSavingMeeting) {
      console.log('[WorkUI] saveMeeting - Already saving, ignoring duplicate call');
      return;
    }
    this.isSavingMeeting = true;

    // Also disable the save button to prevent race conditions
    const saveBtn = document.getElementById('meeting-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    const content = document.getElementById('meeting-content').value.trim();
    if (!content) {
      UI.showToast('Please add meeting content');
      this.isSavingMeeting = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Meeting';
      }
      return;
    }

    // Get attendees from chips (already added via Enter key)
    let attendees = [...this.meetingAttendees];
    console.log('[WorkUI] saveMeeting - Attendees from chips:', attendees);

    // Also parse any remaining text in the input field (handles "Sarah, Marcus" typed directly)
    const attendeesInput = document.getElementById('meeting-attendees-input');
    console.log('[WorkUI] saveMeeting - Input field found:', !!attendeesInput);
    console.log('[WorkUI] saveMeeting - Input field value:', JSON.stringify(attendeesInput?.value));

    if (attendeesInput && attendeesInput.value.trim()) {
      const inputValue = attendeesInput.value.trim();
      // Parse names separated by commas, semicolons, or "and"
      // Handles: "Sarah, Marcus", "Sarah; Marcus", "Sarah and Marcus", "Sarah, Marcus and John"
      const inputNames = inputValue
        .replace(/\s+and\s+/gi, ',')  // Replace " and " with comma
        .split(/[,;]+/)
        .map(name => name.trim())
        .filter(name => name && name.length > 0 && name.toLowerCase() !== 'and' && !attendees.includes(name));
      console.log('[WorkUI] saveMeeting - Parsed names from input:', inputNames);
      attendees = [...attendees, ...inputNames];
    }

    // Double-check: if still no attendees and input field had text, log a warning
    if (attendees.length === 0 && attendeesInput?.value) {
      console.warn('[WorkUI] saveMeeting - WARNING: No attendees captured despite input field having text');
    }

    // Final attendees list
    console.log('[WorkUI] saveMeeting - Final attendees:', attendees);

    // Create note content with attendees
    const attendeesStr = attendees.length > 0 ? attendees.join(', ') : 'team';
    const noteContent = `Meeting with ${attendeesStr}:\n\n${content}`;

    console.log('[WorkUI] saveMeeting - Note content start:', noteContent.substring(0, 100));

    // Close modal first
    this.closeMeetingModal();

    // Show loading
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Saving meeting...');
    }

    try {
      // Process note through App pipeline - returns the saved note directly
      console.log('[WorkUI] saveMeeting - Calling App.processNote...');
      const savedNote = await App.processNote(noteContent, 'text');
      console.log('[WorkUI] saveMeeting - App.processNote complete, note ID:', savedNote.id);

      // Add meeting metadata to the saved note
      savedNote.type = 'meeting';
      savedNote.note_type = 'meeting'; // Database column for filtering
      savedNote.meeting = {
        title: `Meeting with ${attendees.join(', ') || 'team'}`,
        attendees: attendees,
        content: content
      };

      // Extract action items from analysis if present
      if (savedNote.analysis?.actions) {
        savedNote.meeting.actionItems = savedNote.analysis.actions.map(a => ({
          text: typeof a === 'string' ? a : a.action || a.text,
          owner: 'you',
          done: false
        }));
      }

      console.log('[WorkUI] saveMeeting - Updating with meeting metadata:', {
        id: savedNote.id,
        type: savedNote.type,
        title: savedNote.meeting.title
      });

      // Save the updated note with meeting metadata
      await DB.saveNote(savedNote);
      console.log('[WorkUI] saveMeeting - Meeting metadata saved');

      // Update NotesCache with meeting metadata (fixes cache having old version)
      if (typeof NotesCache !== 'undefined') {
        NotesCache.updateNote(savedNote);
      }

      // Invalidate NotesManager cache so loadMeetings gets fresh data
      if (typeof NotesManager !== 'undefined') {
        NotesManager.invalidate();
      }

      // Track analytics
      if (typeof Analytics !== 'undefined') {
        Analytics.meetingSaved(savedNote.id, attendees.length);
      }

      // Track feature usage for personalization
      if (typeof DataCapture !== 'undefined') {
        DataCapture.trackFeatureUse('meeting_save', { attendeeCount: attendees.length });
      }

      // Ingest meeting into Knowledge Graph with full metadata
      if (typeof window !== 'undefined' && window.ingestInput) {
        const userId = typeof Sync !== 'undefined' && Sync.user?.id ? Sync.user.id : null;
        if (userId) {
          window.ingestInput(userId, {
            type: 'meeting',
            content: noteContent,
            sourceId: savedNote.id,
            metadata: {
              title: savedNote.meeting.title,
              attendees: attendees,
              actionItems: savedNote.meeting.actionItems || []
            }
          }).catch(err => console.warn('[WorkUI] Knowledge graph ingestion error:', err));
        }
      }

      // Switch to meetings tab after a short delay
      setTimeout(() => {
        console.log('[WorkUI] saveMeeting - Switching to meetings tab');
        this.switchTab('meetings');
        this.loadMeetings();
      }, 500);

    } catch (error) {
      console.error('[WorkUI] Failed to save meeting:', error);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Couldn\'t save meeting — try again');
      }
    } finally {
      // Reset save flag and re-enable button
      this.isSavingMeeting = false;
      const btn = document.getElementById('meeting-save-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Meeting';
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // DECISION MODAL
  // ═══════════════════════════════════════════════════════════

  decisionRecording: false,

  /**
   * Open the decision modal
   */
  openDecisionModal() {
    const modal = document.getElementById('decision-modal');
    if (modal) {
      modal.classList.remove('hidden');
      // Reset scroll position to top before populating
      modal.scrollTop = 0;
      document.getElementById('decision-topic').value = '';
      document.getElementById('decision-content').value = '';
      // Use preventScroll to avoid jumping
      document.getElementById('decision-topic').focus({ preventScroll: true });
    }
  },

  /**
   * Close the decision modal
   */
  closeDecisionModal() {
    const modal = document.getElementById('decision-modal');
    if (modal) {
      modal.classList.add('hidden');
      this.stopDecisionVoice();
    }
  },

  /**
   * Toggle voice recording for decision
   */
  toggleDecisionVoice() {
    if (this.decisionRecording) {
      this.stopDecisionVoice();
    } else {
      this.startDecisionVoice();
    }
  },

  /**
   * Start voice recording for decision
   */
  startDecisionVoice() {
    const btn = document.getElementById('decision-voice-btn');
    const textarea = document.getElementById('decision-content');
    const display = document.getElementById('decision-transcript-display');

    if (!btn || !textarea) return;

    this.decisionRecording = true;
    btn.classList.add('recording');

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.decisionRecognition = new SpeechRecognition();
      this.decisionRecognition.continuous = true;
      this.decisionRecognition.interimResults = true;

      let finalTranscript = textarea.value;

      this.decisionRecognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        textarea.value = finalTranscript;
        if (display) display.textContent = interimTranscript;
      };

      this.decisionRecognition.onerror = (event) => {
        console.warn('[WorkUI] Speech recognition error:', event.error);
        this.stopDecisionVoice();
      };

      this.decisionRecognition.onend = () => {
        if (this.decisionRecording) {
          this.decisionRecognition.start();
        }
      };

      this.decisionRecognition.start();
    }
  },

  /**
   * Stop voice recording for decision
   */
  stopDecisionVoice() {
    const btn = document.getElementById('decision-voice-btn');
    const display = document.getElementById('decision-transcript-display');

    this.decisionRecording = false;
    if (btn) btn.classList.remove('recording');
    if (display) display.textContent = '';

    if (this.decisionRecognition) {
      this.decisionRecognition.stop();
      this.decisionRecognition = null;
    }
  },

  /**
   * Save the decision
   */
  async saveDecision() {
    // Prevent double submission
    if (this.isSavingDecision) {
      console.log('[WorkUI] saveDecision - Already saving, skipping');
      return;
    }
    this.isSavingDecision = true;

    const topic = document.getElementById('decision-topic').value.trim();
    const content = document.getElementById('decision-content').value.trim();

    // Disable save button during async operation
    const saveBtn = document.getElementById('decision-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    if (!topic) {
      UI.showToast('Please add what you\'re deciding');
      this.isSavingDecision = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
      return;
    }

    // Create clean note content (no markers)
    const noteContent = `Thinking through: ${topic}\n\n${content}`;

    console.log('[WorkUI] saveDecision - Starting save:', { topic });

    // Close modal first
    this.closeDecisionModal();

    // Show loading
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Saving decision...');
    }

    try {
      // Process note through App pipeline - returns the saved note directly
      const savedNote = await App.processNote(noteContent, 'text');
      console.log('[WorkUI] saveDecision - App.processNote complete, note ID:', savedNote.id);

      // Add decision metadata to the saved note
      savedNote.type = 'decision';
      savedNote.note_type = 'decision'; // Database column for filtering
      savedNote.decision = {
        topic: topic,
        content: content,
        createdAt: new Date().toISOString()
      };

      // Save the updated note with decision metadata
      await DB.saveNote(savedNote);
      console.log('[WorkUI] saveDecision - Decision metadata saved:', savedNote.id);

      // Track analytics
      if (typeof Analytics !== 'undefined') {
        Analytics.decisionSaved(savedNote.id);
      }

      // Switch to actions tab after a short delay
      setTimeout(() => {
        if (this.activeTab === 'actions') {
          this.loadActionsWithExtras();
        }
      }, 500);

    } catch (error) {
      console.error('[WorkUI] Failed to save decision:', error);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Couldn\'t save decision — try again');
      }
    } finally {
      this.isSavingDecision = false;
    }
  },

  /**
   * Load actions with commitments and decisions
   * Called when ACTIONS sub-tab is active
   */
  async loadActionsWithExtras() {
    // ActionsUI handles the main actions
    // We'll add commitments and decisions sections below
    const container = document.getElementById('work-actions');
    if (!container) return;

    const notes = await NotesManager.getAll();

    // Extract commitments
    const commitments = [];
    notes.forEach(note => {
      const actions = note.analysis?.actions || [];
      const completed = note.analysis?.actionsCompleted || [];

      actions.forEach((action, idx) => {
        if (action?.commitment && !completed.includes(idx)) {
          commitments.push({
            id: `${note.id}-${idx}`,
            text: action.commitment,
            noteId: note.id,
            noteDate: note.timestamps?.created_at || note.created_at,
            actionIndex: idx
          });
        }
      });
    });

    // Extract unresolved decisions
    const decisions = notes
      .filter(n => n.type === 'decision' && !n.decision?.resolved)
      .map(n => ({
        id: n.id,
        topic: n.decision?.topic || 'Decision',
        noteDate: n.timestamps?.created_at || n.created_at
      }));

    // Find or create the extras container
    let extrasContainer = container.querySelector('.actions-extras');
    if (!extrasContainer) {
      extrasContainer = document.createElement('div');
      extrasContainer.className = 'actions-extras';
      container.appendChild(extrasContainer);
    }

    let extrasHtml = '';

    // Commitments section
    if (commitments.length > 0) {
      extrasHtml += `
        <div class="actions-extra-section">
          <h3 class="actions-extra-title">
            <span class="actions-extra-label">COMMITMENTS</span>
            <span class="actions-extra-count">${commitments.length}</span>
          </h3>
          <div class="actions-extra-list">
            ${commitments.slice(0, 5).map(c => `
              <div class="commitment-item" data-id="${c.id}">
                <span class="commitment-quote">"${c.text}"</span>
                <span class="commitment-date">${this.formatRelativeDate(c.noteDate)}</span>
                <button class="commitment-done-btn" onclick="WorkUI.resolveCommitment('${c.id}', 'done')">Done</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Decisions section
    if (decisions.length > 0) {
      extrasHtml += `
        <div class="actions-extra-section">
          <h3 class="actions-extra-title">
            <span class="actions-extra-label">DECISIONS</span>
            <span class="actions-extra-count">${decisions.length}</span>
          </h3>
          <div class="actions-extra-list">
            ${decisions.slice(0, 5).map(d => `
              <div class="decision-item" data-id="${d.id}" onclick="WorkUI.openDecisionDetail('${d.id}')">
                <span class="decision-topic">${d.topic}</span>
                <span class="decision-date">${this.formatRelativeDate(d.noteDate)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    extrasContainer.innerHTML = extrasHtml;
  },

  /**
   * Open decision detail (shows the note)
   */
  openDecisionDetail(noteId) {
    console.log('[WorkUI] openDecisionDetail called with noteId:', noteId);
    if (typeof UI !== 'undefined' && UI.openNoteDetail) {
      UI.openNoteDetail(noteId);
    } else {
      console.error('[WorkUI] UI.openNoteDetail not available');
    }
  },

  /**
   * Fix corrupted meeting notes that have repeated "Meeting with team:" in content
   * Run this from console: WorkUI.fixCorruptedMeetings()
   */
  async fixCorruptedMeetings() {
    console.log('[WorkUI] Starting corrupted meetings fix...');

    const notes = await NotesManager.getAll();
    let fixedCount = 0;

    for (const note of notes) {
      const content = note.content || note.input?.raw_text || '';

      // Check for corrupted pattern: "Meeting with team:Meeting with team:"
      if (content.includes('Meeting with team:Meeting with')) {
        console.log('[WorkUI] Found corrupted note:', note.id);

        // Extract the actual content by removing repeated headers
        let cleanContent = content;

        // Remove all "Meeting with team:" prefixes
        while (cleanContent.match(/^meeting with [^:]+:/i)) {
          cleanContent = cleanContent.replace(/^meeting with [^:]+:\s*/i, '');
        }

        // Try to extract attendee names from the original content
        const attendeeMatch = content.match(/meeting with ([^:]+):/i);
        let attendees = [];
        if (attendeeMatch && attendeeMatch[1]) {
          const names = attendeeMatch[1].split(/[,;]/).map(n => n.trim()).filter(n => n && n !== 'team');
          if (names.length > 0) {
            attendees = names;
          }
        }

        // Update note
        const attendeesStr = attendees.length > 0 ? attendees.join(', ') : 'team';
        const newContent = `Meeting with ${attendeesStr}:\n\n${cleanContent.trim()}`;

        if (note.input) {
          note.input.raw_text = newContent;
        }
        note.content = newContent;

        // Update meeting metadata
        note.type = 'meeting';
        note.meeting = {
          title: `Meeting with ${attendeesStr}`,
          attendees: attendees,
          content: cleanContent.trim()
        };

        await DB.saveNote(note);
        fixedCount++;
        console.log('[WorkUI] Fixed note:', note.id, '- new content:', newContent.substring(0, 50));
      }
    }

    console.log('[WorkUI] Fix complete. Fixed', fixedCount, 'corrupted notes');
    this.loadMeetings();
    return { fixed: fixedCount };
  },

  /**
   * Clean up duplicate meeting notes from the database
   * Run this from console: WorkUI.cleanupDuplicates()
   */
  async cleanupDuplicates() {
    console.log('[WorkUI] Starting duplicate cleanup...');

    const notes = await NotesManager.getAll();
    const meetings = notes.filter(n => {
      if (n.type === 'meeting') return true;
      if (n.meeting) return true;
      const content = n.content || n.input?.raw_text || '';
      if (content.toLowerCase().startsWith('meeting with')) return true;
      return false;
    });

    console.log('[WorkUI] Found', meetings.length, 'meeting notes');

    // Group by content similarity
    const groups = {};
    meetings.forEach(meeting => {
      const content = meeting.content || meeting.input?.raw_text || '';
      const contentKey = content
        .substring(0, 100)
        .toLowerCase()
        .replace(/__meeting_\d+__/gi, '')
        .replace(/__decision_\d+__/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!groups[contentKey]) {
        groups[contentKey] = [];
      }
      groups[contentKey].push(meeting);
    });

    // Find duplicates and delete them (keep the one with best metadata)
    let deletedCount = 0;
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      if (group.length > 1) {
        console.log('[WorkUI] Found', group.length, 'duplicates for:', key.substring(0, 50));

        // Sort: prefer type='meeting', then newest
        group.sort((a, b) => {
          const aScore = (a.type === 'meeting' ? 10 : 0) + (a.meeting ? 5 : 0);
          const bScore = (b.type === 'meeting' ? 10 : 0) + (b.meeting ? 5 : 0);
          if (bScore !== aScore) return bScore - aScore;

          const dateA = new Date(a.timestamps?.created_at || a.created_at);
          const dateB = new Date(b.timestamps?.created_at || b.created_at);
          return dateB - dateA;
        });

        // Keep first (best), delete rest
        const toDelete = group.slice(1);
        for (const note of toDelete) {
          console.log('[WorkUI] Deleting duplicate:', note.id);
          await DB.deleteNote(note.id);
          deletedCount++;
        }
      }
    }

    console.log('[WorkUI] Cleanup complete. Deleted', deletedCount, 'duplicates');

    // Refresh the meetings list
    this.loadMeetings();

    return { deleted: deletedCount };
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  WorkUI.init();
});

// Make globally available
window.WorkUI = WorkUI;
