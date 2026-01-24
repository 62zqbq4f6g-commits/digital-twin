/**
 * Server-side encryption utilities for derived data (Edge Runtime)
 * Uses Web Crypto API for AES-256-GCM authenticated encryption
 * Compatible with Edge functions and client-side decryption
 */

/**
 * Encrypt data for storage
 * @param {Object} data - Object to encrypt
 * @param {string} keyBase64 - Base64-encoded 256-bit encryption key
 * @returns {Promise<string>} Encrypted string in format: base64(iv):base64(authTag):base64(encrypted)
 */
export async function encryptForStorage(data, keyBase64) {
  if (!data || !keyBase64) {
    throw new Error('Data and key are required for encryption');
  }

  try {
    // Decode the key from base64
    const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

    // Validate key length (256 bits = 32 bytes)
    if (keyBytes.length !== 32) {
      throw new Error(`Invalid key length: ${keyBytes.length} bytes (expected 32)`);
    }

    // Import the key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate random 16-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Encrypt the JSON-stringified data
    const jsonData = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonData);

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      cryptoKey,
      dataBytes
    );

    // The encrypted data includes the auth tag at the end (16 bytes)
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const encrypted = encryptedArray.slice(0, encryptedArray.length - 16);
    const authTag = encryptedArray.slice(encryptedArray.length - 16);

    // Convert to base64
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const authTagBase64 = btoa(String.fromCharCode(...authTag));
    const encryptedBase64 = btoa(String.fromCharCode(...encrypted));

    // Return in format: iv:authTag:encrypted (all base64)
    return `${ivBase64}:${authTagBase64}:${encryptedBase64}`;
  } catch (error) {
    console.error('[Encryption] encryptForStorage error:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt data from storage
 * @param {string} encryptedString - Encrypted string in format: base64(iv):base64(authTag):base64(encrypted)
 * @param {string} keyBase64 - Base64-encoded 256-bit encryption key
 * @returns {Promise<Object>} Decrypted data object
 */
export async function decryptFromStorage(encryptedString, keyBase64) {
  if (!encryptedString || !keyBase64) {
    throw new Error('Encrypted string and key are required for decryption');
  }

  try {
    // Split the encrypted string into components
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format (expected iv:authTag:encrypted)');
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;

    // Decode from base64
    const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const authTag = Uint8Array.from(atob(authTagBase64), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    // Validate key length
    if (keyBytes.length !== 32) {
      throw new Error(`Invalid key length: ${keyBytes.length} bytes (expected 32)`);
    }

    // Import the key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Combine encrypted data and auth tag (Web Crypto API expects them together)
    const combined = new Uint8Array(encrypted.length + authTag.length);
    combined.set(encrypted);
    combined.set(authTag, encrypted.length);

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      cryptoKey,
      combined
    );

    // Decode and parse JSON
    const decoder = new TextDecoder();
    const decrypted = decoder.decode(decryptedBuffer);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Encryption] decryptFromStorage error:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Check if an encryption key is valid
 * @param {string} keyBase64 - Base64-encoded key to validate
 * @returns {boolean} True if key is valid
 */
export function isValidKey(keyBase64) {
  if (!keyBase64 || typeof keyBase64 !== 'string') {
    return false;
  }
  try {
    const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    return keyBytes.length === 32;
  } catch {
    return false;
  }
}
