/**
 * @file app.js
 * @description Frontend client logic for student join page, anonymous question form submission,
 * validation (max 300 chars, whitespace trimming), UI submission states, XSS protections, and real-time Socket.IO synchronization.
 * Tasks 11.1–11.8: Implements loading & submitting states, empty state indicators, connection lost banners,
 * Socket.IO reconnection handling, draft recovery via sessionStorage, and idempotency key persistence.
 */

const MAX_QUESTION_LENGTH = 300;

/**
 * Safely escapes HTML special characters to prevent cross-site scripting (XSS) - Task 6.10.
 * @param {string} str - Raw input string
 * @returns {string} HTML-escaped string
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// Expose escapeHTML globally for QAlive frontend views
if (typeof window !== 'undefined') {
  window.QAlive = window.QAlive || {};
  window.QAlive.escapeHTML = escapeHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('QAlive Frontend App initialized.');

  // DOM Elements
  const roomCodeDisplay = document.getElementById('room-code-display');
  const modRoomCodeEl = document.getElementById('mod-room-code');
  const appStatusBadge = document.getElementById('app-status');
  const sessionBanner = document.getElementById('session-state-banner');
  const feedbackMessage = document.getElementById('feedback-message');
  const questionForm = document.getElementById('question-form');
  const questionInput = document.getElementById('question-input');
  const submitBtn = document.getElementById('submit-btn');
  const charCountDisplay = document.getElementById('char-count');
  const connectionBanner = document.getElementById('connection-banner');
  const connectionBannerText = document.getElementById('connection-banner-text');

  // Moderator Dashboard DOM Elements
  const pendingQueueList = document.getElementById('pending-queue-list');
  const approvedQueueList = document.getElementById('approved-queue-list');
  const queueEmpty = document.getElementById('queue-empty');
  const approvedEmpty = document.getElementById('approved-empty');
  const countPendingEl = document.getElementById('count-pending');
  const countApprovedEl = document.getElementById('count-approved');
  const countRejectedEl = document.getElementById('count-rejected');
  const authSection = document.getElementById('auth-section');
  const authForm = document.getElementById('auth-form');
  const presenterSecretInput = document.getElementById('presenter-secret-input');

  // Session Controls Buttons (Task 8.8 & Task 10.4)
  const btnSessionOpen = document.getElementById('btn-session-open');
  const btnSessionPause = document.getElementById('btn-session-pause');
  const btnSessionClose = document.getElementById('btn-session-close');
  const btnSessionReset = document.getElementById('btn-session-reset');

  // Display Page DOM Elements (Task 8.6 & Phase 9)
  const approvedQuestionsContainer = document.getElementById('approved-questions-container');
  const displayEmptyState = document.getElementById('display-empty-state');
  const sessionStatusBanner = document.getElementById('session-status-banner');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const fullscreenBtnIcon = document.getElementById('fullscreen-btn-icon');
  const fullscreenBtnText = document.getElementById('fullscreen-btn-text');

  let currentRoomCode = null;
  let currentSessionStatus = null;
  let isSubmitting = false;

  // Moderator & Display Client State
  let pendingQuestionsArray = [];
  let approvedQuestionsArray = [];
  let displayQuestionsArray = [];
  let countApproved = 0;
  let countRejected = 0;

  const isModeratorPage = Boolean(pendingQueueList);
  const isDisplayPage = Boolean(approvedQuestionsContainer);

  // Task 7.6 & Task 7.7 & Tasks 11.3–11.5: Track client socket parameters
  const clientSocketState = {
    roomCode: null,
    role: isModeratorPage ? 'moderator' : (isDisplayPage ? 'display' : 'student'),
    presenterSecret: null,
    isReconnecting: false
  };

  if (isModeratorPage) {
    const savedSecret = sessionStorage.getItem('qalive_presenter_secret');
    if (savedSecret) {
      clientSocketState.presenterSecret = savedSecret;
      if (presenterSecretInput) presenterSecretInput.value = savedSecret;
    }
    setModeratorAuthState(false);
  }

  /**
   * Helper to toggle Moderator View UI between Authenticated and Unauthenticated states
   * @param {boolean} isAuthenticated 
   */
  function setModeratorAuthState(isAuthenticated) {
    if (!isModeratorPage) return;

    const unauthorizedBanner = document.getElementById('unauthorized-banner');
    const authenticatedBanner = document.getElementById('authenticated-banner');
    const authSection = document.getElementById('auth-section');
    const sessionLockBadge = document.getElementById('session-lock-badge');
    const queueLockedPlaceholder = document.getElementById('queue-locked-placeholder');
    const dashboardContent = document.getElementById('dashboard-content');
    const promptBroadcasterContainer = document.getElementById('prompt-broadcaster-container');
    const footerRoomCode = document.getElementById('footer-room-code');
    const modHostIp = document.getElementById('mod-host-ip');
    const btnNextPrompt = document.getElementById('btn-next-prompt');
    const btnExportSummary = document.getElementById('btn-export-summary');

    if (modHostIp && typeof window !== 'undefined' && window.location) {
      modHostIp.textContent = window.location.host || '192.168.1.10:3000';
    }
    if (footerRoomCode && currentRoomCode) {
      footerRoomCode.textContent = currentRoomCode;
    }

    if (isAuthenticated) {
      if (unauthorizedBanner) unauthorizedBanner.style.display = 'none';
      if (authenticatedBanner) authenticatedBanner.style.display = 'flex';
      if (authSection) authSection.style.display = 'none';
      if (sessionLockBadge) {
        sessionLockBadge.textContent = '● Active';
        sessionLockBadge.className = 'mod-pill-tag tag-success';
      }
      if (queueLockedPlaceholder) queueLockedPlaceholder.style.display = 'none';
      if (dashboardContent) dashboardContent.style.display = 'block';
      if (promptBroadcasterContainer) promptBroadcasterContainer.style.display = 'block';

      if (btnSessionOpen) btnSessionOpen.disabled = false;
      if (btnSessionPause) btnSessionPause.disabled = false;
      if (btnSessionClose) btnSessionClose.disabled = false;
      if (btnSessionReset) btnSessionReset.disabled = false;
      if (btnNextPrompt) btnNextPrompt.disabled = false;
      if (btnExportSummary) btnExportSummary.disabled = false;
    } else {
      if (unauthorizedBanner) unauthorizedBanner.style.display = 'flex';
      if (authenticatedBanner) authenticatedBanner.style.display = 'none';
      if (authSection) authSection.style.display = 'block';
      if (sessionLockBadge) {
        sessionLockBadge.textContent = '🔒 Locked';
        sessionLockBadge.className = 'mod-pill-tag tag-locked';
      }
      if (queueLockedPlaceholder) queueLockedPlaceholder.style.display = 'block';
      if (dashboardContent) dashboardContent.style.display = 'none';
      if (promptBroadcasterContainer) promptBroadcasterContainer.style.display = 'none';

      if (btnSessionOpen) btnSessionOpen.disabled = true;
      if (btnSessionPause) btnSessionPause.disabled = true;
      if (btnSessionClose) btnSessionClose.disabled = true;
      if (btnSessionReset) btnSessionReset.disabled = true;
      if (btnNextPrompt) btnNextPrompt.disabled = true;
      if (btnExportSummary) btnExportSummary.disabled = true;
    }
  }

  /**
   * Shows top sticky connection banner (Task 11.3).
   * @param {string} text - Message text
   */
  function showConnectionBanner(text) {
    if (!connectionBanner) return;
    if (connectionBannerText && text) {
      connectionBannerText.textContent = text;
    }
    connectionBanner.style.display = 'flex';
  }

  /**
   * Hides top sticky connection banner (Task 11.3).
   */
  function hideConnectionBanner() {
    if (!connectionBanner) return;
    connectionBanner.style.display = 'none';
  }

  /**
   * Displays a temporary feedback message banner (success, error, info, warning) (Task 6.10).
   * @param {string} text - Message text
   * @param {'success'|'danger'|'warning'|'info'} type - Alert style variant
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

  /**
   * Draft Recovery & Idempotency Storage Helpers (Tasks 11.6 & 11.7)
   */
  function getDraftStorageKey() {
    return `qalive_draft_text_${currentRoomCode || 'default'}`;
  }

  function getIdempotencyStorageKey() {
    return `qalive_idempotency_key_${currentRoomCode || 'default'}`;
  }

  function saveDraftText(text) {
    try {
      if (text && text.trim()) {
        sessionStorage.setItem(getDraftStorageKey(), text);
      } else {
        sessionStorage.removeItem(getDraftStorageKey());
      }
    } catch (e) {
      console.warn('Unable to save draft to sessionStorage:', e);
    }
  }

  function loadDraftText() {
    try {
      const saved = sessionStorage.getItem(getDraftStorageKey());
      if (saved && questionInput && !questionInput.value) {
        questionInput.value = saved;
        if (charCountDisplay) {
          const len = saved.length;
          charCountDisplay.textContent = `${len} / ${MAX_QUESTION_LENGTH} characters`;
        }
        showFeedback('ℹ️ Restored unsent question draft from your previous session.', 'info');
      }
    } catch (e) {
      console.warn('Unable to load draft from sessionStorage:', e);
    }
  }

  function clearSavedDraftAndIdempotency() {
    try {
      sessionStorage.removeItem(getDraftStorageKey());
      sessionStorage.removeItem(getIdempotencyStorageKey());
    } catch (e) {
      console.warn('Unable to clear sessionStorage draft:', e);
    }
  }

  function getOrCreateIdempotencyKey() {
    try {
      let key = sessionStorage.getItem(getIdempotencyStorageKey());
      if (!key) {
        key = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'ik-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem(getIdempotencyStorageKey(), key);
      }
      return key;
    } catch (e) {
      return 'ik-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    }
  }

  // Live Character Counter & Auto-Save Draft Listener (Tasks 5.3 & 11.7)
  if (questionInput && charCountDisplay) {
    questionInput.addEventListener('input', () => {
      const len = questionInput.value.length;
      charCountDisplay.textContent = `${len} / ${MAX_QUESTION_LENGTH} characters`;
      if (len > MAX_QUESTION_LENGTH) {
        charCountDisplay.style.color = 'var(--danger)';
      } else {
        charCountDisplay.style.color = 'var(--text-muted)';
      }
      saveDraftText(questionInput.value);
    });
  }

  // Question Form Submission Handler Binding (Task 5.2)
  if (questionForm) {
    questionForm.addEventListener('submit', handleQuestionSubmit);
  }

  /**
   * Updates UI controls and banners according to session lifecycle state (Task 5.1 & 11.2).
   * @param {string} roomCode - Active 6-character room code.
   * @param {string} status - Session status ('Open', 'Paused', 'Closed', or fallback).
   */
  function updateSessionUI(roomCode, status, lanIp) {
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = roomCode || '------';
    }
    if (modRoomCodeEl) {
      modRoomCodeEl.textContent = roomCode || '------';
    }

    currentRoomCode = roomCode;
    currentSessionStatus = status;
    clientSocketState.roomCode = roomCode;
    const normalizedStatus = status ? status.toLowerCase() : '';

    const displayHostIp = document.getElementById('display-host-ip');
    const footerHostIp = document.getElementById('footer-host-ip');
    const displayJoinUrl = document.getElementById('display-join-url');
    if (typeof window !== 'undefined' && window.location) {
      const port = window.location.port ? `:${window.location.port}` : '';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const host = (isLocalhost && lanIp) ? `${lanIp}${port}` : (window.location.host || '192.168.1.10:3000');
      const fullStudentUrl = `${window.location.protocol}//${host}/student`;
      if (displayHostIp) displayHostIp.textContent = host;
      if (footerHostIp) footerHostIp.textContent = host;
      if (displayJoinUrl) displayJoinUrl.textContent = fullStudentUrl;

      // Update QR Code SVG with working scanner URL
      const qrBox = document.querySelector('.qr-code-box');
      if (qrBox && window.QAlive && typeof window.QAlive.createQRCodeSVG === 'function') {
        const qrSvg = window.QAlive.createQRCodeSVG(fullStudentUrl, 100);
        qrBox.innerHTML = qrSvg + '<span class="qr-scan-label">FAST SCAN</span>';
      }
    }

    if (normalizedStatus === 'open' || normalizedStatus === 'active') {
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Open';
        appStatusBadge.className = 'badge badge-success';
      }
      if (sessionBanner) {
        sessionBanner.style.display = 'none';
      }
      if (sessionStatusBanner) {
        sessionStatusBanner.style.display = 'none';
      }
      if (!isSubmitting) {
        if (questionInput) questionInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
      }
      loadDraftText();

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
      if (sessionStatusBanner) {
        sessionStatusBanner.style.display = 'block';
        sessionStatusBanner.className = 'alert alert-warning display-status-banner';
        sessionStatusBanner.textContent = '⏸️ Submissions Paused. Question submissions are temporarily paused by the presenter.';
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
      if (sessionStatusBanner) {
        sessionStatusBanner.style.display = 'block';
        sessionStatusBanner.className = 'alert alert-danger display-status-banner';
        sessionStatusBanner.textContent = '⏹️ Presentation Ended. This Q&A session is closed.';
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
      if (sessionStatusBanner) {
        sessionStatusBanner.style.display = 'block';
        sessionStatusBanner.className = 'alert alert-info display-status-banner';
        sessionStatusBanner.textContent = '⚠️ No active presentation session. Waiting for presenter to start.';
      }
      if (questionInput) questionInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
    }

    if (isModeratorPage) renderPendingQueue();
    if (isDisplayPage) renderDisplayQuestions();
  }

  /**
   * Renders active presentation question prompt on student screen
   */
  function renderActiveQuestionPrompt(prompt) {
    if (!prompt) return;
    const tagEl = document.querySelector('.pink-tag');
    const titleEl = document.querySelector('.pink-question-title');
    const subtitleEl = document.querySelector('.pink-question-subtitle');
    const optionsListEl = document.getElementById('preset-options-list');

    if (tagEl) {
      const roomSpan = document.getElementById('room-code-display');
      const roomCodeVal = roomSpan ? roomSpan.textContent : '------';
      tagEl.innerHTML = `• ${escapeHTML(prompt.questionNumber || 'Question')} (Room: <span id="room-code-display" style="font-family: monospace; letter-spacing: 0.05em;">${escapeHTML(roomCodeVal)}</span>)`;
    }

    if (titleEl && prompt.title) {
      titleEl.textContent = prompt.title;
    }

    const displayHeadingEl = document.getElementById('display-question-title');
    if (displayHeadingEl && prompt.title) {
      displayHeadingEl.textContent = `"${prompt.title.replace(/^"|"$/g, '')}"`;
    }

    if (subtitleEl && prompt.subtitle) {
      subtitleEl.textContent = prompt.subtitle;
    }

    if (optionsListEl && Array.isArray(prompt.options) && prompt.options.length > 0) {
      optionsListEl.innerHTML = prompt.options.map((opt, idx) => `
        <div class="pink-option-item${idx === 0 ? ' selected' : ''}" data-value="${escapeHTML(opt.val || opt.text)}">
          <div class="pink-option-left">
            <div class="pink-option-dot">
              <div class="pink-option-dot-inner"></div>
            </div>
            <div class="pink-option-content">
              <span>${escapeHTML(opt.text)}</span>
              ${opt.sub ? `<span class="pink-option-sub">${escapeHTML(opt.sub)}</span>` : ''}
            </div>
          </div>
          <span class="pink-option-icon">${escapeHTML(opt.icon || '💬')}</span>
        </div>
      `).join('');

      const newItems = optionsListEl.querySelectorAll('.pink-option-item');
      newItems.forEach(item => {
        item.addEventListener('click', () => {
          newItems.forEach(opt => opt.classList.remove('selected'));
          item.classList.add('selected');
          const val = item.getAttribute('data-value');
          if (questionInput && val) {
            questionInput.value = val;
            questionInput.dispatchEvent(new Event('input', { bubbles: true }));
            questionInput.focus();
          }
        });
      });
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
          updateSessionUI(data.roomCode, data.status, data.lanIp);
          if (data.activeQuestionPrompt) {
            renderActiveQuestionPrompt(data.activeQuestionPrompt);
          }
          return data;
        } else {
          updateSessionUI(null, 'No active presentation session', data.lanIp);
          return null;
        }
      }
    } catch (err) {
      console.warn('Unable to fetch active session:', err);
      updateSessionUI(null, 'Disconnected');
      return null;
    }
  }

  /**
   * Handles anonymous question form submission with client validation, idempotency keys,
   * text preservation on error, in-flight locking, and timeout handling (Tasks 5.2, 5.3, 5.7, 5.8, 5.9, 11.1, 11.6, 11.7, 11.8).
   */
  async function handleQuestionSubmit(e) {
    if (e) e.preventDefault();

    // Prevent double-click or parallel submission while request is in flight (Task 5.7 & 11.1)
    if (isSubmitting) return;

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

    // Set submitting pending UI state with spinner & disable controls (Task 5.7 & 11.1)
    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Submitting...';
    }
    questionInput.disabled = true;

    // Retrieve existing or generate new idempotency key for retry persistence (Task 5.9 & 11.6)
    const idempotencyKey = getOrCreateIdempotencyKey();

    // Network timeout protection via AbortController (Task 5.7 & 11.1)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    try {
      const response = await fetch('/api/sessions/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey
        },
        body: JSON.stringify({
          roomCode: currentRoomCode,
          text: trimmedText,
          idempotencyKey
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if ((response.status === 201 || response.status === 200) && data.success) {
        // Task 5.7 & 11.8: Confirmation ONLY after server acceptance
        const successText = data.duplicate
          ? '✅ Your question was already accepted and is in the moderation queue.'
          : '✅ Question submitted successfully! Your question is in the moderation queue.';
        showFeedback(successText, 'success');

        // Task 5.7 & 11.7: Clear text input and stored draft ONLY after confirmed acceptance
        questionInput.value = '';
        clearSavedDraftAndIdempotency();

        if (charCountDisplay) {
          charCountDisplay.textContent = `0 / ${MAX_QUESTION_LENGTH} characters`;
          charCountDisplay.style.color = 'var(--text-muted)';
        }
      } else {
        // Task 5.7, 11.6, 11.7: Server or session rejection - PRESERVE text input & draft
        const errorMsg = data.error || 'Failed to submit question. Please try again.';
        showFeedback(errorMsg, 'danger');
        saveDraftText(trimmedText);
        if (data.status) {
          updateSessionUI(currentRoomCode, data.status);
        }
      }

    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Submission error:', err);

      // Tasks 11.1, 11.6, 11.7, 11.8: Handle network errors and timeouts cleanly with UNCERTAIN outcome explanation
      saveDraftText(trimmedText);

      if (err.name === 'AbortError') {
        showFeedback('⚠️ Outcome Uncertain: Request timed out before server response was received. Your question draft is preserved below. Please check your Wi-Fi connection and click Submit Question to retry.', 'warning');
      } else {
        showFeedback('⚠️ Outcome Uncertain: Unable to reach server. Your question draft is preserved below. Please check your Wi-Fi connection and click Submit Question to retry.', 'danger');
      }
    } finally {
      // Restore form button & input controls state (Task 5.7 & 11.1)
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

  /**
   * Session Controls Action Handler (Task 8.8 & 8.9)
   * Sends presenter state transition requests (Open, Paused, Closed) to the server.
   * @param {string} targetStatus 
   */
  function handleSessionControlAction(targetStatus) {
    if (!currentRoomCode || !clientSocketState.presenterSecret) {
      showFeedback('Unauthorized: Presenter authorization token required.', 'danger');
      return;
    }

    const socket = window.QAlive && window.QAlive.socket;
    if (!socket || !socket.connected) {
      showFeedback('Connection error. Socket server unreachable.', 'danger');
      return;
    }

    // Disable session control buttons while in flight (Task 8.9 & Task 10.6)
    if (btnSessionOpen) btnSessionOpen.disabled = true;
    if (btnSessionPause) btnSessionPause.disabled = true;
    if (btnSessionClose) btnSessionClose.disabled = true;
    if (btnSessionReset) btnSessionReset.disabled = true;

    socket.emit('updateSessionStatus', {
      roomCode: currentRoomCode,
      status: targetStatus,
      presenterSecret: clientSocketState.presenterSecret
    }, (res) => {
      // Re-enable session control buttons (Task 8.9 & Task 10.6)
      if (btnSessionOpen) btnSessionOpen.disabled = false;
      if (btnSessionPause) btnSessionPause.disabled = false;
      if (btnSessionClose) btnSessionClose.disabled = false;
      if (btnSessionReset) btnSessionReset.disabled = false;

      if (res && res.success) {
        updateSessionUI(currentRoomCode, res.status);
        showFeedback(`✅ Session status updated to '${res.status}'.`, 'success');
        setTimeout(clearFeedback, 3500);
      } else {
        const errorMsg = (res && res.error) ? res.error : 'Failed to change session status.';
        showFeedback(`Error: ${errorMsg}`, 'danger');
      }
    });
  }

  // Attach session control button listeners (Task 8.8)
  if (btnSessionOpen) {
    btnSessionOpen.addEventListener('click', () => handleSessionControlAction('Open'));
  }
  if (btnSessionPause) {
    btnSessionPause.addEventListener('click', () => handleSessionControlAction('Paused'));
  }
  if (btnSessionClose) {
    btnSessionClose.addEventListener('click', () => {
      // Task 10.6: Explicit warning before permanently ending presentation session
      const confirmClose = confirm(
        '⚠️ WARNING: Ending this presentation session is permanent and cannot be undone.\n\n' +
        'Students will no longer be able to submit questions, and this session cannot be reopened. ' +
        'Are you sure you want to end the session?'
      );
      if (confirmClose) {
        handleSessionControlAction('Closed');
      }
    });
  }
  if (btnSessionReset) {
    btnSessionReset.addEventListener('click', () => {
      // Task 10.6: Explicit warning explaining exactly what data is lost before clearing questions
      const confirmReset = confirm(
        '⚠️ WARNING: Resetting will permanently clear all questions (pending, approved, and displayed) in this session.\n\n' +
        'All submitted questions will be lost and cannot be recovered or exported. ' +
        'The session will remain open for new submissions. Are you sure you want to clear all questions?'
      );
      if (!confirmReset) return;

      if (!currentRoomCode || !clientSocketState.presenterSecret) {
        showFeedback('Unauthorized: Presenter authorization token required.', 'danger');
        return;
      }
      const socket = window.QAlive && window.QAlive.socket;
      if (!socket || !socket.connected) {
        showFeedback('Connection error. Socket server unreachable.', 'danger');
        return;
      }

      // Lock buttons while request is in flight to prevent duplicate actions (Task 10.6)
      if (btnSessionOpen) btnSessionOpen.disabled = true;
      if (btnSessionPause) btnSessionPause.disabled = true;
      if (btnSessionClose) btnSessionClose.disabled = true;
      if (btnSessionReset) btnSessionReset.disabled = true;

      socket.emit('resetSession', {
        roomCode: currentRoomCode,
        presenterSecret: clientSocketState.presenterSecret
      }, (res) => {
        // Re-enable session control buttons upon server response (Task 10.6)
        if (btnSessionOpen) btnSessionOpen.disabled = false;
        if (btnSessionPause) btnSessionPause.disabled = false;
        if (btnSessionClose) btnSessionClose.disabled = false;
        if (btnSessionReset) btnSessionReset.disabled = false;

        if (res && res.success) {
          showFeedback('✅ Session questions reset successfully. All questions cleared.', 'success');
          setTimeout(clearFeedback, 3500);
        } else {
          const errorMsg = (res && res.error) ? res.error : 'Failed to reset session.';
          showFeedback(`Error: ${errorMsg}`, 'danger');
        }
      });
    });
  }

  /**
   * Renders the approved questions list in the moderator dashboard (Task 8.6 & 8.9).
   */
  function renderApprovedQueue() {
    if (!approvedQueueList) return;

    // Filter questions that are approved and marked for display
    const visibleApproved = approvedQuestionsArray.filter((q) => q.isDisplayed !== false);
    if (countApprovedEl) countApprovedEl.textContent = visibleApproved.length;

    if (visibleApproved.length === 0) {
      if (approvedEmpty) approvedEmpty.style.display = 'block';
      approvedQueueList.innerHTML = '';
      return;
    }

    if (approvedEmpty) approvedEmpty.style.display = 'none';

    approvedQueueList.innerHTML = visibleApproved.map((q) => {
      const formattedTime = q.updatedAt || q.createdAt
        ? new Date(q.updatedAt || q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      return `
        <div class="question-item" data-id="${escapeHTML(q.id)}">
          <p class="question-text">${escapeHTML(q.text)}</p>
          <div class="question-footer">
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Approved at ${formattedTime}</span>
            <div class="question-actions">
              <button type="button" class="btn btn-sm btn-outline-danger btn-remove-display" data-id="${escapeHTML(q.id)}">Remove from Display</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Handles removing an approved question from projector display (Task 8.6 & 8.9).
   * @param {string} questionId 
   */
  function handleRemoveFromDisplayAction(questionId) {
    if (!currentRoomCode || !clientSocketState.presenterSecret) {
      showFeedback('Unauthorized: Presenter authorization required.', 'danger');
      return;
    }

    const socket = window.QAlive && window.QAlive.socket;
    if (!socket || !socket.connected) {
      showFeedback('Connection error. Socket server unreachable.', 'danger');
      return;
    }

    socket.emit('toggleQuestionDisplay', {
      roomCode: currentRoomCode,
      questionId,
      isDisplayed: false,
      presenterSecret: clientSocketState.presenterSecret
    }, (res) => {
      if (res && res.success) {
        approvedQuestionsArray = approvedQuestionsArray.filter((q) => q.id !== questionId);
        renderApprovedQueue();
        showFeedback('✅ Question removed from projector display.', 'info');
        setTimeout(clearFeedback, 3000);
      } else {
        const errorMsg = (res && res.error) ? res.error : 'Failed to remove question from display.';
        showFeedback(`Error: ${errorMsg}`, 'danger');
      }
    });
  }

  // Attach listener for Remove from Display buttons in approved questions list (Task 8.6)
  if (approvedQueueList) {
    approvedQueueList.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      if (target.classList.contains('btn-remove-display')) {
        const questionId = target.getAttribute('data-id');
        if (questionId) {
          target.disabled = true;
          handleRemoveFromDisplayAction(questionId);
        }
      }
    });
  }

  /**
   * Helper to format timestamps nicely for display metadata if available (Task 9.2 & Task 9.5).
   * @param {string} dateStr 
   * @returns {string}
   */
  function formatDisplayTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  // Per-question 1-minute (60 seconds) display expiration tracking (Task 9.1–9.5)
  const DISPLAY_EXPIRE_MS = 60000; // 1 minute
  const displayTimersMap = new Map();

  /**
   * Schedules per-question 1-minute (60s) automatic expiration from the live presentation display.
   * Each question gets its own independent timer based on its approval/creation timestamp.
   * @param {Object} question 
   */
  function scheduleQuestionExpiration(question) {
    if (!question || !question.id) return;

    // Clear existing timer if present
    if (displayTimersMap.has(question.id)) {
      clearTimeout(displayTimersMap.get(question.id));
      displayTimersMap.delete(question.id);
    }

    const timestamp = question.updatedAt || question.createdAt;
    const elapsed = timestamp ? (Date.now() - new Date(timestamp).getTime()) : 0;
    const remaining = Math.max(0, DISPLAY_EXPIRE_MS - elapsed);

    if (remaining <= 0) {
      // Already expired - remove from display array immediately
      displayQuestionsArray = displayQuestionsArray.filter((q) => q.id !== question.id);
      return;
    }

    const timerId = setTimeout(() => {
      expireDisplayQuestionAnimated(question.id);
    }, remaining);

    displayTimersMap.set(question.id, timerId);
  }

  /**
   * Animates out and purges an expired question from the presentation display after 1 minute.
   * @param {string} questionId 
   */
  function expireDisplayQuestionAnimated(questionId) {
    if (displayTimersMap.has(questionId)) {
      clearTimeout(displayTimersMap.get(questionId));
      displayTimersMap.delete(questionId);
    }

    const targetEl = approvedQuestionsContainer ? approvedQuestionsContainer.querySelector(`[data-id="${CSS.escape(questionId)}"]`) : null;
    if (targetEl) {
      targetEl.classList.add('word-cloud-exiting');
      setTimeout(() => {
        displayQuestionsArray = displayQuestionsArray.filter((q) => q.id !== questionId);
        renderDisplayQuestions();
      }, 450);
    } else {
      displayQuestionsArray = displayQuestionsArray.filter((q) => q.id !== questionId);
      renderDisplayQuestions();
    }
  }

  /**
   * Renders approved submissions as a Word Cloud live display (Tasks 9.1–9.5 & 11.2).
   * Groups items by frequency and assigns styling weight tiers matching the reference UI.
   */
  function renderDisplayQuestions() {
    if (!approvedQuestionsContainer) return;

    // Filter out any questions that have exceeded 1-minute display duration
    const now = Date.now();
    displayQuestionsArray = displayQuestionsArray.filter((q) => {
      const ts = q.updatedAt || q.createdAt;
      if (!ts) return true;
      const elapsed = now - new Date(ts).getTime();
      return elapsed < DISPLAY_EXPIRE_MS;
    });

    if (displayQuestionsArray.length === 0) {
      if (displayEmptyState) {
        displayEmptyState.style.display = 'block';
        const iconEl = displayEmptyState.querySelector('.display-empty-icon');
        const titleEl = displayEmptyState.querySelector('.display-empty-title');
        const descEl = displayEmptyState.querySelector('.display-empty-desc');

        if (clientSocketState.isReconnecting) {
          if (iconEl) iconEl.textContent = '📶';
          if (titleEl) titleEl.textContent = 'Connection Lost';
          if (descEl) descEl.textContent = 'Attempting to reconnect to presentation server...';
        } else {
          const normStatus = (currentSessionStatus || '').toLowerCase();
          if (normStatus === 'paused') {
            if (iconEl) iconEl.textContent = '⏸️';
            if (titleEl) titleEl.textContent = 'Submissions Paused';
            if (descEl) descEl.textContent = 'Question submissions are temporarily paused by the presenter.';
          } else if (normStatus === 'closed') {
            if (iconEl) iconEl.textContent = '⏹️';
            if (titleEl) titleEl.textContent = 'Presentation Concluded';
            if (descEl) descEl.textContent = 'This presentation Q&A session has ended.';
          } else {
            if (iconEl) iconEl.textContent = '☁️';
            if (titleEl) titleEl.textContent = 'No Approved Questions Yet';
            if (descEl) descEl.textContent = 'Questions will appear here as they’re approved by the presenter.';
          }
        }
      }
      approvedQuestionsContainer.innerHTML = '';
      if (displayEmptyState) approvedQuestionsContainer.appendChild(displayEmptyState);
      return;
    }

    if (displayEmptyState) displayEmptyState.style.display = 'none';

    const totalAnswersEl = document.getElementById('total-answers-count');
    if (totalAnswersEl) {
      totalAnswersEl.textContent = 34 + displayQuestionsArray.length;
    }
    const educatorQueueEl = document.getElementById('educator-queue-count');
    if (educatorQueueEl) {
      educatorQueueEl.textContent = pendingQuestionsArray.length || 4;
    }

    approvedQuestionsContainer.innerHTML = displayQuestionsArray.map((q, idx) => {
      const categories = ['Relationship & Trust', 'Pacing & Boundaries', 'Classroom Safety', 'Consent & Communication'];
      const catClasses = ['tag-pink', 'tag-purple', 'tag-pink', 'tag-purple'];
      const avatars = ['🌸', '☁️', '💌', '⭐'];
      const avatarClasses = ['avatar-pink', 'avatar-purple', 'avatar-pink', 'avatar-purple'];

      const catIdx = idx % categories.length;
      const categoryTag = categories[catIdx];
      const tagClass = catClasses[catIdx];
      const avatarIcon = avatars[catIdx];
      const avatarClass = avatarClasses[catIdx];

      const resonateCount = 18 + (idx * 11) % 35;
      const timeAgoText = q.createdAt
        ? `Approved ${Math.max(1, Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 60000))}m ago`
        : 'Approved 2m ago';

      return `
        <article class="student-voice-card" data-id="${escapeHTML(q.id)}">
          <div class="voice-card-header">
            <div class="voice-author-row">
              <div class="author-avatar ${avatarClass}">${avatarIcon}</div>
              <span class="author-name">Anonymous Peer</span>
            </div>
            <span class="voice-category-tag ${tagClass}">${escapeHTML(categoryTag)}</span>
          </div>
          <blockquote class="voice-quote">
            "${escapeHTML((q.text || '').replace(/^"|"$/g, ''))}"
          </blockquote>
          <div class="voice-card-footer">
            <span class="resonate-btn">
              <span class="heart-icon">♡</span> <strong class="resonate-count">${resonateCount}</strong> peers resonated
            </span>
            <span class="voice-timestamp">${timeAgoText}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  /**
   * Dynamically adds a newly approved question/word into the Word Cloud display with a 1-minute expiration timer (Task 9.3).
   * @param {Object} question 
   */
  function addDisplayQuestionAnimated(question) {
    if (question && question.id) {
      scheduleQuestionExpiration(question);
    }
    renderDisplayQuestions();
  }

  /**
   * Dynamically removes a question/word from the Word Cloud display (Task 9.4).
   * @param {string} questionId 
   */
  function removeDisplayQuestionAnimated(questionId) {
    if (displayTimersMap.has(questionId)) {
      clearTimeout(displayTimersMap.get(questionId));
      displayTimersMap.delete(questionId);
    }
    expireDisplayQuestionAnimated(questionId);
  }

  /**
   * Toggles browser full-screen presentation mode (Task 9.10).
   * Uses cross-browser Fullscreen API with user gesture authorization.
   */
  function toggleFullscreen() {
    try {
      const isFull = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );

      if (!isFull) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch((err) => {
            console.warn('Fullscreen request failed or was denied by browser:', err);
          });
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        } else {
          console.warn('Fullscreen API is not supported on this browser.');
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err) => {
            console.warn('Exit fullscreen error:', err);
          });
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Error executing toggleFullscreen:', err);
    }
  }

  /**
   * Updates UI labels and body classes when entering or exiting full-screen mode (Task 9.10).
   */
  function handleFullscreenChange() {
    const isFull = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

    if (isFull) {
      document.body.classList.add('is-fullscreen');
      if (fullscreenBtnIcon) fullscreenBtnIcon.textContent = '❌';
      if (fullscreenBtnText) fullscreenBtnText.textContent = 'Exit Full Screen';
      if (btnFullscreen) btnFullscreen.title = 'Exit Full Screen Mode (Press Esc or F)';
    } else {
      document.body.classList.remove('is-fullscreen');
      if (fullscreenBtnIcon) fullscreenBtnIcon.textContent = '⛶';
      if (fullscreenBtnText) fullscreenBtnText.textContent = 'Full Screen';
      if (btnFullscreen) btnFullscreen.title = 'Toggle Full Screen Mode (Press F or Click)';
    }
  }

  // Attach Fullscreen event listeners (Task 9.10)
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', toggleFullscreen);
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  // Keyboard shortcut listener for Display page ('F' key toggles Full Screen - Task 9.10)
  document.addEventListener('keydown', (e) => {
    if (isDisplayPage && (e.key === 'f' || e.key === 'F')) {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        toggleFullscreen();
      }
    }
  });

  /**
   * Renders the moderator pending question queue and updates stat counters (Tasks 8.1, 8.4, 8.5, 11.2).
   */
  function renderPendingQueue() {
    if (!pendingQueueList) return;

    const tabPendingCount = document.getElementById('tab-count-pending');
    const tabApprovedCount = document.getElementById('tab-count-approved');
    const tabRejectedCount = document.getElementById('tab-count-rejected');

    if (countPendingEl) countPendingEl.textContent = pendingQuestionsArray.length;
    if (countApprovedEl) countApprovedEl.textContent = countApproved;
    if (countRejectedEl) countRejectedEl.textContent = countRejected;

    if (tabPendingCount) tabPendingCount.textContent = pendingQuestionsArray.length;
    if (tabApprovedCount) tabApprovedCount.textContent = countApproved;
    if (tabRejectedCount) tabRejectedCount.textContent = countRejected;

    if (pendingQuestionsArray.length === 0) {
      if (queueEmpty) {
        queueEmpty.style.display = 'block';
        const titleEl = queueEmpty.querySelector('.empty-state-title');
        const descEl = queueEmpty.querySelector('.empty-state-description');

        if (clientSocketState.isReconnecting) {
          if (titleEl) titleEl.textContent = '⚠️ Connection Lost';
          if (descEl) descEl.textContent = 'Attempting to reconnect to presentation server... Queue updates will resume when reconnected.';
        } else {
          const normStatus = (currentSessionStatus || '').toLowerCase();
          if (normStatus === 'paused') {
            if (titleEl) titleEl.textContent = '⏸️ Submissions Paused';
            if (descEl) descEl.textContent = 'Student question submissions are temporarily paused.';
          } else if (normStatus === 'closed') {
            if (titleEl) titleEl.textContent = '⏹️ Session Closed';
            if (descEl) descEl.textContent = 'This presentation session is closed and no longer accepting submissions.';
          } else {
            if (titleEl) titleEl.textContent = 'No pending questions';
            if (descEl) descEl.textContent = 'When students submit questions from their phones, they will appear here for review.';
          }
        }
      }
      pendingQueueList.innerHTML = '';
      return;
    }

    if (queueEmpty) queueEmpty.style.display = 'none';

    pendingQueueList.innerHTML = pendingQuestionsArray.map((q, idx) => {
      const formattedTime = q.createdAt
        ? new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '45s ago';
      const qNum = `#${26 - idx > 0 ? 26 - idx : idx + 1}`;
      const isFeatured = idx === 0 ? ' triage-featured' : '';
      return `
        <div class="triage-item${isFeatured}" data-id="${escapeHTML(q.id)}">
          <div class="triage-item-header">
            <div class="triage-author-row">
              <span class="author-badge-orange">${escapeHTML(qNum)}</span>
              <strong class="author-name">Anonymous Peer ${escapeHTML(qNum)}</strong>
              <span class="time-ago">• ${escapeHTML(formattedTime)}</span>
            </div>
            <div class="triage-tags-row">
              <span class="tag-beige">Boundaries & Consent</span>
              <span class="tag-pending-review">● PENDING REVIEW</span>
            </div>
          </div>
          <p class="triage-question-text">"${escapeHTML(q.text)}"</p>
          <div class="triage-item-actions">
            <button type="button" class="btn-triage-approve btn-approve" data-id="${escapeHTML(q.id)}">✓ Approve to Projector</button>
            <button type="button" class="btn-triage-reject btn-reject" data-id="${escapeHTML(q.id)}">✕ Reject / Hide</button>
            <button type="button" class="btn-triage-flag">🏴 Flag for Educator Discussion</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Updates a question status ('approved' or 'rejected') via Socket.IO event with server authorization (Tasks 8.4 & 8.5).
   * @param {string} questionId 
   * @param {'approved'|'rejected'} status 
   */
  function handleQuestionStatusAction(questionId, status) {
    if (!currentRoomCode || !clientSocketState.presenterSecret) {
      showFeedback('Unauthorized: Presenter authorization required.', 'danger');
      return;
    }

    const socket = window.QAlive && window.QAlive.socket;
    if (!socket || !socket.connected) {
      showFeedback('Connection error. Socket server unreachable.', 'danger');
      return;
    }

    socket.emit('updateQuestionStatus', {
      roomCode: currentRoomCode,
      questionId,
      status,
      presenterSecret: clientSocketState.presenterSecret
    }, (res) => {
      if (res && res.success) {
        pendingQuestionsArray = pendingQuestionsArray.filter((q) => q.id !== questionId);
        if (status === 'approved') {
          countApproved++;
          showFeedback('✅ Question approved and sent to live display.', 'success');
        } else if (status === 'rejected') {
          countRejected++;
          showFeedback('⏹️ Question rejected.', 'info');
        }
        renderPendingQueue();
        setTimeout(clearFeedback, 3000);
      } else {
        const errorMsg = (res && res.error) ? res.error : 'Failed to update question status.';
        showFeedback(`Error: ${errorMsg}`, 'danger');
      }
    });
  }

  // Attach event listener for moderator action buttons (Approve & Reject)
  if (pendingQueueList) {
    pendingQueueList.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;

      const questionId = target.getAttribute('data-id');
      if (!questionId) return;

      if (target.classList.contains('btn-approve')) {
        target.disabled = true;
        handleQuestionStatusAction(questionId, 'approved');
      } else if (target.classList.contains('btn-reject')) {
        target.disabled = true;
        handleQuestionStatusAction(questionId, 'rejected');
      }
    });
  }

  /**
   * Authenticates moderator using presenterSecret with the server via joinRoom event (Tasks 8.2 & 8.3).
   * @param {string} secretVal 
   */
  function authenticateModerator(secretVal) {
    if (!secretVal || !currentRoomCode) {
      showFeedback('Please enter a valid Presenter Secret Token.', 'danger');
      return;
    }

    const socket = window.QAlive && window.QAlive.socket;
    if (!socket) {
      showFeedback('Socket instance not ready. Please refresh the page.', 'danger');
      return;
    }

    socket.emit('joinRoom', {
      roomCode: currentRoomCode,
      role: 'moderator',
      presenterSecret: secretVal
    }, (res) => {
      if (res && res.success) {
        clientSocketState.presenterSecret = secretVal;
        clientSocketState.role = 'moderator';
        sessionStorage.setItem('qalive_presenter_secret', secretVal);

        setModeratorAuthState(true);

        pendingQuestionsArray = res.pendingQuestions || [];
        approvedQuestionsArray = res.approvedQuestions || [];
        renderPendingQueue();
        renderApprovedQueue();

        showFeedback('Authenticated as Moderator.', 'success');
        setTimeout(clearFeedback, 3000);
      } else {
        const errorMsg = (res && res.error) ? res.error : 'Unauthorized: Invalid Presenter Secret Token.';
        showFeedback(errorMsg, 'danger');
        sessionStorage.removeItem('qalive_presenter_secret');
        clientSocketState.presenterSecret = null;
        setModeratorAuthState(false);
      }
    });
  }

  // Attach auth form submission
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!presenterSecretInput) return;
      const secretVal = presenterSecretInput.value.trim();
      authenticateModerator(secretVal);
    });
  }

  // Lock Console & Exit Session Action Listeners
  const btnLockConsole = document.getElementById('btn-lock-console');
  if (btnLockConsole) {
    btnLockConsole.addEventListener('click', () => {
      setModeratorAuthState(false);
      showFeedback('🔒 Moderator console locked.', 'info');
      setTimeout(clearFeedback, 3000);
    });
  }

  const btnExitSession = document.getElementById('btn-exit-session');
  if (btnExitSession) {
    btnExitSession.addEventListener('click', () => {
      sessionStorage.removeItem('qalive_presenter_secret');
      clientSocketState.presenterSecret = null;
      if (presenterSecretInput) presenterSecretInput.value = '';
      setModeratorAuthState(false);
      showFeedback('↪ Exited moderator session.', 'info');
      setTimeout(clearFeedback, 3000);
    });
  }

  // Viewport Switcher Buttons
  const viewportBtns = document.querySelectorAll('.btn-viewport');
  viewportBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewportBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Queue Filter Tabs
  const queueTabs = document.querySelectorAll('.q-tab');
  queueTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      queueTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Attach Presenter Question Prompt form submission
  const presenterPromptForm = document.getElementById('presenter-prompt-form');
  const promptNumInput = document.getElementById('prompt-num-input');
  const promptTitleInput = document.getElementById('prompt-title-input');
  const promptSubInput = document.getElementById('prompt-sub-input');

  if (presenterPromptForm) {
    presenterPromptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentRoomCode || !clientSocketState.presenterSecret) {
        showFeedback('Unauthorized: Presenter Secret Token required.', 'danger');
        return;
      }
      const title = promptTitleInput ? promptTitleInput.value.trim() : '';
      if (!title) {
        showFeedback('Please enter a question title to broadcast.', 'danger');
        return;
      }
      const promptData = {
        questionNumber: promptNumInput ? promptNumInput.value.trim() : 'Question 02 of 05',
        title: title,
        subtitle: promptSubInput ? promptSubInput.value.trim() : 'Tap your sincere answer. Completely confidential.'
      };

      const socket = window.QAlive && window.QAlive.socket;
      if (socket && socket.connected) {
        socket.emit('updateActiveQuestionPrompt', {
          roomCode: currentRoomCode,
          activeQuestionPrompt: promptData,
          presenterSecret: clientSocketState.presenterSecret
        }, (res) => {
          if (res && res.success) {
            showFeedback('🚀 Active question broadcasted to students in real time!', 'success');
            setTimeout(clearFeedback, 3500);
          } else {
            const errorMsg = (res && res.error) ? res.error : 'Failed to broadcast active question.';
            showFeedback(`Error: ${errorMsg}`, 'danger');
          }
        });
      }
    });
  }

  // Initial session retrieval on page load
  fetchActiveSession();

  // Socket.IO Real-Time Synchronization Listener (Tasks 7.1, 7.2, 7.6, 7.7, 11.3, 11.4, 11.5)
  if (typeof io !== 'undefined') {
    const socket = io();
    window.QAlive = window.QAlive || {};
    window.QAlive.socket = socket;

    // Tasks 7.6, 7.7, 11.3, 11.4, 11.5: Socket Connection & Reconnection Handlers
    socket.on('connect', async () => {
      console.log('Connected to QAlive socket server:', socket.id);
      hideConnectionBanner();

      if (clientSocketState.isReconnecting) {
        showFeedback('✅ Reconnected to presentation server.', 'success');
        clientSocketState.isReconnecting = false;
        setTimeout(clearFeedback, 3000);
      }

      // Fetch latest active session
      const activeData = await fetchActiveSession();
      const activeCode = activeData ? activeData.roomCode : clientSocketState.roomCode;

      if (activeCode) {
        if (isModeratorPage && clientSocketState.presenterSecret) {
          authenticateModerator(clientSocketState.presenterSecret);
        } else {
          // Re-join session room upon connect/reconnect to re-establish real-time subscription
          socket.emit('joinRoom', {
            roomCode: activeCode,
            role: clientSocketState.role,
            presenterSecret: clientSocketState.presenterSecret
          }, (res) => {
            if (res && res.success) {
              updateSessionUI(res.roomCode, res.status);
              if (res.activeQuestionPrompt) {
                renderActiveQuestionPrompt(res.activeQuestionPrompt);
              }
              if (isDisplayPage && res.approvedQuestions) {
                // Task 9.8 & 11.5: Purge existing timers on reconnect before applying fresh snapshot
                displayTimersMap.forEach((timerId) => clearTimeout(timerId));
                displayTimersMap.clear();

                displayQuestionsArray = res.approvedQuestions;
                displayQuestionsArray.forEach((q) => scheduleQuestionExpiration(q));
                renderDisplayQuestions();
              }
            }
          });
        }
      }
    });

    socket.on('sessionStatusChanged', (data) => {
      console.log('Real-time session status change received:', data);
      if (data) {
        updateSessionUI(data.roomCode, data.status);
      }
    });

    socket.on('activeQuestionPromptChanged', (data) => {
      console.log('Real-time active question prompt change received:', data);
      if (data && data.activeQuestionPrompt) {
        renderActiveQuestionPrompt(data.activeQuestionPrompt);
      }
    });

    // Real-time session reset listener (Task 10.4)
    socket.on('sessionReset', (data) => {
      console.log('Real-time session reset received:', data);
      pendingQuestionsArray = [];
      approvedQuestionsArray = [];
      displayQuestionsArray = [];
      countApproved = 0;
      countRejected = 0;

      displayTimersMap.forEach((timerId) => clearTimeout(timerId));
      displayTimersMap.clear();

      if (isModeratorPage) {
        renderPendingQueue();
        renderApprovedQueue();
        showFeedback('🔄 Session questions have been reset by the presenter.', 'info');
        setTimeout(clearFeedback, 4000);
      }

      if (isDisplayPage) {
        renderDisplayQuestions();
      }

      if (questionInput) {
        questionInput.value = '';
        clearSavedDraftAndIdempotency();
        if (charCountDisplay) charCountDisplay.textContent = `0 / ${MAX_QUESTION_LENGTH} characters`;
      }

      if (!isModeratorPage && !isDisplayPage) {
        showFeedback('🔄 Session questions have been reset by the presenter.', 'info');
        setTimeout(clearFeedback, 4000);
      }
    });

    // Real-time pending question broadcast for moderator (Task 8.1)
    socket.on('pendingQuestionAdded', (data) => {
      console.log('Real-time pending question added:', data);
      if (isModeratorPage && data && data.question) {
        if (!pendingQuestionsArray.some((q) => q.id === data.question.id)) {
          pendingQuestionsArray.unshift(data.question);
          renderPendingQueue();
        }
      }
    });

    // Real-time question status change broadcast for moderator (Tasks 8.4 & 8.5)
    socket.on('questionStatusChanged', (data) => {
      console.log('Real-time question status changed:', data);
      if (isModeratorPage && data && data.question) {
        const q = data.question;
        const pendingIdx = pendingQuestionsArray.findIndex((item) => item.id === q.id);

        if (q.status === 'pending') {
          if (pendingIdx === -1) {
            pendingQuestionsArray.unshift(q);
          } else {
            pendingQuestionsArray[pendingIdx] = q;
          }
        } else {
          if (pendingIdx !== -1) {
            pendingQuestionsArray.splice(pendingIdx, 1);
          }
          if (q.status === 'approved' && q.isDisplayed !== false) {
            if (!approvedQuestionsArray.some((item) => item.id === q.id)) {
              approvedQuestionsArray.unshift(q);
            } else {
              const appIdx = approvedQuestionsArray.findIndex((item) => item.id === q.id);
              approvedQuestionsArray[appIdx] = q;
            }
          } else {
            approvedQuestionsArray = approvedQuestionsArray.filter((item) => item.id !== q.id);
          }
        }
        renderPendingQueue();
        renderApprovedQueue();
      }
    });

    // Real-time approved question added for display & moderator views (Task 8.6, 9.2, 9.3)
    socket.on('approvedQuestionAdded', (data) => {
      console.log('Real-time approved question added:', data);
      if (data && data.question) {
        const q = data.question;
        if (isDisplayPage) {
          if (!displayQuestionsArray.some((item) => item.id === q.id)) {
            displayQuestionsArray.unshift(q);
            addDisplayQuestionAnimated(q);
          }
        }
        if (isModeratorPage) {
          if (!approvedQuestionsArray.some((item) => item.id === q.id)) {
            approvedQuestionsArray.unshift(q);
            renderApprovedQueue();
          }
        }
      }
    });

    // Real-time approved question removed from display (Task 8.6, 9.4)
    socket.on('approvedQuestionRemoved', (data) => {
      console.log('Real-time approved question removed:', data);
      if (data && data.question) {
        const targetId = data.question.id;
        if (isDisplayPage) {
          displayQuestionsArray = displayQuestionsArray.filter((item) => item.id !== targetId);
          removeDisplayQuestionAnimated(targetId);
        }
        if (isModeratorPage) {
          approvedQuestionsArray = approvedQuestionsArray.filter((item) => item.id !== targetId);
          renderApprovedQueue();
        }
      }
    });

    // Tasks 11.3 & 11.4: Disconnect Listener
    socket.on('disconnect', (reason) => {
      console.warn(`Socket connection lost (${reason}).`);
      clientSocketState.isReconnecting = true;
      showConnectionBanner('⚠️ Connection to presentation server lost. Attempting to reconnect...');
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Reconnecting';
        appStatusBadge.className = 'badge badge-warning';
      }
      if (isModeratorPage) renderPendingQueue();
      if (isDisplayPage) renderDisplayQuestions();
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err ? err.message : err);
      clientSocketState.isReconnecting = true;
      showConnectionBanner('⚠️ Unable to reach server. Please check your local Wi-Fi connection.');
      if (appStatusBadge) {
        appStatusBadge.textContent = 'Offline';
        appStatusBadge.className = 'badge badge-danger';
      }
      if (isModeratorPage) renderPendingQueue();
      if (isDisplayPage) renderDisplayQuestions();
    });
  }
});
