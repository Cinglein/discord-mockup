'use client';

import { Suspense } from 'react';
import { useApp } from '@/state/app-state';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { Message } from '@/bindings/Message';

export default function ChannelPage() {
  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]">
			<Suspense>
				<UiHeader/>
			</Suspense>
			<Suspense>
				<UiList/>
			</Suspense>
    </div>
  );
}

export function UiHeader() {
	const { snapshot } = useApp();
	const r = useRouter();
  const params = useSearchParams();

	if (!snapshot) {
		r.replace('/');
		return null;
	}

  const server_id = parseInt(params.get('server_id') ?? '');
	if (!server_id) {
		r.replace('/');
		return null;
	}
	const channel = snapshot.channels[server_id]?.[0];
	if (!channel) {
		r.replace('/');
		return null;
	}

	return (
		<header className="border-b border-[#1e1f22] px-4 h-12 grid grid-cols-[auto_1fr] items-center gap-2 shadow-sm">
			<svg className="w-5 h-5 text-[#80848e]" fill="currentColor" viewBox="0 0 24 24">
				<path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
			</svg>
			<h1 className="font-semibold text-white">{channel.name}</h1>
		</header>
	);
}

export function UiList() {
  const { userId, snapshot, typingUsers } = useApp();
  const params = useSearchParams();
  const server_id = parseInt(params.get('server_id') ?? '');
  const channel_id = parseInt(params.get('channel_id') ?? '');
  const list: Message[] = snapshot?.messages[server_id]?.[channel_id] ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  async function create_message(text: string, server_id: number, channel_id: number) {
    const res = await fetch(`/create-message?user_id=${userId}&server_id=${server_id}&channel_id=${channel_id}&text=${encodeURIComponent(text)}`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    try {
      const parsed: Message = await res.json();
      console.log(parsed);
    } catch {
      console.error(`Unable to parse server response`, res);
    }
  }

  async function sendTyping(isTyping: boolean) {
    if (!userId) return;
    await fetch(`/typing?typing=${isTyping}&user_id=${userId}`, {
      method: 'POST',
    });
  }

  function handleInputChange() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      sendTyping(true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
      typingTimeoutRef.current = null;
    }, 3000);
  }

	return (
		<>
			<div className="overflow-auto px-4 py-4 grid gap-4 content-start">
				{list.map(m => (
					<div key={m.id} className="grid grid-cols-[40px_1fr] gap-4 hover:bg-[#2e3035] -mx-2 px-2 py-1">
						<div className="w-10 h-10 rounded-full bg-[#5865f2] grid place-items-center text-white font-semibold">
							{(snapshot?.users?.[m.user_id]?.name ?? 'Unknown User').slice(0, 2).toUpperCase()}
						</div>
						<div className="grid gap-1">
							<div className="grid grid-cols-[auto_auto] gap-2 items-baseline">
								<span className="font-medium text-white">{snapshot?.users?.[m.user_id]?.name ?? 'unknown user'}</span>
								<span className="text-[#949ba4] text-xs">{new Date(m.ts).toLocaleTimeString()}</span>
							</div>
							<div className="text-[#dbdee1]">{m.text}</div>
						</div>
					</div>
				))}
				{Array.from(typingUsers).filter(id => id !== userId).map(id => (
					<div key={`typing-${id}`} className="grid grid-cols-[40px_1fr] gap-4 -mx-2 px-2 py-1">
						<div className="w-10 h-10 rounded-full bg-[#5865f2] grid place-items-center text-white font-semibold">
							{(snapshot?.users?.[id]?.name ?? 'Unknown User').slice(0, 2).toUpperCase()}
						</div>
						<div className="grid gap-1">
							<div className="grid grid-cols-[auto_auto] gap-2 items-baseline">
								<span className="font-medium text-white">{snapshot?.users?.[id]?.name ?? 'unknown user'}</span>
							</div>
							<div className="text-[#949ba4] italic">is typing...</div>
						</div>
					</div>
				))}
			</div>
      <form
        className="px-4 pb-6 pt-0"
        onSubmit={(e) => {
          e.preventDefault();
          const text = inputRef.current?.value?.trim();
          if (!text) return;
					if (typingTimeoutRef.current) {
						clearTimeout(typingTimeoutRef.current);
						typingTimeoutRef.current = null;
						sendTyping(false);
					}
					create_message(text, server_id, channel_id);
					if (inputRef.current) inputRef.current.value = '';
        }}
      >
        <input
					ref={inputRef}
					className="w-full px-4 py-3 rounded-lg bg-[#383a40] text-white placeholder-[#6d6f78] outline-none"
					placeholder={`Message #${snapshot?.channels[server_id]?.find(c => c.id == channel_id)?.name ?? 'unknown channel'}`}
					onChange={handleInputChange}
				/>
      </form>
		</>
	)
}
