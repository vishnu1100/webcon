const socket = io();
let localStream;
let peers = {};
let userMapping = {};

// Get media and show local video
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    displayVideo(localStream, 'You');
  } catch (err) {
    console.error('Error accessing camera/mic:', err);
  }
}

function displayVideo(stream, username, id = '') {
  const container = document.getElementById('video-container');
  const div = document.createElement('div');
  div.className = 'card';
  div.id = `card-${id}`;
  div.innerHTML = `
    <video id="video-${id}" autoplay ${id === '' ? 'muted' : ''}></video>
    <div>${username}</div>
  `;
  const video = div.querySelector('video');
  video.srcObject = stream;
  container.appendChild(div);
}

// Room handling
function createRoom() {
  const roomID = prompt("Room ID to create:");
  if (roomID) socket.emit('create-room', roomID);
}
function joinRoom() {
  const roomID = prompt("Room ID to join:");
  if (roomID) socket.emit('join-room', roomID);
}
function updateCurrentRoom(roomID) {
  document.getElementById('currentRoom').textContent = roomID;
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
