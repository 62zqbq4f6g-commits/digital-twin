/**
 * State of You UI - Monthly Report Display
 * Phase 15: Experience Transformation
 *
 * Displays monthly "State of You" reports in the TWIN tab
 * with themes, people, sentiment, patterns, and reflection questions.
 */

const StateOfYouUI = {
  // Current state
  currentMonth: null,
  currentReport: null,
  isLoading: false,
  availableMonths: [],

  /**
   * Initialize the State of You UI
   */
  init() {
    console.log('[StateOfYouUI] Initializing...');

    // Set current month to previous month (reports are for completed months)
    this.currentMonth = this.getPreviousMonth();

    // Attach listeners
    this.attachListeners();

    console.log('[StateOfYouUI] Initialized');
  },

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Month navigation will be handled by click handlers on rendered buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.state-of-you__nav-btn--prev')) {
        this.navigateToPreviousMonth();
      } else if (e.target.closest('.state-of-you__nav-btn--next')) {
        this.navigateToNextMonth();
      } else if (e.target.closest('.state-of-you__history-item')) {
        const month = e.target.dataset.month;
        if (month) {
          this.loadReport(month);
        }
      } else if (e.target.closest('.state-of-you__generate-btn')) {
        this.generateReport();
      }
    });
  },

  /**
   * Load and display the State of You section
   * Called when TWIN tab is opened
   */
  async load() {
    console.log('[StateOfYouUI] Loading State of You section...');

    // Render container if not exists
    this.ensureContainer();

    // Load the current month's report
    await this.loadReport(this.currentMonth);
  },

  /**
   * Ensure the container exists in the DOM
   */
  ensureContainer() {
    let container = document.getElementById('state-of-you-container');
    if (!container) {
      // Find the TWIN content area
      const twinContent = document.querySelector('#twin-screen .scroll-content');
      if (!twinContent) {
        console.warn('[StateOfYouUI] TWIN content area not found');
        return;
      }

      // Create and insert container at the top
      container = document.createElement('div');
      container.id = 'state-of-you-container';
      container.className = 'state-of-you';

      // Insert before the first existing section
      const firstSection = twinContent.querySelector('.twin-section, .twin-open-decisions');
      if (firstSection) {
        twinContent.insertBefore(container, firstSection);
      } else {
        twinContent.appendChild(container);
      }
    }
    return container;
  },

  /**
   * Load a report for a specific month
   */
  async loadReport(month) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.currentMonth = month;
    this.renderLoading();

    try {
      const userId = await this.getUserId();
      if (!userId) {
        this.renderError('Please sign in to view your report');
        return;
      }

      const response = await fetch(`/api/state-of-you?user_id=${userId}&month=${month}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load report');
      }

      this.currentReport = data.report;

      if (data.generated && data.report) {
        this.renderReport(data.report);
      } else {
        this.renderEmptyState(data.message);
      }
    } catch (error) {
      console.error('[StateOfYouUI] Error loading report:', error);
      this.renderError('Unable to load report');
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Generate a report for the current month
   */
  async generateReport() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.renderLoading('Generating your report...');

    try {
      const userId = await this.getUserId();
      if (!userId) {
        this.renderError('Please sign in to generate a report');
        return;
      }

      const response = await fetch('/api/state-of-you', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, month: this.currentMonth })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      this.currentReport = data.report;

      if (data.generated && data.report) {
        this.renderReport(data.report);
      } else {
        this.renderEmptyState(data.message);
      }
    } catch (error) {
      console.error('[StateOfYouUI] Error generating report:', error);
      this.renderError('Unable to generate report');
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Render the loading state
   */
  renderLoading(message = 'Loading your report...') {
    const container = document.getElementById('state-of-you-container');
    if (!container) return;

    container.innerHTML = `
      <div class="state-of-you__loading">
        <div class="loading-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <p class="state-of-you__loading-message">${message}</p>
      </div>
    `;
  },

  /**
   * Render the full report
   */
  renderReport(report) {
    const container = document.getElementById('state-of-you-container');
    if (!container) return;

    const monthDisplay = this.formatMonthDisplay(report.month);
    const canGoNext = this.canNavigateNext();
    const canGoPrev = true; // Can always go to previous months

    let html = `
      <!-- Header with navigation -->
      <div class="state-of-you__header">
        <h2 class="state-of-you__month">${monthDisplay}</h2>
        <div class="state-of-you__nav">
          <button class="state-of-you__nav-btn state-of-you__nav-btn--prev" ${!canGoPrev ? 'disabled' : ''}>
            prev
          </button>
          <button class="state-of-you__nav-btn state-of-you__nav-btn--next" ${!canGoNext ? 'disabled' : ''}>
            next
          </button>
        </div>
      </div>
    `;

    // Themes section
    if (report.themes && report.themes.length > 0) {
      html += this.renderThemesSection(report.themes);
    }

    // People section
    if (report.people && report.people.length > 0) {
      html += this.renderPeopleSection(report.people);
    }

    // Sentiment trajectory
    if (report.sentiment_trajectory && Object.keys(report.sentiment_trajectory).length > 0) {
      html += this.renderSentimentSection(report.sentiment_trajectory);
    }

    // Patterns
    if (report.patterns_detected && report.patterns_detected.length > 0) {
      html += this.renderPatternsSection(report.patterns_detected);
    }

    // Reflection question
    if (report.reflection_question) {
      html += this.renderReflectionSection(report.reflection_question);
    }

    // Stats footer
    if (report.stats) {
      html += this.renderStatsSection(report.stats);
    }

    container.innerHTML = html;
  },

  /**
   * Render themes section
   */
  renderThemesSection(themes) {
    const maxMentions = Math.max(...themes.map(t => t.mentions), 1);

    const themeRows = themes.slice(0, 5).map(theme => {
      const barWidth = Math.round((theme.mentions / maxMentions) * 100);
      const trendIcon = this.getTrendIcon(theme.trend);

      return `
        <div class="theme-row">
          <span class="theme-row__name">${this.escapeHtml(theme.name)}</span>
          <div class="theme-row__bar-container">
            <div class="theme-row__bar" style="width: ${barWidth}%"></div>
          </div>
          <span class="theme-row__count">${theme.mentions}</span>
          <span class="theme-row__trend theme-row__trend--${theme.trend}">${trendIcon}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="state-of-you__section">
        <h3 class="state-of-you__section-title">Top Themes</h3>
        <div class="state-of-you__themes">
          ${themeRows}
        </div>
      </div>
    `;
  },

  /**
   * Render people section
   */
  renderPeopleSection(people) {
    const personRows = people.slice(0, 5).map(person => {
      const changeText = this.formatChange(person.change);
      const changeClass = person.change > 0 ? 'positive' : person.change < 0 ? 'negative' : '';

      return `
        <div class="person-row">
          <span class="person-row__marker"></span>
          <span class="person-row__name">${this.escapeHtml(person.name)}</span>
          <span class="person-row__mentions">${person.mentions} mentions</span>
          ${changeText ? `<span class="person-row__change person-row__change--${changeClass}">${changeText}</span>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="state-of-you__section">
        <h3 class="state-of-you__section-title">People You Engaged With</h3>
        <div class="state-of-you__people">
          ${personRows}
        </div>
      </div>
    `;
  },

  /**
   * Render sentiment trajectory section
   */
  renderSentimentSection(trajectory) {
    const categoryRows = Object.entries(trajectory).map(([category, data]) => {
      if (data.start === null && data.end === null) return '';

      const position = data.end !== null ? Math.round(data.end * 100) : 50;
      const trendLabel = this.formatSentimentTrend(data.trend);
      const trendClass = data.trend === 'improving' ? 'improving' : '';

      return `
        <div class="sentiment-row">
          <span class="sentiment-row__category">${category}</span>
          <div class="sentiment-row__track">
            <div class="sentiment-row__indicator" style="left: ${position}%"></div>
          </div>
          <span class="sentiment-row__label sentiment-row__label--${trendClass}">${trendLabel}</span>
        </div>
      `;
    }).filter(Boolean).join('');

    if (!categoryRows) return '';

    return `
      <div class="state-of-you__section">
        <h3 class="state-of-you__section-title">Sentiment Trajectory</h3>
        <div class="state-of-you__sentiment">
          ${categoryRows}
        </div>
      </div>
    `;
  },

  /**
   * Render patterns section
   */
  renderPatternsSection(patterns) {
    const patternItems = patterns.slice(0, 3).map(pattern => {
      return `<p class="pattern-item">${this.escapeHtml(pattern)}</p>`;
    }).join('');

    return `
      <div class="state-of-you__section">
        <h3 class="state-of-you__section-title">Patterns Detected</h3>
        <div class="state-of-you__patterns">
          ${patternItems}
        </div>
      </div>
    `;
  },

  /**
   * Render reflection question section
   */
  renderReflectionSection(question) {
    return `
      <div class="state-of-you__section">
        <h3 class="state-of-you__section-title">Reflection</h3>
        <div class="state-of-you__reflection">
          <p class="reflection-quote">${this.escapeHtml(question)}</p>
        </div>
      </div>
    `;
  },

  /**
   * Render stats footer
   */
  renderStatsSection(stats) {
    return `
      <div class="state-of-you__stats">
        <div class="stat-item">
          <span class="stat-item__value">${stats.notes_count || 0}</span>
          <span class="stat-item__label">notes</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">${stats.whispers_count || 0}</span>
          <span class="stat-item__label">whispers</span>
        </div>
        <div class="stat-item">
          <span class="stat-item__value">${stats.streak_days || 0}</span>
          <span class="stat-item__label">day streak</span>
        </div>
      </div>
    `;
  },

  /**
   * Render empty state
   */
  renderEmptyState(message) {
    const container = document.getElementById('state-of-you-container');
    if (!container) return;

    const monthDisplay = this.formatMonthDisplay(this.currentMonth);
    const canGoNext = this.canNavigateNext();

    container.innerHTML = `
      <div class="state-of-you__header">
        <h2 class="state-of-you__month">${monthDisplay}</h2>
        <div class="state-of-you__nav">
          <button class="state-of-you__nav-btn state-of-you__nav-btn--prev">prev</button>
          <button class="state-of-you__nav-btn state-of-you__nav-btn--next" ${!canGoNext ? 'disabled' : ''}>next</button>
        </div>
      </div>
      <div class="state-of-you__empty">
        <p class="state-of-you__empty-message">
          ${message || 'Keep writing, insights coming after 5+ notes'}
        </p>
        <p class="state-of-you__empty-hint">
          Your monthly reflection will appear here once you have enough notes.
        </p>
      </div>
    `;
  },

  /**
   * Render error state
   */
  renderError(message) {
    const container = document.getElementById('state-of-you-container');
    if (!container) return;

    container.innerHTML = `
      <div class="state-of-you__empty">
        <p class="state-of-you__empty-message">${this.escapeHtml(message)}</p>
      </div>
    `;
  },

  // ===== NAVIGATION =====

  /**
   * Navigate to the previous month
   */
  navigateToPreviousMonth() {
    const prevMonth = this.getMonthOffset(this.currentMonth, -1);
    this.loadReport(prevMonth);
  },

  /**
   * Navigate to the next month
   */
  navigateToNextMonth() {
    if (!this.canNavigateNext()) return;
    const nextMonth = this.getMonthOffset(this.currentMonth, 1);
    this.loadReport(nextMonth);
  },

  /**
   * Check if we can navigate to the next month
   */
  canNavigateNext() {
    const prevMonth = this.getPreviousMonth();
    return this.currentMonth < prevMonth;
  },

  // ===== HELPERS =====

  /**
   * Get the previous month in YYYY-MM format
   */
  getPreviousMonth() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return this.formatMonth(prevMonth);
  },

  /**
   * Get month with offset
   */
  getMonthOffset(month, offset) {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1 + offset, 1);
    return this.formatMonth(date);
  },

  /**
   * Format a date as YYYY-MM
   */
  formatMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  /**
   * Format month for display (e.g., "JANUARY 2026")
   */
  formatMonthDisplay(month) {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    return `${monthName.toUpperCase()} ${year}`;
  },

  /**
   * Get trend icon
   */
  getTrendIcon(trend) {
    switch (trend) {
      case 'up': return '\u2191';
      case 'down': return '\u2193';
      case 'new': return '\u2022';
      default: return '';
    }
  },

  /**
   * Format change number
   */
  formatChange(change) {
    if (!change || change === 0) return '';
    return change > 0 ? `+${change}` : String(change);
  },

  /**
   * Format sentiment trend
   */
  formatSentimentTrend(trend) {
    switch (trend) {
      case 'improving': return 'improving';
      case 'declining': return 'declining';
      case 'stable': return 'stable';
      default: return '';
    }
  },

  /**
   * Get user ID from Sync module
   */
  async getUserId() {
    if (typeof Sync !== 'undefined' && Sync.user?.id) {
      return Sync.user.id;
    }
    return null;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Refresh the current report
   */
  async refresh() {
    if (this.currentMonth) {
      await this.loadReport(this.currentMonth);
    }
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => StateOfYouUI.init());
} else {
  StateOfYouUI.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateOfYouUI;
}
