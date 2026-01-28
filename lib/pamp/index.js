/**
 * PAMP - Portable AI Memory Protocol
 *
 * Module exports for PAMP v2.0 functionality.
 *
 * Usage:
 *   import { validatePAMP, isValidPAMP } from '../lib/pamp';
 */

export {
  validatePAMP,
  isValidPAMP,
  getPAMPVersion,
  isEncrypted,
  getEncryptedFields,
  PAMPError
} from './validator.js';

// Version constant
export const PAMP_VERSION = '2.0.0';
export const PAMP_CONTEXT = 'https://pamp.ai/schema/v2';
