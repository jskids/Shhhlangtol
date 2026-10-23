# Offline Anonymous Live Q&A

An offline-first anonymous live Q&A web application designed for school presentations. Similar to Slido, it allows students to submit questions anonymously from their mobile devices over a local Wi-Fi network without requiring internet access.

## Project Purpose & Goals

- **Anonymous Student Questions:** Students submit questions via their mobile browser.
- **Moderator Control:** Presenter approves or rejects questions through a moderator dashboard.
- **Projector Display:** Approved questions are displayed live on a projector screen.
- **100% Offline Capability:** Operates completely offline during presentations using a local Wi-Fi router or mobile hotspot.
- **In-Memory Storage:** Questions are stored temporarily in server memory during the presentation session.

## Technology Stack

- **Backend:** Node.js, Express
- **Real-Time Communication:** Socket.IO
- **Frontend:** HTML5, CSS3, Plain JavaScript (No external frameworks or CDNs required)

## Project Directory Structure

```text
offline-qa/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   ├── assets/
│   ├── student/
│   │   └── index.html
│   ├── moderator/
│   │   └── index.html
│   └── display/
│       └── index.html
├── src/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── sockets/
│   ├── utils/
│   └── server.js
├── tests/
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── TASKS.md
```

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- A shared local Wi-Fi network (or laptop Wi-Fi hotspot) allowing client-to-client communication.

## Installation & Setup

1. Clone or download this project repository.
2. Install local project dependencies:

```bash
npm install
```

## Starting the Server

Start the local server using npm:

```bash
npm start
```

By default, the server binds to `0.0.0.0:3000`.

## Accessing the Application

### Local Access (Presenter's Laptop)
- **Student View:** [http://localhost:3000/student](http://localhost:3000/student)
- **Moderator Dashboard:** [http://localhost:3000/moderator](http://localhost:3000/moderator)
- **Projector Display:** [http://localhost:3000/display](http://localhost:3000/display)

### Network Access (Student Phones & Devices)
1. Ensure student devices are connected to the same local Wi-Fi network as the presenter's laptop.
2. Find the presenter's local IPv4 address (e.g., `192.168.1.50`).
3. Have students open their mobile browser to:
   `http://<presenter-ip>:3000/student`

## Local Network Access & Windows Firewall Setup

### 1. Connecting Devices on the Same Network
- The presenter's laptop and student mobile devices must be connected to the **same local Wi-Fi network** or a mobile hotspot created by the laptop/presenter.
- **Important Note on Public Wi-Fi:** Public or school guest Wi-Fi networks often enable **AP Isolation (Client Isolation)**, which blocks connected devices from communicating directly with each other. If using a school network that restricts device-to-device connections, use a dedicated travel router or set up a local Wi-Fi hotspot on the presenter's phone or laptop.

### 2. Distinguishing `localhost` vs. Local LAN IPv4
- **`localhost` (`http://localhost:3000`)**: Accessible **only** on the presenter's laptop. Students cannot open `localhost` from their phones.
- **LAN IPv4 Address (`http://<laptop-lan-ip>:3000/student`)**: The actual private IP address assigned to the laptop on your local network (e.g., `http://192.168.1.50:3000/student`). This is the address students must type into their mobile web browsers.
- The server listens on `0.0.0.0`, which binds to all network interfaces on the laptop so incoming student phone connections are accepted.

### 3. Finding Your Laptop's Private IPv4 Address
1. Open Command Prompt on Windows (`cmd.exe`).
2. Type `ipconfig` and press Enter.
3. Look for your active Wi-Fi or Ethernet adapter line named **IPv4 Address** (e.g., `192.168.1.50`).
4. Alternatively, launch the app with `npm start` — the startup log automatically lists detected local IPv4 addresses.

### 4. Windows Firewall Configuration
To allow student phones to connect to port `3000`, configure Windows Defender Firewall safely without disabling it:

1. **Verify Private Network Profile:**
   - Go to **Windows Settings > Network & Internet > Wi-Fi**.
   - Select your connected network and set **Network profile type** to **Private**.
   - Always follow your school or organization IT policies regarding network profiles.

2. **Allow Node.js Through Windows Defender Firewall:**
   - Open Windows Search, type **"Allow an app through Windows Firewall"**, and open it.
   - Click **Change settings** (requires administrator privileges).
   - Locate **Node.js JavaScript Runtime** (or `node.exe`).
   - Ensure the checkbox for **Private** networks is checked.
   - Click **OK**.

3. **Alternative — Create Inbound Port Rule for Port 3000:**
   - Open **Windows Defender Firewall with Advanced Security** (`wf.msc`).
   - Click **Inbound Rules** > **New Rule...**.
   - Select **Port** > Next. Choose **TCP** and specify **Specific local ports: 3000** > Next.
   - Select **Allow the connection** > Next.
   - Check **Private** (and Domain if permitted by IT policy) > Next.
   - Name the rule `Offline Q&A Server (Port 3000)` and click **Finish**.

> **Security Note:** Never turn off Windows Firewall completely. Creating a targeted rule or allowing Node.js on Private networks keeps your laptop protected while permitting local presentation traffic.

## Current Status & Limitations

- **Phase 1 & Phase 2 Setup Complete:** Setup, Express HTTP server, Socket.IO network attachment, static routes, 404/500 error handlers, and health check ([`http://localhost:3000/health`](http://localhost:3000/health)) are fully implemented.
- **Work in Progress:** Interactive question submission forms, moderation queues, profanity filtering, and live projector synchronization are planned for upcoming phases.
- **Temporary In-Memory Storage:** Questions will be held in server memory only during runtime once implemented. Re-starting the server resets all temporary session data.
