/**
 * Inscript - Classifier Module
 * 4-category classification using keywords from CLAUDE.md section 5
 */

// EXACT keyword lists from CLAUDE.md section 5.2
const KEYWORDS = {
  personal: [
    'family', 'mom', 'dad', 'friend', 'home', 'weekend', 'dinner',
    'birthday', 'movie', 'relationship', 'kids', 'wife', 'husband',
    'girlfriend', 'boyfriend', 'pet', 'dog', 'cat', 'holiday', 'trip',
    'vacation', 'wedding', 'party', 'personal', 'life'
  ],

  work: [
    'velolume', 'meeting', 'client', 'investor', 'revenue', 'deadline',
    'project', 'team', 'business', 'partnership', 'pitch', 'proposal',
    'hire', 'demo', 'trust', 'spv', 'jv', 'strategy', 'product', 'api',
    'launch', 'startup', 'funding', 'sales', 'marketing', 'ceo', 'cto',
    'interview', 'presentation', 'deck', 'roadmap', 'sprint'
  ],

  health: [
    'gym', 'exercise', 'health', 'sleep', 'meditation', 'doctor',
    'dentist', 'workout', 'fitness', 'stress', 'energy', 'tired',
    'sick', 'mental', 'therapy', 'wellness', 'run', 'yoga', 'weight',
    'diet', 'nutrition', 'water', 'steps', 'walk', 'rest'
  ],

  ideas: [
    'idea', 'thinking', 'maybe', 'could', 'future', 'plan', 'vision',
    'opportunity', 'experiment', 'hypothesis', 'explore', 'brainstorm',
    'innovation', 'concept', 'possibility', 'what if', 'wonder',
    'imagine', 'potential', 'theory'
  ]
};

/**
 * Classify text into one of four categories
 * @param {string} text - Text to classify
 * @returns {{category: string, confidence: number, reasoning: string}}
 */
function classify(text) {
  // Handle null/undefined/empty input
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      category: 'personal',
      confidence: 0.5,
      reasoning: 'No text provided, defaulting to personal'
    };
  }

  const lower = text.toLowerCase();

  // Count keyword matches per category
  const scores = {};
  const matchedKeywords = {};

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    const matches = keywords.filter(kw => lower.includes(kw));
    scores[category] = matches.length;
    matchedKeywords[category] = matches;
  }

  // Find highest score
  const max = Math.max(...Object.values(scores));

  // Default to personal if no matches
  if (max === 0) {
    return {
      category: 'personal',
      confidence: 0.5,
      reasoning: 'No keywords matched, defaulting to personal'
    };
  }

  // Get winning category (first one with max score in case of tie)
  const category = Object.keys(scores).find(k => scores[k] === max);

  // Calculate confidence
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.round((max / total) * 100) / 100;

  // Build reasoning
  const matched = matchedKeywords[category];
  const reasoning = `Matched ${max} ${category} keyword${max !== 1 ? 's' : ''}: ${matched.join(', ')}`;

  return {
    category,
    confidence,
    reasoning
  };
}

// Export for global access
window.Classifier = {
  classify,
  KEYWORDS
};
