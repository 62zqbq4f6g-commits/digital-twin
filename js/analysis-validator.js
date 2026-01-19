/**
 * Phase 8.8 Analysis Validation
 * Ensures output meets quality standards
 */

const BANNED_TITLE_WORDS = ['strategy', 'planning', 'development', 'assessment', 'management', 'analysis', 'optimization', 'framework', 'implementation', 'structure'];

const VALIDATOR_BANNED_PHRASES = [
  'user is', 'user has', 'user wants', 'user needs', 'the user',
  'captured for future reference', 'noted for later', 'saved for later',
  'this has been recorded', 'logged for reference'
];

function validateAnalysis(analysis, tier, input) {
  const issues = [];

  // Check title
  if (!analysis.title || analysis.title.length < 2) {
    issues.push('Missing or too short title');
  } else {
    const titleLower = analysis.title.toLowerCase();
    BANNED_TITLE_WORDS.forEach(word => {
      if (titleLower.includes(word)) {
        issues.push(`Title contains banned word: ${word}`);
      }
    });
  }

  // Check heard
  if (!analysis.heard || analysis.heard.length < 10) {
    issues.push('Missing or too short "heard"');
  } else {
    const heardLower = analysis.heard.toLowerCase();
    VALIDATOR_BANNED_PHRASES.forEach(phrase => {
      if (heardLower.includes(phrase)) {
        issues.push(`"heard" contains banned phrase: ${phrase}`);
      }
    });
    // Must use "you" language
    if (!heardLower.includes('you')) {
      issues.push('"heard" must use "you" language');
    }
  }

  // Check question
  if (!analysis.question || analysis.question.length < 10) {
    issues.push('Missing or too short "question"');
  } else {
    // Should be open-ended, not yes/no
    const qLower = analysis.question.toLowerCase().trim();
    if (/^(do you|are you|is it|was it|did you|have you|can you|will you|would you)\b/.test(qLower)) {
      issues.push('Question should be open-ended, not yes/no');
    }
  }

  // Tier-specific validation
  if (tier === 'quick') {
    if (!analysis.invite) {
      issues.push('Quick tier missing "invite"');
    }
    if (analysis.noticed) {
      issues.push('Quick tier should not have "noticed"');
    }
    if (analysis.hidden_assumption) {
      issues.push('Quick tier should not have "hidden_assumption"');
    }
    if (analysis.experiment) {
      issues.push('Quick tier should not have "experiment"');
    }
  }

  if (tier === 'standard') {
    if (!analysis.noticed || analysis.noticed.length < 20) {
      issues.push('Standard tier missing or too short "noticed"');
    }
    if (!analysis.experiment || analysis.experiment.length < 15) {
      issues.push('Standard tier missing or too short "experiment"');
    }
    if (analysis.invite) {
      issues.push('Standard tier should not have "invite"');
    }
    if (analysis.hidden_assumption) {
      issues.push('Standard tier should not have "hidden_assumption"');
    }
    // Check noticed is different from heard
    if (analysis.noticed && analysis.heard) {
      const similarity = calculateSimilarity(analysis.heard, analysis.noticed);
      if (similarity > 0.7) {
        issues.push('"noticed" is too similar to "heard"');
      }
    }
  }

  if (tier === 'deep') {
    if (!analysis.noticed || analysis.noticed.length < 20) {
      issues.push('Deep tier missing or too short "noticed"');
    }
    if (!analysis.hidden_assumption || analysis.hidden_assumption.length < 20) {
      issues.push('Deep tier missing or too short "hidden_assumption"');
    }
    if (!analysis.experiment || analysis.experiment.length < 15) {
      issues.push('Deep tier missing or too short "experiment"');
    }
    if (analysis.invite) {
      issues.push('Deep tier should not have "invite"');
    }
    // hidden_assumption must have hypothesis language
    if (analysis.hidden_assumption) {
      const ha = analysis.hidden_assumption.toLowerCase();
      if (!/\b(might|could|may|wonder|perhaps|possibly|seems)\b/.test(ha)) {
        issues.push('"hidden_assumption" must use hypothesis language (might/could/wonder)');
      }
      if (!ha.includes('?')) {
        issues.push('"hidden_assumption" must end with calibration question');
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;

  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
}

function generateFallback(input, tier) {
  const inputLower = (input || '').toLowerCase();

  // Generate contextual title
  let title = 'A Moment';
  if (inputLower.includes('content') || inputLower.includes('audience')) title = 'Finding Your Voice';
  else if (inputLower.includes('conversation') || inputLower.includes('talk')) title = 'Words Unspoken';
  else if (inputLower.includes('work') || inputLower.includes('project')) title = 'Work on Your Mind';
  else if (inputLower.includes('feel') || inputLower.includes('emotion')) title = "What You're Carrying";
  else if (inputLower.includes('decision') || inputLower.includes('choose')) title = 'At a Crossroads';
  else if (inputLower.includes('cofounder') || inputLower.includes('co-founder')) title = 'The Conversation Ahead';
  else if (inputLower.includes('figure') || inputLower.includes('start')) title = 'Finding Your Path';

  // Extract a phrase to quote
  const words = (input || '').split(/\s+/).slice(0, 8).join(' ');
  const heard = `You shared: "${words}${(input || '').split(/\s+/).length > 8 ? '...' : ''}"`;

  const base = {
    tier,
    title,
    heard,
    question: "What feels most important about this right now?"
  };

  if (tier === 'quick') {
    return {
      ...base,
      invite: "Share more if you'd like me to dig deeper."
    };
  }

  if (tier === 'standard') {
    return {
      ...base,
      noticed: "There's something here worth sitting with—your words carry weight.",
      experiment: "Take 10 minutes to write what this is really about for you."
    };
  }

  // deep
  return {
    ...base,
    noticed: "There's something here worth sitting with—your words carry weight.",
    hidden_assumption: "You might be carrying more than you've named. What would it mean to put it all down?",
    experiment: "Take 10 minutes to write what this is really about for you."
  };
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateAnalysis, generateFallback, calculateSimilarity, BANNED_TITLE_WORDS, VALIDATOR_BANNED_PHRASES };
}
if (typeof window !== 'undefined') {
  window.AnalysisValidator = { validateAnalysis, generateFallback, calculateSimilarity, BANNED_TITLE_WORDS, VALIDATOR_BANNED_PHRASES };
}
