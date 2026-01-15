/**
 * Belief Extractor - Extracts opinions, values, and stances from notes
 * Tracks confidence levels and detects belief evolution over time
 */

/**
 * Phase 5C.2: Safe array spread helper
 * Returns empty array if input is not iterable
 * @param {*} arr - Value to convert to array
 * @returns {Array} Safe array
 */
function safeArray(arr) {
  if (Array.isArray(arr)) return arr;
  if (arr && typeof arr[Symbol.iterator] === 'function') return [...arr];
  return [];
}

const BeliefExtractor = {
  // Words that indicate strong opinions
  STRONG_INDICATORS: [
    'believe', 'think', 'feel', 'convinced', 'certain', 'definitely',
    'absolutely', 'clearly', 'obviously', 'undoubtedly', 'strongly',
    'always', 'never', 'must', 'should', 'need to', 'have to'
  ],

  // Words that indicate weaker/tentative opinions
  WEAK_INDICATORS: [
    'maybe', 'perhaps', 'might', 'could', 'possibly', 'not sure',
    'wonder', 'guess', 'suppose', 'seems', 'appears', 'somewhat'
  ],

  // Stance keywords
  STANCE_KEYWORDS: {
    bullish: ['excited', 'optimistic', 'bullish', 'promising', 'potential', 'opportunity', 'growth', 'future'],
    bearish: ['concerned', 'worried', 'pessimistic', 'bearish', 'declining', 'problem', 'risk', 'threat'],
    neutral: ['neutral', 'balanced', 'mixed', 'uncertain', 'depends']
  },

  // Value indicators
  VALUE_KEYWORDS: {
    transparency: ['transparent', 'transparency', 'honest', 'honesty', 'open', 'authentic'],
    speed: ['fast', 'quick', 'rapid', 'velocity', 'ship', 'move fast', 'iterate'],
    quality: ['quality', 'excellence', 'best', 'craft', 'premium', 'polish'],
    simplicity: ['simple', 'minimal', 'clean', 'less', 'focused', 'streamlined'],
    innovation: ['innovate', 'innovation', 'new', 'creative', 'novel', 'disrupt'],
    privacy: ['privacy', 'private', 'secure', 'security', 'encrypted', 'protected'],
    autonomy: ['independent', 'autonomy', 'freedom', 'control', 'own'],
    collaboration: ['team', 'together', 'collaborate', 'partnership', 'community']
  },

  /**
   * Extract beliefs from note text
   * @param {string} text - The note text to analyze
   * @param {Object} existingBeliefs - Existing beliefs for comparison
   * @returns {Object} Extracted beliefs
   */
  async extract(text, existingBeliefs = {}) {
    if (!text || text.trim().length < 20) {
      return { opinions: [], values: [], contrarian: [] };
    }

    try {
      // Try API first
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: 'beliefs' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.beliefs) {
          return this.processAPIBeliefs(data.beliefs, existingBeliefs);
        }
      }
    } catch (error) {
      console.log('[BeliefExtractor] API unavailable, using local extraction');
    }

    // Fallback to local extraction
    return this.localExtract(text, existingBeliefs);
  },

  /**
   * Process beliefs from API response
   */
  processAPIBeliefs(beliefs, existingBeliefs) {
    const result = {
      opinions: [],
      values: [],
      contrarian: []
    };

    // Process opinions
    if (beliefs.opinions) {
      for (const opinion of beliefs.opinions) {
        result.opinions.push({
          topic: opinion.topic,
          stance: opinion.stance || 'neutral',
          confidence: opinion.confidence || 0.5,
          reasoning: opinion.reasoning || opinion.quote || '',
          firstMentioned: new Date().toISOString(),
          mentions: 1
        });
      }
    }

    // Process values (ensure array)
    if (beliefs.values) {
      result.values = Array.isArray(beliefs.values) ? beliefs.values : [];
    }

    // Process contrarian views (ensure array)
    if (beliefs.contrarian) {
      result.contrarian = Array.isArray(beliefs.contrarian) ? beliefs.contrarian : [];
    }

    return result;
  },

  /**
   * Local belief extraction using pattern matching
   */
  localExtract(text, existingBeliefs) {
    const result = {
      opinions: [],
      values: [],
      contrarian: []
    };

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const lowerText = text.toLowerCase();

    // Extract opinions from opinionated sentences
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();

      // Check for opinion indicators
      const hasStrongIndicator = this.STRONG_INDICATORS.some(i => lowerSentence.includes(i));
      const hasWeakIndicator = this.WEAK_INDICATORS.some(i => lowerSentence.includes(i));

      if (hasStrongIndicator || hasWeakIndicator) {
        const stance = this.detectStance(lowerSentence);
        const topic = this.extractTopic(sentence);

        if (topic) {
          result.opinions.push({
            topic,
            stance,
            confidence: hasStrongIndicator ? 0.8 : 0.5,
            reasoning: sentence.trim(),
            firstMentioned: new Date().toISOString(),
            mentions: 1
          });
        }
      }

      // Detect contrarian views
      if (this.isContrarian(lowerSentence)) {
        result.contrarian.push(sentence.trim());
      }
    }

    // Extract values
    for (const [value, keywords] of Object.entries(this.VALUE_KEYWORDS)) {
      if (keywords.some(k => lowerText.includes(k))) {
        if (!result.values.includes(value)) {
          result.values.push(value);
        }
      }
    }

    return result;
  },

  /**
   * Detect stance from text
   */
  detectStance(text) {
    for (const [stance, keywords] of Object.entries(this.STANCE_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        return stance;
      }
    }
    return 'neutral';
  },

  /**
   * Extract topic from opinion sentence
   */
  extractTopic(sentence) {
    // Look for "about X", "on X", "regarding X" patterns
    const patterns = [
      /(?:about|on|regarding|towards?|for)\s+([^,.\n]+)/i,
      /(?:think|believe|feel)\s+(?:that\s+)?([^,.\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match && match[1]) {
        // Clean up the topic
        let topic = match[1].trim();
        // Remove common articles
        topic = topic.replace(/^(the|a|an)\s+/i, '');
        // Limit length
        if (topic.length > 50) {
          topic = topic.substring(0, 50).trim() + '...';
        }
        return topic;
      }
    }

    return null;
  },

  /**
   * Check if statement is contrarian
   */
  isContrarian(text) {
    const contraryIndicators = [
      'most people think',
      'everyone says',
      'conventional wisdom',
      'unpopular opinion',
      'hot take',
      'contrary to',
      'despite what',
      'actually, ',
      'the truth is',
      "here's the thing",
      'nobody talks about',
      'overlooked',
      'underrated',
      'overrated'
    ];

    return contraryIndicators.some(i => text.includes(i));
  },

  /**
   * Merge beliefs with existing ones, detecting evolution
   * Phase 5C.2: Uses safeArray() helper for spread safety
   */
  mergeBeliefs(existing, incoming) {
    // Ensure all inputs are objects with array properties
    existing = existing || {};
    incoming = incoming || {};

    const merged = {
      opinions: [...safeArray(existing.opinions)],
      values: [...new Set([...safeArray(existing.values), ...safeArray(incoming.values)])],
      contrarian: [...new Set([...safeArray(existing.contrarian), ...safeArray(incoming.contrarian)])],
      evolving: [...safeArray(existing.evolving)]
    };

    // Merge opinions, checking for changes
    for (const opinion of incoming.opinions || []) {
      const existingIndex = merged.opinions.findIndex(o =>
        o.topic.toLowerCase() === opinion.topic.toLowerCase()
      );

      if (existingIndex >= 0) {
        const existingOpinion = merged.opinions[existingIndex];

        // Check for stance change
        if (existingOpinion.stance !== opinion.stance) {
          merged.evolving.push({
            topic: opinion.topic,
            from: existingOpinion.stance,
            to: opinion.stance,
            date: new Date().toISOString()
          });
        }

        // Update opinion
        merged.opinions[existingIndex] = {
          ...existingOpinion,
          stance: opinion.stance,
          confidence: Math.max(existingOpinion.confidence, opinion.confidence),
          mentions: (existingOpinion.mentions || 1) + 1,
          lastMentioned: new Date().toISOString()
        };
      } else {
        merged.opinions.push(opinion);
      }
    }

    return merged;
  },

  /**
   * Get belief statistics
   */
  getStats(beliefs) {
    const stanceCounts = { bullish: 0, bearish: 0, neutral: 0 };

    for (const opinion of beliefs.opinions || []) {
      if (stanceCounts[opinion.stance] !== undefined) {
        stanceCounts[opinion.stance]++;
      }
    }

    return {
      totalOpinions: beliefs.opinions?.length || 0,
      totalValues: beliefs.values?.length || 0,
      totalContrarian: beliefs.contrarian?.length || 0,
      stanceDistribution: stanceCounts,
      hasEvolved: (beliefs.evolving?.length || 0) > 0
    };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BeliefExtractor = BeliefExtractor;
}
