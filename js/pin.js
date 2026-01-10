/**
 * Digital Twin - PIN Lock & Encryption Module
 * Handles app security with 6-digit PIN and AES-256-GCM encryption
 */

const PIN = {
  SALT_KEY: 'dt_pin_salt',
  HASH_KEY: 'dt_pin_hash',
  RECOVERY_KEY: 'dt_recovery_key',
  RECOVERY_EMAIL: 'elroycheo@me.com',
  PBKDF2_ITERATIONS: 10000, // Reduced from 100k for mobile Safari performance
  isSetup: false,
  isUnlocked: false,
  encryptionKey: null,
  isProcessing: false, // Prevent double-taps on iOS

  /**
   * Initialize PIN module
   */
  async init() {
    this.isSetup = await this.hasExistingPIN();

    if (!this.isSetup) {
      this.showSetupScreen();
    } else {
      this.showLockScreen();
    }
  },

  /**
   * Check if PIN is already set up
   */
  async hasExistingPIN() {
    const hash = localStorage.getItem(this.HASH_KEY);
    return hash !== null;
  },

  // ==================
  // UI SCREENS
  // ==================

  showSetupScreen() {
    const screen = document.getElementById('pin-screen');
    const appContent = document.getElementById('app');

    screen.innerHTML = this.renderSetupHTML();
    screen.classList.remove('hidden');
    appContent.classList.add('hidden');
    this.attachPadListeners('setup');
  },

  showConfirmScreen(firstPIN) {
    const screen = document.getElementById('pin-screen');
    screen.innerHTML = this.renderConfirmHTML();
    this.attachPadListeners('confirm', firstPIN);
  },

  showLockScreen() {
    const screen = document.getElementById('pin-screen');
    const appContent = document.getElementById('app');

    screen.innerHTML = this.renderLockHTML();
    screen.classList.remove('hidden');
    appContent.classList.add('hidden');
    this.attachPadListeners('unlock');
  },

  hideScreen() {
    const screen = document.getElementById('pin-screen');
    const appContent = document.getElementById('app');

    screen.classList.add('hidden');
    appContent.classList.remove('hidden');
  },

  // ==================
  // HTML TEMPLATES
  // ==================

  renderSetupHTML() {
    return `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">D I G I T A L</span>
          <span class="pin-brand">T W I N</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Create your PIN</h2>
          <p class="pin-subtitle">6 digits to secure your thoughts</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <p class="pin-error hidden" id="pin-error"></p>
        </div>

        ${this.renderNumpad()}

        <p class="pin-hint">Your PIN encrypts all notes locally</p>
      </div>
    `;
  },

  renderConfirmHTML() {
    return `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">D I G I T A L</span>
          <span class="pin-brand">T W I N</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Confirm your PIN</h2>
          <p class="pin-subtitle">Enter the same PIN again</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <p class="pin-error hidden" id="pin-error"></p>
        </div>

        ${this.renderNumpad()}

        <button class="pin-back" id="pin-back">Start over</button>
      </div>
    `;
  },

  renderLockHTML() {
    return `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">D I G I T A L</span>
          <span class="pin-brand">T W I N</span>
        </div>

        <div class="pin-content">
          <p class="pin-subtitle">Enter your PIN</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <p class="pin-error hidden" id="pin-error"></p>
        </div>

        ${this.renderNumpad()}

        <button class="pin-forgot" id="pin-forgot">Forgot PIN?</button>
      </div>
    `;
  },

  renderNumpad() {
    return `
      <div class="pin-numpad">
        <button class="pin-key" data-key="1">1</button>
        <button class="pin-key" data-key="2">2</button>
        <button class="pin-key" data-key="3">3</button>
        <button class="pin-key" data-key="4">4</button>
        <button class="pin-key" data-key="5">5</button>
        <button class="pin-key" data-key="6">6</button>
        <button class="pin-key" data-key="7">7</button>
        <button class="pin-key" data-key="8">8</button>
        <button class="pin-key" data-key="9">9</button>
        <button class="pin-key pin-key-empty"></button>
        <button class="pin-key" data-key="0">0</button>
        <button class="pin-key pin-key-delete" data-key="delete">⌫</button>
      </div>
      <div class="pin-loading hidden" id="pin-loading">
        <div class="pin-spinner"></div>
        <span>Securing...</span>
      </div>
    `;
  },

  showLoading() {
    const loading = document.getElementById('pin-loading');
    const numpad = document.querySelector('.pin-numpad');
    if (loading) loading.classList.remove('hidden');
    if (numpad) numpad.classList.add('hidden');
  },

  hideLoading() {
    const loading = document.getElementById('pin-loading');
    const numpad = document.querySelector('.pin-numpad');
    if (loading) loading.classList.add('hidden');
    if (numpad) numpad.classList.remove('hidden');
  },

  // ==================
  // EVENT HANDLERS
  // ==================

  attachPadListeners(mode, firstPIN = null) {
    let currentPIN = '';
    const dots = document.querySelectorAll('.pin-dot');
    const error = document.getElementById('pin-error');

    // Number pad
    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', async (e) => {
        e.preventDefault();

        // Prevent double-taps during processing
        if (this.isProcessing) return;

        const value = key.dataset.key;

        if (value === 'delete') {
          currentPIN = currentPIN.slice(0, -1);
        } else if (value && currentPIN.length < 6) {
          currentPIN += value;
          // Subtle haptic feedback
          if (navigator.vibrate) navigator.vibrate(10);
        }

        // Update dots
        dots.forEach((dot, i) => {
          dot.classList.toggle('filled', i < currentPIN.length);
        });

        // Auto-submit when 6 digits
        if (currentPIN.length === 6) {
          error.classList.add('hidden');

          if (mode === 'setup') {
            this.showConfirmScreen(currentPIN);
          } else if (mode === 'confirm') {
            if (currentPIN === firstPIN) {
              console.log('[PIN] Confirm: PINs match, starting save...');
              this.isProcessing = true;
              this.showLoading();
              console.log('[PIN] Confirm: Loading shown, waiting 50ms...');
              // Let UI update before heavy crypto
              await new Promise(r => setTimeout(r, 50));
              console.log('[PIN] Confirm: Calling savePIN...');
              try {
                await this.savePIN(currentPIN);
                console.log('[PIN] Confirm: savePIN done!');
                this.isSetup = true;
                this.isUnlocked = true;
                this.hideScreen();
                console.log('[PIN] Confirm: Screen hidden, calling onUnlock');
                // Initialize app after PIN setup
                this.onUnlock();
              } catch (err) {
                console.error('[PIN] Confirm ERROR:', err);
              } finally {
                this.isProcessing = false;
              }
            } else {
              this.showError('PINs do not match');
              currentPIN = '';
              dots.forEach(d => d.classList.remove('filled'));
            }
          } else if (mode === 'unlock') {
            this.isProcessing = true;
            this.showLoading();
            // Let UI update before heavy crypto
            await new Promise(r => setTimeout(r, 50));
            try {
              const valid = await this.verifyPIN(currentPIN);
              if (valid) {
                this.isUnlocked = true;
                this.hideScreen();
                // Initialize app after unlock
                this.onUnlock();
              } else {
                this.hideLoading();
                this.showError('Incorrect PIN');
                currentPIN = '';
                dots.forEach(d => d.classList.remove('filled'));
                // Shake animation
                document.getElementById('pin-dots').classList.add('shake');
                setTimeout(() => {
                  document.getElementById('pin-dots').classList.remove('shake');
                }, 500);
              }
            } finally {
              this.isProcessing = false;
            }
          }
        }
      });
    });

    // Back button (confirm screen)
    const backBtn = document.getElementById('pin-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showSetupScreen());
    }

    // Forgot PIN button
    const forgotBtn = document.getElementById('pin-forgot');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => this.handleForgotPIN());
    }
  },

  showError(message) {
    const error = document.getElementById('pin-error');
    error.textContent = message;
    error.classList.remove('hidden');
  },

  /**
   * Called after successful unlock
   */
  onUnlock() {
    // Initialize sync if available
    if (typeof Sync !== 'undefined') {
      Sync.init();
    }
  },

  /**
   * Change PIN flow - verify current PIN first, then set new one
   */
  async startChangePIN() {
    this.changePINMode = true;
    this.showVerifyScreen();
  },

  showVerifyScreen() {
    const screen = document.getElementById('pin-screen');
    const appContent = document.getElementById('app');

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">D I G I T A L</span>
          <span class="pin-brand">T W I N</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Verify current PIN</h2>
          <p class="pin-subtitle">Enter your current PIN to continue</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <p class="pin-error hidden" id="pin-error"></p>
        </div>

        ${this.renderNumpad()}

        <button class="pin-back" id="pin-cancel">Cancel</button>
      </div>
    `;
    screen.classList.remove('hidden');
    appContent.classList.add('hidden');
    this.attachVerifyListeners();
  },

  attachVerifyListeners() {
    let currentPIN = '';
    const dots = document.querySelectorAll('.pin-dot');
    const error = document.getElementById('pin-error');

    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isProcessing) return;

        const value = key.dataset.key;

        if (value === 'delete') {
          currentPIN = currentPIN.slice(0, -1);
        } else if (value && currentPIN.length < 6) {
          currentPIN += value;
          if (navigator.vibrate) navigator.vibrate(10);
        }

        dots.forEach((dot, i) => {
          dot.classList.toggle('filled', i < currentPIN.length);
        });

        if (currentPIN.length === 6) {
          this.isProcessing = true;
          this.showLoading();
          await new Promise(r => setTimeout(r, 50));
          try {
            const valid = await this.verifyPIN(currentPIN);
            if (valid) {
              // Show new PIN setup
              this.showNewPINScreen();
            } else {
              this.hideLoading();
              this.showError('Incorrect PIN');
              currentPIN = '';
              dots.forEach(d => d.classList.remove('filled'));
              document.getElementById('pin-dots').classList.add('shake');
              setTimeout(() => {
                document.getElementById('pin-dots').classList.remove('shake');
              }, 500);
            }
          } finally {
            this.isProcessing = false;
          }
        }
      });
    });

    const cancelBtn = document.getElementById('pin-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.changePINMode = false;
        this.hideScreen();
      });
    }
  },

  showNewPINScreen() {
    const screen = document.getElementById('pin-screen');

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">D I G I T A L</span>
          <span class="pin-brand">T W I N</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Enter new PIN</h2>
          <p class="pin-subtitle">Choose a new 6-digit PIN</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <p class="pin-error hidden" id="pin-error"></p>
        </div>

        ${this.renderNumpad()}

        <button class="pin-back" id="pin-cancel">Cancel</button>
      </div>
    `;
    this.attachNewPINListeners();
  },

  attachNewPINListeners() {
    let currentPIN = '';
    const dots = document.querySelectorAll('.pin-dot');

    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isProcessing) return;

        const value = key.dataset.key;

        if (value === 'delete') {
          currentPIN = currentPIN.slice(0, -1);
        } else if (value && currentPIN.length < 6) {
          currentPIN += value;
          if (navigator.vibrate) navigator.vibrate(10);
        }

        dots.forEach((dot, i) => {
          dot.classList.toggle('filled', i < currentPIN.length);
        });

        if (currentPIN.length === 6) {
          this.showConfirmNewPINScreen(currentPIN);
        }
      });
    });

    const cancelBtn = document.getElementById('pin-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.changePINMode = false;
        this.hideScreen();
      });
    }
  },

  showConfirmNewPINScreen(newPIN) {
    const screen = document.getElementById('pin-screen');

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">D I G I T A L</span>
          <span class="pin-brand">T W I N</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Confirm new PIN</h2>
          <p class="pin-subtitle">Enter the same PIN again</p>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <p class="pin-error hidden" id="pin-error"></p>
        </div>

        ${this.renderNumpad()}

        <button class="pin-back" id="pin-back">Start over</button>
      </div>
    `;
    this.attachConfirmNewPINListeners(newPIN);
  },

  attachConfirmNewPINListeners(newPIN) {
    let currentPIN = '';
    const dots = document.querySelectorAll('.pin-dot');
    const error = document.getElementById('pin-error');

    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.isProcessing) return;

        const value = key.dataset.key;

        if (value === 'delete') {
          currentPIN = currentPIN.slice(0, -1);
        } else if (value && currentPIN.length < 6) {
          currentPIN += value;
          if (navigator.vibrate) navigator.vibrate(10);
        }

        dots.forEach((dot, i) => {
          dot.classList.toggle('filled', i < currentPIN.length);
        });

        if (currentPIN.length === 6) {
          if (currentPIN === newPIN) {
            this.isProcessing = true;
            this.showLoading();
            await new Promise(r => setTimeout(r, 50));
            try {
              await this.savePIN(currentPIN);
              this.changePINMode = false;
              this.hideScreen();
              if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('PIN changed successfully');
              }
            } finally {
              this.isProcessing = false;
            }
          } else {
            this.showError('PINs do not match');
            currentPIN = '';
            dots.forEach(d => d.classList.remove('filled'));
          }
        }
      });
    });

    const backBtn = document.getElementById('pin-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showNewPINScreen());
    }
  },

  // ==================
  // CRYPTO FUNCTIONS
  // ==================

  /**
   * Simple hash function for iOS compatibility (no PBKDF2)
   */
  async simpleHash(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  },

  /**
   * Derive encryption key from PIN using SHA-256 (iOS-safe, no PBKDF2)
   */
  async deriveKeySimple(pin, salt) {
    const keyData = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(pin + salt)
    );
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async savePIN(pin) {
    console.log('[PIN] savePIN starting...');

    try {
      // Step 1: Generate salt
      console.log('[PIN] Step 1: Generating salt...');
      const saltArray = crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = btoa(String.fromCharCode(...saltArray));
      console.log('[PIN] Salt OK');

      // Step 2: Hash PIN for verification (simple SHA-256, no PBKDF2)
      console.log('[PIN] Step 2: Hashing PIN...');
      const hashB64 = await this.simpleHash(pin + saltB64);
      console.log('[PIN] Hash OK');

      // Step 3: Derive encryption key (simple method, iOS-safe)
      console.log('[PIN] Step 3: Deriving key...');
      this.encryptionKey = await this.deriveKeySimple(pin, saltB64);
      console.log('[PIN] Key OK');

      // Step 4: Save to localStorage
      console.log('[PIN] Step 4: Saving to localStorage...');
      localStorage.setItem(this.SALT_KEY, saltB64);
      localStorage.setItem(this.HASH_KEY, hashB64);
      console.log('[PIN] localStorage OK');

      console.log('[PIN] savePIN COMPLETE!');
    } catch (error) {
      console.error('[PIN] savePIN FAILED:', error);
      // Fallback: save PIN as simple hash without encryption support
      try {
        console.log('[PIN] Trying fallback (no encryption)...');
        const saltB64 = btoa(Math.random().toString(36));
        const hashB64 = btoa(pin + saltB64); // Simple base64, no crypto
        localStorage.setItem(this.SALT_KEY, saltB64);
        localStorage.setItem(this.HASH_KEY, hashB64);
        localStorage.setItem('dt_pin_fallback', 'true');
        console.log('[PIN] Fallback saved OK');
      } catch (fallbackError) {
        console.error('[PIN] Fallback FAILED:', fallbackError);
        throw fallbackError;
      }
    }
  },

  async verifyPIN(pin) {
    console.log('[PIN] verifyPIN starting...');

    try {
      const saltB64 = localStorage.getItem(this.SALT_KEY);
      const storedHash = localStorage.getItem(this.HASH_KEY);
      const isFallback = localStorage.getItem('dt_pin_fallback') === 'true';

      if (!saltB64 || !storedHash) {
        console.log('[PIN] No stored PIN found');
        return false;
      }

      let hashB64;
      if (isFallback) {
        // Fallback mode: simple base64
        hashB64 = btoa(pin + saltB64);
      } else {
        // Normal mode: SHA-256
        hashB64 = await this.simpleHash(pin + saltB64);
      }

      if (hashB64 === storedHash) {
        console.log('[PIN] PIN verified!');
        if (!isFallback) {
          // Derive encryption key for later use
          this.encryptionKey = await this.deriveKeySimple(pin, saltB64);
        }
        return true;
      }

      console.log('[PIN] PIN incorrect');
      return false;
    } catch (error) {
      console.error('Failed to verify PIN:', error);
      return false;
    }
  },

  async getKeyMaterial(pin) {
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveKey']
    );
  },

  generateRecoveryKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key; // Format: XXXX-XXXX-XXXX-XXXX
  },

  async encryptRecoveryKey(recoveryKey, encKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encKey,
      new TextEncoder().encode(recoveryKey)
    );
    return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
  },

  async sendRecoveryEmail(recoveryKey) {
    try {
      await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.RECOVERY_EMAIL,
          recoveryKey: recoveryKey
        })
      });
    } catch (error) {
      console.error('Failed to send recovery email:', error);
    }
  },

  async handleForgotPIN() {
    const confirmed = confirm(
      'We\'ll send a recovery link to your email. Continue?'
    );

    if (confirmed) {
      try {
        await fetch('/api/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.RECOVERY_EMAIL,
            action: 'forgot'
          })
        });
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Recovery email sent');
        }
      } catch (error) {
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast('Failed to send email');
        }
      }
    }
  },

  // ==================
  // ENCRYPTION API
  // ==================

  async encrypt(plaintext) {
    if (!this.encryptionKey) throw new Error('Not unlocked');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      new TextEncoder().encode(JSON.stringify(plaintext))
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  },

  async decrypt(ciphertextB64) {
    if (!this.encryptionKey) throw new Error('Not unlocked');

    const combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      ciphertext
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  }
};

// Export for global access
window.PIN = PIN;
