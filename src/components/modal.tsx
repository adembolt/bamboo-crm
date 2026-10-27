"use client";
export function Modal({ title, children, onClose, wide, headerExtra }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; headerExtra?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className={`bg-surface w-full ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"} max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-card p-5 grid gap-4`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="flex items-center gap-2">{headerExtra}<button className="btn ghost sm" onClick={onClose} aria-label="Kapat">✕</button></div>
        </div>
        {children}
      </div>
    </div>
  );
}
