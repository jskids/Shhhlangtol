# QAlive — Setup, Presentation Workflow, and Recovery Guide

This guide provides step-by-step instructions for installing, configuring, running, and troubleshooting **QAlive** during live offline presentations.

---

## Table of Contents

1. [Prerequisites & Initial Installation](#1-prerequisites--initial-installation)
2. [Local Server Startup & Shutdown](#2-local-server-startup--shutdown)
3. [Finding the Laptop's IPv4 Address](#3-finding-the-laptops-ipv4-address)
4. [Same-Network Setup & Firewall Configuration](#4-same-network-setup--firewall-configuration)
5. [Student Access Instructions](#5-student-access-instructions)
6. [Presenter & Moderator Workflow](#6-presenter--moderator-workflow)
7. [Projector Display & Full-Screen Workflow](#7-projector-display--full-screen-workflow)
8. [Pre-Presentation Checklist](#8-pre-presentation-checklist)
9. [Offline Operation Procedure](#9-offline-operation-procedure)
10. [Troubleshooting & Recovery Procedures](#10-troubleshooting--recovery-procedures)

---

## 1. Prerequisites & Initial Installation

Before presentation day (while internet access is still available):

1. **Install Node.js:** Download and install Node.js (v18.0.0 or higher) on the presenter's laptop.
2. **Install Project Dependencies:** Open a command terminal in the project root directory (`REPORTING`) and execute:

   ```bash
   npm install
   ```

   > **Crucial Rule:** Do **NOT** run `npm install` on presentation day if internet access is unavailable. All required packages (`express`, `socket.io`) must be installed beforehand into `node_modules`.

---

## 2. Local Server Startup & Shutdown

### Startup Command
From the project root directory (`REPORTING`), start the local server:

```bash
npm start
```

Alternatively, you can run:

```bash
node src/server.js
```

### Verifying Successful Startup
When the server starts successfully, the console output will display:

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

### Critical Operational Rules
- **Keep Terminal Open:** The terminal window running the server process MUST remain open throughout the entire presentation session. Closing the terminal or shutting down the process stops the server.
- **Stopping the Server:** Press `Ctrl + C` in the terminal to stop the server process.
- **In-Memory Volatility Warning:** QAlive stores all active session metadata, room codes, and submitted questions strictly in volatile server process RAM. Stopping or restarting the server permanently clears all session data.

---

## 3. Finding the Laptop's IPv4 Address

To allow student phones to connect, you must identify the presenter laptop's local IPv4 address on the Wi-Fi or hotspot network.

### Steps for Windows (Command Prompt)
1. Open Command Prompt (`cmd.exe`).
2. Run the command:
   ```bash
   ipconfig
   ```
3. Locate the section corresponding to your active network adapter (e.g., **Wireless LAN adapter Wi-Fi** or **Ethernet adapter Wi-Fi**).
4. Find the **IPv4 Address** line (e.g., `192.168.1.25`).

### Avoiding Unrelated IP Addresses
- Ignore virtual network adapters such as `vEthernet (Default Switch)`, `VirtualBox Host-Only Network`, `VMware Network Adapter`, or loopback adapters.
- Use only the IPv4 address assigned by the local Wi-Fi router or mobile hotspot that student phones are connected to.

### Address Clarification & Distinction
- **`0.0.0.0`**: The server's internal binding address telling Node.js to accept traffic on all network interfaces. **Students must never enter `0.0.0.0` into their browsers.**
- **`localhost` or `127.0.0.1`**: Refers exclusively to the current device running the browser. This works **only** on the presenter's laptop.
- **Laptop LAN IPv4 Address (e.g. `192.168.1.25`)**: The private address assigned to the laptop on the local network. **This is the IP address student phones must enter to reach the server.**

---

## 4. Same-Network Setup & Firewall Configuration

### Connecting Devices
1. Ensure the presenter's laptop and all student phones are connected to the **same local Wi-Fi router** or **local mobile hotspot** hosted by the presenter.
2. An active internet connection is **not required**. Local network device-to-device routing is sufficient.

### Windows Firewall Setup
To prevent Windows Firewall from blocking incoming connections on port `3000`:
1. Open **Windows Settings** > **Network & Internet** > **Wi-Fi**.
2. Set your Wi-Fi network profile to **Private**.
3. Search Windows for "Allow an app through Windows Firewall".
4. Click **Change settings**, locate **Node.js JavaScript Runtime**, and verify the checkbox for **Private** networks is checked.
5. If necessary, create an Inbound Rule in Windows Defender Firewall (`wf.msc`) permitting TCP traffic on port `3000` for Private networks.

### School Network & Hotspot Considerations
- **AP Isolation (Client Isolation):** School, public, or enterprise guest Wi-Fi networks frequently restrict device-to-device communication. If AP isolation is active, student phones cannot reach the presenter's laptop.
- **Hotspot Fallback:** If the local Wi-Fi network blocks peer-to-peer traffic, host a local Wi-Fi hotspot from the presenter's laptop or a smartphone, and connect student phones to that hotspot.

---

## 5. Student Access Instructions

1. Verify student phones are connected to the same local Wi-Fi or hotspot as the presenter's laptop.
2. Instruct students to open their mobile Web browser (Safari, Chrome, Firefox, Edge).
3. Direct students to type the complete URL using the laptop's LAN IPv4 address and port `3000`:

   ```text
   http://<LAPTOP-LAN-IP>:3000/student
   ```
   *(Example: `http://192.168.1.25:3000/student`)*

4. **Important Notice for Students:**
   - Students must **never** type `localhost` or `127.0.0.1`.
   - No student account creation, name, or email input is required.
   - Questions are submitted anonymously to the moderation queue.

---

## 6. Presenter & Moderator Workflow

### Step-by-Step Moderation Guide
1. **Launch Server:** Start the server using `npm start` in the terminal.
2. **Open Dashboard:** On the presenter's laptop, open a Web browser and navigate to:
   ```text
   http://localhost:3000/moderator
   ```
3. **Session Secret Authentication:**
   - The server automatically creates a default active session upon startup and prints the **Presenter Secret Token** and **Room Code** in the terminal log.
   - Enter the **Presenter Secret Token** in the moderator dashboard authorization prompt to unlock moderation controls.
4. **Manage Submissions:**
   - Click **Open Submissions** to allow student questions.
   - Click **Pause Submissions** to temporarily block new submissions while reviewing current ones.
5. **Review & Action Questions:**
   - **Pending Queue:** Incoming questions appear in real time in the Pending queue.
   - **Approve:** Clicking **Approve** moves the question to approved status and broadcasts it instantly to the projector display.
   - **Reject:** Clicking **Reject** removes the question from the pending queue. Rejected questions **never** appear on the display.
   - **Remove from Display:** Presenters can toggle display visibility (`Remove from Display`) for approved questions without deleting moderation records.
6. **Reset / Clear Session:** Presenters can reset the session questions via the dashboard button. A confirmation prompt will warn that resetting permanently clears all stored questions.

---

## 7. Projector Display & Full-Screen Workflow

1. **Connect Projector:** Connect the presenter's laptop to the projector or external screen (e.g. HDMI or wireless display).
2. **Display Mode:** Press `Win + P` on Windows and select **Extend** mode so the projector functions as a second display monitor.
3. **Open Display Page:** In a browser window on the laptop, navigate to:
   ```text
   http://localhost:3000/display
   ```
4. **Move to Projector Screen:** Drag the display browser window onto the projector display.
5. **Full-Screen Mode:**
   - Press `F11` (Windows shortcut) or press the `F` key or click the **Full Screen** toggle button on the display page header.
6. **Live Feed Verification:**
   - Verify that the active Room Code badge and Session Status banner (`Open`, `Paused`, `Closed`) are visible.
   - As questions are approved on the moderator dashboard, confirm they appear live in the Word Cloud presentation layout.
   - Confirm that pending or rejected questions do not appear on the display screen.

---

## 8. Pre-Presentation Checklist

Complete this verification checklist prior to starting the presentation:

- [ ] Dependencies are available (`node_modules` present, installed beforehand).
- [ ] The server starts successfully using `npm start`.
- [ ] The current laptop LAN IPv4 address is identified via `ipconfig`.
- [ ] The laptop and test phones are connected to the same local Wi-Fi or hotspot network.
- [ ] A student phone can open the student page (`http://<LAPTOP-LAN-IP>:3000/student`).
- [ ] The moderator dashboard works (`http://localhost:3000/moderator`) with valid presenter secret.
- [ ] The projector display page loads cleanly (`http://localhost:3000/display`).
- [ ] A test question can be submitted from a phone and arrives in the moderator pending queue.
- [ ] Approved questions appear immediately on the projector display Word Cloud.
- [ ] Rejected questions do not appear on the projector display.
- [ ] Pause/resume submission state behavior works as expected.
- [ ] Client reconnection behavior has been checked after toggling airplane mode.
- [ ] Offline operation has been verified with internet access disabled on the router/hotspot.
- [ ] Recovery instructions in `SETUP.md` are accessible.
- [ ] Test questions are cleared or the session is reset before the presentation begins.

---

## 9. Offline Operation Procedure

1. **No External Dependencies:** QAlive requires zero internet connectivity at runtime. All static assets, CSS, and Socket.IO scripts are served locally.
2. **Disabling Internet Safely:**
   - If using a router, you may disconnect the WAN / modem uplink cable.
   - If using a smartphone hotspot, you may disable cellular mobile data on the phone while leaving the Wi-Fi hotspot active.
3. **CAUTION:** Do **NOT** disable Wi-Fi entirely on the laptop or phones, as local Wi-Fi communication is required for devices to reach the local server.

---

## 10. Troubleshooting & Recovery Procedures

### 10.1 Server Failure Recovery
- **Symptoms:** Student devices show "Unable to reach server" banners; live updates stop.
- **Procedure:**
  1. Inspect the terminal on the presenter laptop to see if an error or crash occurred.
  2. Check for port conflicts (`EADDRINUSE`). If port 3000 is occupied, set a custom port:
     - Windows CMD: `set PORT=3005 && npm start`
     - PowerShell: `$env:PORT="3005"; npm start`
  3. Restart the server with `npm start`.
  4. **Data Loss Warning:** Restarting the server clears in-memory session data and generates a new Presenter Secret Token and Room Code. Update student devices with the new room code and re-authenticate the moderator dashboard.

### 10.2 Firewall Problems
- **Symptoms:** Laptop can access `localhost:3000`, but student phones time out connecting to `<LAPTOP-LAN-IP>:3000`.
- **Procedure:**
  1. Verify the network profile is set to **Private** in Windows Settings.
  2. Ensure Node.js is allowed through Windows Defender Firewall for Private networks.
  3. **DO NOT** disable Windows Firewall completely. Ensure school IT policies are respected.

### 10.3 Wi-Fi & Hotspot Connectivity Problems
- **Symptoms:** Student phones cannot resolve the IP address or lose connection.
- **Procedure:**
  1. Run `ipconfig` on the laptop to recheck the IPv4 address (IP addresses can change if reconnecting to Wi-Fi).
  2. Verify student phones are on the exact same Wi-Fi SSID or hotspot.
  3. Check if the router has **Client Isolation (AP Isolation)** enabled. If so, switch to a mobile hotspot hosted on the presenter's laptop or phone.
  4. If the laptop IP changes, instruct students to update their browser URL to the new LAN IP.

### 10.4 Projector & Real-Time Update Problems
- **Symptoms:** Display screen is blank or does not update when questions are approved.
- **Procedure:**
  1. Check `http://localhost:3000/health` on the laptop to ensure the server is healthy.
  2. Confirm on the moderator dashboard that the question status is set to **Approved**.
  3. Press `F5` or Reload on the display page browser window. The display page will automatically fetch the latest server-authoritative approved questions snapshot.
  4. Note that reloading the page cannot restore questions lost due to a server process restart.
