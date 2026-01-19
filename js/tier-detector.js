/**
 * Phase 8.8 Tier Detection
 * Determines response depth based on input analysis
 */

const EMOTIONAL_MARKERS = /\b(feel|feeling|felt|scared|afraid|angry|furious|sad|depressed|hurt|love|hate|can't|cannot|won't|overwhelmed|exhausted|anxious|worried|confused|lost|stuck|hopeless|excited|thrilled|devastated|heartbroken|terrified|nervous|frustrated|disappointed)\b/i;

const STAKES_MARKERS = /\b(cofounder|co-founder|founder|partner|marriage|married|wife|husband|boyfriend|girlfriend|friend|friendship|mom|mother|dad|father|parent|boss|manager|team|employee|relationship|divorce|breakup|fired|quit|pregnant|baby|death|died|cancer|sick|illness|money|debt|bankrupt)\b/i;

const URGENCY_MARKERS = /\b(can't stop|keep putting|keep avoiding|stuck on|don't know how|need to|have to|must|scared to|afraid to|avoiding|procrastinating|running out of time|deadline|urgent|asap|immediately)\b/i;

const HELP_REQUEST_MARKERS = /\b(how do i|how can i|what should|should i|any ideas|help me|where do i start|what do you think|advice|suggest|recommend|trying to figure|not sure|figure out how|wondering how|struggling with|need guidance|don't know where|don't know how)\b/i;

function detectTier(input) {
  const text = (input || '').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const signals = [];

  const hasEmotion = EMOTIONAL_MARKERS.test(text);
  if (hasEmotion) signals.push('emotional');

  const hasStakes = STAKES_MARKERS.test(text);
  if (hasStakes) signals.push('stakes');

  const hasUrgency = URGENCY_MARKERS.test(text);
  if (hasUrgency) signals.push('urgency');

  const hasHelpRequest = HELP_REQUEST_MARKERS.test(text);
  if (hasHelpRequest) signals.push('help_request');

  const punctuationIntensity = (text.match(/!{2,}|\.{3,}|\?{2,}/g) || []).length >= 1;
  if (punctuationIntensity) signals.push('punctuation');

  // High emotional load = deep
  const isHighLoad = (hasEmotion && hasStakes) || (hasUrgency && hasStakes) || (hasEmotion && hasUrgency);

  let tier;
  if (wordCount > 100 || isHighLoad) {
    tier = 'deep';
  } else if (wordCount > 30 || hasHelpRequest || hasEmotion || hasStakes || hasUrgency) {
    tier = 'standard';
  } else {
    tier = 'quick';
  }

  console.log(`[TierDetector] Input: "${text.substring(0, 50)}..." | Words: ${wordCount} | Signals: [${signals.join(', ')}] | Tier: ${tier}`);

  return { tier, signals, wordCount };
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectTier, EMOTIONAL_MARKERS, STAKES_MARKERS, URGENCY_MARKERS, HELP_REQUEST_MARKERS };
}
if (typeof window !== 'undefined') {
  window.TierDetector = { detectTier, EMOTIONAL_MARKERS, STAKES_MARKERS, URGENCY_MARKERS, HELP_REQUEST_MARKERS };
}
