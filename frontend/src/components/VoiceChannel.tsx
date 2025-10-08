'use client';

import { useApp } from '@/state/app-state';
import { useVoiceChat } from '@/hooks/useVoiceChat';

interface VoiceChannelProps {
  channelId: number;
  serverId: number;
}

export function VoiceChannel({ channelId, serverId }: VoiceChannelProps) {
  const { userId, snapshot } = useApp();
  const { isConnected, connectedUsers, joinVoice, leaveVoice } = useVoiceChat(userId, channelId);

  const channel = snapshot?.channels[serverId]?.find((c) => c.id === channelId);

  if (!channel) return null;

  return (
    <div className="px-2 py-1">
      <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#35373c] cursor-pointer group">
        <svg className="w-5 h-5 text-[#80848e]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3a9 9 0 00-9 9v7c0 1.1.9 2 2 2h2v-8H5v-1a7 7 0 1114 0v1h-2v8h2c1.1 0 2-.9 2-2v-7a9 9 0 00-9-9z"/>
        </svg>
        <span className="text-[#949ba4] text-sm font-medium flex-1">{channel.name}</span>

        {!isConnected && (
          <button
            onClick={joinVoice}
            className="opacity-0 group-hover:opacity-100 text-[#949ba4] hover:text-white text-xs px-2 py-1 rounded bg-[#404249]"
          >
            Join
          </button>
        )}
      </div>

      {isConnected && (
        <div className="ml-6 mt-1 space-y-1">
          {/* Current user */}
          {userId && (
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#35373c]">
              <div className="w-6 h-6 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-xs font-semibold">
                {(snapshot?.users?.[userId]?.name ?? 'You').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-white text-sm flex-1">
                {snapshot?.users?.[userId]?.name ?? 'You'}
              </span>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <button
                onClick={leaveVoice}
                className="text-[#949ba4] hover:text-white"
                title="Leave voice channel"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.3 5.7a1 1 0 00-1.4 0L12 10.6 7.1 5.7a1 1 0 10-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 001.4 1.4L12 13.4l4.9 4.9a1 1 0 001.4-1.4L13.4 12l4.9-4.9a1 1 0 000-1.4z"/>
                </svg>
              </button>
            </div>
          )}

          {/* Connected users */}
          {Array.from(connectedUsers).map((id) => (
            <div key={id} className="flex items-center gap-2 px-2 py-1">
              <div className="w-6 h-6 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-xs font-semibold">
                {(snapshot?.users?.[id]?.name ?? 'User').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[#949ba4] text-sm">
                {snapshot?.users?.[id]?.name ?? `User ${id}`}
              </span>
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
