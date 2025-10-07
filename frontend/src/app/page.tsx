'use client';

import { Server } from '@bindings/Server';
import { Channel } from '@bindings/Channel';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/state/app-state';

export default function Home() {
  const { userId, snapshot } = useApp();
  const r = useRouter();
  useEffect(() => {
    if (!userId) r.replace('/login');
    else if (snapshot !== null) {
			const server: Server | undefined = Object.values(snapshot.servers)[0];
			const channel: Channel | undefined = server?.id 
				? (
					(snapshot.channels[server.id] ?? [])[0] 
					?? undefined
				) 
				: undefined;
			if (server && channel) {
				r.replace(`/ui?server_id=${server.id}&channel_id=${channel.id}`);
			} else {
				r.replace(`/404.html`);
			}

    }
  }, [userId, snapshot, r]);
	return null;
}
