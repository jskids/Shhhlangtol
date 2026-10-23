const { server } = require('../src/server.js');
const http = require('http');
const assert = require('assert');
const { createSession, createQuestion, SESSION_STATUS, QUESTION_STATUS } = require('../src/models/sessionModel');
const { generateUniqueRoomCode, normalizeRoomCode, isValidRoomCodeFormat } = require('../src/utils/roomCode');
const { sessionService } = require('../src/services/sessionService');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function runPhase4Tests() {
  console.log('--- Phase 4 Unit & Integration Tests ---');

  // 1. Model Unit Tests
  console.log('Testing Session and Question Data Models...');
  const testSession = createSession({ id: 's-123', roomCode: 'abc234' });
  assert.strictEqual(testSession.id, 's-123');
  assert.strictEqual(testSession.roomCode, 'ABC234');
  assert.strictEqual(testSession.status, SESSION_STATUS.ACTIVE);
  assert.deepStrictEqual(testSession.questions, []);

  const testQuestion = createQuestion({ id: 'q-1', sessionId: 's-123', text: 'What is Socket.IO?' });
  assert.strictEqual(testQuestion.id, 'q-1');
  assert.strictEqual(testQuestion.sessionId, 's-123');
  assert.strictEqual(testQuestion.text, 'What is Socket.IO?');
  assert.strictEqual(testQuestion.status, QUESTION_STATUS.PENDING);
  console.log('   Models verified.');

  // 2. Room Code Generator Tests
  console.log('Testing Room Code Utilities...');
  assert.strictEqual(normalizeRoomCode('  aBc234  '), 'ABC234');
  assert.strictEqual(isValidRoomCodeFormat('ABC234'), true);
  assert.strictEqual(isValidRoomCodeFormat('000111'), false); // '0' and '1' disallowed
  assert.strictEqual(isValidRoomCodeFormat('short'), false);

  let collisionCount = 0;
  const mockExists = (code) => {
    if (collisionCount < 2) {
      collisionCount++;
      return true; // Simulate 2 collisions
    }
    return false;
  };
  const generatedCode = generateUniqueRoomCode(mockExists);
  assert.strictEqual(isValidRoomCodeFormat(generatedCode), true);
  assert.strictEqual(collisionCount, 2);
  console.log('   Room code utilities & collision retries verified.');

  // 3. Session Service Unit Tests
  console.log('Testing In-Memory Session Service...');
  sessionService.clearAllSessions();
  const created = sessionService.createNewSession();
  assert.ok(created.id);
  assert.strictEqual(isValidRoomCodeFormat(created.roomCode), true);
  assert.strictEqual(sessionService.isSessionActive(created.roomCode), true);

  const fetchedById = sessionService.getSessionById(created.id);
  assert.strictEqual(fetchedById.roomCode, created.roomCode);

  const fetchedByCode = sessionService.getSessionByRoomCode(created.roomCode.toLowerCase());
  assert.strictEqual(fetchedByCode.id, created.id);

  // Deep clone check
  fetchedByCode.status = 'mutated';
  assert.strictEqual(sessionService.getSessionByRoomCode(created.roomCode).status, SESSION_STATUS.ACTIVE);

  // Close session & idempotency
  sessionService.closeSession(created.id);
  assert.strictEqual(sessionService.isSessionActive(created.roomCode), false);
  const closedSession = sessionService.getSessionById(created.id);
  assert.strictEqual(closedSession.status, SESSION_STATUS.CLOSED);

  // Closing twice safely
  const doubleClosed = sessionService.closeSession(created.id);
  assert.strictEqual(doubleClosed.status, SESSION_STATUS.CLOSED);
  console.log('   Session Service verified.');

  // 4. HTTP API Route Integration Tests
  console.log('Testing HTTP Room Code Validation API (/api/sessions/validate/:roomCode)...');
  sessionService.clearAllSessions();
  const activeSession = sessionService.createNewSession();

  // Test valid active room code
  const resValid = await httpGet(`/api/sessions/validate/${activeSession.roomCode}`);
  assert.strictEqual(resValid.statusCode, 200);
  const jsonValid = JSON.parse(resValid.body);
  assert.strictEqual(jsonValid.valid, true);
  assert.strictEqual(jsonValid.roomCode, activeSession.roomCode);
  console.log(`   Valid code test passed for [${activeSession.roomCode}].`);

  // Test malformed code format
  const resMalformed = await httpGet('/api/sessions/validate/123');
  assert.strictEqual(resMalformed.statusCode, 400);
  const jsonMalformed = JSON.parse(resMalformed.body);
  assert.strictEqual(jsonMalformed.valid, false);
  console.log('   Malformed code test passed (HTTP 400).');

  // Test non-existent code
  const resNotFound = await httpGet('/api/sessions/validate/ZZZZZZ');
  assert.strictEqual(resNotFound.statusCode, 404);
  const jsonNotFound = JSON.parse(resNotFound.body);
  assert.strictEqual(jsonNotFound.valid, false);
  console.log('   Non-existent code test passed (HTTP 404).');

  // Test closed session code
  sessionService.closeSession(activeSession.id);
  const resClosed = await httpGet(`/api/sessions/validate/${activeSession.roomCode}`);
  assert.strictEqual(resClosed.statusCode, 400);
  const jsonClosed = JSON.parse(resClosed.body);
  assert.strictEqual(jsonClosed.valid, false);
  assert.strictEqual(jsonClosed.status, SESSION_STATUS.CLOSED);
  console.log('   Closed session code test passed (HTTP 400).');

  // 5. Existing Routes Regression Test
  console.log('Testing regression on existing core pages & health check...');
  const resHealth = await httpGet('/health');
  assert.strictEqual(resHealth.statusCode, 200);
  assert.strictEqual(JSON.parse(resHealth.body).status, 'ok');

  const resStudent = await httpGet('/student');
  assert.strictEqual(resStudent.statusCode, 200);

  console.log('All Phase 4 unit and integration tests completed successfully!');

  server.close(() => {
    process.exit(0);
  });
}

setTimeout(runPhase4Tests, 500);
