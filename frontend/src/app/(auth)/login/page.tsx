'use client';
import { User } from '@/bindings/User';
import { useRouter } from 'next/navigation';
import { useApp } from '@/state/app-state';

export default function Login() {
  const { setUserId } = useApp();
  const r = useRouter();

  async function create_user(name: string) {
		const res = await fetch(`/create-user?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
		try {
			const parsed: User = await res.json();
			setUserId(parsed.id);
		} catch {
			console.error(`Unable to parse server response: ${res}`);
		}
    r.replace(`/`);
  }

  return (
    <main className="min-h-screen bg-[#313338] grid place-items-center">
      <form
        className="grid gap-4 bg-[#2b2d31] p-8 rounded-lg min-w-[420px]"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget as HTMLFormElement);
          const name = (data.get('name') as string)?.trim();
          if (name) create_user(name);
        }}
      >
        <h1 className="text-2xl font-bold text-white text-center">Welcome!</h1>
        <div className="grid gap-2">
          <label className="text-xs font-semibold text-[#b5bac1] uppercase">Username</label>
          <input name="name" className="px-3 py-2.5 rounded bg-[#1e1f22] border border-[#1e1f22] focus:border-[#00a8fc] outline-none text-white" placeholder="Enter your username" autoFocus />
        </div>
        <button className="bg-[#5865f2] hover:bg-[#4752c4] text-white rounded py-2.5 font-medium transition-colors">Continue</button>
      </form>
    </main>
  );
}
