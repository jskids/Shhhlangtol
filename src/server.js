const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Resolve public folder using __dirname for reliable path resolution
const publicDir = path.join(__dirname, '../public');

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
  console.log(`=======================================================`);
  console.log(` Offline Anonymous Q&A Server Running`);
  console.log(` Host: ${HOST} (Binds to all local network interfaces)`);
  console.log(` Port: ${PORT}`);
  console.log(` Note: 0.0.0.0 allows other devices on the Wi-Fi to reach the app.`);
  console.log(` (Do not type 0.0.0.0 in browser; use laptop IPv4 address)`);
  console.log(` Student Page    : http://localhost:${PORT}/student`);
  console.log(` Moderator Page  : http://localhost:${PORT}/moderator`);
  console.log(` Projector Page  : http://localhost:${PORT}/display`);
  console.log(` Network Access  : http://<your-laptop-ip>:${PORT}/student`);
  console.log(`=======================================================`);
});

server.on('error', (err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});

module.exports = { app, server, io };
