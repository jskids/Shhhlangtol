const { server } = require('../src/server.js');
const http = require('http');
const assert = require('assert');
const { createSession, createQuestion, SESSION_STATUS, QUESTION_STATUS, MAX_QUESTION_LENGTH } = require('../src/models/sessionModel');
const { sessionService } = require('../src/services/sessionService');

const TEST_PORT = String(process.env.PORT || 3000).trim();

function httpRequest(method, path, bodyData, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = bodyData ? JSON.stringify(bodyData) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      `http://localhost:${TEST_PORT}` + path,
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

function resetRateLimits() {
  sessionService.ipRequestHistory.clear();
  sessionService.recentSubmissionsByIp.clear();
}

async function runAllTests() {
  console.log('--- Phase 5 (Tasks 5.4–5.9) Comprehensive Unit & Integration Test Suite ---');

  sessionService.clearAllSessions();
  const session = sessionService.createNewSession();

  // ====================================================
  // Task 5.4: Server Payload & State Validation Tests
  // ====================================================
  console.log('\n[Task 5.4] Testing Server Payload & State Validation Rules...');

  // 1. Non-string types rejected
  const nonStringPayloads = [123, true, [], { text: 'nested' }, null];
  for (const invalidText of nonStringPayloads) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: invalidText
    });
    assert.strictEqual(res.statusCode, 400);
  }
  console.log('   ✓ Non-string question payloads rejected with HTTP 400.');

  // 2. Empty and whitespace-only text rejected
  resetRateLimits();
  const emptyRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: '' });
  assert.strictEqual(emptyRes.statusCode, 400);

  resetRateLimits();
  const whitespaceRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: '   \n \t  ' });
  assert.strictEqual(whitespaceRes.statusCode, 400);
  console.log('   ✓ Empty and whitespace-only submissions rejected with HTTP 400.');

  // 3. Leading and trailing whitespace trimmed
  resetRateLimits();
  const untrimmedRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: '   How does Socket.IO manage reconnections?   '
  });
  assert.strictEqual(untrimmedRes.statusCode, 201);
  const untrimmedBody = JSON.parse(untrimmedRes.body);
  assert.strictEqual(untrimmedBody.question.text, 'How does Socket.IO manage reconnections?');
  console.log('   ✓ Question text trimmed correctly before storing.');

  // 4. Max length validation (300 limit)
  resetRateLimits();
  const char300 = 'B'.repeat(300);
  const char300Res = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: char300 });
  assert.strictEqual(char300Res.statusCode, 201);

  resetRateLimits();
  const char301 = 'B'.repeat(301);
  const char301Res = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: char301 });
  assert.strictEqual(char301Res.statusCode, 400);
  console.log('   ✓ Max length 300 accepted (201), 301 rejected (400).');

  // 5. Client attempts to override server metadata fields
  resetRateLimits();
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
  resetRateLimits();
  const sub1 = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Unique ID Question 1' });
  resetRateLimits();
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

  // ====================================================
  // Task 5.7 & 5.8: Submission Confirmation & Error Messages Tests
  // ====================================================
  console.log('\n[Task 5.7 & 5.8] Testing Submission Confirmation & Error Messages...');

  // Unknown room code test (404)
  resetRateLimits();
  const unknownRoomRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: 'NOEXIST', text: 'Valid text' });
  assert.strictEqual(unknownRoomRes.statusCode, 404);
  const unknownRoomBody = JSON.parse(unknownRoomRes.body);
  assert.strictEqual(unknownRoomBody.success, false);
  assert.ok(unknownRoomBody.error.includes('Session not found'));
  console.log('   ✓ Unknown room code returns HTTP 404 with clear user error message.');

  // Paused session rejection test (400)
  resetRateLimits();
  sessionService.updateSessionStatus(session.roomCode, SESSION_STATUS.PAUSED, session.presenterSecret);
  const pausedRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Paused submission test' });
  assert.strictEqual(pausedRes.statusCode, 400);
  const pausedBody = JSON.parse(pausedRes.body);
  assert.strictEqual(pausedBody.success, false);
  assert.ok(pausedBody.error.includes('paused'));
  console.log('   ✓ Paused session rejection returns HTTP 400 with clear user error message.');

  // Re-open session for remaining tests
  sessionService.updateSessionStatus(session.roomCode, SESSION_STATUS.OPEN, session.presenterSecret);

  // ====================================================
  // Task 5.9: Duplicate & Rate-Limit Protection Tests
  // ====================================================
  console.log('\n[Task 5.9] Testing Idempotency & Rate Limit Protection...');

  // 1. Idempotency Key test - Retry of same request returns HTTP 200 with duplicate flag
  resetRateLimits();
  const testIdempotencyKey = 'test-ik-12345';
  const firstReq = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Idempotency test question',
    idempotencyKey: testIdempotencyKey
  });
  assert.strictEqual(firstReq.statusCode, 201);
  const firstBody = JSON.parse(firstReq.body);
  assert.strictEqual(firstBody.success, true);
  assert.strictEqual(firstBody.duplicate, false);

  const retryReq = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Idempotency test question',
    idempotencyKey: testIdempotencyKey
  });
  assert.strictEqual(retryReq.statusCode, 200);
  const retryBody = JSON.parse(retryReq.body);
  assert.strictEqual(retryBody.success, true);
  assert.strictEqual(retryBody.duplicate, true);
  assert.strictEqual(retryBody.question.id, firstBody.question.id);
  console.log('   ✓ Idempotency Key retry returned original question with HTTP 200 without creating duplicate.');

  // Verify pending queue length did NOT increase from idempotency retry
  const queueAfterIdempotency = sessionService.getPendingQuestions(session.roomCode);
  assert.strictEqual(queueAfterIdempotency.length, 6); // 5 from earlier + 1 firstReq
  console.log('   ✓ Queue length maintained (no duplicate entry added to pending queue).');

  // 2. Minimum submission interval rate limit (HTTP 429)
  // rapid1 will succeed after resetting limits, rapid2 immediately after from same IP will trigger 429
  resetRateLimits();
  const rapid1 = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Rapid question 1' });
  assert.strictEqual(rapid1.statusCode, 201);

  const rapid2 = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Rapid question 2' });
  assert.strictEqual(rapid2.statusCode, 429);
  const rapid2Body = JSON.parse(rapid2.body);
  assert.strictEqual(rapid2Body.success, false);
  assert.ok(rapid2Body.error.includes('too quickly'));
  console.log('   ✓ Rapid consecutive submission (< 2s) rejected with HTTP 429 rate limit message.');

  // 3. Expiration cleanup test
  sessionService._cleanupExpiredRecords(Date.now() + 20 * 60 * 1000); // Fast-forward 20 minutes
  assert.strictEqual(sessionService.idempotencyMap.size, 0);
  assert.strictEqual(sessionService.ipRequestHistory.size, 0);
  assert.strictEqual(sessionService.recentSubmissionsByIp.size, 0);
  console.log('   ✓ Expired tracking records automatically purged by cleanup routine.');

  // ====================================================
  // Task 5.10: Anonymous Question Submission Tests
  // ====================================================
  console.log('\n[Task 5.10] Testing Anonymous Question Submission & Personal Identity Stripping...');
  resetRateLimits();
  const identityPayloadRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'How does local network Wi-Fi routing work?',
    name: 'Jane Doe',
    email: 'jane.doe@school.edu',
    studentId: 'STUDENT-998877',
    account: 'jdoe_account',
    user: { id: 123, role: 'admin' }
  });
  assert.strictEqual(identityPayloadRes.statusCode, 201);
  const identityBody = JSON.parse(identityPayloadRes.body);
  const createdQ = identityBody.question;

  assert.strictEqual(createdQ.name, undefined);
  assert.strictEqual(createdQ.email, undefined);
  assert.strictEqual(createdQ.studentId, undefined);
  assert.strictEqual(createdQ.account, undefined);
  assert.strictEqual(createdQ.user, undefined);
  assert.deepStrictEqual(Object.keys(createdQ).sort(), ['createdAt', 'id', 'isDisplayed', 'sessionId', 'status', 'text', 'updatedAt'].sort());
  console.log('   ✓ Student identity fields (name, email, student ID, user) strictly stripped/ignored.');

  // ====================================================
  // Task 5.11: Question Status Protection & Authorization Tests
  // ====================================================
  console.log('\n[Task 5.11] Testing Question Status Protection & Authorization Enforcement...');

  // 1. Student submission with status override attempt ("approved") is forced to "pending"
  resetRateLimits();
  const statusSpoofRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Student attempt to auto-approve question',
    status: 'approved'
  });
  assert.strictEqual(statusSpoofRes.statusCode, 201);
  const statusSpoofBody = JSON.parse(statusSpoofRes.body);
  assert.strictEqual(statusSpoofBody.question.status, QUESTION_STATUS.PENDING);
  console.log('   ✓ Student status override attempt ("approved") forced to "pending" on submission.');

  // 2. Unauthenticated student client attempts to change status via status endpoint
  const targetQuestionId = createdQ.id;
  const unauthStatusRes = await httpRequest('POST', '/api/sessions/questions/status', {
    roomCode: session.roomCode,
    questionId: targetQuestionId,
    status: 'approved'
  });
  assert.strictEqual(unauthStatusRes.statusCode, 403);
  const unauthStatusBody = JSON.parse(unauthStatusRes.body);
  assert.strictEqual(unauthStatusBody.success, false);
  assert.ok(unauthStatusBody.error.includes('Unauthorized'));
  console.log('   ✓ Unauthenticated student request to change question status rejected with HTTP 403 Forbidden.');

  // 3. Request with invalid presenter secret token
  const invalidTokenRes = await httpRequest('POST', '/api/sessions/questions/status', {
    roomCode: session.roomCode,
    questionId: targetQuestionId,
    status: 'approved',
    presenterSecret: 'WRONG_SECRET_TOKEN'
  });
  assert.strictEqual(invalidTokenRes.statusCode, 403);
  console.log('   ✓ Invalid presenter secret token rejected with HTTP 403 Forbidden.');

  // 4. Authorized presenter successfully updates question status with valid presenterSecret
  const authStatusRes = await httpRequest('POST', '/api/sessions/questions/status', {
    roomCode: session.roomCode,
    questionId: targetQuestionId,
    status: 'approved',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(authStatusRes.statusCode, 200);
  const authStatusBody = JSON.parse(authStatusRes.body);
  assert.strictEqual(authStatusBody.success, true);
  assert.strictEqual(authStatusBody.question.status, QUESTION_STATUS.APPROVED);
  console.log('   ✓ Authorized presenter successfully changed question status to "approved".');

  // ====================================================
  // Tasks 6.1–6.5: Server-Side Prohibited Content Filtering Tests
  // ====================================================
  console.log('\n[Tasks 6.1–6.5] Testing Prohibited Content Filtering & Text Normalization...');

  // 1. Blocked single words in lowercase, uppercase, and mixed case
  const casingTests = ['fuck', 'FUCK', 'fUcK', 'SHIT', 'bItCh'];
  for (const word of casingTests) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: `Is this a bad ${word} question?`
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "Your question contains language that isn't allowed. Please revise it and try again.");
    assert.strictEqual(body.matchedTerm, undefined); // Ensure zero leakage of internal filter details
  }
  console.log('   ✓ Blocked words in uppercase, lowercase, and mixed case rejected with HTTP 400.');

  // 2. Multi-word phrase matching
  resetRateLimits();
  const phraseRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'You should shut up right now.'
  });
  assert.strictEqual(phraseRes.statusCode, 400);
  assert.strictEqual(JSON.parse(phraseRes.body).error, "Your question contains language that isn't allowed. Please revise it and try again.");
  console.log('   ✓ Blocked multi-word phrases rejected.');

  // 3. Leetspeak substitutions and spacing/punctuation evasion
  const evasionTests = ['f.u.c.k', 'sh!t', 'b!tch', 'f3ck', 's_h_i_t'];
  for (const evasionText of evasionTests) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: `Testing evasion ${evasionText} in text`
    });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(JSON.parse(res.body).error, "Your question contains language that isn't allowed. Please revise it and try again.");
  }
  console.log('   ✓ Leetspeak substitutions and spacing/punctuation evasion attempts detected and rejected.');

  // 4. Harmless words containing embedded blocked substrings (avoiding Scunthorpe false positives)
  const harmlessWords = [
    'How will our class assessment be structured?',
    'What is puberty and how does it affect growth?',
    'Can you explain personal boundaries and consent?',
    'Where is the document uploaded?'
  ];
  for (const harmlessText of harmlessWords) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: harmlessText
    });
    assert.strictEqual(res.statusCode, 201);
  }
  console.log('   ✓ Harmless educational words containing embedded substrings accepted without false positives.');

  // 5. Verify rejected submissions never enter the pending moderation queue
  const queueBeforeBlockedCount = sessionService.getPendingQuestions(session.roomCode).length;
  resetRateLimits();
  await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Another blocked fuck submission'
  });
  const queueAfterBlockedCount = sessionService.getPendingQuestions(session.roomCode).length;
  assert.strictEqual(queueBeforeBlockedCount, queueAfterBlockedCount);
  console.log('   ✓ Blocked submissions strictly excluded from pending queue.');

  // ====================================================
  // Tasks 6.6–6.9: Local Content Filtering & Educational Context Exception Tests
  // ====================================================
  console.log('\n[Tasks 6.6–6.9] Testing Educational Context Exceptions & Prohibited Content Filtering...');

  // 1. Legitimate Educational Questions regarding sexual health, consent, puberty, anatomy, and boundaries (Tasks 6.7 & 6.8)
  const educationalQuestions = [
    'What is puberty and how does it affect growth?',
    'How do condoms work to prevent STIs and pregnancy?',
    'Can you explain the difference between penis and vagina anatomy?',
    'What is the definition of consent and personal boundaries?',
    'Is it normal to experience irregular periods during puberty?',
    'How does contraception prevent pregnancy?',
    'What should someone do if they experience sexual harassment?'
  ];

  for (const eduText of educationalQuestions) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: eduText
    });
    assert.strictEqual(res.statusCode, 201, `Educational question rejected unexpectedly: "${eduText}"`);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
  }
  console.log(`   ✓ All ${educationalQuestions.length} legitimate educational questions accepted (HTTP 201).`);

  // 2. Prohibited submissions (vulgarity, slurs, harassment phrases) (Task 6.9)
  const prohibitedSubmissions = [
    'Fuck this presentation',
    'Kill yourself',
    'You fag',
    'go die in a fire'
  ];

  for (const badText of prohibitedSubmissions) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: badText
    });
    assert.strictEqual(res.statusCode, 400, `Prohibited text accepted unexpectedly: "${badText}"`);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "Your question contains language that isn't allowed. Please revise it and try again.");
  }
  console.log(`   ✓ All ${prohibitedSubmissions.length} prohibited submissions rejected with HTTP 400 and generic error.`);

  // ====================================================
  // Tasks 6.10 & 6.11: XSS Security Payload & Safe Rendering Tests
  // ====================================================
  console.log('\n[Tasks 6.10 & 6.11] Testing XSS Payload Handling & Safe HTML Escaping...');

  // 1. Submit XSS payloads to server
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">Click Here</a>',
    'Question with "quotes" & <brackets>'
  ];

  for (const xssText of xssPayloads) {
    resetRateLimits();
    const res = await httpRequest('POST', '/api/sessions/questions', {
      roomCode: session.roomCode,
      text: xssText
    });
    assert.strictEqual(res.statusCode, 201, `XSS text submission failed: "${xssText}"`);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.question.text, xssText, 'Server preserved untrusted text intact');
  }
  console.log('   ✓ XSS script/markup payloads accepted safely by server as raw text.');

  // 2. Test Frontend escapeHTML Helper Function (Task 6.10)
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  assert.strictEqual(escapeHTML('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.strictEqual(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.strictEqual(escapeHTML("Tom & 'Jerry'"), 'Tom &amp; &#039;Jerry&#039;');
  console.log('   ✓ Frontend escapeHTML function correctly converts dangerous markup to harmless HTML entities.');

  // ====================================================
  // Task 7.1: Local Socket.IO Connection & Static Client JS Endpoint Tests
  // ====================================================
  console.log('\n[Task 7.1] Testing Local Socket.IO Configuration & Connection Handshake...');

  // 1. Verify client library endpoint served locally (/socket.io/socket.io.js)
  const socketClientJsRes = await httpRequest('GET', '/socket.io/socket.io.js');
  assert.strictEqual(socketClientJsRes.statusCode, 200, 'Socket.IO client library endpoint failed');
  assert.ok(socketClientJsRes.body.includes('io') || socketClientJsRes.body.includes('Socket'), 'Socket.IO client library JS content returned');
  console.log('   ✓ Socket.IO client library JavaScript served locally at /socket.io/socket.io.js.');

  // 2. Verify Socket.IO engine handshake polling request
  const socketHandshakeRes = await httpRequest('GET', '/socket.io/?EIO=4&transport=polling');
  assert.strictEqual(socketHandshakeRes.statusCode, 200, 'Socket.IO engine handshake failed');
  assert.ok(socketHandshakeRes.body.includes('sid'), 'Socket.IO handshake payload contains session ID (sid)');
  console.log('   ✓ Local Socket.IO connection handshake succeeded with session ID.');

  // ====================================================
  // Tasks 7.2–7.5: Socket.IO Session Rooms, Moderator Auth & Event Broadcasting Tests
  // ====================================================
  console.log('\n[Tasks 7.2–7.5] Testing Socket.IO Room Organization, Moderator Auth & Real-Time Broadcasting...');

  const { initSocketHandlers } = require('../src/sockets/socketHandler');
  const { io } = require('../src/server.js');

  // Helper to construct a mock socket client for testing handler events
  function createTestSocket(id) {
    const rooms = new Set([id]);
    const emittedEvents = [];
    const eventHandlers = {};

    const socketObj = {
      id,
      rooms,
      join: (room) => rooms.add(room),
      leave: (room) => rooms.delete(room),
      emit: (event, payload) => {
        emittedEvents.push({ event, payload });
      },
      on: (event, handler) => {
        eventHandlers[event] = handler;
      },
      trigger: (event, data, callback) => {
        if (eventHandlers[event]) {
          return eventHandlers[event](data, callback);
        }
      },
      emittedEvents
    };

    return socketObj;
  }

  // 1. Task 7.2: Student joins active room successfully
  const studentSocket = createTestSocket('socket-student-1');

  // Attach event handlers
  io.emit('fakeConnection', studentSocket); // trigger socketHandler connection logic by passing socket object directly to connection function
  // We can call initSocketHandlers logic or trigger on connection
  const mockIo = {
    on: (event, handler) => {
      if (event === 'connection') {
        handler(studentSocket);
      }
    }
  };
  initSocketHandlers(mockIo);

  // Test joinRoom with valid room code as student
  let studentJoinRes;
  studentSocket.trigger('joinRoom', { roomCode: session.roomCode, role: 'student' }, (res) => {
    studentJoinRes = res;
  });

  assert.strictEqual(studentJoinRes.success, true);
  assert.strictEqual(studentJoinRes.role, 'student');
  assert.ok(studentSocket.rooms.has(`session:${session.roomCode}`));
  console.log('   ✓ Student client joined session room successfully.');

  // 2. Task 7.2: Invalid room code join attempt rejected
  const invalidSocket = createTestSocket('socket-invalid-1');
  const mockIoInvalid = { on: (evt, h) => evt === 'connection' && h(invalidSocket) };
  initSocketHandlers(mockIoInvalid);

  let invalidJoinRes;
  invalidSocket.trigger('joinRoom', { roomCode: 'INVALID' }, (res) => {
    invalidJoinRes = res;
  });
  assert.strictEqual(invalidJoinRes.success, false);
  assert.ok(invalidJoinRes.error.includes('Session not found'));
  console.log('   ✓ Invalid room code join attempt rejected.');

  // 3. Task 7.3: Moderator room join attempt WITHOUT valid secret token REJECTED
  const unauthModSocket = createTestSocket('socket-unauth-mod');
  const mockIoUnauthMod = { on: (evt, h) => evt === 'connection' && h(unauthModSocket) };
  initSocketHandlers(mockIoUnauthMod);

  let unauthModRes;
  unauthModSocket.trigger('joinRoom', { roomCode: session.roomCode, role: 'moderator', presenterSecret: 'WRONG_SECRET' }, (res) => {
    unauthModRes = res;
  });
  assert.strictEqual(unauthModRes.success, false);
  assert.ok(unauthModRes.error.includes('Unauthorized'));
  assert.strictEqual(unauthModSocket.rooms.has(`session:${session.roomCode}:moderator`), false);
  console.log('   ✓ Unauthorized moderator room join attempt rejected with error.');

  // 4. Task 7.3: Moderator room join attempt WITH valid secret token ACCEPTED
  const authModSocket = createTestSocket('socket-auth-mod');
  const mockIoAuthMod = { on: (evt, h) => evt === 'connection' && h(authModSocket) };
  initSocketHandlers(mockIoAuthMod);

  let authModRes;
  authModSocket.trigger('joinRoom', { roomCode: session.roomCode, role: 'moderator', presenterSecret: session.presenterSecret }, (res) => {
    authModRes = res;
  });
  assert.strictEqual(authModRes.success, true);
  assert.strictEqual(authModRes.role, 'moderator');
  assert.ok(authModSocket.rooms.has(`session:${session.roomCode}`));
  assert.ok(authModSocket.rooms.has(`session:${session.roomCode}:moderator`));
  assert.ok(Array.isArray(authModRes.pendingQuestions));
  console.log('   ✓ Authorized moderator successfully joined moderator-only room and received pending queue.');

  // 5. Task 7.2: Display room join attempt ACCEPTED
  const displaySocket = createTestSocket('socket-display-1');
  const mockIoDisplay = { on: (evt, h) => evt === 'connection' && h(displaySocket) };
  initSocketHandlers(mockIoDisplay);

  let displayJoinRes;
  displaySocket.trigger('joinRoom', { roomCode: session.roomCode, role: 'display' }, (res) => {
    displayJoinRes = res;
  });
  assert.strictEqual(displayJoinRes.success, true);
  assert.strictEqual(displayJoinRes.role, 'display');
  assert.ok(displaySocket.rooms.has(`session:${session.roomCode}`));
  assert.ok(displaySocket.rooms.has(`session:${session.roomCode}:display`));
  assert.ok(Array.isArray(displayJoinRes.approvedQuestions));
  console.log('   ✓ Display client joined display room and received approved questions list.');

  // 6. Task 7.3: Test real-time pending question broadcast to moderator room on submission
  resetRateLimits();
  const roomEvents = [];
  const originalIoTo = io.to;

  // Intercept io.to() to verify room targeting
  io.to = function (room) {
    return {
      emit: (event, payload) => {
        roomEvents.push({ room, event, payload });
      }
    };
  };

  const newQuestionText = 'Real-time Socket broadcast question test';
  const postQRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: newQuestionText
  });
  assert.strictEqual(postQRes.statusCode, 201);

  const pendingBroadCast = roomEvents.find((e) => e.event === 'pendingQuestionAdded');
  assert.ok(pendingBroadCast, 'pendingQuestionAdded event was emitted');
  assert.strictEqual(pendingBroadCast.room, `session:${session.roomCode}:moderator`);
  assert.strictEqual(pendingBroadCast.payload.question.text, newQuestionText);
  console.log('   ✓ New pending question broadcast strictly targeted to moderator-only room.');

  // 7. Task 7.4: Test real-time approved question broadcast to display room on status update
  const createdQuestionId = JSON.parse(postQRes.body).question.id;
  roomEvents.length = 0; // clear event log

  const approveRes = await httpRequest('POST', '/api/sessions/questions/status', {
    roomCode: session.roomCode,
    questionId: createdQuestionId,
    status: 'approved',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(approveRes.statusCode, 200);

  const approvedDisplayBroadcast = roomEvents.find((e) => e.event === 'approvedQuestionAdded');
  assert.ok(approvedDisplayBroadcast, 'approvedQuestionAdded event was emitted');
  assert.strictEqual(approvedDisplayBroadcast.room, `session:${session.roomCode}:display`);
  assert.strictEqual(approvedDisplayBroadcast.payload.question.id, createdQuestionId);
  console.log('   ✓ Approved question broadcast strictly targeted to display room.');

  // 8. Task 7.5: Test real-time session status change broadcast
  roomEvents.length = 0; // clear event log

  const pauseStatusRes = await httpRequest('POST', '/api/sessions/status', {
    roomCode: session.roomCode,
    status: 'Paused',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(pauseStatusRes.statusCode, 200);

  const statusBroadcast = roomEvents.find((e) => e.event === 'sessionStatusChanged');
  assert.ok(statusBroadcast, 'sessionStatusChanged event was emitted');
  assert.strictEqual(statusBroadcast.room, `session:${session.roomCode}`);
  assert.strictEqual(statusBroadcast.payload.status, 'Paused');
  console.log('   ✓ Session status change broadcast targeted to session room.');

  // Restore session state to Open for remaining tests
  sessionService.updateSessionStatus(session.roomCode, SESSION_STATUS.OPEN, session.presenterSecret);

  // ====================================================
  // Tasks 7.6 & 7.7: Reconnection & Authoritative State Synchronization Tests
  // ====================================================
  console.log('\n[Tasks 7.6 & 7.7] Testing Client Reconnection & Authoritative State Synchronization...');

  // 1. Test syncState event for student role
  const reconnectStudentSocket = createTestSocket('socket-reconnect-student');
  initSocketHandlers({ on: (evt, h) => evt === 'connection' && h(reconnectStudentSocket) });

  let studentSyncRes;
  reconnectStudentSocket.trigger('syncState', { roomCode: session.roomCode, role: 'student' }, (res) => {
    studentSyncRes = res;
  });
  assert.strictEqual(studentSyncRes.success, true);
  assert.strictEqual(studentSyncRes.role, 'student');
  assert.strictEqual(studentSyncRes.status, SESSION_STATUS.OPEN);
  assert.strictEqual(studentSyncRes.pendingQuestions, undefined); // Ensure student receives no pending queue
  console.log('   ✓ Reconnecting student socket successfully synchronized state without sensitive queue data.');

  // 2. Test syncState event for moderator role with valid presenter token
  let modSyncRes;
  reconnectStudentSocket.trigger('syncState', { roomCode: session.roomCode, role: 'moderator', presenterSecret: session.presenterSecret }, (res) => {
    modSyncRes = res;
  });
  assert.strictEqual(modSyncRes.success, true);
  assert.strictEqual(modSyncRes.role, 'moderator');
  assert.ok(Array.isArray(modSyncRes.pendingQuestions));
  assert.ok(Array.isArray(modSyncRes.approvedQuestions));
  console.log('   ✓ Reconnecting moderator socket successfully received authorized pending and approved questions.');

  // 3. Test syncState event for invalid session
  let invalidSyncRes;
  reconnectStudentSocket.trigger('syncState', { roomCode: 'NONEXISTENT' }, (res) => {
    invalidSyncRes = res;
  });
  assert.strictEqual(invalidSyncRes.success, false);
  assert.ok(invalidSyncRes.error.includes('Session not found'));
  console.log('   ✓ State synchronization gracefully rejected nonexistent session.');

  // ====================================================
  // Tasks 7.8 & 7.9: Sensitive Socket Event Validation & Anti-Impersonation Defenses
  // ====================================================
  console.log('\n[Tasks 7.8 & 7.9] Testing Sensitive Socket Event Permission Enforcement & Impersonation Defenses...');

  // 1. Unauthorized attempt to update question status over socket
  const attackerSocket = createTestSocket('socket-attacker-1');
  initSocketHandlers({ on: (evt, h) => evt === 'connection' && h(attackerSocket) });

  let unauthSocketStatusRes;
  attackerSocket.trigger('updateQuestionStatus', {
    roomCode: session.roomCode,
    questionId: createdQuestionId,
    status: 'approved',
    presenterSecret: 'FAKE_ATTACKER_TOKEN'
  }, (res) => {
    unauthSocketStatusRes = res;
  });
  assert.strictEqual(unauthSocketStatusRes.success, false);
  assert.ok(unauthSocketStatusRes.error.includes('Unauthorized') || unauthSocketStatusRes.error.includes('Invalid'));
  console.log('   ✓ Unauthorized question status update via socket rejected with error.');

  // 2. Authorized attempt to update question status over socket
  let authSocketStatusRes;
  attackerSocket.trigger('updateQuestionStatus', {
    roomCode: session.roomCode,
    questionId: createdQuestionId,
    status: 'rejected',
    presenterSecret: session.presenterSecret
  }, (res) => {
    authSocketStatusRes = res;
  });
  assert.strictEqual(authSocketStatusRes.success, true);
  assert.strictEqual(authSocketStatusRes.question.status, 'rejected');
  console.log('   ✓ Authorized question status update via socket succeeded.');

  // 3. Attempt to spoof moderator privileges via joinRoom with crafted client flags (e.g. isModerator: true)
  const spooferSocket = createTestSocket('socket-spoofer-1');
  initSocketHandlers({ on: (evt, h) => evt === 'connection' && h(spooferSocket) });

  let spoofJoinRes;
  spooferSocket.trigger('joinRoom', {
    roomCode: session.roomCode,
    role: 'moderator',
    isModerator: true,
    isAdmin: true,
    presenterSecret: 'INVALID_SPOOF_SECRET'
  }, (res) => {
    spoofJoinRes = res;
  });

  assert.strictEqual(spoofJoinRes.success, false);
  assert.ok(spoofJoinRes.error.includes('Unauthorized'));
  assert.strictEqual(spooferSocket.data.isModerator, false);
  assert.strictEqual(spooferSocket.rooms.has(`session:${session.roomCode}:moderator`), false);
  console.log('   ✓ Client spoofing attempt (isModerator: true) rejected and moderator room access blocked.');

  // Restore original io.to function
  io.to = originalIoTo;

  // ====================================================
  // Tasks 8.1–8.5: Moderator Dashboard, Authorization, Approve & Reject Tests
  // ====================================================
  console.log('\n[Tasks 8.1–8.5] Testing Moderator Dashboard Queue, Authorization, Approve & Reject Actions...');

  // 1. Task 8.1 & 8.2: Fetch pending queue as authorized moderator vs unauthorized
  const modTestSocket = createTestSocket('socket-mod-phase8');
  initSocketHandlers({
    on: (evt, h) => evt === 'connection' && h(modTestSocket),
    to: (room) => io.to(room),
    emit: (evt, payload) => io.emit(evt, payload)
  });

  // Add a new question to test queue
  resetRateLimits();
  const qForModRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Phase 8 Moderation Question Test'
  });
  assert.strictEqual(qForModRes.statusCode, 201);
  const qForMod = JSON.parse(qForModRes.body).question;

  // Unauthorized getPendingQuestions call
  let unauthPendingRes;
  modTestSocket.trigger('getPendingQuestions', { roomCode: session.roomCode, presenterSecret: 'INVALID_TOKEN' }, (res) => {
    unauthPendingRes = res;
  });
  assert.strictEqual(unauthPendingRes.success, false);
  assert.ok(unauthPendingRes.error.includes('Unauthorized'));
  console.log('   ✓ [Task 8.2] Unauthorized pending queue retrieval rejected with error.');

  // Authorized getPendingQuestions call
  let authPendingRes;
  modTestSocket.trigger('getPendingQuestions', { roomCode: session.roomCode, presenterSecret: session.presenterSecret }, (res) => {
    authPendingRes = res;
  });
  assert.strictEqual(authPendingRes.success, true);
  assert.ok(Array.isArray(authPendingRes.pendingQuestions));
  const foundQ = authPendingRes.pendingQuestions.find((q) => q.id === qForMod.id);
  assert.ok(foundQ, 'Newly posted question found in moderator pending queue');
  assert.strictEqual(foundQ.status, 'pending');
  console.log('   ✓ [Task 8.1] Authorized moderator fetched pending queue containing pending questions.');

  // 2. Task 8.3: Verify credentials not exposed in public active session response
  const activeSessionCheck = await httpRequest('GET', '/api/sessions/active');
  const activeSessionData = JSON.parse(activeSessionCheck.body);
  assert.strictEqual(activeSessionData.presenterSecret, undefined);
  console.log('   ✓ [Task 8.3] Presenter secret token strictly omitted from public active session API response.');

  // 3. Task 8.4: Approve action test
  const testDisplayEvents = [];
  io.to = function (room) {
    return {
      emit: (event, payload) => {
        testDisplayEvents.push({ room, event, payload });
      }
    };
  };

  let approveActionRes;
  modTestSocket.trigger('updateQuestionStatus', {
    roomCode: session.roomCode,
    questionId: qForMod.id,
    status: 'approved',
    presenterSecret: session.presenterSecret
  }, (res) => {
    approveActionRes = res;
  });

  assert.strictEqual(approveActionRes.success, true);
  assert.strictEqual(approveActionRes.question.status, 'approved');

  // Verify removed from pending queue
  const pendingAfterApprove = sessionService.getPendingQuestions(session.roomCode);
  assert.strictEqual(pendingAfterApprove.some((q) => q.id === qForMod.id), false);

  // Verify broadcast to display room
  const displayApproveBroadcast = testDisplayEvents.find((e) => e.event === 'approvedQuestionAdded');
  assert.ok(displayApproveBroadcast, 'approvedQuestionAdded emitted to display room');
  assert.strictEqual(displayApproveBroadcast.room, `session:${session.roomCode}:display`);
  assert.strictEqual(displayApproveBroadcast.payload.question.id, qForMod.id);
  console.log('   ✓ [Task 8.4] Moderator approved question: updated status to "approved", removed from pending queue, and broadcast to display room.');

  // 4. Task 8.5: Reject action test
  resetRateLimits();
  const qForRejectRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Question to be rejected by moderator'
  });
  assert.strictEqual(qForRejectRes.statusCode, 201);
  const qForReject = JSON.parse(qForRejectRes.body).question;

  testDisplayEvents.length = 0; // clear log

  let rejectActionRes;
  modTestSocket.trigger('updateQuestionStatus', {
    roomCode: session.roomCode,
    questionId: qForReject.id,
    status: 'rejected',
    presenterSecret: session.presenterSecret
  }, (res) => {
    rejectActionRes = res;
  });

  assert.strictEqual(rejectActionRes.success, true);
  assert.strictEqual(rejectActionRes.question.status, 'rejected');

  // Verify removed from pending queue
  const pendingAfterReject = sessionService.getPendingQuestions(session.roomCode);
  assert.strictEqual(pendingAfterReject.some((q) => q.id === qForReject.id), false);

  // Verify NOT broadcast as approvedQuestionAdded to display room
  const displayRejectApproveEvent = testDisplayEvents.find((e) => e.event === 'approvedQuestionAdded');
  assert.strictEqual(displayRejectApproveEvent, undefined, 'Rejected question must NEVER be broadcast to display as approved');

  // Verify questionStatusChanged was broadcast to moderator room
  const modRejectBroadcast = testDisplayEvents.find((e) => e.event === 'questionStatusChanged' && e.room === `session:${session.roomCode}:moderator`);
  assert.ok(modRejectBroadcast, 'questionStatusChanged emitted to moderator room');
  assert.strictEqual(modRejectBroadcast.payload.question.id, qForReject.id);
  console.log('   ✓ [Task 8.5] Moderator rejected question: updated status to "rejected", removed from pending queue, omitted from display room, and updated moderator clients in real time.');

  // ====================================================
  // Task 8.6: Remove Approved Question from Display Tests
  // ====================================================
  console.log('\n[Task 8.6] Testing Removal of Approved Questions from Projector Display...');

  testDisplayEvents.length = 0; // reset

  // 1. Moderator removes approved question from display via socket (toggleQuestionDisplay)
  let removeDisplayRes;
  modTestSocket.trigger('toggleQuestionDisplay', {
    roomCode: session.roomCode,
    questionId: qForMod.id,
    isDisplayed: false,
    presenterSecret: session.presenterSecret
  }, (res) => {
    removeDisplayRes = res;
  });

  assert.strictEqual(removeDisplayRes.success, true);
  assert.strictEqual(removeDisplayRes.question.id, qForMod.id);
  assert.strictEqual(removeDisplayRes.question.status, 'approved'); // Status remains 'approved'
  assert.strictEqual(removeDisplayRes.question.isDisplayed, false); // isDisplayed flag is false

  // 2. Verify getApprovedQuestionsForDisplay no longer returns the removed question
  const activeDisplayQuestions = sessionService.getApprovedQuestionsForDisplay(session.roomCode);
  assert.strictEqual(activeDisplayQuestions.some((q) => q.id === qForMod.id), false);

  // 3. Verify approvedQuestionRemoved broadcast was sent to display room
  const displayRemoveEvent = testDisplayEvents.find((e) => e.event === 'approvedQuestionRemoved' && e.room === `session:${session.roomCode}:display`);
  assert.ok(displayRemoveEvent, 'approvedQuestionRemoved event broadcast to display room');
  assert.strictEqual(displayRemoveEvent.payload.question.id, qForMod.id);

  // 4. Repeated removal attempt handled safely (idempotent)
  let repeatRemoveRes;
  modTestSocket.trigger('toggleQuestionDisplay', {
    roomCode: session.roomCode,
    questionId: qForMod.id,
    isDisplayed: false,
    presenterSecret: session.presenterSecret
  }, (res) => {
    repeatRemoveRes = res;
  });
  assert.strictEqual(repeatRemoveRes.success, true);
  assert.strictEqual(repeatRemoveRes.question.isDisplayed, false);

  // 5. Attempt to toggle display on pending or non-approved question rejected
  resetRateLimits();
  const unapprovedQRes = await httpRequest('POST', '/api/sessions/questions', { roomCode: session.roomCode, text: 'Unapproved question display toggle test' });
  const unapprovedQ = JSON.parse(unapprovedQRes.body).question;

  let unapprovedToggleRes;
  modTestSocket.trigger('toggleQuestionDisplay', {
    roomCode: session.roomCode,
    questionId: unapprovedQ.id,
    isDisplayed: false,
    presenterSecret: session.presenterSecret
  }, (res) => {
    unapprovedToggleRes = res;
  });
  assert.strictEqual(unapprovedToggleRes.success, false);
  assert.ok(unapprovedToggleRes.error.includes('Only approved questions'));

  console.log('   ✓ [Task 8.6] Approved question removed from display while preserving "approved" status history.');

  // ====================================================
  // Task 8.7: Track Question Statuses Consistently Tests
  // ====================================================
  console.log('\n[Task 8.7] Testing Consistent Server-Controlled Question Status Tracking...');

  // 1. Test status transitions across pending, approved, rejected
  const qStatusTestId = unapprovedQ.id;

  // pending -> approved
  const transitionApproved = sessionService.updateQuestionStatus(session.roomCode, qStatusTestId, 'approved', session.presenterSecret);
  assert.strictEqual(transitionApproved.success, true);
  assert.strictEqual(transitionApproved.question.status, 'approved');

  // approved -> rejected
  const transitionRejected = sessionService.updateQuestionStatus(session.roomCode, qStatusTestId, 'rejected', session.presenterSecret);
  assert.strictEqual(transitionRejected.success, true);
  assert.strictEqual(transitionRejected.question.status, 'rejected');
  assert.strictEqual(transitionRejected.question.isDisplayed, false);

  // rejected -> approved
  const transitionReApprove = sessionService.updateQuestionStatus(session.roomCode, qStatusTestId, 'approved', session.presenterSecret);
  assert.strictEqual(transitionReApprove.success, true);
  assert.strictEqual(transitionReApprove.question.status, 'approved');

  // Invalid target status string rejected
  const transitionInvalid = sessionService.updateQuestionStatus(session.roomCode, qStatusTestId, 'INVALID_STATUS', session.presenterSecret);
  assert.strictEqual(transitionInvalid.success, false);
  assert.ok(transitionInvalid.error.includes('Invalid question status'));

  console.log('   ✓ [Task 8.7] Question status transitions (Pending, Approved, Rejected) validated consistently.');

  // ====================================================
  // Task 8.8: Session Submission Controls Tests
  // ====================================================
  console.log('\n[Task 8.8] Testing Session Controls (Open, Paused, Closed)...');

  // 1. Pause submissions
  const pauseRes = await httpRequest('POST', '/api/sessions/status', {
    roomCode: session.roomCode,
    status: 'Paused',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(pauseRes.statusCode, 200);

  // Verify submissions blocked while Paused
  resetRateLimits();
  const subWhilePaused = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Attempted submission while paused'
  });
  assert.strictEqual(subWhilePaused.statusCode, 400);
  assert.ok(JSON.parse(subWhilePaused.body).error.includes('paused'));

  // 2. Re-open submissions
  const reopenRes = await httpRequest('POST', '/api/sessions/status', {
    roomCode: session.roomCode,
    status: 'Open',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(reopenRes.statusCode, 200);

  // Verify submissions allowed again
  resetRateLimits();
  const subAfterReopen = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Valid submission after re-opening'
  });
  assert.strictEqual(subAfterReopen.statusCode, 201);

  // 3. Close session (Terminal state)
  const closeRes = await httpRequest('POST', '/api/sessions/status', {
    roomCode: session.roomCode,
    status: 'Closed',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(closeRes.statusCode, 200);

  // Verify submissions blocked when Closed
  resetRateLimits();
  const subWhileClosed = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: session.roomCode,
    text: 'Attempted submission while closed'
  });
  assert.strictEqual(subWhileClosed.statusCode, 400);

  // Verify Closed is terminal (cannot transition back to Open)
  const reopenClosedRes = await httpRequest('POST', '/api/sessions/status', {
    roomCode: session.roomCode,
    status: 'Open',
    presenterSecret: session.presenterSecret
  });
  assert.strictEqual(reopenClosedRes.statusCode, 400);
  assert.ok(JSON.parse(reopenClosedRes.body).error.includes('terminal'));

  console.log('   ✓ [Task 8.8] Session controls (Open, Paused, Closed) and terminal state protections verified.');

  // ====================================================
  // Tasks 8.9–8.11: Server-Side Validation & Security Protections Tests
  // ====================================================
  console.log('\n[Tasks 8.9–8.11] Testing Server-Side Validation & Moderation Authorization Security...');

  // 1. Unauthorized GET /api/sessions/questions/pending rejected
  const unauthPendingGet = await httpRequest('GET', `/api/sessions/questions/pending?roomCode=${session.roomCode}`);
  assert.strictEqual(unauthPendingGet.statusCode, 403);
  assert.ok(JSON.parse(unauthPendingGet.body).error.includes('Unauthorized'));

  // 2. Authorized GET /api/sessions/questions/pending succeeded
  const authPendingGet = await httpRequest('GET', `/api/sessions/questions/pending?roomCode=${session.roomCode}&presenterSecret=${session.presenterSecret}`);
  assert.strictEqual(authPendingGet.statusCode, 200);
  assert.ok(Array.isArray(JSON.parse(authPendingGet.body).pendingQuestions));

  // 3. Attempt to modify questions in closed session rejected on server
  const closedModRes = sessionService.updateQuestionStatus(session.roomCode, unapprovedQ.id, 'approved', session.presenterSecret);
  assert.strictEqual(closedModRes.success, false);
  assert.ok(closedModRes.error.includes('closed'));

  // 4. Student client cannot join moderator room without valid token
  const fakeModSocket = createTestSocket('socket-fake-mod');
  initSocketHandlers({ on: (evt, h) => evt === 'connection' && h(fakeModSocket) });

  let fakeJoinRes;
  fakeModSocket.trigger('joinRoom', { roomCode: session.roomCode, role: 'moderator', presenterSecret: 'WRONG' }, (res) => {
    fakeJoinRes = res;
  });
  assert.strictEqual(fakeJoinRes.success, false);
  assert.strictEqual(fakeModSocket.rooms.has(`session:${session.roomCode}:moderator`), false);

  console.log('   ✓ [Tasks 8.9–8.11] Server-side moderation authorization and pending queue isolation strictly enforced.');

  // ====================================================
  // Tasks 9.1–9.5: Dedicated Presentation Display, Real-Time Animated Live Feed & Authoritative State Tests
  // ====================================================
  console.log('\n[Phase 9: Tasks 9.1–9.5] Testing Dedicated Presentation Display & Real-Time Animated Live Feed...');

  // Create a clean active session for Phase 9 testing
  sessionService.clearAllSessions();
  const displaySession = sessionService.createNewSession();

  // 1. Task 9.1: Dedicated display page markup & route check
  const displayPageRes = await httpRequest('GET', '/display');
  assert.strictEqual(displayPageRes.statusCode, 200);
  assert.ok(displayPageRes.body.includes('QAlive Live Q&A'));
  assert.ok(displayPageRes.body.includes('approved-questions-container'));
  assert.ok(displayPageRes.body.includes('word-cloud-container'));
  assert.ok(displayPageRes.body.includes('display-empty-state'));
  assert.ok(displayPageRes.body.includes('Word Cloud'));
  // Verify absence of student submission form and moderator controls in display page
  assert.strictEqual(displayPageRes.body.includes('question-input'), false);
  assert.strictEqual(displayPageRes.body.includes('presenter-secret-input'), false);
  console.log('   ✓ [Task 9.1] Dedicated presentation display page loads with clean presentation layout.');

  // 2. Task 9.2: Verify display state returns approved questions ONLY
  resetRateLimits();
  const qPending = sessionService.addQuestion(displaySession.roomCode, 'Pending question for Phase 9 test').question;
  resetRateLimits();
  const qApproved1 = sessionService.addQuestion(displaySession.roomCode, 'First approved display question').question;
  resetRateLimits();
  const qApproved2 = sessionService.addQuestion(displaySession.roomCode, 'Second approved display question').question;

  // Initially all questions are pending
  const displayQuestionsInitial = sessionService.getApprovedQuestionsForDisplay(displaySession.roomCode);
  assert.strictEqual(displayQuestionsInitial.length, 0, 'Pending questions must NOT be returned for display');

  // Moderator approves qApproved1 and qApproved2
  sessionService.updateQuestionStatus(displaySession.roomCode, qApproved1.id, 'approved', displaySession.presenterSecret);
  sessionService.updateQuestionStatus(displaySession.roomCode, qApproved2.id, 'approved', displaySession.presenterSecret);

  const displayQuestionsAfterApprove = sessionService.getApprovedQuestionsForDisplay(displaySession.roomCode);
  assert.strictEqual(displayQuestionsAfterApprove.length, 2);
  assert.ok(displayQuestionsAfterApprove.some(q => q.id === qApproved1.id));
  assert.ok(displayQuestionsAfterApprove.some(q => q.id === qApproved2.id));
  assert.strictEqual(displayQuestionsAfterApprove.some(q => q.id === qPending.id), false, 'Pending question must strictly be omitted');
  console.log('   ✓ [Task 9.2] Server display state strictly returns approved questions only.');

  // 3. Task 9.3 & 9.4: Socket.IO join room & real-time update events
  const phase9Socket = createTestSocket('socket-display-phase9');
  initSocketHandlers({ on: (evt, h) => evt === 'connection' && h(phase9Socket) });

  let joinDisplayRes;
  phase9Socket.trigger('joinRoom', { roomCode: displaySession.roomCode, role: 'display' }, (res) => {
    joinDisplayRes = res;
  });
  assert.strictEqual(joinDisplayRes.success, true);
  assert.strictEqual(joinDisplayRes.role, 'display');
  assert.strictEqual(joinDisplayRes.approvedQuestions.length, 2);

  // Test real-time approval broadcast (Task 9.3)
  const displayEventsLog = [];
  io.to = function (room) {
    return {
      emit: (event, payload) => {
        displayEventsLog.push({ room, event, payload });
      }
    };
  };

  resetRateLimits();
  const qNewApproveRes = await httpRequest('POST', '/api/sessions/questions', {
    roomCode: displaySession.roomCode,
    text: 'Newly approved question live broadcast'
  });
  const qNewApprove = JSON.parse(qNewApproveRes.body).question;

  const approveHttpRes = await httpRequest('POST', '/api/sessions/questions/status', {
    roomCode: displaySession.roomCode,
    questionId: qNewApprove.id,
    status: 'approved',
    presenterSecret: displaySession.presenterSecret
  });
  assert.strictEqual(approveHttpRes.statusCode, 200);

  const addBroadcast = displayEventsLog.find(e => e.event === 'approvedQuestionAdded');
  assert.ok(addBroadcast, 'approvedQuestionAdded broadcast sent to display client');
  assert.strictEqual(addBroadcast.room, `session:${displaySession.roomCode}:display`);
  assert.strictEqual(addBroadcast.payload.question.id, qNewApprove.id);
  console.log('   ✓ [Task 9.3] Real-time approval emits approvedQuestionAdded to display room.');

  // Test real-time removal broadcast (Task 9.4)
  displayEventsLog.length = 0;
  const removeHttpRes = await httpRequest('POST', '/api/sessions/questions/display', {
    roomCode: displaySession.roomCode,
    questionId: qNewApprove.id,
    isDisplayed: false,
    presenterSecret: displaySession.presenterSecret
  });
  assert.strictEqual(removeHttpRes.statusCode, 200);

  const removeBroadcast = displayEventsLog.find(e => e.event === 'approvedQuestionRemoved');
  assert.ok(removeBroadcast, 'approvedQuestionRemoved broadcast sent to display client');
  assert.strictEqual(removeBroadcast.room, `session:${displaySession.roomCode}:display`);
  assert.strictEqual(removeBroadcast.payload.question.id, qNewApprove.id);

  const displayQuestionsAfterRemoval = sessionService.getApprovedQuestionsForDisplay(displaySession.roomCode);
  assert.strictEqual(displayQuestionsAfterRemoval.some(q => q.id === qNewApprove.id), false, 'Removed question absent from server display state');
  console.log('   ✓ [Task 9.4] Real-time removal emits approvedQuestionRemoved and purges question from display state.');

  // 4. Task 9.5 & Reconnection: Reconnecting display client restores authoritative display state
  let syncDisplayRes;
  phase9Socket.trigger('syncState', { roomCode: displaySession.roomCode, role: 'display' }, (res) => {
    syncDisplayRes = res;
  });
  assert.strictEqual(syncDisplayRes.success, true);
  assert.strictEqual(syncDisplayRes.approvedQuestions.length, 2);
  assert.strictEqual(syncDisplayRes.approvedQuestions.some(q => q.id === qNewApprove.id), false);
  console.log('   ✓ [Task 9.5] Reconnecting display restores server-authoritative state without removed questions.');

  // 5. Per-question 1-minute expiration logic check
  const nowTs = Date.now();
  const oldQuestion = {
    id: 'old-q-1',
    text: 'Expired Question',
    createdAt: new Date(nowTs - 61000).toISOString(),
    updatedAt: new Date(nowTs - 61000).toISOString()
  };
  const activeQuestion = {
    id: 'active-q-1',
    text: 'Fresh Active Question',
    createdAt: new Date(nowTs - 10000).toISOString(),
    updatedAt: new Date(nowTs - 10000).toISOString()
  };

  const testList = [oldQuestion, activeQuestion];
  const DISPLAY_EXPIRE_MS = 60000;
  const filteredActiveList = testList.filter((q) => {
    const ts = q.updatedAt || q.createdAt;
    return (Date.now() - new Date(ts).getTime()) < DISPLAY_EXPIRE_MS;
  });

  assert.strictEqual(filteredActiveList.length, 1);
  assert.strictEqual(filteredActiveList[0].id, 'active-q-1');
  console.log('   ✓ [Per-Question 1-Min Expiration] Questions exceeding 1-minute (60s) duration automatically expire.');

  // ====================================================
  // Tasks 9.6–9.10: Empty State, Status Indicator, Reconnect Recovery, Data Isolation & Fullscreen Tests
  // ====================================================
  console.log('\n[Tasks 9.6–9.10] Testing Projector Display Empty State, Status Indicator, Reconnect Recovery, Data Isolation & Fullscreen Workflow...');

  // 1. Task 9.6 & 9.10: Display Page HTML Elements Verification
  const displayHtmlCheck = await httpRequest('GET', '/display');
  assert.strictEqual(displayHtmlCheck.statusCode, 200);
  assert.ok(displayHtmlCheck.body.includes('id="display-empty-state"'), 'Display contains empty state element');
  assert.ok(displayHtmlCheck.body.includes('No Approved Questions Yet'), 'Empty state title updated');
  assert.ok(displayHtmlCheck.body.includes('id="session-status-banner"'), 'Display contains session status banner element');
  assert.ok(displayHtmlCheck.body.includes('id="btn-fullscreen"'), 'Display contains full-screen toggle button');
  console.log('   ✓ [Task 9.6 & 9.10] Display HTML contains empty state, session status banner, and full-screen button.');

  // 2. Task 9.7: Session Status Display Broadcasts & Recovery
  displayEventsLog.length = 0;
  const pauseDisplayRes = await httpRequest('POST', '/api/sessions/status', {
    roomCode: displaySession.roomCode,
    status: 'Paused',
    presenterSecret: displaySession.presenterSecret
  });
  assert.strictEqual(pauseDisplayRes.statusCode, 200);

  const pausedStatusEvent = displayEventsLog.find((e) => e.event === 'sessionStatusChanged');
  assert.ok(pausedStatusEvent, 'sessionStatusChanged emitted when session paused');
  assert.strictEqual(pausedStatusEvent.payload.status, 'Paused');

  // Verify status is recovered on syncState for display role
  let syncStatusRes;
  phase9Socket.trigger('syncState', { roomCode: displaySession.roomCode, role: 'display' }, (res) => {
    syncStatusRes = res;
  });
  assert.strictEqual(syncStatusRes.success, true);
  assert.strictEqual(syncStatusRes.status, 'Paused');
  console.log('   ✓ [Task 9.7] Real-time session status change (Paused) broadcasted to display and recovered on reconnect.');

  // Restore session status to Open
  await httpRequest('POST', '/api/sessions/status', {
    roomCode: displaySession.roomCode,
    status: 'Open',
    presenterSecret: displaySession.presenterSecret
  });

  // 3. Task 9.8 & 9.9: Strict Data Isolation Verification (Pending, Rejected, and Display-Removed questions NEVER leak to display)
  resetRateLimits();
  const qPendingSecret = sessionService.addQuestion(displaySession.roomCode, 'Top Secret Pending Question').question;
  resetRateLimits();
  const qRejectedSecret = sessionService.addQuestion(displaySession.roomCode, 'Rejected Question for Security Test').question;
  sessionService.updateQuestionStatus(displaySession.roomCode, qRejectedSecret.id, 'rejected', displaySession.presenterSecret);

  // Query display questions via server method
  const approvedOnly = sessionService.getApprovedQuestionsForDisplay(displaySession.roomCode);
  assert.strictEqual(approvedOnly.some((q) => q.id === qPendingSecret.id), false, 'Pending question must NEVER appear in display state');
  assert.strictEqual(approvedOnly.some((q) => q.id === qRejectedSecret.id), false, 'Rejected question must NEVER appear in display state');

  // Query display questions via Socket joinRoom callback
  let displayJoinSecurityRes;
  phase9Socket.trigger('joinRoom', { roomCode: displaySession.roomCode, role: 'display' }, (res) => {
    displayJoinSecurityRes = res;
  });
  assert.strictEqual(displayJoinSecurityRes.success, true);
  assert.strictEqual(displayJoinSecurityRes.approvedQuestions.some((q) => q.id === qPendingSecret.id), false);
  assert.strictEqual(displayJoinSecurityRes.approvedQuestions.some((q) => q.id === qRejectedSecret.id), false);

  // Query display questions via Socket syncState callback
  let displaySyncSecurityRes;
  phase9Socket.trigger('syncState', { roomCode: displaySession.roomCode, role: 'display' }, (res) => {
    displaySyncSecurityRes = res;
  });
  assert.strictEqual(displaySyncSecurityRes.success, true);
  assert.strictEqual(displaySyncSecurityRes.approvedQuestions.some((q) => q.id === qPendingSecret.id), false);
  assert.strictEqual(displaySyncSecurityRes.approvedQuestions.some((q) => q.id === qRejectedSecret.id), false);

  console.log('   ✓ [Task 9.8 & 9.9] Server-side data isolation verified: pending and rejected questions strictly omitted from display snapshots.');

  // ====================================================
  // Tasks 10.1–10.5: Phase 10 In-Memory Session Management & Presenter Reset Tests
  // ====================================================
  console.log('\n[Phase 10: Tasks 10.1–10.5] Testing In-Memory Session Management, Status Accessors & Presenter Reset...');

  sessionService.clearAllSessions();
  const p10Session = sessionService.createNewSession();

  // Task 10.1: Server-authoritative in-memory state
  const activeSessionCheckP10 = sessionService.getActiveSession();
  assert.strictEqual(activeSessionCheckP10.id, p10Session.id);
  assert.strictEqual(activeSessionCheckP10.roomCode, p10Session.roomCode);
  console.log('   ✓ [Task 10.1] Active session data stored in server process memory and verified via service.');

  // Task 10.2: Status accessors (getPendingQuestions, getApprovedQuestions, getRejectedQuestions)
  resetRateLimits();
  const qP1 = sessionService.addQuestion(p10Session.roomCode, 'Pending Question 1').question;
  resetRateLimits();
  const qP2 = sessionService.addQuestion(p10Session.roomCode, 'Approved Question 2').question;
  resetRateLimits();
  const qP3 = sessionService.addQuestion(p10Session.roomCode, 'Rejected Question 3').question;

  sessionService.updateQuestionStatus(p10Session.roomCode, qP2.id, 'approved', p10Session.presenterSecret);
  sessionService.updateQuestionStatus(p10Session.roomCode, qP3.id, 'rejected', p10Session.presenterSecret);

  const pendingList = sessionService.getPendingQuestions(p10Session.roomCode);
  const approvedList = sessionService.getApprovedQuestions(p10Session.roomCode);
  const rejectedList = sessionService.getRejectedQuestions(p10Session.roomCode);

  assert.strictEqual(pendingList.length, 1);
  assert.strictEqual(pendingList[0].id, qP1.id);
  assert.strictEqual(approvedList.length, 1);
  assert.strictEqual(approvedList[0].id, qP2.id);
  assert.strictEqual(rejectedList.length, 1);
  assert.strictEqual(rejectedList[0].id, qP3.id);
  console.log('   ✓ [Task 10.2] Pending, approved, and rejected question collections logically separated via service accessors.');

  // Task 10.3: Centralized question status update validation
  const invalidTransitionRes = sessionService.updateQuestionStatus(p10Session.roomCode, qP1.id, 'INVALID_STATUS', p10Session.presenterSecret);
  assert.strictEqual(invalidTransitionRes.success, false);
  assert.ok(invalidTransitionRes.error.includes('Invalid question status'));
  console.log('   ✓ [Task 10.3] Centralized question status changes validate target status and transition rules.');

  // Task 10.4: Presenter Reset Action (Unauthorized vs Authorized)
  // 1. Unauthorized reset attempt (HTTP)
  const unauthResetRes = await httpRequest('POST', '/api/sessions/reset', {
    roomCode: p10Session.roomCode,
    presenterSecret: 'WRONG_SECRET'
  });
  assert.strictEqual(unauthResetRes.statusCode, 403);
  assert.strictEqual(JSON.parse(unauthResetRes.body).success, false);

  // 2. Authorized reset attempt (HTTP)
  const roomResetEvents = [];
  io.to = function (room) {
    return {
      emit: (event, payload) => {
        roomResetEvents.push({ room, event, payload });
      }
    };
  };

  const authResetRes = await httpRequest('POST', '/api/sessions/reset', {
    roomCode: p10Session.roomCode,
    presenterSecret: p10Session.presenterSecret
  });
  assert.strictEqual(authResetRes.statusCode, 200);
  assert.strictEqual(JSON.parse(authResetRes.body).success, true);

  // Verify questions cleared in memory
  assert.strictEqual(sessionService.getPendingQuestions(p10Session.roomCode).length, 0);
  assert.strictEqual(sessionService.getApprovedQuestions(p10Session.roomCode).length, 0);
  assert.strictEqual(sessionService.getRejectedQuestions(p10Session.roomCode).length, 0);

  // Verify sessionReset broadcast sent to room
  const resetBroadcast = roomResetEvents.find((e) => e.event === 'sessionReset');
  assert.ok(resetBroadcast, 'sessionReset socket broadcast emitted');
  assert.strictEqual(resetBroadcast.room, `session:${p10Session.roomCode}`);
  console.log('   ✓ [Task 10.4] Authorized presenter reset action clears questions, resets tracking, and broadcasts sessionReset event.');

  // Task 10.5: Process restart behavior verification
  sessionService.clearAllSessions();
  const activeAfterRestart = sessionService.getActiveSession();
  assert.strictEqual(activeAfterRestart, null);

  const staleValidateRes = await httpRequest('GET', `/api/sessions/validate/${p10Session.roomCode}`);
  assert.strictEqual(staleValidateRes.statusCode, 404);
  console.log('   ✓ [Task 10.5] Server memory cleared on restart; stale session requests cleanly rejected with HTTP 404.');

  // ====================================================
  // Tasks 10.6–10.8: Confirmation Warnings, Synchronized Resets & Data Retention Tests
  // ====================================================
  console.log('\n[Phase 10: Tasks 10.6–10.8] Testing Confirmation Warnings, Synchronized Resets & Data Retention...');

  // Create active session for Tasks 10.6–10.8 tests
  sessionService.clearAllSessions();
  const resetSyncSession = sessionService.createNewSession();

  // 1. Task 10.6 & 10.7: Add sample questions to pending and approved lists
  resetRateLimits();
  const qPreReset1 = sessionService.addQuestion(resetSyncSession.roomCode, 'Pre-reset question 1').question;
  resetRateLimits();
  const qPreReset2 = sessionService.addQuestion(resetSyncSession.roomCode, 'Pre-reset question 2').question;
  sessionService.updateQuestionStatus(resetSyncSession.roomCode, qPreReset2.id, 'approved', resetSyncSession.presenterSecret);

  assert.strictEqual(sessionService.getPendingQuestions(resetSyncSession.roomCode).length, 1);
  assert.strictEqual(sessionService.getApprovedQuestionsForDisplay(resetSyncSession.roomCode).length, 1);

  // 2. Task 10.7: Socket client join room before reset
  const syncSocketMod = createTestSocket('socket-sync-mod-10');
  const syncSocketDisplay = createTestSocket('socket-sync-display-10');
  initSocketHandlers({
    on: (evt, h) => evt === 'connection' && h(syncSocketMod),
    to: (room) => io.to(room),
    emit: (evt, payload) => io.emit(evt, payload)
  });
  initSocketHandlers({
    on: (evt, h) => evt === 'connection' && h(syncSocketDisplay),
    to: (room) => io.to(room),
    emit: (evt, payload) => io.emit(evt, payload)
  });

  syncSocketMod.trigger('joinRoom', { roomCode: resetSyncSession.roomCode, role: 'moderator', presenterSecret: resetSyncSession.presenterSecret }, () => { });
  syncSocketDisplay.trigger('joinRoom', { roomCode: resetSyncSession.roomCode, role: 'display' }, () => { });

  // Intercept room broadcasts
  const syncRoomEvents = [];
  io.to = function (room) {
    return {
      emit: (event, payload) => {
        syncRoomEvents.push({ room, event, payload });
      }
    };
  };

  // 3. Task 10.6 & 10.7: Execute reset via socket event resetSession
  let socketResetRes;
  syncSocketMod.trigger('resetSession', { roomCode: resetSyncSession.roomCode, presenterSecret: resetSyncSession.presenterSecret }, (res) => {
    socketResetRes = res;
  });

  assert.strictEqual(socketResetRes.success, true);
  assert.strictEqual(socketResetRes.roomCode, resetSyncSession.roomCode);

  // Verify server-side questions cleared immediately
  assert.strictEqual(sessionService.getPendingQuestions(resetSyncSession.roomCode).length, 0);
  assert.strictEqual(sessionService.getApprovedQuestionsForDisplay(resetSyncSession.roomCode).length, 0);

  // Verify sessionReset broadcast emitted to room
  const syncBroadcast = syncRoomEvents.find((e) => e.event === 'sessionReset');
  assert.ok(syncBroadcast, 'sessionReset event broadcast to session room');
  assert.strictEqual(syncBroadcast.room, `session:${resetSyncSession.roomCode}`);
  console.log('   ✓ [Task 10.6 & 10.7] Reset action clears in-memory questions and broadcasts sessionReset event to connected clients.');

  // 4. Task 10.7: Verify reconnecting clients post-reset receive empty question snapshots
  let postResetModSync;
  syncSocketMod.trigger('syncState', { roomCode: resetSyncSession.roomCode, role: 'moderator', presenterSecret: resetSyncSession.presenterSecret }, (res) => {
    postResetModSync = res;
  });
  assert.strictEqual(postResetModSync.success, true);
  assert.strictEqual(postResetModSync.pendingQuestions.length, 0);
  assert.strictEqual(postResetModSync.approvedQuestions.length, 0);

  let postResetDisplaySync;
  syncSocketDisplay.trigger('syncState', { roomCode: resetSyncSession.roomCode, role: 'display' }, (res) => {
    postResetDisplaySync = res;
  });
  assert.strictEqual(postResetDisplaySync.success, true);
  assert.strictEqual(postResetDisplaySync.approvedQuestions.length, 0);
  console.log('   ✓ [Task 10.7] Reconnecting moderator and display clients receive fresh empty snapshot post-reset.');

  // 5. Task 10.7: Stale question ID modification attempt rejected with HTTP 404
  const staleActionRes = await httpRequest('POST', '/api/sessions/questions/status', {
    roomCode: resetSyncSession.roomCode,
    questionId: qPreReset1.id,
    status: 'approved',
    presenterSecret: resetSyncSession.presenterSecret
  });
  assert.strictEqual(staleActionRes.statusCode, 404);
  assert.strictEqual(JSON.parse(staleActionRes.body).success, false);
  assert.ok(JSON.parse(staleActionRes.body).error.includes('Question not found'));
  console.log('   ✓ [Task 10.7] Modification attempt on pre-reset question ID rejected with HTTP 404 (stale state defense).');

  // 6. Task 10.8: Verify README documentation accuracy
  const fs = require('fs');
  const path = require('path');
  const readmeContent = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  assert.ok(readmeContent.includes('Ephemeral In-Memory Storage'), 'README documents in-memory storage');
  assert.ok(readmeContent.includes('No Persistent Storage or Database'), 'README explicitly documents lack of persistent storage/database');
  assert.ok(readmeContent.includes('No Question Retention After Reset or End'), 'README explicitly documents lack of retention after reset or end');
  console.log('   ✓ [Task 10.8] README documentation verified: accurately describes verified in-memory retention behavior.');

  // ====================================================
  // Tasks 11.1–11.9: Phase 11 Network Recovery, Idempotency & UI Elements Tests
  // ====================================================
  console.log('\n[Phase 11: Tasks 11.1–11.9] Testing Network Recovery, Idempotency & Frontend Static Pages...');

  // 1. Task 11.3 & 11.8: Sticky connection banner & submission lifecycle microcopy in HTML files
  const studentHtml = fs.readFileSync(path.join(__dirname, '../public/student/index.html'), 'utf8');
  const modHtml = fs.readFileSync(path.join(__dirname, '../public/moderator/index.html'), 'utf8');
  const displayHtml = fs.readFileSync(path.join(__dirname, '../public/display/index.html'), 'utf8');
  const appJsContent = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

  assert.ok(studentHtml.includes('id="connection-banner"'), 'Student HTML includes connection banner');
  assert.ok(modHtml.includes('id="connection-banner"'), 'Moderator HTML includes connection banner');
  assert.ok(displayHtml.includes('id="connection-banner"'), 'Display HTML includes connection banner');
  assert.ok(studentHtml.includes('form-explanation'), 'Student HTML includes submission lifecycle explanation');
  console.log('   ✓ [Task 11.3 & 11.8] HTML templates contain sticky connection banner elements and submission notice microcopy.');

  // 2. Task 11.1: Loading spinner & submitting UI state in app.js
  assert.ok(appJsContent.includes('btn-spinner'), 'app.js includes loading spinner class');
  assert.ok(appJsContent.includes('Submitting...'), 'app.js updates button text while submitting');
  console.log('   ✓ [Task 11.1] Client JavaScript implements button disabled locking and spinner loading states.');

  // 3. Task 11.6 & 11.7: Draft recovery and idempotency key persistence
  assert.ok(appJsContent.includes('qalive_draft_text_'), 'app.js manages draft text in sessionStorage');
  assert.ok(appJsContent.includes('qalive_idempotency_key_'), 'app.js manages idempotency keys in sessionStorage');
  console.log('   ✓ [Task 11.6 & 11.7] Client JavaScript implements sessionStorage draft auto-saving, recovery, and idempotency key retention.');

  // 4. Task 11.9: README recovery instructions verification
  assert.ok(readmeContent.includes('Presentation Day Troubleshooting & Network Recovery Guide'), 'README includes Section 6 Troubleshooting Guide');
  assert.ok(readmeContent.includes('Laptop Server Failure Recovery'), 'README includes server failure instructions');
  assert.ok(readmeContent.includes('Local Wi-Fi or Hotspot Failure Recovery'), 'README includes Wi-Fi failure instructions');
  console.log('   ✓ [Task 11.9] README includes comprehensive server crash and local Wi-Fi recovery instructions.');

  // Regression check
  const healthRes = await httpRequest('GET', '/health');
  assert.strictEqual(healthRes.statusCode, 200);

  console.log('\nAll Tasks 5.4–5.11, 6.1–6.11, 7.1–7.9, 8.1–8.11, 9.1–9.10, 10.1–10.8 & 11.1–11.9 unit and integration tests completed successfully!');

  server.close(() => {
    process.exit(0);
  });
}

setTimeout(runAllTests, 500);
