/**
 * @file sessionService.js
 * @description In-memory server-side management service for presentation sessions and state transitions.
 */

const crypto = require('crypto');
const { createSession, createQuestion, SESSION_STATUS, QUESTION_STATUS, normalizeSessionStatus, isValidStatusTransition } = require('../models/sessionModel');
const { generateUniqueRoomCode, normalizeRoomCode } = require('../utils/roomCode');
const { checkContent } = require('../utils/contentFilter');

class SessionService {
  constructor() {
    this.sessionsById = new Map();
    this.sessionsByRoomCode = new Map();
    this.idempotencyMap = new Map();
    this.ipRequestHistory = new Map();
    this.recentSubmissionsByIp = new Map();
  }

  /**
   * Helper to clean up expired idempotency keys, rate-limit logs, and recent submission records (Task 5.9).
   * Prevents memory leaks by purging records older than retention TTLs.
   * @param {number} [now=Date.now()] 
   */
  _cleanupExpiredRecords(now = Date.now()) {
    const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL for idempotency records
    const RATE_LIMIT_WINDOW_MS = 30 * 1000;    // 30 seconds sliding window for rate limits

    // Purge expired idempotency keys
    for (const [key, record] of this.idempotencyMap.entries()) {
      if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
        this.idempotencyMap.delete(key);
      }
    }

    // Purge expired IP duplicate text tracking
    for (const [key, record] of this.recentSubmissionsByIp.entries()) {
      if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
        this.recentSubmissionsByIp.delete(key);
      }
    }

    // Purge IP request history outside rate limit window
    for (const [ip, timestamps] of this.ipRequestHistory.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (validTimestamps.length === 0) {
        this.ipRequestHistory.delete(ip);
      } else {
        this.ipRequestHistory.set(ip, validTimestamps);
      }
    }
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
   * Updates the active presentation question prompt for student clients.
   * @param {string} identifier - Session ID or room code.
   * @param {Object} promptData - Prompt object containing questionNumber, title, subtitle, and options.
   * @param {string} presenterSecret - Presenter authorization token.
   * @returns {Object}
   */
  updateActiveQuestionPrompt(identifier, promptData, presenterSecret) {
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

    if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
      return { success: false, error: 'Unauthorized: Invalid or missing presenter secret token', code: 403 };
    }

    if (!promptData || !promptData.title || typeof promptData.title !== 'string') {
      return { success: false, error: 'Question title is required', code: 400 };
    }

    session.activeQuestionPrompt = {
      questionNumber: promptData.questionNumber || 'Question 01 of 05',
      title: promptData.title.trim(),
      subtitle: promptData.subtitle ? promptData.subtitle.trim() : 'Tap your sincere answer. Completely confidential.',
      options: Array.isArray(promptData.options) && promptData.options.length > 0 ? promptData.options : [
        { text: 'Yes', sub: '', icon: '💖', val: 'Yes' },
        { text: 'No', sub: '', icon: '😊', val: 'No' },
        { text: 'Curious / Still figuring it out', sub: '', icon: '❓', val: 'Curious / Still figuring it out' }
      ]
    };
    session.updatedAt = new Date().toISOString();

    return {
      success: true,
      activeQuestionPrompt: session.activeQuestionPrompt,
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
   * Resets active session question data for an authorized presenter (Task 10.4).
   * Empties questions array and purges associated idempotency and IP submission records.
   * @param {string} identifier - Session ID or room code.
   * @param {string} presenterSecret - Cryptographic presenter authorization token.
   * @returns {Object} Result object { success: boolean, session?: Object, error?: string, code?: number }.
   */
  resetSession(identifier, presenterSecret) {
    if (!identifier || typeof identifier !== 'string') {
      return { success: false, error: 'Session identifier is required', code: 400 };
    }

    let session = this.sessionsById.get(identifier);
    if (!session) {
      const normalized = normalizeRoomCode(identifier);
      session = this.sessionsByRoomCode.get(normalized);
    }

    if (!session) {
      return { success: false, error: 'Session not found for the provided room code.', code: 404 };
    }

    if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
      return { success: false, error: 'Unauthorized: Invalid or missing presenter secret token', code: 403 };
    }

    // Clear session question collection (Task 10.4)
    session.questions = [];
    session.updatedAt = new Date().toISOString();

    // Purge session-level tracking maps to allow fresh resubmissions
    this.idempotencyMap.clear();
    this.ipRequestHistory.clear();
    this.recentSubmissionsByIp.clear();

    return {
      success: true,
      session: this._cloneSession(session)
    };
  }

  /**
   * Submits a new question to a session guarding against Paused and Closed states, rate limits, and duplicates (Task 4.7 & Tasks 5.4-5.9).
   * Generates a unique server-side ID (Task 5.5) and places accepted submissions into the pending moderation queue (Task 5.6).
   * @param {string} roomCode - Room code of the session.
   * @param {string} text - Question text content.
   * @param {Object} [options={}] - Options including idempotencyKey and clientIp for rate-limit protection (Task 5.9).
   * @returns {Object} Result object { success: boolean, question?: Object, error?: string, code?: number, duplicate?: boolean }.
   */
  addQuestion(roomCode, text, options = {}) {
    const now = Date.now();
    this._cleanupExpiredRecords(now);

    const { idempotencyKey, clientIp } = options;

    // Task 5.9: Idempotency Key check - Return existing question if duplicate request received
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      const trimmedKey = idempotencyKey.trim();
      if (this.idempotencyMap.has(trimmedKey)) {
        const existingRecord = this.idempotencyMap.get(trimmedKey);
        return {
          success: true,
          duplicate: true,
          question: JSON.parse(JSON.stringify(existingRecord.question)),
          code: 200
        };
      }
    }

    // Task 5.4: Server Payload Type Check
    if (typeof text !== 'string') {
      return { success: false, error: 'Question text must be a valid string.', code: 400 };
    }

    // Task 6.4 & 6.5: Server-side Content Filtering Check
    const filterResult = checkContent(text);
    if (filterResult.isBlocked) {
      return {
        success: false,
        error: filterResult.message,
        code: 400
      };
    }

    const normalizedRoom = normalizeRoomCode(roomCode);
    const session = this.sessionsByRoomCode.get(normalizedRoom);

    if (!session) {
      return { success: false, error: 'Session not found for the provided room code.', code: 404 };
    }

    const currentStatus = normalizeSessionStatus(session.status);

    // Task 4.7 & 5.4: Reject new submissions when session is Paused or Closed
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

    // Task 5.9: Client IP Rate Limiting Check
    if (clientIp && typeof clientIp === 'string') {
      const history = this.ipRequestHistory.get(clientIp) || [];
      const RATE_LIMIT_WINDOW_MS = 30 * 1000;    // 30 second window
      const MIN_INTERVAL_MS = 2000;              // 2 seconds minimum between submissions
      const MAX_REQUESTS_PER_WINDOW = 5;          // max 5 submissions per window

      // Check min interval between submissions from same client IP
      if (history.length > 0) {
        const lastSubmissionTime = history[history.length - 1];
        if (now - lastSubmissionTime < MIN_INTERVAL_MS) {
          return {
            success: false,
            error: 'You are submitting questions too quickly. Please wait a few seconds before trying again.',
            code: 429
          };
        }
      }

      // Check max requests per sliding window
      const windowRequests = history.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (windowRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return {
          success: false,
          error: 'Submission limit reached. Please wait a moment before submitting more questions.',
          code: 429
        };
      }

      // Check rapid duplicate text submission from same IP within 10 seconds
      const textKey = `${clientIp}:${normalizedRoom}:${text.trim().toLowerCase()}`;
      if (this.recentSubmissionsByIp.has(textKey)) {
        const rec = this.recentSubmissionsByIp.get(textKey);
        if (now - rec.timestamp < 10000) {
          return {
            success: true,
            duplicate: true,
            question: JSON.parse(JSON.stringify(rec.question)),
            code: 200
          };
        }
      }
    }

    // Task 5.5: Generate unique server-side question ID (crypto.randomUUID)
    const questionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
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

    // Task 5.6: Place accepted submission into session's in-memory questions collection (pending queue)
    session.questions.push(questionObj);
    session.updatedAt = new Date().toISOString();

    const clonedQuestion = JSON.parse(JSON.stringify(questionObj));

    // Task 5.9: Record idempotency and client IP history
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      this.idempotencyMap.set(idempotencyKey.trim(), {
        question: clonedQuestion,
        timestamp: now
      });
    }

    if (clientIp && typeof clientIp === 'string') {
      const history = this.ipRequestHistory.get(clientIp) || [];
      history.push(now);
      this.ipRequestHistory.set(clientIp, history);

      const textKey = `${clientIp}:${normalizedRoom}:${text.trim().toLowerCase()}`;
      this.recentSubmissionsByIp.set(textKey, {
        question: clonedQuestion,
        timestamp: now
      });
    }

    return {
      success: true,
      question: clonedQuestion,
      code: 201
    };
  }

  /**
   * Updates a question's status ('pending', 'approved', 'rejected') enforcing presenter token authorization and session state checks (Task 5.11, 8.6, 8.7, 8.10).
   * @param {string} roomCode - Session room code or ID.
   * @param {string} questionId - Target question unique ID.
   * @param {string} targetStatus - Target status ('pending', 'approved', 'rejected').
   * @param {string} presenterSecret - Cryptographic presenter token for authorization.
   * @param {Object} [options={}] - Options including optional isDisplayed boolean flag (Task 8.6).
   * @returns {Object} Result object { success: boolean, question?: Object, error?: string, code?: number }.
   */
  updateQuestionStatus(roomCode, questionId, targetStatus, presenterSecret, options = {}) {
    if (!roomCode || typeof roomCode !== 'string') {
      return { success: false, error: 'Room code is required', code: 400 };
    }
    if (!questionId || typeof questionId !== 'string') {
      return { success: false, error: 'Question ID is required', code: 400 };
    }

    let session = this.sessionsById.get(roomCode);
    if (!session) {
      session = this.sessionsByRoomCode.get(normalizeRoomCode(roomCode));
    }

    if (!session) {
      return { success: false, error: 'Session not found for the provided room code.', code: 404 };
    }

    // Task 5.11 & 8.10: Server-side Presenter Authorization Check
    if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
      return { success: false, error: 'Unauthorized: Invalid or missing presenter secret token', code: 403 };
    }

    // Task 8.10: Check if session is Closed - Closed sessions cannot accept moderation changes
    if (normalizeSessionStatus(session.status) === SESSION_STATUS.CLOSED) {
      return { success: false, error: 'Cannot modify questions. This presentation session is closed.', code: 400 };
    }

    const { QUESTION_STATUS, isValidQuestionStatusTransition } = require('../models/sessionModel');
    const validStatuses = [QUESTION_STATUS.PENDING, QUESTION_STATUS.APPROVED, QUESTION_STATUS.REJECTED];
    if (!targetStatus || typeof targetStatus !== 'string' || !validStatuses.includes(targetStatus.toLowerCase())) {
      return { success: false, error: `Invalid question status '${targetStatus}'. Allowed statuses: pending, approved, rejected.`, code: 400 };
    }

    const question = session.questions.find((q) => q.id === questionId);
    if (!question) {
      return { success: false, error: 'Question not found in this session.', code: 404 };
    }

    const nextLowerStatus = targetStatus.toLowerCase();

    // Task 8.7: Validate status transition
    if (!isValidQuestionStatusTransition(question.status, nextLowerStatus)) {
      return { success: false, error: `Invalid status transition from '${question.status}' to '${targetStatus}'.`, code: 400 };
    }

    question.status = nextLowerStatus;

    // Task 8.6: Handle display flag
    if (typeof options.isDisplayed === 'boolean') {
      question.isDisplayed = options.isDisplayed;
    } else if (nextLowerStatus === QUESTION_STATUS.APPROVED) {
      question.isDisplayed = true;
    } else {
      question.isDisplayed = false;
    }

    question.updatedAt = new Date().toISOString();
    session.updatedAt = question.updatedAt;

    return {
      success: true,
      question: JSON.parse(JSON.stringify(question)),
      session: this._cloneSession(session)
    };
  }

  /**
   * Updates only the display visibility flag (isDisplayed) of an approved question without altering status history (Task 8.6).
   * @param {string} roomCode - Session room code or ID.
   * @param {string} questionId - Target question unique ID.
   * @param {boolean} isDisplayed - Desired display visibility state on live projector.
   * @param {string} presenterSecret - Cryptographic presenter token for authorization.
   * @returns {Object} Result object { success: boolean, question?: Object, error?: string, code?: number }.
   */
  updateQuestionDisplay(roomCode, questionId, isDisplayed, presenterSecret) {
    if (!roomCode || typeof roomCode !== 'string') {
      return { success: false, error: 'Room code is required', code: 400 };
    }
    if (!questionId || typeof questionId !== 'string') {
      return { success: false, error: 'Question ID is required', code: 400 };
    }

    let session = this.sessionsById.get(roomCode);
    if (!session) {
      session = this.sessionsByRoomCode.get(normalizeRoomCode(roomCode));
    }

    if (!session) {
      return { success: false, error: 'Session not found for the provided room code.', code: 404 };
    }

    if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
      return { success: false, error: 'Unauthorized: Invalid or missing presenter secret token', code: 403 };
    }

    if (normalizeSessionStatus(session.status) === SESSION_STATUS.CLOSED) {
      return { success: false, error: 'Cannot modify question display state. This presentation session is closed.', code: 400 };
    }

    const question = session.questions.find((q) => q.id === questionId);
    if (!question) {
      return { success: false, error: 'Question not found in this session.', code: 404 };
    }

    if (question.status !== QUESTION_STATUS.APPROVED) {
      return { success: false, error: 'Only approved questions are eligible for display management.', code: 400 };
    }

    question.isDisplayed = Boolean(isDisplayed);
    question.updatedAt = new Date().toISOString();
    session.updatedAt = question.updatedAt;

    return {
      success: true,
      question: JSON.parse(JSON.stringify(question)),
      session: this._cloneSession(session)
    };
  }

  /**
   * Retrieves questions filtered by status (Task 5.6 & 8.6).
   * @param {string} identifier - Session ID or room code.
   * @param {string} status - Question status ('pending', 'approved', 'rejected').
   * @returns {Array<Object>} List of question objects.
   */
  getQuestionsByStatus(identifier, status) {
    if (!identifier || typeof identifier !== 'string') return [];
    let session = this.sessionsById.get(identifier);
    if (!session) {
      session = this.sessionsByRoomCode.get(normalizeRoomCode(identifier));
    }
    if (!session) return [];

    const filtered = session.questions.filter((q) => q.status === status);
    return JSON.parse(JSON.stringify(filtered));
  }

  /**
   * Retrieves approved questions that are currently active for live display on the projector (Task 8.6).
   * Filters out questions where isDisplayed === false.
   * @param {string} identifier - Session ID or room code.
   * @returns {Array<Object>} List of displayed approved questions.
   */
  getApprovedQuestionsForDisplay(identifier) {
    if (!identifier || typeof identifier !== 'string') return [];
    let session = this.sessionsById.get(identifier);
    if (!session) {
      session = this.sessionsByRoomCode.get(normalizeRoomCode(identifier));
    }
    if (!session) return [];

    const filtered = session.questions.filter((q) => q.status === 'approved' && q.isDisplayed !== false);
    return JSON.parse(JSON.stringify(filtered));
  }

  /**
   * Retrieves the pending moderation queue for a session (Task 5.6).
   * @param {string} identifier - Session ID or room code.
   * @returns {Array<Object>} List of pending question objects.
   */
  getPendingQuestions(identifier) {
    const { QUESTION_STATUS } = require('../models/sessionModel');
    return this.getQuestionsByStatus(identifier, QUESTION_STATUS.PENDING);
  }

  /**
   * Retrieves approved questions for a session (Task 10.2).
   * @param {string} identifier - Session ID or room code.
   * @returns {Array<Object>} List of approved question objects.
   */
  getApprovedQuestions(identifier) {
    const { QUESTION_STATUS } = require('../models/sessionModel');
    return this.getQuestionsByStatus(identifier, QUESTION_STATUS.APPROVED);
  }

  /**
   * Retrieves rejected questions for a session (Task 10.2).
   * @param {string} identifier - Session ID or room code.
   * @returns {Array<Object>} List of rejected question objects.
   */
  getRejectedQuestions(identifier) {
    const { QUESTION_STATUS } = require('../models/sessionModel');
    return this.getQuestionsByStatus(identifier, QUESTION_STATUS.REJECTED);
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
    this.idempotencyMap.clear();
    this.ipRequestHistory.clear();
    this.recentSubmissionsByIp.clear();
  }
}

// Global singleton instance for the server process
const sessionService = new SessionService();

module.exports = {
  SessionService,
  sessionService
};
