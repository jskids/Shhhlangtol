/**
 * @file sessionService.js
 * @description In-memory server-side management service for presentation sessions and state transitions.
 */

const crypto = require('crypto');
const { createSession, createQuestion, SESSION_STATUS, normalizeSessionStatus, isValidStatusTransition } = require('../models/sessionModel');
const { generateUniqueRoomCode, normalizeRoomCode } = require('../utils/roomCode');

class SessionService {
  constructor() {
    this.sessionsById = new Map();
    this.sessionsByRoomCode = new Map();
  }

  /**
   * Helper to deep clone session objects to prevent external mutation of internal storage.
   * @param {Object} session 
   * @returns {Object|null}
   */
  _cloneSession(session) {
    if (!session) return null;
    return JSON.parse(JSON.stringify(session));
  }

  /**
   * Retrieves the currently active presentation session (in 'Open' or 'Paused' state).
   * Task 4.9: Enforces single active presentation session rule.
   * @returns {Object|null}
   */
  getActiveSession() {
    for (const session of this.sessionsById.values()) {
      const status = normalizeSessionStatus(session.status);
      if (status === SESSION_STATUS.OPEN || status === SESSION_STATUS.PAUSED) {
        return this._cloneSession(session);
      }
    }
    return null;
  }

  /**
   * Creates a new presentation session with a unique ID, room code, and presenter authorization secret.
   * Task 4.9: Enforces single-active-session policy. Creation fails if an Open or Paused session exists.
   * @returns {Object} Created session object copy.
   */
  createNewSession() {
    // Task 4.9: Check for an existing active session (Open or Paused)
    const existingActive = this.getActiveSession();
    if (existingActive) {
      throw new Error(`An active presentation session (${existingActive.roomCode}) already exists in '${existingActive.status}' state. Close it before creating a new session.`);
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const presenterSecret = crypto.randomBytes(16).toString('hex');
    const roomCode = generateUniqueRoomCode((code) => this.sessionsByRoomCode.has(code));

    const sessionObj = createSession({
      id,
      roomCode,
      presenterSecret,
      status: SESSION_STATUS.OPEN
    });

    this.sessionsById.set(id, sessionObj);
    this.sessionsByRoomCode.set(roomCode, sessionObj);

    return this._cloneSession(sessionObj);
  }

  /**
   * Retrieves a session by its internal ID.
   * @param {string} id 
   * @returns {Object|null}
   */
  getSessionById(id) {
    if (!id || typeof id !== 'string') return null;
    const session = this.sessionsById.get(id);
    return this._cloneSession(session);
  }

  /**
   * Retrieves a session by its 6-character room code.
   * @param {string} roomCode 
   * @returns {Object|null}
   */
  getSessionByRoomCode(roomCode) {
    const normalized = normalizeRoomCode(roomCode);
    if (!normalized) return null;
    const session = this.sessionsByRoomCode.get(normalized);
    return this._cloneSession(session);
  }

  /**
   * Checks whether a session exists by room code or ID.
   * @param {string} identifier 
   * @returns {boolean}
   */
  hasSession(identifier) {
    if (!identifier || typeof identifier !== 'string') return false;
    const normalized = normalizeRoomCode(identifier);
    return this.sessionsById.has(identifier) || this.sessionsByRoomCode.has(normalized);
  }

  /**
   * Validates whether a session exists and is currently in the Open state.
   * @param {string} roomCode 
   * @returns {boolean}
   */
  isSessionActive(roomCode) {
    const session = this.getSessionByRoomCode(roomCode);
    return Boolean(session && normalizeSessionStatus(session.status) === SESSION_STATUS.OPEN);
  }

  /**
   * Updates session state (Open, Paused, Closed) enforcing presenter authorization and state transition rules (Tasks 4.5 & 4.6).
   * @param {string} identifier - Session ID or room code.
   * @param {string} targetStatus - Target status ('Open', 'Paused', 'Closed').
   * @param {string} presenterSecret - Provided presenter authorization secret.
   * @returns {Object} Result object { success: boolean, session?: Object, error?: string, code?: number }.
   */
  updateSessionStatus(identifier, targetStatus, presenterSecret) {
    if (!identifier || typeof identifier !== 'string') {
      return { success: false, error: 'Session identifier is required', code: 400 };
    }

    let session = this.sessionsById.get(identifier);
    if (!session) {
      const normalized = normalizeRoomCode(identifier);
      session = this.sessionsByRoomCode.get(normalized);
    }

    if (!session) {
      return { success: false, error: 'Session not found', code: 404 };
    }

    // Task 4.6: Server-side Presenter Authorization Check
    if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
      return { success: false, error: 'Unauthorized: Invalid or missing presenter secret token', code: 403 };
    }

    const nextStatus = normalizeSessionStatus(targetStatus);

    // Task 4.5: Enforce Valid State Transition Rules
    if (!isValidStatusTransition(session.status, nextStatus)) {
      if (normalizeSessionStatus(session.status) === SESSION_STATUS.CLOSED) {
        return { success: false, error: 'Cannot modify state. Closed sessions are terminal and cannot be reopened.', code: 400 };
      }
      return { success: false, error: `Invalid state transition from '${session.status}' to '${targetStatus}'.`, code: 400 };
    }

    session.status = nextStatus;
    session.updatedAt = new Date().toISOString();

    return {
      success: true,
      session: this._cloneSession(session)
    };
  }

  /**
   * Convenience method to safely close a session with presenter secret authorization.
   * @param {string} identifier 
   * @param {string} presenterSecret 
   * @returns {Object|null}
   */
  closeSession(identifier, presenterSecret) {
    const res = this.updateSessionStatus(identifier, SESSION_STATUS.CLOSED, presenterSecret);
    return res.success ? res.session : null;
  }

  /**
   * Submits a new question to a session guarding against Paused and Closed states (Task 4.7).
   * @param {string} roomCode - Room code of the session.
   * @param {string} text - Question text content.
   * @returns {Object} Result object { success: boolean, question?: Object, error?: string, code?: number }.
   */
  addQuestion(roomCode, text) {
    const session = this.sessionsByRoomCode.get(normalizeRoomCode(roomCode));

    if (!session) {
      return { success: false, error: 'Session not found for the provided room code.', code: 404 };
    }

    const currentStatus = normalizeSessionStatus(session.status);

    // Task 4.7: Reject new submissions when session is Paused or Closed
    if (currentStatus === SESSION_STATUS.PAUSED) {
      return {
        success: false,
        error: 'Submissions are currently paused for this presentation.',
        status: SESSION_STATUS.PAUSED,
        code: 400
      };
    }

    if (currentStatus === SESSION_STATUS.CLOSED) {
      return {
        success: false,
        error: 'This presentation session is closed and no longer accepting questions.',
        status: SESSION_STATUS.CLOSED,
        code: 400
      };
    }

    if (currentStatus !== SESSION_STATUS.OPEN) {
      return {
        success: false,
        error: 'Session is not currently open for submissions.',
        status: currentStatus,
        code: 400
      };
    }

    const questionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex');
    let questionObj;
    try {
      questionObj = createQuestion({
        id: questionId,
        sessionId: session.id,
        text
      });
    } catch (err) {
      return {
        success: false,
        error: err.message,
        code: 400
      };
    }

    session.questions.push(questionObj);
    session.updatedAt = new Date().toISOString();

    return {
      success: true,
      question: JSON.parse(JSON.stringify(questionObj))
    };
  }

  /**
   * Ensures at least one default Open session exists for single-session presentation setups.
   * @returns {Object} Active session object.
   */
  getOrCreateDefaultSession() {
    for (const session of this.sessionsById.values()) {
      if (normalizeSessionStatus(session.status) === SESSION_STATUS.OPEN) {
        return this._cloneSession(session);
      }
    }
    return this.createNewSession();
  }

  /**
   * Clears all in-memory sessions (primarily for testing and environment resets).
   */
  clearAllSessions() {
    this.sessionsById.clear();
    this.sessionsByRoomCode.clear();
  }
}

// Global singleton instance for the server process
const sessionService = new SessionService();

module.exports = {
  SessionService,
  sessionService
};
