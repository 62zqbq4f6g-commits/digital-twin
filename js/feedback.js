/**
 * Feedback System - Captures and processes user feedback to improve quality
 * Phase 7: Enhanced with full output context capture and edit tracking
 * Phase 7.1: Tinker-ready with input_context, time_to_feedback_ms, feedback_type
 */

const Feedback = {
  // Track original outputs for edit detection
  _originalOutputs: new Map(),

  // Track when outputs were shown (for time_to_feedback_ms calculation)
  _outputShownTimestamps: new Map(),

  // Current prompt version (should match sw.js APP_VERSION)
  PROMPT_VERSION: 'v5.2.0',
  MODEL_VERSION: 'claude-3-5-sonnet',

  /**
   * Phase 7: Capture original output when note is opened
   * Phase 7.1: Also captures input_context and timestamp for Tinker
   * Call this when displaying note details
   * @param {string} noteId - Note ID
   * @param {Object} output - The current output (summary, insight, question, actions)
   * @param {Object} note - Optional: full note object for input_context
   */
  captureOriginalOutput(noteId, output, note = null) {
    if (!noteId || !output) return;

    // Only capture if not already captured for this note
    if (!this._originalOutputs.has(noteId)) {
      // Phase 7.1: Build input_context for Tinker (NO raw content for privacy)
      const rawContent = note.input?.raw_content || note.input?.raw_text || '';
      const knownEntities = note.analysis?.knownEntitiesUsed || [];
      const inputContext = note ? {
        has_image: !!(note.imageData || note.input?.image_thumbnail),
        note_type: note.analysis?.noteType || 'unknown',
        category: note.analysis?.category || note.classification?.category || 'personal',
        entity_count: knownEntities.length,
        entity_types: [...new Set(knownEntities.map(e => e.type))],
        preferences_applied: note.analysis?.preferencesApplied || false,
        content_length: rawContent.length,
        word_count: rawContent.split(/\s+/).filter(w => w).length
      } : null;

      this._originalOutputs.set(noteId, {
        summary: output.summary || '',
        insight: output.insight || '',
        question: output.question || null,
        actions: output.actions || [],
        captured_at: new Date().toISOString(),
        input_context: inputContext
      });

      // Track when output was shown for time_to_feedback calculation
      this._outputShownTimestamps.set(noteId, Date.now());

      console.log('[Feedback] Captured original output for note:', noteId);
    }
  },

  /**
   * Phase 7: Get original output for a note
   * @param {string} noteId - Note ID
   * @returns {Object|null} Original output or null
   */
  getOriginalOutput(noteId) {
    return this._originalOutputs.get(noteId) || null;
  },

  /**
   * Phase 7: Clear original output (call when note is closed)
   * Phase 7.1: Also clears timestamp tracking
   * @param {string} noteId - Note ID
   */
  clearOriginalOutput(noteId) {
    this._originalOutputs.delete(noteId);
    this._outputShownTimestamps.delete(noteId);
  },

  /**
   * Process feedback for a note
   * @param {string} noteId - Note ID
   * @param {string} rating - 'liked' or 'disliked'
   * @param {string} comment - Optional comment
   */
  async process(noteId, rating, comment = null) {
    try {
      // Get the note
      const note = await DB.getNoteById(noteId);
      if (!note) {
        console.error('[Feedback] Note not found:', noteId);
        return;
      }

      // Update note with feedback
      note.feedback = note.feedback || {};
      note.feedback.rating = rating;
      note.feedback.comment = comment;
      note.feedback.feedback_at = new Date().toISOString();
      await DB.saveNote(note);

      // Classify the feedback reason
      const reason = await this.classifyReason(note, rating, comment);
      note.feedback.reason = reason;
      await DB.saveNote(note);

      // Phase 7: Store to Supabase with full output context
      await this.storeToSupabase(note, rating, reason, comment);

      // Store in quality learning system
      if (typeof QualityLearning !== 'undefined') {
        await QualityLearning.storeFeedback(note, rating, reason, comment);
      }

      // Sync
      if (typeof Sync !== 'undefined') {
        await Sync.pushChanges();
      }

      console.log(`[Feedback] Processed: ${rating} (reason: ${reason})`);
      return reason;

    } catch (error) {
      console.error('[Feedback] Processing failed:', error);
      throw error;
    }
  },

  /**
   * Phase 7: Store feedback to Supabase output_feedback table
   * Phase 7.1: Enhanced with Tinker-ready fields
   * @param {Object} note - The note object
   * @param {string} rating - 'liked' or 'disliked'
   * @param {string} reason - Classified reason
   * @param {string} comment - Optional comment
   */
  async storeToSupabase(note, rating, reason, comment) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.warn('[Feedback] Supabase not available');
        return;
      }

      const user = Sync.supabase.auth.getUser ?
        (await Sync.supabase.auth.getUser())?.data?.user : null;

      if (!user) {
        console.warn('[Feedback] No authenticated user');
        return;
      }

      // Build the original output object (NO raw content for privacy)
      const originalOutput = {
        summary: note.analysis?.summary || '',
        insight: note.analysis?.insight || '',
        question: note.analysis?.question || null,
        actions: note.analysis?.actions || [],
        note_type: note.analysis?.noteType || 'unknown'
      };

      // Phase 7.1: Calculate time_to_feedback_ms
      const shownTimestamp = this._outputShownTimestamps.get(note.id);
      const timeToFeedbackMs = shownTimestamp ? Date.now() - shownTimestamp : null;

      // Phase 7.1: Get input_context from cached original output or build it (NO raw content)
      const cachedData = this._originalOutputs.get(note.id);
      const rawContent = note.input?.raw_content || note.input?.raw_text || '';
      const knownEntities = note.analysis?.knownEntitiesUsed || [];
      const inputContext = cachedData?.input_context || {
        has_image: !!(note.imageData || note.input?.image_thumbnail),
        note_type: note.analysis?.noteType || 'unknown',
        category: note.analysis?.category || note.classification?.category || 'personal',
        entity_count: knownEntities.length,
        entity_types: [...new Set(knownEntities.map(e => e.type))],
        preferences_applied: note.analysis?.preferencesApplied || false,
        content_length: rawContent.length,
        word_count: rawContent.split(/\s+/).filter(w => w).length
      };

      // Phase 7.1: Map rating to feedback_type
      const feedbackType = rating === 'liked' ? 'thumbs_up' : 'thumbs_down';

      const feedbackData = {
        user_id: user.id,
        note_id: note.id,
        rating: rating,
        reason: reason,
        comment: comment,
        original_output: originalOutput,
        created_at: new Date().toISOString(),
        // Phase 7.1: Tinker-ready fields
        input_context: inputContext,
        model_version: this.MODEL_VERSION,
        prompt_version: this.PROMPT_VERSION,
        time_to_feedback_ms: timeToFeedbackMs,
        feedback_type: feedbackType
      };

      const { error } = await Sync.supabase
        .from('output_feedback')
        .insert(feedbackData);

      if (error) {
        console.error('[Feedback] Supabase insert error:', error);
      } else {
        console.log('[Feedback] Stored to Supabase output_feedback (Tinker-ready)', {
          feedback_type: feedbackType,
          time_to_feedback_ms: timeToFeedbackMs
        });
      }
    } catch (error) {
      console.error('[Feedback] Supabase storage failed:', error);
    }
  },

  /**
   * Phase 7: Track an edit to the output
   * @param {string} noteId - Note ID
   * @param {string} field - Which field was edited (summary, insight, question)
   * @param {string} originalValue - Original value
   * @param {string} editedValue - New value after edit
   */
  async trackEdit(noteId, field, originalValue, editedValue) {
    try {
      const note = await DB.getNoteById(noteId);
      if (!note) {
        console.error('[Feedback] Note not found for edit tracking:', noteId);
        return;
      }

      // Classify the edit type
      const editType = this.classifyEditType(originalValue, editedValue);

      // Store to Supabase
      await this.storeEditToSupabase(note, field, originalValue, editedValue, editType);

      console.log(`[Feedback] Edit tracked: ${field} (${editType})`);
      return editType;
    } catch (error) {
      console.error('[Feedback] Edit tracking failed:', error);
    }
  },

  /**
   * Phase 7: Classify what type of edit was made
   * @param {string} original - Original text
   * @param {string} edited - Edited text
   * @returns {string} Edit type classification
   */
  classifyEditType(original, edited) {
    if (!original || !edited) return 'new_content';

    const origLen = original.length;
    const editLen = edited.length;
    const lenRatio = editLen / origLen;

    // Check for significant length change
    if (lenRatio < 0.5) return 'shortened';
    if (lenRatio > 1.5) return 'expanded';

    // Check for tone changes (emotional words)
    const emotionalWords = ['amazing', 'wonderful', 'beautiful', 'love', 'incredible', 'fantastic', 'journey', 'growth'];
    const origEmotional = emotionalWords.some(w => original.toLowerCase().includes(w));
    const editEmotional = emotionalWords.some(w => edited.toLowerCase().includes(w));

    if (origEmotional && !editEmotional) return 'tone_reduced';
    if (!origEmotional && editEmotional) return 'tone_added';

    // Check for factual corrections
    const origWords = new Set(original.toLowerCase().split(/\s+/));
    const editWords = new Set(edited.toLowerCase().split(/\s+/));
    const newWords = [...editWords].filter(w => !origWords.has(w));
    const removedWords = [...origWords].filter(w => !editWords.has(w));

    // If significant word changes, likely factual correction
    if (newWords.length > 3 || removedWords.length > 3) return 'content_change';

    // Default to minor edit
    return 'minor_edit';
  },

  /**
   * Phase 7: Store edit to Supabase
   * Phase 7.1: Enhanced with Tinker-ready fields
   */
  async storeEditToSupabase(note, field, originalValue, editedValue, editType) {
    try {
      if (typeof Sync === 'undefined' || !Sync.supabase) {
        console.warn('[Feedback] Supabase not available');
        return;
      }

      const user = Sync.supabase.auth.getUser ?
        (await Sync.supabase.auth.getUser())?.data?.user : null;

      if (!user) {
        console.warn('[Feedback] No authenticated user');
        return;
      }

      // Get original output from cache or note
      const cachedOriginal = this.getOriginalOutput(note.id);
      const originalOutput = cachedOriginal || {
        summary: note.analysis?.summary || '',
        insight: note.analysis?.insight || '',
        question: note.analysis?.question || null
      };

      // Build edited output (update the specific field)
      const editedOutput = { ...originalOutput };
      editedOutput[field] = editedValue;

      // Phase 7.1: Calculate time_to_feedback_ms
      const shownTimestamp = this._outputShownTimestamps.get(note.id);
      const timeToFeedbackMs = shownTimestamp ? Date.now() - shownTimestamp : null;

      // Phase 7.1: Get input_context from cached data (NO raw content)
      const rawContent = note.input?.raw_content || note.input?.raw_text || '';
      const knownEntities = note.analysis?.knownEntitiesUsed || [];
      const inputContext = cachedOriginal?.input_context || {
        has_image: !!(note.imageData || note.input?.image_thumbnail),
        note_type: note.analysis?.noteType || 'unknown',
        category: note.analysis?.category || note.classification?.category || 'personal',
        entity_count: knownEntities.length,
        entity_types: [...new Set(knownEntities.map(e => e.type))],
        preferences_applied: note.analysis?.preferencesApplied || false,
        content_length: rawContent.length,
        word_count: rawContent.split(/\s+/).filter(w => w).length
      };

      const feedbackData = {
        user_id: user.id,
        note_id: note.id,
        rating: 'edited',
        reason: `edit_${field}`,
        original_output: originalOutput,
        edited_output: editedOutput,
        edit_type: editType,
        created_at: new Date().toISOString(),
        // Phase 7.1: Tinker-ready fields
        input_context: inputContext,
        model_version: this.MODEL_VERSION,
        prompt_version: this.PROMPT_VERSION,
        time_to_feedback_ms: timeToFeedbackMs,
        feedback_type: 'edit'
      };

      const { error } = await Sync.supabase
        .from('output_feedback')
        .insert(feedbackData);

      if (error) {
        console.error('[Feedback] Supabase edit insert error:', error);
      } else {
        console.log('[Feedback] Edit stored to Supabase (Tinker-ready)', {
          feedback_type: 'edit',
          edit_type: editType,
          time_to_feedback_ms: timeToFeedbackMs
        });
      }
    } catch (error) {
      console.error('[Feedback] Supabase edit storage failed:', error);
    }
  },

  /**
   * Classify why the user gave this feedback
   */
  async classifyReason(note, rating, comment) {
    try {
      const response = await fetch('/api/classify-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: note.input?.raw_content || note.input?.raw_text || '',
          output: {
            summary: note.analysis?.summary || '',
            insight: note.analysis?.insight || '',
            question: note.analysis?.question || null
          },
          rating,
          comment
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.reason;
      }
    } catch (error) {
      console.warn('[Feedback] API classification failed, using fallback');
    }

    // Fallback classification
    return this.localClassify(note, rating, comment);
  },

  /**
   * Local fallback classification
   */
  localClassify(note, rating, comment) {
    const insight = (note.analysis?.insight || '').toLowerCase();
    const commentLower = (comment || '').toLowerCase();

    if (rating === 'liked') {
      if (commentLower.includes('question') || commentLower.includes('specific')) {
        return 'specific_question';
      }
      if (commentLower.includes('pattern') || commentLower.includes('connect')) {
        return 'pattern_connection';
      }
      if (commentLower.includes('tension') || commentLower.includes('tradeoff')) {
        return 'tension_surfacing';
      }
      return 'non_obvious_insight';
    } else {
      if (commentLower.includes('generic') || commentLower.includes('obvious')) {
        return 'too_generic';
      }
      if (commentLower.includes('knew') || commentLower.includes('already')) {
        return 'obvious_observation';
      }
      if (commentLower.includes('vague') || commentLower.includes('unclear')) {
        return 'vague_question';
      }
      if (commentLower.includes('long') || commentLower.includes('wordy')) {
        return 'too_verbose';
      }
      // Check the insight itself
      if (insight.includes('worth considering') || insight.includes('reflection noted')) {
        return 'too_generic';
      }
      return 'too_generic';
    }
  },

  /**
   * Initialize feedback system (called on app load)
   */
  init() {
    console.log('[Feedback] Initialized');
  },

  /**
   * Process feedback from note (legacy method for compatibility)
   */
  async processFeedback(note, rating, comment) {
    return this.process(note.id, rating, comment);
  }
};

// Make globally available
window.Feedback = Feedback;
