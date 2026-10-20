// Turns (library data + a resume "recipe") into a flat list of layout blocks.
// The HTML preview, DOCX, PDF and TXT renderers all consume the same blocks,
// so every format shows exactly the same content.
import { resolveTokens, DEFAULT_ORDER, SECTION_TITLES } from './templates.js';

const OWN_LABEL = { college: 'College Project', freelance: 'Freelance Project', personal: 'Personal Project', company: '' };
export const cleanLink = (l) => String(l || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
const byId = (arr = []) => new Map(arr.map((x) => [x.id, x]));

/** Look up everything a resume selects, apply per-resume text overrides, drop dangling ids. */
export function resolveResume(data, resume) {
  const sel = resume.selection || {};
  const ov = resume.overrides || {};
  const o = resume.options || {};
  const text = (id, t) => (typeof ov[id] === 'string' && ov[id].trim() ? ov[id] : t);
  const useShort = o.shortLinks !== false;

  const contactMap = byId(data.profile?.contact);
  const contact = (sel.contactIds || []).map((id) => contactMap.get(id)).filter(Boolean)
    .map((c) => (useShort && c.short ? c.short : c.value)).filter(Boolean);

  const sumMap = byId(data.summaries);
  const s = sel.summaryId ? sumMap.get(sel.summaryId) : null;
  const summary = s ? { id: s.id, text: text(`summary:${s.id}`, s.text), status: s.status } : null;

  const groupMap = byId(data.skills);
  const skills = (sel.skills || []).map((g) => {
    const group = groupMap.get(g.groupId);
    if (!group) return null;
    const im = byId(group.items);
    return { id: group.id, label: group.label, items: (g.items || []).map((i) => im.get(i)).filter(Boolean) };
  }).filter((g) => g && g.items.length);

  const expMap = byId(data.experience);
  const experience = (sel.experience || []).map((e) => {
    const x = expMap.get(e.id);
    if (!x) return null;
    const bm = byId(x.bullets);
    return { ...x, bullets: (e.bullets || []).map((b) => bm.get(b)).filter(Boolean).map((b) => ({ ...b, text: text(b.id, b.text) })) };
  }).filter(Boolean);

  const projMap = byId(data.projects);
  const projects = (sel.projects || []).map((p) => {
    const x = projMap.get(p.id);
    if (!x) return null;
    const bm = byId(x.bullets);
    return { ...x, bullets: (p.bullets || []).map((b) => bm.get(b)).filter(Boolean).map((b) => ({ ...b, text: text(b.id, b.text) })) };
  }).filter(Boolean);

  const pick = (ids = [], arr = []) => { const m = byId(arr); return ids.map((i) => m.get(i)).filter(Boolean); };
  return {
    name: data.profile?.name || '',
    contact, summary, skills, experience, projects,
    education: pick(sel.education, data.education),
    certifications: pick(sel.certifications, data.certifications).map((c) => ({ ...c, text: text(c.id, c.text) })),
    involvement: pick(sel.involvement, data.involvement),
  };
}

/** Flat list of every selected item with its status (used for warnings, coverage, prep). */
export function collectIncluded(r) {
  const out = [];
  if (r.summary) out.push({ section: 'Summary', id: r.summary.id, label: 'Summary', text: r.summary.text, status: r.summary.status });
  for (const g of r.skills) for (const i of g.items) out.push({ section: 'Skills', id: i.id, label: g.label, text: i.name, status: i.status });
  for (const e of r.experience) for (const b of e.bullets) out.push({ section: 'Experience', id: b.id, label: `${e.title} — ${e.company}`, text: b.text, status: b.status });
  for (const p of r.projects) {
    out.push({ section: 'Projects', id: `${p.id}:stack`, label: p.title, text: `${p.title} ${(p.techStack || []).join(' ')}`, status: 'confident' });
    for (const b of p.bullets) out.push({ section: 'Projects', id: b.id, label: p.title, text: b.text, status: b.status });
  }
  for (const c of r.certifications) out.push({ section: 'Certifications', id: c.id, label: 'Certification', text: c.text, status: c.status });
  return out;
}

const bullets = (arr) => arr.map((b) => ({ type: 'bullet', text: b.text, status: b.status }));

const SECTIONS = {
  summary: (r) => (r.summary?.text ? [{ type: 'paragraph', text: r.summary.text, status: r.summary.status }] : []),
  skills: (r) => r.skills.map((g) => ({ type: 'labelValue', label: `${g.label}:`, value: g.items.map((i) => i.name).join(', ') })),
  experience: (r) => r.experience.flatMap((e) => [
    { type: 'entryHeader', primary: e.title, secondary: e.company ? ` — ${e.company}` : '', right: e.dates },
    ...bullets(e.bullets),
  ]),
  projects: (r, o) => r.projects.flatMap((p) => {
    const link = o.showProjectLinks !== false ? cleanLink(p.link) : '';
    const tag = (o.projectTypeLabels || []).includes(p.ownership) ? OWN_LABEL[p.ownership] : '';
    const stack = (p.techStack || []).join(', ') + (tag ? ` — ${tag}` : '');
    return [
      { type: 'entryHeader', primary: p.title + (link ? `  |  ${link}` : ''), secondary: '', right: p.year },
      ...(stack ? [{ type: 'subline', label: 'Tech Stack: ', text: stack }] : []),
      ...bullets(p.bullets),
    ];
  }),
  education: (r) => r.education.flatMap((e) => [
    { type: 'entryHeader', primary: e.degree, secondary: '', right: e.dates },
    { type: 'subline', label: '', text: [e.institution, e.detail].filter(Boolean).join('  |  ') },
  ]),
  certifications: (r) => bullets(r.certifications),
  involvement: (r) => r.involvement.flatMap((e) => [
    { type: 'entryHeader', primary: e.role, secondary: '', right: e.dates },
    { type: 'subline', label: '', text: [e.org, e.text].filter(Boolean).join(' — ') },
  ]),
};

export function buildModel(data, resume) {
  const r = resolveResume(data, resume);
  const tokens = resolveTokens(resume);
  const o = tokens.o;
  const blocks = [];
  blocks.push({ type: 'name', text: o.nameUpper ? r.name.toUpperCase() : r.name });
  if (r.contact.length) blocks.push({ type: 'contact', text: r.contact.join(`  ${o.contactSeparator}  `) });
  blocks.push({ type: 'rule' });
  const order = resume.sectionOrder?.length ? resume.sectionOrder : DEFAULT_ORDER;
  for (const key of order) {
    if (resume.sections?.[key] === false || !SECTIONS[key]) continue;
    const body = SECTIONS[key](r, o);
    if (!body.length) continue;
    if (key === 'projects' && o.projectsOnNewPage) blocks.push({ type: 'pageBreak' });
    blocks.push({ type: 'section', key, text: (resume.titles?.[key] || SECTION_TITLES[key]).toUpperCase() }, ...body);
  }
  return { blocks, tokens, resolved: r };
}
