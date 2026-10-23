/**
 * @file sessionRoutes.js
 * @description HTTP endpoints for session and room code validation.
 */

const express = require('express');
const router = express.Router();
const { sessionService } = require('../services/sessionService');
const { normalizeRoomCode, isValidRoomCodeFormat } = require('../utils/roomCode');
const { SESSION_STATUS } = require('../models/sessionModel');

/**
 * GET /api/sessions/validate/:roomCode
 * Validates a room code format and checks active session status.
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

  if (session.status !== SESSION_STATUS.ACTIVE) {
    return res.status(400).json({
      valid: false,
      status: session.status,
      error: 'This presentation session is currently closed.'
    });
  }

  return res.status(200).json({
    valid: true,
    roomCode: session.roomCode,
    sessionId: session.id,
    status: session.status
  });
});

module.exports = router;
