/**
 * Pattern Detector - Analyzes temporal, behavioral, and emotional patterns
 * Tracks when user is most creative, productive, and their behavioral tendencies
 */

const PatternDetector = {
  // Emotional indicators
  EMOTIONAL_INDICATORS: {
    stress: [
      'stressed', 'overwhelmed', 'anxious', 'worried', 'deadline',
      'urgent', 'asap', 'behind', 'struggling', 'difficult', 'frustrated'
    ],
    excitement: [
      'excited', 'amazing', 'awesome', 'great', 'love', 'fantastic',
      'incredible', 'breakthrough', 'finally', 'can\'t wait', 'pumped'
    ],
    reflective: [
      'thinking about', 'realized', 'noticed', 'wondering', 'reflecting',
      'looking back', 'considering', 'pondering', 'insight'
    ],
    productive: [
      'done', 'completed', 'finished', 'shipped', 'launched', 'built',
      'created', 'accomplished', 'achieved', 'delivered'
    ]
  },

  // Category keywords for distribution tracking
  CATEGORY_KEYWORDS: {
    work: ['meeting', 'client', 'project', 'deadline', 'team', 'product', 'business'],
    personal: ['family', 'friend', 'home', 'weekend', 'dinner', 'trip'],
    health: ['gym', 'workout', 'sleep', 'exercise', 'tired', 'energy'],
    ideas: ['idea', 'thinking', 'maybe', 'could', 'what if', 'imagine']
  },

  /**
   * Analyze patterns from a single note
   * @param {Object} note - The note to analyze
   * @returns {Object} Pattern data from this note
   */
  analyzeNote(note) {
    const patterns = {
      temporal: this.extractTemporalPatterns(note),
      behavioral: this.extractBehavioralPatterns(note),
      emotional: this.extractEmotionalPatterns(note)
    };

    return patterns;
  },

  /**
   * Extract temporal patterns from note timestamp
   */
  extractTemporalPatterns(note) {
    const timestamp = note.timestamps?.created_at || note.created_at;
    if (!timestamp) return {};

    const date = new Date(timestamp);
    const hour = date.getHours();
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

    // Determine time of day category
    let timeOfDay;
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return {
      hour,
      dayOfWeek: dayName,
      timeOfDay,
      date: date.toISOString().split('T')[0]
    };
  },

  /**
   * Extract behavioral patterns from note content
   */
  extractBehavioralPatterns(note) {
    const text = (note.input?.raw_text || note.text || '').toLowerCase();
    const inputType = note.input?.type || 'text';

    // Detect category
    let category = note.classification?.category || 'personal';

    // Calculate session length approximation
    const wordCount = text.split(/\s+/).length;
    let sessionLength = 'short';
    if (wordCount > 200) sessionLength = 'long';
    else if (wordCount > 75) sessionLength = 'medium';

    return {
      category,
      inputType,
      wordCount,
      sessionLength,
      hasActionItems: this.hasActionItems(text),
      hasQuestions: /\?/.test(text)
    };
  },

  /**
   * Extract emotional patterns from note content
   */
  extractEmotionalPatterns(note) {
    const text = (note.input?.raw_text || note.text || '').toLowerCase();
    const result = {
      indicators: [],
      sentiment: note.extracted?.sentiment || 'neutral',
      energy: 0.5
    };

    // Check for emotional indicators
    for (const [emotion, keywords] of Object.entries(this.EMOTIONAL_INDICATORS)) {
      const matches = keywords.filter(k => text.includes(k));
      if (matches.length > 0) {
        result.indicators.push({
          type: emotion,
          matches: matches.length,
          keywords: matches
        });
      }
    }

    // Calculate energy level based on indicators
    const excitementCount = result.indicators.find(i => i.type === 'excitement')?.matches || 0;
    const stressCount = result.indicators.find(i => i.type === 'stress')?.matches || 0;
    const productiveCount = result.indicators.find(i => i.type === 'productive')?.matches || 0;

    result.energy = Math.min(1, 0.5 + (excitementCount * 0.1) + (productiveCount * 0.1) - (stressCount * 0.05));

    return result;
  },

  /**
   * Check if text contains action items
   */
  hasActionItems(text) {
    const actionPatterns = [
      /need to/i, /should/i, /must/i, /have to/i,
      /going to/i, /will/i, /todo/i, /reminder/i,
      /don't forget/i, /remember to/i
    ];
    return actionPatterns.some(p => p.test(text));
  },

  /**
   * Aggregate patterns from multiple notes
   * @param {Array} notes - All notes to analyze
   * @returns {Object} Aggregated patterns
   */
  aggregatePatterns(notes) {
    if (!notes || notes.length === 0) {
      return this.getEmptyPatterns();
    }

    const hourCounts = {};
    const dayCounts = {};
    const categoryCounts = {};
    const inputCounts = { text: 0, voice: 0, image: 0 };
    const emotions = [];

    for (const note of notes) {
      const patterns = this.analyzeNote(note);

      // Temporal
      if (patterns.temporal.hour !== undefined) {
        const hourKey = patterns.temporal.hour.toString();
        hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1;
      }
      if (patterns.temporal.dayOfWeek) {
        dayCounts[patterns.temporal.dayOfWeek] = (dayCounts[patterns.temporal.dayOfWeek] || 0) + 1;
      }

      // Behavioral
      if (patterns.behavioral.category) {
        categoryCounts[patterns.behavioral.category] =
          (categoryCounts[patterns.behavioral.category] || 0) + 1;
      }
      if (patterns.behavioral.inputType) {
        inputCounts[patterns.behavioral.inputType] =
          (inputCounts[patterns.behavioral.inputType] || 0) + 1;
      }

      // Emotional
      emotions.push(patterns.emotional);
    }

    // Calculate aggregates
    const totalNotes = notes.length;

    return {
      temporal: {
        mostCreative: this.findMostCreativeTime(hourCounts, notes),
        mostReflective: this.findMostReflectiveTime(hourCounts),
        mostProductive: this.findMostProductiveDays(dayCounts),
        captureFrequency: {
          daily: this.calculateDailyFrequency(notes),
          byHour: this.normalizeDistribution(hourCounts),
          byDay: this.normalizeDistribution(dayCounts)
        }
      },
      behavioral: {
        topicDistribution: this.normalizeDistribution(categoryCounts),
        inputPreference: this.normalizeDistribution(inputCounts),
        sessionLength: this.calculateAverageSessionLength(notes)
      },
      emotional: {
        baselineEnergy: this.calculateAverageEnergy(emotions),
        stressIndicators: this.collectTopIndicators(emotions, 'stress'),
        excitementIndicators: this.collectTopIndicators(emotions, 'excitement')
      }
    };
  },

  /**
   * Find most creative time based on idea notes
   */
  findMostCreativeTime(hourCounts, notes) {
    // Filter for idea/creative notes
    const ideaNotes = notes.filter(n =>
      n.classification?.category === 'ideas' ||
      (n.input?.raw_text || '').toLowerCase().includes('idea')
    );

    if (ideaNotes.length < 3) {
      // Not enough data, use overall peak
      const peakHour = this.findPeakHour(hourCounts);
      return peakHour ? { start: `${peakHour}:00`, end: `${peakHour + 2}:00` } : null;
    }

    const ideaHours = {};
    for (const note of ideaNotes) {
      const hour = new Date(note.timestamps?.created_at || note.created_at).getHours();
      ideaHours[hour] = (ideaHours[hour] || 0) + 1;
    }

    const peakHour = this.findPeakHour(ideaHours);
    return peakHour ? { start: `${peakHour}:00`, end: `${(peakHour + 2) % 24}:00` } : null;
  },

  /**
   * Find most reflective time (evening typically)
   */
  findMostReflectiveTime(hourCounts) {
    // Check for evening patterns (17-22)
    let eveningTotal = 0;
    for (let h = 17; h <= 22; h++) {
      eveningTotal += hourCounts[h] || 0;
    }

    let morningTotal = 0;
    for (let h = 6; h <= 10; h++) {
      morningTotal += hourCounts[h] || 0;
    }

    if (eveningTotal > morningTotal * 1.2) return 'evening';
    if (morningTotal > eveningTotal * 1.2) return 'morning';
    return 'mixed';
  },

  /**
   * Find most productive days
   */
  findMostProductiveDays(dayCounts) {
    const sorted = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => day);

    return sorted;
  },

  /**
   * Find peak hour from distribution
   */
  findPeakHour(hourCounts) {
    let maxCount = 0;
    let peakHour = null;

    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    }

    return peakHour;
  },

  /**
   * Calculate daily frequency
   */
  calculateDailyFrequency(notes) {
    if (notes.length === 0) return 0;

    const dates = notes.map(n =>
      new Date(n.timestamps?.created_at || n.created_at).toISOString().split('T')[0]
    );
    const uniqueDates = [...new Set(dates)];

    return Math.round((notes.length / Math.max(uniqueDates.length, 1)) * 10) / 10;
  },

  /**
   * Normalize distribution to percentages
   */
  normalizeDistribution(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return counts;

    const normalized = {};
    for (const [key, value] of Object.entries(counts)) {
      normalized[key] = Math.round((value / total) * 100) / 100;
    }
    return normalized;
  },

  /**
   * Calculate average session length
   */
  calculateAverageSessionLength(notes) {
    if (notes.length === 0) return 'short';

    const lengths = { short: 0, medium: 0, long: 0 };
    for (const note of notes) {
      const text = note.input?.raw_text || note.text || '';
      const wordCount = text.split(/\s+/).length;

      if (wordCount > 200) lengths.long++;
      else if (wordCount > 75) lengths.medium++;
      else lengths.short++;
    }

    const max = Math.max(lengths.short, lengths.medium, lengths.long);
    if (max === lengths.long) return 'long';
    if (max === lengths.medium) return 'medium';
    return 'short';
  },

  /**
   * Calculate average energy level
   */
  calculateAverageEnergy(emotions) {
    if (emotions.length === 0) return 0.5;

    const total = emotions.reduce((sum, e) => sum + (e.energy || 0.5), 0);
    return Math.round((total / emotions.length) * 100) / 100;
  },

  /**
   * Collect top emotional indicators
   */
  collectTopIndicators(emotions, type) {
    const allKeywords = [];
    for (const emotion of emotions) {
      const indicator = emotion.indicators?.find(i => i.type === type);
      if (indicator?.keywords) {
        allKeywords.push(...indicator.keywords);
      }
    }

    // Count and sort
    const counts = {};
    for (const kw of allKeywords) {
      counts[kw] = (counts[kw] || 0) + 1;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);
  },

  /**
   * Get empty patterns structure
   */
  getEmptyPatterns() {
    return {
      temporal: {
        mostCreative: null,
        mostReflective: null,
        mostProductive: [],
        captureFrequency: { daily: 0, byHour: {}, byDay: {} }
      },
      behavioral: {
        topicDistribution: {},
        inputPreference: { text: 0, voice: 0, image: 0 },
        sessionLength: 'short'
      },
      emotional: {
        baselineEnergy: 0.5,
        stressIndicators: [],
        excitementIndicators: []
      }
    };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PatternDetector = PatternDetector;
}
