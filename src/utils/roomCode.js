/**
 * @file roomCode.js
 * @description Utility for generating and validating short, human-readable room codes using Node.js built-in crypto module.
 */

const crypto = require('crypto');

// Human-friendly charset excluding visually ambiguous characters (O, 0, I, 1)
const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_GENERATE_ATTEMPTS = 10;

/**
 * Generates a random 6-character room code.
 * @returns {string} 6-character uppercase room code.
 */
function generateRawRoomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALLOWED_CHARS[bytes[i] % ALLOWED_CHARS.length];
  }
  return code;
}

/**
 * Generates a unique room code, checking for collisions against an exists check function.
 * @param {Function} existsFn - Function(code) returning true if code is already in use.
 * @returns {string} Unique room code.
 */
function generateUniqueRoomCode(existsFn = () => false) {
  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const code = generateRawRoomCode();
    if (!existsFn(code)) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique room code after maximum retry attempts');
}

/**
 * Normalizes a room code input string.
 * @param {string} code 
 * @returns {string}
 */
function normalizeRoomCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

/**
 * Validates whether a string matches the required room code format.
 * @param {string} code 
 * @returns {boolean}
 */
function isValidRoomCodeFormat(code) {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== CODE_LENGTH) {
    return false;
  }
  const regex = new RegExp(`^[${ALLOWED_CHARS}]{${CODE_LENGTH}}$`);
  return regex.test(normalized);
}

module.exports = {
  CODE_LENGTH,
  ALLOWED_CHARS,
  generateUniqueRoomCode,
  normalizeRoomCode,
  isValidRoomCodeFormat
};
