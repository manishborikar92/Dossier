'use client';
// One client-side store for every collection, with debounced autosave per collection.
import { useCallback, useEffect, useRef, useState } from 'react';

export async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = body?.issues ? `${body.error}: ${body.issues.join('; ')}` : body?.error || text || res.statusText;
    throw new Error(detail);
  }
  return body;
}

export function useStore() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const latest = useRef(null);
  const timers = useRef({});
  const pending = useRef(new Set());

  useEffect(() => {
    api('/api/data/_all').then((d) => { latest.current = d; setData(d); }).catch((e) => setError(e.message));
  }, []);

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

  const reload = useCallback(async () => {
    const d = await api('/api/data/_all');
    latest.current = d; setData(d);
  }, []);

  useEffect(() => {
    const warn = (e) => { if (pending.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return { data, update, flush, reload, status, error, setError };
}
