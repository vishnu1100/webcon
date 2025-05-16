const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRTCService {
  constructor(socket, userId) {
    this.socket = socket;
    this.userId = userId;
    this.peers = new Map();
    this.localStream = null;
    this.onTrackCallbacks = new Set();

    this.handleSocketEvents();
  }

  handleSocketEvents() {
    this.socket.on('user-joined', async ({ userId, socketId }) => {
      console.log('User joined:', userId);
      await this.createPeerConnection(socketId, true);
    });

    this.socket.on('offer', async ({ offer, from }) => {
      const pc = await this.createPeerConnection(from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('answer', { answer, to: from });
    });

    this.socket.on('answer', async ({ answer, from }) => {
      const pc = this.peers.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on('ice-candidate', async ({ candidate, from }) => {
      const pc = this.peers.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    this.socket.on('user-left', (socketId) => {
      if (this.peers.has(socketId)) {
        this.peers.get(socketId).close();
        this.peers.delete(socketId);
      }
    });
  }

  async createPeerConnection(socketId, isInitiator) {
    if (this.peers.has(socketId)) {
      return this.peers.get(socketId);
    }

    const pc = new RTCPeerConnection(configuration);
    this.peers.set(socketId, pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.socket.emit('ice-candidate', { candidate, to: socketId });
      }
    };

    pc.ontrack = (event) => {
      this.onTrackCallbacks.forEach(callback => callback(event.streams[0], socketId));
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('offer', { offer, to: socketId });
    }

    return pc;
  }

  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  onTrack(callback) {
    this.onTrackCallbacks.add(callback);
  }

  closeAllConnections() {
    this.peers.forEach(pc => pc.close());
    this.peers.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }
}

export default WebRTCService;