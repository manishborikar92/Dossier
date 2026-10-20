'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui';

const ToastContext = createContext(() => {});
const ICON = { ok: 'check', error: 'alert', info: 'info', warn: 'alert' };

/** toast({ title, description?, tone: 'ok'|'error'|'info'|'warn', action?: { label, onClick }, duration? }) */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setItems((a) => a.filter((t) => t.id !== id)), []);
  const toast = useCallback((t) => {
    const id = ++seq.current;
    const item = { tone: 'info', duration: t.tone === 'error' ? 8000 : 5000, ...t, id };
    setItems((a) => [...a.slice(-3), item]);
    if (item.duration) setTimeout(() => dismiss(id), item.duration);
    return id;
  }, [dismiss]);
  const value = useMemo(() => toast, [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={ICON[t.tone] || 'info'} size={18} className="toast__icon" />
            <div className="toast__body"><strong>{t.title}</strong>{t.description && <span>{t.description}</span>}</div>
            {t.action && <button type="button" className="toast__action" onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</button>}
            <button type="button" className="toast__close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
