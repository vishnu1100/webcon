const socket = io();
let localStream;
let peers = {};
let userMapping = {};
let currentRoom = '';
let micEnabled = true;
let cameraEnabled = true;

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
