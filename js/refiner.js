/**
 * Digital Twin - Refiner Module
 * Transform raw input into professional output using EXACT templates from CLAUDE.md section 7
 */

// Category icons
const CATEGORY_ICONS = {
  personal: '🏠',
  work: '💼',
  health: '💪',
  ideas: '💡'
};

// Category labels
const CATEGORY_LABELS = {
  personal: 'Personal',
  work: 'Work',
  health: 'Health',
  ideas: 'Idea'
};

/**
 * Format timestamp for display
 * @param {Date} date - Date object
 * @returns {{dateStr: string, timeStr: string, dayStr: string}}
 */
function formatTimestamp(date = new Date()) {
  const options = { timeZone: 'Asia/Singapore' };

  // Day of week
  const dayStr = date.toLocaleDateString('en-US', { ...options, weekday: 'long' });

  // Month name
  const month = date.toLocaleDateString('en-US', { ...options, month: 'long' });

  // Day number
  const day = date.toLocaleDateString('en-US', { ...options, day: 'numeric' });

  // Year
  const year = date.toLocaleDateString('en-US', { ...options, year: 'numeric' });

  // Time (12-hour format)
  const time = date.toLocaleTimeString('en-US', {
    ...options,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return {
    dateStr: `${dayStr}, ${month} ${day}, ${year}`,
    timeStr: `${time} SGT`,
    dayStr
  };
}

/**
 * Generate professional summary from raw text
 * @param {string} rawText - Raw input text
 * @param {string} category - Category of note
 * @returns {string} 2-3 sentence professional summary
 */
function generateSummary(rawText, category) {
  if (!rawText) return '';

  // Clean filler words using Extractor if available
  let cleaned = rawText;
  if (Extractor && Extractor.cleanText) {
    cleaned = Extractor.cleanText(rawText);
  }

  // Split into sentences
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Take first 2-3 sentences
  const summaryParts = sentences.slice(0, 3).map(s => s.trim());

  // Join and ensure proper ending
  let summary = summaryParts.join('. ');
  if (summary && !summary.match(/[.!?]$/)) {
    summary += '.';
  }

  return summary;
}

/**
 * Format action items with checkbox
 * @param {string[]} actions - Array of action items
 * @returns {string} Formatted action items with ☐
 */
function formatActionItems(actions) {
  if (!actions || actions.length === 0) return '';
  return actions.map(a => `☐ ${a}`).join('\n');
}

/**
 * Format people list
 * @param {string[]} people - Array of names
 * @returns {string} Formatted people list
 */
function formatPeople(people) {
  if (!people || people.length === 0) return '';
  return people.map(p => `• ${p}`).join('\n');
}

/**
 * Work template (CLAUDE.md 7.1)
 */
function workTemplate(title, timestamp, summary, extracted) {
  const { dateStr, timeStr } = timestamp;
  const keyPoints = extracted.action_items?.slice(0, 4) || [];
  const actionItems = extracted.action_items || [];
  const people = extracted.people || [];

  let output = `# ${title}

**${dateStr}**
**${timeStr}**
**💼 Work**

---

## Summary

${summary}

---

## Key Points

${keyPoints.length > 0 ? keyPoints.map(p => `• ${p}`).join('\n') : '• No key points extracted'}

---

## Action Items

${actionItems.length > 0 ? formatActionItems(actionItems) : '☐ No action items'}

---`;

  if (people.length > 0) {
    output += `

## People Mentioned

${formatPeople(people)}

---`;
  }

  output += `

*Captured by Digital Twin*`;

  return output;
}

/**
 * Personal template (CLAUDE.md 7.2)
 */
function personalTemplate(title, timestamp, summary, extracted) {
  const { dateStr, timeStr } = timestamp;
  const reminders = extracted.action_items || [];

  let output = `# ${title}

**${dateStr}**
**${timeStr}**
**🏠 Personal**

---

${summary}

---`;

  if (reminders.length > 0) {
    output += `

## Reminders

${formatActionItems(reminders)}

---`;
  }

  output += `

*Captured by Digital Twin*`;

  return output;
}

/**
 * Health template (CLAUDE.md 7.3)
 */
function healthTemplate(title, timestamp, summary, extracted) {
  const { dateStr, timeStr } = timestamp;
  const sentiment = extracted.sentiment || 'neutral';
  const sentimentLabel = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  const reminders = extracted.action_items || [];

  let output = `# ${title}

**${dateStr}**
**${timeStr}**
**💪 Health**

---

## Check-in

${summary}

---

## Mood

${sentimentLabel}

---`;

  if (reminders.length > 0) {
    output += `

## Reminders

${formatActionItems(reminders)}

---`;
  }

  output += `

*Captured by Digital Twin*`;

  return output;
}

/**
 * Ideas template (CLAUDE.md 7.4)
 */
function ideasTemplate(title, timestamp, summary, extracted) {
  const { dateStr, timeStr } = timestamp;
  const nextSteps = extracted.action_items || [];

  // Split summary into concept and potential
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const concept = sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : '');
  const potential = sentences.slice(2).join('. ') + (sentences.length > 2 ? '.' : '');

  let output = `# ${title}

**${dateStr}**
**${timeStr}**
**💡 Idea**

---

## Concept

${concept || summary}

---`;

  if (potential) {
    output += `

## Potential

${potential}

---`;
  }

  if (nextSteps.length > 0) {
    output += `

## Next Steps

${formatActionItems(nextSteps)}

---`;
  } else {
    output += `

## Next Steps

☐ Explore this idea further

---`;
  }

  output += `

*Captured by Digital Twin*`;

  return output;
}

/**
 * Refine raw text into professional output
 * @param {string} rawText - Raw input text
 * @param {{category: string, confidence: number, reasoning: string}} classification - Classification result
 * @param {{title: string, topics: string[], action_items: string[], sentiment: string, people: string[]}} extracted - Extracted metadata
 * @returns {{summary: string, formatted_output: string}}
 */
function refine(rawText, classification, extracted) {
  // Handle empty input
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
    return {
      summary: '',
      formatted_output: ''
    };
  }

  const category = classification?.category || 'personal';
  const title = extracted?.title || 'Untitled Note';
  const timestamp = formatTimestamp(new Date());
  const summary = generateSummary(rawText, category);

  let formatted_output;

  switch (category) {
    case 'work':
      formatted_output = workTemplate(title, timestamp, summary, extracted);
      break;
    case 'health':
      formatted_output = healthTemplate(title, timestamp, summary, extracted);
      break;
    case 'ideas':
      formatted_output = ideasTemplate(title, timestamp, summary, extracted);
      break;
    case 'personal':
    default:
      formatted_output = personalTemplate(title, timestamp, summary, extracted);
      break;
  }

  return {
    summary,
    formatted_output
  };
}

// Export for global access
window.Refiner = {
  refine,
  formatTimestamp,
  generateSummary,
  formatActionItems,
  formatPeople,
  CATEGORY_ICONS,
  CATEGORY_LABELS
};
