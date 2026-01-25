/**
 * YOU Tab UI Controller
 * Phase 15.1: 3-Tab Restructure
 *
 * Manages the YOU tab with 4 sub-tabs:
 * - STREAM: Actions + Whispers (prioritized activity)
 * - MEETINGS: Meeting summaries
 * - PATTERNS: Detected behavioral patterns + State of You
 * - STATS: Note count, entities learned
 */

const YouUI = {
  activeTab: 'stream',
  initialized: false,

  /**
   * Initialize YOU tab
   */
  init() {
    if (this.initialized) return;
    console.log('[YouUI] Initializing...');

    this.attachTabListeners();
    this.initialized = true;
  },

  /**
   * Attach sub-tab click listeners
   */
  attachTabListeners() {
    const tabs = document.querySelectorAll('.you-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.youTab;
        this.switchTab(tabName);
      });
    });
  },

  /**
   * Switch between sub-tabs
   */
  switchTab(tabName) {
    console.log('[YouUI] Switching to tab:', tabName);
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.you-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.youTab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('.you-content').forEach(content => {
      content.classList.add('hidden');
    });

    const activeContent = document.getElementById(`you-${tabName}`);
    if (activeContent) {
      activeContent.classList.remove('hidden');
    }

    // Load content for the active tab
    this.loadTabContent(tabName);
  },

  /**
   * Load content for a specific tab
   */
  async loadTabContent(tabName) {
    switch (tabName) {
      case 'stream':
        await this.loadStream();
        break;
      case 'meetings':
        await this.loadMeetings();
        break;
      case 'patterns':
        await this.loadPatterns();
        break;
      case 'stats':
        await this.loadStats();
        break;
    }
  },

  /**
   * Load STREAM content (Actions + Whispers)
   */
  async loadStream() {
    console.log('[YouUI] Loading stream...');

    // Load actions (prioritized)
    if (typeof ActionsUI !== 'undefined' && ActionsUI.refresh) {
      await ActionsUI.refresh();
    }

    // Load whisper history
    const whisperContainer = document.getElementById('you-whisper-list');
    if (whisperContainer && typeof WhisperUI !== 'undefined') {
      await WhisperUI.loadHistory(whisperContainer);
    }
  },

  /**
   * Load MEETINGS content
   */
  async loadMeetings() {
    console.log('[YouUI] Loading meetings...');

    if (typeof WorkUI !== 'undefined' && WorkUI.loadMeetings) {
      await WorkUI.loadMeetings();
    }
  },

  /**
   * Load PATTERNS content (includes State of You report)
   */
  async loadPatterns() {
    console.log('[YouUI] Loading patterns...');

    const container = document.getElementById('you-patterns-container');
    if (!container) return;

    try {
      // Check if PatternVerification instance is available
      if (typeof window.PatternVerification === 'undefined') {
        console.warn('[YouUI] PatternVerification not available');
        container.innerHTML = '<p class="you-empty">Pattern detection not available.</p>';
        return;
      }

      // Ensure Sync.user is available before loading patterns
      if (!Sync?.user?.id) {
        container.innerHTML = '<p class="you-empty">Sign in to see your patterns.</p>';
        return;
      }

      // Show loading state
      container.innerHTML = '<p class="you-empty">Finding your patterns...</p>';

      // Load patterns using the instance
      await window.PatternVerification.loadPatterns();

      // Render the section
      const patternsHtml = window.PatternVerification.renderTwinSection();
      if (patternsHtml && patternsHtml.trim()) {
        container.innerHTML = patternsHtml;
      } else {
        container.innerHTML = '<p class="you-empty">No patterns detected yet. Keep writing to reveal your rhythms.</p>';
      }

    } catch (error) {
      console.error('[YouUI] Error loading patterns:', error);
      container.innerHTML = '<p class="you-empty">Unable to load patterns.</p>';
    }

    // Also load State of You report (moved from separate REPORT tab)
    const reportContainer = document.getElementById('you-report-container');
    if (reportContainer && typeof StateOfYouUI !== 'undefined') {
      await StateOfYouUI.load(reportContainer);
    }
  },

  /**
   * Load STATS content
   */
  async loadStats() {
    console.log('[YouUI] Loading stats...');

    try {
      // Load TwinUI stats (this populates the stat numbers)
      if (typeof TwinUI !== 'undefined') {
        await TwinUI.loadStatsImmediately();
      }

      // Render About You section (onboarding data + edit)
      if (typeof UIProfile !== 'undefined') {
        const aboutSection = document.getElementById('about-me-section');
        if (aboutSection) {
          aboutSection.innerHTML = UIProfile.renderAboutYouSection();
        }
      }

      // Render Preferences section
      if (typeof UIProfile !== 'undefined') {
        const prefsSection = document.getElementById('preferences-section');
        if (prefsSection && UIProfile.renderPreferencesSection) {
          prefsSection.innerHTML = UIProfile.renderPreferencesSection();
        }
      }

      // Render Your World section (entities/people noted by app)
      if (typeof Entities !== 'undefined') {
        const worldSection = document.getElementById('your-world-section');
        if (worldSection) {
          worldSection.innerHTML = Entities.renderYourWorldSection();
        }
      }

      // Render Learning section
      if (typeof TwinUI !== 'undefined' && TwinUI.renderLearningSection) {
        const learningSection = document.getElementById('learning-section');
        if (learningSection) {
          learningSection.innerHTML = TwinUI.renderLearningSection();
        }
      }
    } catch (error) {
      console.error('[YouUI] Error loading stats:', error);
    }
  },

  /**
   * Called when YOU tab becomes visible
   */
  onTabVisible() {
    console.log('[YouUI] Tab became visible');
    this.loadTabContent(this.activeTab);
  }
};

// Make globally available
window.YouUI = YouUI;
