/**
 * Inscript Client-Side Encryption
 *
 * Zero-knowledge encryption using Web Crypto API.
 * AES-256-GCM with PBKDF2 key derivation.
 * Keys are derived from user password and NEVER leave the browser.
 *
 * @version 1.0.0
 * @module encryption
 */

// ============================================
// Constants
// ============================================

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16; // 128 bits
const ITERATIONS = 100000; // PBKDF2 iterations
const KEY_CHECK_VALUE = 'INSCRIPT_KEY_CHECK_V1';

// Local storage keys (prefixed to avoid collisions)
const STORAGE_KEYS = {
  SALT: 'inscript_enc_salt',
  KEY_CHECK: 'inscript_enc_key_check',
  RECOVERY_HASH: 'inscript_enc_recovery_hash',
  VERSION: 'inscript_enc_version'
};

// In-memory key cache (cleared on page unload)
let cachedKey = null;

// ============================================
// Utility Functions
// ============================================

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================
// Core Encryption Functions
// ============================================

/**
 * Generate a random salt for key derivation
 * @returns {string} Base64-encoded salt
 */
function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToBase64(salt);
}

/**
 * Generate a recovery key in XXXX-XXXX-XXXX-XXXX format
 * High entropy: 128 bits of randomness
 * @returns {string} Recovery key
 */
function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.match(/.{4}/g).join('-').toUpperCase();
}

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - User's password
 * @param {string} saltB64 - Base64-encoded salt
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
async function deriveKey(password, saltB64) {
  if (!password || !saltB64) {
    throw new Error('Password and salt are required');
  }

  const encoder = new TextEncoder();
  const salt = base64ToArrayBuffer(saltB64);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive key from recovery key
 * Recovery key is normalized (remove dashes, uppercase) before derivation
 * @param {string} recoveryKey - Recovery key (XXXX-XXXX-XXXX-XXXX format)
 * @param {string} saltB64 - Base64-encoded salt
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
async function deriveKeyFromRecovery(recoveryKey, saltB64) {
  if (!recoveryKey || !saltB64) {
    throw new Error('Recovery key and salt are required');
  }

  // Normalize: remove dashes, uppercase
  const normalized = recoveryKey.replace(/-/g, '').toUpperCase();
  return deriveKey(normalized, saltB64);
}

/**
 * Encrypt plaintext string
 * @param {string} plaintext - Text to encrypt
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<string>} Base64-encoded ciphertext (IV prepended)
 */
async function encrypt(plaintext, key) {
  if (!plaintext || !key) {
    throw new Error('Plaintext and key are required');
  }

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined);
}

/**
 * Decrypt ciphertext string
 * @param {string} ciphertextB64 - Base64-encoded ciphertext (IV prepended)
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<string>} Decrypted plaintext
 */
async function decrypt(ciphertextB64, key) {
  if (!ciphertextB64 || !key) {
    throw new Error('Ciphertext and key are required');
  }

  const combined = base64ToArrayBuffer(ciphertextB64);

  if (combined.length < IV_LENGTH + 1) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt an object (JSON-serialized)
 * @param {Object} obj - Object to encrypt
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<string>} Base64-encoded ciphertext
 */
async function encryptObject(obj, key) {
  if (obj === null || obj === undefined) {
    throw new Error('Object is required');
  }
  return encrypt(JSON.stringify(obj), key);
}

/**
 * Decrypt to object
 * @param {string} ciphertextB64 - Base64-encoded ciphertext
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<Object>} Decrypted object
 */
async function decryptObject(ciphertextB64, key) {
  const plaintext = await decrypt(ciphertextB64, key);
  return JSON.parse(plaintext);
}

/**
 * Hash a value using SHA-256
 * @param {string} value - Value to hash
 * @returns {Promise<string>} Base64-encoded hash
 */
async function hashValue(value) {
  if (!value) {
    throw new Error('Value is required');
  }
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return arrayBufferToBase64(new Uint8Array(hash));
}

/**
 * Verify a value against its hash
 * @param {string} value - Value to verify
 * @param {string} hashB64 - Base64-encoded hash
 * @returns {Promise<boolean>} True if hash matches
 */
async function verifyHash(value, hashB64) {
  if (!value || !hashB64) {
    return false;
  }
  const computed = await hashValue(value);
  return constantTimeCompare(computed, hashB64);
}

// ============================================
// Key Storage Functions (localStorage)
// Keys NEVER sent to server
// ============================================

/**
 * Store salt in localStorage
 * @param {string} salt - Base64-encoded salt
 */
function storeSalt(salt) {
  if (!salt) {
    throw new Error('Salt is required');
  }
  localStorage.setItem(STORAGE_KEYS.SALT, salt);
  localStorage.setItem(STORAGE_KEYS.VERSION, '1');
}

/**
 * Get salt from localStorage
 * @returns {string|null} Base64-encoded salt or null
 */
function getSalt() {
  return localStorage.getItem(STORAGE_KEYS.SALT);
}

/**
 * Store key check value (encrypted known value for password verification)
 * @param {CryptoKey} key - AES-GCM key
 */
async function storeKeyCheck(key) {
  if (!key) {
    throw new Error('Key is required');
  }
  const check = await encrypt(KEY_CHECK_VALUE, key);
  localStorage.setItem(STORAGE_KEYS.KEY_CHECK, check);
}

/**
 * Verify password by attempting to decrypt key check value
 * @param {string} password - Password to verify
 * @param {string} salt - Base64-encoded salt
 * @returns {Promise<{valid: boolean, key: CryptoKey|null}>}
 */
async function verifyPassword(password, salt) {
  try {
    if (!password || !salt) {
      return { valid: false, key: null };
    }

    const key = await deriveKey(password, salt);
    const check = localStorage.getItem(STORAGE_KEYS.KEY_CHECK);

    if (!check) {
      return { valid: false, key: null };
    }

    const decrypted = await decrypt(check, key);

    if (decrypted === KEY_CHECK_VALUE) {
      return { valid: true, key };
    }

    return { valid: false, key: null };
  } catch (e) {
    // Decryption failed = wrong password
    return { valid: false, key: null };
  }
}

// ============================================
// In-Memory Key Cache
// ============================================

/**
 * Set cached key in memory
 * @param {CryptoKey} key
 */
function setCachedKey(key) {
  cachedKey = key;
}

/**
 * Get cached key from memory
 * @returns {CryptoKey|null}
 */
function getCachedKey() {
  return cachedKey;
}

/**
 * Clear cached key from memory
 */
function clearCachedKey() {
  cachedKey = null;
}

// ============================================
// Status Functions
// ============================================

/**
 * Check if encryption is set up for this device
 * @returns {boolean}
 */
function isEncryptionSetup() {
  const salt = getSalt();
  const keyCheck = localStorage.getItem(STORAGE_KEYS.KEY_CHECK);
  return salt !== null && keyCheck !== null;
}

/**
 * Check if encryption is currently unlocked
 * @returns {boolean}
 */
function isUnlocked() {
  return cachedKey !== null;
}

/**
 * Get encryption version
 * @returns {string|null}
 */
function getEncryptionVersion() {
  return localStorage.getItem(STORAGE_KEYS.VERSION);
}

// ============================================
// Recovery Key Hash Storage
// ============================================

/**
 * Store recovery key hash
 * @param {string} hashB64 - Base64-encoded hash of recovery key
 */
function storeRecoveryKeyHash(hashB64) {
  localStorage.setItem(STORAGE_KEYS.RECOVERY_HASH, hashB64);
}

/**
 * Get recovery key hash
 * @returns {string|null}
 */
function getRecoveryKeyHash() {
  return localStorage.getItem(STORAGE_KEYS.RECOVERY_HASH);
}

// ============================================
// Clear All Encryption Data (Danger Zone)
// ============================================

/**
 * Clear all encryption data from localStorage
 * Use with caution - data will be unrecoverable without backup
 */
function clearAllEncryptionData() {
  localStorage.removeItem(STORAGE_KEYS.SALT);
  localStorage.removeItem(STORAGE_KEYS.KEY_CHECK);
  localStorage.removeItem(STORAGE_KEYS.RECOVERY_HASH);
  localStorage.removeItem(STORAGE_KEYS.VERSION);
  clearCachedKey();
}

// ============================================
// Export
// ============================================

// Make available globally for non-module usage
window.Encryption = {
  // Core functions
  generateSalt,
  generateRecoveryKey,
  deriveKey,
  deriveKeyFromRecovery,
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  hashValue,
  verifyHash,

  // Storage functions
  storeSalt,
  getSalt,
  storeKeyCheck,
  verifyPassword,
  storeRecoveryKeyHash,
  getRecoveryKeyHash,

  // Cache functions
  setCachedKey,
  getCachedKey,
  clearCachedKey,

  // Status functions
  isEncryptionSetup,
  isUnlocked,
  getEncryptionVersion,

  // Danger zone
  clearAllEncryptionData,

  // Constants (for reference)
  ALGORITHM,
  KEY_LENGTH,
  ITERATIONS
};
