'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, api } from '../../../components/store.js';
import { fitToPages } from '../../../components/actions.js';
import Preview from '../../../components/Preview.js';
import { SaveBadge, StatusBadge, move } from '../../../components/ui.js';
import { buildModel, collectIncluded } from '../../../lib/model.js';
import { analyzeJD, coverage, tailor, isOk } from '../../../lib/tailor.js';
import { TEMPLATES, PAPERS, FONTS, SPACING, DEFAULT_ORDER, SECTION_TITLES, defaultOptions } from '../../../lib/templates.js';

const toggleIn = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
const withCurrent = (list, v) => (list.includes(v) ? list : [...list, v].sort((a, b) => a - b));
const WHERE = { available: ['warn', 'in library, not selected'], 'needs-review': ['warn', 'needs review'], excluded: ['mute', 'excluded by you'], absent: ['bad', 'not in library'] };

function Panel({ title, children, open = false, badge }) {
  return (
    <details className="panel" open={open}>
      <summary>{title}{badge ? <span className="badge info" style={{ marginLeft: 8 }}>{badge}</span> : null}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

/** Checklist of an entry's bullets: selected ones first (reorderable), then the rest. */
function BulletPicker({ bullets, selected, overrides, onToggle, onMove, onOverride }) {
  const [editing, setEditing] = useState(null);
  const ordered = [...selected.map((id) => bullets.find((b) => b.id === id)).filter(Boolean), ...bullets.filter((b) => !selected.includes(b.id))];
  return (
    <div style={{ marginLeft: 22 }}>
      {ordered.map((b) => {
        const on = selected.includes(b.id);
        const text = overrides[b.id] ?? b.text;
        return (
          <div key={b.id} className="pick">
            <input type="checkbox" checked={on} onChange={() => onToggle(b.id)} />
            <div className={`txt ${on ? '' : 'off'}`}>
              {editing === b.id
                ? <textarea rows={3} autoFocus value={text} onChange={(e) => onOverride(b.id, e.target.value, b.text)} onBlur={() => setEditing(null)} />
                : <span style={{ fontSize: 13 }}>{text}</span>}
              {' '}{b.status !== 'confident' && <StatusBadge status={b.status} />}
              {overrides[b.id] !== undefined && <> <span className="badge info">edited for this resume</span> <a href="#reset" className="small" onClick={(e) => { e.preventDefault(); onOverride(b.id, undefined, b.text); }}>reset</a></>}
            </div>
            <span className="mini">
              {on && <button type="button" onClick={() => onMove(b.id, -1)} title="Move up">▲</button>}
              {on && <button type="button" onClick={() => onMove(b.id, 1)} title="Move down">▼</button>}
              <button type="button" title="Edit wording for this resume only" onClick={() => setEditing(editing === b.id ? null : b.id)}>✎</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Composer() {
  const { id } = useParams();
  const store = useStore();
  const { data, update, flush, status, error } = store;
  const resume = data?.resumes.find((r) => r.id === id);
  const [zoom, setZoom] = useState(0.85);
  const [pages, setPages] = useState(null);
  const [fitMsg, setFitMsg] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const model = useMemo(() => (resume ? buildModel(data, resume) : null), [data, resume]);
  const included = useMemo(() => (model ? collectIncluded(model.resolved) : []), [model]);
  const target = data?.targets.find((t) => t.id === resume?.targetId) || null;
  const kws = useMemo(() => (target ? analyzeJD(target.jd, target.keywords) : []), [target]);
  const cov = useMemo(() => (resume && kws.length ? coverage(data, resume, kws) : null), [data, resume, kws]);

  // Exact page count from the real PDF renderer (debounced).
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

  if (!data) return <div className="page muted">{error || 'Loading…'}</div>;
  if (!resume) return <div className="page">Resume not found. <Link href="/">Back to resumes</Link></div>;

  const o = { ...defaultOptions(resume.template), ...resume.options };
  const sel = resume.selection;
  const order = resume.sectionOrder?.length ? resume.sectionOrder : DEFAULT_ORDER;

  const setResume = (fn) => update('resumes', (arr) => arr.map((r) => (r.id === id ? { ...fn(r), updatedAt: new Date().toISOString() } : r)));
  const patchSel = (p) => setResume((r) => ({ ...r, selection: { ...r.selection, ...p } }));
  const opt = (k, v) => setResume((r) => ({ ...r, options: { ...r.options, [k]: v } }));
  const applyTemplate = (key) => setResume((r) => ({ ...r, template: key, options: { ...r.options, ...TEMPLATES[key].defaults } }));
  const setOverride = (key, text, original) => setResume((r) => {
    const ov = { ...r.overrides };
    if (text === undefined || text === original) delete ov[key]; else ov[key] = text;
    return { ...r, overrides: ov };
  });

  const toggleSkill = (groupId, itemId) => setResume((r) => {
    const s = r.selection.skills;
    const g = s.find((x) => x.groupId === groupId);
    const next = !g ? [...s, { groupId, items: [itemId] }] : s.map((x) => (x.groupId !== groupId ? x : { ...x, items: toggleIn(x.items, itemId) })).filter((x) => x.items.length);
    return { ...r, selection: { ...r.selection, skills: next } };
  });
  const toggleEntry = (key, entryId, defaults) => patchSel({ [key]: sel[key].some((e) => e.id === entryId) ? sel[key].filter((e) => e.id !== entryId) : [...sel[key], { id: entryId, bullets: defaults }] });
  const toggleBullet = (key, entryId, bId) => patchSel({ [key]: sel[key].map((e) => (e.id !== entryId ? e : { ...e, bullets: toggleIn(e.bullets, bId) })) });
  const moveBullet = (key, entryId, bId, d) => patchSel({ [key]: sel[key].map((e) => (e.id !== entryId ? e : { ...e, bullets: move(e.bullets, e.bullets.indexOf(bId), d) })) });
  const moveEntry = (key, entryId, d) => patchSel({ [key]: move(sel[key], sel[key].findIndex((e) => e.id === entryId), d) });
  const moveSection = (key, d) => setResume((r) => ({ ...r, sectionOrder: move(order, order.indexOf(key), d) }));
  const toggleSection = (key) => setResume((r) => ({ ...r, sections: { ...r.sections, [key]: r.sections?.[key] === false } }));

  const exportAs = async (fmt) => {
    await flush();
    const url = `/api/export/${id}?format=${fmt}`;
    if (fmt === 'pdf') window.open(`${url}&inline=1`, '_blank'); else window.location.assign(url);
  };
  const fit = async () => {
    await flush();
    const r = await fitToPages(resume, o.targetPages);
    if (!r) { setFitMsg({ ok: false, text: 'Could not measure the layout.' }); return; }
    setResume((x) => ({ ...x, options: r.options }));
    setFitMsg(r.fitted ? { ok: true, text: r.step === 0 ? `Already fits in ${r.pages} page${r.pages > 1 ? 's' : ''}.` : `Fits in ${r.pages} page${r.pages > 1 ? 's' : ''} after tightening spacing/margins/type.` }
      : { ok: false, text: `Still ${r.pages} pages at the tightest setting. Remove a project or a few bullets.` });
  };
  const retailor = () => {
    if (!target) return;
    if (!confirm('Replace the current selection with a fresh auto-tailored one? Your formatting and per-resume wording edits are kept.')) return;
    patchSel(tailor(data, target).selection);
  };

  const archivedOk = (p) => p.visible !== false || showArchived || sel.projects.some((x) => x.id === p.id);
  const projectsOrdered = [...sel.projects.map((s) => data.projects.find((p) => p.id === s.id)).filter(Boolean), ...data.projects.filter((p) => archivedOk(p) && !sel.projects.some((s) => s.id === p.id))];
  const notConfident = included.filter((i) => i.status !== 'confident');
  const longBullets = included.filter((i) => (i.section === 'Experience' || i.section === 'Projects') && i.text.length > 280).length;
  const hasEmail = model.resolved.contact.some((c) => c.includes('@'));
  const hasPhone = model.resolved.contact.some((c) => c.replace(/\D/g, '').length >= 10);

  return (
    <>
      <div className="topbar noprint">
        <Link href="/">← Resumes</Link>
        <input className="name" value={resume.name} onChange={(e) => setResume((r) => ({ ...r, name: e.target.value }))} />
        <SaveBadge status={status} error={error} />
        <span style={{ flex: 1 }} />
        <Link className="btn sm" href={`/prep/${id}`}>Interview prep</Link>
        <button className="btn sm" onClick={() => exportAs('txt')}>Text</button>
        <button className="btn sm" onClick={() => exportAs('pdf')}>Open PDF</button>
        <button className="btn sm primary" onClick={() => exportAs('docx')}>Download DOCX</button>
      </div>

      <div className="composer">
        {/* ---------- left: what goes in ---------- */}
        <div className="col noprint">
          <Panel title="Sections & order" open>
            {order.map((key, i) => (
              <div key={key} className="pick">
                <input type="checkbox" checked={resume.sections?.[key] !== false} onChange={() => toggleSection(key)} />
                <span className="txt">{SECTION_TITLES[key]}</span>
                <span className="mini"><button onClick={() => moveSection(key, -1)} disabled={i === 0}>▲</button><button onClick={() => moveSection(key, 1)} disabled={i === order.length - 1}>▼</button></span>
              </div>
            ))}
          </Panel>

          <Panel title="Summary">
            <select value={sel.summaryId || ''} onChange={(e) => patchSel({ summaryId: e.target.value || null })} style={{ marginBottom: 8 }}>
              <option value="">(none)</option>
              {data.summaries.map((s) => <option key={s.id} value={s.id}>{s.label}{s.status !== 'confident' ? ' (needs review)' : ''}</option>)}
            </select>
            {sel.summaryId && (() => {
              const s = data.summaries.find((x) => x.id === sel.summaryId);
              if (!s) return null;
              const key = `summary:${s.id}`;
              return <><textarea rows={6} value={resume.overrides[key] ?? s.text} onChange={(e) => setOverride(key, e.target.value, s.text)} />{resume.overrides[key] !== undefined && <a href="#reset" className="small" onClick={(e) => { e.preventDefault(); setOverride(key, undefined, s.text); }}>reset to library text</a>}</>;
            })()}
          </Panel>

          <Panel title="Contact line" badge={`${sel.contactIds.length}/${data.profile.contact.length}`}>
            {data.profile.contact.map((c) => (
              <label key={c.id} className="pick"><input type="checkbox" checked={sel.contactIds.includes(c.id)} onChange={() => patchSel({ contactIds: toggleIn(sel.contactIds, c.id) })} /><span className="txt">{c.value}</span><span className="small muted">{c.type}</span></label>
            ))}
          </Panel>

          <Panel title="Skills" badge={sel.skills.reduce((n, g) => n + g.items.length, 0)}>
            {data.skills.map((g) => {
              const usable = g.items.filter((i) => i.status !== 'exclude');
              if (!usable.length) return null;
              const chosen = sel.skills.find((x) => x.groupId === g.id)?.items || [];
              return (
                <div key={g.id} className="entry">
                  <div className="small muted" style={{ marginBottom: 2 }}>{g.label}</div>
                  {usable.map((it) => (
                    <label key={it.id} className="pick"><input type="checkbox" checked={chosen.includes(it.id)} onChange={() => toggleSkill(g.id, it.id)} /><span className="txt">{it.name}</span>{it.status !== 'confident' ? <StatusBadge status={it.status} /> : <span />}</label>
                  ))}
                </div>
              );
            })}
            <div className="small muted" style={{ marginTop: 6 }}>Skills you excluded in the Library are hidden here on purpose.</div>
          </Panel>

          <Panel title="Experience" open badge={sel.experience.length}>
            {data.experience.filter((e) => e.visible !== false).map((e) => {
              const entry = sel.experience.find((x) => x.id === e.id);
              return (
                <div key={e.id} className="entry">
                  <label className="pick">
                    <input type="checkbox" checked={!!entry} onChange={() => toggleEntry('experience', e.id, e.bullets.filter(isOk).slice(0, 5).map((b) => b.id))} />
                    <span className="txt"><b>{e.title}</b><br /><span className="small muted">{e.company} · {e.dates}</span></span>
                    {entry ? <span className="mini"><button onClick={() => moveEntry('experience', e.id, -1)}>▲</button><button onClick={() => moveEntry('experience', e.id, 1)}>▼</button></span> : <span />}
                  </label>
                  {entry && <BulletPicker bullets={e.bullets} selected={entry.bullets} overrides={resume.overrides}
                    onToggle={(b) => toggleBullet('experience', e.id, b)} onMove={(b, d) => moveBullet('experience', e.id, b, d)} onOverride={setOverride} />}
                </div>
              );
            })}
          </Panel>

          <Panel title="Projects" open badge={sel.projects.length}>
            {projectsOrdered.map((p) => {
              const entry = sel.projects.find((x) => x.id === p.id);
              return (
                <div key={p.id} className="entry">
                  <label className="pick">
                    <input type="checkbox" checked={!!entry} onChange={() => toggleEntry('projects', p.id, p.bullets.filter(isOk).slice(0, 4).map((b) => b.id))} />
                    <span className="txt"><b>{p.title}</b><br /><span className="small muted">{p.ownership}{p.year ? ` · ${p.year}` : ''}{p.visible === false ? ' · archived' : ''}{!p.bullets.some(isOk) ? ' · no confident bullets yet' : ''}</span></span>
                    {entry ? <span className="mini"><button onClick={() => moveEntry('projects', p.id, -1)}>▲</button><button onClick={() => moveEntry('projects', p.id, 1)}>▼</button></span> : <span />}
                  </label>
                  {entry && <BulletPicker bullets={p.bullets} selected={entry.bullets} overrides={resume.overrides}
                    onToggle={(b) => toggleBullet('projects', p.id, b)} onMove={(b, d) => moveBullet('projects', p.id, b, d)} onOverride={setOverride} />}
                </div>
              );
            })}
            <label className="row gap-s small" style={{ marginTop: 8 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived projects</label>
          </Panel>

          <Panel title="Education" badge={sel.education.length}>
            {data.education.map((e) => <label key={e.id} className="pick"><input type="checkbox" checked={sel.education.includes(e.id)} onChange={() => patchSel({ education: toggleIn(sel.education, e.id) })} /><span className="txt">{e.degree}<br /><span className="small muted">{e.institution}</span></span><span /></label>)}
          </Panel>
          <Panel title="Certifications" badge={sel.certifications.length}>
            {data.certifications.map((c) => <label key={c.id} className="pick"><input type="checkbox" checked={sel.certifications.includes(c.id)} onChange={() => patchSel({ certifications: toggleIn(sel.certifications, c.id) })} /><span className="txt" style={{ fontSize: 13 }}>{c.text}</span>{c.status !== 'confident' ? <StatusBadge status={c.status} /> : <span />}</label>)}
          </Panel>
          <Panel title="Leadership & involvement" badge={sel.involvement.length}>
            {data.involvement.map((c) => <label key={c.id} className="pick"><input type="checkbox" checked={sel.involvement.includes(c.id)} onChange={() => patchSel({ involvement: toggleIn(sel.involvement, c.id) })} /><span className="txt">{c.role}</span><span /></label>)}
          </Panel>
        </div>

        {/* ---------- centre: preview ---------- */}
        <div>
          <div className="row spread noprint" style={{ marginBottom: 8 }}>
            <span className="small muted">Live preview · dashed lines show approximate page breaks; the exported file is the reference</span>
            <label className="row gap-s small">Zoom
              <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: 80 }}>{[0.6, 0.7, 0.85, 1, 1.15].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}</select>
            </label>
          </div>
          <div className="preview-scroll"><Preview model={model} zoom={zoom} /></div>
        </div>

        {/* ---------- right: format, checks ---------- */}
        <div className="col noprint">
          <Panel title="Template" open>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <button key={k} className={`btn ${resume.template === k ? 'primary' : ''}`} onClick={() => applyTemplate(k)} title={t.note}>{t.label}</button>
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>{TEMPLATES[resume.template]?.note} All templates are single-column with standard fonts, so applicant-tracking systems read them correctly.</div>
          </Panel>

          <Panel title="Length" open>
            <div className="row spread" style={{ marginBottom: 6 }}>
              <span>Exact pages: <b>{pages ?? '…'}</b></span>
              <label className="row gap-s small">Target
                <select value={o.targetPages} onChange={(e) => opt('targetPages', Number(e.target.value))} style={{ width: 64 }}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select>
              </label>
            </div>
            {pages != null && pages > o.targetPages && <div className="notice small">Over your {o.targetPages}-page target.</div>}
            {pages != null && pages <= o.targetPages && <div className="notice ok small">Within your {o.targetPages}-page target.</div>}
            <button className="btn sm" onClick={fit}>Fit to {o.targetPages} page{o.targetPages > 1 ? 's' : ''}</button>
            {fitMsg && <div className={`small ${fitMsg.ok ? '' : 'muted'}`} style={{ marginTop: 6, color: fitMsg.ok ? '#1e6b34' : '#8a1f15' }}>{fitMsg.text}</div>}
            <div className="small muted" style={{ marginTop: 6 }}>Fitting only adjusts spacing, margins and type size. It never deletes content.</div>
          </Panel>

          <Panel title="Target & keywords" open>
            <select value={resume.targetId || ''} onChange={(e) => setResume((r) => ({ ...r, targetId: e.target.value || null }))} style={{ marginBottom: 8 }}>
              <option value="">(no target)</option>
              {data.targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {target && <button className="btn sm" onClick={retailor}>Re-run auto-tailor</button>}
            {cov && (
              <div style={{ marginTop: 10 }}>
                <div className="row spread small"><span>Keyword coverage</span><b>{cov.pct}%</b></div>
                <div className="bar"><i style={{ width: `${cov.pct}%` }} /></div>
                <div style={{ marginTop: 8 }}>{cov.matched.map((k) => <span key={k.key} className="chip good">{k.label}</span>)}</div>
                <div className="small muted" style={{ marginTop: 6 }}>Not on this resume:</div>
                <div>{cov.missing.map((k) => <span key={k.key} className={`chip ${WHERE[k.where][0]}`} title={WHERE[k.where][1]}>{k.label}</span>)}</div>
              </div>
            )}
            {!target && <div className="small muted">Choose a target to see how well this resume matches its keywords.</div>}
          </Panel>

          <Panel title="Honesty & ATS checks" open badge={notConfident.length ? `${notConfident.length} to review` : 'all confident'}>
            {notConfident.length > 0
              ? <div className="notice small"><b>{notConfident.length} item(s) on this resume are not marked Confident:</b><ul style={{ margin: '6px 0 0 16px', padding: 0 }}>{notConfident.slice(0, 6).map((i) => <li key={i.id}>{i.label}: {i.text.slice(0, 60)}…</li>)}</ul>Review them in Library → Review queue, or untick them here.</div>
              : <div className="notice ok small">Every item on this resume is marked Confident.</div>}
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>{hasEmail ? '✓' : '⚠'} Email {hasEmail ? 'present' : 'missing from the contact line'}</li>
              <li>{hasPhone ? '✓' : '⚠'} Phone {hasPhone ? 'present' : 'missing from the contact line'}</li>
              <li>{longBullets ? `⚠ ${longBullets} bullet(s) over 280 characters - consider trimming` : '✓ Bullet lengths are readable'}</li>
              <li>{sel.projects.length > 4 ? '⚠ More than 4 projects: depth beats quantity' : `✓ ${sel.projects.length} project(s)`}</li>
              <li>✓ Single column, standard fonts, no tables, text boxes or images</li>
            </ul>
          </Panel>

          <Panel title="Formatting">
            <div className="grid two" style={{ gap: 8 }}>
              <label className="field"><span>Paper</span><select value={o.paper} onChange={(e) => opt('paper', e.target.value)}>{Object.entries(PAPERS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></label>
              <label className="field"><span>Font</span><select value={o.fontFamily} onChange={(e) => opt('fontFamily', e.target.value)}>{Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></label>
              <label className="field"><span>Font size (pt)</span><select value={o.fontSize} onChange={(e) => opt('fontSize', Number(e.target.value))}>{withCurrent([8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12], Number(o.fontSize)).map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className="field"><span>Spacing</span><select value={o.spacing} onChange={(e) => opt('spacing', e.target.value)}>{Object.keys(SPACING).map((k) => <option key={k}>{k}</option>)}</select></label>
              <label className="field"><span>Margins (in)</span><select value={o.margin} onChange={(e) => opt('margin', Number(e.target.value))}>{withCurrent([0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1], Number(o.margin)).map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className="field"><span>Accent colour</span><input type="color" value={o.accent} onChange={(e) => opt('accent', e.target.value)} /></label>
              <label className="field"><span>Name alignment</span><select value={o.nameAlign} onChange={(e) => opt('nameAlign', e.target.value)}><option value="center">Centered</option><option value="left">Left</option></select></label>
              <label className="field"><span>Headings</span><select value={o.sectionStyle} onChange={(e) => opt('sectionStyle', e.target.value)}><option value="rule">Underlined</option><option value="plain">Plain</option></select></label>
              <label className="field"><span>Contact separator</span><select value={o.contactSeparator} onChange={(e) => opt('contactSeparator', e.target.value)}>{['·', '|', '•', '/', '–'].map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
            {[['nameUpper', 'Name in capitals'], ['shortLinks', 'Short links (in/yourname)'], ['showProjectLinks', 'Show project links'], ['projectsOnNewPage', 'Start Projects on a new page']].map(([k, l]) => (
              <label key={k} className="row gap-s" style={{ marginBottom: 4 }}><input type="checkbox" checked={!!o[k]} onChange={(e) => opt(k, e.target.checked)} />{l}</label>
            ))}
            <div className="small muted" style={{ margin: '8px 0 4px' }}>Label these project types</div>
            <div className="row wrap">{['college', 'freelance', 'personal', 'company'].map((t) => (
              <label key={t} className="row gap-s small"><input type="checkbox" checked={(o.projectTypeLabels || []).includes(t)} onChange={() => opt('projectTypeLabels', toggleIn(o.projectTypeLabels || [], t))} />{t}</label>
            ))}</div>
            <label className="field" style={{ marginTop: 10 }}><span>Download file name (without extension)</span><input value={o.fileName} placeholder={`${data.profile.name.replace(/\s+/g, '-')}-Resume`} onChange={(e) => opt('fileName', e.target.value)} /></label>
          </Panel>
        </div>
      </div>
    </>
  );
}
