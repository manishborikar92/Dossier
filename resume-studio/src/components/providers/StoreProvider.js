'use client';
// One shared client store for every collection, loaded once and autosaved per collection (debounced).
// Living in the root layout means navigating between pages is instant and the save status is global.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client/api';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const latest = useRef(null);
  const timers = useRef({});
  const pending = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const d = await api('/api/data/_all');
      latest.current = d; setData(d); setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (name) => {
    pending.current.delete(name);
    setStatus('saving');
    try {
      await api(`/api/data/${name}`, { method: 'PUT', body: JSON.stringify(latest.current[name]) });
      setStatus(pending.current.size ? 'saving' : 'saved');
      setError('');
    } catch (e) { setStatus('error'); setError(e.message); }
  }, []);

  /** update('projects', arr => newArr)  or  update('profile', newObject) */
  const update = useCallback((name, next) => {
    const value = typeof next === 'function' ? next(latest.current[name]) : next;
    latest.current = { ...latest.current, [name]: value };
    setData(latest.current);
    pending.current.add(name);
    setStatus('saving');
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(() => save(name), 600);
  }, [save]);

  const flush = useCallback(async () => {
    for (const n of [...pending.current]) { clearTimeout(timers.current[n]); await save(n); }
  }, [save]);

  useEffect(() => {
    const warn = (e) => { if (pending.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const value = useMemo(() => ({ data, update, flush, reload: load, status, error }), [data, update, flush, load, status, error]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
