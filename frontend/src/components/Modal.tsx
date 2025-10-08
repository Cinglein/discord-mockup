'use client';
import { useEffect } from 'react';

export function Modal({ open, onClose, children }: { open: boolean; onClose(): void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 grid place-items-center z-50" onClick={onClose}>
      <div className="bg-[#313338] rounded-lg p-6 min-w-[420px]" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
