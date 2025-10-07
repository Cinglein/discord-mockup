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
    <main className="min-h-screen flex items-center justify-center">
      <form
        className="space-y-3 bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget as HTMLFormElement);
          const name = (data.get('name') as string)?.trim();
          if (name) create_user(name);
        }}
      >
        <h1 className="text-xl font-semibold">Create a User Account</h1>
        <div className="grid gap-2">
          <label className="text-sm">Username</label>
          <input name="name" className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800 outline-none" placeholder="My User Name" />
        </div>
        <button className="w-full mt-2 bg-indigo-600 text-white rounded-md py-2">Continue</button>
      </form>
    </main>
  );
}
