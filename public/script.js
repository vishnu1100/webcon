
const socket = io();
let localStream;
let peers = {};
let userMapping = {};
let currentRoom = '';
let micEnabled = true;
let cameraEnabled = true;
let startTime;
let timerInterval;

// Tab switching
document.getElementById('participants-tab').addEventListener('click', function() {
  document.getElementById('participants-tab').classList.add('text-blue-400', 'border-b-2', 'border-blue-500');
  document.getElementById('participants-tab').classList.remove('text-gray-400');
  document.getElementById('chat-tab').classList.add('text-gray-400');
  document.getElementById('chat-tab').classList.remove('text-blue-400', 'border-b-2', 'border-blue-500');
  document.getElementById('participants-panel').classList.remove('hidden');
  document.getElementById('chat-panel').classList.add('hidden');
});

document.getElementById('chat-tab').addEventListener('click', function() {
  document.getElementById('chat-tab').classList.add('text-blue-400', 'border-b-2', 'border-blue-500');
  document.getElementById('chat-tab').classList.remove('text-gray-400');
  document.getElementById('participants-tab').classList.add('text-gray-400');
  document.getElementById('participants-tab').classList.remove('text-blue-400', 'border-b-2', 'border-blue-500');
  document.getElementById('chat-panel').classList.remove('hidden');
  document.getElementById('participants-panel').classList.add('hidden');
});

// Chat input - send message on Enter
document.getElementById('chat-input').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Meeting timer
function startTimer() {
  startTime = new Date();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
  const now = new Date();
  const diff = now - startTime;
  const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
  const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
  document.getElementById('meeting-timer').textContent = `${hours}:${minutes}:${seconds}`;
}

function stopTimer() {
  clearInterval(timerInterval);
}

// Show/hide interfaces
function showConferenceInterface(show) {
  document.getElementById('landing-controls').style.display = show ? 'none' : 'flex';
  document.getElementById('conference-interface').style.display = show ? 'flex' : 'none';
  if (show) {
    startTimer();
  } else {
    stopTimer();
  }
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
  messageDiv.className = 'chat-message bg-gray-700 rounded-lg p-3 fade-in';
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.innerHTML = `
    <div class="flex justify-between items-center mb-1">
      <div class="font-medium text-sm ${sender === 'You' ? 'text-blue-400' : 'text-gray-300'}">${sender}</div>
      <div class="text-xs text-gray-500">${timestamp}</div>
    </div>
    <div class="text-sm">${message}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Highlight chat tab if not active
  if (document.getElementById('chat-panel').classList.contains('hidden')) {
    document.getElementById('chat-tab').classList.add('text-yellow-400', 'pulse');
    setTimeout(() => {
      document.getElementById('chat-tab').classList.remove('pulse');
    }, 2000);
  }
}

// Participant list management
function updateParticipantsList() {
  const list = document.getElementById('participants-list');
  list.innerHTML = '';
  
  // Add local user
  const localUser = document.createElement('div');
  localUser.className = 'flex items-center justify-between p-2 hover:bg-gray-700 rounded-lg';
  localUser.innerHTML = `
    <div class="flex items-center space-x-3">
      <div class="avatar w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg font-bold">
        Y
      </div>
      <div>
        <div class="font-medium">You (Host)</div>
        <div class="text-xs text-gray-400">Local participant</div>
      </div>
    </div>
    <div class="flex space-x-2">
      <button class="text-gray-400 hover:text-white" title="More options">
        <i class="fas fa-ellipsis-v"></i>
      </button>
    </div>
  `;
  list.appendChild(localUser);
  
  // Add remote users
  Object.keys(peers).forEach(userID => {
    const username = userMapping[userID] || `Participant ${userID.slice(0, 4)}`;
    const initials = username.slice(0, 1).toUpperCase();
    const userDiv = document.createElement('div');
    userDiv.className = 'flex items-center justify-between p-2 hover:bg-gray-700 rounded-lg fade-in';
    userDiv.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="avatar w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-lg font-bold">
          ${initials}
        </div>
        <div>
          <div class="font-medium">${username}</div>
          <div class="text-xs text-gray-400">Remote participant</div>
        </div>
      </div>
      <div class="flex space-x-2">
        <button class="text-gray-400 hover:text-white" title="More options">
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </div>
    `;
    list.appendChild(userDiv);
  });
  
  // Update participant count
  document.getElementById('participant-count').textContent = Object.keys(peers).length + 1;
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
  div.className = 'scale-in bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300';
  div.id = `card-${id}`;
  
  // Create a random color for the user avatar if the video fails
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const initials = username.slice(0, 1).toUpperCase();
  
  div.innerHTML = `
    <div class="relative">
      <video id="video-${id}" autoplay ${id === '' ? 'muted' : ''} class="w-full h-full object-cover aspect-video bg-gray-900"></video>
      <div class="absolute bottom-0 left-0 right-0 flex justify-between items-center p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div class="flex items-center space-x-2">
          <div class="avatar w-8 h-8 ${randomColor} rounded-full flex items-center justify-center font-bold text-sm">
            ${initials}
          </div>
          <span class="font-medium text-sm">${username}</span>
        </div>
        <div class="flex space-x-2">
          ${id === '' ? `
           
          ` : ''}
        <i class="${micEnabled ? 'fas fa-microphone text-green-400' : 'fas fa-microphone-slash text-red-400'}"></i>
      </div>
      </div>
    </div>
  `;
  
  const video = div.querySelector('video');
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  
  container.appendChild(div);
}

// Room handling
function createRoom() {
  const roomID = document.getElementById('roomInput').value.trim() || generateRoomId();
  const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';
  if (roomID) {
    socket.emit('create-room', { roomID, username });
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

function joinRoom() {
  const roomID = document.getElementById('roomInput').value.trim();
  const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';
  if (roomID) {
    socket.emit('join-room', { roomID, username });
  }
}

function updateCurrentRoom(roomID) {
  currentRoom = roomID;
  document.getElementById('currentRoom').textContent = roomID;
  showConferenceInterface(roomID !== 'None');
  updateParticipantsList();
}

function leaveRoom() {
  // Show confirmation dialog
  if (confirm("Are you sure you want to leave this meeting?")) {
    // Cleanup peers
    Object.values(peers).forEach(peer => peer.destroy());
    peers = {};
    userMapping = {};

    // Remove all video cards except local
    const container = document.getElementById('video-container');
    container.innerHTML = '';
    
    // Reset chat
    document.getElementById('chat-messages').innerHTML = '';
    
    socket.emit('leave-room', currentRoom);
    updateCurrentRoom('None');
  }
}

// Media toggle
function toggleMic() {
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => (track.enabled = micEnabled));
  
  const micBtn = document.getElementById('mic-btn');
  if (micEnabled) {
    micBtn.innerHTML = '<i class="fas fa-microphone text-xl"></i>';
    micBtn.classList.remove('bg-red-500');
    micBtn.classList.add('bg-gray-700');
  } else {
    micBtn.innerHTML = '<i class="fas fa-microphone-slash text-xl"></i>';
    micBtn.classList.remove('bg-gray-700');
    micBtn.classList.add('bg-red-500');
  }

  // Update mic icon on local video card
  const localVideoCard = document.getElementById('card-');
  if (localVideoCard) {
    const micIcon = localVideoCard.querySelector('.fa-microphone, .fa-microphone-slash');
    if (micIcon) {
      if (micEnabled) {
        micIcon.classList.remove('fa-microphone-slash', 'text-red-400');
        micIcon.classList.add('fa-microphone', 'text-green-400');
      } else {
        micIcon.classList.remove('fa-microphone', 'text-green-400');
        micIcon.classList.add('fa-microphone-slash', 'text-red-400');
      }
    }
  }

  // Emit mic state change to others
  socket.emit('mic-state-change', { room: currentRoom, micEnabled: micEnabled });
}

function toggleCamera() {
  cameraEnabled = !cameraEnabled;
  localStream.getVideoTracks().forEach(track => (track.enabled = cameraEnabled));
  
  const cameraBtn = document.getElementById('camera-btn');
  if (cameraEnabled) {
    cameraBtn.innerHTML = '<i class="fas fa-video text-xl"></i>';
    cameraBtn.classList.remove('bg-red-500');
    cameraBtn.classList.add('bg-gray-700');
  } else {
    cameraBtn.innerHTML = '<i class="fas fa-video-slash text-xl"></i>';
    cameraBtn.classList.remove('bg-gray-700');
    cameraBtn.classList.add('bg-red-500');
  }

  // Emit camera state change to others
  socket.emit('camera-state-change', { room: currentRoom, cameraEnabled: cameraEnabled });
}

// Screen sharing (placeholder - would need additional implementation)
function toggleScreenShare() {
  alert("Screen sharing feature coming soon!");
}

// Socket listeners
socket.on('room-created', (roomID) => {
  updateCurrentRoom(roomID);
  addChatMessage('System', 'You created the room. Share the room ID with others to join.');
});

socket.on('room-joined', (roomID) => {
  updateCurrentRoom(roomID);
  addChatMessage('System', 'You joined the room.');
});

socket.on('user-joined', ({ userID, username }) => {
  userMapping[userID] = username;
  connectToPeer(userID, true);
  updateParticipantsList();
  addChatMessage('System', `${username} has joined the room`);
});

socket.on('existing-users', (users) => {
  users.forEach(({ userID, username }) => {
    userMapping[userID] = username;
    connectToPeer(userID, false);
  });
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

// Handle mic state changes from other users
socket.on('mic-state-change', ({ userID, micEnabled }) => {
  const videoCard = document.getElementById(`card-${userID}`);
  if (videoCard) {
    const micIcon = videoCard.querySelector('.fa-microphone, .fa-microphone-slash');
    if (micIcon) {
      if (micEnabled) {
        micIcon.classList.remove('fa-microphone-slash', 'text-red-400');
        micIcon.classList.add('fa-microphone', 'text-green-400');
      } else {
        micIcon.classList.remove('fa-microphone', 'text-green-400');
        micIcon.classList.add('fa-microphone-slash', 'text-red-400');
      }
    }
  }
});

// Handle camera state changes from other users
socket.on('camera-state-change', ({ userID, cameraEnabled }) => {
  const videoCard = document.getElementById(`card-${userID}`);
  if (videoCard) {
    const cameraIcon = videoCard.querySelector('.fa-video, .fa-video-slash');
    if (cameraIcon) {
      if (cameraEnabled) {
        cameraIcon.classList.remove('fa-video-slash', 'text-red-400');
        cameraIcon.classList.add('fa-video', 'text-green-400');
      } else {
        cameraIcon.classList.remove('fa-video', 'text-green-400');
        cameraIcon.classList.add('fa-video-slash', 'text-red-400');
      }
    }
  }
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
    const username = userMapping[targetID] || `Participant ${targetID.slice(0, 4)}`;
    displayVideo(stream, username, targetID);
  });

  peers[targetID] = peer;
}

// Room input validation & keypress
document.getElementById('roomInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    if (this.value.trim()) {
      joinRoom();
    } else {
      createRoom();
    }
  }
});

// Start local video
window.addEventListener("load", getMedia);
