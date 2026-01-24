/**
 * Server-side encryption utilities for derived data
 * Uses AES-256-GCM for authenticated encryption
 * Compatible with client-side encryption format
 */

const crypto = require('crypto');

/**
 * Encrypt data for storage
 * @param {Object} data - Object to encrypt
 * @param {string} keyBase64 - Base64-encoded 256-bit encryption key
 * @returns {string} Encrypted string in format: base64(iv):base64(authTag):base64(encrypted)
 */
function encryptForStorage(data, keyBase64) {
  if (!data || !keyBase64) {
    throw new Error('Data and key are required for encryption');
  }

  try {
    // Decode the key from base64
    const key = Buffer.from(keyBase64, 'base64');

    // Validate key length (256 bits = 32 bytes)
    if (key.length !== 32) {
      throw new Error(`Invalid key length: ${key.length} bytes (expected 32)`);
    }

    // Generate random 16-byte IV
    const iv = crypto.randomBytes(16);

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Encrypt the JSON-stringified data
    const jsonData = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(jsonData, 'utf8'),
      cipher.final()
    ]);

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Return in format: iv:authTag:encrypted (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  } catch (error) {
    console.error('[Encryption] encryptForStorage error:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt data from storage
 * @param {string} encryptedString - Encrypted string in format: base64(iv):base64(authTag):base64(encrypted)
 * @param {string} keyBase64 - Base64-encoded 256-bit encryption key
 * @returns {Object} Decrypted data object
 */
function decryptFromStorage(encryptedString, keyBase64) {
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
    const key = Buffer.from(keyBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    // Validate key length
    if (key.length !== 32) {
      throw new Error(`Invalid key length: ${key.length} bytes (expected 32)`);
    }

    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    // Parse JSON and return
    return JSON.parse(decrypted.toString('utf8'));
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
function isValidKey(keyBase64) {
  if (!keyBase64 || typeof keyBase64 !== 'string') {
    return false;
  }
  try {
    const key = Buffer.from(keyBase64, 'base64');
    return key.length === 32;
  } catch {
    return false;
  }
}

module.exports = {
  encryptForStorage,
  decryptFromStorage,
  isValidKey
};
