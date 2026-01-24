/**
 * Inscript - PIN Lock & Encryption Module
 * Handles app security with 6-digit PIN and AES-256-GCM encryption
 */

const PIN = {
  // Base keys (will be prefixed with user_id when user is signed in)
  SALT_KEY_BASE: 'dt_pin_salt',
  HASH_KEY_BASE: 'dt_pin_hash',
  FALLBACK_KEY_BASE: 'dt_pin_fallback',
  // Legacy keys (for migration)
  LEGACY_SALT_KEY: 'dt_pin_salt',
  LEGACY_HASH_KEY: 'dt_pin_hash',
  RECOVERY_KEY: 'dt_recovery_key',
  RECOVERY_EMAIL: 'elroycheo@me.com',
  PBKDF2_ITERATIONS: 10000, // Reduced from 100k for mobile Safari performance
  // Lockout configuration
  LOCKOUT_KEY: 'dt_pin_lockout',
  ATTEMPTS_KEY: 'dt_pin_attempts',
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30000, // 30 seconds in milliseconds
  isSetup: false,
  isUnlocked: false,
  encryptionKey: null,
  isProcessing: false, // Prevent double-taps on iOS
  lockoutInterval: null, // For countdown timer

  /**
   * Get the current user ID for PIN key prefixing
   * Returns null if no user is signed in
   */
  getCurrentUserId() {
    if (typeof Sync !== 'undefined' && Sync.user && Sync.user.id) {
      return Sync.user.id;
    }
    return null;
  },

  /**
   * Get the PIN salt key for current user
   */
  get SALT_KEY() {
    const userId = this.getCurrentUserId();
    return userId ? `${this.SALT_KEY_BASE}_${userId}` : this.SALT_KEY_BASE;
  },

  /**
   * Get the PIN hash key for current user
   */
  get HASH_KEY() {
    const userId = this.getCurrentUserId();
    return userId ? `${this.HASH_KEY_BASE}_${userId}` : this.HASH_KEY_BASE;
  },

  /**
   * Get the fallback key for current user
   */
  get FALLBACK_KEY() {
    const userId = this.getCurrentUserId();
    return userId ? `${this.FALLBACK_KEY_BASE}_${userId}` : this.FALLBACK_KEY_BASE;
  },

  /**
   * Migrate legacy PIN keys to user-specific keys
   * Called after user signs in/up
   */
  migratePINToUser(userId) {
    if (!userId) return;

    const legacySalt = localStorage.getItem(this.LEGACY_SALT_KEY);
    const legacyHash = localStorage.getItem(this.LEGACY_HASH_KEY);
    const legacyFallback = localStorage.getItem('dt_pin_fallback');

    // Check if user-specific keys already exist
    const userSaltKey = `${this.SALT_KEY_BASE}_${userId}`;
    const userHashKey = `${this.HASH_KEY_BASE}_${userId}`;

    if (localStorage.getItem(userHashKey)) {
      console.log('[PIN] User already has PIN, skipping migration');
      return;
    }

    // Migrate legacy keys to user-specific
    if (legacySalt && legacyHash) {
      console.log('[PIN] Migrating legacy PIN to user-specific keys');
      localStorage.setItem(userSaltKey, legacySalt);
      localStorage.setItem(userHashKey, legacyHash);
      if (legacyFallback) {
        localStorage.setItem(`${this.FALLBACK_KEY_BASE}_${userId}`, legacyFallback);
      }

      // Remove legacy keys
      localStorage.removeItem(this.LEGACY_SALT_KEY);
      localStorage.removeItem(this.LEGACY_HASH_KEY);
      localStorage.removeItem('dt_pin_fallback');
      console.log('[PIN] Migration complete, legacy keys removed');
    }
  },

  // ==================
  // LOCKOUT MANAGEMENT
  // ==================

  /**
   * Check if user is currently locked out
   * Persists across page refresh via localStorage
   */
  isLockedOut() {
    const lockoutTime = localStorage.getItem(this.LOCKOUT_KEY);
    if (!lockoutTime) return false;

    const lockoutEnd = parseInt(lockoutTime, 10);
    const now = Date.now();

    if (now < lockoutEnd) {
      return true;
    }

    // Lockout expired, clear it
    this.clearLockout();
    return false;
  },

  /**
   * Get remaining lockout time in seconds
   */
  getLockoutRemaining() {
    const lockoutTime = localStorage.getItem(this.LOCKOUT_KEY);
    if (!lockoutTime) return 0;

    const lockoutEnd = parseInt(lockoutTime, 10);
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
    return Math.max(0, remaining);
  },

  /**
   * Get current failed attempt count
   */
  getAttemptCount() {
    const attempts = localStorage.getItem(this.ATTEMPTS_KEY);
    return attempts ? parseInt(attempts, 10) : 0;
  },

  /**
   * Record a failed attempt and check for lockout
   * Returns true if lockout is now active
   */
  recordFailedAttempt() {
    let attempts = this.getAttemptCount() + 1;
    localStorage.setItem(this.ATTEMPTS_KEY, attempts.toString());
    console.log(`[PIN] Failed attempt ${attempts}/${this.MAX_ATTEMPTS}`);

    if (attempts >= this.MAX_ATTEMPTS) {
      // Trigger lockout
      const lockoutEnd = Date.now() + this.LOCKOUT_DURATION;
      localStorage.setItem(this.LOCKOUT_KEY, lockoutEnd.toString());
      console.log('[PIN] Lockout triggered for 30 seconds');
      return true;
    }
    return false;
  },

  /**
   * Clear lockout and reset attempts (on successful unlock)
   */
  clearLockout() {
    localStorage.removeItem(this.LOCKOUT_KEY);
    localStorage.removeItem(this.ATTEMPTS_KEY);
    if (this.lockoutInterval) {
      clearInterval(this.lockoutInterval);
      this.lockoutInterval = null;
    }
  },

  /**
   * Show lockout screen with countdown
   */
  showLockoutScreen() {
    const screen = document.getElementById('pin-screen');
    const remaining = this.getLockoutRemaining();

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">Your mirror in code</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Too many attempts</h2>
          <p class="pin-subtitle">Please wait before trying again</p>

          <div class="pin-lockout-timer">
            <span id="lockout-countdown">${remaining}</span>
            <span>seconds</span>
          </div>
        </div>
      </div>
    `;

    // Start countdown
    this.startLockoutCountdown();
  },

  /**
   * Start countdown timer and auto-unlock when done
   */
  startLockoutCountdown() {
    if (this.lockoutInterval) {
      clearInterval(this.lockoutInterval);
    }

    this.lockoutInterval = setInterval(() => {
      const remaining = this.getLockoutRemaining();
      const countdown = document.getElementById('lockout-countdown');

      if (countdown) {
        countdown.textContent = remaining;
      }

      if (remaining <= 0) {
        clearInterval(this.lockoutInterval);
        this.lockoutInterval = null;
        this.clearLockout();
        // Return to lock screen
        this.showLockScreen();
      }
    }, 1000);
  },

  /**
   * Initialize PIN module
   */
  async init() {
    this.isSetup = await this.hasExistingPIN();
    console.log('[PIN] init: isSetup =', this.isSetup, 'userId =', this.getCurrentUserId());

    if (!this.isSetup) {
      // First time on this device - ask if new or existing user
      this.showWelcomeScreen();
    } else {
      // Check if user is locked out (persists across refresh)
      if (this.isLockedOut()) {
        console.log('[PIN] User is locked out, showing lockout screen');
        const screen = document.getElementById('pin-screen');
        const appContent = document.getElementById('app');
        screen.classList.remove('hidden');
        appContent.classList.add('hidden');
        this.showLockoutScreen();
      } else {
        this.showLockScreen();
      }
    }
  },

  /**
   * Check if PIN is already set up for current user (or globally if no user)
   */
  async hasExistingPIN() {
    const userId = this.getCurrentUserId();
    const hashKey = this.HASH_KEY;
    const hash = localStorage.getItem(hashKey);
    console.log('[PIN] hasExistingPIN: checking key =', hashKey, 'exists =', hash !== null);
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

  // ==================
  // WELCOME FLOW (New vs Existing User)
  // ==================

  showWelcomeScreen() {
    const screen = document.getElementById('pin-screen');
    const appContent = document.getElementById('app');

    screen.innerHTML = this.renderWelcomeHTML();
    screen.classList.remove('hidden');
    appContent.classList.add('hidden');
    this.attachWelcomeListeners();
  },

  renderWelcomeHTML() {
    return `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">Your mirror in code</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Welcome</h2>
          <p class="pin-subtitle">your mirror in code</p>
        </div>

        <div class="pin-welcome-buttons">
          <button class="pin-welcome-btn pin-welcome-btn-primary" id="btn-new-user">
            Create New Account
          </button>
          <button class="pin-welcome-btn pin-welcome-btn-secondary" id="btn-existing-user">
            I Have an Account
          </button>
        </div>

        <p class="pin-hint">Your notes are encrypted end-to-end</p>
      </div>
    `;
  },

  attachWelcomeListeners() {
    document.getElementById('btn-new-user').addEventListener('click', () => {
      this.isNewUser = true;
      this.showSetupScreen();
    });

    document.getElementById('btn-existing-user').addEventListener('click', () => {
      this.isNewUser = false;
      this.showSignInScreen();
    });
  },

  showSignInScreen() {
    const screen = document.getElementById('pin-screen');

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">Your mirror in code</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Sign In</h2>
          <p class="pin-subtitle">Sign in to sync your notes</p>

          <div class="pin-form">
            <input type="email" id="signin-email" class="pin-input" placeholder="Email" autocomplete="email" />
            <input type="password" id="signin-password" class="pin-input" placeholder="Password" autocomplete="current-password" />
            <p class="pin-error hidden" id="signin-error"></p>
          </div>
        </div>

        <div class="pin-form-buttons">
          <button class="pin-welcome-btn pin-welcome-btn-primary" id="btn-signin">
            Sign In
          </button>
        </div>

        <button class="pin-back" id="btn-back">Back</button>
      </div>
    `;

    this.attachSignInListeners();
  },

  attachSignInListeners() {
    const emailInput = document.getElementById('signin-email');
    const passwordInput = document.getElementById('signin-password');
    const signInBtn = document.getElementById('btn-signin');
    const backBtn = document.getElementById('btn-back');
    const errorEl = document.getElementById('signin-error');

    signInBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        errorEl.textContent = 'Please enter email and password';
        errorEl.classList.remove('hidden');
        return;
      }

      signInBtn.disabled = true;
      signInBtn.textContent = 'Signing in...';
      errorEl.classList.add('hidden');

      try {
        // Initialize Sync if needed
        if (typeof Sync !== 'undefined' && !Sync.supabase) {
          await Sync.init();
        }

        // Sign in
        await Sync.signIn(email, password);
        console.log('[PIN] Signed in successfully');

        // Fetch salt AND pin_hash from cloud
        const cloudSalt = await Sync.fetchSalt();
        const cloudPinHash = await Sync.fetchPinHash();

        if (cloudSalt) {
          console.log('[PIN] Found cloud salt, storing locally');
          localStorage.setItem(this.SALT_KEY, cloudSalt);
          this.cloudSaltFetched = true;

          if (cloudPinHash) {
            console.log('[PIN] Found cloud PIN hash, storing locally');
            localStorage.setItem(this.HASH_KEY, cloudPinHash);
            this.cloudPinHashFetched = true;
          }

          // Show existing user PIN entry (verify by hash or decryption)
          this.showExistingUserPINScreen();
        } else {
          console.log('[PIN] No cloud salt found - new account, show setup');
          this.showSetupScreen();
        }

      } catch (error) {
        console.error('[PIN] Sign in failed:', error);
        errorEl.textContent = error.message || 'Sign in failed';
        errorEl.classList.remove('hidden');
        signInBtn.disabled = false;
        signInBtn.textContent = 'Sign In';
      }
    });

    backBtn.addEventListener('click', () => {
      this.showWelcomeScreen();
    });

    // Enter key submits
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') signInBtn.click();
    });
  },

  showSignUpScreen() {
    const screen = document.getElementById('pin-screen');

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">Your mirror in code</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title pin-editorial">begin</h2>

          <div class="pin-form">
            <input type="email" id="signup-email" class="pin-input" placeholder="Email" autocomplete="email" />
            <input type="password" id="signup-password" class="pin-input" placeholder="Password (min 6 chars)" autocomplete="new-password" />
            <p class="pin-error hidden" id="signup-error"></p>
          </div>
        </div>

        <div class="pin-form-buttons">
          <button class="pin-welcome-btn pin-welcome-btn-primary" id="btn-signup">
            Begin
          </button>
          <button class="pin-welcome-btn pin-welcome-btn-secondary" id="btn-skip">
            Skip for Now
          </button>
        </div>
      </div>
    `;

    this.attachSignUpListeners();
  },

  attachSignUpListeners() {
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const signUpBtn = document.getElementById('btn-signup');
    const skipBtn = document.getElementById('btn-skip');
    const errorEl = document.getElementById('signup-error');

    signUpBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        errorEl.textContent = 'Please enter email and password';
        errorEl.classList.remove('hidden');
        return;
      }

      if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('hidden');
        return;
      }

      signUpBtn.disabled = true;
      signUpBtn.textContent = 'Creating account...';
      errorEl.classList.add('hidden');

      try {
        // Initialize Sync if needed
        if (typeof Sync !== 'undefined' && !Sync.supabase) {
          await Sync.init();
        }

        // Sign up
        await Sync.signUp(email, password);
        console.log('[PIN] Signed up successfully');

        // Upload salt AND pin_hash to cloud (only if authenticated)
        if (this.pendingSaltUpload && Sync.user && Sync.isAuthenticated()) {
          console.log('[PIN] Uploading salt to cloud...');
          try {
            await Sync.saveSalt(this.pendingSaltUpload);
            console.log('[PIN] Salt uploaded successfully');
            // Also upload PIN hash for cross-device verification
            if (this.pendingHashUpload) {
              await Sync.savePinHash(this.pendingHashUpload);
              console.log('[PIN] PIN hash uploaded successfully');
              this.pendingHashUpload = null;
            }
          } catch (saltError) {
            console.warn('[PIN] Could not upload salt/hash to cloud:', saltError.message);
            // Salt stays local, will sync on next sign-in
          }
          this.pendingSaltUpload = null;
        }

        // Done - hide screen and start app
        this.hideScreen();
        await this.onUnlock();

      } catch (error) {
        console.error('[PIN] Sign up failed:', error);
        errorEl.textContent = error.message || 'Sign up failed';
        errorEl.classList.remove('hidden');
        signUpBtn.disabled = false;
        signUpBtn.textContent = 'Begin';
      }
    });

    skipBtn.addEventListener('click', () => {
      // Skip sign-up, just use local storage
      console.log('[PIN] Skipping sign up, using local only');
      this.hideScreen();
      this.onUnlock();
    });

    // Enter key submits
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') signUpBtn.click();
    });
  },

  // ==================
  // EXISTING USER PIN ENTRY (verify by decryption)
  // ==================

  showExistingUserPINScreen() {
    const screen = document.getElementById('pin-screen');

    screen.innerHTML = `
      <div class="pin-container">
        <div class="pin-header">
          <span class="pin-brand">Your mirror in code</span>
        </div>

        <div class="pin-content">
          <h2 class="pin-title">Welcome back</h2>
          <p class="pin-subtitle">Enter your existing PIN</p>

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

        <p class="pin-hint">Same PIN you use on other devices</p>
      </div>
    `;

    this.attachExistingUserPINListeners();
  },

  attachExistingUserPINListeners() {
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

        // Auto-submit when 6 digits
        if (currentPIN.length === 6) {
          error.classList.add('hidden');
          this.isProcessing = true;
          this.showLoading();

          await new Promise(r => setTimeout(r, 50));

          try {
            let verified = false;
            const saltB64 = localStorage.getItem(this.SALT_KEY);
            const storedHash = localStorage.getItem(this.HASH_KEY);

            // Try hash-based verification first (if we have cloud hash)
            if (storedHash && this.cloudPinHashFetched) {
              console.log('[PIN] Verifying using cloud PIN hash...');
              const inputHash = await this.simpleHash(currentPIN + saltB64);
              verified = inputHash === storedHash;
              if (verified) {
                console.log('[PIN] Hash verification successful');
                // Derive encryption key
                this.encryptionKey = await this.deriveKeySimple(currentPIN, saltB64);
              }
            }

            // Fall back to decryption-based verification if hash didn't work
            if (!verified) {
              console.log('[PIN] Falling back to decryption verification...');
              verified = await this.verifyPINByDecryption(currentPIN);
              if (verified) {
                // Save hash locally for future unlocks AND upload to cloud
                const hashB64 = await this.simpleHash(currentPIN + saltB64);
                localStorage.setItem(this.HASH_KEY, hashB64);
                // Upload hash to cloud for future cross-device sync
                if (typeof Sync !== 'undefined' && Sync.user && Sync.isAuthenticated()) {
                  try {
                    await Sync.savePinHash(hashB64);
                    console.log('[PIN] PIN hash uploaded to cloud (migration)');
                  } catch (e) {
                    console.warn('[PIN] Could not upload PIN hash:', e.message);
                  }
                }
              }
            }

            if (verified) {
              this.isSetup = true;
              this.isUnlocked = true;

              // Force full sync
              console.log('[PIN] Existing user verified - forcing full sync');
              localStorage.removeItem('dt_last_sync');
              await Sync.syncNow();

              this.hideScreen();
              this.onUnlock();
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
          } catch (err) {
            console.error('[PIN] Verify error:', err);
            this.hideLoading();
            this.showError('Verification failed');
            currentPIN = '';
            dots.forEach(d => d.classList.remove('filled'));
          } finally {
            this.isProcessing = false;
          }
        }
      });
    });
  },

  /**
   * Verify PIN by trying to decrypt a note from cloud
   * Returns true if PIN can decrypt cloud data
   */
  async verifyPINByDecryption(pin) {
    const saltB64 = localStorage.getItem(this.SALT_KEY);
    if (!saltB64) {
      console.error('[PIN] No salt found');
      return false;
    }

    // Derive key from PIN + salt
    let testKey;
    try {
      testKey = await this.deriveKeySimple(pin, saltB64);
    } catch (e) {
      console.error('[PIN] Key derivation failed:', e);
      return false;
    }

    // Fetch one note from cloud to test decryption
    try {
      const { data: notes, error } = await Sync.supabase
        .from('notes')
        .select('encrypted_data')
        .eq('user_id', Sync.user.id)
        .is('deleted_at', null)
        .limit(1);

      if (error) {
        console.error('[PIN] Failed to fetch test note:', error);
        return false;
      }

      if (!notes || notes.length === 0) {
        // No notes to test - assume PIN is correct (new account with salt but no notes)
        console.log('[PIN] No notes to verify against, assuming correct');
        this.encryptionKey = testKey;
        return true;
      }

      // Try to decrypt
      const encryptedData = notes[0].encrypted_data;
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        testKey,
        ciphertext
      );

      // If we get here, decryption succeeded - PIN is correct
      console.log('[PIN] Decryption test passed - PIN verified');
      this.encryptionKey = testKey;
      return true;

    } catch (e) {
      console.error('[PIN] Decryption test failed:', e);
      return false;
    }
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
          <span class="pin-brand">Your mirror in code</span>
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
          <span class="pin-brand">Your mirror in code</span>
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
          <span class="pin-brand">Your mirror in code</span>
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

                // New user flow: show sign-up after PIN creation
                if (this.isNewUser && !Sync.isAuthenticated()) {
                  console.log('[PIN] New user - showing sign up');
                  this.showSignUpScreen();
                } else {
                  // Existing user flow: already signed in, just unlock
                  // Force full sync for existing user on new device
                  if (this.cloudSaltFetched && typeof Sync !== 'undefined' && Sync.user) {
                    console.log('[PIN] Existing user - forcing full sync');
                    localStorage.removeItem('dt_last_sync');
                    await Sync.syncNow();
                  }
                  this.hideScreen();
                  console.log('[PIN] Confirm: Screen hidden, calling onUnlock');
                  this.onUnlock();
                }
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
                // Clear lockout on success
                this.clearLockout();
                this.isUnlocked = true;

                // MIGRATION: Upload PIN hash to cloud if not already there
                // This ensures existing users get their hash synced for cross-device use
                if (typeof Sync !== 'undefined' && Sync.user && Sync.isAuthenticated()) {
                  try {
                    const cloudHash = await Sync.fetchPinHash();
                    if (!cloudHash) {
                      console.log('[PIN] No cloud hash found, uploading for migration...');
                      const saltB64 = localStorage.getItem(this.SALT_KEY);
                      const hashB64 = await this.simpleHash(currentPIN + saltB64);
                      await Sync.savePinHash(hashB64);
                      console.log('[PIN] PIN hash migrated to cloud successfully');
                    }
                  } catch (e) {
                    console.warn('[PIN] Migration check failed:', e.message);
                  }
                }

                this.hideScreen();
                // Initialize app after unlock
                this.onUnlock();
              } else {
                this.hideLoading();
                // Track failed attempt
                const attemptsRemaining = this.MAX_ATTEMPTS - this.getAttemptCount() - 1;
                const isNowLocked = this.recordFailedAttempt();

                if (isNowLocked) {
                  // Show lockout screen
                  this.showLockoutScreen();
                } else {
                  // Show error with remaining attempts
                  if (attemptsRemaining <= 2 && attemptsRemaining > 0) {
                    this.showError(`Incorrect PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`);
                  } else {
                    this.showError('Incorrect PIN');
                  }
                  currentPIN = '';
                  dots.forEach(d => d.classList.remove('filled'));
                  // Shake animation
                  document.getElementById('pin-dots').classList.add('shake');
                  setTimeout(() => {
                    document.getElementById('pin-dots').classList.remove('shake');
                  }, 500);
                }
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
  async onUnlock() {
    // Initialize sync if available
    if (typeof Sync !== 'undefined') {
      await Sync.init();

      // CRITICAL: Ensure salt is in cloud for cross-device sync
      // This handles cases where salt wasn't uploaded during initial setup
      if (Sync.user && Sync.isAuthenticated()) {
        const localSalt = localStorage.getItem(this.SALT_KEY);
        if (localSalt) {
          try {
            const cloudSalt = await Sync.fetchSalt();
            if (!cloudSalt) {
              console.log('[PIN] No salt in cloud, uploading local salt...');
              await Sync.saveSalt(localSalt);
              console.log('[PIN] Salt uploaded to cloud successfully');
            }
          } catch (e) {
            console.warn('[PIN] Salt sync check failed:', e.message);
          }
        }
      }
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
          <span class="pin-brand">Your mirror in code</span>
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
          <span class="pin-brand">Your mirror in code</span>
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
          <span class="pin-brand">Your mirror in code</span>
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
      let saltB64;

      // Step 1: Check if salt already exists in localStorage (existing user flow)
      const existingSalt = localStorage.getItem(this.SALT_KEY);
      if (existingSalt && this.cloudSaltFetched) {
        console.log('[PIN] Step 1: Using salt fetched from cloud');
        saltB64 = existingSalt;
      }

      // Step 2: If no existing salt, generate new one (new user flow)
      if (!saltB64) {
        console.log('[PIN] Step 2: Generating new salt...');
        const saltArray = crypto.getRandomValues(new Uint8Array(16));
        saltB64 = btoa(String.fromCharCode(...saltArray));
        this.pendingSaltUpload = saltB64; // Will upload after sign-up
      }
      console.log('[PIN] Salt OK');

      // Step 3: Hash PIN for verification (simple SHA-256, no PBKDF2)
      console.log('[PIN] Step 3: Hashing PIN...');
      const hashB64 = await this.simpleHash(pin + saltB64);
      console.log('[PIN] Hash OK');

      // Step 4: Derive encryption key (simple method, iOS-safe)
      console.log('[PIN] Step 4: Deriving key...');
      this.encryptionKey = await this.deriveKeySimple(pin, saltB64);
      console.log('[PIN] Key OK');

      // Step 5: Save to localStorage
      console.log('[PIN] Step 5: Saving to localStorage...');
      localStorage.setItem(this.SALT_KEY, saltB64);
      localStorage.setItem(this.HASH_KEY, hashB64);
      console.log('[PIN] localStorage OK');

      // Step 6: CRITICAL - Upload salt AND pin_hash to cloud if user is signed in
      // This ensures cross-device sync works even if user signed in before creating PIN
      if (typeof Sync !== 'undefined' && Sync.user && Sync.isAuthenticated()) {
        console.log('[PIN] Step 6: Uploading salt and PIN hash to cloud (user already signed in)...');
        try {
          await Sync.saveSalt(saltB64);
          console.log('[PIN] Salt uploaded to cloud successfully');
          // Also save PIN hash for cross-device verification
          await Sync.savePinHash(hashB64);
          console.log('[PIN] PIN hash uploaded to cloud successfully');
        } catch (saltError) {
          console.warn('[PIN] Could not upload salt/hash to cloud:', saltError.message);
          // Will retry on next sync
        }
      } else {
        console.log('[PIN] Step 6: Salt will be uploaded after sign-up (pendingSaltUpload set)');
        // Also store hash for later upload
        this.pendingHashUpload = hashB64;
      }

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
        localStorage.setItem(this.FALLBACK_KEY, 'true');
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
      const isFallback = localStorage.getItem(this.FALLBACK_KEY) === 'true';

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
      'This will sign you out and clear local data. You can sign back in and create a new PIN. Continue?'
    );

    if (!confirmed) return;

    console.log('[PIN] Forgot PIN - clearing all PIN data');

    // Clear all PIN-related localStorage keys
    Object.keys(localStorage)
      .filter(k => k.includes('pin'))
      .forEach(k => {
        console.log('[PIN] Removing:', k);
        localStorage.removeItem(k);
      });

    // Clear lockout data
    localStorage.removeItem(this.LOCKOUT_KEY);
    localStorage.removeItem(this.ATTEMPTS_KEY);

    // Sign out if authenticated
    if (typeof Sync !== 'undefined' && Sync.isAuthenticated()) {
      try {
        await Sync.signOut();
      } catch (e) {
        console.warn('[PIN] Sign out error:', e);
      }
    }

    // Reload to start fresh
    location.reload();
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
  },

  /**
   * Export the encryption key as Base64 for use in API requests
   * @returns {Promise<string|null>} Base64-encoded 256-bit key, or null if not unlocked
   */
  async getEncryptionKeyBase64() {
    if (!this.encryptionKey) return null;
    try {
      const exported = await crypto.subtle.exportKey('raw', this.encryptionKey);
      return btoa(String.fromCharCode(...new Uint8Array(exported)));
    } catch (e) {
      console.error('[PIN] Failed to export encryption key:', e);
      return null;
    }
  }
};

// Export for global access
window.PIN = PIN;
