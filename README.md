# QAlive — Offline Anonymous Live Q&A

QAlive is an offline-first, anonymous live Q&A web application designed for school presentations. Similar to Slido, it enables students to submit questions anonymously from their mobile phones over a shared local Wi-Fi network or hotspot without requiring an internet connection. The presenter moderates incoming questions from a dashboard, and approved questions appear live on a dedicated projector screen in a Word Cloud presentation format.

For step-by-step presentation day guides, network configuration, and offline checklists, see [`SETUP.md`](SETUP.md).

---

## Table of Contents

1. [Project Overview & Key Goals](#project-overview--key-goals)
2. [Features & System Limitations](#features--system-limitations)
3. [Fixed Technology Stack](#fixed-technology-stack)
4. [Requirements & Initial Setup](#requirements--initial-setup)
5. [Verified Server Startup & Shutdown Commands](#verified-server-startup--shutdown-commands)
6. [Network & IPv4 Address Setup](#network--ipv4-address-setup)
7. [Student Access Instructions](#student-access-instructions)
8. [Presenter & Moderator Workflow](#presenter--moderator-workflow)
9. [Projector Display & Full-Screen Workflow](#projector-display--full-screen-workflow)
10. [Pre-Presentation Checklist](#pre-presentation-checklist)
11. [Offline Operation](#offline-operation)
12. [Privacy & Anonymity Limitations](#privacy--anonymity-limitations)
13. [Session Reset & In-Memory Data Retention Behavior](#session-reset--in-memory-data-retention-behavior)
14. [Presentation Day Troubleshooting & Network Recovery Guide](#presentation-day-troubleshooting--network-recovery-guide)
15. [How to Run Existing Tests](#how-to-run-existing-tests)
16. [Project Directory Structure](#project-directory-structure)

---

## Project Overview & Key Goals

- **100% Offline Capability:** Operates entirely without internet access at runtime. All frontend libraries, CSS, and Socket.IO scripts are served locally from the presenter's laptop.
- **Anonymous Question Submission:** Students ask questions via mobile web browsers without creating accounts, providing names, or sharing emails.
- **Presenter Moderation:** The presenter reviews submissions from a moderator dashboard before questions appear live.
- **Live Projector Display:** Approved questions render immediately on a presentation screen for the audience in a weighted Word Cloud layout.
- **Ephemeral In-Memory Storage:** Questions and sessions reside in server memory only during runtime and reset when the server restarts or a session closes.

---

## Features & System Limitations

### Key Features
- **Mobile-First Student UI:** Responsive submission form with character counter (300 cap) and client-side draft auto-recovery.
- **Server-Side Content Filtering:** Case-insensitive blocklist with leetspeak and spacer evasion handling, while preserving legitimate educational health and boundary discussions.
- **Authorized Moderation:** Secret token protection for presenter actions (`Open`, `Pause`, `Close` session; `Approve`, `Reject`, `Remove from Display`).
- **Real-Time WebSockets:** Local Socket.IO event broadcasting for instant display updates and connection status banners.

### System Limitations
- **Single Active Session:** Supports one active presentation room at a time on default port `3000`.
- **Ephemeral Storage:** No database or disk persistence. All data is purged on server restart.
- **Local Network Scope:** Operating range is limited to the coverage area of the local Wi-Fi router or hotspot.

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

## Requirements & Initial Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation (Before Presentation Day)
Run this command while internet access is available to install dependencies locally into `node_modules`:

```bash
npm install
```

> **Note:** Never run `npm install` on presentation day when offline. All dependencies must be pre-installed.

---

## Verified Server Startup & Shutdown Commands

### Server Startup Command
Launch the server from the project root directory (`REPORTING`):

```bash
npm start
```

This executes `node src/server.js`, starting Express and Socket.IO bound to `0.0.0.0:3000`.

### Recognizing Successful Startup
Look for the following log output in the terminal:

```text
=======================================================
 Offline Anonymous Q&A Server Running
 Host: 0.0.0.0 (Binds to all local network interfaces)
 Port: 3000
 Active Presentation Room Code: <ROOM_CODE>
 Presenter Secret Token       : <PRESENTER_SECRET>
 Note: 0.0.0.0 allows devices on your local Wi-Fi to connect.
 (Do not type 0.0.0.0 in student browsers)
-------------------------------------------------------
 Presenter Local Access:
   Student Page    : http://localhost:3000/student
   Moderator Page  : http://localhost:3000/moderator
   Projector Page  : http://localhost:3000/display
   Health Check    : http://localhost:3000/health
-------------------------------------------------------
 Student Wi-Fi / Hotspot Access (use laptop LAN IPv4):
   [Wi-Fi] http://192.168.1.25:3000/student
=======================================================
```

### Stopping the Server
- Press `Ctrl + C` in the server terminal window.
- The server terminal MUST remain open during the presentation.

---

## Network & IPv4 Address Setup

1. Open Command Prompt on Windows (`cmd.exe`) and execute:
   ```bash
   ipconfig
   ```
2. Locate the active Wi-Fi or Ethernet adapter and copy the **IPv4 Address** (e.g. `192.168.1.25`).
3. **Address Distinctions:**
   - `0.0.0.0`: The server bind host address. **Not for student browsers.**
   - `localhost` / `127.0.0.1`: Local loopback address for the presenter's laptop only.
   - **Laptop LAN IPv4 (`192.168.1.25`)**: The local network address student phones use to connect to the server.

For detailed firewall configuration and router client isolation troubleshooting, see [`SETUP.md`](SETUP.md#4-same-network-setup--firewall-configuration).

---

## Student Access Instructions

1. Ensure student phones are connected to the same local Wi-Fi network or hotspot as the presenter's laptop.
2. Direct students to type the laptop's LAN IPv4 address into their mobile web browser:

   ```text
   http://<LAPTOP-LAN-IP>:3000/student
   ```
   *(Example: `http://192.168.1.25:3000/student`)*

3. Students enter the active 6-character room code shown on the screen and submit questions anonymously.

---

## Presenter & Moderator Workflow

1. Start the server (`npm start`).
2. On the presenter's laptop, open:
   ```text
   http://localhost:3000/moderator
   ```
3. Enter the **Presenter Secret Token** logged in the server console output upon startup.
4. Manage submission states (`Open Submissions` / `Pause Submissions`).
5. Review pending questions in the moderation queue and click **Approve** or **Reject**.
6. Approved questions immediately stream live to the projector display.

---

## Projector Display & Full-Screen Workflow

1. Connect the laptop to the projector and select **Extend** display mode (`Win + P`).
2. Open the display page on the presenter's laptop:
   ```text
   http://localhost:3000/display
   ```
3. Drag the browser window to the projector screen.
4. Press `F11` (or click the **Full Screen** button) to enter presentation mode.
5. Approved questions appear as animated Word Cloud pills. Pending and rejected questions are strictly omitted.

---

## Pre-Presentation Checklist

A complete 15-point pre-presentation checklist is available in [`SETUP.md`](SETUP.md#8-pre-presentation-checklist). Highlights include:
- [ ] Dependencies pre-installed in `node_modules`.
- [ ] Laptop LAN IPv4 identified via `ipconfig`.
- [ ] Student phone verified connecting to `http://<LAPTOP-LAN-IP>:3000/student`.
- [ ] Test submission approved and verified on projector display.
- [ ] Test questions cleared or session reset before live presentation starts.

---

## Offline Operation

QAlive operates 100% offline. No external cloud APIs, remote databases, CDNs, or web fonts are loaded. All Socket.IO client scripts are served locally from `/socket.io/socket.io.js`.

To test offline operation, disconnect the router's WAN / internet uplink while keeping local Wi-Fi active. Do NOT disable Wi-Fi on the laptop or phones.

---

## Privacy & Anonymity Limitations

- **No Student Accounts:** Students submit questions without creating accounts, logging in, or providing names or emails.
- **Privacy Limitations:** While no personal identity fields are requested or stored by QAlive, technical metadata such as local IP addresses and HTTP user-agent headers are processed in volatile RAM by the Node.js server and local network hardware for network routing and rate-limiting. For this reason, QAlive provides anonymous question submission rather than guaranteed absolute network-level anonymity.

---

## Session Reset & In-Memory Data Retention Behavior

- **Ephemeral In-Memory Storage:** All active session metadata, room codes, and question submissions reside strictly in server volatile process memory (`Map` / `Array`).
- **No Persistent Storage or Database:** QAlive does not use a database (SQL, NoSQL, Supabase, Firebase) or local disk file persistence.
- **No Question Retention After Reset or End:** When a session is reset or closed, or when the server process is restarted/stopped, all questions and moderation history are permanently purged from memory and **cannot be restored, retrieved, or exported**.

---

## Presentation Day Troubleshooting & Network Recovery Guide

### 1. Laptop Server Failure Recovery
- **Symptoms:** Student devices show "Unable to reach server" banners.
- **Verification:** Check presenter terminal to confirm if the Node process is running. Open `http://localhost:3000/health`.
- **Restart:** Re-run `npm start` in the terminal.
- **Warning:** Restarting the server clears in-memory session data and generates a new Presenter Secret Token and Room Code. Re-authenticate the moderator dashboard and inform students of the new room code.

### 2. Local Wi-Fi or Hotspot Failure Recovery
- **Symptoms:** Student phones lose local network connection; IP address changes.
- **Procedure:** Run `ipconfig` to verify the laptop's IPv4 address. If the IP address changed, direct students to the new URL (`http://<NEW-LAN-IP>:3000/student`). Unsent student drafts are preserved in `sessionStorage` and can be re-submitted once connectivity returns.

For complete recovery steps covering firewalls and projector display updates, see [`SETUP.md`](SETUP.md#10-troubleshooting--recovery-procedures).

---

## How to Run Existing Tests

Execute the native Node.js automated unit and integration test suite:

```bash
node tests/verify.js
```

The test script validates server payload checking, length constraints, profanity filtering, educational health exceptions, XSS escaping, Socket.IO broadcasts, and state synchronization.

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
│   │   └── index.html            # Dark-mode projector live display view (Word Cloud)
│   ├── js/
│   │   └── app.js                # Student, Moderator & Display client JS
│   ├── moderator/
│   │   └── index.html            # Moderator dashboard layout
│   └── student/
│       └── index.html            # Mobile-first student question submission page
├── src/                          # Backend application source code
│   ├── middleware/
│   ├── models/
│   │   └── sessionModel.js       # Data structures, schemas, and status normalization
│   ├── routes/
│   │   └── sessionRoutes.js      # REST endpoints for active sessions & question posting
│   ├── services/
│   │   └── sessionService.js     # Singleton in-memory session and question management service
│   ├── sockets/
│   │   └── socketHandler.js      # Modular Socket.IO connection and room event handlers
│   ├── utils/
│   │   ├── blocklist.js          # Prohibited word dictionary & educational allowlists
│   │   ├── contentFilter.js      # Text normalization & educational exception pipeline
│   │   ├── network.js            # Utility detecting local non-internal IPv4 addresses
│   │   └── roomCode.js           # 6-character room code generator and validator
│   └── server.js                 # Express + Socket.IO HTTP server entry point
├── tests/
│   └── verify.js                 # Native Node.js unit and integration test suite
├── .gitignore                    # Prevents checking in node_modules and logs
├── package.json                  # Node scripts and dependencies
├── package-lock.json             # Dependency lockfile
├── SETUP.md                      # Detailed presentation day setup and troubleshooting guide
├── README.md                     # Main project overview and entry point
└── TASKS.MD                      # Master task tracking checklist (13 phases)
```
