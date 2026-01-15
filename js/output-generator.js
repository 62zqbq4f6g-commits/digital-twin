/**
 * Output Generator - Formats analysis into Summary + Insight + Question format
 * Creates the "aha moment" output for Phase 3a
 */

const OutputGenerator = {
  /**
   * Generate formatted output from analysis
   * @param {Object} analysis - Analysis result from Analyzer
   * @param {Object} timestamps - Note timestamps
   * @returns {Object} Formatted output with summary, insight, question
   */
  generate(analysis, timestamps = {}) {
    return {
      summary: this.formatSummary(analysis.summary),
      insight: this.formatInsight(analysis.insight, analysis.patterns),
      question: this.formatQuestion(analysis.question),
      type: analysis.type,
      category: analysis.category,
      metadata: {
        timestamp: this.formatTimestamp(timestamps),
        confidence: analysis.confidence,
        type_label: this.getTypeLabel(analysis.type),
        category_icon: this.getCategoryIcon(analysis.category)
      }
    };
  },

  /**
   * Format summary - clean, structured, 2-3 sentences max
   */
  formatSummary(summary) {
    if (!summary || summary.trim().length === 0) {
      return 'Note captured.';
    }

    // Ensure proper capitalization
    let formatted = summary.trim();
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    // Ensure ends with period
    if (!formatted.match(/[.!?]$/)) {
      formatted += '.';
    }

    // Limit to ~150 chars (2-3 sentences)
    if (formatted.length > 200) {
      const sentences = formatted.split(/[.!?]+/).filter(s => s.trim().length > 0);
      formatted = sentences.slice(0, 2).join('. ').trim() + '.';
    }

    return formatted;
  },

  /**
   * Format insight - pattern-based, non-obvious
   */
  formatInsight(insight, patterns = {}) {
    if (!insight || insight.trim().length === 0) {
      return null;
    }

    let formatted = insight.trim();

    // If patterns were reinforced, reference them
    if (patterns.reinforced && patterns.reinforced.length > 0) {
      const pattern = patterns.reinforced[0];
      if (typeof pattern === 'string') {
        formatted = `Your pattern: ${this.humanizePattern(pattern)}. ${formatted}`;
      } else if (pattern.description) {
        formatted = `Your pattern: ${pattern.description}. ${formatted}`;
      }
    }

    // Ensure proper formatting
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    if (!formatted.match(/[.!?]$/)) {
      formatted += '.';
    }

    return formatted;
  },

  /**
   * Format question - concrete, actionable
   */
  formatQuestion(question) {
    if (!question || question.trim().length === 0) {
      return null;
    }

    let formatted = question.trim();

    // Ensure ends with question mark
    if (!formatted.endsWith('?')) {
      formatted += '?';
    }

    // Ensure proper capitalization
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return formatted;
  },

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamps) {
    if (!timestamps || !timestamps.captured_at && !timestamps.created_at) {
      const now = new Date();
      return this.formatDate(now);
    }

    const dateStr = timestamps.captured_at || timestamps.created_at;
    const date = new Date(dateStr);
    return this.formatDate(date);
  },

  /**
   * Format date object to display string
   */
  formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    // 12-hour format
    const hour12 = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';

    return `${month} ${day}, ${hour12}:${minutes} ${ampm}`;
  },

  /**
   * Get human-readable type label
   */
  getTypeLabel(type) {
    const labels = {
      decision: 'Decision',
      idea: 'Idea',
      reflection: 'Reflection',
      commitment: 'Commitment',
      observation: 'Note'
    };
    return labels[type] || 'Note';
  },

  /**
   * Get category icon (minimalist)
   */
  getCategoryIcon(category) {
    const icons = {
      work: '~', // tilde for work
      personal: '*', // asterisk for personal
      health: '+', // plus for health
      ideas: '>', // chevron for ideas
    };
    return icons[category] || '*';
  },

  /**
   * Humanize pattern ID to readable text
   */
  humanizePattern(patternId) {
    if (!patternId) return '';

    // Convert snake_case to sentence
    return patternId
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  },

  /**
   * Generate HTML for note result display
   */
  generateHTML(output, noteId) {
    const { summary, insight, question, metadata } = output;

    let html = `
      <div class="note-result" data-note-id="${noteId}">
        <div class="note-result-header">
          <span class="note-result-type">${metadata.category_icon} ${metadata.type_label}</span>
          <span class="note-result-time">${metadata.timestamp}</span>
        </div>

        <div class="note-result-summary">
          ${this.escapeHtml(summary)}
        </div>
    `;

    if (insight) {
      html += `
        <div class="note-result-divider"></div>
        <div class="note-result-insight">
          ${this.escapeHtml(insight)}
        </div>
      `;
    }

    if (question) {
      html += `
        <div class="note-result-divider"></div>
        <div class="note-result-question">
          ${this.escapeHtml(question)}
        </div>
      `;
    }

    html += `
        <div class="note-result-feedback">
          <button class="feedback-btn" data-action="like" aria-label="Like">
            <span class="feedback-icon">+</span>
          </button>
          <button class="feedback-btn" data-action="dislike" aria-label="Dislike">
            <span class="feedback-icon">-</span>
          </button>
          <button class="feedback-btn" data-action="comment" aria-label="Comment">
            <span class="feedback-icon">...</span>
          </button>
        </div>
    `;

    // Add decision tracking button if it's a decision
    if (output.type === 'decision') {
      html += `
        <div class="note-result-actions">
          <button class="track-decision-btn" data-note-id="${noteId}">
            Track Decision
          </button>
        </div>
      `;
    }

    html += '</div>';

    return html;
  },

  /**
   * Generate minimal result for toast/quick view
   */
  generateMinimal(output) {
    return {
      title: output.summary.split('.')[0] || 'Note captured',
      subtitle: output.insight ? output.insight.substring(0, 50) + '...' : null
    };
  },

  /**
   * Escape HTML special characters
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
  window.OutputGenerator = OutputGenerator;
}
