const { server } = require('../src/server.js');
const http = require('http');
const assert = require('assert');
const { createSession, createQuestion, SESSION_STATUS, MAX_QUESTION_LENGTH } = require('../src/models/sessionModel');
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

async function runPhase5Tests() {
  console.log('--- Phase 5 (Tasks 5.1–5.3) Unit & Integration Tests ---');

  // Clear sessions for clean state
  sessionService.clearAllSessions();
  const activeSession = sessionService.createNewSession();

  // ==========================================
  // Task 5.1: Student Join Page & Session API
  // ==========================================
  console.log('\n[Task 5.1] Testing Student Join Page & Active Session Retrieval...');
  const studentPageRes = await httpRequest('GET', '/student');
  assert.strictEqual(studentPageRes.statusCode, 200);
  assert.ok(studentPageRes.body.includes('QAlive'));
  console.log('   ✓ Student page HTML loads successfully with status HTTP 200.');

  const activeSessionRes = await httpRequest('GET', '/api/sessions/active');
  assert.strictEqual(activeSessionRes.statusCode, 200);
  const activeData = JSON.parse(activeSessionRes.body);
  assert.strictEqual(activeData.active, true);
  assert.strictEqual(activeData.roomCode, activeSession.roomCode);
  assert.strictEqual(activeData.status, SESSION_STATUS.OPEN);
  console.log(`   ✓ Active session details retrieved [Room: ${activeData.roomCode}, Status: ${activeData.status}].`);

  // ==========================================
  // Task 5.2: Anonymous Question Submission
  // ==========================================
  console.log('\n[Task 5.2] Testing Anonymous Question Submission Flow...');
  const validQuestionText = '   What is the difference between local Wi-Fi and public internet?   ';
  const subRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: activeSession.roomCode,
    text: validQuestionText
  });

  assert.strictEqual(subRes.statusCode, 201);
  const subData = JSON.parse(subRes.body);
  assert.strictEqual(subData.success, true);
  assert.ok(subData.question.id, 'Question must have a unique server-generated ID');
  assert.strictEqual(subData.question.text, 'What is the difference between local Wi-Fi and public internet?');
  assert.strictEqual(subData.question.status, 'pending');
  assert.ok(subData.question.createdAt);

  // Confirm no student identity fields are present
  assert.strictEqual(subData.question.studentName, undefined);
  assert.strictEqual(subData.question.email, undefined);
  console.log('   ✓ Anonymous question accepted with server-generated ID and trimmed text.');

  // ==========================================
  // Task 5.3: Question Validation (Empty & Max Length)
  // ==========================================
  console.log('\n[Task 5.3] Testing Empty Submission & Max Length Validation (Limit: 300)...');
  assert.strictEqual(MAX_QUESTION_LENGTH, 300);

  // 1. Empty string submission
  const emptyRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: activeSession.roomCode,
    text: ''
  });
  assert.strictEqual(emptyRes.statusCode, 400);
  console.log('   ✓ Empty string submission rejected with HTTP 400.');

  // 2. Whitespace-only submission
  const whitespaceRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: activeSession.roomCode,
    text: '   \n  \t  '
  });
  assert.strictEqual(whitespaceRes.statusCode, 400);
  console.log('   ✓ Whitespace-only submission rejected with HTTP 400.');

  // 3. Question exactly 300 characters
  const char300Text = 'A'.repeat(300);
  const maxOkRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: activeSession.roomCode,
    text: char300Text
  });
  assert.strictEqual(maxOkRes.statusCode, 201);
  assert.strictEqual(JSON.parse(maxOkRes.body).question.text.length, 300);
  console.log('   ✓ 300-character question accepted with HTTP 201.');

  // 4. Question exceeding 300 characters (301 chars)
  const char301Text = 'A'.repeat(301);
  const tooLongRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: activeSession.roomCode,
    text: char301Text
  });
  assert.strictEqual(tooLongRes.statusCode, 400);
  const tooLongData = JSON.parse(tooLongRes.body);
  assert.strictEqual(tooLongData.success, false);
  console.log('   ✓ 301-character question rejected with HTTP 400.');

  // Session guard checks
  sessionService.updateSessionStatus(activeSession.roomCode, SESSION_STATUS.PAUSED, activeSession.presenterSecret);
  const pausedSub = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: activeSession.roomCode,
    text: 'Valid text during paused session'
  });
  assert.strictEqual(pausedSub.statusCode, 400);
  console.log('   ✓ Paused session submission correctly rejected.');

  // Regression check
  const healthRes = await httpRequest('GET', '/health');
  assert.strictEqual(healthRes.statusCode, 200);

  console.log('\nAll Phase 5 (Tasks 5.1–5.3) tests completed successfully!');

  server.close(() => {
    process.exit(0);
  });
}

setTimeout(runPhase5Tests, 500);
