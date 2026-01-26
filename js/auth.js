/**
 * Inscript - Simple Auth Module
 * Email/password only - no PIN
 * v6.0.0 - Simplified auth flow
 */

const Auth = {
  isAuthenticated: false,
  encryptionKey: null,

  /**
   * Initialize auth - check Supabase session
   * Returns true if authenticated, false if needs login
   */
  async init() {
    console.log('[Auth] Initializing...');

    // Wait for Sync to initialize and check session
    if (typeof Sync !== 'undefined') {
      await Sync.init();

      if (Sync.isAuthenticated()) {
        console.log('[Auth] Session found, user:', Sync.user.email);
        this.isAuthenticated = true;

        // Derive encryption key from user ID
        await this.deriveKeyFromUser(Sync.user.id);
        return true;
      }
    }

    console.log('[Auth] No session, showing auth screen');
    return false;
  },

  /**
   * Derive encryption key from user ID (deterministic)
   * This replaces PIN-based encryption
   */
  async deriveKeyFromUser(userId) {
    // Fetch salt from cloud, or create if new user
    let salt = await Sync.fetchSalt();

    if (!salt) {
      // New user - generate and save salt
      console.log('[Auth] New user, generating salt...');
      const saltArray = crypto.getRandomValues(new Uint8Array(16));
      salt = btoa(String.fromCharCode(...saltArray));
      await Sync.saveSalt(salt);
    }

    // Derive key from user ID + salt
    const keyData = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(userId + salt)
    );

    this.encryptionKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );

    console.log('[Auth] Encryption key derived');
  },

  /**
   * Show auth screen (sign in / sign up)
   */
  showAuthScreen() {
    const screen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app');

    if (!screen) {
      console.error('[Auth] Auth screen element not found');
      return;
    }

    screen.classList.remove('hidden');
    if (appContent) appContent.classList.add('hidden');

    // Hide the app skeleton when showing auth screen
    this.hideAppSkeleton();

    this.attachAuthListeners();
  },

  /**
   * Hide auth screen and show app
   */
  hideAuthScreen() {
    const screen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app');

    if (screen) screen.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');

    // Hide the app skeleton with fade transition
    this.hideAppSkeleton();
  },

  /**
   * Hide the initial app skeleton
   */
  hideAppSkeleton() {
    const skeleton = document.getElementById('app-skeleton');
    if (skeleton) {
      skeleton.classList.add('hidden');
      setTimeout(() => skeleton.remove(), 300);
    }
  },

  /**
   * Attach listeners to auth form
   */
  attachAuthListeners() {
    // Sign in form
    const signinBtn = document.getElementById('auth-signin-btn');
    const signupBtn = document.getElementById('auth-signup-btn');
    const showSignupBtn = document.getElementById('show-signup-btn');
    const showSigninBtn = document.getElementById('show-signin-btn');

    if (signinBtn) {
      signinBtn.addEventListener('click', () => this.handleSignIn());
    }

    if (signupBtn) {
      signupBtn.addEventListener('click', () => this.handleSignUp());
    }

    if (showSignupBtn) {
      showSignupBtn.addEventListener('click', () => this.showSignUpForm());
    }

    if (showSigninBtn) {
      showSigninBtn.addEventListener('click', () => this.showSignInForm());
    }

    // Enter key submits
    const signinPassword = document.getElementById('auth-signin-password');
    const signupPassword = document.getElementById('auth-signup-password');

    if (signinPassword) {
      signinPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleSignIn();
      });
    }

    if (signupPassword) {
      signupPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleSignUp();
      });
    }
  },

  /**
   * Show sign in form
   */
  showSignInForm() {
    const signinForm = document.getElementById('auth-signin-form');
    const signupForm = document.getElementById('auth-signup-form');

    if (signinForm) signinForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
  },

  /**
   * Show sign up form
   */
  showSignUpForm() {
    const signinForm = document.getElementById('auth-signin-form');
    const signupForm = document.getElementById('auth-signup-form');

    if (signinForm) signinForm.classList.add('hidden');
    if (signupForm) signupForm.classList.remove('hidden');
  },

  /**
   * Handle sign in
   */
  async handleSignIn() {
    const email = document.getElementById('auth-signin-email')?.value?.trim();
    const password = document.getElementById('auth-signin-password')?.value;
    const error = document.getElementById('auth-signin-error');
    const btn = document.getElementById('auth-signin-btn');

    if (!email || !password) {
      if (error) {
        error.textContent = 'Please enter email and password';
        error.classList.remove('hidden');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Signing in...';
    }
    if (error) error.classList.add('hidden');

    try {
      await Sync.signIn(email, password);
      console.log('[Auth] Sign in successful');

      // Derive encryption key
      await this.deriveKeyFromUser(Sync.user.id);
      this.isAuthenticated = true;

      // Hide auth screen and start app
      this.hideAuthScreen();
      await this.onAuthenticated();

    } catch (err) {
      console.error('[Auth] Sign in failed:', err);
      if (error) {
        error.textContent = err.message || 'Sign in failed';
        error.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    }
  },

  /**
   * Handle sign up
   */
  async handleSignUp() {
    const email = document.getElementById('auth-signup-email')?.value?.trim();
    const password = document.getElementById('auth-signup-password')?.value;
    const error = document.getElementById('auth-signup-error');
    const btn = document.getElementById('auth-signup-btn');

    if (!email || !password) {
      if (error) {
        error.textContent = 'Please enter email and password';
        error.classList.remove('hidden');
      }
      return;
    }

    if (password.length < 6) {
      if (error) {
        error.textContent = 'Password must be at least 6 characters';
        error.classList.remove('hidden');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating account...';
    }
    if (error) error.classList.add('hidden');

    try {
      await Sync.signUp(email, password);
      console.log('[Auth] Sign up successful');

      // Derive encryption key (will create salt for new user)
      await this.deriveKeyFromUser(Sync.user.id);
      this.isAuthenticated = true;

      // Hide auth screen and start app
      this.hideAuthScreen();
      await this.onAuthenticated();

    } catch (err) {
      console.error('[Auth] Sign up failed:', err);
      if (error) {
        error.textContent = err.message || 'Sign up failed';
        error.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Begin';
      }
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    console.log('[Auth] Signing out...');

    this.isAuthenticated = false;
    this.encryptionKey = null;

    if (typeof Sync !== 'undefined') {
      await Sync.signOut();
    }

    // Reload to show auth screen
    location.reload();
  },

  /**
   * Called after successful authentication
   * Initialize the app
   */
  async onAuthenticated() {
    console.log('[Auth] onAuthenticated called');

    // This will be overridden in index.html to start the app
  },

  // ==================
  // ENCRYPTION API
  // ==================

  /**
   * Encrypt data
   */
  async encrypt(plaintext) {
    if (!this.encryptionKey) throw new Error('Not authenticated');

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

  /**
   * Decrypt data
   */
  async decrypt(ciphertextB64) {
    if (!this.encryptionKey) throw new Error('Not authenticated');

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
   * Get encryption key as base64 string for API headers
   * @returns {string|null} Base64-encoded encryption key
   */
  async getEncryptionKeyBase64() {
    if (!this.encryptionKey) return null;

    try {
      const exported = await crypto.subtle.exportKey('raw', this.encryptionKey);
      return btoa(String.fromCharCode(...new Uint8Array(exported)));
    } catch (error) {
      console.warn('[Auth] Failed to export encryption key:', error);
      return null;
    }
  }
};

// Export for global access
window.Auth = Auth;
