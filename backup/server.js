// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public folder
app.use(express.static('public'));

// Socket.IO signaling logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create-room', (roomID) => {
    socket.join(roomID);
    socket.emit('room-created', roomID);
    socket.room = roomID;
  });

  socket.on('join-room', (roomID) => {
    socket.join(roomID);
    socket.room = roomID;
    const users = [...io.sockets.adapter.rooms.get(roomID) || []].filter(id => id !== socket.id);
    socket.emit('existing-users', users);
    socket.to(roomID).emit('user-joined', socket.id);
    socket.emit('room-joined', roomID);
  });

  socket.on('chat-message', ({ room, message }) => {
    socket.to(room).emit('chat-message', { sender: socket.id.slice(0, 4), message });
  });

  socket.on('signal', ({ signalData, targetID }) => {
    io.to(targetID).emit('signal', { signalData, sourceID: socket.id });
  });

  socket.on('cameraToggle', (data) => {
    socket.broadcast.emit('userCameraStatus', data);
  });

  socket.on('disconnect', () => {
    io.emit('user-left', socket.id);
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
