'use client';

import type { Message } from "@bindings/Message";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  const [sseMsgs, setSseMsgs] = useState<Message[]>([]);
	const sseRef = useRef<EventSource | null>(null);

	useEffect(() => {
		const es = new EventSource('/sse');
		sseRef.current = es;
    es.addEventListener('message', (evt) => {
			try {
				const parsed: Message = JSON.parse(evt.data);
				setSseMsgs((prev) => [...prev, parsed]);
			} catch {
				console.error(`Error parsing message json: ${evt.data}`);
			}
    });
	  return () => {
      es.close();
      sseRef.current = null;
    };
	}, [sseRef, setSseMsgs]);

	return (
		<>
			<div className="font-sans">An infinite stream of SSE Messages</div>
			<ul>
				{sseMsgs.map((m, i) => (
					<li key={i}>{m.data}</li>
				))}
			</ul>
		</>
	);
}
