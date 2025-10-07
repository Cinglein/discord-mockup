'use client';
import Link from 'next/link';

export function ServerPill({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-medium
      ${active ? 'bg-indigo-600 text-white' : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}>
      {label}
    </Link>
  );
}

export function ChannelItem({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`block px-3 py-2 rounded-md text-sm ${active ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
      {label}
    </Link>
  );
}

export function PlusButton({ onClick, size='pill' }: { onClick(): void; size?: 'pill' | 'row' }) {
  return size === 'pill' ? (
    <button onClick={onClick} className="w-12 h-12 rounded-2xl bg-emerald-500 text-white text-xl leading-none">+</button>
  ) : (
    <button onClick={onClick} className="w-full px-3 py-2 rounded-md bg-emerald-500 text-white">+ New</button>
  );
}
