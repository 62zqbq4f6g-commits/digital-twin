/**
 * Encryption Onboarding UI
 *
 * Handles the encryption setup flow for new users.
 *
 * Design system: Black/white/silver, 2px radius, Inter font
 */

import { setupEncryption, isEncryptionSetup, unlockWithPassword } from './key-manager.js';
import { setTierBYOK, setTierManaged, TIERS, TIER_INFO, getCurrentTier } from './tier-manager.js';

// ============================================
// ONBOARDING FLOW
// ============================================

/**
 * Initialize onboarding in a container
 * @param {HTMLElement} container
 * @param {Function} onComplete - Called when onboarding complete
 */
export function initOnboarding(container, onComplete) {
  renderTierSelection(container, onComplete);
}

/**
 * Render tier selection step
 */
function renderTierSelection(container, onComplete) {
  container.innerHTML = `
    <div class="onboarding-step" data-step="tier">
      <h2 class="onboarding-title">Choose Your Plan</h2>
      <p class="onboarding-subtitle">Your notes are always encrypted. Choose how AI is handled.</p>

      <div class="tier-options">
        <button class="tier-card" data-tier="managed">
          <div class="tier-header">
            <span class="tier-name">${TIER_INFO.managed.name}</span>
            <span class="tier-price">${TIER_INFO.managed.price}</span>
          </div>
          <p class="tier-description">${TIER_INFO.managed.description}</p>
          <ul class="tier-features">
            ${TIER_INFO.managed.features.map(f => `<li>✓ ${f}</li>`).join('')}
          </ul>
          <p class="tier-caveat">${TIER_INFO.managed.caveats[0]}</p>
        </button>

        <button class="tier-card" data-tier="byok">
          <div class="tier-header">
            <span class="tier-name">${TIER_INFO.byok.name}</span>
            <span class="tier-price">${TIER_INFO.byok.price}</span>
          </div>
          <p class="tier-description">${TIER_INFO.byok.description}</p>
          <ul class="tier-features">
            ${TIER_INFO.byok.features.map(f => `<li>✓ ${f}</li>`).join('')}
          </ul>
          <p class="tier-caveat">${TIER_INFO.byok.caveats[0]}</p>
        </button>
      </div>
    </div>
  `;

  container.querySelectorAll('.tier-card').forEach(card => {
    card.addEventListener('click', () => {
      const tier = card.dataset.tier;
      if (tier === 'byok') {
        renderAPIKeyStep(container, onComplete);
      } else {
        setTierManaged();
        renderEncryptionWarning(container, onComplete);
      }
    });
  });
}

/**
 * Render API key entry step (BYOK only)
 */
function renderAPIKeyStep(container, onComplete) {
  container.innerHTML = `
    <div class="onboarding-step" data-step="apikey">
      <h2 class="onboarding-title">Connect Your AI</h2>
      <p class="onboarding-subtitle">Your AI runs with YOUR API key. We never see your conversations.</p>

      <ol class="onboarding-instructions">
        <li>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" class="onboarding-link">
            Open Anthropic Console →
          </a>
        </li>
        <li>Create a new API key named "Inscript"</li>
        <li>Set a spending limit (recommended: $20/mo)</li>
        <li>Paste the key below</li>
      </ol>

      <div class="input-group">
        <label for="api-key-input" class="input-label">API KEY</label>
        <div class="input-wrapper">
          <input
            type="password"
            id="api-key-input"
            class="input-field"
            placeholder="sk-ant-..."
            autocomplete="off"
            spellcheck="false"
          />
          <button type="button" class="input-toggle" id="toggle-key-visibility">Show</button>
        </div>
      </div>

      <p class="onboarding-note">
        ⚠️ Create a dedicated key for Inscript. You can revoke it anytime in your Anthropic dashboard.
      </p>

      <div class="onboarding-actions">
        <button class="btn-secondary" id="back-to-tiers">Back</button>
        <button class="btn-primary" id="validate-key" disabled>Continue</button>
      </div>

      <div id="key-error" class="error-message" style="display: none;"></div>
    </div>
  `;

  const input = container.querySelector('#api-key-input');
  const toggleBtn = container.querySelector('#toggle-key-visibility');
  const validateBtn = container.querySelector('#validate-key');
  const backBtn = container.querySelector('#back-to-tiers');
  const errorEl = container.querySelector('#key-error');

  // Toggle visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  // Enable button when key looks valid
  input.addEventListener('input', () => {
    validateBtn.disabled = !input.value.startsWith('sk-ant-');
    errorEl.style.display = 'none';
  });

  // Back button
  backBtn.addEventListener('click', () => {
    renderTierSelection(container, onComplete);
  });

  // Validate and continue
  validateBtn.addEventListener('click', async () => {
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    errorEl.style.display = 'none';

    const result = await setTierBYOK(input.value);

    if (result.success) {
      renderEncryptionWarning(container, onComplete);
    } else {
      errorEl.textContent = result.error;
      errorEl.style.display = 'block';
      validateBtn.disabled = false;
      validateBtn.textContent = 'Continue';
    }
  });
}

/**
 * Render encryption warning step
 */
function renderEncryptionWarning(container, onComplete) {
  container.innerHTML = `
    <div class="onboarding-step" data-step="encryption">
      <h2 class="onboarding-title">Protect Your Notes</h2>
      <p class="onboarding-subtitle">Your notes will be encrypted with a key derived from your password.</p>

      <div class="encryption-warning">
        <strong>⚠️ Important:</strong> Your password encrypts all your notes.
        We cannot reset it or recover your data if you forget it.
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="understand-checkbox" />
        <label for="understand-checkbox">
          I understand that if I lose my password AND recovery key, my data cannot be recovered.
        </label>
      </div>

      <div class="onboarding-actions">
        <button class="btn-primary" id="continue-setup" disabled>Continue</button>
      </div>
    </div>
  `;

  const checkbox = container.querySelector('#understand-checkbox');
  const continueBtn = container.querySelector('#continue-setup');

  checkbox.addEventListener('change', () => {
    continueBtn.disabled = !checkbox.checked;
  });

  continueBtn.addEventListener('click', () => {
    renderPasswordSetup(container, onComplete);
  });
}

/**
 * Render password setup (or link to existing auth)
 */
function renderPasswordSetup(container, onComplete) {
  // In a real app, this would integrate with your auth system
  // For now, we'll prompt for the password they used to sign up

  container.innerHTML = `
    <div class="onboarding-step" data-step="password">
      <h2 class="onboarding-title">Set Up Encryption</h2>
      <p class="onboarding-subtitle">Enter your password to generate your encryption key.</p>

      <div class="input-group">
        <label for="password-input" class="input-label">PASSWORD</label>
        <input
          type="password"
          id="password-input"
          class="input-field"
          placeholder="Your account password"
          autocomplete="current-password"
        />
      </div>

      <div class="onboarding-actions">
        <button class="btn-primary" id="setup-encryption" disabled>Generate Encryption Key</button>
      </div>

      <div id="setup-error" class="error-message" style="display: none;"></div>
    </div>
  `;

  const input = container.querySelector('#password-input');
  const setupBtn = container.querySelector('#setup-encryption');
  const errorEl = container.querySelector('#setup-error');

  input.addEventListener('input', () => {
    setupBtn.disabled = input.value.length < 8;
  });

  setupBtn.addEventListener('click', async () => {
    setupBtn.disabled = true;
    setupBtn.textContent = 'Generating...';

    try {
      const { recoveryKey } = await setupEncryption(input.value);
      renderRecoveryKey(container, recoveryKey, onComplete);
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.style.display = 'block';
      setupBtn.disabled = false;
      setupBtn.textContent = 'Generate Encryption Key';
    }
  });
}

/**
 * Render recovery key display
 */
function renderRecoveryKey(container, recoveryKey, onComplete) {
  container.innerHTML = `
    <div class="onboarding-step" data-step="recovery">
      <h2 class="onboarding-title">Save Your Recovery Key</h2>
      <p class="onboarding-subtitle">This is the only way to recover your data if you forget your password.</p>

      <div class="recovery-key-display">
        <code id="recovery-key">${recoveryKey}</code>
        <button class="btn-icon" id="copy-recovery" title="Copy to clipboard">
          <span class="copy-icon">📋</span>
        </button>
      </div>

      <p class="onboarding-note">
        Store this somewhere safe — a password manager, printed paper, or secure note.
        <strong>We cannot recover this for you.</strong>
      </p>

      <div class="onboarding-actions">
        <button class="btn-secondary" id="download-recovery">Download</button>
        <button class="btn-primary" id="continue-to-app" disabled>I've Saved It</button>
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="saved-checkbox" />
        <label for="saved-checkbox">I have saved my recovery key securely</label>
      </div>
    </div>
  `;

  const copyBtn = container.querySelector('#copy-recovery');
  const downloadBtn = container.querySelector('#download-recovery');
  const continueBtn = container.querySelector('#continue-to-app');
  const savedCheckbox = container.querySelector('#saved-checkbox');
  const copyIcon = container.querySelector('.copy-icon');

  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(recoveryKey);
    copyIcon.textContent = '✓';
    setTimeout(() => copyIcon.textContent = '📋', 2000);
  });

  downloadBtn.addEventListener('click', () => {
    downloadRecoveryKey(recoveryKey);
  });

  savedCheckbox.addEventListener('change', () => {
    continueBtn.disabled = !savedCheckbox.checked;
  });

  continueBtn.addEventListener('click', () => {
    renderComplete(container, onComplete);
  });
}

/**
 * Render completion step
 */
function renderComplete(container, onComplete) {
  const tier = getCurrentTier();
  const tierInfo = TIER_INFO[tier];

  container.innerHTML = `
    <div class="onboarding-step" data-step="complete">
      <div class="onboarding-success">
        <span class="success-icon">🔒</span>
        <h2 class="onboarding-title">You're All Set</h2>
        <p class="onboarding-subtitle">Your notes are encrypted. Start capturing your thoughts.</p>
      </div>

      <div class="privacy-summary">
        <div class="privacy-item">
          <span class="privacy-check">✓</span>
          <span>Notes encrypted on your device</span>
        </div>
        <div class="privacy-item">
          <span class="privacy-check">✓</span>
          <span>Only you have the decryption key</span>
        </div>
        <div class="privacy-item">
          <span class="privacy-check">✓</span>
          <span>Inscript cannot read your notes</span>
        </div>
        ${tier === 'byok' ? `
        <div class="privacy-item">
          <span class="privacy-check">✓</span>
          <span>AI calls go direct to Anthropic</span>
        </div>
        ` : `
        <div class="privacy-item">
          <span class="privacy-check">✓</span>
          <span>AI conversations never stored</span>
        </div>
        `}
      </div>

      <button class="btn-primary btn-large" id="start-app">Start Using Inscript</button>
    </div>
  `;

  container.querySelector('#start-app').addEventListener('click', () => {
    if (onComplete) onComplete();
  });
}

// ============================================
// HELPERS
// ============================================

function downloadRecoveryKey(recoveryKey) {
  const text = `INSCRIPT RECOVERY KEY
=====================

Keep this safe. It's the only way to recover your data if you forget your password.

Recovery Key: ${recoveryKey}

Generated: ${new Date().toISOString()}

IMPORTANT:
- Store this in a password manager or print it
- Do not share this with anyone
- Inscript cannot recover this for you
- Without this key and your password, your data is unrecoverable
`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inscript-recovery-key.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// EXPORTS
// ============================================

export { renderTierSelection, renderAPIKeyStep, renderEncryptionWarning, renderRecoveryKey, renderComplete };
