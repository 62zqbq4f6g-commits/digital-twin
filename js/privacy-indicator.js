/**
 * Privacy Indicator
 *
 * Shows encryption and privacy status in the header.
 */

import { getCurrentTier, TIERS, getTierInfo } from './tier-manager.js';
import { isEncryptionSetup, isUnlocked } from './key-manager.js';

/**
 * Render privacy indicator in container
 * @param {HTMLElement} container
 */
export function renderPrivacyIndicator(container) {
  const tier = getCurrentTier();
  const tierInfo = getTierInfo(tier);
  const encrypted = isEncryptionSetup();
  const unlocked = isUnlocked();

  // Determine status
  let statusText = '';
  let statusClass = '';

  if (!encrypted) {
    statusText = 'Not encrypted';
    statusClass = 'status-warning';
  } else if (!unlocked) {
    statusText = 'Locked';
    statusClass = 'status-locked';
  } else if (tier === TIERS.BYOK) {
    statusText = 'End-to-end encrypted';
    statusClass = 'status-secure';
  } else {
    statusText = 'Notes encrypted';
    statusClass = 'status-encrypted';
  }

  container.innerHTML = `
    <div class="privacy-indicator-wrapper">
      <button class="privacy-indicator ${statusClass}" id="privacy-indicator-btn" aria-expanded="false">
        <span class="privacy-lock">🔒</span>
        <span class="privacy-status">${statusText}</span>
        <span class="privacy-chevron">▾</span>
      </button>

      <div class="privacy-dropdown" id="privacy-dropdown" aria-hidden="true">
        <div class="privacy-dropdown-header">Data Protection</div>

        <ul class="privacy-checklist">
          <li class="${encrypted ? 'checked' : 'unchecked'}">
            <span class="check-icon">${encrypted ? '✓' : '○'}</span>
            <span>Notes encrypted on device</span>
          </li>
          <li class="${encrypted ? 'checked' : 'unchecked'}">
            <span class="check-icon">${encrypted ? '✓' : '○'}</span>
            <span>Only you have the key</span>
          </li>
          <li class="${tier === TIERS.BYOK ? 'checked' : 'unchecked'}">
            <span class="check-icon">${tier === TIERS.BYOK ? '✓' : '○'}</span>
            <span>AI calls direct to Anthropic</span>
          </li>
          <li class="checked">
            <span class="check-icon">✓</span>
            <span>Inscript cannot read your notes</span>
          </li>
        </ul>

        <div class="privacy-tier">
          <span class="tier-label">Plan:</span>
          <span class="tier-value">${tierInfo.name}</span>
        </div>

        <a href="/settings#privacy" class="privacy-settings-link">
          Privacy settings →
        </a>
      </div>
    </div>
  `;

  // Toggle dropdown
  const btn = container.querySelector('#privacy-indicator-btn');
  const dropdown = container.querySelector('#privacy-dropdown');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen);
    dropdown.setAttribute('aria-hidden', !isOpen);
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      dropdown.setAttribute('aria-hidden', 'true');
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      dropdown.setAttribute('aria-hidden', 'true');
    }
  });
}

/**
 * Update privacy indicator (call when state changes)
 * @param {HTMLElement} container
 */
export function updatePrivacyIndicator(container) {
  renderPrivacyIndicator(container);
}
