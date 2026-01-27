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

      <!-- PRIVACY - T3: Privacy indicator -->
      <div id="privacy-indicator" class="privacy-indicator loading">
        <span class="privacy-indicator-text">Checking privacy settings...</span>
      </div>

      <button id="export-btn" class="export-button" type="button">
        <span class="export-button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 14H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="export-button-label">Preview Export</span>
      </button>

      <!-- Export Preview Panel (hidden initially) -->
      <div id="export-preview" class="export-preview" hidden>
        <div class="export-preview-header">
          <span class="export-preview-title">EXPORT PREVIEW</span>
        </div>
        <div id="export-preview-content" class="export-preview-content">
          <div class="export-preview-loading">Loading preview...</div>
        </div>
        <div class="export-preview-actions">
          <button id="export-cancel-btn" class="export-cancel-btn" type="button">Cancel</button>
          <button id="export-confirm-btn" class="export-confirm-btn" type="button">Download</button>
        </div>
      </div>

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

    // Inject encryption disclosure section
    this.injectEncryptionDisclosure(settingsScreen, dangerZone);

    // PRIVACY - T3: Fetch privacy summary after injection
    this.fetchPrivacySummary();
  },

  /**
   * Inject encryption disclosure section
   */
  injectEncryptionDisclosure(settingsScreen, dangerZone) {
    // Check if already injected
    if (document.querySelector('.encryption-disclosure-section')) {
      return;
    }

    const disclosure = document.createElement('section');
    disclosure.className = 'settings-section encryption-disclosure-section';
    disclosure.innerHTML = `
      <h2 class="settings-heading">DATA PROTECTION</h2>

      <div class="encryption-disclosure">
        <div class="encryption-item encryption-good">
          <span class="encryption-icon">✓</span>
          <div class="encryption-text">
            <span class="encryption-title">Your notes are encrypted</span>
            <span class="encryption-desc">Notes are encrypted on your device before upload. Only you can read them — we cannot.</span>
          </div>
        </div>

        <div class="encryption-item encryption-info">
          <span class="encryption-icon">ℹ</span>
          <div class="encryption-text">
            <span class="encryption-title">AI features need temporary access</span>
            <span class="encryption-desc">To generate reflections and detect patterns, note content is processed by our AI provider (Anthropic). They don't store or train on your data.</span>
          </div>
        </div>

        <div class="encryption-item encryption-good">
          <span class="encryption-icon">✓</span>
          <div class="encryption-text">
            <span class="encryption-title">Zero-retention AI providers</span>
            <span class="encryption-desc">We only use AI APIs that don't retain or train on your data (Anthropic, OpenAI API).</span>
          </div>
        </div>
      </div>

      <details class="encryption-details">
        <summary class="encryption-details-summary">Learn more about our privacy architecture</summary>
        <div class="encryption-details-content">
          <p>Inscript is built on four privacy pillars:</p>
          <ol class="encryption-pillars">
            <li><strong>User ownership is absolute</strong> — You can export everything, anytime</li>
            <li><strong>We cannot read your data</strong> — Notes are encrypted with your PIN before upload</li>
            <li><strong>Zero-retention AI only</strong> — All AI calls use APIs that don't train on inputs</li>
            <li><strong>No content logging</strong> — We log IDs and timestamps, never content</li>
          </ol>
        </div>
      </details>
    `;

    // Insert before export section
    const exportSection = settingsScreen.querySelector('.export-section');
    if (exportSection) {
      settingsScreen.insertBefore(disclosure, exportSection);
    } else if (dangerZone) {
      settingsScreen.insertBefore(disclosure, dangerZone);
    } else {
      settingsScreen.appendChild(disclosure);
    }

    console.log('[ExportUI] Encryption disclosure section injected');
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    const btn = document.getElementById('export-btn');
    if (!btn) return;

    btn.addEventListener('click', () => this.showPreview());

    // Keyboard accessibility
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.showPreview();
      }
    });

    // Preview panel buttons (bound after injection)
    setTimeout(() => {
      const cancelBtn = document.getElementById('export-cancel-btn');
      const confirmBtn = document.getElementById('export-confirm-btn');

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.hidePreview());
      }
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => this.handleExport());
      }
    }, 0);
  },

  /**
   * Show export preview
   */
  async showPreview() {
    const btn = document.getElementById('export-btn');
    const preview = document.getElementById('export-preview');
    const previewContent = document.getElementById('export-preview-content');

    if (!btn || !preview) return;

    // Set loading state
    btn.disabled = true;
    btn.classList.add('loading');
    const label = btn.querySelector('.export-button-label');
    if (label) label.textContent = 'Loading preview...';

    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch preview data
      const response = await fetch(`${this.API_ENDPOINT}?preview=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        // Fallback to mock preview if API doesn't support preview yet
        const mockPreview = await this.getLocalPreview();
        this.renderPreview(mockPreview, previewContent);
      } else {
        const data = await response.json();
        // Cache the full export data for download
        this.cachedExportData = data;
        // extractPreviewFromExport is now async to get local notes count
        const preview = await this.extractPreviewFromExport(data);
        this.renderPreview(preview, previewContent);
      }

      // Show preview panel
      preview.removeAttribute('hidden');
      preview.style.display = 'block';

    } catch (error) {
      console.error('[ExportUI] Preview failed:', error);
      // Show local preview on error (includes local notes count)
      const localPreview = await this.getLocalPreview();
      this.renderPreview(localPreview, previewContent);
      preview.removeAttribute('hidden');
      preview.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
      if (label) label.textContent = 'Preview Export';
    }
  },

  /**
   * Hide export preview
   */
  hidePreview() {
    const preview = document.getElementById('export-preview');
    if (preview) {
      preview.setAttribute('hidden', '');
      preview.style.display = 'none';
    }
    this.cachedExportData = null;
  },

  /**
   * Render preview content
   */
  renderPreview(summary, container) {
    if (!container) return;

    const privateCount = (summary.private_entities || 0) + (summary.private_notes || 0) + (summary.private_patterns || 0);

    container.innerHTML = `
      <div class="export-preview-stats">
        <div class="export-preview-stat">
          <span class="export-preview-stat-value">${summary.entities || 0}</span>
          <span class="export-preview-stat-label">PEOPLE & PROJECTS</span>
        </div>
        <div class="export-preview-stat">
          <span class="export-preview-stat-value">${summary.facts || 0}</span>
          <span class="export-preview-stat-label">FACTS</span>
        </div>
        <div class="export-preview-stat">
          <span class="export-preview-stat-value">${summary.notes || 0}</span>
          <span class="export-preview-stat-label">NOTES</span>
        </div>
        <div class="export-preview-stat">
          <span class="export-preview-stat-value">${summary.conversations || 0}</span>
          <span class="export-preview-stat-label">CONVERSATIONS</span>
        </div>
        <div class="export-preview-stat">
          <span class="export-preview-stat-value">${summary.patterns || 0}</span>
          <span class="export-preview-stat-label">PATTERNS</span>
        </div>
      </div>
      ${privateCount > 0 ? `
        <div class="export-preview-private">
          <span class="export-preview-private-icon">⚑</span>
          <span>${privateCount} private item${privateCount !== 1 ? 's' : ''} will be excluded</span>
        </div>
      ` : ''}
      <p class="export-preview-note">
        This file will be saved as JSON. Store it securely — it contains personal information.
      </p>
    `;
  },

  /**
   * Extract preview summary from full export data
   * Includes local notes and patterns count from client-side storage
   */
  async extractPreviewFromExport(data) {
    const exp = data?.inscript_export || data;

    // Get local notes count (notes are E2E encrypted, only available client-side)
    let localNotesCount = 0;
    try {
      if (typeof DB !== 'undefined' && DB.getAllNotes) {
        const localNotes = await DB.getAllNotes();
        localNotesCount = localNotes.length;
      }
    } catch (e) {
      console.warn('[ExportUI] Could not get local notes count:', e);
    }

    // Get local patterns count (patterns stored in TwinProfile)
    let localPatternsCount = 0;
    try {
      if (typeof TwinProfile !== 'undefined' && TwinProfile.load) {
        const profile = await TwinProfile.load();
        localPatternsCount = profile?.patterns?.length || 0;
      }
    } catch (e) {
      console.warn('[ExportUI] Could not get local patterns count:', e);
    }

    return {
      entities: exp?.entities?.length || exp?.meta?.total_entities || 0,
      facts: exp?.meta?.counts?.facts || 0,
      notes: localNotesCount,  // Use local count, not server count
      conversations: exp?.episodes?.conversations?.length || 0,
      patterns: localPatternsCount,  // Use local count from TwinProfile
      private_entities: 0,
      private_notes: 0,
      private_patterns: 0
    };
  },

  /**
   * Get mock preview data
   */
  getMockPreview() {
    return {
      entities: 0,
      facts: 0,
      notes: 0,
      conversations: 0,
      patterns: 0,
      private_entities: 0,
      private_notes: 0,
      private_patterns: 0
    };
  },

  /**
   * Get preview from local data when API is unavailable
   */
  async getLocalPreview() {
    let localNotesCount = 0;
    let localPatternsCount = 0;

    try {
      if (typeof DB !== 'undefined' && DB.getAllNotes) {
        const localNotes = await DB.getAllNotes();
        localNotesCount = localNotes.length;
      }
    } catch (e) {
      console.warn('[ExportUI] Could not get local notes count:', e);
    }

    try {
      if (typeof TwinProfile !== 'undefined' && TwinProfile.load) {
        const profile = await TwinProfile.load();
        localPatternsCount = profile?.patterns?.length || 0;
      }
    } catch (e) {
      console.warn('[ExportUI] Could not get local patterns count:', e);
    }

    return {
      entities: 0,
      facts: 0,
      notes: localNotesCount,
      conversations: 0,
      patterns: localPatternsCount,
      private_entities: 0,
      private_notes: 0,
      private_patterns: 0
    };
  },

  /**
   * Handle export button click (download)
   */
  async handleExport() {
    const confirmBtn = document.getElementById('export-confirm-btn');

    // Prevent double-click
    if (confirmBtn?.disabled) return;

    // Set loading state
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Downloading...';
    }
    this.hideStatus();

    try {
      let exportData;

      // Use cached data from preview if available
      if (this.cachedExportData) {
        console.log('[ExportUI] Using cached export data from preview');
        exportData = this.cachedExportData;
      } else if (this.USE_MOCK) {
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

      // CRITICAL: Inject local data that server can't access
      // Notes are E2E encrypted - server can't decrypt them
      // Patterns are stored in local TwinProfile
      exportData = await this.injectLocalNotes(exportData);
      exportData = await this.injectLocalPatterns(exportData);

      // Download the export
      this.downloadExport(exportData);

      // Hide preview and show success
      this.hidePreview();
      this.showStatus('success', 'Export complete! Check your downloads.');

    } catch (error) {
      console.error('[ExportUI] Export failed:', error);
      this.showStatus('error', error.message || 'Export failed. Please try again.');
    } finally {
      // Reset button
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Download';
      }
    }
  },

  /**
   * Inject notes from local IndexedDB into export data
   * Notes are E2E encrypted and can only be read client-side
   * @param {Object} exportData - Export data from API
   * @returns {Object} Export data with notes injected
   */
  async injectLocalNotes(exportData) {
    try {
      // Get all notes from IndexedDB (already decrypted)
      if (typeof DB === 'undefined' || !DB.getAllNotes) {
        console.warn('[ExportUI] DB module not available, skipping note injection');
        return exportData;
      }

      const localNotes = await DB.getAllNotes();
      console.log('[ExportUI] Injecting', localNotes.length, 'notes from IndexedDB');

      // Transform notes to export format
      // Note: raw text is stored in note.input.raw_text
      const transformedNotes = localNotes.map(note => ({
        id: note.id,
        content: note.input?.raw_text || note.raw_text || note.content || '',
        timestamp: note.timestamps?.created_at || note.created_at,
        category: note.classification?.category || 'uncategorized',
        type: note.note_type || 'standard',
        extracted: {
          title: note.extracted?.title || null,
          summary: note.refined?.summary || null,
          sentiment: note.extracted?.sentiment || 0,
          action_items: note.extracted?.action_items || [],
          entities: note.entities || []
        }
      }));

      // Inject into export data
      const exp = exportData?.inscript_export || exportData;
      if (exp?.episodes) {
        exp.episodes.notes = transformedNotes;
      }

      // Update meta counts
      if (exp?.meta?.counts) {
        exp.meta.counts.notes = transformedNotes.length;
      }

      console.log('[ExportUI] Notes injected successfully');
      return exportData;

    } catch (error) {
      console.error('[ExportUI] Failed to inject local notes:', error);
      // Return original data without notes rather than failing
      return exportData;
    }
  },

  /**
   * Inject patterns from local TwinProfile into export data
   * Patterns are stored in local IndexedDB TwinProfile
   * @param {Object} exportData - Export data from API
   * @returns {Object} Export data with patterns injected
   */
  async injectLocalPatterns(exportData) {
    try {
      // Get patterns from TwinProfile
      if (typeof TwinProfile === 'undefined' || !TwinProfile.load) {
        console.warn('[ExportUI] TwinProfile not available, skipping pattern injection');
        return exportData;
      }

      const profile = await TwinProfile.load();
      const localPatterns = profile?.patterns || [];

      if (localPatterns.length === 0) {
        console.log('[ExportUI] No local patterns to inject');
        return exportData;
      }

      console.log('[ExportUI] Injecting', localPatterns.length, 'patterns from TwinProfile');

      // Transform patterns to export format
      const transformedPatterns = localPatterns.map(pattern => ({
        type: pattern.type || pattern.pattern_type || 'behavioral',
        description: pattern.description || pattern.text || '',
        confidence: pattern.confidence || 0.5,
        structured: null,
        evidence: {
          supporting_notes: 0,
          first_detected: pattern.detectedAt || profile.patternsDetectedAt || null,
          last_confirmed: profile.patternsDetectedAt || null
        }
      }));

      // Inject into export data
      const exp = exportData?.inscript_export || exportData;
      if (exp) {
        exp.patterns = transformedPatterns;
      }

      // Update meta counts
      if (exp?.meta?.counts) {
        exp.meta.counts.patterns = transformedPatterns.length;
      }

      console.log('[ExportUI] Patterns injected successfully');
      return exportData;

    } catch (error) {
      console.error('[ExportUI] Failed to inject local patterns:', error);
      return exportData;
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
  },

  // ============================================
  // PRIVACY - T3: Privacy indicator methods
  // ============================================

  /**
   * Fetch and display privacy summary
   */
  async fetchPrivacySummary() {
    const token = await this.getAuthToken();
    if (!token) {
      this.updatePrivacyIndicator({ private_entities: 0, private_notes: 0, private_patterns: 0 });
      return;
    }

    try {
      const response = await fetch('/api/privacy-summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        // API might not exist yet (T1 dependency)
        console.warn('[ExportUI] Privacy summary API not available');
        this.updatePrivacyIndicator({ private_entities: 0, private_notes: 0, private_patterns: 0 });
        return;
      }

      const summary = await response.json();
      this.updatePrivacyIndicator(summary);
    } catch (err) {
      console.warn('[ExportUI] Could not fetch privacy summary:', err);
      this.updatePrivacyIndicator({ private_entities: 0, private_notes: 0, private_patterns: 0 });
    }
  },

  /**
   * Update the privacy indicator display
   */
  updatePrivacyIndicator(summary) {
    const indicator = document.getElementById('privacy-indicator');
    if (!indicator) return;

    const total = (summary.private_entities || 0) + (summary.private_notes || 0) + (summary.private_patterns || 0);

    if (total === 0) {
      indicator.innerHTML = `
        <span class="privacy-indicator-icon">✓</span>
        <span class="privacy-indicator-text">All items will be included in export</span>
      `;
      indicator.className = 'privacy-indicator all-included';
    } else {
      indicator.innerHTML = `
        <span class="privacy-indicator-icon">⚑</span>
        <span class="privacy-indicator-text">${total} private item${total > 1 ? 's' : ''} will be excluded</span>
        <a href="#" class="privacy-indicator-link" onclick="ExportUI.showPrivacyDetails(); return false;">Manage</a>
      `;
      indicator.className = 'privacy-indicator has-private';
    }
  },

  /**
   * Show privacy management section
   */
  showPrivacyDetails() {
    const privacySection = document.getElementById('privacy-management-section');
    if (privacySection) {
      privacySection.scrollIntoView({ behavior: 'smooth' });
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
