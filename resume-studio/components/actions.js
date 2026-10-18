'use client';
import { tailor } from '../lib/tailor.js';
import { newResume } from '../lib/defaults.js';
import { uid } from '../lib/ids.js';
import { api } from './store.js';

/** Build (but do not save) a new resume: default content, tailored for a target, or a copy. */
export function buildNewResume(data, { name, mode, targetId, sourceId }) {
  const now = new Date().toISOString();
  if (mode === 'duplicate') {
    const src = data.resumes.find((r) => r.id === sourceId);
    return { ...structuredClone(src), id: uid('resume'), name: name || `${src.name} (copy)`, createdAt: now, updatedAt: now };
  }
  const target = mode === 'tailor' ? data.targets.find((t) => t.id === targetId) : null;
  const { selection } = tailor(data, target);
  return newResume({ name: name || (target ? `${target.name} — tailored` : 'New resume'), targetId: target?.id || null, selection });
}

/** Ask the server (real PDF renderer) to tighten formatting until it fits the target page count. */
export async function fitToPages(resume, target) {
  try {
    return await api('/api/layout', { method: 'POST', body: JSON.stringify({ action: 'fit', resume, target }) });
  } catch { return null; }
}

/** Create, auto-fit, save and return the new resume. */
export async function createResume(store, params) {
  await store.flush(); // the server reads the library from disk when fitting
  let resume = buildNewResume(store.data, params);
  if (params.mode !== 'duplicate') {
    const fit = await fitToPages(resume, resume.options.targetPages || 2);
    if (fit) resume = { ...resume, options: fit.options };
  }
  store.update('resumes', (arr) => [...arr, resume]);
  await store.flush();
  return resume;
}
