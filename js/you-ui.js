/**
 * YOU Tab UI Controller
 * Phase 15.1: 3-Tab Restructure
 *
 * Manages the YOU tab with 4 sub-tabs:
 * - STREAM: Whispers + Pulse + Actions (activity feed)
 * - PATTERNS: Detected behavioral patterns
 * - REPORT: State of You monthly report
 * - STATS: Note count, streak, entities learned
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
      case 'patterns':
        await this.loadPatterns();
        break;
      case 'report':
        await this.loadReport();
        break;
      case 'stats':
        await this.loadStats();
        break;
    }
  },

  /**
   * Load STREAM content (Whispers + Pulse + Actions)
   */
  async loadStream() {
    console.log('[YouUI] Loading stream...');

    // Load whisper history
    const whisperContainer = document.getElementById('you-whisper-list');
    if (whisperContainer && typeof WhisperUI !== 'undefined') {
      await WhisperUI.loadHistory(whisperContainer);
    }

    // Load pulse (reuse WorkUI pulse logic)
    if (typeof WorkUI !== 'undefined' && WorkUI.loadPulse) {
      await WorkUI.loadPulse();
    }

    // Load actions
    if (typeof ActionsUI !== 'undefined' && ActionsUI.loadActions) {
      await ActionsUI.loadActions();
    }
  },

  /**
   * Load PATTERNS content
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
  },

  /**
   * Load REPORT content (State of You)
   */
  async loadReport() {
    console.log('[YouUI] Loading report...');

    const container = document.getElementById('you-report-container');
    if (container && typeof StateOfYouUI !== 'undefined') {
      await StateOfYouUI.load(container);
    }
  },

  /**
   * Load STATS content
   */
  async loadStats() {
    console.log('[YouUI] Loading stats...');

    try {
      // Load TwinUI stats
      if (typeof TwinUI !== 'undefined') {
        await TwinUI.loadStatsImmediately();
      }

      // Render About You section
      if (typeof UIProfile !== 'undefined') {
        const aboutSection = document.getElementById('you-about-section');
        if (aboutSection) {
          UIProfile.renderAboutYouSection(aboutSection);
        }
      }

      // Render Your World section (entities)
      if (typeof Entities !== 'undefined') {
        const worldSection = document.getElementById('you-world-section');
        if (worldSection) {
          await Entities.renderYourWorldSection(worldSection);
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
