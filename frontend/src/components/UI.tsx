'use client';
import Link from 'next/link';

export function ServerPill({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`w-12 h-12 rounded-2xl grid place-items-center text-sm font-medium transition-all duration-200
      ${active ? 'bg-[#5865f2] text-white rounded-xl' : 'bg-[#313338] hover:bg-[#5865f2] hover:rounded-xl text-white'}`}>
      {label.slice(0, 2).toUpperCase()}
    </Link>
  );
}

export function PlusButton({ onClick }: { onClick(): void }) {
  return (
    <button onClick={onClick} className="w-12 h-12 rounded-2xl bg-[#313338] hover:bg-[#23a559] hover:rounded-xl transition-all duration-200 grid place-items-center text-[#23a559] hover:text-white text-3xl font-light">+</button>
  );
}
