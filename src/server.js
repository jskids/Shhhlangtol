const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { getLocalIPv4Addresses } = require('./utils/network');

const app = express();

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Socket.IO is attached directly to the existing HTTP server instance so that both
// standard HTTP page requests and real-time WebSocket connections share the same
// single TCP port (default 3000). This avoids opening extra ports or relying on internet services.
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Resolve public folder using __dirname for reliable path resolution
const publicDir = path.join(__dirname, '../public');

// Health-check endpoint for server status confirmation (Task 2.5)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'offline-qa' });
});

// Dedicated page routes
app.get(['/', '/student', '/student/'], (req, res) => {
  res.sendFile(path.join(publicDir, 'student', 'index.html'));
});

app.get(['/moderator', '/moderator/'], (req, res) => {
  res.sendFile(path.join(publicDir, 'moderator', 'index.html'));
});

app.get(['/display', '/display/'], (req, res) => {
  res.sendFile(path.join(publicDir, 'display', 'index.html'));
});

// Serve static assets (CSS, JS, assets) safely from public directory
app.use(express.static(publicDir));

// Socket.IO connection event logging
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start HTTP server listening on 0.0.0.0
server.listen(PORT, HOST, () => {
  const ipAddresses = getLocalIPv4Addresses();

  console.log(`=======================================================`);
  console.log(` Offline Anonymous Q&A Server Running`);
  console.log(` Host: ${HOST} (Binds to all local network interfaces)`);
  console.log(` Port: ${PORT}`);
  console.log(` Note: 0.0.0.0 allows devices on your local Wi-Fi to connect.`);
  console.log(` (Do not type 0.0.0.0 in student browsers)`);
  console.log(`-------------------------------------------------------`);
  console.log(` Presenter Local Access:`);
  console.log(`   Student Page    : http://localhost:${PORT}/student`);
  console.log(`   Moderator Page  : http://localhost:${PORT}/moderator`);
  console.log(`   Projector Page  : http://localhost:${PORT}/display`);
  console.log(`   Health Check    : http://localhost:${PORT}/health`);
  console.log(`-------------------------------------------------------`);
  console.log(` Student Wi-Fi / Hotspot Access (use laptop LAN IPv4):`);

  if (ipAddresses.length > 0) {
    ipAddresses.forEach((item) => {
      console.log(`   [${item.interfaceName}] http://${item.address}:${PORT}/student`);
    });
  } else {
    console.log(`   No active non-internal IPv4 interface detected.`);
    console.log(`   Run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux) to find LAN IP.`);
  }

  console.log(`=======================================================`);
});

server.on('error', (err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});

module.exports = { app, server, io };
