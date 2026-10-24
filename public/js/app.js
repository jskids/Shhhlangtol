/**
 * @file app.js
 * @description Frontend client logic for student join page, anonymous question form submission,
 * validation (max 300 chars, whitespace trimming), UI submission states, and real-time Socket.IO synchronization.
 */

const MAX_QUESTION_LENGTH = 300;

document.addEventListener('DOMContentLoaded', () => {
  console.log('QAlive Frontend App initialized.');

  // DOM Elements
  const roomCodeDisplay = document.getElementById('room-code-display');
  const appStatusBadge = document.getElementById('app-status');
  const sessionBanner = document.getElementById('session-state-banner');
  const feedbackMessage = document.getElementById('feedback-message');
  const questionForm = document.getElementById('question-form');
  const questionInput = document.getElementById('question-input');
  const submitBtn = document.getElementById('submit-btn');
  const charCountDisplay = document.getElementById('char-count');

  let currentRoomCode = null;
  let isSubmitting = false;

  /**
   * Displays a temporary feedback message banner (success, error, info).
   * @param {string} text - Message text to display.
   * @param {'success'|'danger'|'warning'|'info'} type - Alert style variant.
   */
  function showFeedback(text, type = 'info') {
    if (!feedbackMessage) return;
    feedbackMessage.className = `alert alert-${type}`;
    feedbackMessage.textContent = text;
    feedbackMessage.style.display = 'block';
  }

  /**
   * Clears the feedback banner.
   */
  function clearFeedback() {
    if (!feedbackMessage) return;
    feedbackMessage.style.display = 'none';
    feedbackMessage.textContent = '';
  }

  // Live Character Counter & Input Listener (Task 5.3)
  if (questionInput && charCountDisplay) {
    questionInput.addEventListener('input', () => {
      const len = questionInput.value.length;
      charCountDisplay.textContent = `${len} / ${MAX_QUESTION_LENGTH} characters`;
      if (len > MAX_QUESTION_LENGTH) {
        charCountDisplay.style.color = 'var(--danger)';
      } else {
        charCountDisplay.style.color = 'var(--text-muted)';
      }
    });
  }

  /**
   * Updates UI controls and banners according to session lifecycle state (Task 5.1).
   * @param {string} roomCode - Active 6-character room code.
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
      if (!isSubmitting) {
        if (questionInput) questionInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
      }

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
   * Fetches the current active presentation session from backend API (Task 5.1).
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

  /**
   * Handles anonymous question form submission with client validation (Tasks 5.2 & 5.3).
   */
  async function handleQuestionSubmit(e) {
    if (e) e.preventDefault();
    clearFeedback();

    if (!currentRoomCode) {
      showFeedback('No active presentation session available.', 'warning');
      return;
    }

    if (!questionInput) return;

    // Client-side validation: Trim whitespace (Task 5.3)
    const rawText = questionInput.value;
    const trimmedText = rawText.trim();

    if (trimmedText.length === 0) {
      showFeedback('Please enter a question before submitting.', 'danger');
      return;
    }

    if (trimmedText.length > MAX_QUESTION_LENGTH) {
      showFeedback(`Your question exceeds the maximum limit of ${MAX_QUESTION_LENGTH} characters (${trimmedText.length} characters).`, 'danger');
      return;
    }

    // Set submitting pending UI state & prevent double-clicks (Task 5.2)
    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }
    questionInput.disabled = true;

    try {
      const response = await fetch('/api/sessions/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomCode: currentRoomCode,
          text: trimmedText
        })
      });

      const data = await response.json();

      if (response.status === 201 && data.success) {
        // Confirmation ONLY after backend acceptance (Task 5.2)
        showFeedback('✅ Question submitted successfully! Your question is in the moderation queue.', 'success');

        // Clear text input ONLY after confirmed successful submission
        questionInput.value = '';
        if (charCountDisplay) {
          charCountDisplay.textContent = `0 / ${MAX_QUESTION_LENGTH} characters`;
          charCountDisplay.style.color = 'var(--text-muted)';
        }
      } else {
        // Server or session guard rejection (Task 5.2 & Task 4.7)
        showFeedback(data.error || 'Failed to submit question. Please try again.', 'danger');
        if (data.status) {
          updateSessionUI(currentRoomCode, data.status);
        }
      }

    } catch (err) {
      console.error('Submission error:', err);
      showFeedback('Network error. Unable to connect to server. Please check your Wi-Fi connection.', 'danger');
    } finally {
      // Restore form button state
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Question';
      }
      if (questionInput && (!sessionBanner || sessionBanner.style.display === 'none')) {
        questionInput.disabled = false;
        questionInput.focus();
      }
    }
  }

  // Attach submit listener
  if (questionForm) {
    questionForm.addEventListener('submit', handleQuestionSubmit);
  }

  // Initial session retrieval on page load
  fetchActiveSession();

  // Socket.IO Real-Time Synchronization Listener (Task 5.1 & Task 4.8)
  if (typeof io !== 'undefined') {
    const socket = io();

    socket.on('connect', () => {
      console.log('Connected to QAlive socket server:', socket.id);
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
      showFeedback('Connection to presentation server lost. Reconnecting...', 'warning');
    });
  }
});
