/**
 * @file sessionModel.js
 * @description Factory functions and schemas for Session and Question data structures.
 */

/**
 * Session Lifecycle Statuses
 */
const SESSION_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed'
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
 * Creates a standard Session object.
 * @param {Object} params
 * @param {string} params.id - Unique internal session identifier.
 * @param {string} params.roomCode - Short 6-character uppercase room code.
 * @param {string} [params.status='active'] - Initial session status.
 * @returns {Object} Session object.
 */
function createSession({ id, roomCode, status = SESSION_STATUS.ACTIVE }) {
  if (!id || typeof id !== 'string') {
    throw new Error('Session creation requires a valid string id');
  }
  if (!roomCode || typeof roomCode !== 'string') {
    throw new Error('Session creation requires a valid roomCode string');
  }

  const now = new Date().toISOString();
  return {
    id,
    roomCode: roomCode.trim().toUpperCase(),
    status,
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
  createSession,
  createQuestion
};
