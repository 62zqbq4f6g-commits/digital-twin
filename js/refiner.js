// js/refiner.js — Calls Claude API via Vercel serverless function
// This replaces the regex-based refiner with AI-powered refinement

const REFINER_CONFIG = {
  // For local development, use localhost
  // For production, this will be your Vercel URL
  apiEndpoint: '/api/refine',
  timezone: 'Asia/Singapore'
};

/**
 * Refine raw input using Claude AI
 * @param {string} rawText - The raw input text
 * @param {object} classification - Classification result (used as fallback)
 * @param {object} extracted - Extraction result (used as fallback)
 * @param {string} inputType - 'voice' or 'text'
 * @returns {Promise<object>} - Refined note data
 */
async function refine(rawText, classification, extracted, inputType = 'text') {
  try {
    // Call the API
    const response = await fetch(REFINER_CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rawText,
        inputType
      })
    });

    if (!response.ok) {
      console.error('Refiner API error:', response.status);
      // Fall back to local refinement
      return refineLocal(rawText, classification, extracted);
    }

    const aiResult = await response.json();

    // Build the formatted output using AI results
    const formattedOutput = buildFormattedOutput(aiResult, rawText);

    return {
      // AI-generated fields
      category: aiResult.category || classification.category,
      confidence: aiResult.confidence || classification.confidence,
      title: aiResult.title || extracted.title,
      summary: aiResult.summary,
      key_points: aiResult.key_points || [],
      action_items: aiResult.action_items || [],
      people: aiResult.people || [],
      sentiment: aiResult.sentiment || 'neutral',
      topics: aiResult.topics || [],
      formatted_output: formattedOutput
    };

  } catch (error) {
    console.error('Refiner error:', error);
    // Fall back to local refinement
    return refineLocal(rawText, classification, extracted);
  }
}

/**
 * Build the formatted markdown output
 */
function buildFormattedOutput(aiResult, rawText) {
  const now = new Date();
  const options = { 
    timeZone: REFINER_CONFIG.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  const timeOptions = {
    timeZone: REFINER_CONFIG.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  const dateStr = now.toLocaleDateString('en-US', options);
  const timeStr = now.toLocaleTimeString('en-US', timeOptions) + ' SGT';

  // Category labels (text-only per brand guidelines)
  const categoryLabels = {
    personal: 'Personal',
    work: 'Work',
    health: 'Health',
    ideas: 'Idea'
  };

  const categoryLabel = categoryLabels[aiResult.category] || 'Work';

  let output = `# ${aiResult.title}

**${dateStr}**  
**${timeStr}**  
**${categoryLabel}**

---

## Summary

${aiResult.summary}

---
`;

  // Add Key Points if present
  if (aiResult.key_points && aiResult.key_points.length > 0) {
    output += `
## Key Points

${aiResult.key_points.map(point => `• ${point}`).join('\n')}

---
`;
  }

  // Add Action Items if present
  if (aiResult.action_items && aiResult.action_items.length > 0) {
    output += `
## Action Items

${aiResult.action_items.map(item => `☐ ${item}`).join('\n')}

---
`;
  }

  // Add People if present
  if (aiResult.people && aiResult.people.length > 0) {
    output += `
## People Mentioned

${aiResult.people.map(person => `• ${person}`).join('\n')}

---
`;
  }

  output += `
*Captured by Inscript*`;

  return output;
}

/**
 * Local fallback refinement (when API is unavailable)
 * This is a simplified version that cleans up the text
 */
function refineLocal(rawText, classification, extracted) {
  const now = new Date();
  const options = { 
    timeZone: REFINER_CONFIG.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  const timeOptions = {
    timeZone: REFINER_CONFIG.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  const dateStr = now.toLocaleDateString('en-US', options);
  const timeStr = now.toLocaleTimeString('en-US', timeOptions) + ' SGT';

  // Category labels (text-only per brand guidelines)
  const categoryLabels = {
    personal: 'Personal',
    work: 'Work',
    health: 'Health',
    ideas: 'Idea'
  };

  const categoryLabel = categoryLabels[classification.category] || 'Work';

  // Clean the raw text
  const cleanedText = cleanText(rawText);

  // Create a simple summary (first 2 sentences)
  const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const summary = sentences.slice(0, 2).join('. ').trim() + '.';

  const formattedOutput = `# ${extracted.title}

**${dateStr}**  
**${timeStr}**  
**${categoryLabel}**

---

## Summary

${summary}

---

## Action Items

${extracted.action_items.slice(0, 5).map(item => `☐ ${item}`).join('\n') || '• No action items detected'}

---

*Captured by Inscript (offline mode)*`;

  return {
    category: classification.category,
    confidence: classification.confidence,
    title: extracted.title,
    summary: summary,
    key_points: [],
    action_items: extracted.action_items.slice(0, 5),
    people: [],
    sentiment: extracted.sentiment,
    topics: extracted.topics,
    formatted_output: formattedOutput
  };
}

/**
 * Clean filler words from text
 */
function cleanText(text) {
  const fillerWords = [
    'um', 'uh', 'like', 'you know', 'so yeah', 'basically',
    'actually', 'literally', 'kind of', 'sort of', 'i mean',
    'right', 'okay so', 'well'
  ];

  let cleaned = text;
  fillerWords.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // Remove extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { refine, refineLocal, cleanText };
}

// Export for browser global access
window.Refiner = {
  refine,
  refineLocal,
  cleanText
};
