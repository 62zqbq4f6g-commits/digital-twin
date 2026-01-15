/**
 * Actions UI - Phase 5A.5 + Phase 7
 * Tab-based layout: SUGGESTED | ALL OPEN | DONE
 * Improved deduplication with Map
 * Streak tracking with explanations
 * Debug logging for effort icons
 * Phase 7: Action completion signals to Supabase
 */

console.log('=== ACTIONS-UI.JS LOADED ===');

// Debug function to check what's in the database
window.debugActions = async function() {
  console.log('=== DEBUGGING ACTIONS ===');

  const notes = await DB.getAllNotes();
  console.log('Total notes:', notes.length);

  notes.forEach((note, i) => {
    console.log(`\n--- Note ${i + 1}: ${note.id} ---`);
    console.log('note.analysis:', note.analysis);
    console.log('note.analysis?.actions:', note.analysis?.actions);

    if (note.analysis?.actions) {
      note.analysis.actions.forEach((action, j) => {
        console.log(`  Action ${j + 1}:`, {
          type: typeof action,
          value: action,
          effort: action?.effort,
          text: action?.action || action?.text || action
        });
      });
    }
  });

  console.log('=== END DEBUG ===');
};

// Auto-run hint on load
setTimeout(() => {
  console.log('Run window.debugActions() in console to inspect stored actions');
}, 1000);

/**
 * Phase 5A.7: Calculate suggestion score for an action
 * Higher score = more likely to appear in Suggested tab
 *
 * Weighting:
 * - Time-based: 50 points max (urgency/deadlines)
 * - Effort-based: 30 points max (quick wins surface faster)
 * - Context-based: 20 points max (circadian rhythm)
 */
function calculateSuggestedScore(action) {
  let score = 0;
  const now = new Date();
  const hour = now.getHours();

  // ═══════════════════════════════════════════
  // TIME-BASED (50 points max)
  // ═══════════════════════════════════════════
  if (action.deadline) {
    const deadline = new Date(action.deadline);
    const diffMs = deadline - now;
    const daysUntilDue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) score += 50;        // Overdue - DO NOW
    else if (daysUntilDue === 0) score += 45; // Due today
    else if (daysUntilDue === 1) score += 35; // Due tomorrow
    else if (daysUntilDue <= 3) score += 25;  // Due in 3 days
    else if (daysUntilDue <= 7) score += 15;  // Due this week
    else score += 5;                           // Future
  } else {
    score += 10; // No deadline = moderate time priority
  }

  // ═══════════════════════════════════════════
  // EFFORT-BASED (30 points max)
  // Quick wins surface faster for momentum
  // ═══════════════════════════════════════════
  const effort = action.effort || 'medium';

  if (effort === 'quick') score += 30;      // ⚡ Easy wins
  else if (effort === 'medium') score += 20; // 🎯 Balanced
  else if (effort === 'deep') score += 10;   // 🔬 Requires planning

  // ═══════════════════════════════════════════
  // CONTEXT-BASED: CIRCADIAN RHYTHM (20 points max)
  // Match task type to natural energy patterns
  // ═══════════════════════════════════════════

  // Morning (6am-12pm): Peak focus - boost deep work
  if (hour >= 6 && hour < 12) {
    if (effort === 'deep') score += 20;
    else if (effort === 'medium') score += 12;
    else score += 5; // Quick tasks waste morning peak
  }

  // Afternoon dip (12pm-4pm): Low energy - boost quick wins
  else if (hour >= 12 && hour < 16) {
    if (effort === 'quick') score += 20;
    else if (effort === 'medium') score += 10;
    else score += 5; // Deep work hard during dip
  }

  // Evening peak (4pm-8pm): Second wind - balanced
  else if (hour >= 16 && hour < 20) {
    if (effort === 'medium') score += 18;
    else if (effort === 'deep') score += 15;
    else score += 12;
  }

  // Night (8pm+): Wind down - quick tasks only
  else {
    if (effort === 'quick') score += 20;
    else if (effort === 'medium') score += 8;
    else score += 3; // Don't suggest deep work at night
  }

  return score;
}

// Make available globally for debugging
window.calculateSuggestedScore = calculateSuggestedScore;

/**
 * Phase 5A.7: Debug function to test scoring
 */
window.debugSuggestedScores = async function() {
  const notes = await DB.getAllNotes();
  const hour = new Date().getHours();

  console.log(`\n=== SUGGESTED SCORES (Current hour: ${hour}) ===\n`);

  const allActions = [];

  for (const note of notes) {
    const actions = note.analysis?.actions || [];
    actions.forEach((action, index) => {
      let text = typeof action === 'string' ? action : action.action || action.text;
      let effort = action?.effort || 'medium';
      let deadline = action?.deadline || null;
      let completed = (note.analysis?.actionsCompleted || []).includes(index);

      if (completed) return; // Skip completed

      const score = calculateSuggestedScore({ effort, deadline });

      allActions.push({ text, effort, deadline, score });
    });
  }

  // Sort by score
  allActions.sort((a, b) => b.score - a.score);

  // Display
  allActions.forEach((a, i) => {
    const effortIcon = { quick: '⚡', medium: '🎯', deep: '🔬' }[a.effort];
    console.log(`${i + 1}. [Score: ${a.score}] ${effortIcon} ${a.text?.substring(0, 40)}`);
  });

  console.log('\n=== END ===\n');
};

const ActionsUI = {
  // All actions cache
  allActions: [],

  // Active tab state
  activeTab: 'suggested', // 'suggested' | 'all' | 'done'

  // Streak data
  streakData: {
    currentStreak: 0,
    lastCompletedDate: null
  },

  /**
   * Initialize Actions UI
   */
  init() {
    this.loadStreakData();
  },

  /**
   * Refresh the actions view (called when screen is shown)
   */
  async refresh() {
    await this.loadAllActions();
    this.loadStreakData();
    this.updateStreakDisplay();
    this.render();
  },

  /**
   * Load all actions from all notes (with Map-based deduplication)
   * Phase 5A.1: Now supports action objects with effort levels
   */
  async loadAllActions() {
    try {
      const notes = await DB.getAllNotes();
      const actionsMap = new Map(); // Use Map for better deduplication

      notes.forEach(note => {
        const actions = note.analysis?.actions || [];
        // Phase 5A: Also check actionDetails for full action objects
        const actionDetails = note.analysis?.actionDetails || [];
        const completedIndexes = note.analysis?.actionsCompleted || [];

        actions.forEach((actionItem, index) => {
          // Phase 5C.6: Handle both string and object action formats with fallbacks
          let actionText, effort, deadline, commitment, why, future_state, waiting_on, is_big_task;

          if (typeof actionItem === 'object' && actionItem !== null && actionItem.action) {
            // New Phase 5A/5C format: { action, effort, deadline, commitment, why, future_state, waiting_on, is_big_task }
            actionText = actionItem.action;
            effort = actionItem.effort || 'medium';
            deadline = actionItem.deadline || null;
            // Phase 5C: Nudge data with fallbacks
            commitment = actionItem.commitment || null;
            why = actionItem.why || this.getDefaultWhy(actionText);
            future_state = actionItem.future_state || this.getDefaultFutureState(actionText);
            waiting_on = actionItem.waiting_on || null;
            is_big_task = actionItem.is_big_task ?? this.detectBigTask(actionText);
          } else if (typeof actionItem === 'string') {
            // Legacy format: plain string
            actionText = actionItem;
            // Try to get details from actionDetails if available
            const detail = actionDetails[index];
            effort = detail?.effort || 'medium';
            deadline = detail?.deadline || null;
            commitment = detail?.commitment || null;
            // Phase 5C.6: Apply fallbacks for old notes without why/future_state
            why = detail?.why || this.getDefaultWhy(actionText);
            future_state = detail?.future_state || this.getDefaultFutureState(actionText);
            waiting_on = detail?.waiting_on || null;
            is_big_task = detail?.is_big_task ?? this.detectBigTask(actionText);
          } else {
            return; // Skip invalid entries
          }

          // Create unique key from noteId + action text (normalized)
          const key = `${note.id}-${actionText.trim().toLowerCase()}`;

          // Only add if not already in map (first occurrence wins)
          if (!actionsMap.has(key)) {
            actionsMap.set(key, {
              id: `${note.id}-action-${index}`,
              noteId: note.id,
              noteTitle: note.analysis?.title || note.extracted?.title || 'Untitled',
              actionIndex: index,
              text: actionText,
              effort: effort,
              deadline: deadline,
              // Phase 5C.4: Nudge data with why/future_state
              commitment: commitment,
              why: why,
              future_state: future_state,
              waiting_on: waiting_on,
              is_big_task: is_big_task,
              completed: completedIndexes.includes(index),
              completedAt: completedIndexes.includes(index)
                ? (note.analysis?.actionCompletedDates?.[index] || null)
                : null,
              createdAt: note.timestamps?.created_at || new Date().toISOString(),
              category: note.analysis?.category || note.classification?.category || 'personal',
              isFromDecision: note.analysis?.decision?.isDecision || false
            });
          }
        });
      });

      // Convert Map values to array
      this.allActions = Array.from(actionsMap.values());

      // Sort by created date (newest first)
      this.allActions.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

    } catch (error) {
      console.error('Failed to load actions:', error);
      this.allActions = [];
    }
  },

  /**
   * Get all incomplete actions
   * @returns {Array} Incomplete actions
   */
  getIncompleteActions() {
    return this.allActions.filter(a => !a.completed);
  },

  /**
   * Get completed actions from this week
   * @returns {Array} Completed actions
   */
  getCompletedThisWeek() {
    const startOfWeek = this.getStartOfWeek();
    return this.allActions.filter(a => {
      if (!a.completed || !a.completedAt) return false;
      return new Date(a.completedAt) >= startOfWeek;
    });
  },

  /**
   * Phase 5A.7: Get top suggested actions using smart scoring algorithm
   * Uses scoring based on deadlines, effort levels, and circadian rhythm
   * @param {Array} actions - Incomplete actions
   * @returns {Array} Top 7 scored actions with minimum threshold
   */
  getNowActions(actions) {
    // Score each action using the smart algorithm
    const scored = actions.map(action => {
      const score = calculateSuggestedScore({
        effort: action.effort || 'medium',
        deadline: action.deadline || null
      });

      return { ...action, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Filter by minimum score threshold
    const MIN_SCORE = 35;
    const filtered = scored.filter(a => a.score >= MIN_SCORE);

    // Phase 5C.4: Log with ALL nudge fields including why/future_state
    console.log('Suggested actions with nudge data:', filtered.slice(0, 7).map(a => ({
      text: a.text?.substring(0, 30),
      score: a.score,
      commitment: a.commitment,
      why: a.why,
      future_state: a.future_state,
      is_big_task: a.is_big_task
    })));

    // Take top 7
    return filtered.slice(0, 7);
  },

  /**
   * Phase 5A.7: Get context reason based on circadian rhythm
   * @returns {string} Human-readable reason
   */
  getContextReason() {
    const now = new Date();
    const hour = now.getHours();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[now.getDay()];

    // Morning (6am-12pm): Peak focus
    if (hour >= 6 && hour < 12) {
      return `${dayName} morning — peak focus time`;
    }
    // Afternoon dip (12pm-4pm): Quick wins
    else if (hour >= 12 && hour < 16) {
      return `${dayName} afternoon — quick wins time`;
    }
    // Evening peak (4pm-8pm): Second wind
    else if (hour >= 16 && hour < 20) {
      return `${dayName} evening — second wind`;
    }
    // Night (8pm+): Wind down
    else {
      return `${dayName} night — wind-down time`;
    }
  },

  /**
   * Get start of current week (Monday)
   * @returns {Date} Start of week
   */
  getStartOfWeek() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Monday start
    today.setDate(today.getDate() - diff);
    return today;
  },

  /**
   * Render the tab-based actions hub
   * Three tabs: SUGGESTED | ALL OPEN | DONE
   */
  render() {
    const listEl = document.getElementById('actions-list');
    const emptyEl = document.getElementById('actions-empty');

    if (!listEl || !emptyEl) return;

    const incomplete = this.getIncompleteActions();
    const suggested = this.getNowActions(incomplete);
    const done = this.getCompletedThisWeek();

    emptyEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    let html = '';

    // Header with stats
    html += `
      <div class="actions-page-header">
        <h2 class="actions-page-title">YOUR ACTIONS</h2>
        <p class="actions-meta">${incomplete.length} open · ${done.length} done this week</p>
      </div>
    `;

    // Tab bar
    html += `
      <div class="actions-tabs">
        <button class="action-tab ${this.activeTab === 'suggested' ? 'active' : ''}"
                onclick="ActionsUI.switchTab('suggested')">
          SUGGESTED
        </button>
        <button class="action-tab ${this.activeTab === 'all' ? 'active' : ''}"
                onclick="ActionsUI.switchTab('all')">
          ALL OPEN
        </button>
        <button class="action-tab ${this.activeTab === 'done' ? 'active' : ''}"
                onclick="ActionsUI.switchTab('done')">
          DONE
        </button>
      </div>
    `;

    // Tab content
    html += `<div class="actions-content">`;
    html += this.renderTabContent(suggested, incomplete, done);
    html += `</div>`;

    // Streak section
    html += this.renderStreakSection();

    listEl.innerHTML = html;

    // Attach listeners
    this.attachActionListeners();
  },

  /**
   * Render content for the active tab
   * All tabs now use grouped view for consistency
   */
  renderTabContent(suggested, incomplete, done) {
    switch (this.activeTab) {
      case 'suggested':
        if (suggested.length === 0) {
          return `
            <div class="empty-state">
              <p class="empty-message">No suggestions right now</p>
              <p class="empty-hint">Check All Open for your full list</p>
            </div>
          `;
        }
        return `
          <p class="tab-context">${this.getContextReason()}</p>
          <div class="action-groups">
            ${this.renderGroupedActions(suggested)}
          </div>
        `;

      case 'all':
        if (incomplete.length === 0) {
          return `
            <div class="empty-state">
              <p class="empty-message">All clear</p>
              <p class="empty-hint">Nothing to do right now</p>
            </div>
          `;
        }
        return `
          <div class="action-groups">
            ${this.renderGroupedActions(incomplete)}
          </div>
        `;

      case 'done':
        if (done.length === 0) {
          return `
            <div class="empty-state">
              <p class="empty-message">No completed actions</p>
              <p class="empty-hint">Complete an action to see it here</p>
            </div>
          `;
        }
        return `
          <div class="action-groups done-groups">
            ${this.renderGroupedActions(done)}
          </div>
        `;

      default:
        return '';
    }
  },

  /**
   * Switch active tab
   */
  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  /**
   * Render streak section with explanation
   */
  renderStreakSection() {
    const streak = this.streakData.currentStreak;
    let explanation = '';

    if (streak === 0) {
      explanation = 'Complete an action to start your streak!';
    } else if (streak === 1) {
      explanation = 'You completed an action today! Keep going tomorrow.';
    } else {
      explanation = `${streak} days in a row! Don't break the chain.`;
    }

    return `
      <div class="streak-section">
        <div class="streak-header">
          <span class="streak-fire">🔥</span>
          <span class="streak-days">${streak} day streak</span>
        </div>
        <p class="streak-explanation">${explanation}</p>
      </div>
    `;
  },

  /**
   * Render a single action item with metadata
   * Phase 5A.5: Enhanced debug logging + effort badge
   * @param {Object} action - Action object
   * @param {boolean} showContext - Whether to show note context
   * @returns {string} HTML string
   */
  renderActionItem(action, showContext = false) {
    // Phase 5A.5: Enhanced debug logging
    const effort = action.effort || 'quick';
    console.log('Rendering action with effort:', {
      actionText: action.text?.substring(0, 30),
      effort: effort,
      noteId: action.noteId
    });

    const timeAgo = this.getTimeAgo(action.createdAt);

    // Phase 5A.5: Effort icons and labels
    const effortConfig = {
      quick: { icon: '⚡', label: 'Quick' },
      medium: { icon: '🎯', label: 'Medium' },
      deep: { icon: '🔬', label: 'Deep' }
    };
    const { icon, label } = effortConfig[effort] || effortConfig.quick;

    return `
      <li class="action-item ${action.completed ? 'completed' : ''}"
          data-note-id="${action.noteId}"
          data-action-index="${action.actionIndex}">
        <div class="action-row">
          <input type="checkbox"
                 class="action-checkbox"
                 id="action-${action.noteId}-${action.actionIndex}"
                 ${action.completed ? 'checked' : ''}>
          <label class="action-label" for="action-${action.noteId}-${action.actionIndex}">${this.escapeHtml(action.text)}</label>
        </div>
        <div class="action-effort-row">
          <span class="action-effort-badge">${icon} ${label}</span>
          ${showContext ? `
            <span class="action-source action-note-link" data-note-id="${action.noteId}">from "${this.escapeHtml(action.noteTitle)}" · ${timeAgo}</span>
          ` : `
            <span class="action-time">${timeAgo}</span>
          `}
        </div>
      </li>
    `;
  },

  /**
   * Group actions by their source note
   * @param {Array} actions - Array of action objects
   * @returns {Array} Array of note groups with their actions
   */
  groupActionsByNote(actions) {
    const groups = new Map();

    actions.forEach(action => {
      const noteId = action.noteId;
      if (!groups.has(noteId)) {
        groups.set(noteId, {
          noteId: noteId,
          noteTitle: action.noteTitle || 'Untitled',
          createdAt: action.createdAt,
          category: action.category,
          actions: []
        });
      }
      groups.get(noteId).actions.push(action);
    });

    // Convert to array and sort by most recent note
    return Array.from(groups.values()).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  /**
   * Render actions grouped by note - Vogue editorial style
   * @param {Array} actions - Array of action objects
   * @returns {string} HTML string
   */
  renderGroupedActions(actions) {
    const groups = this.groupActionsByNote(actions);

    if (groups.length === 0) {
      return `<p class="empty-state">No actions yet</p>`;
    }

    return groups.map(group => this.renderNoteGroup(group)).join('');
  },

  /**
   * Render a single note group with its actions
   * Vogue minimalist editorial design
   * @param {Object} group - Note group with actions
   * @returns {string} HTML string
   */
  renderNoteGroup(group) {
    const timeAgo = this.getTimeAgo(group.createdAt);
    const completedCount = group.actions.filter(a => a.completed).length;
    const totalCount = group.actions.length;
    const allDone = completedCount === totalCount;

    return `
      <div class="action-note-group ${allDone ? 'all-done' : ''}" data-note-id="${group.noteId}">
        <div class="action-note-header" onclick="ActionsUI.openNoteFromAction('${group.noteId}')">
          <span class="action-note-title">${this.escapeHtml(group.noteTitle)}</span>
          <span class="action-note-meta">${timeAgo}</span>
        </div>
        <ul class="action-note-items">
          ${group.actions.map(action => this.renderGroupedActionItem(action)).join('')}
        </ul>
        ${totalCount > 1 ? `
          <div class="action-note-progress">
            <span class="progress-text">${completedCount}/${totalCount}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Phase 5C.4: Render a single action item within a group
   * Shows compelling nudges with commitment + why
   * @param {Object} action - Action object
   * @returns {string} HTML string
   */
  renderGroupedActionItem(action) {
    // Compute the smart nudge for this action
    const nudge = this.computeNudge(action);

    let nudgeHtml = '';

    if (nudge) {
      const actionId = `${action.noteId}-action-${action.actionIndex}`;
      if (nudge.type === 'mirror' && nudge.commitment) {
        // Special rendering for mirror: show commitment + why
        nudgeHtml = `
          <div class="action-nudge action-nudge--mirror"
               data-action-id="${actionId}"
               data-nudge-type="${nudge.type}"
               onclick="ActionsUI.trackNudgeClick('${actionId}', '${nudge.type}')">
            <span class="nudge-icon">${nudge.icon}</span>
            <span class="nudge-commitment">"${this.escapeHtml(nudge.commitment)}"</span>
            <span class="nudge-why">${this.escapeHtml(nudge.text)}</span>
          </div>
        `;
      } else {
        // Standard nudge rendering
        nudgeHtml = `
          <div class="action-nudge action-nudge--${nudge.type}"
               data-action-id="${actionId}"
               data-nudge-type="${nudge.type}"
               onclick="ActionsUI.trackNudgeClick('${actionId}', '${nudge.type}')">
            <span class="nudge-icon">${nudge.icon}</span>
            <span class="nudge-text">${this.escapeHtml(nudge.text)}</span>
          </div>
        `;
      }
    }

    return `
      <li class="action-group-item ${action.completed ? 'completed' : ''}"
          data-note-id="${action.noteId}"
          data-action-index="${action.actionIndex}">
        <div class="action-checkbox-wrapper">
          <input type="checkbox"
                 class="action-checkbox"
                 id="action-${action.noteId}-${action.actionIndex}"
                 ${action.completed ? 'checked' : ''}>
          <span class="action-checkmark"></span>
        </div>
        <div class="action-content">
          <span class="action-text">${this.escapeHtml(action.text)}</span>
          ${nudgeHtml}
        </div>
      </li>
    `;
  },

  /**
   * Phase 5C.4: Compute the nudge for an action with compelling text
   * Priority: Mirror > Stakes (waiting) > Stakes (deadline) > Stakes (time) > Momentum
   * @param {Object} action - Action object
   * @returns {Object|null} Nudge object with type, icon, text
   */
  computeNudge(action) {
    // Phase 5C.4: Debug log with why/future_state
    console.log('computeNudge input:', {
      text: action.text?.substring(0, 30),
      commitment: action.commitment,
      why: action.why,
      future_state: action.future_state,
      is_big_task: action.is_big_task
    });

    // 1. MIRROR with WHY/FUTURE - They made a commitment
    if (action.commitment) {
      const nudgeText = this.getCompellingText(action);
      return {
        type: 'mirror',
        icon: '💬',
        commitment: action.commitment,
        text: nudgeText
      };
    }

    // 2. STAKES (waiting) - Someone is waiting
    if (action.waiting_on) {
      return {
        type: 'stakes_waiting',
        icon: '👀',
        text: action.waiting_on
      };
    }

    // 3. STAKES (deadline) - They set a deadline
    if (action.deadline) {
      return {
        type: 'stakes_deadline',
        icon: '🔔',
        text: `By ${action.deadline}`
      };
    }

    // 4. STAKES (time) - Action is aging (>3 days)
    const ageInDays = this.getActionAgeInDays(action.createdAt);
    if (ageInDays >= 3 && !action.completed) {
      return {
        type: 'stakes_time',
        icon: '⏳',
        text: this.getAgingText(ageInDays)
      };
    }

    // 5. MOMENTUM - Big task
    if (action.is_big_task) {
      return {
        type: 'momentum',
        icon: '→',
        text: this.getMomentumText(action.text)
      };
    }

    // No nudge needed
    return null;
  },

  /**
   * Phase 5C.4: Get compelling text (why or future_state)
   */
  getCompellingText(action) {
    // Prefer AI-generated why/future_state
    if (action.why && action.future_state) {
      // Prefer why for more human touch
      return action.why;
    }

    if (action.why) {
      return action.why;
    }

    if (action.future_state) {
      return action.future_state;
    }

    // Fallback to template
    return this.getTemplateFallback(action.text);
  },

  /**
   * Phase 5C.4: Template fallbacks based on action keywords
   */
  getTemplateFallback(actionText) {
    const lower = (actionText || '').toLowerCase();

    // Contact/communication
    if (lower.match(/\b(call|contact|reach out|text|message|email)\b/)) {
      return 'Because the connection matters';
    }

    // Writing/creating
    if (lower.match(/\b(write|draft)\b/)) {
      return 'To get it out of your head';
    }

    // Completing/finishing
    if (lower.match(/\b(complete|finish|finalize)\b/)) {
      return 'So you can let it go';
    }

    // Sending/submitting
    if (lower.match(/\b(send|submit|deliver)\b/)) {
      return 'To move it forward';
    }

    // Planning/preparing
    if (lower.match(/\b(plan|prepare|organize)\b/)) {
      return 'To feel ready';
    }

    // Research/exploration
    if (lower.match(/\b(research|explore|investigate|look into)\b/)) {
      return 'So you know where you stand';
    }

    // Creating/building
    if (lower.match(/\b(create|build|make|design)\b/)) {
      return 'To make it real';
    }

    // Deciding/choosing
    if (lower.match(/\b(decide|choose|pick)\b/)) {
      return 'To stop circling';
    }

    // Review/check
    if (lower.match(/\b(review|check|verify|confirm)\b/)) {
      return 'To be sure';
    }

    // Meeting/discussing
    if (lower.match(/\b(meet|discuss|talk|chat)\b/)) {
      return 'To get aligned';
    }

    // Schedule/book
    if (lower.match(/\b(schedule|book|set up)\b/)) {
      return 'To make it happen';
    }

    // Buy/order/get
    if (lower.match(/\b(buy|order|get|purchase)\b/)) {
      return 'One less thing to think about';
    }

    // Fix/resolve
    if (lower.match(/\b(fix|resolve|solve|address)\b/)) {
      return 'To clear the blocker';
    }

    // Update/revise
    if (lower.match(/\b(update|revise|edit|change)\b/)) {
      return 'To make it right';
    }

    // Follow up
    if (lower.match(/\b(follow up|follow-up|ping|remind)\b/)) {
      return 'To keep it moving';
    }

    // Default
    return 'To move forward';
  },

  /**
   * Phase 5C.4: Get aging text that feels natural
   */
  getAgingText(days) {
    if (days === 3) return 'Waiting a few days now';
    if (days <= 5) return `Sitting for ${days} days`;
    if (days <= 7) return 'Been a week';
    if (days <= 14) return 'Over a week now';
    return 'Been a while';
  },

  /**
   * Phase 5C.6: Get default "why" based on action keywords (frontend fallback)
   */
  getDefaultWhy(text) {
    const lower = (text || '').toLowerCase();

    if (lower.match(/\b(call|contact|reach out|text|message|email)\b/)) return 'Because the connection matters';
    if (lower.match(/\b(write|draft)\b/)) return 'To get it out of your head';
    if (lower.match(/\b(complete|finish|finalize)\b/)) return 'So you can let it go';
    if (lower.match(/\b(send|submit|deliver)\b/)) return 'To move it forward';
    if (lower.match(/\b(plan|prepare|organize)\b/)) return 'To feel ready';
    if (lower.match(/\b(research|explore|investigate)\b/)) return 'So you know where you stand';
    if (lower.match(/\b(create|build|make|design)\b/)) return 'To make it real';
    if (lower.match(/\b(decide|choose|pick)\b/)) return 'To stop circling';
    if (lower.match(/\b(review|check|verify)\b/)) return 'To be sure';
    if (lower.match(/\b(meet|discuss|talk)\b/)) return 'To get aligned';
    if (lower.match(/\b(schedule|book|set up)\b/)) return 'To make it happen';
    if (lower.match(/\b(fix|resolve|solve)\b/)) return 'To clear the blocker';
    if (lower.match(/\b(follow up|ping|remind)\b/)) return 'To keep it moving';

    return 'To move forward';
  },

  /**
   * Phase 5C.6: Get default future state based on action keywords (frontend fallback)
   */
  getDefaultFutureState(text) {
    const lower = (text || '').toLowerCase();

    if (lower.match(/\b(call|contact|reach out)\b/)) return '→ Connected';
    if (lower.match(/\b(email|message|text|send)\b/)) return '→ Sent';
    if (lower.match(/\b(write|draft)\b/)) return '→ Draft done';
    if (lower.match(/\b(complete|finish)\b/)) return '→ Done';
    if (lower.match(/\b(submit)\b/)) return '→ In their hands';
    if (lower.match(/\b(plan|prepare)\b/)) return '→ Ready';
    if (lower.match(/\b(research|explore)\b/)) return '→ Clarity';
    if (lower.match(/\b(create|build|make)\b/)) return '→ It exists';
    if (lower.match(/\b(decide|choose)\b/)) return '→ Decided';
    if (lower.match(/\b(review|check)\b/)) return '→ Verified';
    if (lower.match(/\b(meet|discuss)\b/)) return '→ Aligned';
    if (lower.match(/\b(schedule|book)\b/)) return '→ Scheduled';
    if (lower.match(/\b(fix|resolve)\b/)) return '→ Fixed';

    return '→ Done';
  },

  /**
   * Phase 5C.3: Get momentum text based on action type
   * @param {string} actionText - The action text
   * @returns {string} Momentum nudge text
   */
  getMomentumText(actionText) {
    const lower = (actionText || '').toLowerCase();

    if (lower.includes('write')) return 'Just the first draft';
    if (lower.includes('create')) return 'Start with a rough sketch';
    if (lower.includes('build')) return 'Just the foundation';
    if (lower.includes('plan')) return 'Just the outline';
    if (lower.includes('design')) return 'Start with wireframe';
    if (lower.includes('develop')) return 'Just the scaffold';
    if (lower.includes('prepare')) return 'Just the key points';
    if (lower.includes('research')) return 'Just 15 minutes';
    if (lower.includes('draft')) return 'Rough version only';
    if (lower.includes('outline')) return 'Bullet points first';
    if (lower.includes('complete')) return 'One section at a time';

    return 'Just start';
  },

  /**
   * Phase 5C: Calculate action age in days
   * @param {string} createdAt - ISO date string
   * @returns {number} Age in days
   */
  getActionAgeInDays(createdAt) {
    if (!createdAt) return 0;
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  },

  /**
   * Phase 5C.2: Normalize an action to object format
   * Handles both old format (string) and new format (object)
   * @param {*} action - The action in any format
   * @param {string} noteCreatedAt - When the note was created
   * @returns {Object} Normalized action object
   */
  normalizeAction(action, noteCreatedAt) {
    // Already an object with 'action' field
    if (action && typeof action === 'object' && action.action) {
      return {
        text: action.action,
        commitment: action.commitment || null,
        waiting_on: action.waiting_on || null,
        deadline: action.deadline || null,
        is_big_task: action.is_big_task || false,
        completed: action.completed || false
      };
    }

    // String format - convert
    if (typeof action === 'string') {
      return {
        text: action,
        commitment: null,
        waiting_on: null,
        deadline: null,
        is_big_task: this.detectBigTask(action),
        completed: false
      };
    }

    // Object but with 'text' instead of 'action'
    if (action && typeof action === 'object' && action.text) {
      return {
        text: action.text,
        commitment: action.commitment || null,
        waiting_on: action.waiting_on || null,
        deadline: action.deadline || null,
        is_big_task: action.is_big_task || this.detectBigTask(action.text),
        completed: action.completed || false
      };
    }

    // Fallback
    console.warn('Unknown action format:', action);
    return {
      text: String(action),
      commitment: null,
      waiting_on: null,
      deadline: null,
      is_big_task: false,
      completed: false
    };
  },

  /**
   * Phase 5C.3: Detect if action is a big task based on keywords
   * @param {string} text - Action text
   * @returns {boolean} True if big task
   */
  detectBigTask(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const bigTaskWords = ['write', 'create', 'build', 'plan', 'design', 'develop', 'prepare', 'draft', 'research', 'outline', 'complete', 'finish'];
    return bigTaskWords.some(word => lower.includes(word));
  },

  /**
   * Phase 5C: Format date as relative string
   * @param {string} dateString - ISO date string
   * @returns {string} Relative date string
   */
  formatRelativeDate(dateString) {
    if (!dateString) return 'recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Open note from action click
   * @param {string} noteId - Note ID
   */
  openNoteFromAction(noteId) {
    // Log user action for training
    const action = this.allActions.find(a => a.noteId === noteId);
    if (action) {
      this.logUserAction('note_opened', {
        noteId,
        noteTitle: action.noteTitle,
        source: 'action_click'
      });
    }

    // Track that we came from actions for back navigation
    if (typeof UI !== 'undefined') {
      UI.previousScreen = 'actions';
      UI.showScreen('notes');
      setTimeout(() => {
        UI.openNoteDetail(noteId);
      }, 100);
    }
  },

  /**
   * Get human-readable time ago string
   * @param {string} dateStr - ISO date string
   * @returns {string} Time ago string
   */
  getTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)} weeks ago`;
  },

  /**
   * Attach event listeners to action checkboxes
   * Handles both .action-item (suggested tab) and .action-group-item (grouped tabs)
   */
  attachActionListeners() {
    const checkboxes = document.querySelectorAll('#actions-list .action-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        // Handle both regular and grouped action items
        const li = e.target.closest('.action-item, .action-group-item');
        if (!li) return;

        const noteId = li.dataset.noteId;
        const actionIndex = parseInt(li.dataset.actionIndex);
        const completed = e.target.checked;

        await this.toggleAction(noteId, actionIndex, completed);

        // Update UI
        li.classList.toggle('completed', completed);

        // Update group progress if in a group
        const group = li.closest('.action-note-group');
        if (group) {
          this.updateGroupProgress(group);
        }
      });
    });

    // Click on note header to navigate to note (only in grouped view)
    const noteHeaders = document.querySelectorAll('.action-note-header');
    noteHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent any bubbling
        const group = header.closest('.action-note-group');
        const noteId = group.dataset.noteId;
        this.openNoteFromAction(noteId);
      });
    });

    // Click on action source link to navigate to note (in suggested tab)
    const noteLinks = document.querySelectorAll('.action-note-link');
    noteLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = link.dataset.noteId;
        if (noteId) {
          this.openNoteFromAction(noteId);
        }
      });
    });
  },

  /**
   * Update the progress indicator for a note group
   * @param {HTMLElement} group - The group element
   */
  updateGroupProgress(group) {
    const items = group.querySelectorAll('.action-group-item');
    const completed = group.querySelectorAll('.action-group-item.completed');
    const progressEl = group.querySelector('.progress-text');

    if (progressEl) {
      progressEl.textContent = `${completed.length}/${items.length}`;
    }

    // Update group styling if all done
    group.classList.toggle('all-done', completed.length === items.length);
  },

  /**
   * Toggle action completion
   * @param {string} noteId - Note ID
   * @param {number} actionIndex - Action index
   * @param {boolean} completed - Completed state
   */
  async toggleAction(noteId, actionIndex, completed) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note || !note.analysis) return;

      // Initialize actionsCompleted if needed
      if (!note.analysis.actionsCompleted) {
        note.analysis.actionsCompleted = [];
      }
      if (!note.analysis.actionCompletedDates) {
        note.analysis.actionCompletedDates = {};
      }

      const actionText = note.analysis.actions?.[actionIndex] || '';

      if (completed) {
        // Add to completed
        if (!note.analysis.actionsCompleted.includes(actionIndex)) {
          note.analysis.actionsCompleted.push(actionIndex);
          note.analysis.actionCompletedDates[actionIndex] = new Date().toISOString();
        }

        // Update streak
        this.updateStreak();

        // Log user action for training
        this.logUserAction('action_completed', {
          noteId,
          actionText,
          actionIndex
        });

        // Phase 7: Track completion signal to Supabase
        const actionObj = this.allActions.find(a =>
          a.noteId === noteId && a.actionIndex === actionIndex
        );
        if (actionObj) {
          this.trackActionCompletion(actionObj, noteId, actionIndex);
        }
      } else {
        // Remove from completed
        note.analysis.actionsCompleted = note.analysis.actionsCompleted.filter(i => i !== actionIndex);
        delete note.analysis.actionCompletedDates[actionIndex];

        // Log uncomplete action
        this.logUserAction('action_uncompleted', {
          noteId,
          actionText,
          actionIndex
        });
      }

      await DB.saveNote(note);

      // Update local cache
      const action = this.allActions.find(a =>
        a.noteId === noteId && a.actionIndex === actionIndex
      );
      if (action) {
        action.completed = completed;
        action.completedAt = completed ? new Date().toISOString() : null;
      }

      // Update the stats header immediately (optimistic UI update)
      this.updateStatsHeader();

      // Trigger sync
      if (typeof Sync !== 'undefined' && Sync.isAuthenticated && Sync.isAuthenticated()) {
        Sync.syncNow().catch(e => console.warn('Sync error:', e));
      }

    } catch (error) {
      console.error('Failed to toggle action:', error);
    }
  },

  /**
   * Update the stats header without full re-render
   */
  updateStatsHeader() {
    const statsEl = document.querySelector('.actions-meta');
    if (!statsEl) return;

    const incomplete = this.getIncompleteActions();
    const done = this.getCompletedThisWeek();
    statsEl.textContent = `${incomplete.length} open · ${done.length} done this week`;
  },

  /**
   * Log user action for training the twin
   * @param {string} type - Action type
   * @param {Object} data - Action data
   */
  async logUserAction(type, data) {
    try {
      const action = {
        type,
        data,
        timestamp: new Date().toISOString()
      };

      // Store in TwinProfile's userActions array
      let profile = await DB.loadTwinProfile() || { id: 'default' };
      if (!profile.userActions) {
        profile.userActions = [];
      }

      // Keep last 500 actions
      profile.userActions.push(action);
      if (profile.userActions.length > 500) {
        profile.userActions = profile.userActions.slice(-500);
      }

      profile.meta = profile.meta || {};
      profile.meta.lastUpdated = new Date().toISOString();
      await DB.saveTwinProfile(profile);

    } catch (error) {
      console.error('Failed to log user action:', error);
    }
  },

  /**
   * Phase 7: Track action completion signal to Supabase
   * Stores timing data for learning what actions users complete quickly vs slowly
   * @param {Object} action - The action object
   * @param {string} noteId - Note ID
   * @param {number} actionIndex - Action index
   */
  async trackActionCompletion(action, noteId, actionIndex) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.warn('[ActionsUI] Phase 7: Supabase not available for completion tracking');
        return;
      }

      // Use Sync.user directly (already set by Sync.init())
      const user = Sync.user;

      if (!user) {
        console.warn('[ActionsUI] Phase 7: No authenticated user for completion tracking');
        return;
      }

      // Calculate time to complete (from action creation to now)
      const createdAt = action.createdAt ? new Date(action.createdAt) : new Date();
      const completedAt = new Date();
      const timeToComplete = Math.floor((completedAt - createdAt) / 1000); // seconds

      // Determine which nudge was shown (if any)
      const nudge = this.computeNudge(action);
      const nudgeType = nudge ? nudge.type : null;

      const signalData = {
        user_id: user.id,
        action_id: `${noteId}-action-${actionIndex}`,
        action_text: action.text || '',
        created_at: createdAt.toISOString(),
        completed_at: completedAt.toISOString(),
        time_to_complete: timeToComplete,
        nudge_type: nudgeType,
        nudge_clicked: false // Will be set true via trackNudgeClick
      };

      const { error } = await Sync.supabase
        .from('action_signals')
        .insert(signalData);

      if (error) {
        console.error('[ActionsUI] Phase 7: Supabase insert error:', error);
      } else {
        console.log('[ActionsUI] Phase 7: Action completion tracked', {
          actionId: signalData.action_id,
          timeToComplete: `${timeToComplete}s`,
          nudgeType
        });
      }
    } catch (error) {
      console.error('[ActionsUI] Phase 7: Completion tracking failed:', error);
    }
  },

  /**
   * Phase 7: Track nudge click for effectiveness analysis
   * @param {string} actionId - Action ID
   * @param {string} nudgeType - Type of nudge clicked
   */
  async trackNudgeClick(actionId, nudgeType) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.warn('[ActionsUI] Phase 7: Supabase not available for nudge tracking');
        return;
      }

      // Use Sync.user directly (already set by Sync.init())
      const user = Sync.user;

      if (!user) {
        console.warn('[ActionsUI] Phase 7: No authenticated user for nudge tracking');
        return;
      }

      // Try to update existing action_signal record
      const { error } = await Sync.supabase
        .from('action_signals')
        .update({ nudge_clicked: true })
        .eq('user_id', user.id)
        .eq('action_id', actionId);

      if (error) {
        // If no existing record, create one with nudge_clicked
        const { error: insertError } = await Sync.supabase
          .from('action_signals')
          .insert({
            user_id: user.id,
            action_id: actionId,
            nudge_type: nudgeType,
            nudge_clicked: true,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('[ActionsUI] Phase 7: Nudge click insert error:', insertError);
        }
      }

      console.log('[ActionsUI] Phase 7: Nudge click tracked', { actionId, nudgeType });
    } catch (error) {
      console.error('[ActionsUI] Phase 7: Nudge click tracking failed:', error);
    }
  },

  /**
   * Load streak data from TwinProfile
   */
  async loadStreakData() {
    try {
      const profile = await DB.loadTwinProfile();
      if (profile?.streakData) {
        this.streakData = profile.streakData;
      }
    } catch (error) {
      console.error('Failed to load streak data:', error);
    }
  },

  /**
   * Update streak when action is completed
   */
  async updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = this.streakData.lastCompletedDate;

    if (lastDate === today) {
      // Already completed something today
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
      // Consecutive day - increment streak
      this.streakData.currentStreak++;
    } else if (lastDate !== today) {
      // Not consecutive - reset to 1
      this.streakData.currentStreak = 1;
    }

    this.streakData.lastCompletedDate = today;

    // Save to profile
    await this.saveStreakData();

    // Update display
    this.updateStreakDisplay();
  },

  /**
   * Save streak data to TwinProfile
   */
  async saveStreakData() {
    try {
      let profile = await DB.loadTwinProfile() || { id: 'default' };
      profile.streakData = this.streakData;
      profile.meta = profile.meta || {};
      profile.meta.lastUpdated = new Date().toISOString();
      await DB.saveTwinProfile(profile);
    } catch (error) {
      console.error('Failed to save streak data:', error);
    }
  },

  /**
   * Update streak display in UI
   */
  updateStreakDisplay() {
    const streakEl = document.getElementById('actions-streak');
    if (!streakEl) return;

    const countEl = streakEl.querySelector('.streak-count');
    if (countEl) {
      countEl.textContent = this.streakData.currentStreak;
    }
  },

  /**
   * Get category icon
   * @param {string} category - Category name
   * @returns {string} Icon emoji
   */
  getCategoryIcon(category) {
    const icons = {
      personal: '🏠',
      work: '💼',
      health: '💪',
      ideas: '💡'
    };
    return icons[category] || '📝';
  },

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export for global access
window.ActionsUI = ActionsUI;
