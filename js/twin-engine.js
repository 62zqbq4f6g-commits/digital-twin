/**
 * Twin Engine - Orchestrates all extractors and manages the twin profile
 * Runs on every note save (background, non-blocking)
 * Updates twin profile incrementally
 */

const TwinEngine = {
  isProcessing: false,
  queue: [],

  /**
   * Initialize the twin engine
   */
  async init() {
    console.log('[TwinEngine] Initializing...');

    // Ensure profile exists
    const profile = await TwinProfile.load();
    if (!profile.meta.created) {
      console.log('[TwinEngine] Creating initial profile');
      await TwinProfile.save(TwinProfile.getDefaultProfile());
    }

    console.log('[TwinEngine] Ready');
  },

  /**
   * Process a note and update the twin profile
   * Called after each note is saved
   * @param {Object} note - The note to process
   */
  async processNote(note) {
    // Add to queue for background processing
    this.queue.push(note);

    // Process queue if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  },

  /**
   * Process queued notes
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const note = this.queue.shift();

    try {
      await this.analyzeNote(note);
    } catch (error) {
      console.error('[TwinEngine] Error processing note:', error);
    }

    // Continue with next in queue (non-blocking)
    setTimeout(() => this.processQueue(), 100);
  },

  /**
   * Analyze a single note and update profile
   */
  async analyzeNote(note) {
    console.log('[TwinEngine] Analyzing note:', note.id);

    const text = note.input?.raw_text || note.refined?.summary || '';
    if (!text || text.length < 10) {
      console.log('[TwinEngine] Note too short, skipping');
      return;
    }

    // Load current profile
    const profile = await TwinProfile.load();

    // Run extractors in parallel
    const [entities, beliefs, patterns] = await Promise.all([
      this.extractEntities(text, profile.relationships),
      this.extractBeliefs(text, profile.beliefs),
      this.detectPatterns(note, profile.patterns)
    ]);

    // Merge results into profile
    const updates = {};

    // Merge relationships (entities)
    if (entities) {
      updates.relationships = EntityExtractor.mergeEntities(
        profile.relationships || {},
        {
          people: entities.people || [],
          projects: entities.projects || [],
          companies: entities.companies || []
        }
      );

      // Add topics to knowledge
      if (entities.topics?.length > 0) {
        updates.knowledge = this.mergeKnowledge(profile.knowledge || {}, entities.topics);
      }

      // Phase 10: Sync entities to user_entities table
      if (typeof Entities !== 'undefined' && typeof Sync !== 'undefined' && Sync.user?.id) {
        const entitiesArray = [];
        // Helper to convert sentiment string to numeric
        const sentimentToNumeric = (sentiment) => {
          if (typeof sentiment === 'number') return sentiment;
          const map = { 'positive': 0.7, 'negative': -0.7, 'neutral': 0, 'mixed': 0.1 };
          return map[sentiment?.toLowerCase()] ?? null;
        };
        // Convert people to array format
        if (Array.isArray(entities.people)) {
          entities.people.forEach(person => {
            if (person && person.name) {
              entitiesArray.push({
                name: person.name,
                type: 'person',
                context: text.substring(0, 200),
                sentiment: sentimentToNumeric(person.sentiment)
              });
            }
          });
        }
        // Convert projects to array format
        if (Array.isArray(entities.projects)) {
          entities.projects.forEach(project => {
            if (project && project.name) {
              entitiesArray.push({
                name: project.name,
                type: 'project',
                context: text.substring(0, 200)
              });
            }
          });
        }
        // Convert companies to array format
        if (Array.isArray(entities.companies)) {
          entities.companies.forEach(company => {
            if (company && company.name) {
              entitiesArray.push({
                name: company.name,
                type: 'company',
                context: text.substring(0, 200)
              });
            }
          });
        }

        if (entitiesArray.length > 0) {
          console.log('[TwinEngine] Syncing', entitiesArray.length, 'entities to user_entities');
          Entities.processExtractedEntities(entitiesArray, Sync.user.id, text).catch(err => {
            console.warn('[TwinEngine] Entity sync to user_entities failed:', err);
          });
        }
      }
    }

    // Merge beliefs
    if (beliefs) {
      updates.beliefs = BeliefExtractor.mergeBeliefs(
        profile.beliefs || {},
        beliefs
      );
    }

    // Merge patterns
    if (patterns) {
      updates.patterns = this.mergePatterns(profile.patterns || {}, patterns);
    }

    // Update meta
    updates.meta = {
      ...profile.meta,
      notesAnalyzed: (profile.meta.notesAnalyzed || 0) + 1,
      lastUpdated: new Date().toISOString()
    };

    // Save updated profile
    await TwinProfile.merge(updates);

    // Sync to cloud in background
    this.syncToCloud();

    console.log('[TwinEngine] Note analysis complete');
  },

  /**
   * Extract entities using EntityExtractor
   */
  async extractEntities(text, existingRelationships) {
    try {
      // Phase 5C.1: Ensure existingRelationships is an object with arrays
      existingRelationships = existingRelationships || {};
      const existingEntities = [
        ...(Array.isArray(existingRelationships.people) ? existingRelationships.people : []),
        ...(Array.isArray(existingRelationships.projects) ? existingRelationships.projects : []),
        ...(Array.isArray(existingRelationships.companies) ? existingRelationships.companies : [])
      ];
      return await EntityExtractor.extract(text, existingEntities);
    } catch (error) {
      console.error('[TwinEngine] Entity extraction failed:', error);
      return null;
    }
  },

  /**
   * Extract beliefs using BeliefExtractor
   */
  async extractBeliefs(text, existingBeliefs) {
    try {
      return await BeliefExtractor.extract(text, existingBeliefs);
    } catch (error) {
      console.error('[TwinEngine] Belief extraction failed:', error);
      return null;
    }
  },

  /**
   * Detect patterns using PatternDetector
   */
  async detectPatterns(note, existingPatterns) {
    try {
      return PatternDetector.analyzeNote(note);
    } catch (error) {
      console.error('[TwinEngine] Pattern detection failed:', error);
      return null;
    }
  },

  /**
   * Merge knowledge topics
   */
  mergeKnowledge(existing, newTopics) {
    const expertise = [...(existing.expertise || [])];

    for (const topic of newTopics) {
      const existingIndex = expertise.findIndex(e =>
        e.topic.toLowerCase() === topic.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        expertise[existingIndex].mentions =
          (expertise[existingIndex].mentions || 1) + 1;
        expertise[existingIndex].depth = Math.min(
          1,
          expertise[existingIndex].depth + 0.05
        );
      } else {
        expertise.push({
          topic: topic.name,
          depth: topic.depth || 0.3,
          mentions: 1
        });
      }
    }

    // Sort by mentions
    expertise.sort((a, b) => (b.mentions || 0) - (a.mentions || 0));

    return {
      ...existing,
      expertise: expertise.slice(0, 20) // Keep top 20
    };
  },

  /**
   * Merge patterns incrementally
   */
  mergePatterns(existing, newPatterns) {
    const merged = { ...existing };

    // Update temporal patterns
    if (newPatterns.temporal) {
      const byHour = { ...(existing.temporal?.captureFrequency?.byHour || {}) };
      const byDay = { ...(existing.temporal?.captureFrequency?.byDay || {}) };

      if (newPatterns.temporal.hour !== undefined) {
        const hourKey = newPatterns.temporal.hour.toString();
        byHour[hourKey] = (byHour[hourKey] || 0) + 1;
      }

      if (newPatterns.temporal.dayOfWeek) {
        byDay[newPatterns.temporal.dayOfWeek] =
          (byDay[newPatterns.temporal.dayOfWeek] || 0) + 1;
      }

      merged.temporal = {
        ...existing.temporal,
        captureFrequency: {
          ...existing.temporal?.captureFrequency,
          byHour,
          byDay
        }
      };
    }

    // Update behavioral patterns
    if (newPatterns.behavioral) {
      const topicDist = { ...(existing.behavioral?.topicDistribution || {}) };
      const inputPref = { ...(existing.behavioral?.inputPreference || { text: 0, voice: 0, image: 0 }) };

      if (newPatterns.behavioral.category) {
        topicDist[newPatterns.behavioral.category] =
          (topicDist[newPatterns.behavioral.category] || 0) + 1;
      }

      if (newPatterns.behavioral.inputType) {
        inputPref[newPatterns.behavioral.inputType] =
          (inputPref[newPatterns.behavioral.inputType] || 0) + 1;
      }

      merged.behavioral = {
        ...existing.behavioral,
        topicDistribution: topicDist,
        inputPreference: inputPref
      };
    }

    // Update emotional patterns
    if (newPatterns.emotional) {
      const currentEnergy = existing.emotional?.baselineEnergy || 0.5;
      const newEnergy = newPatterns.emotional.energy || 0.5;

      // Running average
      const notesCount = (existing.meta?.notesAnalyzed || 0) + 1;
      const avgEnergy = ((currentEnergy * (notesCount - 1)) + newEnergy) / notesCount;

      merged.emotional = {
        ...existing.emotional,
        baselineEnergy: Math.round(avgEnergy * 100) / 100
      };
    }

    return merged;
  },

  /**
   * Sync profile to cloud (debounced)
   */
  syncToCloud: (() => {
    let timeout = null;
    return function() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          await TwinProfile.syncToCloud();
        } catch (error) {
          console.error('[TwinEngine] Cloud sync failed:', error);
        }
      }, 5000); // Debounce 5 seconds
    };
  })(),

  /**
   * Run full analysis on all notes
   */
  async runFullAnalysis() {
    console.log('[TwinEngine] Starting full analysis...');

    try {
      const notes = await NotesManager.getAll();
      console.log(`[TwinEngine] Analyzing ${notes.length} notes...`);

      if (notes.length === 0) {
        console.log('[TwinEngine] No notes to analyze');
        return;
      }

      // Get aggregated patterns
      const patterns = PatternDetector.aggregatePatterns(notes);

      // Process each note for entities and beliefs
      const allEntities = { people: [], projects: [], companies: [], topics: [] };
      const allBeliefs = { opinions: [], values: [], contrarian: [], evolving: [] };

      for (const note of notes) {
        const text = note.input?.raw_text || note.refined?.summary || '';
        if (text.length < 10) continue;

        // Extract entities (using fallback to avoid API rate limits)
        // Phase 5C.1: Added Array.isArray checks for safety
        const entities = EntityExtractor.fallbackExtract(text) || {};
        if (Array.isArray(entities.people)) allEntities.people.push(...entities.people);
        if (Array.isArray(entities.projects)) allEntities.projects.push(...entities.projects);
        if (Array.isArray(entities.companies)) allEntities.companies.push(...entities.companies);
        if (Array.isArray(entities.topics)) allEntities.topics.push(...entities.topics);

        // Extract beliefs locally
        // Phase 5C.1: Added Array.isArray checks for safety
        const beliefs = BeliefExtractor.localExtract(text, allBeliefs) || {};
        if (Array.isArray(beliefs.opinions)) allBeliefs.opinions.push(...beliefs.opinions);
        if (Array.isArray(beliefs.values)) allBeliefs.values.push(...beliefs.values);
        if (Array.isArray(beliefs.contrarian)) allBeliefs.contrarian.push(...beliefs.contrarian);
      }

      // Deduplicate
      const mergedEntities = EntityExtractor.mergeEntities({}, allEntities);
      const mergedBeliefs = BeliefExtractor.mergeBeliefs({}, allBeliefs);

      // Build knowledge from topics
      const knowledge = {
        expertise: allEntities.topics.reduce((acc, topic) => {
          const existing = acc.find(e => e.topic === topic.name);
          if (existing) {
            existing.mentions++;
            existing.depth = Math.min(1, existing.depth + 0.05);
          } else {
            acc.push({ topic: topic.name, depth: 0.3, mentions: 1 });
          }
          return acc;
        }, []).sort((a, b) => b.mentions - a.mentions).slice(0, 20),
        learning: [],
        questions: []
      };

      // Save complete profile
      const profile = TwinProfile.getDefaultProfile();
      profile.patterns = patterns;
      profile.relationships = {
        people: mergedEntities.people || [],
        projects: mergedEntities.projects || [],
        companies: mergedEntities.companies || []
      };
      profile.beliefs = mergedBeliefs;
      profile.knowledge = knowledge;
      profile.meta.notesAnalyzed = notes.length;
      profile.meta.lastFullAnalysis = new Date().toISOString();
      profile.meta.confidenceScore = TwinProfile.calculateConfidence(profile);

      await TwinProfile.save(profile);
      await TwinProfile.syncToCloud();

      console.log('[TwinEngine] Full analysis complete');
      return profile;
    } catch (error) {
      console.error('[TwinEngine] Full analysis failed:', error);
      throw error;
    }
  },

  /**
   * Get current profile summary for display
   */
  async getProfileSummary() {
    const profile = await TwinProfile.load();

    return {
      confidence: profile.meta.confidenceScore || 0,
      notesAnalyzed: profile.meta.notesAnalyzed || 0,
      lastUpdated: profile.meta.lastUpdated,
      stats: {
        people: profile.relationships?.people?.length || 0,
        projects: profile.relationships?.projects?.length || 0,
        companies: profile.relationships?.companies?.length || 0,
        opinions: profile.beliefs?.opinions?.length || 0,
        values: profile.beliefs?.values?.length || 0,
        topics: profile.knowledge?.expertise?.length || 0
      }
    };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TwinEngine = TwinEngine;
}
