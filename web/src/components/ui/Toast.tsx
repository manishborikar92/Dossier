'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/classes';

interface ToastItem {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {} });

export const useToast = (): ToastApi => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = ++counter.current;
    setItems((cur) => [...cur, { id, kind, text }]);
    window.setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 3500);
  }, []);
  const api = useMemo<ToastApi>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cx(
              'shadow-pop pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium [animation:dialog-in_160ms_ease-out]',
              t.kind === 'error' ? 'border-bad/30 bg-bad-soft text-bad' : 'border-ok/30 bg-ok-soft text-ok',
            )}
          >
            {t.kind === 'error' ? (
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
