/**
 * Smart Analyzer - Extracts meaning from notes using LLM
 * Core component for Phase 3a note processing
 * Phase 4A: Added detectNoteType for personal vs productive output
 */

const Analyzer = {
  /**
   * Detect if note should receive personal or productive output
   * Phase 4A: Context-aware output detection
   * @param {string} content - Note content
   * @param {string} category - Detected category
   * @returns {string} 'personal' or 'productive'
   */
  detectNoteType(content, category) {
    const text = content.toLowerCase();

    // Personal signals - emotion, relationships, reflection
    const personalSignals = [
      // Emotion words
      /\b(feel|feeling|felt|happy|sad|anxious|excited|grateful|love|miss|remember|memory|memories|nostalgic)\b/i,
      // Relationship words
      /\b(friend|family|mom|dad|brother|sister|wife|husband|partner|kid|child|children|boyfriend|girlfriend)\b/i,
      // Reflection words
      /\b(childhood|growing up|used to|back when|reminds me|nostalgic|remember when)\b/i,
      // First person emotional
      /\b(i feel|i felt|i love|i miss|i remember|i'm grateful|i am grateful)\b/i,
      // Mood words
      /\b(weird|strange|emotional|sentimental|heartfelt|touching|moved|bittersweet)\b/i
    ];

    // Productive signals - work, action, decision
    const productiveSignals = [
      // Work words
      /\b(meeting|deadline|project|client|investor|deal|contract|budget|strategy|launch|revenue|roadmap)\b/i,
      // Action words
      /\b(need to|have to|should|must|todo|task|action|deliverable|milestone|priority)\b/i,
      // Decision words
      /\b(decide|decision|option|choose|whether to|torn between|considering|weighing)\b/i,
      // Business words
      /\b(partnership|proposal|presentation|workshop|team|hire|interview|pitch)\b/i
    ];

    let personalScore = 0;
    let productiveScore = 0;

    // Score personal signals
    personalSignals.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) personalScore += matches.length;
    });

    // Score productive signals
    productiveSignals.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) productiveScore += matches.length;
    });

    // Category boost
    if (category === 'personal') {
      personalScore += 2; // Lower threshold for personal category
    } else if (category === 'work') {
      productiveScore += 2;
    } else if (category === 'ideas') {
      productiveScore += 1; // Ideas lean slightly productive
    }

    // If content is short and emotional/reflective, prefer personal
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 30 && personalScore > 0) {
      personalScore += 1;
    }

    return personalScore > productiveScore ? 'personal' : 'productive';
  },

  /**
   * Analyze a note and extract meaning
   * @param {Object} input - Input data (type, content, duration)
   * @param {Object} context - Twin profile context
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(input, context = {}) {
    const content = input.content || input.raw_text || '';

    if (!content || content.trim().length < 10) {
      return this.getEmptyAnalysis();
    }

    // Get quality learning context (legacy support)
    let learningContext = {};
    if (typeof QualityLearning !== 'undefined') {
      try {
        const [examples, preferences] = await Promise.all([
          QualityLearning.getDynamicExamples(),
          QualityLearning.getPreferencesForPrompt()
        ]);
        learningContext = {
          liked_examples: examples.likedExamples,
          disliked_examples: examples.dislikedExamples,
          preferences: preferences
        };
      } catch (e) {
        console.warn('[Analyzer] Could not load learning context:', e.message);
      }
    }

    // Phase 7: Get XML-formatted preferences context
    let preferencesContext = null;
    if (typeof QualityLearning !== 'undefined') {
      try {
        preferencesContext = await QualityLearning.getPreferencesContext();
        if (preferencesContext.hasPreferences) {
          console.log('[Analyzer] Loaded Phase 7 preferences context');
        }
      } catch (e) {
        console.warn('[Analyzer] Could not load Phase 7 preferences:', e.message);
      }
    }

    // Load known entities for memory context (Phase 6)
    let memoryContext = {};
    if (typeof EntityMemory !== 'undefined') {
      try {
        memoryContext = await EntityMemory.getContextForAnalysis();
        if (memoryContext.knownEntities?.length > 0) {
          console.log('[Analyzer] Loaded memory context:', memoryContext.knownEntities.length, 'entities');
          console.log('[Analyzer] knownEntities:', JSON.stringify(memoryContext.knownEntities));
        } else {
          console.log('[Analyzer] No known entities found');
        }
      } catch (err) {
        console.warn('[Analyzer] Failed to load memory context:', err);
      }
    }

    // Phase 8: Load user profile for self-awareness
    let userProfile = null;
    if (typeof UserProfile !== 'undefined') {
      try {
        userProfile = await UserProfile.getContextForAnalysis();
        if (userProfile?.userName) {
          console.log('[Analyzer] Loaded user profile:', userProfile.userName);
        } else {
          console.log('[Analyzer] No user profile set');
        }
      } catch (err) {
        console.warn('[Analyzer] Failed to load user profile:', err);
      }
    }

    // Merge contexts
    const fullContext = {
      patterns: context.patterns || [],
      recent_notes: context.recentNotes || [],
      output_preferences: context.outputPreferences || {},
      ...learningContext,
      ...memoryContext, // Phase 6: Add memory context
      userProfile: userProfile // Phase 8: Add user profile for self-awareness
    };

    // Debug: Verify context merge
    console.log('[Analyzer] fullContext.knownEntities:', fullContext.knownEntities?.length || 0, 'entities');

    // Detect note type for context-aware output (Phase 4A)
    const category = this.detectCategory(content.toLowerCase());
    const noteType = this.detectNoteType(content, category);

    // Visual Learning: Check if input has an image
    const hasImage = Boolean(input.image || input.type === 'image');

    try {
      // Try API first
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            type: input.type || 'text',
            content: content,
            duration: input.duration || 0
          },
          context: fullContext,
          noteType: noteType, // Phase 4A: personal or productive
          // Phase 7: Include XML preferences
          preferencesXML: preferencesContext?.combinedXML || '',
          hasPersonalization: preferencesContext?.hasPreferences || false,
          // Visual Learning: Flag if image present
          hasImage: hasImage
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Record output for metrics
        if (typeof QualityLearning !== 'undefined') {
          QualityLearning.recordOutput();
        }

        // Visual Learning: Store visual entities if present
        if (data.visualEntities && data.visualEntities.length > 0) {
          await this.storeVisualEntities(data.visualEntities);
        }

        return this.processAPIResponse(data);
      }
    } catch (error) {
      console.log('[Analyzer] API unavailable, using local analysis');
    }

    // Fallback to local analysis
    return this.localAnalyze(content, input.type);
  },

  /**
   * Visual Learning: Store visual entities with their descriptions
   * @param {Array} visualEntities - Array of { name, type, visual, relationship_to_user } objects
   */
  async storeVisualEntities(visualEntities) {
    if (!visualEntities || visualEntities.length === 0) return;

    console.log(`[Analyzer] Storing ${visualEntities.length} visual entities`);

    for (const ve of visualEntities) {
      try {
        if (typeof EntityMemory !== 'undefined') {
          await EntityMemory.storeEntityWithVisual(
            { name: ve.name, type: ve.type, relationship_to_user: ve.relationship_to_user },
            ve.visual
          );
        }
      } catch (error) {
        console.warn(`[Analyzer] Failed to store visual entity ${ve.name}:`, error.message);
      }
    }

    console.log('[Analyzer] Visual entities stored');
  },

  /**
   * Process API response into standard format (Phase 3b + Phase 4A)
   */
  processAPIResponse(data) {
    return {
      // Phase 3b fields
      cleanedInput: data.cleanedInput || null,
      title: data.title || null,
      actions: Array.isArray(data.actions) ? data.actions : [],
      shareability: data.shareability || { ready: false, reason: '' },
      // Phase 3a fields
      summary: data.summary || '',
      insight: data.insight || '',
      question: data.question || null,
      type: data.type || 'observation',
      category: data.category || 'personal',
      patterns: data.patterns || { reinforced: [], new: [] },
      voice: data.voice || { energy: 0.5, certainty: 0.5, pace: 'measured', formality: 0.5 },
      entities: data.entities || { people: [], projects: [], topics: [] },
      decision: data.decision || { isDecision: false, type: null, options: null },
      confidence: data.confidence || 0.5,
      related_notes: data.related_notes || [],
      // Phase 4A fields
      noteType: data.noteType || 'productive',
      mood: data.mood || null,
      whatThisReveals: data.whatThisReveals || null,
      questionToSitWith: data.questionToSitWith || null,
      memoryTags: data.memoryTags || [],
      // Visual Learning: Include visual entities
      visualEntities: data.visualEntities || []
    };
  },

  /**
   * Local fallback analysis when API unavailable
   */
  localAnalyze(content, inputType) {
    const text = content.trim();
    const lowerText = text.toLowerCase();

    // Detect type
    const type = this.detectType(lowerText);

    // Detect category
    const category = this.detectCategory(lowerText);

    // Generate summary (first 2-3 sentences, cleaned)
    const summary = this.generateSummary(text);

    // Generate insight (pattern-based)
    const insight = this.generateInsight(text, type);

    // Generate question (if decision type)
    const question = this.generateQuestion(text, type);

    // Detect voice characteristics
    const voice = this.analyzeVoice(text, inputType);

    // Extract entities
    const entities = this.extractEntities(text);

    // Detect if decision
    const decision = this.detectDecision(text, type);

    // Extract actions locally
    const actions = this.extractActions(text);

    // Clean input locally
    const cleanedInput = this.cleanInput(text);

    return {
      // Phase 3b fields
      cleanedInput,
      title: this.generateTitle(text),
      actions,
      shareability: { ready: category === 'work', reason: category === 'work' ? 'Work-related content' : 'Personal content' },
      // Phase 3a fields
      summary,
      insight,
      question,
      type,
      category,
      patterns: { reinforced: [], new: [] },
      voice,
      entities,
      decision: { isDecision: decision.is_decision, type: null, options: decision.options || null },
      confidence: 0.5,
      related_notes: []
    };
  },

  /**
   * Clean input text - add punctuation and remove filler words
   */
  cleanInput(text) {
    const fillers = ['um', 'uh', 'like', 'you know', 'so yeah', 'basically', 'actually', 'literally', 'kind of', 'sort of'];
    let clean = text;
    fillers.forEach(f => {
      clean = clean.replace(new RegExp(`\\b${f}\\b`, 'gi'), '');
    });
    clean = clean.replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    // Add period if missing
    if (clean.length > 0 && !clean.match(/[.!?]$/)) {
      clean += '.';
    }

    return clean;
  },

  /**
   * Generate title from text
   */
  generateTitle(text) {
    const clean = this.cleanInput(text);
    const words = clean.split(' ').slice(0, 6);
    let title = words.join(' ');
    if (title.length > 40) {
      title = title.substring(0, 37) + '...';
    }
    return title.replace(/[.!?]$/, '');
  },

  /**
   * Extract action items from text
   */
  extractActions(text) {
    const actions = [];
    const patterns = [
      /need to ([^.!?]+)/gi,
      /should ([^.!?]+)/gi,
      /have to ([^.!?]+)/gi,
      /going to ([^.!?]+)/gi,
      /will ([^.!?]+)/gi,
      /must ([^.!?]+)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const action = match[1].trim();
        if (action.length > 3 && action.length < 100 && !actions.includes(action)) {
          actions.push(action.charAt(0).toUpperCase() + action.slice(1));
        }
      }
    });

    return actions.slice(0, 5);
  },

  /**
   * Detect note type
   */
  detectType(text) {
    const typeIndicators = {
      decision: ['deciding', 'decision', 'choose', 'should i', 'weighing', 'options', 'or should', 'versus', 'vs'],
      idea: ['idea', 'what if', 'maybe we could', 'imagine', 'concept', 'thinking about trying'],
      commitment: ['will', 'going to', 'committed', 'decided to', 'i\'m going to', 'starting'],
      reflection: ['realized', 'noticed', 'thinking about', 'reflecting', 'looking back', 'learned'],
      observation: [] // default
    };

    for (const [type, indicators] of Object.entries(typeIndicators)) {
      if (indicators.some(i => text.includes(i))) {
        return type;
      }
    }
    return 'observation';
  },

  /**
   * Detect category
   */
  detectCategory(text) {
    const categoryKeywords = {
      work: ['meeting', 'client', 'project', 'deadline', 'team', 'business', 'work', 'office', 'partnership'],
      health: ['gym', 'exercise', 'health', 'sleep', 'workout', 'tired', 'energy', 'doctor'],
      ideas: ['idea', 'thinking', 'what if', 'could', 'future', 'plan', 'experiment'],
      personal: ['family', 'friend', 'home', 'weekend', 'personal']
    };

    let maxScore = 0;
    let detectedCategory = 'personal';

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(k => text.includes(k)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedCategory = category;
      }
    }

    return detectedCategory;
  },

  /**
   * Generate clean summary
   */
  generateSummary(text) {
    // Clean filler words
    const fillers = ['um', 'uh', 'like', 'you know', 'so yeah', 'basically', 'actually', 'literally'];
    let clean = text;
    fillers.forEach(f => {
      clean = clean.replace(new RegExp(`\\b${f}\\b`, 'gi'), '');
    });
    clean = clean.replace(/\s+/g, ' ').trim();

    // Get first 2-3 sentences
    const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const summary = sentences.slice(0, 3).join('. ').trim();

    return summary.length > 0 ? summary + '.' : '';
  },

  /**
   * Generate insight based on content
   */
  generateInsight(text, type) {
    const lowerText = text.toLowerCase();

    // Type-based insights
    if (type === 'decision') {
      if (lowerText.includes('risk')) {
        return 'This involves weighing risk against opportunity.';
      }
      if (lowerText.includes('uncertain') || lowerText.includes('unsure')) {
        return 'Uncertainty is present. Consider what information would reduce it.';
      }
      return 'A decision is forming. Consider your key criteria.';
    }

    if (type === 'idea') {
      return 'New thinking captured. Worth exploring further.';
    }

    if (type === 'reflection') {
      return 'Reflection noted. These insights compound over time.';
    }

    if (type === 'commitment') {
      return 'Commitment logged. This creates forward momentum.';
    }

    // Default observation insight
    return 'Captured for future reference.';
  },

  /**
   * Generate question if relevant
   */
  generateQuestion(text, type) {
    if (type !== 'decision' && type !== 'idea') {
      return null;
    }

    const lowerText = text.toLowerCase();

    if (type === 'decision') {
      if (lowerText.includes('partner')) {
        return 'What would success look like in 12 months?';
      }
      if (lowerText.includes('risk')) {
        return 'What\'s the worst realistic downside?';
      }
      if (lowerText.includes('uncertain')) {
        return 'Who could give you clarity on this?';
      }
      return 'What\'s the key constraint here?';
    }

    if (type === 'idea') {
      return 'What\'s the smallest way to test this?';
    }

    return null;
  },

  /**
   * Analyze voice characteristics
   */
  analyzeVoice(text, inputType) {
    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Energy (exclamation marks, action words)
    const exclamations = (text.match(/!/g) || []).length;
    const actionWords = ['need', 'must', 'going to', 'will', 'excited'].filter(w => lowerText.includes(w)).length;
    const energy = Math.min(1, 0.5 + (exclamations * 0.1) + (actionWords * 0.1));

    // Certainty (confident vs uncertain language)
    const certainWords = ['definitely', 'certainly', 'absolutely', 'clearly', 'decided'].filter(w => lowerText.includes(w)).length;
    const uncertainWords = ['maybe', 'perhaps', 'might', 'not sure', 'wondering'].filter(w => lowerText.includes(w)).length;
    const certainty = Math.max(0, Math.min(1, 0.5 + (certainWords * 0.15) - (uncertainWords * 0.15)));

    // Pace (words per sentence)
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 10;
    let pace = 'measured';
    if (avgWordsPerSentence < 8) pace = 'fast';
    if (avgWordsPerSentence > 15) pace = 'slow';

    // Formality
    const casualWords = ['gonna', 'kinda', 'wanna', 'yeah', 'cool'].filter(w => lowerText.includes(w)).length;
    const formalWords = ['therefore', 'however', 'consequently', 'regarding'].filter(w => lowerText.includes(w)).length;
    const formality = Math.max(0, Math.min(1, 0.5 + (formalWords * 0.15) - (casualWords * 0.15)));

    return { energy, certainty, pace, formality };
  },

  /**
   * Extract entities from text
   */
  extractEntities(text) {
    const people = [];
    const projects = [];
    const topics = [];

    // Extract capitalized names (potential people)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const commonWords = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
      'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May',
      'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    let match;
    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      if (!commonWords.includes(name) && !people.includes(name)) {
        people.push(name);
      }
    }

    // Extract topics from keywords
    const topicKeywords = {
      'ai': 'AI',
      'machine learning': 'Machine Learning',
      'startup': 'Startups',
      'partnership': 'Partnerships',
      'market': 'Market Strategy',
      'product': 'Product',
      'investment': 'Investment'
    };

    const lowerText = text.toLowerCase();
    for (const [keyword, topic] of Object.entries(topicKeywords)) {
      if (lowerText.includes(keyword) && !topics.includes(topic)) {
        topics.push(topic);
      }
    }

    return { people, projects, topics };
  },

  /**
   * Detect if note is a decision
   */
  detectDecision(text, type) {
    if (type !== 'decision') {
      return { is_decision: false, status: null, options: [], deadline: null };
    }

    const lowerText = text.toLowerCase();

    // Detect status
    let status = 'deliberating';
    if (lowerText.includes('decided') || lowerText.includes('going with') || lowerText.includes('chose')) {
      status = 'committed';
    }
    if (lowerText.includes('done') || lowerText.includes('completed') || lowerText.includes('resolved')) {
      status = 'resolved';
    }

    // Extract options (look for "or" patterns)
    const options = [];
    const orMatch = text.match(/(?:either\s+)?(.+?)\s+or\s+(.+?)(?:[.,]|$)/i);
    if (orMatch) {
      options.push(orMatch[1].trim());
      options.push(orMatch[2].trim());
    }

    return {
      is_decision: true,
      status,
      options,
      deadline: null
    };
  },

  /**
   * Get empty analysis result (Phase 3b)
   */
  getEmptyAnalysis() {
    return {
      // Phase 3b fields
      cleanedInput: null,
      title: null,
      actions: [],
      shareability: { ready: false, reason: '' },
      // Phase 3a fields
      summary: '',
      insight: '',
      question: null,
      type: 'observation',
      category: 'personal',
      patterns: { reinforced: [], new: [] },
      voice: { energy: 0.5, certainty: 0.5, pace: 'measured', formality: 0.5 },
      entities: { people: [], projects: [], topics: [] },
      decision: { isDecision: false, type: null, options: null },
      confidence: 0,
      related_notes: []
    };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Analyzer = Analyzer;
}
