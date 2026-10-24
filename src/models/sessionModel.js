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

/**
 * Creates a standard Session object.
 * @param {Object} params
 * @param {string} params.id - Unique internal session identifier.
 * @param {string} params.roomCode - Short 6-character uppercase room code.
 * @param {string} [params.presenterSecret] - Cryptographic token for presenter authorization.
 * @param {string} [params.status='Open'] - Initial session status.
 * @returns {Object} Session object.
 */
function createSession({ id, roomCode, presenterSecret = '', status = SESSION_STATUS.OPEN }) {
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
    createdAt: now,
    updatedAt: now,
    questions: []
  };
}

/**
 * Creates a standard Question object.
 * @param {Object} params
 * @param {string} params.id - Unique question identifier.
 * @param {string} params.sessionId - Target session identifier.
 * @param {string} params.text - Question content.
 * @param {string} [params.status='pending'] - Initial question status.
 * @returns {Object} Question object.
 */
function createQuestion({ id, sessionId, text, status = QUESTION_STATUS.PENDING }) {
  if (!id || typeof id !== 'string') {
    throw new Error('Question creation requires a valid string id');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Question creation requires a valid sessionId');
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Question content must be a non-empty string');
  }

  const now = new Date().toISOString();
  return {
    id,
    sessionId,
    text: text.trim(),
    status,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  SESSION_STATUS,
  QUESTION_STATUS,
  normalizeSessionStatus,
  isValidStatusTransition,
  createSession,
  createQuestion
};
