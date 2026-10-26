/**
 * @file sessionRoutes.js
 * @description HTTP endpoints for session validation, presenter state control, active session retrieval, and question submissions.
 */

const express = require('express');
const router = express.Router();
const { sessionService } = require('../services/sessionService');
const { normalizeRoomCode, isValidRoomCodeFormat } = require('../utils/roomCode');
const { SESSION_STATUS, normalizeSessionStatus } = require('../models/sessionModel');

/**
 * GET /api/sessions/active
 * Task 4.8 & Task 4.9: Returns the single currently active session ('Open' or 'Paused') if one exists.
 */
router.get('/active', (req, res) => {
  const activeSession = sessionService.getActiveSession();

  if (!activeSession) {
    return res.status(200).json({
      active: false,
      message: 'No active presentation session.'
    });
  }

  return res.status(200).json({
    active: true,
    roomCode: activeSession.roomCode,
    sessionId: activeSession.id,
    status: normalizeSessionStatus(activeSession.status),
    createdAt: activeSession.createdAt,
    updatedAt: activeSession.updatedAt
  });
});

/**
 * POST /api/sessions/create
 * Task 4.9: Creates a new presentation session enforcing the single-active-session policy.
 */
router.post('/create', (req, res) => {
  try {
    const session = sessionService.createNewSession();
    return res.status(201).json({
      success: true,
      session
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/sessions/validate/:roomCode
 * Validates room code format and returns session status.
 */
router.get('/validate/:roomCode', (req, res) => {
  const rawCode = req.params.roomCode;
  const normalized = normalizeRoomCode(rawCode);

  if (!isValidRoomCodeFormat(normalized)) {
    return res.status(400).json({
      valid: false,
      error: 'Invalid room code format. Room codes must be 6 alphanumeric characters.'
    });
  }

  const session = sessionService.getSessionByRoomCode(normalized);

  if (!session) {
    return res.status(404).json({
      valid: false,
      error: 'Session not found for the provided room code.'
    });
  }

  const currentStatus = normalizeSessionStatus(session.status);
  const isOpen = currentStatus === SESSION_STATUS.OPEN;

  return res.status(isOpen ? 200 : 400).json({
    valid: isOpen,
    roomCode: session.roomCode,
    sessionId: session.id,
    status: currentStatus,
    message: isOpen ? 'Session is open for submissions.' : `Session is currently ${currentStatus.toLowerCase()}.`
  });
});

/**
 * POST /api/sessions/status
 * Presenter endpoint to control session state (Open, Paused, Closed) - Task 4.6.
 * Security: Requires valid x-presenter-token header or presenterSecret body field.
 */
router.post('/status', (req, res) => {
  const { roomCode, status, presenterSecret: bodySecret } = req.body || {};
  const presenterSecret = req.headers['x-presenter-token'] || bodySecret;

  if (!roomCode || !status) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: roomCode and status are required.'
    });
  }

  const result = sessionService.updateSessionStatus(roomCode, status, presenterSecret);

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      error: result.error
    });
  }

  // Trigger real-time Socket.IO event if io instance is attached to app
  const io = req.app.get('io');
  if (io) {
    // Task 7.5 & Task 8.11: Broadcast status change strictly to room-scoped clients
    io.to(`session:${result.session.roomCode}`).emit('sessionStatusChanged', {
      roomCode: result.session.roomCode,
      status: result.session.status
    });
  }

  return res.status(200).json({
    success: true,
    roomCode: result.session.roomCode,
    status: result.session.status,
    updatedAt: result.session.updatedAt
  });
});

/**
 * POST /api/sessions/reset
 * Presenter endpoint to reset session questions and tracking data (Task 10.4).
 * Security: Requires valid x-presenter-token header or presenterSecret body field.
 */
router.post('/reset', (req, res) => {
  const { roomCode, presenterSecret: bodySecret } = req.body || {};
  const presenterSecret = req.headers['x-presenter-token'] || bodySecret;

  if (!roomCode || typeof roomCode !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Room code parameter is required.'
    });
  }

  const result = sessionService.resetSession(roomCode, presenterSecret);

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      error: result.error
    });
  }

  const io = req.app.get('io');
  if (io) {
    const targetRoom = result.session.roomCode;
    io.to(`session:${targetRoom}`).emit('sessionReset', {
      roomCode: targetRoom,
      message: 'Session questions have been reset by the presenter.'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Session reset successfully.',
    session: result.session
  });
});

/**
 * POST /api/sessions/questions
 * Student endpoint to submit an anonymous question - Tasks 4.7 & 5.4-5.10.
 * Task 5.10: Ignores student names, emails, IDs, or account info (maintains 100% anonymity).
 * Task 5.11: Ignores client-supplied status overrides and unconditionally forces status 'pending'.
 * Supports idempotency tokens and IP-based rate limiting (Task 5.9).
 */
router.post('/questions', (req, res) => {
  const { roomCode, text, idempotencyKey: bodyKey } = req.body || {};
  const headerKey = req.headers['x-idempotency-key'];
  const idempotencyKey = bodyKey || headerKey;
  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';

  if (!roomCode || typeof roomCode !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Valid room code is required.'
    });
  }

  if (typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Question text must be a valid string.'
    });
  }

  if (!text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Question content cannot be empty.'
    });
  }

  // Task 5.10 & 5.11: Only text, roomCode, idempotencyKey, and clientIp are processed.
  // Student identity fields (name, email, studentId) and status overrides are strictly ignored.
  const result = sessionService.addQuestion(roomCode, text, { idempotencyKey, clientIp });

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      error: result.error,
      status: result.status
    });
  }

  // Task 7.3: Broadcast newly accepted pending question strictly to authorized moderator clients
  const io = req.app.get('io');
  if (io && !result.duplicate && result.question && result.question.status === 'pending') {
    const normalizedRoom = normalizeRoomCode(roomCode);
    io.to(`session:${normalizedRoom}:moderator`).emit('pendingQuestionAdded', {
      roomCode: normalizedRoom,
      question: result.question
    });
  }

  const statusCode = result.code || 201;
  return res.status(statusCode).json({
    success: true,
    question: result.question,
    duplicate: result.duplicate || false
  });
});

/**
 * POST /api/sessions/questions/status
 * Presenter/Moderator endpoint to update question status ('pending', 'approved', 'rejected') - Tasks 5.11 & 8.6 & 8.7 & 8.10.
 * Security: Requires valid x-presenter-token header or presenterSecret body field.
 * Returns HTTP 403 Forbidden for unauthorized requests (such as direct student attempts).
 */
router.post('/questions/status', (req, res) => {
  const { roomCode, questionId, status, isDisplayed, presenterSecret: bodySecret } = req.body || {};
  const presenterSecret = req.headers['x-presenter-token'] || bodySecret;

  if (!roomCode || !questionId || !status) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: roomCode, questionId, and status are required.'
    });
  }

  // Task 5.11 & 8.10: Server-side Presenter Authorization Check
  const options = typeof isDisplayed === 'boolean' ? { isDisplayed } : {};
  const result = sessionService.updateQuestionStatus(roomCode, questionId, status, presenterSecret, options);

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      error: result.error
    });
  }

  // Trigger real-time Socket.IO event if io instance is attached to app
  const io = req.app.get('io');
  if (io) {
    const targetRoom = result.session.roomCode;
    const question = result.question;

    // Task 7.3 & Task 8.11: Broadcast status update strictly to authorized moderator room
    io.to(`session:${targetRoom}:moderator`).emit('questionStatusChanged', {
      roomCode: targetRoom,
      question
    });

    // Task 7.4 & Task 8.6: Broadcast approved-question updates specifically to projector display room
    if (question.status === 'approved' && question.isDisplayed !== false) {
      io.to(`session:${targetRoom}:display`).emit('approvedQuestionAdded', {
        roomCode: targetRoom,
        question
      });
    } else {
      // Broadcast removal / state change to display if question was rejected, pending, or un-approved
      io.to(`session:${targetRoom}:display`).emit('approvedQuestionRemoved', {
        roomCode: targetRoom,
        question
      });
    }
  }

  return res.status(200).json({
    success: true,
    question: result.question
  });
});

/**
 * POST /api/sessions/questions/display
 * Presenter/Moderator endpoint to toggle display visibility of an approved question (Task 8.6).
 * Security: Requires valid x-presenter-token header or presenterSecret body field.
 */
router.post('/questions/display', (req, res) => {
  const { roomCode, questionId, isDisplayed, presenterSecret: bodySecret } = req.body || {};
  const presenterSecret = req.headers['x-presenter-token'] || bodySecret;

  if (!roomCode || !questionId || typeof isDisplayed !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: roomCode, questionId, and boolean isDisplayed are required.'
    });
  }

  const result = sessionService.updateQuestionDisplay(roomCode, questionId, isDisplayed, presenterSecret);

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      error: result.error
    });
  }

  const io = req.app.get('io');
  if (io) {
    const targetRoom = result.session.roomCode;
    const question = result.question;

    // Broadcast to moderator room
    io.to(`session:${targetRoom}:moderator`).emit('questionStatusChanged', {
      roomCode: targetRoom,
      question
    });

    // Broadcast to display room
    if (question.status === 'approved' && question.isDisplayed) {
      io.to(`session:${targetRoom}:display`).emit('approvedQuestionAdded', {
        roomCode: targetRoom,
        question
      });
    } else {
      io.to(`session:${targetRoom}:display`).emit('approvedQuestionRemoved', {
        roomCode: targetRoom,
        question
      });
    }
  }

  return res.status(200).json({
    success: true,
    question: result.question
  });
});

/**
 * GET /api/sessions/questions/pending
 * Presenter/Moderator endpoint to fetch pending questions for moderation queue (Tasks 8.1, 8.10, 8.11).
 * Security: Requires valid x-presenter-token header or presenterSecret query parameter.
 * Returns HTTP 403 Forbidden for unauthorized requests.
 */
router.get('/questions/pending', (req, res) => {
  const roomCode = req.query.roomCode;
  const presenterSecret = req.headers['x-presenter-token'] || req.query.presenterSecret;

  if (!roomCode || typeof roomCode !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Room code parameter is required.'
    });
  }

  const session = sessionService.getSessionByRoomCode(roomCode);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found for the provided room code.'
    });
  }

  if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized: Invalid or missing presenter secret token.'
    });
  }

  const pendingQuestions = sessionService.getPendingQuestions(roomCode);
  return res.status(200).json({
    success: true,
    pendingQuestions
  });
});

module.exports = router;
