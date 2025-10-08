import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceSignal } from '@/bindings/VoiceSignal';

export function useVoiceChat(userId: number | null, channelId: number | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());

  const sendSignal = (signal: VoiceSignal) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(signal));
    }
  };

  const createPeerConnection = async (remoteUserId: number): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local stream tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote audio
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      // Create audio element to play remote stream
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play();
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && userId && channelId) {
        sendSignal({
          type: 'IceCandidate',
          from: userId,
          to: remoteUserId,
          channel_id: channelId,
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    peersRef.current.set(remoteUserId, pc);
    return pc;
  };

  const handleSignal = async (signal: VoiceSignal) => {
    if (!userId || !channelId) return;

    switch (signal.type) {
      case 'Join': {
        if (signal.user_id === userId || signal.channel_id !== channelId) return;

        setConnectedUsers((prev) => new Set(prev).add(signal.user_id));

        // Create offer for new user
        const pc = await createPeerConnection(signal.user_id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendSignal({
          type: 'Offer',
          from: userId,
          to: signal.user_id,
          channel_id: channelId,
          sdp: JSON.stringify(offer),
        });
        break;
      }

      case 'Leave': {
        if (signal.channel_id !== channelId) return;

        const pc = peersRef.current.get(signal.user_id);
        if (pc) {
          pc.close();
          peersRef.current.delete(signal.user_id);
        }
        setConnectedUsers((prev) => {
          const next = new Set(prev);
          next.delete(signal.user_id);
          return next;
        });
        break;
      }

      case 'Offer': {
        if (signal.to !== userId || signal.channel_id !== channelId) return;

        const pc = await createPeerConnection(signal.from);
        await pc.setRemoteDescription(JSON.parse(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignal({
          type: 'Answer',
          from: userId,
          to: signal.from,
          channel_id: channelId,
          sdp: JSON.stringify(answer),
        });
        break;
      }

      case 'Answer': {
        if (signal.to !== userId || signal.channel_id !== channelId) return;

        const pc = peersRef.current.get(signal.from);
        if (pc) {
          await pc.setRemoteDescription(JSON.parse(signal.sdp));
        }
        break;
      }

      case 'IceCandidate': {
        if (signal.to !== userId || signal.channel_id !== channelId) return;

        const pc = peersRef.current.get(signal.from);
        if (pc) {
          await pc.addIceCandidate(JSON.parse(signal.candidate));
        }
        break;
      }
    }
  };

  const joinVoice = async () => {
    if (!userId || !channelId) return;

    try {
      // Get user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Connect to WebSocket
      const ws = new WebSocket(`ws://localhost:3000/voice-ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        sendSignal({
          type: 'Join',
          user_id: userId,
          channel_id: channelId,
        });
      };

      ws.onmessage = (event) => {
        const signal: VoiceSignal = JSON.parse(event.data);
        handleSignal(signal);
      };

      ws.onclose = () => {
        setIsConnected(false);
        leaveVoice();
      };
    } catch (error) {
      console.error('Failed to join voice:', error);
    }
  };

  const leaveVoice = useCallback(() => {
    if (userId && channelId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'Leave',
        user_id: userId,
        channel_id: channelId,
      }));
    }

    // Close all peer connections
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    // Stop local stream
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    // Close WebSocket
    wsRef.current?.close();
    wsRef.current = null;

    setIsConnected(false);
    setConnectedUsers(new Set());
  }, [userId, channelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  return {
    isConnected,
    connectedUsers,
    joinVoice,
    leaveVoice,
  };
}
