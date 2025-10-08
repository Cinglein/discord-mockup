'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/state/app-state';
import { Modal } from '@/components/Modal';
import { ServerPill, PlusButton } from '@/components/UI';
import { VoiceChannel } from '@/components/VoiceChannel';
import { Server } from '@/bindings/Server';
import { Channel } from '@/bindings/Channel';

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { userId, snapshot } = useApp();
	const r = useRouter();

	if (!snapshot || !userId) {
		r.replace('/');
		return null;
	} else {
		return (
			<div className="grid grid-cols-[72px_240px_1fr] h-screen overflow-hidden bg-[#313338]">
				<Suspense>
					<UiSidebar/>
				</Suspense>

				<Suspense>
					<UiChannelList/>
				</Suspense>

				<section className="flex flex-col bg-[#313338]">{children}</section>

			</div>
		);
	}
}

export function UiCreateChannel() {
  const params = useSearchParams();
	const server_id = parseInt(params.get('server_id') ?? '');
  const [openNewChannel, setOpenNewChannel] = useState(false);

  async function create_channel(name: string, server_id: number) {
    const res = await fetch(`/create-channel?server_id=${server_id}&name=${encodeURIComponent(name)}`, {
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

export function UiSidebar() {
	const { userId, snapshot } = useApp();
  const [openNewServer, setOpenNewServer] = useState(false);
  const [openUserModal, setOpenUserModal] = useState(false);
	const params = useSearchParams();
	const server_id = parseInt(params.get('server_id') ?? '');
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

	if (!snapshot) return (<div>No snapshot found</div>);
	if (!userId) return (<div>No user id found</div>);

	return (
		<aside className="bg-[#1e1f22] grid grid-rows-[auto_2px_1fr_auto] gap-2 p-3">
			<Link href="/" className="w-12 h-12 rounded-2xl bg-[#313338] hover:bg-[#5865f2] hover:rounded-xl transition-all duration-200 grid place-items-center">
				<svg className="w-6 h-6 text-[#b5bac1]" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
				</svg>
			</Link>
			<div className="w-full h-[2px] bg-[#35363c] rounded-full"></div>
			<div className="grid gap-2 content-start">
				{Object.values(snapshot.servers).filter(s => s !== undefined).map(s => (
					<ServerPill key={s.id} href={`/ui?server_id=${s.id}`} label={s.name} active={s.id === server_id}/>
				))}
				<PlusButton onClick={() => setOpenNewServer(true)} />
			</div>
			<div className="grid place-items-center">
				<button onClick={() => setOpenUserModal(true)} className="w-12 h-12 rounded-2xl bg-[#313338] hover:bg-[#35363c] transition-colors grid place-items-center text-[10px] leading-tight text-[#b5bac1]">
					{(snapshot.users[userId]?.name ?? 'U').slice(0, 2).toUpperCase()}
				</button>
			</div>
			<Modal open={openUserModal} onClose={() => setOpenUserModal(false)}>
				<button className="text-[#00a8fc] hover:underline" onClick={ () => r.replace('/login') }>Change User</button>
			</Modal>
			<Modal open={openNewServer} onClose={() => setOpenNewServer(false)}>
				<form className="grid gap-4" onSubmit={(e) => {
					e.preventDefault();
					const name = new FormData(e.currentTarget).get('name') as string;
					if (!name) return;
					create_server(name);
				}}>
					<h2 className="font-semibold text-white text-xl">Create Server</h2>
					<input name="name" className="px-3 py-2 rounded bg-[#1e1f22] border border-[#1e1f22] focus:border-[#00a8fc] outline-none text-white" placeholder="Server name" autoFocus />
					<button className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded px-4 py-2 font-medium transition-colors">Create</button>
				</form>
			</Modal>
		</aside>
	);
}

export function UiChannelList() {
	const { snapshot } = useApp();
	const params = useSearchParams();
	const server_id = parseInt(params.get('server_id') ?? '');
	const channel_id = parseInt(params.get('channel_id') ?? '');
	const [openNewChannel, setOpenNewChannel] = useState(false);
	const r = useRouter();

  async function create_channel(name: string, server_id: number) {
    const res = await fetch(`/create-channel?server_id=${server_id}&name=${encodeURIComponent(name)}`, {
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

	const server: Server | undefined = snapshot?.servers[server_id];
	const channels: Channel[] | undefined = snapshot?.channels[server_id];
	if (!server || !channels) {
		r.replace('/');
		return null;
	}

	return (
		<aside className="bg-[#2b2d31] grid grid-rows-[48px_1fr]">
			<div className="border-b border-[#1e1f22] px-4 grid items-center shadow-sm">
				<h1 className="font-semibold text-white text-base truncate">{server.name}</h1>
			</div>
			<div className="overflow-auto px-2 py-3">
				{/* Voice Channels Section */}
				<div className="mb-3">
					<div className="mb-1 px-2">
						<span className="text-[11px] font-semibold text-[#949ba4] uppercase tracking-wide">Voice Channels</span>
					</div>
					<VoiceChannel channelId={1} serverId={server_id} />
				</div>

				{/* Text Channels Section */}
				<div className="mb-1 px-2 grid grid-cols-[1fr_auto] items-center gap-2">
					<span className="text-[11px] font-semibold text-[#949ba4] uppercase tracking-wide">Text Channels</span>
					<button onClick={() => setOpenNewChannel(true)} className="text-[#949ba4] hover:text-[#dbdee1] transition-colors">
						<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
						</svg>
					</button>
				</div>
				<div className="grid gap-0.5">
					{channels.map(c => (
						<Link key={c.id} href={`/ui?server_id=${server_id}&channel_id=${c.id}`}
							className={`px-2 py-1.5 rounded mx-1 grid grid-cols-[auto_1fr] items-center gap-1.5 ${channel_id === c.id ? 'bg-[#404249] text-white' : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}>
							<svg className="w-5 h-5 text-[#80848e]" fill="currentColor" viewBox="0 0 24 24">
								<path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
							</svg>
							<span className="text-[15px] font-medium">{c.name}</span>
						</Link>
					))}
				</div>
			</div>
			<Modal open={openNewChannel} onClose={() => setOpenNewChannel(false)}>
				<form className="grid gap-4" onSubmit={(e) => {
					e.preventDefault();
					const name = new FormData(e.currentTarget).get('name') as string;
					if (!name) return;
					create_channel(name, server_id);
				}}>
					<h2 className="font-semibold text-white text-xl">Create Channel</h2>
					<input name="name" className="px-3 py-2 rounded bg-[#1e1f22] border border-[#1e1f22] focus:border-[#00a8fc] outline-none text-white" placeholder="new-channel" autoFocus />
					<button className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded px-4 py-2 font-medium transition-colors">Create</button>
				</form>
			</Modal>
		</aside>
	);
}
