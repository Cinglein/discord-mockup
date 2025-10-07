'use client';

import { Suspense } from 'react';
import { useApp } from '@/state/app-state';
import { useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { Message } from '@/bindings/Message';

export default function ChannelPage() {
  return (
    <div className="h-full flex flex-col">
			<Suspense>
				<UiHeader/>
			</Suspense>
			<Suspense>
			</Suspense>
    </div>
  );
}

export function UiHeader() {
	const { snapshot } = useApp();
  const params = useSearchParams();
  const server_id = parseInt(params.get('server_id') ?? '');
  const channel_id = parseInt(params.get('channel_id') ?? '');
	const server = snapshot?.servers[server_id]?.name ?? 'unknown server';
	const channel = snapshot?.channels[server_id]?.find(c => c.id == channel_id)?.name ?? 'unknown channel';
	return (
		<header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 font-semibold">/{server}/{channel}</header>
	);
}

export function UiList() {
  const { userId, snapshot } = useApp();
  const params = useSearchParams();
  const server_id = parseInt(params.get('server_id') ?? '');
  const channel_id = parseInt(params.get('channel_id') ?? '');
  const list: Message[] = snapshot?.messages[server_id]?.[channel_id] ?? [];
  const inputRef = useRef<HTMLInputElement>(null);

  async function create_message(text: string, server_id: number, channel_id: number) {
    const res = await fetch(`/create-message?user_id=${userId}&server_id=${server_id}&channel_id=${channel_id}text=${encodeURIComponent(text)}`, {
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

	return (
		<>
			<div className="flex-1 overflow-auto px-4 py-3 space-y-2">
				{list.map(m => (
					<div key={m.id} className="text-sm">
						<span className="font-medium">{snapshot?.users?.[m.user_id]?.name ?? 'unknown user'}</span>{' '}
						<span className="text-zinc-500 text-xs">{new Date(m.ts).toLocaleTimeString()}</span>
						<div>{m.text}</div>
					</div>
				))}
			</div>
      <form
        className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = inputRef.current?.value?.trim();
          if (!text) return;
					create_message(text, server_id, channel_id);
        }}
      >
        <input ref={inputRef} className="flex-1 px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" placeholder="Message…" />
        <button className="px-3 py-2 rounded-md bg-indigo-600 text-white">Send</button>
      </form>
		</>
	)
}
