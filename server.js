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

  socket.on('create-room', ({ roomID, username }) => {
  socket.join(roomID);
  socket.username = username; // Store username on the socket
  socket.emit('room-created', roomID);
  socket.room = roomID;
});

  socket.on('join-room', ({ roomID, username }) => {
  socket.join(roomID);
  socket.username = username; // Store username on the socket
  socket.room = roomID;
  const users = [...io.sockets.adapter.rooms.get(roomID) || []]
    .filter(id => id !== socket.id)
    .map(id => ({ userID: id, username: io.sockets.sockets.get(id)?.username || 'Anonymous' })); // Get existing users with usernames
  socket.emit('existing-users', users);
  socket.to(roomID).emit('user-joined', { userID: socket.id, username: socket.username }); // Broadcast new user with username
  socket.emit('room-joined', roomID);
});

  socket.on('chat-message', ({ room, message }) => {
  socket.to(room).emit('chat-message', { sender: socket.username || socket.id.slice(0, 4), message }); // Use username or ID snippet
});

  socket.on('signal', ({ signalData, targetID }) => {
    io.to(targetID).emit('signal', { signalData, sourceID: socket.id });
  });

  socket.on('mic-state-change', ({ room, micEnabled }) => {
    socket.to(room).emit('mic-state-change', { userID: socket.id, micEnabled });
  });

  socket.on('camera-state-change', ({ room, cameraEnabled }) => {
    socket.to(room).emit('camera-state-change', { userID: socket.id, cameraEnabled });
  });

  socket.on('leave-room', (roomID) => {
    socket.to(roomID).emit('user-left', socket.id);
    socket.leave(roomID);
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
