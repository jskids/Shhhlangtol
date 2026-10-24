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
    io.emit('sessionStatusChanged', {
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
 * POST /api/sessions/questions
 * Student endpoint to submit an anonymous question - Task 4.7 & Tasks 5.4-5.6.
 * Rejects submissions when session is Paused or Closed.
 */
router.post('/questions', (req, res) => {
  const { roomCode, text } = req.body || {};

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

  const result = sessionService.addQuestion(roomCode, text);

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      error: result.error,
      status: result.status
    });
  }

  return res.status(201).json({
    success: true,
    question: result.question
  });
});

module.exports = router;
