const { server } = require('../src/server.js');
const http = require('http');
const assert = require('assert');
const { createSession, createQuestion, SESSION_STATUS } = require('../src/models/sessionModel');
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

async function runPhase4_8_and_4_9Tests() {
  console.log('--- Phase 4 (Tasks 4.8–4.9) Unit & Integration Tests ---');

  // ====================================================
  // Task 4.9: Single Active Session Policy Verification
  // ====================================================
  console.log('\n[Task 4.9] Testing Single-Active-Session Enforcement...');
  sessionService.clearAllSessions();

  // 1. Can create a session when no active session exists
  const session1 = sessionService.createNewSession();
  assert.ok(session1.roomCode);
  assert.strictEqual(session1.status, SESSION_STATUS.OPEN);
  console.log(`   ✓ Session 1 created successfully [Room: ${session1.roomCode}].`);

  // 2. Attempting to create a second session while Session 1 is 'Open' MUST be rejected
  assert.throws(() => {
    sessionService.createNewSession();
  }, /already exists/);
  console.log('   ✓ Creating 2nd session rejected while 1st session is Open.');

  // HTTP route attempt to create 2nd session
  const httpCreateRes1 = await httpRequest('POST', '/api/sessions/create', {});
  assert.strictEqual(httpCreateRes1.statusCode, 400);
  assert.strictEqual(JSON.parse(httpCreateRes1.body).success, false);
  console.log('   ✓ HTTP POST /api/sessions/create rejected when session is Open (HTTP 400).');

  // 3. Pause Session 1 -> Attempting to create 2nd session while Session 1 is 'Paused' MUST be rejected
  sessionService.updateSessionStatus(session1.roomCode, SESSION_STATUS.PAUSED, session1.presenterSecret);
  assert.strictEqual(sessionService.getActiveSession().status, SESSION_STATUS.PAUSED);

  assert.throws(() => {
    sessionService.createNewSession();
  }, /already exists/);
  console.log('   ✓ Creating 2nd session rejected while 1st session is Paused.');

  // 4. Close Session 1 -> Creating a new session MUST now succeed
  sessionService.updateSessionStatus(session1.roomCode, SESSION_STATUS.CLOSED, session1.presenterSecret);
  assert.strictEqual(sessionService.getActiveSession(), null);

  const session2 = sessionService.createNewSession();
  assert.ok(session2.roomCode);
  assert.notStrictEqual(session2.roomCode, session1.roomCode);
  assert.strictEqual(session2.status, SESSION_STATUS.OPEN);
  console.log(`   ✓ Session 2 created successfully after Session 1 closed [Room: ${session2.roomCode}].`);

  // Verify Session 1 historical record and questions are preserved after Session 2 creation
  assert.ok(sessionService.getSessionById(session1.id));
  console.log('   ✓ Closed session historical record preserved in memory.');

  // ====================================================
  // Task 4.8: Student Room Code and Active Status Tests
  // ====================================================
  console.log('\n[Task 4.8] Testing Student Room Code & Status API (/api/sessions/active)...');

  // Active session exists
  const activeRes = await httpRequest('GET', '/api/sessions/active');
  assert.strictEqual(activeRes.statusCode, 200);
  const activeBody = JSON.parse(activeRes.body);
  assert.strictEqual(activeBody.active, true);
  assert.strictEqual(activeBody.roomCode, session2.roomCode);
  assert.strictEqual(activeBody.status, SESSION_STATUS.OPEN);
  console.log('   ✓ Active session details correctly returned by GET /api/sessions/active.');

  // Close session 2 and test GET /api/sessions/active when no active session exists
  sessionService.updateSessionStatus(session2.roomCode, SESSION_STATUS.CLOSED, session2.presenterSecret);
  const noActiveRes = await httpRequest('GET', '/api/sessions/active');
  assert.strictEqual(noActiveRes.statusCode, 200);
  const noActiveBody = JSON.parse(noActiveRes.body);
  assert.strictEqual(noActiveBody.active, false);
  assert.strictEqual(noActiveBody.message, 'No active presentation session.');
  console.log('   ✓ Empty state correctly returned when no active session exists.');

  // Regression test
  const healthRes = await httpRequest('GET', '/health');
  assert.strictEqual(healthRes.statusCode, 200);

  const studentPageRes = await httpRequest('GET', '/student');
  assert.strictEqual(studentPageRes.statusCode, 200);

  console.log('\nAll Tasks 4.8–4.9 unit and integration tests completed successfully!');

  server.close(() => {
    process.exit(0);
  });
}

setTimeout(runPhase4_8_and_4_9Tests, 500);
