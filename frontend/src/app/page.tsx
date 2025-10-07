'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/state/app-state';

export default function Home() {
  const { userId, snapshot, setUserId, setSnapshot } = useApp();
  const r = useRouter();
  useEffect(() => {
    if (!userId) r.replace('/login');
    else {
      const s = servers[0];
      const ch = channels.find(c => c.serverId === s.id)!;
      r.replace(`/${s.id}/${ch.id}`);
    }
  }, [user, servers, channels, r]);
  return null;
}

export default function Home() {
	return (
		<>
			<div className="font-sans">Axum and Next.js Template Page</div>
			<ul>
				<li><a className="text-blue-400" href="/swagger-ui/">API Docs</a></li>
				<li><a className="text-blue-400" href="/sse-demo/">SSE Demo</a></li>
				<li><a className="text-blue-400" href="/ws-demo/">WS Demo</a></li>
				<li><a className="text-blue-400" href="/db-demo/">DB Demo</a></li>
			</ul>
		</>
	);
}
