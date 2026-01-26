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
  USE_MOCK: true, // Toggle to false when T1 API is ready
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
    // Find the Privacy & Security section to insert after
    const settingsContent = document.querySelector('.settings-content');
    if (!settingsContent) {
      console.warn('[ExportUI] Settings content container not found');
      return;
    }

    // Check if already injected
    if (document.querySelector('.export-section')) {
      console.log('[ExportUI] Export section already exists');
      return;
    }

    // Find the privacy section to insert after
    const privacySection = settingsContent.querySelector('.settings-privacy');

    // Create export section
    const section = document.createElement('section');
    section.className = 'settings-section export-section';
    section.innerHTML = `
      <h3 class="settings-section-title">Your Data</h3>

      <div class="export-description">
        <p class="export-tagline">Take your memory anywhere.</p>
        <p class="export-subtext">
          Export everything Inscript knows about you in a portable format.
          Use it with ChatGPT, Claude, or any AI assistant.
        </p>
      </div>

      <button id="export-memory-btn" class="export-button">
        <span class="export-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </span>
        <span class="export-label">Export My Memory</span>
        <span class="export-spinner hidden">
          <svg class="spinner-svg" width="20" height="20" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
        </span>
      </button>

      <div class="export-meta">
        <div class="export-info" id="export-info">
          <span class="export-info-icon">i</span>
          <span class="export-info-text">Private items are excluded. Your file contains personal information.</span>
        </div>
      </div>

      <details class="export-details">
        <summary class="export-details-summary">What's included?</summary>
        <div class="export-details-content">
          <ul class="export-list">
            <li><strong>Identity:</strong> Your profile, preferences, and key people</li>
            <li><strong>Entities:</strong> People, places, projects, and concepts you've mentioned</li>
            <li><strong>Episodes:</strong> Notes, meetings, and conversations</li>
            <li><strong>Patterns:</strong> Behavioral and emotional patterns detected</li>
            <li><strong>Relationships:</strong> How entities connect to each other</li>
          </ul>
        </div>
      </details>
    `;

    // Insert after privacy section, or at the end
    if (privacySection && privacySection.nextSibling) {
      settingsContent.insertBefore(section, privacySection.nextSibling);
    } else {
      // Find the Data section and insert before it
      const dataSection = Array.from(settingsContent.querySelectorAll('.settings-section'))
        .find(s => s.querySelector('.settings-section-title')?.textContent === 'Data');

      if (dataSection) {
        settingsContent.insertBefore(section, dataSection);
      } else {
        settingsContent.appendChild(section);
      }
    }

    console.log('[ExportUI] Export section injected');
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    const btn = document.getElementById('export-memory-btn');
    if (btn) {
      btn.addEventListener('click', () => this.handleExport());
    }
  },

  /**
   * Handle export button click
   */
  async handleExport() {
    const btn = document.getElementById('export-memory-btn');
    if (!btn || btn.disabled) return;

    const label = btn.querySelector('.export-label');
    const icon = btn.querySelector('.export-icon');
    const spinner = btn.querySelector('.export-spinner');
    const info = document.getElementById('export-info');

    // Set loading state
    btn.disabled = true;
    btn.classList.add('loading');
    label.textContent = 'Preparing export...';
    icon.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
      let exportData;

      if (this.USE_MOCK) {
        // Use mock data until T1 API is ready
        console.log('[ExportUI] Using mock export data');
        exportData = await this.generateMockExport();
      } else {
        // Call real API
        console.log('[ExportUI] Calling export API');
        const response = await fetch(this.API_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Export failed: ${response.status}`);
        }

        exportData = await response.json();
      }

      // Download the export
      this.downloadExport(exportData);

      // Show success state
      this.showSuccess(btn, label, icon, spinner, info);

    } catch (error) {
      console.error('[ExportUI] Export failed:', error);
      this.showError(btn, label, icon, spinner, info, error.message);
    }
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
   * Show success state
   */
  showSuccess(btn, label, icon, spinner, info) {
    btn.classList.remove('loading');
    btn.classList.add('success');
    label.textContent = 'Export complete!';
    spinner.classList.add('hidden');
    icon.classList.remove('hidden');
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;

    // Show toast if available
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('Memory exported successfully');
    }

    // Reset after 3 seconds
    setTimeout(() => this.resetButton(btn, label, icon, spinner), 3000);
  },

  /**
   * Show error state
   */
  showError(btn, label, icon, spinner, info, message) {
    btn.classList.remove('loading');
    btn.classList.add('error');
    label.textContent = 'Export failed';
    spinner.classList.add('hidden');
    icon.classList.remove('hidden');
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;

    // Show error toast
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(message || 'Export failed. Please try again.');
    }

    // Reset after 3 seconds
    setTimeout(() => this.resetButton(btn, label, icon, spinner), 3000);
  },

  /**
   * Reset button to default state
   */
  resetButton(btn, label, icon, spinner) {
    btn.disabled = false;
    btn.classList.remove('loading', 'success', 'error');
    label.textContent = 'Export My Memory';
    spinner.classList.add('hidden');
    icon.classList.remove('hidden');
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
  }
};

// Export for module usage
if (typeof window !== 'undefined') {
  window.ExportUI = ExportUI;
}

// Auto-initialize if Settings page is already loaded
if (document.readyState === 'complete') {
  // Check if we're on the settings page
  if (document.querySelector('.settings-content')) {
    ExportUI.init();
  }
}
