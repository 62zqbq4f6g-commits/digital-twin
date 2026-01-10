/**
 * Digital Twin - UI Controller
 * Handles navigation and screen management
 */

const UI = {
  // Current active screen
  currentScreen: 'capture',

  /**
   * Initialize UI - set up event listeners
   */
  init() {
    this.setupNavigation();
    this.showScreen('capture');
  },

  /**
   * Set up navigation tab click handlers
   */
  setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');

    navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const screenName = tab.dataset.screen;
        if (screenName) {
          this.showScreen(screenName);
        }
      });
    });
  },

  /**
   * Show a specific screen, hide all others
   * @param {string} screenName - Name of screen to show (capture, notes, settings)
   */
  showScreen(screenName) {
    // Get all screens
    const screens = document.querySelectorAll('.screen');
    const navTabs = document.querySelectorAll('.nav-tab');

    // Hide all screens
    screens.forEach(screen => {
      screen.classList.add('hidden');
    });

    // Remove active class from all tabs
    navTabs.forEach(tab => {
      tab.classList.remove('active');
    });

    // Show the selected screen
    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) {
      targetScreen.classList.remove('hidden');
    }

    // Activate the corresponding nav tab
    const targetTab = document.querySelector(`.nav-tab[data-screen="${screenName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
    }

    // Update current screen
    this.currentScreen = screenName;
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms (default 1500)
   */
  showToast(message, duration = 1500) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger show animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Hide and remove after duration
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        toast.remove();
      }, 150);
    }, duration);
  }
};

// Export for global access
window.UI = UI;
