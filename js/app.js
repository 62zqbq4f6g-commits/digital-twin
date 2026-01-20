/**
 * Inscript - Main Application Controller
 * Connects: input → classifier → extractor → refiner → storage
 */

// App version - displayed in console on load
const APP_VERSION = '8.0.0';
console.log('[App] Inscript v' + APP_VERSION);
// Phase 11: Inscript rebrand, 7-screen onboarding, privacy settings, design system update
// Phase 10.9: UI modularization - split chat, camera, entity editor into separate modules
// Phase 10.6-10.8: Complete Mem0 Parity - cross-memory reasoning, importance classification, automatic forgetting
// Phase 10.3-10.5: Intelligent Memory Layer - semantic search (pgvector), LLM entity extraction, LLM memory compression
// Phase 10.2: Mem0-quality memory - conflict detection without re-extraction, relationship graphs, memory consolidation, proactive relevance
// Phase 10.1: Pattern awareness prompts + entity conflict detection/superseding
// Phase 9.5: Auth screens editorial refinement - "sign in" / "begin" lowercase headlines
// Phase 9.4: Bug fixes - role multi-select, search autocomplete, typography Option C, editorial loading messages
// Phase 9.3: Complete design overhaul - editorial branding, loading overlay, unified buttons

const App = {
  /**
   * Process a note through the full pipeline
   * @param {string} rawText - Raw input text
   * @param {'voice'|'text'} inputType - Type of input
   * @returns {Promise<Object>} Saved note with ID
   */
  async processNote(rawText, inputType) {
    console.log('[App.processNote] START - rawText:', rawText?.substring(0, 100), 'type:', inputType);

    // 1. VALIDATE - Empty/whitespace input shows error
    if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
      UI.showToast('Please enter some text');
      throw new Error('Empty input');
    }

    const text = rawText.trim();
    console.log('[App.processNote] Trimmed text:', text.substring(0, 100));

    try {
      // Show processing state
      UI.setProcessing(true);

      // 2. CLASSIFY - Determine category
      const classification = Classifier.classify(text);
      console.log('[App.processNote] Classification:', classification);

      // 3. EXTRACT - Get metadata
      const extracted = Extractor.extract(text);
      console.log('[App.processNote] Extracted title:', extracted.title);

      // 4. REFINE - Generate professional output (async - calls AI API)
      const refined = await Refiner.refine(text, classification, extracted, inputType);
      console.log('[App.processNote] Refined title:', refined.title);

      // 4a. ANALYZE - Smart analysis for Summary/Insight/Question (Phase 3a)
      let analysis = null;
      if (typeof Analyzer !== 'undefined') {
        try {
          analysis = await Analyzer.analyze({
            content: text,
            type: inputType
          });
          // Phase 8.8 DEBUG: Log analysis response
          console.log('[App] Phase 8.8 - Analysis response keys:', Object.keys(analysis || {}));
          console.log('[App] Phase 8.8 - analysis.tier:', analysis?.tier);
          console.log('[App] Phase 8.8 - analysis.heard:', analysis?.heard);
          console.log('[App] Phase 8.8 - analysis.noticed:', analysis?.noticed);
          console.log('[App] Phase 8.8 - analysis.experiment:', analysis?.experiment);
        } catch (e) {
          console.warn('[App] Smart analysis unavailable:', e.message);
        }
      }

      // 5. BUILD NOTE OBJECT - Full schema from CLAUDE.md 6.2
      const note = this.buildNoteObject(text, inputType, classification, extracted, refined, analysis);
      console.log('[App.processNote] Built note - title:', note.extracted?.title, 'raw_text:', note.input?.raw_text?.substring(0, 50));
      // Phase 8.8 DEBUG: Log what's being saved in analysis section
      console.log('[App] Phase 8.8 - note.analysis keys:', Object.keys(note.analysis || {}));
      console.log('[App] Phase 8.8 - note.analysis.tier:', note.analysis?.tier);
      console.log('[App] Phase 8.8 - note.analysis.heard:', note.analysis?.heard);
      console.log('[App] Phase 8.8 - note.analysis.noticed:', note.analysis?.noticed);

      // 6. SAVE - Store in IndexedDB
      const savedNote = await DB.saveNote(note);
      console.log('[App.processNote] Saved note ID:', savedNote.id);

      // Phase 12: Show Knowledge Pulse with learning data
      if (typeof KnowledgePulse !== 'undefined' && window.KnowledgePulse) {
        console.log('[App] Phase 12 - Showing Knowledge Pulse with learning:', analysis?.learning);
        window.KnowledgePulse.show(analysis?.learning);
      } else {
        // Fallback to simple toast if KnowledgePulse not available
        UI.showToast('Note saved!');
      }

      // Update recent notes on capture screen
      this.updateRecentNotes();

      // A4: Dispatch note-saved event for TWIN tab data refresh
      window.dispatchEvent(new CustomEvent('note-saved', { detail: { noteId: savedNote.id } }));

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

      // 9. PHASE 9: Process entities for user_entities table
      if (analysis?.entities && typeof Entities !== 'undefined' && Sync?.user?.id) {
        // Convert entities object { people: [], dates: [], places: [] } to flat array
        const entitiesArray = [];
        if (Array.isArray(analysis.entities.people)) {
          analysis.entities.people.forEach(name => {
            if (name) entitiesArray.push({ name, type: 'person', context: text.substring(0, 200) });
          });
        }
        if (Array.isArray(analysis.entities.dates)) {
          analysis.entities.dates.forEach(date => {
            if (date) entitiesArray.push({ name: date, type: 'date', context: text.substring(0, 200) });
          });
        }
        if (Array.isArray(analysis.entities.places)) {
          analysis.entities.places.forEach(place => {
            if (place) entitiesArray.push({ name: place, type: 'place', context: text.substring(0, 200) });
          });
        }

        if (entitiesArray.length > 0) {
          console.log('[App] Processing', entitiesArray.length, 'entities for user_entities');
          Entities.processExtractedEntities(entitiesArray, Sync.user.id, text).catch(err => {
            console.warn('[App] Phase 9 entity processing failed:', err);
          });
        }
      }

      // 10. PHASE 9: Increment note count in learning profile
      if (typeof Context !== 'undefined' && Sync?.user?.id) {
        Context.incrementNoteCount(Sync.user.id).catch(err => {
          console.warn('[App] Phase 9 note count increment failed:', err);
        });
      }

      // 11. PHASE 13A: Trigger pattern detection (non-blocking)
      if (Sync?.user?.id) {
        this.detectPatterns(Sync.user.id, analysis?.learning).catch(err => {
          console.warn('[App] Phase 13A pattern detection failed:', err);
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
      confidence: analysis.confidence || 0.5,
      // Phase 8.8: Tiered response fields
      tier: analysis.tier || null,
      heard: analysis.heard || null,
      noticed: analysis.noticed || null,
      hidden_assumption: analysis.hidden_assumption || null,
      experiment: analysis.experiment || null,
      invite: analysis.invite || null,
      noteType: analysis.noteType || null,
      whatThisReveals: analysis.whatThisReveals || null,
      questionToSitWith: analysis.questionToSitWith || null,
      memoryTags: analysis.memoryTags || []
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
  },

  /**
   * Phase 13A: Detect patterns from notes
   * Runs in background after note save
   * @param {string} userId - User ID
   * @param {Object} learning - Learning data from analysis
   */
  async detectPatterns(userId, learning) {
    try {
      console.log('[App] Phase 13A - Running pattern detection for user:', userId);

      const response = await fetch('/api/detect-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        throw new Error(`Pattern detection failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[App] Phase 13A - Pattern detection result:', result);

      // If new patterns were detected, update Knowledge Pulse
      if (result.detected && result.detected.length > 0 && window.KnowledgePulse) {
        // Add patterns to existing learning data and re-show pulse
        const enhancedLearning = {
          ...(learning || {}),
          patterns_detected: result.detected
        };
        console.log('[App] Phase 13A - New patterns detected, updating Knowledge Pulse');
        window.KnowledgePulse.show(enhancedLearning);
      }

    } catch (error) {
      console.warn('[App] Phase 13A - Pattern detection error:', error);
      // Non-blocking, don't throw
    }
  }
};

// Export for global access
window.App = App;
