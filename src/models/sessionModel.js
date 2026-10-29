/**
 * @file sessionModel.js
 * @description Factory functions and schemas for Session and Question data structures.
 */

/**
 * Session Lifecycle Statuses (Task 4.5)
 * - Open: Accepts new question submissions
 * - Paused: Available, but new submissions are rejected
 * - Closed: Ended, new submissions rejected (terminal state)
 */
const SESSION_STATUS = {
  OPEN: 'Open',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
  // Backward compatibility alias for earlier tasks
  ACTIVE: 'Open'
};

/**
 * Question Moderation Statuses
 */
const QUESTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

/**
 * Normalizes a status string to match canonical casing (Open, Paused, Closed).
 * @param {string} status 
 * @returns {string}
 */
function normalizeSessionStatus(status) {
  if (!status || typeof status !== 'string') return '';
  const lower = status.trim().toLowerCase();
  if (lower === 'open' || lower === 'active') return SESSION_STATUS.OPEN;
  if (lower === 'paused') return SESSION_STATUS.PAUSED;
  if (lower === 'closed') return SESSION_STATUS.CLOSED;
  return status;
}

/**
 * Validates state transition rules (Task 4.5):
 *  - Open -> Paused
 *  - Paused -> Open
 *  - Open -> Closed
 *  - Paused -> Closed
 * Closed is terminal and cannot transition to Open or Paused.
 *
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
function isValidStatusTransition(currentStatus, nextStatus) {
  const current = normalizeSessionStatus(currentStatus);
  const next = normalizeSessionStatus(nextStatus);

  const validStatuses = [SESSION_STATUS.OPEN, SESSION_STATUS.PAUSED, SESSION_STATUS.CLOSED];
  if (!validStatuses.includes(next)) {
    return false;
  }

  // Idempotent same-state check
  if (current === next) {
    return true;
  }

  // Terminal state protection
  if (current === SESSION_STATUS.CLOSED) {
    return false;
  }

  if (current === SESSION_STATUS.OPEN && (next === SESSION_STATUS.PAUSED || next === SESSION_STATUS.CLOSED)) {
    return true;
  }

  if (current === SESSION_STATUS.PAUSED && (next === SESSION_STATUS.OPEN || next === SESSION_STATUS.CLOSED)) {
    return true;
  }

  return false;
}

const DEFAULT_ACTIVE_PROMPT = {
  questionNumber: 'Question 02 of 05',
  title: 'Have you ever had an experience related to sexual intimacy?',
  subtitle: 'Tap your sincere answer. Completely confidential.',
  options: [
    { text: 'Yes', sub: '', icon: '💖', val: 'Yes' },
    { text: 'No', sub: '', icon: '😊', val: 'No' },
    { text: 'Curious / Still figuring it out', sub: '', icon: '❓', val: 'Curious / Still figuring it out' }
  ]
};

/**
 * Creates a standard Session object.
 * @param {Object} params
 * @param {string} params.id - Unique internal session identifier.
 * @param {string} params.roomCode - Short 6-character uppercase room code.
 * @param {string} [params.presenterSecret] - Cryptographic token for presenter authorization.
 * @param {string} [params.status='Open'] - Initial session status.
 * @returns {Object} Session object.
 */
function createSession({ id, roomCode, presenterSecret = '', status = SESSION_STATUS.OPEN, activeQuestionPrompt }) {
  if (!id || typeof id !== 'string') {
    throw new Error('Session creation requires a valid string id');
  }
  if (!roomCode || typeof roomCode !== 'string') {
    throw new Error('Session creation requires a valid roomCode string');
  }

  const initialStatus = normalizeSessionStatus(status);
  const validStatuses = [SESSION_STATUS.OPEN, SESSION_STATUS.PAUSED, SESSION_STATUS.CLOSED];
  if (!validStatuses.includes(initialStatus)) {
    throw new Error(`Invalid initial session status: ${status}`);
  }

  const now = new Date().toISOString();
  return {
    id,
    roomCode: roomCode.trim().toUpperCase(),
    presenterSecret,
    status: initialStatus,
    activeQuestionPrompt: activeQuestionPrompt || DEFAULT_ACTIVE_PROMPT,
    createdAt: now,
    updatedAt: now,
    questions: []
  };
}

/**
 * Maximum character limit for anonymous student question submissions (Task 5.3)
 */
const MAX_QUESTION_LENGTH = 300;

/**
 * Validates question status transition rules (Task 8.7).
 * Allowed statuses: pending, approved, rejected.
 *
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
function isValidQuestionStatusTransition(currentStatus, nextStatus) {
  const validStatuses = [QUESTION_STATUS.PENDING, QUESTION_STATUS.APPROVED, QUESTION_STATUS.REJECTED];
  const next = typeof nextStatus === 'string' ? nextStatus.toLowerCase() : '';
  return validStatuses.includes(next);
}

/**
 * Creates a standard Question object.
 * Task 5.10: Ensures pure anonymous question data structure (no name, email, student ID, or account fields).
 * Task 5.11: Validates question status to ensure only valid statuses are set.
 * Task 8.6: Adds isDisplayed flag to preserve question status history ('approved') when removed from display screen.
 * 
 * @param {Object} params
 * @param {string} params.id - Unique question identifier.
 * @param {string} params.sessionId - Target session identifier.
 * @param {string} params.text - Question content.
 * @param {string} [params.status='pending'] - Question status ('pending', 'approved', 'rejected').
 * @param {boolean} [params.isDisplayed] - Display flag indicating if question is visible on live projector.
 * @returns {Object} Anonymous Question object with exact schema fields only.
 */
function createQuestion({ id, sessionId, text, status = QUESTION_STATUS.PENDING, isDisplayed }) {
  if (!id || typeof id !== 'string') {
    throw new Error('Question creation requires a valid string id');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Question creation requires a valid sessionId');
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Question content must be a non-empty string');
  }

  const trimmedText = text.trim();
  if (trimmedText.length > MAX_QUESTION_LENGTH) {
    throw new Error(`Question exceeds maximum allowed length of ${MAX_QUESTION_LENGTH} characters`);
  }

  const validStatuses = [QUESTION_STATUS.PENDING, QUESTION_STATUS.APPROVED, QUESTION_STATUS.REJECTED];
  const questionStatus = validStatuses.includes(status) ? status : QUESTION_STATUS.PENDING;

  // Task 8.6: Default isDisplayed to true for approved questions, false otherwise unless explicitly set
  const displayFlag = typeof isDisplayed === 'boolean'
    ? isDisplayed
    : (questionStatus === QUESTION_STATUS.APPROVED);

  const now = new Date().toISOString();
  // Task 5.10 & Task 8.6: Return strict anonymous schema object with display flag
  return {
    id,
    sessionId,
    text: trimmedText,
    status: questionStatus,
    isDisplayed: displayFlag,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  SESSION_STATUS,
  QUESTION_STATUS,
  MAX_QUESTION_LENGTH,
  normalizeSessionStatus,
  isValidStatusTransition,
  isValidQuestionStatusTransition,
  createSession,
  createQuestion
};
