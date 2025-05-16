import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import WebRTCService from '../services/WebRTCService';

const VideoRoom = () => {
  const { roomId } = useParams();
  const [peers, setPeers] = useState(new Map());
  const localVideoRef = useRef();
  const webRTCServiceRef = useRef();
  const socketRef = useRef();

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    const userId = `User-${Math.floor(Math.random() * 10000)}`;
    const webRTCService = new WebRTCService(socket, userId);
    webRTCServiceRef.current = webRTCService;

    const initializeRoom = async () => {
      try {
        const localStream = await webRTCService.startLocalStream();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        socket.emit('join-room', { roomId, userId });

        webRTCService.onTrack((stream, peerId) => {
          setPeers(prev => new Map(prev).set(peerId, stream));
        });
      } catch (error) {
        console.error('Error initializing room:', error);
      }
    };

    initializeRoom();

    return () => {
      webRTCService.closeAllConnections();
      socket.disconnect();
    };
  }, [roomId]);

  return (
    <div className="h-screen bg-gray-900 p-4">
      <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-lg bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-2 left-2 rounded bg-gray-900 px-2 py-1 text-sm text-white opacity-75">
            You
          </div>
        </div>
        {Array.from(peers).map(([peerId, stream]) => (
          <div key={peerId} className="relative overflow-hidden rounded-lg bg-gray-800">
            <video
              autoPlay
              playsInline
              ref={el => {
                if (el) el.srcObject = stream;
              }}
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-2 left-2 rounded bg-gray-900 px-2 py-1 text-sm text-white opacity-75">
              Peer {peerId}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoRoom;