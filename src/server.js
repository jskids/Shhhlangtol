const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const publicDir = path.join(__dirname, '../public');

// Route handlers for direct access
app.get(['/', '/student'], (req, res) => {
  res.sendFile(path.join(publicDir, 'student', 'index.html'));
});

app.get('/moderator', (req, res) => {
  res.sendFile(path.join(publicDir, 'moderator', 'index.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(publicDir, 'display', 'index.html'));
});

// Serve static assets from public folder
app.use(express.static(publicDir));

// Basic Socket.IO connection logger
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start HTTP server listening on 0.0.0.0
server.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(` Offline Anonymous Q&A Server Running`);
  console.log(` Local Access: http://localhost:${PORT}`);
  console.log(` Network Access: http://<your-laptop-ip>:${PORT}`);
  console.log(`========================================`);
});

server.on('error', (err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});

module.exports = { app, server, io };
