const { server } = require('../src/server.js');
const http = require('http');
const assert = require('assert');
const { createSession, createQuestion, SESSION_STATUS, QUESTION_STATUS, MAX_QUESTION_LENGTH } = require('../src/models/sessionModel');
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

async function runTasks5_4_to_5_6Tests() {
  console.log('--- Phase 5 (Tasks 5.4–5.6) Server Validation, IDs & Queue Tests ---');

  sessionService.clearAllSessions();
  const session = sessionService.createNewSession();

  // ====================================================
  // Task 5.4: Server Payload & State Validation Tests
  // ====================================================
  console.log('\n[Task 5.4] Testing Server Payload & State Validation Rules...');

  // 1. Non-string types rejected
  const nonStringPayloads = [123, true, [], { text: 'nested' }, null];
  for (const invalidText of nonStringPayloads) {
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: invalidText
    });
    assert.strictEqual(res.statusCode, 400);
  }
  console.log('   ✓ Non-string question payloads rejected with HTTP 400.');

  // 2. Empty and whitespace-only text rejected
  const emptyRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: '' });
  assert.strictEqual(emptyRes.statusCode, 400);

  const whitespaceRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: '   \n \t  ' });
  assert.strictEqual(whitespaceRes.statusCode, 400);
  console.log('   ✓ Empty and whitespace-only submissions rejected with HTTP 400.');

  // 3. Leading and trailing whitespace trimmed
  const untrimmedRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: '   How does Socket.IO manage reconnections?   '
  });
  assert.strictEqual(untrimmedRes.statusCode, 201);
  const untrimmedBody = JSON.parse(untrimmedRes.body);
  assert.strictEqual(untrimmedBody.question.text, 'How does Socket.IO manage reconnections?');
  console.log('   ✓ Question text trimmed correctly before storing.');

  // 4. Max length validation (300 limit)
  const char300 = 'B'.repeat(300);
  const char300Res = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: char300 });
  assert.strictEqual(char300Res.statusCode, 201);

  const char301 = 'B'.repeat(301);
  const char301Res = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: char301 });
  assert.strictEqual(char301Res.statusCode, 400);
  console.log('   ✓ Max length 300 accepted (201), 301 rejected (400).');

  // 5. Client attempts to override server metadata fields
  const spoofRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Spoof attempt text',
    id: 'SPOOFED-CLIENT-ID',
    status: 'approved',
    sessionId: 'FAKE-SESSION-ID',
    createdAt: '1970-01-01T00:00:00.000Z'
  });
  assert.strictEqual(spoofRes.statusCode, 201);
  const spoofBody = JSON.parse(spoofRes.body);
  assert.notStrictEqual(spoofBody.question.id, 'SPOOFED-CLIENT-ID');
  assert.strictEqual(spoofBody.question.sessionId, session.id);
  assert.strictEqual(spoofBody.question.status, QUESTION_STATUS.PENDING);
  assert.notStrictEqual(spoofBody.question.createdAt, '1970-01-01T00:00:00.000Z');
  console.log('   ✓ Client spoof attempt overridden: server metadata authoritative.');

  // ====================================================
  // Task 5.5: Server-Generated Unique Question ID Tests
  // ====================================================
  console.log('\n[Task 5.5] Testing Server-Generated Unique Question IDs...');
  const sub1 = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Unique ID Question 1' });
  const sub2 = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Unique ID Question 2' });

  const q1 = JSON.parse(sub1.body).question;
  const q2 = JSON.parse(sub2.body).question;

  assert.ok(q1.id && typeof q1.id === 'string');
  assert.ok(q2.id && typeof q2.id === 'string');
  assert.notStrictEqual(q1.id, q2.id);
  console.log(`   ✓ Unique server-generated IDs verified [q1: ${q1.id.slice(0, 8)}..., q2: ${q2.id.slice(0, 8)}...].`);

  // ====================================================
  // Task 5.6: Pending Moderation Queue Tests
  // ====================================================
  console.log('\n[Task 5.6] Testing Pending Moderation Queue Storage...');
  const pendingQueue = sessionService.getPendingQuestions(session.roomCode);
  assert.ok(Array.isArray(pendingQueue));
  assert.strictEqual(pendingQueue.length, 5); // 5 accepted valid questions above

  for (const item of pendingQueue) {
    assert.strictEqual(item.status, QUESTION_STATUS.PENDING);
    assert.strictEqual(item.sessionId, session.id);
    assert.ok(item.id);
    assert.ok(item.text);
  }
  console.log(`   ✓ All ${pendingQueue.length} accepted questions entered the pending queue with status 'pending'.`);

  // Verify rejected submissions do not enter the queue
  sessionService.updateSessionStatus(session.roomCode, SESSION_STATUS.PAUSED, session.presenterSecret);
  const pausedRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Paused queue test' });
  assert.strictEqual(pausedRes.statusCode, 400);

  const pendingQueueAfterPause = sessionService.getPendingQuestions(session.roomCode);
  assert.strictEqual(pendingQueueAfterPause.length, 5); // Length unchanged
  console.log('   ✓ Rejected submission during Paused state correctly excluded from queue.');

  // Regression check
  const healthRes = await httpRequest('GET', '/health');
  assert.strictEqual(healthRes.statusCode, 200);

  console.log('\nAll Tasks 5.4–5.6 unit and integration tests completed successfully!');

  server.close(() => {
    process.exit(0);
  });
}

setTimeout(runTasks5_4_to_5_6Tests, 500);
