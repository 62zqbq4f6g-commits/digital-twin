/**
 * Inscript - Weekly Digest Generator
 * Generates AI-powered summaries of the week's notes
 */

const Digest = {
  currentDigest: null,
  currentDateRange: '',

  /**
   * Generate weekly digest
   */
  async generate() {
    UI.showProcessing('Generating digest...');

    try {
      // Get this week's notes
      const weekStart = this.getWeekStart();
      const weekEnd = this.getWeekEnd();
      const notes = await DB.getNotesByDateRange(weekStart, weekEnd);

      if (notes.length === 0) {
        UI.hideProcessing();
        UI.showToast('No notes this week');
        return null;
      }

      // Prepare notes summary for API
      const notesSummary = notes.map(n => ({
        date: n.timestamps?.input_date,
        category: n.classification?.category,
        title: n.extracted?.title,
        summary: n.refined?.summary,
        action_items: n.extracted?.action_items,
        sentiment: n.extracted?.sentiment
      }));

      // Call digest API
      const response = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notesSummary,
          weekStart: weekStart,
          weekEnd: weekEnd
        })
      });

      if (!response.ok) {
        throw new Error('Digest API failed');
      }

      const digest = await response.json();

      UI.hideProcessing();
      this.showDigest(digest, weekStart, weekEnd, notes.length);

      return digest;

    } catch (error) {
      console.error('Digest generation error:', error);
      UI.hideProcessing();
      UI.showToast('Failed to generate digest');
      return null;
    }
  },

  /**
   * Get Monday of current week (YYYY-MM-DD)
   * @returns {string} Date string
   */
  getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  },

  /**
   * Get Sunday of current week (YYYY-MM-DD)
   * @returns {string} Date string
   */
  getWeekEnd() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? 0 : 7);
    const sunday = new Date(now);
    sunday.setDate(diff);
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString().split('T')[0];
  },

  /**
   * Display digest in modal
   * @param {Object} digest - Digest data from API
   * @param {string} weekStart - Week start date
   * @param {string} weekEnd - Week end date
   * @param {number} noteCount - Total notes count
   */
  showDigest(digest, weekStart, weekEnd, noteCount) {
    const modal = document.getElementById('digest-modal');
    const content = document.getElementById('digest-content');

    if (!modal || !content) return;

    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);
    const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    content.innerHTML = `
      <div class="digest-header">
        <h2 class="digest-title">Weekly Digest</h2>
        <span class="digest-date">${dateRange}</span>
      </div>

      <div class="digest-section">
        <h3 class="digest-section-title">Overview</h3>
        <p class="digest-text">${digest.overview || `You captured ${noteCount} notes this week.`}</p>
      </div>

      ${(digest.categories || []).map(cat => `
        <div class="digest-section">
          <h3 class="digest-section-title">${this.getCategoryIcon(cat.name)} ${(cat.name || '').toUpperCase()} (${cat.count || 0} notes)</h3>
          ${cat.themes ? `<p class="digest-themes">Key themes: ${cat.themes}</p>` : ''}
          ${cat.highlights && cat.highlights.length > 0 ? `
            <div class="digest-highlights">
              <p class="digest-label">Highlights:</p>
              <ul class="digest-list">
                ${cat.highlights.map(h => `<li>${h}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${cat.mood ? `<p class="digest-mood">Mood trend: ${cat.mood}</p>` : ''}
        </div>
      `).join('')}

      ${digest.action_items && digest.action_items.length > 0 ? `
        <div class="digest-section">
          <h3 class="digest-section-title">Open Action Items (${digest.action_items.length})</h3>
          <ul class="digest-actions">
            ${digest.action_items.map(a => `<li>☐ ${a}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${digest.insights ? `
        <div class="digest-section">
          <h3 class="digest-section-title">Insights</h3>
          <p class="digest-text">${digest.insights}</p>
        </div>
      ` : ''}

      <button class="btn-primary btn-full" onclick="Digest.copyDigest()">
        Copy Digest
      </button>
    `;

    // Store for copying
    this.currentDigest = digest;
    this.currentDateRange = dateRange;

    modal.classList.remove('hidden');
  },

  /**
   * Get category icon
   * @param {string} category - Category name
   * @returns {string} Emoji icon
   */
  getCategoryIcon(category) {
    // Text-only per brand guidelines - return empty string
    return '';
  },

  /**
   * Close digest modal
   */
  closeDigest() {
    const modal = document.getElementById('digest-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  /**
   * Copy digest to clipboard
   */
  async copyDigest() {
    if (!this.currentDigest) return;

    const text = this.formatDigestForCopy();

    try {
      await navigator.clipboard.writeText(text);
      UI.showToast('Digest copied!');
    } catch (error) {
      console.error('Copy failed:', error);
      UI.showToast('Failed to copy');
    }
  },

  /**
   * Format digest as markdown for copying
   * @returns {string} Markdown formatted digest
   */
  formatDigestForCopy() {
    const d = this.currentDigest;

    let text = `# Weekly Digest\n\n`;
    text += `**${this.currentDateRange}**\n\n`;
    text += `---\n\n`;
    text += `## Overview\n\n${d.overview || ''}\n\n`;

    (d.categories || []).forEach(cat => {
      text += `---\n\n`;
      text += `## ${this.getCategoryIcon(cat.name)} ${(cat.name || '').charAt(0).toUpperCase() + (cat.name || '').slice(1)} (${cat.count || 0} notes)\n\n`;
      if (cat.themes) text += `**Key themes:** ${cat.themes}\n\n`;
      if (cat.highlights && cat.highlights.length > 0) {
        text += `**Highlights:**\n`;
        cat.highlights.forEach(h => text += `• ${h}\n`);
        text += `\n`;
      }
      if (cat.mood) text += `**Mood trend:** ${cat.mood}\n\n`;
    });

    if (d.action_items && d.action_items.length > 0) {
      text += `---\n\n`;
      text += `## Open Action Items\n\n`;
      d.action_items.forEach(a => text += `☐ ${a}\n`);
      text += `\n`;
    }

    if (d.insights) {
      text += `---\n\n`;
      text += `## Insights\n\n${d.insights}\n\n`;
    }

    text += `---\n\n*Generated by Inscript*`;

    return text;
  }
};

// Export for global access
window.Digest = Digest;
