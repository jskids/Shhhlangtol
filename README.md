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

## Current Status & Limitations

- **Initialization Phase:** Current state covers Tasks 1.1–1.8 (Project setup, server entry point, and frontend entry files).
- **Work in Progress:** Real-time question submission, moderation actions, and display workflows are under active development and not yet functional.
- **Temporary In-Memory Storage:** Questions will be held in server memory only during runtime once implemented. Re-starting the server resets all temporary session data.
