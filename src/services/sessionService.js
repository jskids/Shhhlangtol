/**
 * @file sessionService.js
 * @description In-memory server-side management service for presentation sessions.
 */

const crypto = require('crypto');
const { createSession, SESSION_STATUS } = require('../models/sessionModel');
const { generateUniqueRoomCode, normalizeRoomCode, isValidRoomCodeFormat } = require('../utils/roomCode');

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
   * Creates a new presentation session with a unique ID and room code.
   * @returns {Object} Created session object copy.
   */
  createNewSession() {
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const roomCode = generateUniqueRoomCode((code) => this.sessionsByRoomCode.has(code));

    const sessionObj = createSession({ id, roomCode, status: SESSION_STATUS.ACTIVE });

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
   * Validates whether a session exists and is currently active.
   * @param {string} roomCode 
   * @returns {boolean}
   */
  isSessionActive(roomCode) {
    const session = this.getSessionByRoomCode(roomCode);
    return Boolean(session && session.status === SESSION_STATUS.ACTIVE);
  }

  /**
   * Safely closes an active session.
   * @param {string} identifier - Session ID or room code.
   * @returns {Object|null} Updated session object or null if not found.
   */
  closeSession(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;

    let session = this.sessionsById.get(identifier);
    if (!session) {
      const normalized = normalizeRoomCode(identifier);
      session = this.sessionsByRoomCode.get(normalized);
    }

    if (!session) return null;

    if (session.status !== SESSION_STATUS.CLOSED) {
      session.status = SESSION_STATUS.CLOSED;
      session.updatedAt = new Date().toISOString();
    }

    return this._cloneSession(session);
  }

  /**
   * Ensures at least one default active session exists for simple single-session presentation setups.
   * @returns {Object} Active session object.
   */
  getOrCreateDefaultSession() {
    for (const session of this.sessionsById.values()) {
      if (session.status === SESSION_STATUS.ACTIVE) {
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
