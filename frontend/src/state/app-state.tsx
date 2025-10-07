'use client';

import { Update } from "@bindings/Update";
import { Snapshot } from "@bindings/Snapshot";
import { useRef, createContext, useContext, useEffect, useMemo, useState } from 'react';

type State = {
	userId: number | null;
	snapshot: Snapshot | null;
	setUserId(id: number | null): void;
	setSnapshot(s: Snapshot | null): void;
}

const AppStateCtx = createContext<State | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
	const [userId, setUserId] = useState<number | null>(null);
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const sseRef = useRef<EventSource | null>(null);

	async function getSnapshot(): Promise<Snapshot | null> {
    const res = await fetch('/snapshot', { method: 'GET' });
		if (res.ok) {
			try {
				const parsed: Snapshot = await res.json();
				return parsed;
			} catch(e) {
				console.error(`Unable to parse json: ${e}`);
				return null;
			}
		} else {
			console.error(`Error with status code: ${res.status}`);
			return null;
		}
  }

	function handleUpdate(snapshot: Snapshot, u: Update) {
		if ("User" in u) {
			const { User } = u;
			snapshot.users[User.id] = User;
		} else if ("Server" in u) {
			const { Server } = u;
			snapshot.servers[Server.id] = Server;
		} else if ("Channel" in u) {
			const { Channel } = u;
			const channels = snapshot.channels[Channel.server_id] ?? [];
			if (!channels.some((c) => c.id === Channel.id)) {
				channels.push(Channel);
			}
			snapshot.channels[Channel.server_id] = channels;
		} else {
			const { Message } = u;
			const channels = snapshot.messages[Message.server_id] ?? {};
			const messages = channels[Message.channel_id] ?? [];
			if (!messages.some((m) => m.id === Message.id)) {
				messages.push(Message);
			}
			channels[Message.channel_id] = messages;
			snapshot.messages[Message.server_id] = channels;
		}
	}

	useEffect(() => {
		(async() => {
			setSnapshot(await getSnapshot());
			const es = new EventSource('/updates');
			sseRef.current = es;
			es.addEventListener('message', (evt) => {
				try {
					const parsed: Update = JSON.parse(evt.data);
					setSnapshot((prev) => {
						if (prev === null) {
							return null;
						} else {
							handleUpdate(prev, parsed);
							return prev;
						}
					});
				} catch {
					console.error(`Error parsing message json: ${evt.data}`);
				}
			});
			return () => {
				es.close();
				sseRef.current = null;
			};
		})()
	}, [setSnapshot, sseRef]);

	const api = useMemo<State>(() => ({
		userId,
		snapshot,
		setUserId,
		setSnapshot,
	}), [userId, setUserId, snapshot, setSnapshot]);
	return <AppStateCtx.Provider value = { api }>{ children }</AppStateCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error('useApp must be inside AppStateProvider');
  return ctx;
}
