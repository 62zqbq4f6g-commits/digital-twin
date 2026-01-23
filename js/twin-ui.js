/**
 * Twin UI - Manages the Twin tab display and interactions
 */

const TwinUI = {
  /**
   * Initialize Twin UI
   */
  init() {
    this.attachListeners();

    // Load cached stats immediately on init (no flash of 0s)
    this.loadCachedStats();

    // IMMEDIATELY load fresh stats from DB (don't wait for full profile)
    this.loadStatsImmediately();

    // Register for sync complete callback to refresh UI after cloud sync
    if (typeof Sync !== 'undefined') {
      Sync.onSyncComplete = () => {
        console.log('[TwinUI] Sync complete, refreshing data...');
        // Always refresh - data may have changed from cloud
        this.refresh();
      };
    }

    // A4: Listen for note-saved events to refresh TWIN tab data
    window.addEventListener('note-saved', () => {
      console.log('[TwinUI] Note saved, refreshing data...');
      this.refresh();
    });

    console.log('[TwinUI] Initialized');
  },

  /**
   * Load stats immediately from IndexedDB (fast, no profile load needed)
   * This runs in parallel with heavier operations
   */
  async loadStatsImmediately() {
    try {
      console.log('[TwinUI] Loading stats immediately...');

      // Get notes directly from IndexedDB
      let notes = await DB.getAllNotes();

      // Fallback: If IndexedDB is empty but user is authenticated, try to get count from Supabase
      if ((!notes || notes.length === 0) && typeof Sync !== 'undefined' && Sync.user?.id && Sync.supabase) {
        console.log('[TwinUI] IndexedDB empty, fetching note count from Supabase...');
        try {
          const { count, error } = await Sync.supabase
            .from('notes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', Sync.user.id)
            .is('deleted_at', null);

          if (!error && count > 0) {
            console.log('[TwinUI] Supabase has', count, 'notes - sync may be in progress');
            // Update just the note count while sync completes
            const el = document.getElementById('twin-stat-notes');
            if (el) el.textContent = count;
            // Cache this count
            const cached = JSON.parse(localStorage.getItem('twin_stats_cache') || '{}');
            cached.notes = count;
            localStorage.setItem('twin_stats_cache', JSON.stringify(cached));
          }
        } catch (e) {
          console.warn('[TwinUI] Supabase fallback failed:', e);
        }
      }

      if (!notes || notes.length === 0) {
        console.log('[TwinUI] No notes in IndexedDB yet, keeping cached/default stats');
        return;
      }

      // Count notes
      const noteCount = notes.length;

      // Count decisions (unresolved)
      const decisionsCount = notes.filter(note => {
        const decision = note.analysis?.decision || note.decision;
        return decision?.isDecision === true && decision?.resolved !== true;
      }).length;

      // Count patterns - from profile if available
      let patternsCount = 0;
      try {
        const profile = JSON.parse(localStorage.getItem('twin_profile') || '{}');
        patternsCount = profile?.patterns?.length || 0;
      } catch (e) { /* ignore */ }

      // Try to get Phase 13 patterns count from database
      if (typeof window.PatternVerification !== 'undefined' && Sync?.user?.id) {
        try {
          await window.PatternVerification.loadPatterns();
          const phase13Patterns = window.PatternVerification.patterns || [];
          patternsCount += phase13Patterns.length;
        } catch (e) { /* ignore */ }
      }

      // Count feedback directly from notes
      const likedCount = notes.filter(n => n.feedback?.rating === 'liked').length;
      const totalFeedback = notes.filter(n => n.feedback?.rating).length;
      const positiveRate = totalFeedback > 0 ? Math.round((likedCount / totalFeedback) * 100) : 0;

      // Update UI
      const elements = {
        'twin-stat-notes': noteCount,
        'twin-stat-decisions': decisionsCount,
        'twin-stat-patterns': patternsCount,
        'twin-stat-feedback': positiveRate + '%'
      };

      for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      // Cache for next time
      this.cacheStats(noteCount, decisionsCount, patternsCount, positiveRate);

      console.log('[TwinUI] Stats loaded immediately:', { noteCount, decisionsCount, patternsCount, positiveRate });
    } catch (e) {
      console.warn('[TwinUI] Could not load immediate stats:', e);
    }
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Rebuild button
    const rebuildBtn = document.getElementById('twin-rebuild-btn');
    if (rebuildBtn) {
      rebuildBtn.addEventListener('click', async () => {
        await this.rebuildProfile();
      });
    }

    // Phase 8: Save profile button
    const saveProfileBtn = document.getElementById('save-profile');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', async () => {
        await this.saveUserProfile();
      });
    }
  },

  /**
   * Refresh the Twin tab display with current profile data
   */
  async refresh() {
    console.log('[TwinUI] Refreshing display...');

    try {
      const profile = await TwinProfile.load();
      const summary = await TwinEngine.getProfileSummary();

      // Phase 9: Load and render profile sections
      if (typeof UIProfile !== 'undefined') {
        await UIProfile.loadProfile();
        const aboutSection = document.getElementById('about-me-section');
        if (aboutSection) {
          aboutSection.innerHTML = UIProfile.renderAboutYouSection();
        }
        const prefsSection = document.getElementById('preferences-section');
        if (prefsSection) {
          prefsSection.innerHTML = UIProfile.renderPreferencesSection();
        }
        UIProfile.updateKeyPeopleCount();
      }

      // Phase 9: Load and render entities (Your World)
      if (typeof Entities !== 'undefined') {
        await Entities.loadEntities();
        const worldSection = document.getElementById('your-world-section');
        if (worldSection) {
          worldSection.innerHTML = Entities.renderYourWorldSection();
        }
      }

      // Update Learning section (Phase 8)
      await this.renderLearningSection();

      // Phase 13: Update Patterns I've Noticed section
      await this.updatePatternsSection13();

      // Update confidence meter
      this.updateConfidence(summary.confidence);

      // Update stats (async)
      await this.updateStats(summary);

      // Update Phase 3b sections
      await this.updateThinkingThroughSection();
      await this.updateThisWeekSection();
      await this.updateDecisionPatternsSection();
      await this.updateValuesSection();

      // Update quality learning stats
      await this.updateQualitySection();

      // REMOVED: Broken sections that show garbage data
      // this.updatePeopleSection(profile.relationships?.people || []);
      // this.updateTopicsSection(profile.knowledge?.expertise || []);
      // this.updateBeliefsSection(profile.beliefs || {});
      // this.updatePatternsSection(profile.patterns || {});

    } catch (error) {
      console.error('[TwinUI] Failed to refresh:', error);
    }
  },

  /**
   * Update confidence meter
   */
  updateConfidence(confidence) {
    const value = document.getElementById('twin-confidence-value');
    const fill = document.getElementById('twin-confidence-fill');
    const hint = document.getElementById('twin-confidence-hint');

    const percent = Math.round((confidence || 0) * 100);

    if (value) value.textContent = `${percent}%`;
    if (fill) fill.style.width = `${percent}%`;

    if (hint) {
      if (percent < 20) {
        hint.textContent = 'Add more notes to help your twin learn';
      } else if (percent < 50) {
        hint.textContent = 'Your twin is starting to understand you';
      } else if (percent < 80) {
        hint.textContent = 'Your twin knows you well';
      } else {
        hint.textContent = 'Your twin has a strong understanding of you';
      }
    }
  },

  /**
   * Load cached stats immediately (prevents flash of 0s)
   */
  loadCachedStats() {
    try {
      const cached = localStorage.getItem('twin_stats_cache');
      if (cached) {
        const stats = JSON.parse(cached);
        const elements = {
          'twin-stat-notes': stats.notes ?? 0,
          'twin-stat-decisions': stats.decisions ?? 0,
          'twin-stat-patterns': stats.patterns ?? 0,
          'twin-stat-feedback': (stats.feedback ?? 0) + '%'
        };
        for (const [id, value] of Object.entries(elements)) {
          const el = document.getElementById(id);
          if (el) el.textContent = value;
        }
        console.log('[TwinUI] Loaded cached stats:', stats);
      }
    } catch (e) {
      console.warn('[TwinUI] Could not load cached stats:', e);
    }
  },

  /**
   * Cache stats for immediate loading next time
   */
  cacheStats(notes, decisions, patterns, feedback) {
    try {
      localStorage.setItem('twin_stats_cache', JSON.stringify({
        notes, decisions, patterns, feedback,
        cached_at: Date.now()
      }));
    } catch (e) {
      // Ignore cache errors
    }
  },

  /**
   * Update stats grid - counts directly from notes and patterns for consistency
   */
  async updateStats(summary) {
    try {
      // Get all notes for consistent counting
      const notes = await DB.getAllNotes();

      // Count decisions (unresolved) - same logic as "This Week"
      const decisionsCount = notes.filter(note => {
        const decision = note.analysis?.decision || note.decision;
        return decision?.isDecision === true && decision?.resolved !== true;
      }).length;

      // Count patterns from both sources:
      // 1. Phase 3d patterns from profile
      // 2. Phase 13 patterns from database (via PatternVerification)
      let patternsCount = 0;
      try {
        // Phase 3d patterns
        const profile = await TwinProfile.load();
        patternsCount = profile?.patterns?.length || 0;

        // Phase 13 patterns (from database)
        if (typeof window.PatternVerification !== 'undefined' && Sync?.user?.id) {
          await window.PatternVerification.loadPatterns();
          const phase13Patterns = window.PatternVerification.patterns || [];
          patternsCount += phase13Patterns.length;
        }
      } catch (e) {
        // Ignore pattern errors
      }

      // Count feedback directly from notes
      const likedCount = notes.filter(n => n.feedback?.rating === 'liked').length;
      const totalFeedback = notes.filter(n => n.feedback?.rating).length;
      const positiveRate = totalFeedback > 0 ? Math.round((likedCount / totalFeedback) * 100) : 0;

      // Cache stats for immediate loading next time
      this.cacheStats(notes.length, decisionsCount, patternsCount, positiveRate);

      const elements = {
        'twin-stat-notes': notes.length,  // Always show actual note count
        'twin-stat-decisions': decisionsCount,
        'twin-stat-patterns': patternsCount,
        'twin-stat-feedback': positiveRate + '%'
      };

      for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      }
    } catch (e) {
      console.warn('[TwinUI] Could not update stats:', e);
    }
  },

  /**
   * Update people section
   */
  updatePeopleSection(people) {
    const container = document.getElementById('twin-people-list');
    if (!container) return;

    if (!people || people.length === 0) {
      container.innerHTML = '<p class="twin-empty">No people extracted yet</p>';
      return;
    }

    // Sort by mentions and take top 10
    const sorted = [...people]
      .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
      .slice(0, 10);

    container.innerHTML = sorted.map(person => `
      <div class="twin-item">
        <span class="twin-item-name">${this.escapeHtml(person.name)}</span>
        <span class="twin-item-meta">${person.relationship || 'mentioned'}</span>
      </div>
    `).join('');
  },

  /**
   * Update topics/expertise section
   */
  updateTopicsSection(expertise) {
    const container = document.getElementById('twin-topics-list');
    if (!container) return;

    if (!expertise || expertise.length === 0) {
      container.innerHTML = '<p class="twin-empty">No topics extracted yet</p>';
      return;
    }

    // Take top 10
    const sorted = expertise.slice(0, 10);

    container.innerHTML = sorted.map(topic => {
      const depth = Math.round((topic.depth || 0) * 100);
      return `
        <div class="twin-item">
          <span class="twin-item-name">${this.escapeHtml(topic.topic)}</span>
          <div class="twin-item-bar">
            <div class="twin-item-bar-fill" style="width: ${depth}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Update beliefs section
   */
  updateBeliefsSection(beliefs) {
    const container = document.getElementById('twin-beliefs-list');
    if (!container) return;

    const opinions = beliefs.opinions || [];
    const values = beliefs.values || [];

    if (opinions.length === 0 && values.length === 0) {
      container.innerHTML = '<p class="twin-empty">No beliefs extracted yet</p>';
      return;
    }

    let html = '';

    // Show values first
    if (values.length > 0) {
      html += '<div class="twin-values">';
      html += values.map(v => `<span class="twin-value-tag">${this.escapeHtml(v)}</span>`).join('');
      html += '</div>';
    }

    // Show top opinions
    if (opinions.length > 0) {
      const topOpinions = opinions.slice(0, 5);
      html += topOpinions.map(op => `
        <div class="twin-belief">
          <span class="twin-belief-topic">${this.escapeHtml(op.topic)}</span>
          <span class="twin-belief-stance twin-stance-${op.stance}">${op.stance}</span>
        </div>
      `).join('');
    }

    container.innerHTML = html;
  },

  /**
   * Update patterns section
   */
  updatePatternsSection(patterns) {
    const container = document.getElementById('twin-patterns-list');
    if (!container) return;

    const items = [];

    // Temporal patterns
    if (patterns.temporal?.mostCreative) {
      const creative = patterns.temporal.mostCreative;
      items.push(`Most creative: ${creative.start || 'unknown'}`);
    }

    if (patterns.temporal?.mostProductiveDays?.length > 0) {
      items.push(`Most active: ${patterns.temporal.mostProductiveDays.join(', ')}`);
    }

    // Behavioral patterns
    if (patterns.behavioral?.sessionLength) {
      items.push(`Session length: ${patterns.behavioral.sessionLength}`);
    }

    // Emotional patterns
    if (patterns.emotional?.baselineEnergy !== undefined) {
      const energy = Math.round(patterns.emotional.baselineEnergy * 100);
      items.push(`Baseline energy: ${energy}%`);
    }

    if (items.length === 0) {
      container.innerHTML = '<p class="twin-empty">No patterns detected yet</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="twin-pattern">
        <span>${this.escapeHtml(item)}</span>
      </div>
    `).join('');
  },

  /**
   * Update "Thinking Through" section - shows unresolved decisions
   */
  async updateThinkingThroughSection() {
    const container = document.getElementById('twin-thinking-through-list');
    if (!container) return;

    try {
      // Get all notes
      const notes = await DB.getAllNotes();

      // Filter for unresolved decisions OR notes marked "Still Thinking"
      const openLoops = notes.filter(note => {
        const decision = note.analysis?.decision || note.decision;
        // Show if: AI detected as decision and not resolved, OR user marked as "Still Thinking"
        const isUnresolvedDecision = decision?.isDecision === true && decision?.resolved !== true;
        const isMarkedThinking = decision?.status === 'thinking';
        return isUnresolvedDecision || isMarkedThinking;
      }).sort((a, b) => {
        // Sort by creation date, newest first
        const dateA = new Date(a.timestamps?.created_at || a.created_at || 0);
        const dateB = new Date(b.timestamps?.created_at || b.created_at || 0);
        return dateB - dateA;
      }).slice(0, 10); // Limit to 10

      if (openLoops.length === 0) {
        container.innerHTML = '<p class="twin-empty">No open loops</p>';
        return;
      }

      container.innerHTML = openLoops.map(note => {
        const decision = note.analysis?.decision || note.decision || {};
        const title = note.analysis?.title || note.extracted?.title || 'Untitled';
        const timeAgo = this.formatTimeAgo(note.timestamps?.created_at || note.created_at);
        const decisionType = decision.type || 'pending';

        return `
          <div class="twin-decision" data-note-id="${note.id}">
            <div class="twin-decision-header">
              <span class="twin-decision-title">${this.escapeHtml(title)}</span>
              <span class="twin-decision-type">${decisionType}</span>
            </div>
            <div class="twin-decision-meta">
              <span class="twin-decision-time">${timeAgo}</span>
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers - navigate to note
      container.querySelectorAll('.twin-decision').forEach(el => {
        el.addEventListener('click', () => {
          const noteId = el.dataset.noteId;
          if (noteId && typeof UI !== 'undefined') {
            // Switch to notes tab first
            UI.showScreen('notes');
            // Then open the note detail
            UI.openNoteDetail(noteId);
          }
        });
      });

    } catch (error) {
      console.error('[TwinUI] Error updating thinking through:', error);
      container.innerHTML = '<p class="twin-empty">Error loading open loops</p>';
    }
  },

  /**
   * Update "This Week" section - shows weekly activity summary
   */
  async updateThisWeekSection() {
    const container = document.getElementById('twin-this-week-list');
    if (!container) return;

    try {
      // Get all notes
      const notes = await DB.getAllNotes();

      // Get start of this week (Sunday)
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Filter notes from this week
      const weekNotes = notes.filter(note => {
        const noteDate = new Date(note.timestamps?.created_at || note.created_at || 0);
        return noteDate >= startOfWeek;
      });

      if (weekNotes.length === 0) {
        container.innerHTML = '<p class="twin-empty">No activity this week</p>';
        return;
      }

      // Calculate summary stats
      const categories = { work: 0, personal: 0, ideas: 0 };
      let actionsCount = 0;
      let decisionsCount = 0;

      weekNotes.forEach(note => {
        const cat = note.classification?.category || note.analysis?.category || 'personal';
        if (categories[cat] !== undefined) categories[cat]++;

        const actions = note.analysis?.actions || note.extracted?.action_items || [];
        actionsCount += actions.length;

        const decision = note.analysis?.decision || note.decision;
        if (decision?.isDecision) decisionsCount++;
      });

      let html = '<div class="this-week-summary">';
      html += `<div class="this-week-stat"><span class="stat-value">${weekNotes.length}</span><span class="stat-label">notes</span></div>`;
      html += `<div class="this-week-stat"><span class="stat-value">${actionsCount}</span><span class="stat-label">actions</span></div>`;
      html += `<div class="this-week-stat"><span class="stat-value">${decisionsCount}</span><span class="stat-label">decisions</span></div>`;
      html += '</div>';

      // Category breakdown
      html += '<div class="this-week-categories">';
      if (categories.work > 0) html += `<span class="week-category">💼 ${categories.work} work</span>`;
      if (categories.personal > 0) html += `<span class="week-category">🏠 ${categories.personal} personal</span>`;
      if (categories.ideas > 0) html += `<span class="week-category">💡 ${categories.ideas} ideas</span>`;
      html += '</div>';

      container.innerHTML = html;

    } catch (error) {
      console.error('[TwinUI] Error updating this week:', error);
      container.innerHTML = '<p class="twin-empty">Error loading activity</p>';
    }
  },

  /**
   * Update patterns section - Phase 3d AI-detected patterns
   */
  async updateDecisionPatternsSection() {
    const container = document.getElementById('twin-decision-patterns-list');
    if (!container) return;

    try {
      const notes = await DB.getAllNotes();
      const profile = await TwinProfile.load();

      // Not enough notes for pattern detection
      if (notes.length < 10) {
        const remaining = 10 - notes.length;
        const progress = Math.min((notes.length / 10) * 100, 100);
        container.innerHTML = `
          <div class="patterns-empty">
            <div class="patterns-empty-title">Not enough data yet</div>
            <div class="patterns-empty-subtitle">
              Capture ${remaining} more note${remaining !== 1 ? 's' : ''} for pattern detection
            </div>
            <div class="patterns-progress">
              <div class="patterns-progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="patterns-progress-label">${notes.length}/10</div>
          </div>
        `;
        return;
      }

      // Has enough notes but no patterns yet
      if (!profile?.patterns || profile.patterns.length === 0) {
        container.innerHTML = `
          <div class="patterns-empty">
            <div class="patterns-empty-subtitle" style="font-style: italic;">
              Tap "Rebuild Profile" to detect patterns
            </div>
          </div>
        `;
        return;
      }

      // Render detected patterns with evidence (filter out invalid patterns)
      const validPatterns = (Array.isArray(profile.patterns) ? profile.patterns : [])
        .filter(p => p && typeof p === 'object' && (p.title || p.description));

      const patternsHtml = validPatterns.map(p => {
        const hasEvidence = p.evidence && p.evidence.length > 0;
        const title = p.title || 'Untitled Pattern';
        const description = p.description || 'No description available';
        return `
          <div class="pattern-item">
            <div class="pattern-icon">${p.icon || '💡'}</div>
            <div class="pattern-content">
              <div class="pattern-title">${this.escapeHtml(title)}</div>
              <div class="pattern-description">${this.escapeHtml(description)}</div>
              ${hasEvidence || p.noteCount ? `
                <div class="pattern-evidence">
                  <div class="evidence-toggle" onclick="TwinUI.toggleEvidence(this)">
                    Based on ${p.noteCount || '?'} notes ↓
                  </div>
                  <div class="evidence-list" style="display: none;">
                    ${hasEvidence ? `<div class="evidence-note">${this.escapeHtml(p.evidence)}</div>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="patterns-header">
          <span class="patterns-count">${validPatterns.length} detected</span>
        </div>
        <div class="patterns-list">
          ${patternsHtml}
        </div>
        <div class="patterns-footer">
          ${this.capitalizeFirst(profile.patternsConfidence || 'medium')} confidence · Based on ${notes.length} notes
        </div>
      `;

    } catch (error) {
      console.error('[TwinUI] Error updating patterns:', error);
      container.innerHTML = '<p class="twin-empty">Error loading patterns</p>';
    }
  },

  /**
   * Phase 13: Update Patterns I've Noticed section using PatternVerification
   */
  async updatePatternsSection13() {
    const container = document.getElementById('twin-patterns-container');
    if (!container) return;

    try {
      // Check if PatternVerification instance is available (must use window. to get instance)
      if (typeof window.PatternVerification === 'undefined') {
        console.warn('[TwinUI] PatternVerification not available');
        return;
      }

      // Ensure Sync.user is available before loading patterns
      if (!Sync?.user?.id) {
        container.innerHTML = '<p class="twin-empty">Loading patterns...</p>';
        return;
      }

      // Load patterns using the instance
      await window.PatternVerification.loadPatterns();

      // Render the section
      container.innerHTML = window.PatternVerification.renderTwinSection();

    } catch (error) {
      console.error('[TwinUI] Error updating Phase 13 patterns:', error);
      container.innerHTML = '<p class="twin-empty">Error loading patterns</p>';
    }
  },

  /**
   * Toggle pattern evidence visibility
   */
  toggleEvidence(element) {
    const list = element.nextElementSibling;
    if (!list) return;
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    // Update arrow
    const text = element.textContent;
    element.textContent = text.replace(isHidden ? '↓' : '↑', isHidden ? '↑' : '↓');
  },

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Update values section
   */
  async updateValuesSection() {
    const container = document.getElementById('twin-values-list');
    if (!container) return;

    try {
      const profile = await TwinProfile.load();
      const beliefs = profile.beliefs || {};
      const values = beliefs.values || [];

      if (values.length === 0) {
        container.innerHTML = '<p class="twin-empty">No values detected yet</p>';
        return;
      }

      container.innerHTML = values.map(value => `
        <span class="twin-value-tag">${this.escapeHtml(value)}</span>
      `).join('');

    } catch (error) {
      console.error('[TwinUI] Error updating values:', error);
      container.innerHTML = '<p class="twin-empty">Error loading values</p>';
    }
  },

  /**
   * Format decision status for display
   */
  formatStatus(status) {
    const statusMap = {
      deliberating: 'Deciding',
      committed: 'Committed',
      resolved: 'Resolved'
    };
    return statusMap[status] || 'Pending';
  },

  /**
   * Format time ago string
   */
  formatTimeAgo(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  },

  // Animation interval for detecting patterns
  _detectingInterval: null,

  /**
   * Update rebuild button state with elegant loading
   */
  updateRebuildState(state, progress = null) {
    const btn = document.getElementById('twin-rebuild-btn');
    if (!btn) return;

    const textEl = btn.querySelector('span:first-child');
    if (!textEl) return;

    // Clear any existing animation
    if (this._detectingInterval) {
      clearInterval(this._detectingInterval);
      this._detectingInterval = null;
    }

    switch (state) {
      case 'analyzing':
        btn.disabled = true;
        btn.classList.add('rebuilding');
        textEl.textContent = progress ? `Analyzing ${progress.current} of ${progress.total}...` : 'Analyzing...';
        break;
      case 'detecting':
        // Animated ellipsis for detecting patterns
        let dots = 0;
        const baseText = 'Detecting patterns';
        textEl.textContent = baseText;
        this._detectingInterval = setInterval(() => {
          dots = (dots + 1) % 4;
          textEl.textContent = baseText + '.'.repeat(dots);
        }, 400);
        break;
      case 'complete':
        btn.classList.remove('rebuilding');
        textEl.textContent = 'Complete';
        setTimeout(() => {
          textEl.textContent = 'Rebuild Profile';
          btn.disabled = false;
        }, 1500);
        break;
      case 'error':
        btn.classList.remove('rebuilding');
        textEl.textContent = 'Failed';
        setTimeout(() => {
          textEl.textContent = 'Rebuild Profile';
          btn.disabled = false;
        }, 1500);
        break;
      default:
        btn.classList.remove('rebuilding');
        textEl.textContent = 'Rebuild Profile';
        btn.disabled = false;
    }
  },

  /**
   * Rebuild profile from all notes - Phase 3d: includes pattern detection
   */
  async rebuildProfile() {
    try {
      console.log('[TwinUI] Starting profile rebuild...');

      // Check if TwinEngine is available
      if (typeof TwinEngine === 'undefined') {
        throw new Error('TwinEngine not loaded');
      }

      // Get notes count for progress
      const notes = await DB.getAllNotes();
      const totalNotes = notes.length;

      // Show analyzing state with count
      this.updateRebuildState('analyzing', { current: 0, total: totalNotes });

      await TwinEngine.runFullAnalysis();
      console.log('[TwinUI] Full analysis complete');

      // Phase 3d: Pattern Detection
      if (totalNotes >= 10) {
        this.updateRebuildState('detecting');
        console.log('[TwinUI] Running pattern detection...');

        // Prepare note summaries for pattern API
        const noteSummaries = notes
          .filter(n => n.analysis) // Only notes with analysis
          .slice(0, 50) // Limit to 50 most recent
          .map(n => ({
            date: new Date(n.timestamps?.created_at || n.createdAt || Date.now()).toLocaleDateString(),
            category: n.classification?.category || n.analysis?.category || 'personal',
            title: n.analysis?.title || 'Untitled',
            summary: n.analysis?.summary || '',
            isDecision: n.analysis?.decision?.isDecision || false,
            decisionType: n.analysis?.decision?.type || null,
            resolved: n.analysis?.decision?.resolved || false
          }));

        try {
          const response = await fetch('/api/patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: noteSummaries })
          });

          if (response.ok) {
            const patternData = await response.json();
            console.log('[TwinUI] Patterns detected:', patternData);

            // Save patterns to profile
            let profile = await TwinProfile.load() || { id: 'main' };
            profile.patterns = patternData.patterns || [];
            profile.patternsConfidence = patternData.confidence || 'medium';
            profile.patternsDetectedAt = new Date().toISOString();
            profile.patternsSuggestion = patternData.suggestion || null;
            await TwinProfile.save(profile);
            console.log('[TwinUI] Patterns saved to profile');

            // Sync to cloud (non-blocking)
            if (typeof TwinProfile.syncToCloud === 'function') {
              TwinProfile.syncToCloud().catch(e => console.warn('[TwinUI] Cloud sync failed:', e));
            }
          } else {
            console.warn('[TwinUI] Pattern API returned non-OK status:', response.status);
          }
        } catch (patternError) {
          console.error('[TwinUI] Pattern detection failed:', patternError);
          // Don't fail the whole rebuild
        }
      }

      await this.refresh();
      console.log('[TwinUI] Rebuild complete');
      this.updateRebuildState('complete');

    } catch (error) {
      console.error('[TwinUI] Rebuild failed:', error);
      console.error('[TwinUI] Error name:', error.name);
      console.error('[TwinUI] Error message:', error.message);
      console.error('[TwinUI] Error stack:', error.stack);
      this.updateRebuildState('error');
    }
  },

  /**
   * Update quality learning section - counts feedback directly from notes
   */
  async updateQualitySection() {
    try {
      // Count feedback directly from notes
      const notes = await DB.getAllNotes();
      const likedCount = notes.filter(n => n.feedback?.rating === 'liked').length;
      const dislikedCount = notes.filter(n => n.feedback?.rating === 'disliked').length;
      const totalFeedback = likedCount + dislikedCount;

      // Calculate positive rate
      const positiveRate = totalFeedback > 0 ? Math.round((likedCount / totalFeedback) * 100) : 0;

      // Update bar
      const bar = document.getElementById('quality-bar');
      if (bar) {
        bar.style.width = `${positiveRate}%`;
      }

      // Update trend based on recent feedback
      const trend = document.getElementById('quality-trend');
      if (trend) {
        if (totalFeedback === 0) {
          trend.textContent = '— No feedback yet';
          trend.className = 'quality-trend';
        } else if (positiveRate >= 70) {
          trend.textContent = '↑ Good';
          trend.className = 'quality-trend quality-trend-up';
        } else if (positiveRate <= 30) {
          trend.textContent = '↓ Needs work';
          trend.className = 'quality-trend quality-trend-down';
        } else {
          trend.textContent = '— Mixed';
          trend.className = 'quality-trend';
        }
      }

      // Update counts
      const liked = document.getElementById('quality-liked');
      const disliked = document.getElementById('quality-disliked');
      if (liked) liked.textContent = `${likedCount} approved`;
      if (disliked) disliked.textContent = `${dislikedCount} rejected`;

      // Update preferences from QualityLearning if available
      if (typeof QualityLearning !== 'undefined') {
        const stats = await QualityLearning.getQualityStats() || {};
        const prefsContainer = document.getElementById('quality-preferences');
        if (prefsContainer && (stats.topPreferences?.likes?.length > 0 || stats.topPreferences?.dislikes?.length > 0)) {
          let html = '';

          if (stats.topPreferences?.likes?.length > 0) {
            html += '<div class="quality-pref-section">';
            html += '<span class="quality-pref-label">You prefer:</span>';
            html += '<div class="quality-pref-tags">';
            stats.topPreferences.likes.forEach(pref => {
              html += `<span class="quality-pref-tag quality-pref-like">${this.formatPrefName(pref)}</span>`;
            });
            html += '</div></div>';
          }

          if (stats.topPreferences?.dislikes?.length > 0) {
            html += '<div class="quality-pref-section">';
            html += '<span class="quality-pref-label">You dislike:</span>';
            html += '<div class="quality-pref-tags">';
            stats.topPreferences.dislikes.forEach(pref => {
              html += `<span class="quality-pref-tag quality-pref-dislike">${this.formatPrefName(pref)}</span>`;
            });
            html += '</div></div>';
          }

          prefsContainer.innerHTML = html;
        }
      }

    } catch (error) {
      console.error('[TwinUI] Error updating quality section:', error);
    }
  },

  /**
   * Format preference code to readable name
   */
  formatPrefName(code) {
    const map = {
      'pattern_connection': 'Pattern connections',
      'specific_question': 'Specific questions',
      'tension_surfacing': 'Surfacing tensions',
      'non_obvious_insight': 'Non-obvious insights',
      'systems_thinking': 'Systems thinking',
      'concise': 'Concise responses',
      'too_generic': 'Generic advice',
      'obvious_observation': 'Obvious observations',
      'vague_question': 'Vague questions',
      'missed_point': 'Missing the point',
      'too_verbose': 'Verbose responses',
      'wrong_tone': 'Wrong tone'
    };
    return map[code] || code;
  },

  /**
   * Phase 8: Update About Me section
   */
  async updateAboutMeSection() {
    const container = document.getElementById('about-me-section');
    if (!container) return;

    try {
      // Load user profile
      if (typeof UserProfile === 'undefined') {
        console.warn('[TwinUI] UserProfile not available');
        return;
      }

      const profile = await UserProfile.load();

      // Update form fields
      const nameInput = document.getElementById('profile-name');
      const aboutInput = document.getElementById('profile-about');
      const descriptorsInput = document.getElementById('profile-descriptors');

      if (nameInput && profile?.displayName) {
        nameInput.value = profile.displayName;
      }

      if (aboutInput && profile?.aboutMe) {
        aboutInput.value = profile.aboutMe;
      }

      if (descriptorsInput && profile?.selfDescriptors?.length > 0) {
        descriptorsInput.value = profile.selfDescriptors.join(', ');
      }

      console.log('[TwinUI] About Me section updated');

    } catch (error) {
      console.error('[TwinUI] Error updating About Me section:', error);
    }
  },

  /**
   * Phase 8: Save user profile from About Me form
   */
  async saveUserProfile() {
    try {
      const nameInput = document.getElementById('profile-name');
      const aboutInput = document.getElementById('profile-about');
      const descriptorsInput = document.getElementById('profile-descriptors');

      const displayName = nameInput?.value?.trim() || '';
      const aboutMe = aboutInput?.value?.trim() || '';
      const descriptorsRaw = descriptorsInput?.value?.trim() || '';

      // Parse comma-separated descriptors
      const selfDescriptors = descriptorsRaw
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      // Save to UserProfile
      if (typeof UserProfile === 'undefined') {
        console.error('[TwinUI] UserProfile not available');
        this.showProfileSaveResult(false);
        return;
      }

      const success = await UserProfile.save({
        displayName,
        aboutMe,
        selfDescriptors
      });

      this.showProfileSaveResult(success);

      if (success) {
        console.log('[TwinUI] Profile saved:', { displayName, aboutMe, selfDescriptors });
      }

    } catch (error) {
      console.error('[TwinUI] Error saving profile:', error);
      this.showProfileSaveResult(false);
    }
  },

  /**
   * Show profile save result feedback
   */
  showProfileSaveResult(success) {
    const btn = document.getElementById('save-profile');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = success ? 'Saved!' : 'Error';
    btn.disabled = true;

    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1500);
  },

  /**
   * Phase 8: Render the "What I've Learned" section
   */
  async renderLearningSection() {
    const container = document.getElementById('learning-section');
    if (!container) return;

    try {
      // Gather stats
      const entityStats = await this.getEntityStats();
      const feedbackStats = await this.getFeedbackStats();

      // Check if we have any data to show
      const hasData = entityStats.total > 0 || feedbackStats.total > 0;

      if (!hasData) {
        container.innerHTML = `
          <div class="learning-section">
            <h3>What I've Learned</h3>
            <p class="learning-empty">Keep using the app and I'll start learning your patterns!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="learning-section">
          <h3>What I've Learned</h3>

          <div class="learning-category">
            <h4>Your World</h4>
            <div class="learning-stats">
              <div class="stat">
                <span class="stat-value">${entityStats.people}</span>
                <span class="stat-label">People</span>
              </div>
              <div class="stat">
                <span class="stat-value">${entityStats.pets}</span>
                <span class="stat-label">Pets</span>
              </div>
              <div class="stat">
                <span class="stat-value">${entityStats.projects}</span>
                <span class="stat-label">Projects</span>
              </div>
            </div>
            ${entityStats.topMentioned ? `
              <p class="learning-insight">Most mentioned: <strong>${this.escapeHtml(entityStats.topMentioned)}</strong></p>
            ` : ''}
          </div>

          <div class="learning-category">
            <h4>Feedback</h4>
            <div class="learning-stats">
              <div class="stat">
                <span class="stat-value">${feedbackStats.total}</span>
                <span class="stat-label">Total Given</span>
              </div>
              <div class="stat">
                <span class="stat-value">${feedbackStats.positive}</span>
                <span class="stat-label">Approved</span>
              </div>
              <div class="stat">
                <span class="stat-value">${feedbackStats.negative}</span>
                <span class="stat-label">Rejected</span>
              </div>
            </div>
          </div>

          <div class="learning-footer">
            <p>Learning from your feedback to become more helpful</p>
          </div>
        </div>
      `;

      console.log('[TwinUI] Learning section rendered');

    } catch (error) {
      console.error('[TwinUI] Error rendering learning section:', error);
      container.innerHTML = '';
    }
  },

  /**
   * Phase 8: Get entity statistics
   */
  async getEntityStats() {
    try {
      if (typeof EntityMemory === 'undefined') {
        return { total: 0, people: 0, pets: 0, places: 0, projects: 0, topMentioned: null };
      }

      const entities = await EntityMemory.loadEntities();
      const people = entities.filter(e => e.type === 'person').length;
      const pets = entities.filter(e => e.type === 'pet').length;
      const places = entities.filter(e => e.type === 'place').length;
      const projects = entities.filter(e => e.type === 'project').length;

      // Find most mentioned
      let topMentioned = null;
      let maxMentions = 0;
      entities.forEach(e => {
        const count = e.metadata?.mention_count || 0;
        if (count > maxMentions) {
          maxMentions = count;
          topMentioned = e.name;
        }
      });

      return {
        total: entities.length,
        people,
        pets,
        places,
        projects,
        topMentioned
      };

    } catch (error) {
      console.error('[TwinUI] getEntityStats error:', error);
      return { total: 0, people: 0, pets: 0, places: 0, projects: 0, topMentioned: null };
    }
  },

  /**
   * Phase 8: Get feedback statistics
   */
  async getFeedbackStats() {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        return { total: 0, positive: 0, negative: 0 };
      }

      // Use Sync.user directly (already set by Sync.init())
      const user = Sync.user;

      if (!user) {
        return { total: 0, positive: 0, negative: 0 };
      }

      const { data, error } = await Sync.supabase
        .from('output_feedback')
        .select('rating')
        .eq('user_id', user.id);

      if (error || !data) {
        return { total: 0, positive: 0, negative: 0 };
      }

      const total = data.length;
      const positive = data.filter(d => d.rating === 'liked').length;
      const negative = data.filter(d => d.rating === 'disliked').length;

      return { total, positive, negative };

    } catch (error) {
      console.error('[TwinUI] getFeedbackStats error:', error);
      return { total: 0, positive: 0, negative: 0 };
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TwinUI = TwinUI;
}
