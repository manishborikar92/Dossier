'use client';
// All state and actions for editing one resume. Every action is a functional update on the stored recipe,
// so panels can share them without stale closures.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/components/providers/StoreProvider';
import { api } from '@/lib/client/api';
import { fitToPages } from '@/lib/client/actions';
import { buildModel, collectIncluded } from '@/lib/domain/model';
import { analyzeJD, coverage } from '@/lib/domain/tailor';
import { DEFAULT_ORDER, TEMPLATES, defaultOptions } from '@/lib/domain/templates';
import { move, toggleIn } from '@/lib/client/format';

export function useResumeEditor(id) {
  const { data, update, flush, status, error } = useStore();
  const resume = data?.resumes.find((r) => r.id === id) ?? null;
  const setResume = useCallback((fn) => update('resumes', (arr) => arr.map((r) => (r.id === id ? { ...fn(r), updatedAt: new Date().toISOString() } : r))), [update, id]);

  const options = useMemo(() => (resume ? { ...defaultOptions(resume.template), ...resume.options } : null), [resume]);
  const model = useMemo(() => (resume ? buildModel(data, resume) : null), [data, resume]);
  const included = useMemo(() => (model ? collectIncluded(model.resolved) : []), [model]);
  const target = data?.targets.find((t) => t.id === resume?.targetId) || null;
  const kws = useMemo(() => (target ? analyzeJD(target.jd, target.keywords) : []), [target]);
  const cov = useMemo(() => (resume && kws.length ? coverage(data, resume, kws) : null), [data, resume, kws]);

  // Exact page count from the real PDF renderer (debounced).
  const [pages, setPages] = useState(null);
  const sig = resume ? JSON.stringify([resume.selection, resume.options, resume.overrides, resume.sectionOrder, resume.sections, resume.titles, resume.template]) : '';
  useEffect(() => {
    if (!resume) return undefined;
    let dead = false;
    const t = setTimeout(async () => {
      try { const r = await api('/api/layout', { method: 'POST', body: JSON.stringify({ action: 'measure', resume }) }); if (!dead) setPages(r.pages); }
      catch { if (!dead) setPages(null); }
    }, 700);
    return () => { dead = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const checks = useMemo(() => {
    if (!model) return null;
    const contact = model.resolved.contact;
    return {
      notConfident: included.filter((i) => i.status !== 'confident'),
      longBullets: included.filter((i) => (i.section === 'Experience' || i.section === 'Projects') && i.text.length > 280).length,
      hasEmail: contact.some((c) => c.includes('@')),
      hasPhone: contact.some((c) => c.replace(/\D/g, '').length >= 10),
      projects: resume.selection.projects.length,
    };
  }, [model, included, resume]);

  const actions = useMemo(() => {
    const patchSel = (p) => setResume((r) => ({ ...r, selection: { ...r.selection, ...p } }));
    const sel = (fn) => setResume((r) => ({ ...r, selection: fn(r.selection) }));
    return {
      rename: (name) => setResume((r) => ({ ...r, name })),
      setTarget: (targetId) => setResume((r) => ({ ...r, targetId: targetId || null })),
      patchSel,
      opt: (k, v) => setResume((r) => ({ ...r, options: { ...r.options, [k]: v } })),
      patchOptions: (o) => setResume((r) => ({ ...r, options: { ...r.options, ...o } })),
      applyTemplate: (key) => setResume((r) => ({ ...r, template: key, options: { ...r.options, ...TEMPLATES[key].defaults } })),
      setOverride: (key, text, original) => setResume((r) => {
        const ov = { ...r.overrides };
        if (text === undefined || text === original) delete ov[key]; else ov[key] = text;
        return { ...r, overrides: ov };
      }),
      toggleList: (key, itemId) => sel((s) => ({ ...s, [key]: toggleIn(s[key], itemId) })),
      toggleSkill: (groupId, itemId) => sel((s) => {
        const g = s.skills.find((x) => x.groupId === groupId);
        const skills = !g ? [...s.skills, { groupId, items: [itemId] }] : s.skills.map((x) => (x.groupId !== groupId ? x : { ...x, items: toggleIn(x.items, itemId) })).filter((x) => x.items.length);
        return { ...s, skills };
      }),
      toggleEntry: (key, entryId, defaults) => sel((s) => ({ ...s, [key]: s[key].some((e) => e.id === entryId) ? s[key].filter((e) => e.id !== entryId) : [...s[key], { id: entryId, bullets: defaults }] })),
      toggleBullet: (key, entryId, bId) => sel((s) => ({ ...s, [key]: s[key].map((e) => (e.id !== entryId ? e : { ...e, bullets: toggleIn(e.bullets, bId) })) })),
      moveBullet: (key, entryId, bId, d) => sel((s) => ({ ...s, [key]: s[key].map((e) => (e.id !== entryId ? e : { ...e, bullets: move(e.bullets, e.bullets.indexOf(bId), d) })) })),
      moveEntry: (key, entryId, d) => sel((s) => ({ ...s, [key]: move(s[key], s[key].findIndex((e) => e.id === entryId), d) })),
      moveSection: (key, d) => setResume((r) => { const order = r.sectionOrder?.length ? r.sectionOrder : DEFAULT_ORDER; return { ...r, sectionOrder: move(order, order.indexOf(key), d) }; }),
      toggleSection: (key) => setResume((r) => ({ ...r, sections: { ...r.sections, [key]: r.sections?.[key] === false } })),
    };
  }, [setResume]);

  const fit = useCallback(async () => {
    await flush();
    const r = await fitToPages(resume, options.targetPages);
    if (r) setResume((x) => ({ ...x, options: r.options }));
    return r;
  }, [flush, resume, options, setResume]);

  const exportAs = useCallback(async (fmt, inline) => {
    await flush();
    const url = `/api/export/${id}?format=${fmt}`;
    if (inline) window.open(`${url}&inline=1`, '_blank'); else window.location.assign(url);
  }, [flush, id]);

  return { data, resume, options, model, included, target, kws, cov, pages, checks, status, error, flush, fit, exportAs, ...actions };
}
