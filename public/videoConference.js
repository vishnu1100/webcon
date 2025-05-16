const socket = io();
let localStream;
let peers = {};
let userMapping = {};
let currentRoom = '';
let micEnabled = true;
let cameraEnabled = true;

// Show/hide interfaces
function showConferenceInterface(show) {
  document.getElementById('landing-controls').style.display = show ? 'none' : 'flex';
  document.getElementById('conference-interface').style.display = show ? 'flex' : 'none';
}

// Chat functionality
function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (message) {
    socket.emit('chat-message', { room: currentRoom, message });
    addChatMessage('You', message);
    input.value = '';
  }
}

function addChatMessage(sender, message) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'bg-gray-700 rounded p-2';
  messageDiv.innerHTML = `
    <div class="font-semibold">${sender}</div>
    <div>${message}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Participant list management
function updateParticipantsList() {
  const list = document.getElementById('participants-list');
  list.innerHTML = '';
  
  // Add local user
  const localUser = document.createElement('div');
  localUser.className = 'flex items-center space-x-2';
  localUser.innerHTML = `
    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
    <div>You (Host)</div>
  `;
  list.appendChild(localUser);
  
  // Add remote users
  Object.keys(peers).forEach(userID => {
    const userDiv = document.createElement('div');
    userDiv.className = 'flex items-center space-x-2';
    userDiv.innerHTML = `
      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      <div>Participant ${userID.slice(0, 4)}</div>
    `;
    list.appendChild(userDiv);
  });
}

// Get media and show local video
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    displayVideo(localStream, 'You');
  } catch (err) {
    console.error('Error accessing camera/mic:', err);
    alert("Please allow camera and microphone access.");
  }
}

function displayVideo(stream, username, id = '') {
  const container = document.getElementById('video-container');
  const div = document.createElement('div');
  div.className = 'bg-gray-800 rounded-lg overflow-hidden shadow-lg p-2';
  div.id = `card-${id}`;
  div.innerHTML = `
    <video id="video-${id}" autoplay ${id === '' ? 'muted' : ''} class="rounded w-full"></video>
    <div class="text-center mt-2 text-sm">${username}</div>
  `;
  const video = div.querySelector('video');
  video.srcObject = stream;
  container.appendChild(div);
}

// Room handling
function createRoom() {
  const roomID = document.getElementById('roomInput').value.trim();
  if (roomID) {
    socket.emit('create-room', roomID);
  }
}
function joinRoom() {
  const roomID = document.getElementById('roomInput').value.trim();
  if (roomID) {
    socket.emit('join-room', roomID);
  }
}
function updateCurrentRoom(roomID) {
  currentRoom = roomID;
  document.getElementById('currentRoom').textContent = roomID;
  showConferenceInterface(roomID !== 'None');
  updateParticipantsList();
}
function leaveRoom() {
  // Cleanup peers
  Object.values(peers).forEach(peer => peer.destroy());
  peers = {};
  userMapping = {};

  // Remove all video cards except local
  const container = document.getElementById('video-container');
  container.innerHTML = '';
  displayVideo(localStream, 'You');

  socket.emit('leave-room', currentRoom);
  updateCurrentRoom('None');
}

// Media toggle
function toggleMic() {
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => (track.enabled = micEnabled));
}
function toggleCamera() {
  cameraEnabled = !cameraEnabled;
  localStream.getVideoTracks().forEach(track => (track.enabled = cameraEnabled));
}

// Socket listeners
socket.on('room-created', (roomID) => {
  updateCurrentRoom(roomID);
});
socket.on('room-joined', (roomID) => {
  updateCurrentRoom(roomID);
});
socket.on('user-joined', (userID) => {
  userMapping[userID] = userID;
  connectToPeer(userID, true);
  updateParticipantsList();
  addChatMessage('System', 'A new participant has joined the room');
});
socket.on('existing-users', (users) => {
  users.forEach(userID => connectToPeer(userID, false));
});
socket.on('signal', ({ signalData, sourceID }) => {
  if (peers[sourceID]) {
    peers[sourceID].signal(signalData);
  }
});
socket.on('user-left', (userID) => {
  if (peers[userID]) {
    peers[userID].destroy();
    delete peers[userID];
  }
  const div = document.getElementById(`card-${userID}`);
  if (div) div.remove();
  updateParticipantsList();
  addChatMessage('System', 'A participant has left the room');
});

// Chat message handler
socket.on('chat-message', ({ sender, message }) => {
  addChatMessage(sender, message);
});

// Peer connection
function connectToPeer(targetID, initiator = false) {
  const peer = new SimplePeer({
    initiator,
    trickle: false,
    stream: localStream
  });

  peer.on('signal', signalData => {
    socket.emit('signal', { signalData, targetID });
  });

  peer.on('stream', stream => {
    displayVideo(stream, targetID, targetID);
  });

  peers[targetID] = peer;
}

// Start local video
window.addEventListener("load", getMedia);
