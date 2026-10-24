gi# TASKS.md — Offline Anonymous Live Q&A

**Project:** Anonymous Live Q&A for School Presentations  
**Goal:** A mini-Slido web app where students submit questions anonymously using their phones. The presenter moderates submissions, and only approved questions appear live on the projector.

**Primary requirement:** The entire application must work without internet access during the presentation. Devices communicate through the same local Wi-Fi network.

## Fixed Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Real-time communication:** Socket.IO
- **Storage:** In-memory JavaScript data structures
- **Network:** Local Wi-Fi router or a hotspot that permits communication between connected devices
- **Version control:** Git and GitHub for development only; GitHub is not required at runtime

## Architecture Rules

- The presenter's laptop runs the entire server.
- Students access the app through the laptop's local IPv4 address and port, such as `http://192.168.1.10:3000`.
- The student submission page, moderator dashboard, and projector display are served by the local server.
- Socket.IO provides live updates without requiring an internet connection.
- The server listens on `0.0.0.0` so other devices on the local network can connect.
- The application must not depend on cloud databases, external APIs, CDNs, remotely hosted fonts, or internet-based authentication.
- Install Node.js and project dependencies before presentation day.
- All frontend assets and libraries must be available locally.
- Questions are stored in memory and disappear when the server restarts or the session is cleared.
- Students do not need accounts or to provide their names.
- Moderator actions must be authorized and validated by the server.
- Only approved questions may appear on the projector display.
- Profanity filtering must not block legitimate educational discussion about sexual health, consent, puberty, reproductive anatomy, or personal boundaries.

## Execution Rules

1. Complete only the numbered task explicitly requested by the user.
2. Do not automatically proceed to the next numbered task.
3. Each task must produce a concrete result that can be checked.
4. Keep the implementation simple and suitable for AI-assisted development.
5. Do not add features outside this plan without asking first.
6. Test each important feature before marking its task complete.
7. Never mark a task complete unless the implementation has actually been completed and verified.

---

## Phase 1 — Project Setup

- [x] **1.1** Create the project folder and initial directory structure.
- [x] **1.2** Initialize the Node.js project using `npm init`.
- [x] **1.3** Install Express and Socket.IO as local project dependencies.
- [x] **1.4** Create the server entry point.
- [x] **1.5** Create the frontend entry files: HTML, CSS, and JavaScript.
- [x] **1.6** Create `.gitignore` for `node_modules`, local configuration, and unnecessary generated files.
- [x] **1.7** Initialize Git and create the initial project commit.
- [x] **1.8** Create `README.md` with the project purpose and development setup instructions.

## Phase 2 — Offline Server and Local Networking

- [x] **2.1** Create the Express HTTP server.
- [x] **2.2** Configure the server to listen on `0.0.0.0` using a configurable port with `3000` as the default.
- [x] **2.3** Serve all frontend pages and assets from the local server.
- [x] **2.4** Configure Socket.IO on the same HTTP server and port.
- [x] **2.5** Create a health-check endpoint to confirm that the server is running.
- [x] **2.6** Display or document the laptop's local network address and port for students.
- [x] **2.7** Handle invalid requests and server errors without crashing the application.
- [x] **2.8** Document how to allow the server through the laptop's firewall on a private network.
- [x] **2.9** Ensure all required frontend libraries, icons, fonts, and assets are stored locally.
- [x] **2.10** Verify that no runtime feature requires an external URL, cloud service, or internet connection.
- [x] **2.11** Document how to start and stop the server using npm scripts.

## Phase 3 — UI Foundation

- [x] **3.1** Define the application's colors, typography, spacing, and visual style.
- [x] **3.2** Create reusable buttons, input fields, cards, status labels, and feedback messages.
- [x] **3.3** Build a mobile-first layout for students using phones.
- [x] **3.4** Build the moderator dashboard layout for the presenter's laptop.
- [x] **3.5** Build a dedicated projector display layout.
- [x] **3.6** Make all pages responsive for mobile phones, laptops, and large displays.
- [x] **3.7** Ensure text remains readable and controls are usable on small screens.
- [x] **3.8** Verify that styling and assets load without internet access.

## Phase 4 — Session and Room Management

- [x] **4.1** Define the session data model and question data model.
- [x] **4.2** Create server-side session management.
- [x] **4.3** Generate a short room code for students to identify the active session.
- [x] **4.4** Validate room codes on the server.
- [x] **4.5** Implement the session states: `Open`, `Paused`, and `Closed`.
- [x] **4.6** Allow the authorized presenter to control the session state.
- [x] **4.7** Reject new submissions when the session is paused or closed.
- [x] **4.8** Show the active room code and session status to students.
- [x] **4.9** Ensure only one active presentation session is supported in the initial version.

## Phase 5 — Anonymous Question Submission

- [ ] **5.1** Create the student join page.
- [ ] **5.2** Create the anonymous question submission form.
- [ ] **5.3** Validate empty submissions and maximum question length on the client.
- [ ] **5.4** Repeat all essential validation on the server.
- [ ] **5.5** Assign each question a unique server-generated ID.
- [ ] **5.6** Place accepted submissions into the pending moderation queue.
- [ ] **5.7** Show a confirmation only after the server accepts the submission.
- [ ] **5.8** Show clear messages for invalid room codes, paused sessions, and rejected questions.
- [ ] **5.9** Add basic duplicate-submission and rate-limit protection.
- [ ] **5.10** Avoid requesting names, email addresses, or student accounts.
- [ ] **5.11** Ensure student clients cannot approve, reject, or directly change question status.

## Phase 6 — Prohibited-Word Filtering and Content Safety

- [ ] **6.1** Create a configurable local blocklist for profanity, slurs, harassment, and abusive terms.
- [ ] **6.2** Implement case-insensitive matching for blocked words and phrases.
- [ ] **6.3** Normalize text to detect common character substitutions and simple filter evasion.
- [ ] **6.4** Apply filtering on the server before a question enters the pending queue.
- [ ] **6.5** Return a clear rejection message without exposing internal filter rules.
- [ ] **6.6** Keep the blocklist and filtering logic available locally without external APIs.
- [ ] **6.7** Permit legitimate educational discussion about sexual health, consent, puberty, reproductive anatomy, and personal boundaries.
- [ ] **6.8** Avoid relying on isolated keywords alone when they could block legitimate educational questions.
- [ ] **6.9** Test both prohibited content and legitimate educational questions to reduce false positives.
- [ ] **6.10** Render all student-submitted text safely and prevent cross-site scripting (XSS).
- [ ] **6.11** Add automated tests for filtering, normalization, and safe rendering.

## Phase 7 — Real-Time Communication

- [ ] **7.1** Configure Socket.IO for local real-time communication.
- [ ] **7.2** Organize connections around the active session.
- [ ] **7.3** Broadcast pending-question updates only to authorized moderator clients.
- [ ] **7.4** Broadcast approved-question updates to the projector display.
- [ ] **7.5** Broadcast session status changes to connected clients.
- [ ] **7.6** Handle client disconnections and reconnections.
- [ ] **7.7** Synchronize a reconnecting client with the current server state.
- [ ] **7.8** Validate permissions for every sensitive socket event.
- [ ] **7.9** Ensure clients cannot make themselves moderators by sending crafted events.

## Phase 8 — Moderator Dashboard

- [ ] **8.1** Display pending questions in a moderation queue.
- [ ] **8.2** Implement moderator authorization using a server-validated secret or equivalent mechanism.
- [ ] **8.3** Keep moderator credentials out of public student-facing code and URLs.
- [ ] **8.4** Add an approve action for pending questions.
- [ ] **8.5** Add a reject action for pending questions.
- [ ] **8.6** Add an action to remove a previously approved question from the display.
- [ ] **8.7** Track question statuses: `Pending`, `Approved`, and `Rejected`.
- [ ] **8.8** Add controls to open, pause, and close submissions.
- [ ] **8.9** Show feedback after moderator actions.
- [ ] **8.10** Validate all moderation actions on the server, not only in the interface.
- [ ] **8.11** Prevent unauthorized clients from accessing pending questions or changing their status.

## Phase 9 — Projector Display

- [ ] **9.1** Create a dedicated presentation display page.
- [ ] **9.2** Show approved questions only.
- [ ] **9.3** Update the display immediately when a question is approved.
- [ ] **9.4** Remove questions immediately when the moderator removes them.
- [ ] **9.5** Use large, readable text and suitable spacing for projector viewing.
- [ ] **9.6** Create an empty state for sessions without approved questions.
- [ ] **9.7** Show whether the session is open, paused, or closed.
- [ ] **9.8** Recover the current approved-question list after a display reconnects.
- [ ] **9.9** Ensure pending and rejected questions never appear on the projector.
- [ ] **9.10** Add a presentation-friendly full-screen workflow.

## Phase 10 — Temporary Storage and Session Lifecycle

- [ ] **10.1** Store active session data in server memory.
- [ ] **10.2** Keep pending, approved, and rejected questions logically separate.
- [ ] **10.3** Centralize question-status changes in server-side functions.
- [ ] **10.4** Implement a reset or end-session action for the authorized presenter.
- [ ] **10.5** Clear session data when the server restarts.
- [ ] **10.6** Warn the presenter before clearing questions or ending a session.
- [ ] **10.7** Ensure session resets update connected clients and the projector display.
- [ ] **10.8** Document that this version does not retain question history after the session ends.

## Phase 11 — Loading, Errors, and Network Recovery

- [ ] **11.1** Add loading and submitting states to the student form.
- [ ] **11.2** Add clear empty states for the queue and projector display.
- [ ] **11.3** Show a connection-lost message when the server becomes unreachable.
- [ ] **11.4** Implement Socket.IO reconnection handling.
- [ ] **11.5** Refresh client state from the server after reconnection.
- [ ] **11.6** Prevent accidental duplicate submissions when a response is delayed or lost.
- [ ] **11.7** Preserve unsent question text in the browser where practical.
- [ ] **11.8** Explain that a question is not submitted until the server confirms acceptance.
- [ ] **11.9** Provide recovery instructions if the laptop server or local Wi-Fi fails.

## Phase 12 — Security and Testing

- [ ] **12.1** Test submissions from multiple phones connected to the same local Wi-Fi.
- [ ] **12.2** Test the entire application with internet access disabled.
- [ ] **12.3** Confirm the application loads without external network requests.
- [ ] **12.4** Confirm that only approved questions appear on the projector.
- [ ] **12.5** Test moderator authorization against direct HTTP requests and socket events.
- [ ] **12.6** Test prohibited-word filtering and educational false positives.
- [ ] **12.7** Test XSS payloads and ensure user-submitted text is rendered safely.
- [ ] **12.8** Test oversized submissions, invalid room codes, and repeated requests.
- [ ] **12.9** Test disconnects, reconnections, and session-state synchronization.
- [ ] **12.10** Test session reset and server restart behavior.
- [ ] **12.11** Verify that no cloud database, external API, or internet-hosted asset is required at runtime.
- [ ] **12.12** Verify that students cannot access moderator-only functions.
- [ ] **12.13** Document the privacy limitations of anonymous submissions on a local network.
- [ ] **12.14** Confirm that the chosen Wi-Fi router or hotspot permits communication between connected devices.

## Phase 13 — Presentation Readiness

- [ ] **13.1** Finalize the command for starting the local server.
- [ ] **13.2** Document how to find the presenter's laptop IPv4 address.
- [ ] **13.3** Document how to connect the laptop and phones to the same local Wi-Fi.
- [ ] **13.4** Document how students open the app using the laptop's LAN address.
- [ ] **13.5** Document how the presenter opens the moderator dashboard.
- [ ] **13.6** Document how to open the projector display and enter full-screen mode.
- [ ] **13.7** Create a pre-presentation offline checklist.
- [ ] **13.8** Test the complete workflow with several phones and the projector.
- [ ] **13.9** Test with internet disconnected before the actual presentation.
- [ ] **13.10** Prepare recovery instructions for server failure, firewall problems, and Wi-Fi issues.
- [ ] **13.11** Finalize the README with setup, startup, networking, moderation, limitations, and troubleshooting instructions.

---

## Explicitly Out of Scope for Version 1

Do not implement these unless the user requests a scope change:

- Cloud hosting or remote access over the internet
- Supabase, Firebase, or other cloud databases
- Persistent question history
- Student accounts or identity tracking
- Voting, polls, quizzes, or word clouds
- Image and file uploads
- AI-based moderation
- Advanced multi-presenter permissions
- Background synchronization
- Multiple simultaneous presentation sessions
- External APIs or third-party services required at runtime

## Completion Criteria

The project is ready when:

1. The server runs on the presenter's laptop.
2. Student phones connect through local Wi-Fi without internet access.
3. Students can submit questions without providing their names.
4. The server filters and validates submissions.
5. The presenter can approve or reject questions.
6. Only approved questions appear live on the projector.
7. Unauthorized clients cannot perform moderator actions.
8. Disconnects and reconnections are handled safely.
9. The full workflow passes a test with internet disabled.
10. The README explains how to set up and run the app offline.

**Current status:** Phase 1, Phase 2, Phase 3, and Phase 4 (Tasks 4.1–4.9) fully implemented and verified.

**Next task:** **5.1 — Create the student join page.**