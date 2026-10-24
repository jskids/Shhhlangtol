const { server } = require('../src/server.js');
const http = require('http');
const assert = require('assert');
const { createSession, createQuestion, SESSION_STATUS, QUESTION_STATUS, isValidStatusTransition } = require('../src/models/sessionModel');
const { sessionService } = require('../src/services/sessionService');

function httpRequest(method, path, bodyData, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = bodyData ? JSON.stringify(bodyData) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      'http://localhost:3000' + path,
      { method, headers: reqHeaders },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase4_5_to_4_7Tests() {
  console.log('--- Phase 4 (Tasks 4.5–4.7) Unit & Integration Tests ---');

  // ==========================================
  // Task 4.5: Session State & Transition Tests
  // ==========================================
  console.log('\n[Task 4.5] Testing Session State Transition Rules...');
  sessionService.clearAllSessions();
  const session = sessionService.createNewSession();

  // 1. Newly created session starts in 'Open'
  assert.strictEqual(session.status, SESSION_STATUS.OPEN);
  console.log('   ✓ Newly created session starts in Open state.');

  // 2. Open -> Paused transition succeeds
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.OPEN, SESSION_STATUS.PAUSED), true);

  // 3. Paused -> Open transition succeeds
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.PAUSED, SESSION_STATUS.OPEN), true);

  // 4. Open -> Closed and Paused -> Closed transition succeeds
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.OPEN, SESSION_STATUS.CLOSED), true);
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.PAUSED, SESSION_STATUS.CLOSED), true);

  // 5. Invalid state values are rejected
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.OPEN, 'INVALID_STATE'), false);

  // 6. Closed is terminal and cannot transition back to Open or Paused
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.CLOSED, SESSION_STATUS.OPEN), false);
  assert.strictEqual(isValidStatusTransition(SESSION_STATUS.CLOSED, SESSION_STATUS.PAUSED), false);
  console.log('   ✓ All state transition rules verified.');

  // ==========================================
  // Task 4.6: Presenter Authorization Tests
  // ==========================================
  console.log('\n[Task 4.6] Testing Presenter Authorization & State Controls...');

  // Authorized presenter can pause session
  const pauseRes = await httpRequest('POST', '/api/sessions/status',
    { roomCode: session.roomCode, status: SESSION_STATUS.PAUSED },
    { 'x-presenter-token': session.presenterSecret }
  );
  assert.strictEqual(pauseRes.statusCode, 200);
  assert.strictEqual(JSON.parse(pauseRes.body).status, SESSION_STATUS.PAUSED);
  console.log('   ✓ Authorized presenter successfully paused session.');

  // Authorized presenter can resume session
  const resumeRes = await httpRequest('POST', '/api/sessions/status',
    { roomCode: session.roomCode, status: SESSION_STATUS.OPEN },
    { 'x-presenter-token': session.presenterSecret }
  );
  assert.strictEqual(resumeRes.statusCode, 200);
  assert.strictEqual(JSON.parse(resumeRes.body).status, SESSION_STATUS.OPEN);
  console.log('   ✓ Authorized presenter successfully resumed session.');

  // Unauthorized client (missing or invalid token) CANNOT change session state
  const unauthorizedRes = await httpRequest('POST', '/api/sessions/status',
    { roomCode: session.roomCode, status: SESSION_STATUS.PAUSED },
    { 'x-presenter-token': 'wrong-invalid-secret-token' }
  );
  assert.strictEqual(unauthorizedRes.statusCode, 403);
  assert.strictEqual(JSON.parse(unauthorizedRes.body).success, false);
  console.log('   ✓ Unauthorized state control request rejected with HTTP 403.');

  // Knowing room code or session ID alone does NOT grant presenter privileges
  const noTokenRes = await httpRequest('POST', '/api/sessions/status',
    { roomCode: session.roomCode, status: SESSION_STATUS.CLOSED }
  );
  assert.strictEqual(noTokenRes.statusCode, 403);
  console.log('   ✓ Room code alone without presenter token rejected with HTTP 403.');

  // Authorized presenter closes session
  const closeRes = await httpRequest('POST', '/api/sessions/status',
    { roomCode: session.roomCode, status: SESSION_STATUS.CLOSED },
    { 'x-presenter-token': session.presenterSecret }
  );
  assert.strictEqual(closeRes.statusCode, 200);
  assert.strictEqual(JSON.parse(closeRes.body).status, SESSION_STATUS.CLOSED);
  console.log('   ✓ Authorized presenter successfully closed session.');

  // Attempting to reopen a Closed session fails
  const reopenRes = await httpRequest('POST', '/api/sessions/status',
    { roomCode: session.roomCode, status: SESSION_STATUS.OPEN },
    { 'x-presenter-token': session.presenterSecret }
  );
  assert.strictEqual(reopenRes.statusCode, 400);
  assert.strictEqual(JSON.parse(reopenRes.body).success, false);
  console.log('   ✓ Reopening closed session correctly rejected with HTTP 400.');

  // ==========================================
  // Task 4.7: Question Submission Guards Tests
  // ==========================================
  console.log('\n[Task 4.7] Testing Submission Rejection when Paused or Closed...');
  sessionService.clearAllSessions();
  const subSession = sessionService.createNewSession();

  // 1. Question accepted when Open
  const openSub = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: subSession.roomCode,
    text: 'Can you explain client isolation?'
  });
  assert.strictEqual(openSub.statusCode, 201);
  const openBody = JSON.parse(openSub.body);
  assert.strictEqual(openBody.success, true);
  assert.strictEqual(openBody.question.text, 'Can you explain client isolation?');
  console.log('   ✓ Submission accepted when session is Open.');

  // 2. Pause session
  sessionService.updateSessionStatus(subSession.roomCode, SESSION_STATUS.PAUSED, subSession.presenterSecret);

  // Question rejected when Paused
  const pausedSub = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: subSession.roomCode,
    text: 'Will this question be accepted while paused?'
  });
  assert.strictEqual(pausedSub.statusCode, 400);
  const pausedBody = JSON.parse(pausedSub.body);
  assert.strictEqual(pausedBody.success, false);
  assert.strictEqual(pausedBody.status, SESSION_STATUS.PAUSED);
  console.log('   ✓ Submission rejected when session is Paused.');

  // 3. Close session
  sessionService.updateSessionStatus(subSession.roomCode, SESSION_STATUS.CLOSED, subSession.presenterSecret);

  // Question rejected when Closed
  const closedSub = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: subSession.roomCode,
    text: 'Will this question be accepted while closed?'
  });
  assert.strictEqual(closedSub.statusCode, 400);
  const closedBody = JSON.parse(closedSub.body);
  assert.strictEqual(closedBody.success, false);
  assert.strictEqual(closedBody.status, SESSION_STATUS.CLOSED);
  console.log('   ✓ Submission rejected when session is Closed.');

  // Submissions to nonexistent session rejected
  const nonExistentSub = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: 'ZZZZZZ',
    text: 'Nonexistent room question'
  });
  assert.strictEqual(nonExistentSub.statusCode, 404);
  console.log('   ✓ Submission to nonexistent session rejected with HTTP 404.');

  // Verify existing questions remain intact in memory after pause and close
  const checkSession = sessionService.getSessionById(subSession.id);
  assert.strictEqual(checkSession.questions.length, 1);
  assert.strictEqual(checkSession.questions[0].text, 'Can you explain client isolation?');
  console.log('   ✓ Existing questions preserved in memory after session pause/close.');

  // Regression check
  const healthRes = await httpRequest('GET', '/health');
  assert.strictEqual(healthRes.statusCode, 200);

  console.log('\nAll Tasks 4.5–4.7 tests completed successfully!');

  server.close(() => {
    process.exit(0);
  });
}

setTimeout(runPhase4_5_to_4_7Tests, 500);
