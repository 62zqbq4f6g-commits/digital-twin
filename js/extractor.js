/**
 * Inscript - Extractor Module
 * Extract metadata following rules from CLAUDE.md section 8
 */

// Filler words to remove (from CLAUDE.md 7.5)
const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'so yeah', 'basically',
  'actually', 'literally', 'kind of', 'sort of', 'i mean',
  'right', 'okay so', 'well'
];

// Action triggers (from CLAUDE.md 8.2)
const ACTION_TRIGGERS = [
  /need to ([^.!?]+)/gi,
  /should ([^.!?]+)/gi,
  /must ([^.!?]+)/gi,
  /have to ([^.!?]+)/gi,
  /remember to ([^.!?]+)/gi,
  /don't forget (?:to )?([^.!?]+)/gi,
  /going to ([^.!?]+)/gi,
  /want to ([^.!?]+)/gi,
  /will ([^.!?]+)/gi
];

const FALSE_POSITIVES = ['used to', 'supposed to', 'want to know', 'want to see'];

// Non-actionable phrases - feelings, states, internal experiences (not tasks)
// These are things you can't check off a todo list
const NON_ACTIONABLE_STARTS = [
  // State verbs (being in a state is not a task)
  'stay ', 'be ', 'feel ', 'keep ', 'remain ',
  // Mental/emotional states
  'relax', 'calm down', 'focus', 'sleep', 'rest', 'breathe',
  'think about it', 'remember that', 'know that', 'believe',
  // Vague intentions (not specific actionable tasks)
  'do something', 'figure it out', 'deal with it', 'work on it',
  'handle it', 'take care of it', 'sort it out'
];

// Non-actionable endings - states/feelings you want to achieve
const NON_ACTIONABLE_ENDS = [
  'awake', 'asleep', 'happy', 'sad', 'calm', 'relaxed',
  'better', 'worse', 'okay', 'fine', 'good', 'bad',
  'positive', 'negative', 'motivated', 'energized', 'tired',
  'focused', 'productive', 'healthy', 'strong', 'confident'
];

/**
 * Check if an action is actually an actionable task
 * Filters out feelings, states, and vague intentions
 */
function isActionable(action) {
  const lower = action.toLowerCase().trim();

  // Filter non-actionable starts
  for (const start of NON_ACTIONABLE_STARTS) {
    if (lower.startsWith(start)) {
      return false;
    }
  }

  // Filter non-actionable endings
  for (const end of NON_ACTIONABLE_ENDS) {
    if (lower.endsWith(end) || lower.endsWith(end + '.') || lower.endsWith(end + '!')) {
      return false;
    }
  }

  // Too short to be a real action
  if (lower.split(' ').length < 2) {
    return false;
  }

  return true;
}

// Sentiment words (from CLAUDE.md 8.3)
const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
  'happy', 'excited', 'love', 'awesome', 'perfect', 'best',
  'well', 'positive', 'success', 'productive', 'energized'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'stressed', 'worried',
  'anxious', 'frustrated', 'difficult', 'hard', 'problem', 'issue',
  'tired', 'exhausted', 'sick', 'pain', 'fail', 'negative'
];

// Common words to filter from people extraction (from CLAUDE.md 8.4)
const COMMON_WORDS = [
  'I', 'The', 'This', 'That', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February',
  'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'Today', 'Tomorrow', 'Yesterday'
];

/**
 * Clean text by removing filler words
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';

  let cleaned = text;
  FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  // Remove extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Generate title from text
 * @param {string} text - Raw text
 * @returns {string} Title (max 50 chars)
 */
function generateTitle(text) {
  if (!text || text.trim() === '') {
    return 'Untitled Note';
  }

  // Get first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();

  // Clean filler words
  let title = cleanText(firstSentence);

  // Truncate to 50 chars at word boundary
  if (title.length > 50) {
    title = title.substring(0, 47).replace(/\s+\S*$/, '') + '...';
  }

  // Fallback
  if (!title || title.length < 3) {
    title = 'Untitled Note';
  }

  return title;
}

/**
 * Extract topics (matched category names)
 * @param {string} text - Raw text
 * @returns {string[]} Array of topics (max 5)
 */
function extractTopics(text) {
  if (!text) return [];

  const topics = [];
  const lower = text.toLowerCase();

  // Check which categories have keyword matches
  if (Classifier && Classifier.KEYWORDS) {
    for (const [category, keywords] of Object.entries(Classifier.KEYWORDS)) {
      const hasMatch = keywords.some(kw => lower.includes(kw));
      if (hasMatch && !topics.includes(category)) {
        topics.push(category);
      }
    }
  }

  return topics.slice(0, 5);
}

/**
 * Extract action items from text
 * @param {string} text - Raw text
 * @returns {string[]} Array of action items
 */
function extractActions(text) {
  if (!text) return [];

  const actions = [];

  ACTION_TRIGGERS.forEach(regex => {
    // Reset regex lastIndex
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const action = match[1].trim();
      // Filter false positives
      const isFalsePositive = FALSE_POSITIVES.some(fp =>
        match[0].toLowerCase().includes(fp)
      );
      // Filter non-actionable items (feelings, states, vague intentions)
      if (!isFalsePositive && action.length > 3 && isActionable(action)) {
        const cleanedAction = action.charAt(0).toUpperCase() + action.slice(1);
        if (!actions.includes(cleanedAction)) {
          actions.push(cleanedAction);
        }
      }
    }
  });

  return actions;
}

/**
 * Analyze sentiment of text
 * @param {string} text - Raw text
 * @returns {'positive'|'negative'|'neutral'} Sentiment
 */
function analyzeSentiment(text) {
  if (!text) return 'neutral';

  const lower = text.toLowerCase();
  const positiveCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const negativeCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Extract people names from text
 * @param {string} text - Raw text
 * @returns {string[]} Array of names
 */
function extractPeople(text) {
  if (!text) return [];

  // Find capitalized words that might be names
  const words = text.match(/\b[A-Z][a-z]+\b/g) || [];

  // Filter common words
  const people = words.filter(word => !COMMON_WORDS.includes(word));

  return [...new Set(people)]; // Remove duplicates
}

/**
 * Extract all metadata from text
 * @param {string} text - Raw text to extract from
 * @returns {{title: string, topics: string[], action_items: string[], sentiment: string, people: string[]}}
 */
function extract(text) {
  // Handle empty input
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      title: 'Untitled Note',
      topics: [],
      action_items: [],
      sentiment: 'neutral',
      people: []
    };
  }

  return {
    title: generateTitle(text),
    topics: extractTopics(text),
    action_items: extractActions(text),
    sentiment: analyzeSentiment(text),
    people: extractPeople(text)
  };
}

// Export for global access
window.Extractor = {
  extract,
  cleanText,
  generateTitle,
  extractTopics,
  extractActions,
  analyzeSentiment,
  extractPeople,
  FILLER_WORDS,
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  COMMON_WORDS
};
