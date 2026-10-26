# QAlive — Offline Anonymous Live Q&A

QAlive is an offline-first, anonymous live Q&A web application designed for school presentations. Similar to Slido, it enables students to submit questions anonymously from their mobile phones over a shared local Wi-Fi network or hotspot without requiring an internet connection. The presenter moderates incoming questions from a dashboard, and approved questions appear live on a dedicated projector screen.

---

## Table of Contents

- [Project Overview \& Key Goals](#project-overview--key-goals)
- [Fixed Technology Stack](#fixed-technology-stack)
- [Architecture \& Local Networking](#architecture--local-networking)
- [Project Directory Structure](#project-directory-structure)
- [Setup \& Execution Guide](#setup--execution-guide)
- [Testing \& Verification](#testing--verification)
- [Project Progress and AI Handoff](#project-progress-and-ai-handoff)
  - [Instructions for Future AI Coding Agents](#instructions-for-future-ai-coding-agents)
  - [Current Status Overview](#current-status-overview)
  - [Completed Tasks \& Implementation Status](#completed-tasks--implementation-status)
  - [Verified Test Results](#verified-test-results)
  - [Remaining Tasks by Phase](#remaining-tasks-by-phase)
  - [Technical Decisions \& System Architecture](#technical-decisions--system-architecture)
  - [Known Limitations \& Unverified Items](#known-limitations--unverified-items)
  - [Files and Responsibilities Matrix](#files-and-responsibilities-matrix)
  - [Exact Next Task to Work On](#exact-next-task-to-work-on)

---

## Project Overview & Key Goals

- **100% Offline Capability:** Operates entirely without internet access at runtime. All frontend libraries, CSS, and Socket.IO scripts are served locally from the presenter's laptop.
- **Anonymous Question Submission:** Students ask questions via mobile web browsers without creating accounts, providing names, or sharing emails.
- **Presenter Moderation:** The presenter reviews submissions from a moderator dashboard before questions appear live.
- **Live Projector Display:** Approved questions render immediately on a presentation screen for the audience.
- **Ephemeral In-Memory Storage:** Questions and sessions reside in server memory only during runtime and reset when the server restarts or a session closes.

---

## Fixed Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Node.js (v18+) + Express (v5.3.0) | Handles HTTP routing, API endpoints, session logic, and static file serving. |
| **Real-Time Communication** | Socket.IO (v4.8.4) | Binds to the main HTTP server to broadcast live updates without extra open ports. |
| **Frontend** | HTML5, CSS3, Plain JavaScript (ES6) | Zero external UI frameworks or CDNs. Designed mobile-first for student phones. |
| **Storage** | In-Memory JavaScript Objects (`Map`, `Array`) | Volatile, fast in-memory store; no database installation required. |
| **Networking** | Local IPv4 Wi-Fi / Hotspot | Server listens on `0.0.0.0` port `3000` for local LAN access. |

---

## Architecture & Local Networking

### Server Host & Listening Interface
- The presenter's laptop acts as the single central server.
- The server binds to host `0.0.0.0` and default port `3000`. Binding to `0.0.0.0` allows the server to accept connections from any local network interface (Ethernet, Wi-Fi, or mobile hotspot).

### Connecting Students via Local Wi-Fi / Hotspot
1. **Connect to Same Network:** Ensure the presenter's laptop and student phones are on the **same local Wi-Fi network** or connected to a mobile hotspot hosted by the laptop/presenter.
2. **Accessing via Local IPv4 Address:**
   - **`localhost` (`http://localhost:3000`)**: Usable **only** on the presenter's laptop.
   - **LAN IPv4 Address (`http://<laptop-lan-ip>:3000/student`)**: Private IP assigned to the laptop by the router (e.g., `http://192.168.1.5:3000/student`). This is the URL typed into student phone browsers.
   - When launched with `npm start`, the server automatically logs detected LAN IPv4 addresses.

### Windows Firewall Configuration
To allow student phones to connect to port `3000` without disabling safety features:
1. **Set Private Network Profile:** In Windows Settings > Network & Internet > Wi-Fi, ensure your network profile is set to **Private**.
2. **Allow Node.js in Firewall:** Search for "Allow an app through Windows Firewall", click "Change settings", locate **Node.js JavaScript Runtime**, and check the box for **Private** networks.
3. **Alternative Inbound Rule:** Create an Inbound Rule in Windows Defender Firewall (`wf.msc`) allowing TCP traffic on port `3000` for Private networks.

> **Important Note on School/Public Wi-Fi:** School guest networks often enable **AP Isolation (Client Isolation)**, which blocks connected devices from communicating with each other. If device-to-device traffic is blocked, host a Wi-Fi hotspot from the presenter's laptop or use a portable travel router.

---

## Project Directory Structure

```text
REPORTING/
├── public/                       # Frontend static files served by Express
│   ├── assets/                   # Static media and graphics
│   │   └── .gitkeep
│   ├── css/
│   │   └── style.css             # Central CSS design system (variables, mobile layout)
│   ├── display/
│   │   └── index.html            # Dark-mode projector live display view
│   ├── js/
│   │   └── app.js                # Student client JS (form handling, character counter, API, sockets)
│   ├── moderator/
│   │   └── index.html            # Moderator dashboard layout
│   └── student/
│       └── index.html            # Mobile-first student question submission page
├── src/                          # Backend application source code
│   ├── middleware/
│   │   └── .gitkeep              # Placeholder for future custom middleware
│   ├── models/
│   │   └── sessionModel.js       # Data structures, schemas, and status normalization
│   ├── routes/
│   │   ├── .gitkeep
│   │   └── sessionRoutes.js      # REST endpoints for active sessions & question posting
│   ├── services/
│   │   ├── .gitkeep
│   │   └── sessionService.js     # Singleton in-memory session and question management service
│   ├── sockets/
│   │   └── .gitkeep              # Placeholder for modular socket event handlers
│   ├── utils/
│   │   ├── .gitkeep
│   │   ├── network.js            # Utility detecting local non-internal IPv4 addresses
│   │   └── roomCode.js           # 6-character room code generator and validator
│   └── server.js                 # Express + Socket.IO HTTP server entry point
├── tests/
│   ├── .gitkeep
│   └── verify.js                 # Native Node.js unit and integration test suite
├── .gitignore                    # Prevents checking in node_modules and logs
├── package.json                  # Node.json scripts and dependencies
├── package-lock.json             # Dependency lockfile
├── README.md                     # Persistent AI context & project documentation
└── TASKS.MD                      # Master task tracking checklist (13 phases)
```

---

## Setup & Execution Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Installation (Before Presentation Day)
Run this command while internet access is available to install dependencies locally:

```bash
npm install
```

### 2. Starting the Server
Start the local server from the project root directory:

```bash
npm start
```

This executes `node src/server.js`, launching Express and Socket.IO on host `0.0.0.0` and port `3000`.

### 3. Application Access URLs
- **Student Submission Page:** `http://localhost:3000/student` (Student Mobile: `http://<laptop-lan-ip>:3000/student`)
- **Moderator Dashboard:** `http://localhost:3000/moderator`
- **Projector Live Display:** `http://localhost:3000/display`
- **Server Health Check:** `http://localhost:3000/health`

### 4. Custom Port Configuration
If port `3000` is in use (`EADDRINUSE`), launch on a custom port:

- **Windows CMD:** `set PORT=3005 && npm start`
- **Windows PowerShell:** `$env:PORT="3005"; npm start`
- **Linux / macOS:** `PORT=3005 npm start`

### 5. Stopping the Server
Press `Ctrl + C` in the terminal running the server.

> **Data Retention Note:** Stopping or restarting the server clears all temporary in-memory sessions and questions.

---

## Presentation Day Troubleshooting & Network Recovery Guide

### 1. Laptop Server Failure Recovery
- **Symptoms:** Student devices show sticky "Unable to reach server" banner; moderator and projector pages lose live updates.
- **Verification:**
  1. Check terminal on presenter's laptop to confirm if Node process is still running.
  2. Open `http://localhost:3000/health` in browser on presenter's laptop.
- **Restarting the Server:**
  If the process exited or crashed, restart it using the project's standard startup command:
  ```bash
  npm start
  ```
- **In-Memory Volatility & Loss Warning:**
  - **Crucial Notice:** QAlive stores active session data strictly in volatile server RAM.
  - Restarting the server process **permanently purges all active session metadata, room codes, and submitted question history**. Stored questions cannot be recovered after a server restart.
- **Client Recovery:**
  - Once restarted, student devices reload `http://<laptop-lan-ip>:3000/student` and presenter re-opens `http://localhost:3000/moderator`.
  - A fresh session will automatically initialize with a new room code.

### 2. Local Wi-Fi or Hotspot Failure Recovery
- **Symptoms:** Student phones lose local network connection; IP address changes.
- **Verification:**
  1. Ensure both the presenter's laptop and student mobile devices are connected to the **same local Wi-Fi network** or presenter hotspot.
  2. Verify AP Isolation (Client Isolation) is disabled on the school/public router, or use a mobile hotspot hosted by the presenter's laptop.
- **If Laptop IPv4 Address Changes:**
  1. Check startup logs from `npm start` or run `ipconfig` (Windows) / `ifconfig` (Mac/Linux) to find the new local IPv4 address.
  2. Direct students to type the updated LAN address into their phone browsers (e.g., `http://192.168.1.15:3000/student`).
- **Handling Uncertain Submissions:**
  - If a student's connection drops during submission, their question draft is preserved automatically in `sessionStorage`.
  - Once connectivity returns, the student clicks **Submit Question** to retry. The client's saved idempotency key ensures that if the server already received the question before the drop, it will acknowledge acceptance without creating a duplicate record.

---

## Testing & Verification

Run the automated integration and unit test suite at any time:

```bash
node tests/verify.js
```

The test script validates server payload checking, length constraints, whitespace trimming, spoofing defenses, unique ID generation, and pending queue behavior without external test frameworks.

---

## Project Progress and AI Handoff

### Instructions for Future AI Coding Agents

> **Mandatory AI Rules:**
> 1. **Read Before Coding:** Always read `README.md` and `TASKS.MD` first to understand the current project state.
> 2. **Inspect the Repository:** Inspect existing source code, models, routes, and tests before introducing changes.
> 3. **Follow Task Boundaries:** Work strictly on the single next task specified in the **Exact Next Task to Work On** section below. Do not jump ahead or implement unrequested features.
> 4. **Do Not Claim Unverified Work:** Only mark tasks complete in `TASKS.MD` and `README.md` if the code has been fully implemented and verified with tests.
> 5. **Update Persistent Context:** When completing a task, update `README.md` and `TASKS.MD` so subsequent AI sessions maintain seamless continuity.

---

### Current Status Overview

- **Completed Phases:** Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8 (Tasks 8.1–8.11), Phase 9 (Tasks 9.1–9.10), Phase 10 (Tasks 10.1–10.8), and Phase 11 (Tasks 11.1–11.9) fully complete and verified.
- **Phase 11 Status:** Phase 11 (Tasks 11.1–11.9: Form Loading & Submitting States, Empty Queue/Display States, Connection-Lost Banners, Socket.IO Reconnection Handling, State Synchronization, Duplicate Prevention & Idempotency, Browser Draft Recovery, Submission Lifecycle Notices, and Server/Wi-Fi Recovery Instructions) fully complete and verified.
- **Verification Summary:** All completed features pass 100% of automated unit and integration tests (`tests/verify.js`).

---

### Completed Tasks & Implementation Status

#### Phase 1 — Project Setup (Tasks 1.1–1.8) — Complete
- Initial folder structure (`public/`, `src/`, `tests/`) created.
- `package.json` initialized with Express (^5.3.0) and Socket.IO (^4.8.4).
- Entry point `src/server.js`, frontend entry files, `.gitignore`, and Git repository initialized.

#### Phase 2 — Offline Server & Local Networking (Tasks 2.1–2.11) — Complete
- Express HTTP server running on host `0.0.0.0` and port `3000`.
- Static frontend pages served locally at `/student`, `/moderator`, and `/display`.
- Socket.IO attached to Express HTTP server instance.
- Health check endpoint active at `/health` returning `{ "status": "ok", "service": "offline-qa" }`.
- Local IPv4 network detection utility (`src/utils/network.js`) auto-detects and logs active LAN IPs on startup.
- Centralized 404 and 500 JSON error handling middleware configured without exposing stack traces to clients.
- Verified zero external CDN or internet dependencies required at runtime.

#### Phase 3 — UI Foundation (Tasks 3.1–3.8) — Complete
- Centralized design system in `public/css/style.css` using CSS custom properties (colors, typography, spacing).
- Reusable UI components: cards, buttons (min 44px touch targets), form inputs, badges (`badge-success`, `badge-warning`, `badge-danger`), and alert banners.
- Mobile-first layout for student submission (`public/student/index.html`).
- Desktop moderator dashboard template (`public/moderator/index.html`).
- High-contrast projector presentation layout (`public/display/index.html`).
- Fully responsive across mobile phones, laptops, and large screens.

#### Phase 4 — Session & Room Management (Tasks 4.1–4.9) — Complete
- Data schemas and constants defined in `src/models/sessionModel.js`:
  - `SESSION_STATUS`: `Open`, `Paused`, `Closed`.
  - `QUESTION_STATUS`: `pending`, `approved`, `rejected`.
  - `MAX_QUESTION_LENGTH`: 300 characters.
- In-memory session service (`src/services/sessionService.js`) with maps for `sessionsById` and `sessionsByRoomCode`.
- Short 6-character uppercase room codes (`src/utils/roomCode.js`) using Node built-in `crypto` module, excluding ambiguous characters (`O`, `0`, `I`, `1`).
- REST endpoints in `src/routes/sessionRoutes.js`:
  - `GET /api/sessions/active`: Retrieves current active session.
  - `POST /api/sessions/create`: Enforces single-active-session policy.
  - `GET /api/sessions/validate/:roomCode`: Validates room code format and active state.
  - `POST /api/sessions/status`: Presenter state transition endpoint (`Open` ↔ `Paused` → `Closed`). Requires presenter secret token in header (`x-presenter-token`) or body (`presenterSecret`). Terminal state protection prevents re-opening `Closed` sessions.
- Question submission rejection when session is `Paused` or `Closed` (HTTP 400).
- Real-time Socket.IO emission of `sessionStatusChanged` events.

#### Phase 5 — Anonymous Question Submission (Tasks 5.1–5.11 Complete)
- **Task 5.1 (Complete):** Student join page (`public/student/index.html`) automatically fetches and displays current active room code and session status.
- **Task 5.2 (Complete):** Anonymous question submission form with client-side submit handler in `public/js/app.js`.
- **Task 5.3 (Complete):** Client-side validation enforcing non-empty input, whitespace trimming, and live character counter with 300-character cap.
- **Task 5.4 (Complete):** Server-side validation rejecting non-string inputs, empty/whitespace text, trimming input text, enforcing 300 character cap, and overriding client attempts to spoof metadata (`id`, `sessionId`, `status`, `createdAt`).
- **Task 5.5 (Complete):** Unique server-generated question IDs generated via `crypto.randomUUID()`.
- **Task 5.6 (Complete):** Accepted question submissions placed into the session's in-memory `questions` array with status `pending`.
- **Task 5.7 (Complete):** Confirmation displayed strictly after server returns successful acceptance (HTTP 201/200). Text input cleared only on confirmed acceptance; preserved on failure. In-flight submit locking and 10-second `AbortController` timeout protection implemented.
- **Task 5.8 (Complete):** User-friendly error feedback messages for unknown room codes, paused/closed sessions, character limits, rate limits, and network errors.
- **Task 5.9 (Complete):** Server-side idempotency key protection (`x-idempotency-key`) preventing retries from duplicating questions, client IP rate limiting (minimum 2s interval between submissions and sliding window cap), and automatic expiration cleanup routine.
- **Task 5.10 (Complete):** Pure anonymous submissions strictly enforced with zero requests or storage for student names, emails, IDs, or account info.
- **Task 5.11 (Complete):** Question status protection enforced on server-side. Student submissions unconditionally forced to `pending`; question status updates (`POST /api/sessions/questions/status`) require valid presenter secret (`x-presenter-token`) and reject unauthorized attempts with HTTP 403.

#### Phase 6 — Prohibited-Word Filtering & Content Safety (Tasks 6.1–6.11 Complete)
- **Task 6.1 (Complete):** Configurable local blocklist dictionary created in `src/utils/blocklist.js` categorized by profanity, slurs, harassment, and abusive expressions without external cloud dependencies.
- **Task 6.2 (Complete):** Case-insensitive word boundary and phrase matching logic implemented in `src/utils/contentFilter.js`.
- **Task 6.3 (Complete):** Text normalization pipeline in `src/utils/contentFilter.js` combining Unicode NFD diacritic stripping, leetspeak character substitutions (`@`/`4` -> `a`, `3` -> `e`, `1`/`!` -> `i`, `0` -> `o`, `$` -> `s`), and spacer-evasion collapse for spaced/punctuated single-letter sequences without false positives on legitimate educational words.
- **Task 6.4 (Complete):** Server-side filtering integrated into `sessionService.addQuestion()` prior to queue insertion.
- **Task 6.5 (Complete):** Non-revealing standard error message returned (`"Your question contains language that isn't allowed. Please revise it and try again."`) without exposing matched words, internal rules, or filter parameters. Student question input preserved on client for rephrasing.
- **Task 6.6 (Complete):** Fully local blocklists, normalization, and filtering logic operating 100% offline without external APIs or cloud services.
- **Task 6.7 (Complete):** Educational health exception rules implemented permitting legitimate questions about sexual health, consent, puberty, reproductive anatomy, and personal boundaries.
- **Task 6.8 (Complete):** Context-aware matching utilizing token boundary checks and educational framing phrase indicators (`EDUCATIONAL_TERMS` and `EDUCATIONAL_PATTERNS`) to eliminate false positives on educational discussions while blocking profanity and severe slurs.
- **Task 6.9 (Complete):** Test suite expanded covering prohibited content rejection and legitimate educational health question acceptance.
- **Task 6.10 (Complete):** XSS protections audited and global `escapeHTML()` helper added in `public/js/app.js` with DOM `textContent` rendering.
- **Task 6.11 (Complete):** Automated unit and integration tests added in `tests/verify.js` covering filtering, normalization, educational allowlisting, and XSS string escaping.

#### Phase 8 — Moderator Dashboard (Tasks 8.1–8.11 Complete)
- **Task 8.1 (Complete):** Moderator dashboard queue rendering implemented in `public/moderator/index.html` and `public/js/app.js` displaying incoming student questions with formatted timestamps and empty/loading state handling.
- **Task 8.2 & 8.3 (Complete):** Server-validated presenter secret authorization integrated into moderator UI via secure form input and `sessionStorage` token management. Credentials strictly excluded from student-facing code, public API payloads, and URLs.
- **Task 8.4 (Complete):** Approve action implemented with server authorization, real-time pending queue removal, stat counter updates, and Socket.IO `approvedQuestionAdded` broadcast targeted strictly to projector display rooms (`session:{roomCode}:display`).
- **Task 8.5 (Complete):** Reject action implemented with server authorization, real-time pending queue removal, stat counter updates, and zero leakage/broadcast of rejected content to projector clients.
- **Task 8.6 (Complete):** Display removal action added (`toggleQuestionDisplay`), allowing authorized presenters to remove approved questions from projector screen without altering question moderation status history.
- **Task 8.7 (Complete):** Consistent question status tracking (`pending`, `approved`, `rejected`) enforced across models, REST API, Socket.IO handlers, and state synchronization.
- **Task 8.8 (Complete):** Session submission controls (Open, Pause, Close) added to moderator dashboard and enforced on server-side.
- **Task 8.9 (Complete):** Immediate actionable feedback messages and control state locking implemented for moderator actions.
- **Task 8.10 (Complete):** Server-side authorization and payload/state transition validation enforced on all moderation operations.
- **Task 8.11 (Complete):** Security and data-isolation audit completed, preventing unauthorized clients from accessing pending queues or altering session state.

#### Phase 9 — Projector Display (Tasks 9.1–9.10 Complete — Word Cloud Layout & Fullscreen Workflow)
- **Task 9.1 (Complete):** Dedicated presentation display page created (`public/display/index.html`) featuring a Word Cloud presentation layout, room code badge, session status indicator, and zero clutter (no student forms or moderator actions).
- **Task 9.2 (Complete):** Server-authoritative rendering boundary enforcing approved-questions-only display (`getApprovedQuestionsForDisplay`). Pending and rejected submissions are strictly omitted.
- **Task 9.3 & 9.4 (Complete):** Live Word Cloud rendering and real-time updates implemented in `public/js/app.js` and `public/css/style.css`. Approved terms dynamically appear as weighted pill badges with pop-in animations (`@keyframes wordPop`), and removed terms immediately exit without page refreshes.
- **Task 9.5 (Complete):** Projector readability optimized with weighted Word Cloud pills (`word-cloud-tier-1` to `4` ranging from 20px up to 56px font size, with soft pastel backgrounds and high-contrast text matching reference design) and styled empty state ("Approved responses will appear in the Word Cloud as they’re approved.").
- **Task 9.6 (Complete):** Polished projector empty state ("No Approved Questions Yet", "Questions will appear here as they’re approved by the presenter.") integrated smoothly with live word cloud transitions.
- **Task 9.7 (Complete):** Session status banner (`Open`, `Paused`, `Closed`) added to projector display page, updating live via `sessionStatusChanged` events and restored on reconnection.
- **Task 9.8 (Complete):** Display reconnection recovery implemented, purging stale timers and re-synchronizing active unexpired approved questions from server snapshot.
- **Task 9.9 (Complete):** Server-side data isolation verified across REST and Socket.IO endpoints, ensuring pending and rejected questions never leak to display clients.
- **Task 9.10 (Complete):** Full-screen presentation workflow implemented with `Full Screen` toggle button, `F`/`Esc` key shortcuts, `fullscreenchange` event tracking, and browser compatibility fallbacks.

---

### Verified Test Results

The test suite in `tests/verify.js` was executed and verified:

- **Command Executed:** `node tests/verify.js`
- **Result:** Exit Code 0 (All tests passed)
- **Test Output Summary:**
  - `[Task 5.4]` Non-string question payloads rejected with HTTP 400.
  - `[Task 5.4]` Empty and whitespace-only submissions rejected with HTTP 400.
  - `[Task 5.4]` Question text trimmed correctly before storing.
  - `[Task 5.4]` Max length 300 accepted (HTTP 201), length 301 rejected (HTTP 400).
  - `[Task 5.4]` Client spoof attempt overridden (server metadata authoritative).
  - `[Task 5.5]` Unique server-generated question IDs verified (`crypto.randomUUID()`).
  - `[Task 5.6]` Accepted submissions entered pending queue with status `pending`.
  - `[Task 5.7 & 5.8]` Unknown room code returns HTTP 404 with clear user error message.
  - `[Task 5.7 & 5.8]` Paused session rejection returns HTTP 400 with clear user error message.
  - `[Task 5.9]` Idempotency Key retry returned original question with HTTP 200 without creating duplicate.
  - `[Task 5.9]` Queue length maintained (no duplicate entry added to pending queue).
  - `[Task 5.9]` Rapid consecutive submission (< 2s) rejected with HTTP 429 rate limit message.
  - `[Task 5.9]` Expired tracking records automatically purged by cleanup routine.
  - `[Task 5.10]` Student identity fields (name, email, student ID, user) strictly stripped/ignored.
  - `[Task 5.11]` Student status override attempt ("approved") forced to "pending" on submission.
  - `[Task 5.11]` Unauthenticated student request to change question status rejected with HTTP 403 Forbidden.
  - `[Task 5.11]` Invalid presenter secret token rejected with HTTP 403 Forbidden.
  - `[Task 5.11]` Authorized presenter successfully changed question status to "approved".
  - `[Task 6.1–6.5]` Blocked single words in uppercase, lowercase, and mixed case rejected with HTTP 400.
  - `[Task 6.1–6.5]` Multi-word prohibited phrases rejected with HTTP 400.
  - `[Task 6.1–6.5]` Leetspeak character substitutions and spacing/punctuation evasion attempts detected and rejected.
  - `[Task 6.1–6.5]` Harmless educational words containing embedded substrings accepted without false positives.
  - `[Task 6.1–6.5]` Blocked submissions strictly excluded from pending moderation queue.
  - `[Task 6.6–6.9]` All legitimate educational questions accepted (HTTP 201).
  - `[Task 6.6–6.9]` All prohibited submissions rejected with HTTP 400 and generic error message.
  - `[Task 6.10 & 6.11]` XSS script and markup payloads accepted safely as raw text.
  - `[Task 6.10 & 6.11]` Frontend `escapeHTML` function converts dangerous markup to harmless HTML entities.
  - `[Task 7.1]` Socket.IO client library JavaScript served locally at `/socket.io/socket.io.js`.
  - `[Task 7.1]` Local Socket.IO connection handshake succeeded with session ID (`sid`).
  - `[Task 7.2]` Student & Display client room joins verified for session-specific room channels.
  - `[Task 7.2]` Invalid room code socket join attempts rejected with descriptive errors.
  - `[Task 7.3]` Unauthorized moderator room join attempts rejected when presenter token is missing/invalid.
  - `[Task 7.3]` Authorized moderator room join succeeded with token and synchronized pending question queue.
  - `[Task 7.3]` New pending questions broadcast strictly to authorized moderator room (`session:{roomCode}:moderator`).
  - `[Task 7.4]` Approved question status updates broadcast strictly to projector display room (`session:{roomCode}:display`).
  - `[Task 7.5]` Session status change events (`Open` -> `Paused`) broadcast to target session room (`session:{roomCode}`).
  - `[Tasks 7.6 & 7.7]` Reconnecting student socket successfully synchronized state without sensitive queue data.
  - `[Tasks 7.6 & 7.7]` Reconnecting moderator socket successfully received authorized pending and approved questions.
  - `[Tasks 7.6 & 7.7]` State synchronization gracefully rejected nonexistent session.
  - `[Tasks 7.8 & 7.9]` Unauthorized question status update via socket rejected with error.
  - `[Tasks 7.8 & 7.9]` Authorized question status update via socket succeeded.
  - `[Tasks 7.8 & 7.9]` Client spoofing attempt (`isModerator: true`) rejected and moderator room access blocked.
  - `[Task 8.1]` Authorized moderator fetched pending queue containing pending questions.
  - `[Task 8.2]` Unauthorized pending queue retrieval rejected with error.
  - `[Task 8.3]` Presenter secret token strictly omitted from public active session API response.
  - `[Task 8.4]` Moderator approved question: updated status to "approved", removed from pending queue, and broadcast to display room.
  - `[Task 8.5]` Moderator rejected question: updated status to "rejected", removed from pending queue, omitted from display room, and updated moderator clients in real time.
  - `[Task 9.1]` Dedicated presentation display page loads with clean presentation layout.
  - `[Task 9.2]` Server display state strictly returns approved questions only.
  - `[Task 9.3]` Real-time approval emits `approvedQuestionAdded` to display room.
  - `[Task 9.4]` Real-time removal emits `approvedQuestionRemoved` and purges question from display state.
  - `[Task 9.5]` Reconnecting display restores server-authoritative state without removed questions.
  - `[Regression Check]` `/health` endpoint returned HTTP 200 `{ status: "ok" }`.

---

### Remaining Tasks by Phase

- **Phase 9 (Tasks 9.6–9.10):** Projector empty state, session status indicator on display, reconnection recovery, and full-screen workflow.
- **Phase 10 (Tasks 10.1–10.8):** Session lifecycle workflows, presenter reset actions, and warning alerts.
- **Phase 11 (Tasks 11.1–11.9):** Client loading states, disconnect notices, and Socket.IO auto-reconnection recovery.
- **Phase 12 (Tasks 12.1–12.14):** End-to-end security, XSS escaping verification, and offline multi-phone testing.
- **Phase 13 (Tasks 13.1–13.11):** Presentation day offline checklist, recovery instructions, and user documentation.

---

### Technical Decisions & System Architecture

1. **Single-Port Architecture:** Express HTTP routes and Socket.IO real-time WebSocket traffic co-exist on a single HTTP server on port `3000`. This simplifies firewall rules on local networks.
2. **Presenter Authorization Security:** Session control operations (`POST /api/sessions/status`) require a presenter secret token generated during session creation (`presenterSecret`). Tokens are passed in the `x-presenter-token` HTTP header or request body.
3. **Single Active Presentation Policy:** `sessionService.createNewSession()` allows only one active session (`Open` or `Paused`) at a time to prevent confusion during school presentations.
4. **Terminal Closed State:** Once a session is transitioned to `Closed`, it cannot be re-opened. Presenters must create a new session for subsequent presentations.
5. **No External CDNs / Zero Internet:** All CSS and JS assets are served locally from `public/`. Socket.IO client JS is served directly from `/socket.io/socket.io.js`.

---

### Data Retention & Session Lifecycle Limitations

- **Ephemeral In-Memory Storage:** All session metadata, room codes, and question submissions reside strictly in server volatile process memory (`Map` / `Array`).
- **No Persistent Storage or Database:** QAlive Version 1 does not use a database (SQL, NoSQL, Supabase, Firebase) or local disk file persistence for question history.
- **No Question Retention After Reset or End:** When a session is reset or closed, or when the server process is restarted/stopped, all questions and moderation history are permanently purged from memory and **cannot be restored, retrieved, or exported**.
- **Session Control Distinction:**
  - **Pausing Submissions (`Paused`):** Temporarily rejects new question submissions from students while leaving all existing pending, approved, and displayed questions intact.
  - **Closing a Session (`Closed`):** Permanently stops new submissions and transitions the session to a terminal closed state. Existing question history remains visible during the active server session until reset or restarted.
  - **Resetting Questions:** Empties all in-memory question arrays (`pending`, `approved`, `rejected`) and clears rate-limiting tracking maps, broadcasting a real-time `sessionReset` sync event to all connected clients while keeping the session open for fresh submissions.
  - **Server Restart / Shutdown:** Immediately clears all server RAM, destroying all active sessions, room codes, and question data.

---

### Known Limitations & Unverified Items

- **Data Volatility:** Questions and sessions are stored strictly in server memory (`Map` / `Array`). Restarting the Node server process clears all stored data.
- **Single Presentation Room:** Only one active room is supported at a time in Version 1.
- **Unverified - Physical Multi-Device Load:** Server performance with dozens of concurrent physical phone connections over local Wi-Fi router hardware is unverified in automated CLI test environments.
- **Unverified - Non-Windows Firewalls:** Automatic firewall rule configuration scripts for macOS / Linux are not implemented; manual firewall allowance may be required on non-Windows host laptops.

---

### Files and Responsibilities Matrix

| File Path | Primary Responsibility |
| :--- | :--- |
| `package.json` | Project manifest, dependencies (`express`, `socket.io`), and `npm start` script. |
| `src/server.js` | Main server entry point, Express app setup, Socket.IO binding, health check, route mounts, static serving, and 404/500 middleware. |
| `src/routes/sessionRoutes.js` | Express HTTP router handling `/api/sessions/active`, `/create`, `/validate/:roomCode`, `/status`, `/reset`, and `/questions`. |
| `src/services/sessionService.js` | In-memory singleton managing sessions, state transitions, room code lookups, question creation, pending queues, and reset actions. |
| `src/models/sessionModel.js` | Data schemas for Session and Question objects, status constants (`Open`, `Paused`, `Closed`, `pending`, `approved`, `rejected`), status normalization, and transition validation. |
| `src/sockets/socketHandler.js` | Modular Socket.IO connection event handling, session room joining, presenter secret room auth, initial state synchronization, and reset broadcasts. |
| `src/utils/network.js` | Scans OS network interfaces and returns non-internal local IPv4 addresses. |
| `src/utils/roomCode.js` | Generates 6-character room codes from an unambiguous alphanumeric character set (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`). |
| `src/utils/blocklist.js` | Local dictionary of prohibited words, slurs, harassment phrases, and educational health allowlists (`EDUCATIONAL_TERMS`, `EDUCATIONAL_PATTERNS`). |
| `src/utils/contentFilter.js` | Normalization pipeline (case folding, Unicode diacritics, leetspeak map, evasion spacer collapse), educational context exception handler, and content checking logic. |
| `public/student/index.html` | Mobile HTML structure for student question submission, room code display, and status indicators. |
| `public/moderator/index.html` | HTML structure for presenter moderator dashboard, control buttons, and queue overview. |
| `public/display/index.html` | Dark-mode HTML layout for live projector display of approved questions in Word Cloud view. |
| `public/js/app.js` | Frontend client JS for active session fetching, form submission, character counting, feedback banners, XSS escaping, confirmation dialog warnings, in-flight locking, and Socket.IO status/reset listeners. |
| `public/css/style.css` | Central design system stylesheet containing color palette, typography scale, responsive layout containers, buttons, cards, badges, and alerts. |
| `tests/verify.js` | Native Node.js test script verifying server payload rules, max limits, metadata override security, unique IDs, content filtering, educational allowlisting, XSS safety, Socket.IO room events, and session reset sync. |
| `TASKS.MD` | Master 13-phase project task tracking checklist. |
| `README.md` | Persistent project context, system architecture, setup instructions, data-retention limitations, and AI agent handoff documentation. |

---

### Exact Next Task to Work On

Based on `TASKS.MD`, the next task to implement and verify is:

**Task 12.1 — Test submissions from multiple phones connected to the same local Wi-Fi.**

- **Objective:** Verify multi-device concurrency and physical phone network performance on local Wi-Fi router.

