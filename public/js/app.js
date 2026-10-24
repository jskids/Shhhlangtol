/**
 * @file app.js
 * @description Frontend client logic for active room display, session state management, and Socket.IO real-time synchronization (Task 4.8).
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('QAlive Frontend App initialized.');

  // DOM Elements
  const roomCodeDisplay = document.getElementById('room-code-display');
  const appStatusBadge = document.getElementById('app-status');
  const sessionBanner = document.getElementById('session-state-banner');
  const questionInput = document.getElementById('question-input');
  const submitBtn = document.getElementById('submit-btn');
  const charCountDisplay = document.getElementById('char-count');

  let currentRoomCode = null;

  // Character counter listener for student text area
  if (questionInput && charCountDisplay) {
    questionInput.addEventListener('input', () => {
      const len = questionInput.value.length;
      charCountDisplay.textContent = `${len} / 300 characters`;
    });
  }

  /**
   * Updates the UI representation according to the presentation session state (Task 4.8).
   * @param {string} roomCode - 6-character room code.
   * @param {string} status - Session status ('Open', 'Paused', 'Closed', or fallback).
   */
  function updateSessionUI(roomCode, status) {
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = roomCode || '------';
    }

    currentRoomCode = roomCode;
    const normalizedStatus = status ? status.toLowerCase() : '';

    if (normalizedStatus === 'open' || normalizedStatus === 'active') {
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Open';
        appStatusBadge.className = 'badge badge-success';
      }
      if (sessionBanner) {
        sessionBanner.style.display = 'none';
      }
      if (questionInput) questionInput.disabled = false;
      if (submitBtn) submitBtn.disabled = false;

    } else if (normalizedStatus === 'paused') {
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Paused';
        appStatusBadge.className = 'badge badge-warning';
      }
      if (sessionBanner) {
        sessionBanner.style.display = 'block';
        sessionBanner.className = 'alert alert-warning';
        sessionBanner.textContent = '⏸️ Presentation Paused. Question submissions are temporarily paused by the presenter.';
      }
      if (questionInput) questionInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;

    } else if (normalizedStatus === 'closed') {
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Closed';
        appStatusBadge.className = 'badge badge-danger';
      }
      if (sessionBanner) {
        sessionBanner.style.display = 'block';
        sessionBanner.className = 'alert alert-danger';
        sessionBanner.textContent = '⏹️ Presentation Ended. This session is closed and no longer accepting questions.';
      }
      if (questionInput) questionInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;

    } else {
      // Fallback: No active session
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Inactive';
        appStatusBadge.className = 'badge badge-neutral';
      }
      if (sessionBanner) {
        sessionBanner.style.display = 'block';
        sessionBanner.className = 'alert alert-info';
        sessionBanner.textContent = '⚠️ No active presentation session. Please wait for the presenter to start.';
      }
      if (questionInput) questionInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
    }
  }

  /**
   * Fetches the current active presentation session from the backend.
   */
  async function fetchActiveSession() {
    try {
      const res = await fetch('/api/sessions/active');
      if (res.ok) {
        const data = await res.json();
        if (data.active) {
          updateSessionUI(data.roomCode, data.status);
        } else {
          updateSessionUI(null, 'No active presentation session');
        }
      }
    } catch (err) {
      console.warn('Unable to fetch active session:', err);
      updateSessionUI(null, 'Disconnected');
    }
  }

  // Initial session retrieval on page load
  fetchActiveSession();

  // Socket.IO Real-Time Synchronization Listener (Task 4.8)
  if (typeof io !== 'undefined') {
    const socket = io();

    socket.on('connect', () => {
      console.log('Connected to QAlive live socket server:', socket.id);
      fetchActiveSession();
    });

    socket.on('sessionStatusChanged', (data) => {
      console.log('Real-time session status change received:', data);
      if (data) {
        updateSessionUI(data.roomCode, data.status);
      }
    });

    socket.on('disconnect', () => {
      console.warn('Socket connection lost.');
    });
  }
});
