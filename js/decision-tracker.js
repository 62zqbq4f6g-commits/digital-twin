/**
 * Decision Tracker - Tracks pending decisions and outcomes
 * Part of Phase 3a for decision pattern learning
 */

const DecisionTracker = {
  /**
   * Track a decision from a note
   * @param {string} noteId - Note ID containing the decision
   */
  async trackDecision(noteId) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note) {
        console.error('[DecisionTracker] Note not found:', noteId);
        return;
      }

      // Mark note as tracked decision
      if (!note.decision) {
        note.decision = {};
      }

      note.decision.is_tracked = true;
      note.decision.tracked_at = new Date().toISOString();

      // Extract decision info
      if (!note.decision.status) {
        note.decision.status = 'deliberating';
      }

      // Generate decision title from summary
      if (!note.decision.title) {
        const summary = note.analysis?.summary || note.refined?.summary || '';
        note.decision.title = summary.split('.')[0].substring(0, 60) || 'Untitled Decision';
      }

      await DB.saveNote(note);

      // Add to twin profile decisions
      await this.addToProfile(note);

      // Show confirmation
      if (typeof UI !== 'undefined') {
        UI.showToast('Decision tracked');
      }

      console.log('[DecisionTracker] Decision tracked:', noteId);
    } catch (error) {
      console.error('[DecisionTracker] Error tracking:', error);
    }
  },

  /**
   * Add decision to twin profile
   */
  async addToProfile(note) {
    try {
      const profile = await TwinProfile.load();

      if (!profile.decisions) {
        profile.decisions = {
          active: [],
          resolved: [],
          patterns: []
        };
      }

      // Check if already tracked
      const existing = profile.decisions.active.find(d => d.note_id === note.id);
      if (existing) return;

      // Add to active decisions
      profile.decisions.active.push({
        note_id: note.id,
        title: note.decision.title,
        status: note.decision.status,
        category: note.analysis?.category || note.classification?.category || 'personal',
        options: note.decision.options || [],
        tracked_at: note.decision.tracked_at,
        updated_at: note.decision.tracked_at
      });

      await TwinProfile.save(profile);
    } catch (error) {
      console.error('[DecisionTracker] Error adding to profile:', error);
    }
  },

  /**
   * Update decision status
   * @param {string} noteId - Note ID
   * @param {string} status - New status (deliberating, committed, resolved)
   * @param {Object} outcome - Outcome details (if resolving)
   */
  async updateStatus(noteId, status, outcome = null) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note || !note.decision) {
        console.error('[DecisionTracker] Decision not found:', noteId);
        return;
      }

      const previousStatus = note.decision.status;
      note.decision.status = status;
      note.decision.updated_at = new Date().toISOString();

      if (status === 'committed' && outcome?.chosen) {
        note.decision.chosen = outcome.chosen;
        note.decision.committed_at = new Date().toISOString();
      }

      if (status === 'resolved') {
        note.decision.resolved_at = new Date().toISOString();
        note.decision.outcome = outcome?.outcome || null;
        note.decision.outcome_rating = outcome?.rating || null;
      }

      await DB.saveNote(note);

      // Update profile
      await this.updateProfileDecision(noteId, status, outcome);

      // Learn from resolution
      if (status === 'resolved') {
        await this.learnFromResolution(note);
      }

      console.log('[DecisionTracker] Status updated:', { noteId, status });
    } catch (error) {
      console.error('[DecisionTracker] Error updating status:', error);
    }
  },

  /**
   * Update decision in profile
   */
  async updateProfileDecision(noteId, status, outcome) {
    try {
      const profile = await TwinProfile.load();

      if (!profile.decisions) return;

      const activeIndex = profile.decisions.active.findIndex(d => d.note_id === noteId);

      if (activeIndex >= 0) {
        const decision = profile.decisions.active[activeIndex];
        decision.status = status;
        decision.updated_at = new Date().toISOString();

        if (outcome?.chosen) {
          decision.chosen = outcome.chosen;
        }

        // Move to resolved if resolved
        if (status === 'resolved') {
          decision.outcome = outcome?.outcome || null;
          decision.resolved_at = new Date().toISOString();

          // Remove from active, add to resolved
          profile.decisions.active.splice(activeIndex, 1);
          profile.decisions.resolved = profile.decisions.resolved || [];
          profile.decisions.resolved.push(decision);

          // Keep only last 50 resolved
          if (profile.decisions.resolved.length > 50) {
            profile.decisions.resolved = profile.decisions.resolved.slice(-50);
          }
        }

        await TwinProfile.save(profile);
      }
    } catch (error) {
      console.error('[DecisionTracker] Error updating profile:', error);
    }
  },

  /**
   * Learn patterns from resolved decision
   */
  async learnFromResolution(note) {
    try {
      const profile = await TwinProfile.load();

      // Extract patterns from the decision
      const patterns = note.analysis?.patterns || { reinforced: [], new: [] };

      // Update pattern evidence counts
      if (!profile.decisions.patterns) {
        profile.decisions.patterns = [];
      }

      for (const patternId of [...patterns.reinforced, ...patterns.new]) {
        const existing = profile.decisions.patterns.find(p => p.id === patternId);

        if (existing) {
          existing.evidence_count = (existing.evidence_count || 0) + 1;
          existing.last_seen = new Date().toISOString();
          existing.confidence = Math.min(1, (existing.confidence || 0.5) + 0.05);
        } else if (typeof patternId === 'string' && patternId.length > 0) {
          profile.decisions.patterns.push({
            id: patternId,
            description: this.humanizePattern(patternId),
            evidence_count: 1,
            confidence: 0.5,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          });
        }
      }

      await TwinProfile.save(profile);
      console.log('[DecisionTracker] Learned from resolution');
    } catch (error) {
      console.error('[DecisionTracker] Error learning from resolution:', error);
    }
  },

  /**
   * Get active decisions
   */
  async getActiveDecisions() {
    try {
      const profile = await TwinProfile.load();
      return profile.decisions?.active || [];
    } catch (error) {
      console.error('[DecisionTracker] Error getting active decisions:', error);
      return [];
    }
  },

  /**
   * Get decision patterns
   */
  async getPatterns() {
    try {
      const profile = await TwinProfile.load();
      const patterns = profile.decisions?.patterns || [];

      // Sort by confidence and evidence
      return patterns.sort((a, b) => {
        const scoreA = (a.confidence || 0) * (a.evidence_count || 0);
        const scoreB = (b.confidence || 0) * (b.evidence_count || 0);
        return scoreB - scoreA;
      });
    } catch (error) {
      console.error('[DecisionTracker] Error getting patterns:', error);
      return [];
    }
  },

  /**
   * Get perspective on a decision
   * @param {string} noteId - Decision note ID
   */
  async getPerspective(noteId) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note) return null;

      const patterns = await this.getPatterns();
      const topPatterns = patterns.slice(0, 3);

      // Find related past decisions
      const profile = await TwinProfile.load();
      const resolved = profile.decisions?.resolved || [];
      const related = resolved
        .filter(d => d.category === (note.analysis?.category || note.classification?.category))
        .slice(0, 3);

      return {
        decision: {
          title: note.decision?.title,
          options: note.decision?.options || [],
          status: note.decision?.status
        },
        relevant_patterns: topPatterns,
        related_decisions: related,
        key_questions: this.generateKeyQuestions(note)
      };
    } catch (error) {
      console.error('[DecisionTracker] Error getting perspective:', error);
      return null;
    }
  },

  /**
   * Generate key questions for a decision
   */
  generateKeyQuestions(note) {
    const questions = [];
    const text = (note.input?.raw_text || note.input?.raw_content || '').toLowerCase();

    if (text.includes('partner') || text.includes('partnership')) {
      questions.push('What does success look like in 12 months?');
      questions.push('What\'s the exit path if it doesn\'t work?');
    }

    if (text.includes('risk')) {
      questions.push('What\'s the worst realistic downside?');
      questions.push('Is this risk reversible?');
    }

    if (text.includes('uncertain') || text.includes('unsure')) {
      questions.push('What information would reduce uncertainty?');
      questions.push('Who has done this before?');
    }

    // Default questions
    if (questions.length === 0) {
      questions.push('What\'s the key constraint here?');
      questions.push('What would you tell a friend in this situation?');
    }

    return questions.slice(0, 3);
  },

  /**
   * Humanize pattern ID to readable text
   */
  humanizePattern(patternId) {
    if (!patternId) return '';
    return patternId
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  },

  /**
   * Get decision statistics
   */
  async getStats() {
    try {
      const profile = await TwinProfile.load();
      const decisions = profile.decisions || {};

      return {
        active: (decisions.active || []).length,
        resolved: (decisions.resolved || []).length,
        patterns: (decisions.patterns || []).length,
        total: (decisions.active || []).length + (decisions.resolved || []).length
      };
    } catch (error) {
      console.error('[DecisionTracker] Error getting stats:', error);
      return { active: 0, resolved: 0, patterns: 0, total: 0 };
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DecisionTracker = DecisionTracker;
}
