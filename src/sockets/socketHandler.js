/**
 * @file socketHandler.js
 * @description Modular Socket.IO connection event handling for offline real-time communication.
 * Tasks 7.1–7.9: Handles connection management, session room organization, role-based authorization,
 * initial state synchronization, client reconnection handling, sensitive event authorization,
 * and anti-impersonation defenses.
 */

const { sessionService } = require('../services/sessionService');

/**
 * Initializes Socket.IO connection listeners and event handlers.
 * @param {import('socket.io').Server} io - Socket.IO server instance.
 */
function initSocketHandlers(io) {
  if (!io) return;

  io.on('connection', (socket) => {
    // Initialize socket-level state storage (Task 7.6 & Task 7.9)
    socket.data = {
      roomCode: null,
      role: 'guest',
      isModerator: false,
      presenterSecret: null,
      joinedAt: new Date().toISOString()
    };

    console.log(`[Socket] Client connected: ${socket.id}`);

    // Attach socket-level error listener to prevent unhandled socket errors from crashing process
    socket.on('error', (err) => {
      console.warn(`[Socket Error] ${socket.id}:`, err ? err.message || err : 'Unknown socket error');
    });

    // Emit current active session status upon client connection (Task 4.8 & Task 7.1 & Task 7.7)
    try {
      const activeSession = sessionService.getActiveSession();
      if (activeSession) {
        socket.emit('sessionStatusChanged', {
          roomCode: activeSession.roomCode,
          status: activeSession.status
        });
      } else {
        socket.emit('sessionStatusChanged', {
          roomCode: null,
          status: 'No active presentation session'
        });
      }
    } catch (err) {
      console.error('[Socket] Failed to broadcast initial session status:', err);
    }

    /**
     * Task 7.2, 7.3, 7.6, 7.7, 7.9:
     * Room joining & authoritative state synchronization handler.
     * Prevents impersonation by strictly verifying presenterSecret before assigning moderator role/rooms.
     */
    socket.on('joinRoom', (data, callback) => {
      const { roomCode, role, presenterSecret } = data || {};
      const cb = typeof callback === 'function' ? callback : () => { };

      if (!roomCode || typeof roomCode !== 'string') {
        const errPayload = { success: false, error: 'Valid room code is required to join room.' };
        socket.emit('socketError', errPayload);
        return cb(errPayload);
      }

      const session = sessionService.getSessionByRoomCode(roomCode);
      if (!session) {
        const errPayload = { success: false, error: 'Session not found for the provided room code.' };
        socket.emit('socketError', errPayload);
        return cb(errPayload);
      }

      const targetRoomCode = session.roomCode;
      const requestedRole = (role && typeof role === 'string') ? role.toLowerCase().trim() : 'student';

      if (requestedRole === 'moderator') {
        // Task 7.3 & Task 7.9: Server-side Presenter Secret authorization check
        // Client-supplied flags (e.g. isModerator) are strictly ignored.
        if (!presenterSecret || typeof presenterSecret !== 'string' || presenterSecret !== session.presenterSecret) {
          // Reset socket data on auth failure to prevent privilege escalation
          socket.data.isModerator = false;
          socket.data.role = 'guest';
          socket.data.presenterSecret = null;

          const errPayload = { success: false, error: 'Unauthorized: Invalid or missing presenter secret token.' };
          socket.emit('socketError', errPayload);
          return cb(errPayload);
        }

        // Authenticated as presenter/moderator
        socket.data.roomCode = targetRoomCode;
        socket.data.role = 'moderator';
        socket.data.isModerator = true;
        socket.data.presenterSecret = presenterSecret;

        socket.join(`session:${targetRoomCode}`);
        socket.join(`session:${targetRoomCode}:moderator`);

        // Task 7.7: Return latest authoritative server state (no secrets included in payload)
        const resPayload = {
          success: true,
          roomCode: targetRoomCode,
          role: 'moderator',
          status: session.status,
          pendingQuestions: sessionService.getPendingQuestions(targetRoomCode),
          approvedQuestions: sessionService.getQuestionsByStatus(targetRoomCode, 'approved')
        };
        socket.emit('joinedRoom', resPayload);
        return cb(resPayload);
      }

      if (requestedRole === 'display') {
        socket.data.roomCode = targetRoomCode;
        socket.data.role = 'display';
        socket.data.isModerator = false;
        socket.data.presenterSecret = null;

        socket.join(`session:${targetRoomCode}`);
        socket.join(`session:${targetRoomCode}:display`);

        // Task 7.7 & Task 8.6: Authoritative display state sync (only questions marked for display)
        const resPayload = {
          success: true,
          roomCode: targetRoomCode,
          role: 'display',
          status: session.status,
          approvedQuestions: sessionService.getApprovedQuestionsForDisplay(targetRoomCode)
        };
        socket.emit('joinedRoom', resPayload);
        return cb(resPayload);
      }

      // Student role (default)
      socket.data.roomCode = targetRoomCode;
      socket.data.role = 'student';
      socket.data.isModerator = false;
      socket.data.presenterSecret = null;

      socket.join(`session:${targetRoomCode}`);
      const resPayload = {
        success: true,
        roomCode: targetRoomCode,
        role: 'student',
        status: session.status,
        activeQuestionPrompt: session.activeQuestionPrompt
      };
      socket.emit('joinedRoom', resPayload);
      return cb(resPayload);
    });

    /**
     * Task 7.7: Dedicated state synchronization handler for reconnecting clients.
     */
    socket.on('syncState', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const roomCode = (data && data.roomCode) || socket.data.roomCode;
      const presenterSecret = (data && data.presenterSecret) || socket.data.presenterSecret;
      const role = (data && data.role) || socket.data.role;

      if (!roomCode) {
        const errPayload = { success: false, error: 'Room code is required for state synchronization.' };
        return cb(errPayload);
      }

      const session = sessionService.getSessionByRoomCode(roomCode);
      if (!session) {
        const errPayload = { success: false, error: 'Session not found.', status: 'Closed' };
        return cb(errPayload);
      }

      if (role === 'moderator') {
        if (!presenterSecret || presenterSecret !== session.presenterSecret) {
          const errPayload = { success: false, error: 'Unauthorized: Presenter secret token required.' };
          return cb(errPayload);
        }
        return cb({
          success: true,
          roomCode: session.roomCode,
          role: 'moderator',
          status: session.status,
          activeQuestionPrompt: session.activeQuestionPrompt,
          pendingQuestions: sessionService.getPendingQuestions(session.roomCode),
          approvedQuestions: sessionService.getQuestionsByStatus(session.roomCode, 'approved')
        });
      }

      if (role === 'display') {
        return cb({
          success: true,
          roomCode: session.roomCode,
          role: 'display',
          status: session.status,
          activeQuestionPrompt: session.activeQuestionPrompt,
          approvedQuestions: sessionService.getApprovedQuestionsForDisplay(session.roomCode)
        });
      }

      return cb({
        success: true,
        roomCode: session.roomCode,
        role: 'student',
        status: session.status,
        activeQuestionPrompt: session.activeQuestionPrompt
      });
    });

    /**
     * Socket Event — Update Active Question Prompt (Presenter Action).
     */
    socket.on('updateActiveQuestionPrompt', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const { roomCode, activeQuestionPrompt, presenterSecret: payloadSecret } = data || {};
      const secret = payloadSecret || socket.data.presenterSecret;

      if (!roomCode || !activeQuestionPrompt) {
        return cb({ success: false, error: 'Room code and activeQuestionPrompt are required.' });
      }

      const result = sessionService.updateActiveQuestionPrompt(roomCode, activeQuestionPrompt, secret);

      if (!result.success) {
        return cb({ success: false, error: result.error || 'Unauthorized request.' });
      }

      const targetRoom = result.session.roomCode;
      if (io && typeof io.to === 'function') {
        io.to(`session:${targetRoom}`).emit('activeQuestionPromptChanged', {
          roomCode: targetRoom,
          activeQuestionPrompt: result.activeQuestionPrompt
        });
      }

      return cb({ success: true, activeQuestionPrompt: result.activeQuestionPrompt });
    });

    /**
     * Task 7.8, 7.9, 8.6, 8.7, 8.10, 8.11:
     * Sensitive Socket Event — Question Status Change Handler.
     * Enforces explicit presenter token authorization on every invocation.
     */
    socket.on('updateQuestionStatus', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const { roomCode, questionId, status, isDisplayed, presenterSecret: payloadSecret } = data || {};
      const secret = payloadSecret || socket.data.presenterSecret;

      if (!roomCode || !questionId || !status) {
        const errPayload = { success: false, error: 'Missing required parameters: roomCode, questionId, and status are required.' };
        return cb(errPayload);
      }

      // Task 7.8 & 8.10: Validate authorization and session state on EVERY sensitive socket event
      const options = typeof isDisplayed === 'boolean' ? { isDisplayed } : {};
      const result = sessionService.updateQuestionStatus(roomCode, questionId, status, secret, options);

      if (!result.success) {
        const errPayload = { success: false, error: result.error || 'Unauthorized request.' };
        return cb(errPayload);
      }

      // Broadcast real-time updates strictly to authorized session rooms
      const targetRoom = result.session.roomCode;
      const question = result.question;

      if (io && typeof io.to === 'function') {
        io.to(`session:${targetRoom}:moderator`).emit('questionStatusChanged', { roomCode: targetRoom, question });
      }

      if (question.status === 'approved' && question.isDisplayed !== false) {
        if (io && typeof io.to === 'function') {
          io.to(`session:${targetRoom}:display`).emit('approvedQuestionAdded', { roomCode: targetRoom, question });
        }
      } else {
        if (io && typeof io.to === 'function') {
          io.to(`session:${targetRoom}:display`).emit('approvedQuestionRemoved', { roomCode: targetRoom, question });
        }
      }

      const resPayload = { success: true, question };
      return cb(resPayload);
    });

    /**
     * Task 8.6: Sensitive Socket Event — Question Display Visibility Toggle Handler.
     * Allows moderator to add/remove approved question on presentation display screen.
     */
    socket.on('toggleQuestionDisplay', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const { roomCode, questionId, isDisplayed, presenterSecret: payloadSecret } = data || {};
      const secret = payloadSecret || socket.data.presenterSecret;

      if (!roomCode || !questionId || typeof isDisplayed !== 'boolean') {
        const errPayload = { success: false, error: 'Missing required parameters: roomCode, questionId, and boolean isDisplayed are required.' };
        return cb(errPayload);
      }

      const result = sessionService.updateQuestionDisplay(roomCode, questionId, isDisplayed, secret);

      if (!result.success) {
        const errPayload = { success: false, error: result.error || 'Unauthorized request.' };
        return cb(errPayload);
      }

      const targetRoom = result.session.roomCode;
      const question = result.question;

      if (io && typeof io.to === 'function') {
        io.to(`session:${targetRoom}:moderator`).emit('questionStatusChanged', { roomCode: targetRoom, question });
      }

      if (question.status === 'approved' && question.isDisplayed) {
        if (io && typeof io.to === 'function') {
          io.to(`session:${targetRoom}:display`).emit('approvedQuestionAdded', { roomCode: targetRoom, question });
        }
      } else {
        if (io && typeof io.to === 'function') {
          io.to(`session:${targetRoom}:display`).emit('approvedQuestionRemoved', { roomCode: targetRoom, question });
        }
      }

      return cb({ success: true, question });
    });

    /**
     * Task 7.8 & Task 7.9 & Task 8.8:
     * Sensitive Socket Event — Session Lifecycle Status Update Handler.
     * Enforces explicit presenter token authorization on every invocation.
     */
    socket.on('updateSessionStatus', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const { roomCode, status, presenterSecret: payloadSecret } = data || {};
      const secret = payloadSecret || socket.data.presenterSecret;

      if (!roomCode || !status) {
        const errPayload = { success: false, error: 'Missing required parameters: roomCode and status are required.' };
        return cb(errPayload);
      }

      const result = sessionService.updateSessionStatus(roomCode, status, secret);

      if (!result.success) {
        const errPayload = { success: false, error: result.error || 'Unauthorized request.' };
        return cb(errPayload);
      }

      const targetRoom = result.session.roomCode;
      if (io && typeof io.to === 'function') {
        io.to(`session:${targetRoom}`).emit('sessionStatusChanged', { roomCode: targetRoom, status: result.session.status });
      }

      return cb({ success: true, roomCode: targetRoom, status: result.session.status });
    });

    /**
     * Task 10.4: Sensitive Socket Event — Reset Active Session Questions.
     * Enforces explicit presenter token authorization on every invocation.
     */
    socket.on('resetSession', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const { roomCode, presenterSecret: payloadSecret } = data || {};
      const secret = payloadSecret || socket.data.presenterSecret;

      if (!roomCode) {
        const errPayload = { success: false, error: 'Room code parameter is required.' };
        return cb(errPayload);
      }

      const result = sessionService.resetSession(roomCode, secret);

      if (!result.success) {
        const errPayload = { success: false, error: result.error || 'Unauthorized request.' };
        return cb(errPayload);
      }

      const targetRoom = result.session.roomCode;
      if (io && typeof io.to === 'function') {
        io.to(`session:${targetRoom}`).emit('sessionReset', {
          roomCode: targetRoom,
          message: 'Session questions have been reset by the presenter.'
        });
      }

      return cb({ success: true, roomCode: targetRoom, message: 'Session reset successfully.' });
    });

    /**
     * Task 7.8 & Task 7.9:
     * Sensitive Socket Event — Fetch Pending Queue for Moderator.
     * Enforces explicit presenter token authorization.
     */
    socket.on('getPendingQuestions', (data, callback) => {
      const cb = typeof callback === 'function' ? callback : () => { };
      const { roomCode, presenterSecret: payloadSecret } = data || {};
      const secret = payloadSecret || socket.data.presenterSecret;

      if (!roomCode) {
        return cb({ success: false, error: 'Room code is required.' });
      }

      const session = sessionService.getSessionByRoomCode(roomCode);
      if (!session) {
        return cb({ success: false, error: 'Session not found.' });
      }

      if (!secret || secret !== session.presenterSecret) {
        return cb({ success: false, error: 'Unauthorized: Presenter token required.' });
      }

      const pendingQuestions = sessionService.getPendingQuestions(roomCode);
      return cb({ success: true, pendingQuestions });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected (${socket.id}) [Role: ${socket.data.role}]: ${reason}`);
    });
  });
}

module.exports = {
  initSocketHandlers
};
