# TASK-024: Meetings Sub-Tab UI

## Overview
Create the Meetings sub-tab within the YOU main tab — a beautiful interface for browsing and querying meetings.

## Priority
P0 — Week 3, Day 1-2

## Dependencies
- Existing YOU tab structure
- Design system
- Meeting notes in database

## Outputs
- `/js/meetings-tab.js` — New file
- CSS additions
- Tab navigation update

## Acceptance Criteria

### Navigation
- [ ] "MEETINGS" tab appears in YOU tab sub-navigation
- [ ] Active state styling (underline or bold)
- [ ] URL updates on tab switch (#you/meetings)

### Layout
- [ ] Search bar at top
- [ ] "Ask across meetings" hint section
- [ ] "+ New Meeting" button
- [ ] Meeting cards grouped by time (This Week, Last Week, Earlier)

### Meeting Cards
- [ ] Title (bold, 16px)
- [ ] Date (uppercase, 11px, gray)
- [ ] Summary (14px, gray, 2 lines max)
- [ ] Action item count
- [ ] Hover state (border turns black)
- [ ] Click opens meeting note

### Empty State
- [ ] Friendly message when no meetings
- [ ] CTA to capture first meeting

## Component Structure

```javascript
// js/meetings-tab.js

export class MeetingsTab {
  constructor(container, options = {}) {
    this.container = container;
    this.userId = options.userId;
    this.meetings = [];
    
    this.render();
    this.loadMeetings();
  }

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
            <button class="hint-chip">"What did Sarah say about the budget?"</button>
            <button class="hint-chip">"Action items from this week"</button>
          </div>
        </div>

        <!-- Query Response (hidden by default) -->
        <div class="meetings-query-response" style="display: none;"></div>

        <!-- Meeting List -->
        <div class="meetings-list-section">
          <div class="meetings-list-header">
            <h3 class="meetings-section-title">THIS WEEK</h3>
            <button class="meetings-new-btn">+ New Meeting</button>
          </div>
          
          <div class="meetings-list" data-period="this-week"></div>
          
          <h3 class="meetings-section-title">LAST WEEK</h3>
          <div class="meetings-list" data-period="last-week"></div>
          
          <h3 class="meetings-section-title">EARLIER</h3>
          <div class="meetings-list" data-period="earlier"></div>
        </div>

        <!-- Empty State -->
        <div class="meetings-empty" style="display: none;">
          <div class="empty-icon">📝</div>
          <h3 class="empty-title">No meetings yet</h3>
          <p class="empty-desc">Capture your first meeting to build your memory.</p>
          <button class="meetings-empty-cta">Start Listening</button>
        </div>
      </div>
    `;

    this.attachListeners();
  }

  attachListeners() {
    // Search input
    const searchInput = this.container.querySelector('.meetings-search-input');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch(searchInput.value);
      }
    });

    // Search button
    this.container.querySelector('.meetings-search-btn')
      .addEventListener('click', () => {
        this.handleSearch(searchInput.value);
      });

    // Hint chips
    this.container.querySelectorAll('.hint-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        searchInput.value = chip.textContent.replace(/"/g, '');
        this.handleSearch(searchInput.value);
      });
    });

    // New Meeting button
    this.container.querySelector('.meetings-new-btn')
      .addEventListener('click', () => this.openNewMeeting());

    // Empty state CTA
    this.container.querySelector('.meetings-empty-cta')
      .addEventListener('click', () => this.openAmbientRecorder());
  }

  async loadMeetings() {
    try {
      const meetings = await this.fetchMeetings();
      this.meetings = meetings;
      this.renderMeetings();
    } catch (error) {
      console.error('Failed to load meetings:', error);
    }
  }

  async fetchMeetings() {
    // Fetch meetings from IndexedDB/API
    // Filter notes where note_type = 'meeting'
    return [];
  }

  renderMeetings() {
    if (this.meetings.length === 0) {
      this.showEmptyState();
      return;
    }

    const grouped = this.groupMeetingsByPeriod(this.meetings);
    
    ['this-week', 'last-week', 'earlier'].forEach(period => {
      const list = this.container.querySelector(`[data-period="${period}"]`);
      const meetings = grouped[period] || [];
      
      if (meetings.length === 0) {
        list.innerHTML = '<p class="no-meetings">No meetings</p>';
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
    });
  }

  renderMeetingCard(meeting) {
    const date = new Date(meeting.created_at);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const actionCount = meeting.meeting_metadata?.action_items?.length || 0;
    
    return `
      <div class="meeting-card" data-note-id="${meeting.id}">
        <div class="meeting-card-header">
          <h4 class="meeting-card-title">${meeting.meeting_metadata?.title || 'Untitled Meeting'}</h4>
          <span class="meeting-card-date">${dateStr}</span>
        </div>
        <p class="meeting-card-summary">${this.getSummary(meeting)}</p>
        ${actionCount > 0 ? `<span class="meeting-card-meta">${actionCount} action item${actionCount !== 1 ? 's' : ''}</span>` : ''}
      </div>
    `;
  }

  getSummary(meeting) {
    // Extract first 2 lines or topics
    const topics = meeting.meeting_metadata?.topics || [];
    if (topics.length > 0) {
      return topics.slice(0, 3).join(', ');
    }
    // Fallback to content preview
    const content = meeting.enhanced_content || meeting.content || '';
    return content.substring(0, 100) + (content.length > 100 ? '...' : '');
  }

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
  }

  async handleSearch(query) {
    if (!query.trim()) return;

    // Check if it's a question (contains ? or starts with what/when/who/etc)
    const isQuestion = query.includes('?') || 
      /^(what|when|who|where|why|how|did|do|does|can|could|tell me)/i.test(query);

    if (isQuestion) {
      await this.performAIQuery(query);
    } else {
      await this.performTextSearch(query);
    }
  }

  async performAIQuery(query) {
    const responseDiv = this.container.querySelector('.meetings-query-response');
    responseDiv.style.display = 'block';
    responseDiv.innerHTML = '<div class="query-loading"><span class="shimmer"></span></div>';

    try {
      const response = await fetch(`/api/query-meetings?q=${encodeURIComponent(query)}&userId=${this.userId}`);
      const data = await response.json();
      
      this.renderQueryResponse(data);
    } catch (error) {
      responseDiv.innerHTML = '<p class="query-error">Failed to search. Try again.</p>';
    }
  }

  renderQueryResponse(data) {
    const responseDiv = this.container.querySelector('.meetings-query-response');
    
    responseDiv.innerHTML = `
      <div class="query-answer">
        <p class="answer-text">${data.answer}</p>
        ${data.sources?.length > 0 ? `
          <div class="answer-sources">
            ${data.sources.map(s => `
              <button class="source-btn" data-note-id="${s.noteId}">
                View: ${s.title} (${s.date})
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Attach source click listeners
    responseDiv.querySelectorAll('.source-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openMeeting(btn.dataset.noteId);
      });
    });
  }

  showEmptyState() {
    this.container.querySelector('.meetings-list-section').style.display = 'none';
    this.container.querySelector('.meetings-empty').style.display = 'flex';
  }

  openMeeting(noteId) {
    // Navigate to note view
    window.location.hash = `#note/${noteId}`;
  }

  openNewMeeting() {
    // Open meeting capture modal
    UI.openMeetingCapture();
  }

  openAmbientRecorder() {
    // Open ambient recorder
    UI.openAmbientRecorder();
  }
}
```

## CSS

```css
/* Meetings Tab Styles */
.meetings-tab {
  padding: 24px;
}

.meetings-search-section {
  margin-bottom: 32px;
}

.meetings-search-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.meetings-search-input {
  width: 100%;
  padding: 16px 48px 16px 16px;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  color: #1A1A1A;
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  transition: border-color 200ms ease-out;
}

.meetings-search-input:focus {
  outline: none;
  border-color: #000000;
}

.meetings-search-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  padding: 8px;
  background: none;
  border: none;
  color: #6B6B6B;
  cursor: pointer;
}

.meetings-query-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.hints-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: #6B6B6B;
}

.hint-chip {
  padding: 6px 12px;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 13px;
  color: #6B6B6B;
  background: #FAFAFA;
  border: 1px solid #E5E5E5;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 200ms ease-out;
}

.hint-chip:hover {
  border-color: #000000;
}

/* Query Response */
.meetings-query-response {
  padding: 24px;
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  margin-bottom: 32px;
}

.answer-text {
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #1A1A1A;
  margin-bottom: 16px;
}

.answer-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-btn {
  padding: 8px 16px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #1A1A1A;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 200ms ease-out;
}

.source-btn:hover {
  border-color: #000000;
}

/* Meeting List */
.meetings-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.meetings-section-title {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #6B6B6B;
  margin-top: 32px;
  margin-bottom: 16px;
}

.meetings-section-title:first-of-type {
  margin-top: 0;
}

.meetings-new-btn {
  padding: 8px 16px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #FFFFFF;
  background: #000000;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 200ms ease-out;
}

.meetings-new-btn:hover {
  background: #1A1A1A;
}

.meetings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Meeting Card */
.meeting-card {
  padding: 20px 24px;
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 200ms ease-out;
}

.meeting-card:hover {
  border-color: #000000;
}

.meeting-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.meeting-card-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #1A1A1A;
}

.meeting-card-date {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6B6B6B;
}

.meeting-card-summary {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #6B6B6B;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meeting-card-meta {
  display: inline-block;
  margin-top: 12px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: #6B6B6B;
}

/* Empty State */
.meetings-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 8px;
}

.empty-desc {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #6B6B6B;
  margin-bottom: 24px;
}

.meetings-empty-cta {
  padding: 12px 24px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #FFFFFF;
  background: #000000;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.no-meetings {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #6B6B6B;
  font-style: italic;
}

/* Mobile */
@media (max-width: 640px) {
  .meetings-tab {
    padding: 16px;
  }
  
  .meetings-query-hints {
    display: none;
  }
  
  .meeting-card {
    padding: 16px;
  }
}
```

## Test Checklist

- [ ] Tab appears in YOU navigation
- [ ] Meetings load and display in groups
- [ ] Search triggers on Enter
- [ ] Question queries return AI response
- [ ] Text search filters meeting cards
- [ ] Meeting card click opens note
- [ ] "+ New Meeting" opens capture modal
- [ ] Empty state shows when no meetings
- [ ] Mobile responsive
