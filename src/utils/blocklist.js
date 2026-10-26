/**
 * @file blocklist.js
 * @description Local configurable blocklist dictionary and educational health allowlists for content safety.
 * 
 * HOW TO MAINTAIN TERMS:
 * - Single Words: Add exact lowercase words to `BLOCKED_WORDS`. Word matching uses word boundaries.
 * - Multi-Word Phrases: Add phrases to `BLOCKED_PHRASES`. Phrase matching checks for complete sequence.
 * - Severe Slurs: Add hate speech terms to `SEVERE_SLURS` which are rejected in all contexts.
 * - Educational Context (Tasks 6.7 & 6.8): Terms in `EDUCATIONAL_TERMS` and `EDUCATIONAL_PATTERNS`
 *   allow legitimate discussions (sexual health, consent, puberty, anatomy, boundaries) without false positives.
 */

const BLOCKED_WORDS = [
  // Profanity & Vulgarity
  'fuck',
  'feck',
  'fck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'crap',
  'dick',
  'pussy',
  'cock',
  'cunt',
  'twat',
  'prick',
  'whore',
  'slut'
];

const SEVERE_SLURS = [
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'spic',
  'chink',
  'kike',
  'tranny'
];

const BLOCKED_PHRASES = [
  'kill yourself',
  'die in a fire',
  'go die',
  'shut up',
  'go away',
  'you suck',
  'screw you',
  'fuck off',
  'get lost'
];

/**
 * Educational health, anatomy, consent, and boundary terms (Tasks 6.7 & 6.8).
 * Ensures legitimate discussions about puberty, reproductive health, consent,
 * personal boundaries, and anatomy are accepted without false positives.
 */
const EDUCATIONAL_TERMS = [
  'puberty',
  'anatomy',
  'penis',
  'vagina',
  'vulva',
  'testicles',
  'breast',
  'breasts',
  'period',
  'menstruation',
  'condom',
  'condoms',
  'contraception',
  'birth control',
  'sti',
  'stds',
  'std',
  'stis',
  'consent',
  'boundaries',
  'personal boundaries',
  'sexual health',
  'reproductive health',
  'intercourse',
  'erection',
  'wet dream',
  'ejaculation',
  'abstinence',
  'protection',
  'gender',
  'orientation',
  'sex education',
  'sex ed',
  'bodily changes',
  'coercion',
  'harassment'
];

/**
 * Common question patterns and educational framing indicators.
 */
const EDUCATIONAL_PATTERNS = [
  'what is',
  'what are',
  'how does',
  'how do',
  'why does',
  'why do',
  'can you explain',
  'is it normal',
  'what should i do',
  'how to prevent',
  'definition of',
  'meaning of',
  'how to handle'
];

module.exports = {
  BLOCKED_WORDS,
  SEVERE_SLURS,
  BLOCKED_PHRASES,
  EDUCATIONAL_TERMS,
  EDUCATIONAL_PATTERNS
};
