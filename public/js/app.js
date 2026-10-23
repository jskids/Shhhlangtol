// Client entry script
document.addEventListener('DOMContentLoaded', () => {
  console.log('Offline Q&A App initialized.');
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('connect', () => {
      console.log('Connected to server via Socket.IO:', socket.id);
    });
  }
});
