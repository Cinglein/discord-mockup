import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceSignal } from '@/bindings/VoiceSignal';

export function useVoiceChat(userId: number | null, channelId: number | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());

  // Only run on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sendSignal = useCallback((signal: VoiceSignal) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(signal));
    }
  }, []);

  const createPeerConnection = useCallback(async (remoteUserId: number): Promise<RTCPeerConnection> => {
    if (!isMounted) throw new Error('Not mounted');

    console.log('[Voice] Creating peer connection for user:', remoteUserId);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local stream tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote audio
    pc.ontrack = (event) => {
      console.log('[Voice] Received remote audio track from user:', remoteUserId);
      const [remoteStream] = event.streams;
      // Create audio element to play remote stream
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.muted = isDeafened; // Apply current deafen state
      audio.autoplay = true; // Required for mobile
      audio.setAttribute('playsinline', ''); // Required for iOS

      // Try to play, with error handling for mobile
      audio.play().then(() => {
        console.log('[Voice] Playing audio from user:', remoteUserId);
      }).catch((err) => {
        console.error('[Voice] Failed to play audio:', err);
      });

      audioElementsRef.current.set(remoteUserId, audio);
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
  }, [isMounted, isDeafened, userId, channelId, sendSignal]);

  const handleSignal = useCallback(async (signal: VoiceSignal) => {
    if (!userId || !channelId) return;

    try {
      switch (signal.type) {
        case 'Join': {
          if (signal.user_id === userId || signal.channel_id !== channelId) return;

          console.log('[Voice] User joined:', signal.user_id);

          // Create offer for new user
          const pc = await createPeerConnection(signal.user_id);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
          });
          await pc.setLocalDescription(offer);

          console.log('[Voice] Sending offer to user:', signal.user_id);
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

          // Clean up audio element
          const audio = audioElementsRef.current.get(signal.user_id);
          if (audio) {
            audio.pause();
            audio.srcObject = null;
            audioElementsRef.current.delete(signal.user_id);
          }
          break;
        }

        case 'Offer': {
          if (signal.to !== userId || signal.channel_id !== channelId) return;

          console.log('[Voice] Received offer from user:', signal.from);

          const pc = await createPeerConnection(signal.from);
          await pc.setRemoteDescription(JSON.parse(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log('[Voice] Sending answer to user:', signal.from);
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

          console.log('[Voice] Received answer from user:', signal.from);

          const pc = peersRef.current.get(signal.from);
          if (pc) {
            await pc.setRemoteDescription(JSON.parse(signal.sdp));
          }
          break;
        }

        case 'IceCandidate': {
          if (signal.to !== userId || signal.channel_id !== channelId) return;

          console.log('[Voice] Received ICE candidate from user:', signal.from);

          const pc = peersRef.current.get(signal.from);
          if (pc) {
            await pc.addIceCandidate(JSON.parse(signal.candidate));
          }
          break;
        }
      }
    } catch (error) {
      console.error('[Voice] Error handling signal:', error);
    }
  }, [userId, channelId, createPeerConnection, sendSignal]);

  const joinVoice = useCallback(async () => {
    if (!userId || !channelId || !isMounted) return;

    console.log('[Voice] Join button clicked, userId:', userId, 'channelId:', channelId);

    try {
      // Get user's microphone
      console.log('[Voice] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      console.log('[Voice] Microphone access granted');
      localStreamRef.current = stream;

      // Connect to WebSocket - use current host, not localhost!
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/voice-ws`;
      console.log('[Voice] Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Voice] WebSocket connected successfully');
        setIsConnected(true);
        sendSignal({
          type: 'Join',
          user_id: userId,
          channel_id: channelId,
        });
      };

      ws.onmessage = (event) => {
        console.log('[Voice] WebSocket message received');
        const signal: VoiceSignal = JSON.parse(event.data);
        handleSignal(signal);
      };

      ws.onerror = (error) => {
        console.error('[Voice] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('[Voice] WebSocket closed, code:', event.code, 'reason:', event.reason);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('[Voice] Failed to join voice:', error);
      alert(`Failed to join voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [userId, channelId, isMounted, sendSignal, handleSignal]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);

    // Mute all remote audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.muted = newDeafenState;
    });

    // If deafening, also mute microphone
    if (newDeafenState && localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        setIsMuted(true);
      }
    }
  }, [isDeafened]);

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

    // Clean up all audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Stop local stream
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    // Close WebSocket
    wsRef.current?.close();
    wsRef.current = null;

    setIsConnected(false);
    setIsMuted(false);
    setIsDeafened(false);
  }, [userId, channelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
  };
}
