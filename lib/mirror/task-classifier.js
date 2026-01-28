/**
 * Task Classifier
 *
 * Classifies user messages into task types for context selection.
 * Part of RAG 2.0 — task-aware context loading.
 *
 * OWNER: T2
 * CONSUMERS: api/mirror.js, context-loader.js
 */

const TASK_PATTERNS = {
  entity_recall: [
    /what do you know about/i,
    /tell me about/i,
    /who is/i,
    /what is (.+)'s/i,
    /remind me about/i,
    /what have I said about/i,
    /what have you learned about/i,
    /remind me who/i
  ],

  decision: [
    /should I/i,
    /help me decide/i,
    /what do you think about/i,
    /pros and cons/i,
    /weighing/i,
    /considering/i,
    /torn between/i,
    /which (?:should|would)/i,
    /advice on/i
  ],

  emotional: [
    /I('m| am) (feeling|stressed|anxious|worried|excited|nervous|overwhelmed)/i,
    /feeling (stressed|anxious|worried|excited|nervous|overwhelmed|happy|sad|frustrated|angry|scared)/i,
    /I('m| am) (happy|sad|frustrated|angry|scared)/i,
    /this is hard/i,
    /struggling with/i,
    /I('m| am) having a hard time/i,
    /need to vent/i,
    /frustrated about/i
  ],

  research: [
    /^research\s+/i,
    /deep dive/i,
    /explore my thinking/i,
    /what patterns/i,
    /analyze my/i,
    /synthesis of/i,
    /tell me everything/i,
    /what have I thought about/i
  ],

  thinking_partner: [
    /I('m| am) thinking about/i,
    /help me think through/i,
    /brainstorm/i,
    /let's explore/i,
    /I('ve| have) been pondering/i,
    /what if/i,
    /work through/i,
    /think out loud/i,
    /help me process/i
  ],

  factual: [
    /when did/i,
    /where does/i,
    /what is the/i,
    /how many/i,
    /what date/i,
    /what time/i,
    /where is/i,
    /when was/i,
    /how long/i
  ]
};

/**
 * Classify user message into task type
 * @param {string} message - User's message
 * @returns {string} Task type
 */
export function classifyTask(message) {
  if (!message || typeof message !== 'string') {
    return 'general';
  }

  for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return taskType;
      }
    }
  }
  return 'general';
}

/**
 * Extract entities mentioned in message
 * @param {string} message - User's message
 * @returns {string[]} Entity names mentioned
 */
export function extractMentionedEntities(message) {
  if (!message || typeof message !== 'string') {
    return [];
  }

  const entities = [];

  // Pattern: "about [Name]"
  const aboutPattern = /about\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  let match;
  while ((match = aboutPattern.exec(message)) !== null) {
    entities.push(match[1]);
  }

  // Pattern: "[Name]'s"
  const possessivePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s/g;
  while ((match = possessivePattern.exec(message)) !== null) {
    entities.push(match[1]);
  }

  // Pattern: "with [Name]"
  const withPattern = /with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  while ((match = withPattern.exec(message)) !== null) {
    entities.push(match[1]);
  }

  // Pattern: "ask [Name]", "tell [Name]", "called [Name]"
  const actionPattern = /(?:ask|tell|called|meet|meeting|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
  while ((match = actionPattern.exec(message)) !== null) {
    const name = match[1];
    // Filter out common non-name words
    const commonWords = ['I', 'The', 'This', 'That', 'What', 'When', 'Where', 'Why', 'How', 'Should', 'Can', 'Could', 'Would', 'Me', 'You', 'It', 'My'];
    if (!commonWords.includes(name)) {
      entities.push(name);
    }
  }

  // Pattern: standalone capitalized names (not at sentence start)
  // Look for names after common prepositions or in middle of sentence
  const midSentencePattern = /(?<=[,;]\s*|\sand\s|\sor\s|\sbut\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  while ((match = midSentencePattern.exec(message)) !== null) {
    const name = match[1];
    const commonWords = ['I', 'The', 'This', 'That', 'What', 'When', 'Where', 'Why', 'How', 'Should', 'Can', 'Could', 'Would'];
    if (!commonWords.includes(name)) {
      entities.push(name);
    }
  }

  // Dedupe
  return [...new Set(entities)];
}

/**
 * Extract topic keywords
 * @param {string} message - User's message
 * @returns {string[]} Topic keywords
 */
export function extractTopics(message) {
  if (!message || typeof message !== 'string') {
    return [];
  }

  const stopWords = new Set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'as', 'of', 'at',
    'by', 'for', 'with', 'about', 'to', 'from', 'in', 'on', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
    'what', 'when', 'where', 'why', 'how', 'which', 'who', 'whom',
    'this', 'that', 'these', 'those', 'am', 'im', "i'm", 'think', 'know',
    'tell', 'help', 'please', 'want', 'need', 'like', 'just', 'really',
    'very', 'much', 'more', 'most', 'some', 'any', 'all', 'both', 'each',
    'few', 'many', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'also', 'now', 'here', 'there', 'new', 'old',
    'high', 'low', 'good', 'bad', 'great', 'small', 'large', 'long', 'short',
    'young', 'first', 'last', 'next', 'other', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
    'once', 'always', 'never', 'ever', 'still', 'already', 'even', 'way'
  ]);

  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Get task type display name
 * @param {string} taskType
 * @returns {string} Human-readable label
 */
export function getTaskTypeLabel(taskType) {
  const labels = {
    entity_recall: 'Recalling information',
    decision: 'Decision support',
    emotional: 'Emotional support',
    research: 'Deep research',
    thinking_partner: 'Thinking partner',
    factual: 'Factual lookup',
    general: 'General assistance'
  };
  return labels[taskType] || 'General assistance';
}

/**
 * Get all available task types
 * @returns {string[]}
 */
export function getTaskTypes() {
  return [...Object.keys(TASK_PATTERNS), 'general'];
}
