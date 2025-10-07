'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/state/app-state';
import { Modal } from '@/components/Modal';
import { ServerPill, PlusButton } from '@/components/UI';
import { Server } from '@/bindings/Server';
import { Channel } from '@/bindings/Channel';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [openNewServer, setOpenNewServer] = useState(false);
  const [openUserModal, setOpenUserModal] = useState(false);
	const { userId, snapshot } = useApp();
	const r = useRouter();

  async function create_server(name: string) {
    const res = await fetch(`/create-server?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    try {
      const parsed: Server = await res.json();
			console.log(parsed);
    } catch {
      console.error(`Unable to parse server response`, res);
    }
		setOpenNewServer(false);
  }

	if (!userId || !snapshot) {
		r.replace('/');
		return null;
	} else {
		return (
			<div className="grid grid-cols-[64px_220px_1fr] h-screen">
				<aside className="border-r border-zinc-200 dark:border-zinc-800 p-2 flex flex-col items-center gap-2">
					<Link href="/" className="mb-2 text-xs text-zinc-500">Home</Link>
					{Object.values(snapshot.servers).filter(s => s !== undefined).map(s => (
						<ServerPill key={s.id} href={`/ui`} label={s.name}/>
					))}
					<PlusButton onClick={() => setOpenNewServer(true)} />
					<div className="mt-auto w-full">
						<button onClick={() => setOpenUserModal(true)} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[10px] leading-tight">
							{(snapshot.users[userId]?.name ?? 'Set User')}
						</button>
					</div>
				</aside>

				<section className="overflow-auto">{children}</section>

				<Modal open={openNewServer} onClose={() => setOpenNewServer(false)}>
					<form onSubmit={(e) => { 
						e.preventDefault(); 
						const name = new FormData(e.currentTarget).get('name') as string; 
						if (!name) return; 
						create_server(name);
					}}>
						<h2 className="font-semibold mb-2">Create server</h2>
						<input name="name" className="w-full px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" placeholder="Server name" />
						<button className="mt-3 bg-emerald-600 text-white rounded-md px-3 py-2">Create</button>
					</form>
				</Modal>

				<Suspense>
					<UiCreateChannel/>
				</Suspense>

				<Modal open={openUserModal} onClose={() => setOpenUserModal(false)}>
					<button onClick={ () => r.replace('/login') }>Set User</button>
				</Modal>
			</div>
		);
	}
}

export function UiCreateChannel() {
  const params = useSearchParams();
	const server_id = parseInt(params.get('server_id') ?? '');
  const [openNewChannel, setOpenNewChannel] = useState(false);

  async function create_channel(name: string, server_id: number) {
    const res = await fetch(`/create-channel?id=${server_id}&name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    try {
      const parsed: Channel = await res.json();
			console.log(parsed);
    } catch {
      console.error(`Unable to parse server response`, res);
    }
		setOpenNewChannel(false);
  }

	return (
		<Modal open={openNewChannel} onClose={() => setOpenNewChannel(false)}>
			<form onSubmit={(e) => { 
				e.preventDefault(); 
				const name = new FormData(e.currentTarget).get('name') as string; 
				if (!name) return; 
				create_channel(name, server_id);
			}}>
				<h2 className="font-semibold mb-2">Create channel</h2>
				<input name="name" className="w-full px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800" placeholder="# new-channel" />
				<button className="mt-3 bg-emerald-600 text-white rounded-md px-3 py-2">Create</button>
			</form>
		</Modal>
	);
}
