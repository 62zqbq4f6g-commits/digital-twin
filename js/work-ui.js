/**
 * Work UI - Phase 14: Work Utility
 * Orchestrates the WORK tab with sub-tabs: PULSE | ACTIONS | MEETINGS | COMMITMENTS
 *
 * Replaces the old ACTIONS-only tab with a comprehensive work utility system.
 */

console.log('=== WORK-UI.JS LOADED ===');

const WorkUI = {
  // Active sub-tab state
  activeTab: 'pulse',

  // Cache for commitments and meetings
  commitments: [],
  meetings: [],

  // Known entities for suggestions
  knownEntities: [],

  /**
   * Initialize Work UI
   */
  init() {
    console.log('[WorkUI] Initializing...');
    this.attachTabListeners();
    this.attachModeListeners();
    this.attachModalListeners();
    this.loadKnownEntities();
  },

  /**
   * Attach sub-tab click listeners
   */
  attachTabListeners() {
    const tabs = document.querySelectorAll('.work-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.workTab;
        this.switchTab(tabName);
      });
    });
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
    switch (tabName) {
      case 'pulse':
        await this.loadPulse();
        break;
      case 'actions':
        // Actions are handled by ActionsUI
        if (typeof ActionsUI !== 'undefined') {
          ActionsUI.refresh();
        }
        break;
      case 'meetings':
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

    container.innerHTML = '<p class="pulse-loading">Loading your morning pulse...</p>';

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
   * Generate pulse data locally (fallback)
   */
  async generateLocalPulse() {
    const notes = await DB.getAllNotes();
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Get recent notes
    const recentNotes = notes.filter(n => new Date(n.created_at) > weekAgo);

    // Extract open actions
    const openActions = [];
    notes.forEach(note => {
      const actions = note.analysis?.actions || [];
      const completed = note.analysis?.actionsCompleted || [];
      actions.forEach((action, idx) => {
        if (!completed.includes(idx)) {
          openActions.push({
            text: typeof action === 'string' ? action : action.action || action.text,
            effort: action?.effort || 'medium',
            noteId: note.id,
            noteDate: note.created_at
          });
        }
      });
    });

    // Extract commitments
    const commitments = [];
    notes.forEach(note => {
      const actions = note.analysis?.actions || [];
      actions.forEach(action => {
        if (action?.commitment) {
          const completed = note.analysis?.actionsCompleted || [];
          const idx = actions.indexOf(action);
          if (!completed.includes(idx)) {
            commitments.push({
              text: action.commitment,
              noteDate: note.created_at,
              noteId: note.id
            });
          }
        }
      });
    });

    // Get frequently mentioned themes (simple word frequency)
    const themes = this.extractThemes(recentNotes);

    // Get recent people
    const people = await this.getRecentPeople();

    return {
      greeting: this.getGreeting(),
      themes: themes.slice(0, 3),
      openActions: openActions.slice(0, 5),
      commitments: commitments.slice(0, 3),
      people: people.slice(0, 3)
    };
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
   * Render the pulse UI
   */
  renderPulse(data) {
    const container = document.querySelector('.pulse-container');
    if (!container) return;

    const { greeting, themes, openActions, commitments, people } = data;

    let html = `
      <div class="pulse-greeting">${greeting}</div>
    `;

    // On your mind section
    if (themes && themes.length > 0) {
      html += `
        <div class="pulse-section">
          <h3 class="pulse-section-title">On Your Mind</h3>
          <p class="pulse-section-subtitle">Based on recent notes:</p>
          <ul class="pulse-themes">
            ${themes.map(t => `<li>${t.word} (${t.count}x this week)</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Open actions section
    if (openActions && openActions.length > 0) {
      html += `
        <div class="pulse-section">
          <h3 class="pulse-section-title">Open Actions</h3>
          <ul class="pulse-actions">
            ${openActions.map(a => `
              <li class="pulse-action">
                <span class="pulse-action-effort">${this.getEffortIcon(a.effort)}</span>
                <span class="pulse-action-text">${a.text}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Commitments section
    if (commitments && commitments.length > 0) {
      html += `
        <div class="pulse-section">
          <h3 class="pulse-section-title">Commitments</h3>
          <ul class="pulse-commitments">
            ${commitments.map(c => `
              <li class="pulse-commitment">
                <span class="pulse-commitment-text">"${c.text}"</span>
                <span class="pulse-commitment-date">${this.formatRelativeDate(c.noteDate)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // People section
    if (people && people.length > 0) {
      html += `
        <div class="pulse-section">
          <h3 class="pulse-section-title">People in Your Orbit</h3>
          <ul class="pulse-people">
            ${people.map(p => `
              <li class="pulse-person">
                <span class="pulse-person-name">${p.name}</span>
                ${p.context ? `<span class="pulse-person-context">${p.context}</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Start writing CTA
    html += `
      <button class="pulse-cta" onclick="document.querySelector('[data-screen=notes]').click()">
        Start writing
      </button>
    `;

    container.innerHTML = html;
  },

  getEffortIcon(effort) {
    const icons = { quick: '⚡', medium: '🎯', deep: '🔬' };
    return icons[effort] || '🎯';
  },

  formatRelativeDate(dateStr) {
    const date = new Date(dateStr);
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
    if (!container) return;

    const notes = await DB.getAllNotes();

    // Filter notes that are meetings
    // Check: note.type === 'meeting' OR note.meeting exists OR content starts with "Meeting with"
    this.meetings = notes
      .filter(n => {
        if (n.type === 'meeting') return true;
        if (n.meeting) return true;
        // Also detect notes that look like meetings
        const content = n.content || n.input?.raw_text || '';
        if (content.toLowerCase().startsWith('meeting with')) return true;
        return false;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (this.meetings.length === 0) {
      container.innerHTML = '<p class="meetings-empty">No meetings recorded yet.</p>';
      return;
    }

    container.innerHTML = this.meetings.map(meeting => {
      // Get meeting data from either note.meeting or construct from content
      const data = meeting.meeting || {};
      const content = meeting.content || meeting.input?.raw_text || '';

      // Extract title
      let title = data.title || 'Meeting';
      if (!data.title && content.toLowerCase().startsWith('meeting with')) {
        const firstLine = content.split('\n')[0];
        title = firstLine.substring(0, 50) + (firstLine.length > 50 ? '...' : '');
      }

      // Get attendees
      const attendees = data.attendees || [];

      // Get action items from meeting data or from analysis
      const actionItems = data.actionItems || meeting.analysis?.actions || [];
      const actionCount = actionItems.length;
      const completed = meeting.analysis?.actionsCompleted || [];
      const openCount = actionCount - completed.length;

      return `
        <div class="meeting-card" data-note-id="${meeting.id}" onclick="WorkUI.openMeetingDetail('${meeting.id}')">
          <div class="meeting-card-title">${title}</div>
          <div class="meeting-card-meta">
            <span class="meeting-card-date">${new Date(meeting.created_at).toLocaleDateString()}</span>
            ${attendees.length > 0 ? `<span class="meeting-card-attendees">${attendees.join(', ')}</span>` : ''}
          </div>
          ${actionCount > 0 ? `
            <div class="meeting-card-actions">
              ${actionCount} action item${actionCount > 1 ? 's' : ''} · ${openCount > 0 ? openCount + ' open' : 'all done'}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  /**
   * Open meeting detail view
   */
  openMeetingDetail(noteId) {
    // For now, just open the note detail
    if (typeof UI !== 'undefined' && UI.showNoteDetail) {
      UI.showNoteDetail(noteId);
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

    const notes = await DB.getAllNotes();
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
      container.innerHTML = '<p class="commitments-empty">No open commitments.</p>';
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

    const notes = await DB.getAllNotes();
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
    const content = document.getElementById('meeting-content').value.trim();
    if (!content) {
      alert('Please add meeting content');
      return;
    }

    const attendees = [...this.meetingAttendees];

    // Create a note with meeting type
    const noteContent = `Meeting with ${attendees.join(', ') || 'team'}:\n\n${content}`;

    // Close modal first
    this.closeMeetingModal();

    // Show loading
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Saving meeting...');
    }

    try {
      // Process note through App pipeline (handles analysis, entities, etc.)
      await App.processNote(noteContent, 'text');

      // Get the most recent note (the one we just saved)
      const notes = await DB.getAllNotes();
      const recentNote = notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

      if (recentNote) {
        // Add meeting metadata
        recentNote.type = 'meeting';
        recentNote.meeting = {
          title: `Meeting with ${attendees.join(', ') || 'team'}`,
          attendees: attendees,
          content: content
        };

        // Extract action items from analysis if present
        if (recentNote.analysis?.actions) {
          recentNote.meeting.actionItems = recentNote.analysis.actions.map(a => ({
            text: typeof a === 'string' ? a : a.action || a.text,
            owner: 'you',
            done: false
          }));
        }

        // Save the updated note
        await DB.saveNote(recentNote);
        console.log('[WorkUI] Meeting saved with metadata:', recentNote.id);
      }

      // Refresh UI
      UI.loadNotes();

      // Switch to meetings tab after a delay
      setTimeout(() => {
        this.switchTab('meetings');
      }, 1500);

    } catch (error) {
      console.error('[WorkUI] Failed to save meeting:', error);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Failed to save meeting');
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
      document.getElementById('decision-topic').value = '';
      document.getElementById('decision-content').value = '';
      document.getElementById('decision-topic').focus();
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
    const topic = document.getElementById('decision-topic').value.trim();
    const content = document.getElementById('decision-content').value.trim();

    if (!topic) {
      alert('Please add what you\'re deciding');
      return;
    }

    // Create a note with decision type
    const noteContent = `Thinking through: ${topic}\n\n${content}`;

    // Close modal first
    this.closeDecisionModal();

    // Show loading
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Saving...');
    }

    try {
      // Process note through App pipeline
      await App.processNote(noteContent, 'text');

      // Get the most recent note
      const notes = await DB.getAllNotes();
      const recentNote = notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

      if (recentNote) {
        // Add decision metadata
        recentNote.type = 'decision';
        recentNote.decision = {
          topic: topic,
          content: content,
          createdAt: new Date().toISOString()
        };

        // Save the updated note
        await DB.saveNote(recentNote);
        console.log('[WorkUI] Decision saved with metadata:', recentNote.id);
      }

      // Refresh UI
      UI.loadNotes();

    } catch (error) {
      console.error('[WorkUI] Failed to save decision:', error);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Failed to save');
      }
    }
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  WorkUI.init();
});

// Make globally available
window.WorkUI = WorkUI;
