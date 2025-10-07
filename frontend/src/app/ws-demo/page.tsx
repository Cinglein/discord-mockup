'use client';

import type { Message } from "@bindings/Message";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  const [wsMsgs, setWsMsgs] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
	useEffect(() => {
		const ws = new WebSocket('/ws');
    wsRef.current = ws;
		ws.onmessage = (evt: MessageEvent) => {
			try {
        const parsed: Message = JSON.parse(evt.data as string);
        setWsMsgs((prev) => [...prev, parsed]);
			} catch {
				console.error(`Error parsing message json: ${evt.data}`);
			}
		};
		ws.onerror = () => {
			console.error('ws error');
		};
    return () => {
      ws.close();
      wsRef.current = null;
    };
	}, [wsRef, setWsMsgs]);

	return (
		<>
			<div className="font-sans">An infinite stream of WS Messages</div>
			<ul>
				{wsMsgs.map((m, i) => (
					<li key={i}>{m.data}</li>
				))}
			</ul>
		</>
	);
}
