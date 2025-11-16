'use client';

import { Update } from "@bindings/Update";
import { Snapshot } from "@bindings/Snapshot";
import { useRef, createContext, useContext, useEffect, useMemo, useState } from 'react';

type State = {
	userId: number | null;
	snapshot: Snapshot | null;
	typingUsers: Set<number>;
	voiceUsers: Map<number, Set<number>>; // channel_id -> Set<user_id>
	setUserId(id: number | null): void;
	setSnapshot(s: Snapshot | null): void;
}

const AppStateCtx = createContext<State | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
	const [userId, setUserId] = useState<number | null>(null);
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
	const [voiceUsers, setVoiceUsers] = useState<Map<number, Set<number>>>(new Map());
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

	function handleUpdate(snapshot: Snapshot, u: Update): Snapshot {
		if ("User" in u) {
			const { User } = u;
			return {
				...snapshot,
				users: { ...snapshot.users, [User.id]: User }
			};
		} else if ("Server" in u) {
			const { Server } = u;
			return {
				...snapshot,
				servers: { ...snapshot.servers, [Server.id]: Server }
			};
		} else if ("Channel" in u) {
			const { Channel } = u;
			const channels = snapshot.channels[Channel.server_id] ?? [];
			const updatedChannels = channels.some((c) => c.id === Channel.id)
				? channels
				: [...channels, Channel];
			return {
				...snapshot,
				channels: { ...snapshot.channels, [Channel.server_id]: updatedChannels }
			};
		} else if ("Message" in u) {
			const { Message } = u;
			const channels = snapshot.messages[Message.server_id] ?? {};
			const messages = channels[Message.channel_id] ?? [];
			const updatedMessages = messages.some((m) => m.id === Message.id)
				? messages
				: [...messages, Message];
			return {
				...snapshot,
				messages: {
					...snapshot.messages,
					[Message.server_id]: {
						...channels,
						[Message.channel_id]: updatedMessages
					}
				}
			};
		} else {
			return snapshot;
		}
	}

	useEffect(() => {
		(async() => {
			setSnapshot(await getSnapshot());
			const es = new EventSource('/updates');
			sseRef.current = es;

			es.addEventListener('open', () => {
				console.log('SSE connection opened');
			});

			es.addEventListener('error', (error) => {
				console.error('SSE connection error:', error);
				console.error('SSE readyState:', es.readyState);
			});

			es.addEventListener('message', (evt) => {
				console.log('SSE message received:', evt.data);
				try {
					const parsed: Update = JSON.parse(evt.data);
					if ("Typing" in parsed) {
						const { Typing } = parsed;
						if ("Start" in Typing) {
							setTypingUsers((prev) => new Set(prev).add(Typing.Start));
						} else {
							setTypingUsers((prev) => {
								const next = new Set(prev);
								next.delete(Typing.Stop);
								return next;
							});
						}
					} else if ("VoiceJoin" in parsed) {
						const { user_id, channel_id } = parsed.VoiceJoin;
						setVoiceUsers((prev) => {
							const next = new Map(prev);
							const users = new Set(next.get(channel_id) || []);
							users.add(user_id);
							next.set(channel_id, users);
							return next;
						});
					} else if ("VoiceLeave" in parsed) {
						const { user_id, channel_id } = parsed.VoiceLeave;
						setVoiceUsers((prev) => {
							const next = new Map(prev);
							const users = new Set(next.get(channel_id) || []);
							users.delete(user_id);
							if (users.size === 0) {
								next.delete(channel_id);
							} else {
								next.set(channel_id, users);
							}
							return next;
						});
					} else {
						setSnapshot((prev) => {
							if (prev === null) {
								return null;
							} else {
								return handleUpdate(prev, parsed);
							}
						});
					}
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
		typingUsers,
		voiceUsers,
		setUserId,
		setSnapshot,
	}), [userId, setUserId, snapshot, setSnapshot, typingUsers, voiceUsers]);
	return <AppStateCtx.Provider value = { api }>{ children }</AppStateCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error('useApp must be inside AppStateProvider');
  return ctx;
}
