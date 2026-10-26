/**
 * @file contentFilter.js
 * @description Case-insensitive matching, text normalization, educational context exception handling, and local blocklist checking.
 */

const { BLOCKED_WORDS, SEVERE_SLURS, BLOCKED_PHRASES, EDUCATIONAL_TERMS, EDUCATIONAL_PATTERNS } = require('./blocklist');

/**
 * Leetspeak character mapping for text normalization
 */
const LEET_MAP = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
  '8': 'b'
};

/**
 * Standard user-facing rejection message (Task 6.5).
 * Does not reveal internal filtering rules, matched words, or normalization details.
 */
const REJECTION_MESSAGE = "Your question contains language that isn't allowed. Please revise it and try again.";

/**
 * Normalizes text for filter detection:
 * 1. Converts to lowercase.
 * 2. Removes Unicode diacritical marks/accents (NFD normalization).
 * 3. Replaces common leetspeak characters according to LEET_MAP.
 * 
 * @param {string} text 
 * @returns {string} Normalized string
 */
function normalizeText(text) {
  if (typeof text !== 'string') return '';

  let normalized = text.toLowerCase();

  // Strip Unicode diacritics / accents (e.g., é -> e)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Substitute common leetspeak characters
  let substituted = '';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    substituted += LEET_MAP[char] !== undefined ? LEET_MAP[char] : char;
  }

  return substituted;
}

/**
 * Collapses single-letter sequences separated by spaces or punctuation (e.g. "f.u.c.k", "f u c k", "s_h_i_t" -> "fuck", "shit")
 * to detect spacing/punctuation evasion without affecting multi-letter words (preventing false positives).
 * 
 * @param {string} text 
 * @returns {string} Text with single-letter evasion collapsed
 */
function collapseEvasionSpacers(text) {
  return text.replace(/\b[a-z0-9](?:[\s._-]+[a-z0-9])+\b/gi, (match) => {
    return match.replace(/[\s._-]/g, '');
  });
}

/**
 * Evaluates whether text represents an educational question regarding sexual health, consent, puberty, anatomy, or boundaries.
 * Tasks 6.7 & 6.8: Avoids keyword-only false positives for educational topics using word boundary checking for single-word terms.
 * 
 * @param {string} normalizedText 
 * @param {string[]} tokens 
 * @returns {boolean}
 */
function isEducationalQuestion(normalizedText, tokens) {
  if (!normalizedText) return false;

  // Check presence of educational terms or topics (use token boundary check for single words)
  const hasEduTerm = EDUCATIONAL_TERMS.some((term) => {
    if (term.includes(' ')) {
      return normalizedText.includes(term);
    }
    return tokens.includes(term);
  });

  const hasEduPattern = EDUCATIONAL_PATTERNS.some((pattern) => normalizedText.includes(pattern));

  return hasEduTerm || (hasEduPattern && tokens.length >= 3);
}

/**
 * Checks submitted text against the local blocklist and educational context rules.
 * 
 * @param {string} text - Raw student input text
 * @returns {{ isBlocked: boolean, message?: string, reason?: string }} Result object
 */
function checkContent(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { isBlocked: false };
  }

  const normalized = normalizeText(text);

  // 1. Unconditionally Block Harassment Phrases & Severe Slurs in ALL Contexts
  for (const phrase of BLOCKED_PHRASES) {
    const normalizedPhrase = normalizeText(phrase);
    if (normalized.includes(normalizedPhrase)) {
      return {
        isBlocked: true,
        message: REJECTION_MESSAGE,
        reason: 'blocked_phrase'
      };
    }
  }

  const tokenizedCleanText = normalized.replace(/[^a-z0-9]/g, ' ');
  const tokens = tokenizedCleanText.split(/\s+/).filter(Boolean);

  if (Array.isArray(SEVERE_SLURS)) {
    for (const token of tokens) {
      if (SEVERE_SLURS.includes(token)) {
        return {
          isBlocked: true,
          message: REJECTION_MESSAGE,
          reason: 'severe_slur'
        };
      }
    }
  }

  // 2. Educational Context Check (Tasks 6.7 & 6.8)
  // Legitimate educational discussions about sexual health, puberty, anatomy, boundaries, or consent are permitted.
  if (isEducationalQuestion(normalized, tokens)) {
    // Verify question does not contain explicit profanity or slurs
    let containsExplicitProfanity = false;
    for (const token of tokens) {
      if (BLOCKED_WORDS.includes(token)) {
        containsExplicitProfanity = true;
        break;
      }
    }

    if (!containsExplicitProfanity) {
      return { isBlocked: false, educational: true };
    }
  }

  // 3. Standard Word Boundary Check on Normalized Tokens
  for (const token of tokens) {
    if (BLOCKED_WORDS.includes(token)) {
      return {
        isBlocked: true,
        message: REJECTION_MESSAGE,
        reason: 'blocked_word'
      };
    }
  }

  // 4. Check Spacing/Punctuation Evasion (e.g. "f.u.c.k", "f u c k", "s_h_i_t")
  const collapsedText = collapseEvasionSpacers(normalized);
  if (collapsedText !== normalized) {
    const collapsedCleanText = collapsedText.replace(/[^a-z0-9]/g, ' ');
    const collapsedTokens = collapsedCleanText.split(/\s+/).filter(Boolean);

    for (const token of collapsedTokens) {
      if (BLOCKED_WORDS.includes(token)) {
        return {
          isBlocked: true,
          message: REJECTION_MESSAGE,
          reason: 'evasion_blocked_word'
        };
      }
    }
  }

  return { isBlocked: false };
}

module.exports = {
  REJECTION_MESSAGE,
  normalizeText,
  collapseEvasionSpacers,
  isEducationalQuestion,
  checkContent
};
