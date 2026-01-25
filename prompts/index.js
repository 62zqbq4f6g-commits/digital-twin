/**
 * INSCRIPT: Prompt Versioning System
 *
 * All prompts are versioned for reproducibility and A/B testing.
 * Each prompt has a version, file reference, and changelog.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Prompt registry with metadata
 */
export const PROMPTS = {
  meetingEnhance: {
    version: '1.0',
    file: 'meeting-enhance-v1.txt',
    lastUpdated: '2026-01-25',
    changelog: [
      '1.0 - Initial production prompt with abbreviation expansion, quote preservation, and section-based output'
    ]
  }
};

/**
 * Load a prompt template by key
 * @param {string} promptKey - Key from PROMPTS registry
 * @returns {string} The prompt template content
 */
export function loadPrompt(promptKey) {
  const promptMeta = PROMPTS[promptKey];
  if (!promptMeta) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  const promptPath = join(__dirname, promptMeta.file);
  return readFileSync(promptPath, 'utf-8');
}

/**
 * Build the meeting enhancement prompt with variables substituted
 * @param {Object} params - Parameters to substitute
 * @param {string} params.rawInput - Raw meeting notes
 * @param {string} params.title - Meeting title
 * @param {string[]} params.attendees - List of attendees
 * @param {string} params.date - Meeting date
 * @returns {string} The complete prompt
 */
export function buildMeetingEnhancePrompt({ rawInput, title, attendees, date }) {
  const template = loadPrompt('meetingEnhance');

  return template
    .replace('{raw_input}', rawInput)
    .replace('{title}', title || 'Untitled Meeting')
    .replace('{attendees}', attendees?.join(', ') || 'Not specified')
    .replace('{date}', date || new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }));
}

/**
 * Get prompt version info
 * @param {string} promptKey - Key from PROMPTS registry
 * @returns {Object} Version metadata
 */
export function getPromptVersion(promptKey) {
  const promptMeta = PROMPTS[promptKey];
  if (!promptMeta) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  return {
    version: promptMeta.version,
    lastUpdated: promptMeta.lastUpdated,
    changelog: promptMeta.changelog
  };
}
