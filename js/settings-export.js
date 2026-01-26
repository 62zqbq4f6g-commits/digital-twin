/**
 * INSCRIPT: Portable Memory Export UI
 *
 * T3 Frontend Lead - Export Build
 *
 * Features:
 * - Export button in Settings page
 * - Loading states with progress
 * - Mock mode until T1 API is ready
 * - PAMP-compliant export structure
 *
 * Design System:
 * - Black buttons (#000)
 * - 1px borders
 * - Inter font
 * - 200ms transitions
 */

const ExportUI = {
  // Configuration
  USE_MOCK: false, // T1 API is ready
  API_ENDPOINT: '/api/export',

  /**
   * Initialize Export UI
   * Called when Settings page loads
   */
  init() {
    console.log('[ExportUI] Initializing...');
    this.injectExportSection();
    this.bindEvents();
    console.log('[ExportUI] Initialized');
  },

  /**
   * Inject export section into Settings page
   */
  injectExportSection() {
    // Find the settings screen container
    const settingsScreen = document.querySelector('#screen-settings');
    if (!settingsScreen) {
      console.warn('[ExportUI] Settings screen not found');
      return;
    }

    // Check if already injected
    if (document.querySelector('.export-section')) {
      console.log('[ExportUI] Export section already exists');
      return;
    }

    // Find the DATA section to insert after (before DANGER ZONE)
    const dangerZone = settingsScreen.querySelector('.settings-danger-zone');

    // Create export section
    const section = document.createElement('section');
    section.id = 'export-section';
    section.className = 'settings-section export-section';
    section.innerHTML = `
      <h2 class="settings-heading export-title">PORTABLE MEMORY</h2>

      <p class="export-description">
        Export everything Inscript knows about you — your identity,
        the people in your life, your notes, and patterns we've detected.
        Take it to ChatGPT, Claude, or any AI.
      </p>

      <button id="export-btn" class="export-button" type="button">
        <span class="export-button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 14H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="export-button-label">Export My Memory</span>
      </button>

      <div id="export-status" class="export-status" hidden>
        <span class="export-status-icon"></span>
        <span class="export-status-text"></span>
      </div>

      <p class="export-note">
        Items marked as private are excluded. The exported file contains personal information — store it securely.
      </p>

      <details class="export-details">
        <summary class="export-details-summary">What's included?</summary>
        <div class="export-details-content">
        <ul class="export-list">
          <li><strong>Identity</strong> — Your name, goals, communication preferences</li>
          <li><strong>People & Projects</strong> — Everyone and everything you've mentioned</li>
          <li><strong>Notes</strong> — All your entries (except private ones)</li>
          <li><strong>Patterns</strong> — Habits and preferences we've detected</li>
        </ul>
        </div>
      </details>
    `;

    // Insert before DANGER ZONE section
    if (dangerZone) {
      settingsScreen.insertBefore(section, dangerZone);
    } else {
      // Fallback: append to settings screen
      settingsScreen.appendChild(section);
    }

    console.log('[ExportUI] Export section injected');
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    const btn = document.getElementById('export-btn');
    if (!btn) return;

    btn.addEventListener('click', () => this.handleExport());

    // Keyboard accessibility
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleExport();
      }
    });
  },

  /**
   * Handle export button click
   */
  async handleExport() {
    const btn = document.getElementById('export-btn');
    const label = btn?.querySelector('.export-button-label');

    // Prevent double-click
    if (!btn || btn.disabled) return;

    // Set loading state
    btn.disabled = true;
    btn.classList.add('loading');
    if (label) label.textContent = 'Preparing export...';
    this.hideStatus();

    try {
      let exportData;

      if (this.USE_MOCK) {
        // Use mock data until T1 API is ready
        console.log('[ExportUI] Using mock export data');
        exportData = await this.generateMockExport();
      } else {
        // Call real API
        console.log('[ExportUI] Calling export API');
        const token = await this.getAuthToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(this.API_ENDPOINT, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Export failed: ${response.status}`);
        }

        exportData = await response.json();
      }

      // Download the export
      this.downloadExport(exportData);

      // Show success
      this.showStatus('success', 'Export complete! Check your downloads.');

    } catch (error) {
      console.error('[ExportUI] Export failed:', error);
      this.showStatus('error', error.message || 'Export failed. Please try again.');
    } finally {
      // Reset button
      btn.disabled = false;
      btn.classList.remove('loading');
      if (label) label.textContent = 'Export My Memory';
    }
  },

  /**
   * Get current user's auth token
   */
  async getAuthToken() {
    // Option 1: From Supabase client
    if (typeof Sync !== 'undefined' && Sync.supabase) {
      const { data: { session } } = await Sync.supabase.auth.getSession();
      return session?.access_token;
    }

    // Option 2: From window.supabase
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session?.access_token;
    }

    console.warn('[ExportUI] Could not find auth token');
    return null;
  },

  /**
   * Generate mock export data (until T1 API ready)
   * Structure follows PAMP specification
   */
  async generateMockExport() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const userId = typeof Sync !== 'undefined' && Sync.user?.id
      ? Sync.user.id
      : 'mock-user-001';

    const userName = typeof Sync !== 'undefined' && Sync.user?.email
      ? Sync.user.email.split('@')[0]
      : 'User';

    return {
      inscript_export: {
        version: '1.0.0',
        exported_at: new Date().toISOString(),

        // Layer 1: Identity
        identity: {
          name: userName,
          email: Sync?.user?.email || null,
          profile: {
            role_type: 'Professional',
            goals: ['Build great products', 'Stay organized'],
            communication_style: 'Direct and thoughtful',
            tone_preference: 'Warm but professional'
          },
          key_people: [
            { name: 'Example Person', relationship: 'colleague', context: 'Works on projects together' }
          ],
          custom_instructions: 'Prefers concise responses with actionable insights.'
        },

        // Layer 2: Entities
        entities: {
          people: [
            {
              id: 'entity-001',
              name: 'Example Colleague',
              type: 'person',
              importance: 0.8,
              sentiment: 0.7,
              facts: ['Works in product team', 'Met in Q1 2024'],
              last_mentioned: new Date().toISOString()
            }
          ],
          places: [
            {
              id: 'entity-002',
              name: 'Office',
              type: 'place',
              importance: 0.6,
              facts: ['Primary workspace'],
              last_mentioned: new Date().toISOString()
            }
          ],
          projects: [
            {
              id: 'entity-003',
              name: 'Q1 Roadmap',
              type: 'project',
              importance: 0.9,
              status: 'active',
              facts: ['Key deliverable for the quarter'],
              last_mentioned: new Date().toISOString()
            }
          ],
          concepts: []
        },

        // Layer 3: Episodes (sample - real export would have full notes)
        episodes: {
          notes_count: 0,
          meetings_count: 0,
          conversations_count: 0,
          sample_notes: [
            {
              id: 'note-sample',
              date: new Date().toISOString(),
              category: 'work',
              summary: 'This is a sample note summary for the export preview.',
              entities_mentioned: ['Example Colleague', 'Q1 Roadmap']
            }
          ],
          note: 'Full notes are included in the complete export. This mock shows structure only.'
        },

        // Layer 4: Patterns
        patterns: [
          {
            type: 'behavioral',
            description: 'Most productive in morning hours',
            confidence: 0.75,
            evidence_count: 5,
            first_detected: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            type: 'relational',
            description: 'Frequently collaborates with product team',
            confidence: 0.82,
            evidence_count: 8,
            first_detected: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],

        // Layer 5: Meta
        meta: {
          account_created: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          total_notes: 0,
          total_entities: 3,
          total_patterns: 2,
          privacy_level: 'internal',
          export_note: 'This is a mock export. Connect the real API for full data.'
        }
      },

      // Instructions for AI consumption
      ai_instructions: {
        purpose: 'This file contains a portable memory export from Inscript.',
        usage: 'Upload this file to any AI assistant to give it context about the user.',
        privacy: 'This file may contain personal information. Handle with care.',
        format: 'PAMP v1.0 (Portable AI Memory Protocol)'
      }
    };
  },

  /**
   * Download export as JSON file
   */
  downloadExport(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    const filename = `inscript-memory-${date}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[ExportUI] Downloaded: ${filename}`);
  },

  /**
   * Show status message
   */
  showStatus(type, message) {
    const status = document.getElementById('export-status');
    if (!status) {
      console.warn('[ExportUI] Status element not found');
      return;
    }

    const icon = status.querySelector('.export-status-icon');
    const text = status.querySelector('.export-status-text');

    // P3 FIX: Use removeAttribute for explicit hidden removal
    status.removeAttribute('hidden');
    status.style.display = 'flex';
    status.className = `export-status ${type}`;
    if (text) text.textContent = message;

    // Icon based on type
    if (icon) {
      if (type === 'success') {
        icon.innerHTML = '✓';
      } else if (type === 'error') {
        icon.innerHTML = '✕';
      } else {
        icon.innerHTML = '';
      }
    }

    // Auto-hide success after 5 seconds
    if (type === 'success') {
      setTimeout(() => this.hideStatus(), 5000);
    }
  },

  /**
   * Hide status message
   */
  hideStatus() {
    const status = document.getElementById('export-status');
    if (status) {
      status.setAttribute('hidden', '');
      status.style.display = 'none';
    }
  }
};

// Export for module usage
if (typeof window !== 'undefined') {
  window.ExportUI = ExportUI;
}

// Auto-initialize if Settings page is already loaded
if (document.readyState === 'complete') {
  // Check if we're on the settings page (and it's visible)
  const settingsScreen = document.querySelector('#screen-settings');
  if (settingsScreen && !settingsScreen.classList.contains('hidden')) {
    ExportUI.init();
  }
}
