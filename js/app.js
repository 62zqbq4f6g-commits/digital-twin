/**
 * Digital Twin - Main Application Controller
 * Connects: input → classifier → extractor → refiner → storage
 */

// App version - displayed in console on load
const APP_VERSION = '5.3.0';
console.log('[App] Version:', APP_VERSION);

const App = {
  /**
   * Process a note through the full pipeline
   * @param {string} rawText - Raw input text
   * @param {'voice'|'text'} inputType - Type of input
   * @returns {Promise<Object>} Saved note with ID
   */
  async processNote(rawText, inputType) {
    // 1. VALIDATE - Empty/whitespace input shows error
    if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
      UI.showToast('Please enter some text');
      throw new Error('Empty input');
    }

    const text = rawText.trim();

    try {
      // Show processing state
      UI.setProcessing(true);

      // 2. CLASSIFY - Determine category
      const classification = Classifier.classify(text);

      // 3. EXTRACT - Get metadata
      const extracted = Extractor.extract(text);

      // 4. REFINE - Generate professional output (async - calls AI API)
      const refined = await Refiner.refine(text, classification, extracted, inputType);

      // 4a. ANALYZE - Smart analysis for Summary/Insight/Question (Phase 3a)
      let analysis = null;
      if (typeof Analyzer !== 'undefined') {
        try {
          analysis = await Analyzer.analyze({
            content: text,
            type: inputType
          });
        } catch (e) {
          console.warn('[App] Smart analysis unavailable:', e.message);
        }
      }

      // 5. BUILD NOTE OBJECT - Full schema from CLAUDE.md 6.2
      const note = this.buildNoteObject(text, inputType, classification, extracted, refined, analysis);

      // 6. SAVE - Store in IndexedDB
      const savedNote = await DB.saveNote(note);

      // Show success feedback
      UI.showToast('Note saved!');

      // Update recent notes on capture screen
      this.updateRecentNotes();

      // 7. PROCESS FOR TWIN - Analyze in background (non-blocking)
      if (typeof TwinEngine !== 'undefined') {
        TwinEngine.processNote(savedNote);
      }

      // 8. STORE ENTITIES - Phase 6: Memory System
      if (analysis?.entities && typeof EntityMemory !== 'undefined') {
        EntityMemory.storeEntities(analysis.entities, savedNote.id, text).catch(err => {
          console.warn('[App] Entity storage failed:', err);
        });
      }

      return savedNote;

    } catch (error) {
      console.error('Error processing note:', error);
      UI.showToast('Failed to save note');
      throw error;

    } finally {
      // Clear processing state
      UI.setProcessing(false);
    }
  },

  /**
   * Build full note object matching CLAUDE.md section 6.2 schema
   * @param {string} rawText - Raw input text
   * @param {'voice'|'text'} inputType - Type of input
   * @param {Object} classification - Classification result
   * @param {Object} extracted - Extracted metadata
   * @param {Object} refined - Refined output
   * @param {Object} analysis - Smart analysis (Phase 3a)
   * @returns {Object} Complete note object
   */
  buildNoteObject(rawText, inputType, classification, extracted, refined, analysis = null) {
    const now = new Date();

    // Build timestamps
    const timestamps = {
      created_at: now.toISOString(),
      input_date: now.toISOString().slice(0, 10),
      input_time: now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      input_timezone: 'Asia/Singapore',
      day_of_week: now.toLocaleDateString('en-US', {
        timeZone: 'Asia/Singapore',
        weekday: 'long'
      })
    };

    // Build input data
    const input = {
      type: inputType,
      raw_text: rawText
    };

    // Add duration for voice input (placeholder - would need actual timing)
    if (inputType === 'voice') {
      input.duration_seconds = Math.ceil(rawText.split(' ').length * 0.5);
    }

    // Use AI-refined data when available, fallback to local extraction
    const finalClassification = {
      category: refined.category || classification.category,
      confidence: refined.confidence || classification.confidence,
      reasoning: classification.reasoning || `AI classified as ${refined.category}`
    };

    const finalExtracted = {
      title: refined.title || extracted.title,
      topics: refined.topics || extracted.topics,
      action_items: refined.action_items || extracted.action_items,
      sentiment: refined.sentiment || extracted.sentiment,
      people: refined.people || extracted.people
    };

    // Build machine_readable section
    const machine_readable = this.buildMachineReadable(finalExtracted, finalClassification);

    // Build analysis section (Phase 3b - includes cleanedInput, actions, shareability)
    const analysisSection = analysis ? {
      // Phase 3b fields
      cleanedInput: analysis.cleanedInput || null,
      title: analysis.title || null,
      actions: analysis.actions || [],
      shareability: analysis.shareability || { ready: false, reason: '' },
      // Phase 3a fields
      summary: analysis.summary,
      insight: analysis.insight,
      question: analysis.question,
      type: analysis.type,
      category: analysis.category,
      patterns: analysis.patterns || { reinforced: [], new: [] },
      voice: analysis.voice || {},
      entities: analysis.entities || {},
      decision: analysis.decision || { isDecision: false },
      confidence: analysis.confidence || 0.5
    } : null;

    // Complete note object matching CLAUDE.md 6.2 schema
    return {
      // ID will be auto-generated by DB.saveNote
      version: '1.0',
      timestamps,
      input,
      classification: finalClassification,
      extracted: finalExtracted,
      refined: {
        summary: refined.summary,
        formatted_output: refined.formatted_output,
        key_points: refined.key_points || []
      },
      analysis: analysisSection,
      machine_readable
    };
  },

  /**
   * Build machine_readable section for future AI agents
   * @param {Object} extracted - Extracted metadata
   * @param {Object} classification - Classification result
   * @returns {Object} Machine readable data
   */
  buildMachineReadable(extracted, classification) {
    const entities = [];

    // Add people as entities
    if (extracted.people && extracted.people.length > 0) {
      extracted.people.forEach(person => {
        entities.push({
          type: 'person',
          value: person
        });
      });
    }

    // Add topics as concept entities
    if (extracted.topics && extracted.topics.length > 0) {
      extracted.topics.forEach(topic => {
        entities.push({
          type: 'concept',
          value: topic
        });
      });
    }

    // Build relationships from people
    const relationships = [];
    if (extracted.people && extracted.people.length > 0) {
      extracted.people.forEach(person => {
        relationships.push({
          from: 'User',
          to: person,
          type: `${classification.category}_interaction`
        });
      });
    }

    // Temporal data
    const temporal = {
      event_type: classification.category,
      has_action_items: extracted.action_items && extracted.action_items.length > 0,
      sentiment: extracted.sentiment
    };

    return {
      schema_type: 'DigitalTwin.Note/v1',
      entities,
      relationships,
      temporal
    };
  },

  /**
   * Update recent notes display on capture screen
   */
  async updateRecentNotes() {
    // Refresh notes list if on notes screen
    if (UI.currentScreen === 'notes') {
      UI.loadNotes();
    }
  },

  /**
   * Initialize the app
   */
  async init() {
    try {
      // Initialize database
      await DB.initDB();
      console.log('Database initialized');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }
};

// Export for global access
window.App = App;
