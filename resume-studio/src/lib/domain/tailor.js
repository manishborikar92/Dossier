// Deterministic tailoring: match a job description against your library and pick the best content.
// No AI, no invention - it only ever selects items you already wrote, and by default
// only items you marked "confident".
import { extractTerms, TERM_LABELS } from './terms.js';
import { resolveResume, collectIncluded } from './model.js';
import { emptySelection } from './defaults.js';

export const isOk = (x) => x.status === 'confident';

/** Keywords for a target: dictionary terms found in the JD, plus the user's must-have keywords. */
export function analyzeJD(jd = '', custom = []) {
  const out = new Map();
  for (const [key, n] of extractTerms(jd)) {
    out.set(key, { key, label: TERM_LABELS[key] || key, weight: 1 + Math.min(2, n - 1) * 0.5, must: false, custom: false });
  }
  for (const raw of custom.map((s) => s.trim()).filter(Boolean)) {
    const known = [...extractTerms(raw).keys()];
    if (known.length) {
      for (const k of known) {
        const e = out.get(k);
        if (e) { e.weight += 2; e.must = true; }
        else out.set(k, { key: k, label: TERM_LABELS[k] || k, weight: 3, must: true, custom: false });
      }
    } else {
      out.set(`custom:${raw.toLowerCase()}`, { key: `custom:${raw.toLowerCase()}`, label: raw, weight: 3, must: true, custom: true });
    }
  }
  return [...out.values()].sort((a, b) => b.weight - a.weight);
}

/** Which of the given keywords appear in this text. */
export function matchKeys(text, kws) {
  const found = extractTerms(text);
  const lower = String(text).toLowerCase();
  return kws.filter((k) => (k.custom ? lower.includes(k.label.toLowerCase()) : found.has(k.key))).map((k) => k.key);
}

export function scoreText(text, kws) {
  const hit = new Set(matchKeys(text, kws));
  return kws.reduce((s, k) => s + (hit.has(k.key) ? k.weight : 0), 0);
}

function topN(arr, n, textOf, kws) {
  const ranked = arr.map((x, i) => ({ x, i, s: scoreText(textOf(x), kws) }));
  ranked.sort((a, b) => b.s - a.s || a.i - b.i);
  return ranked.slice(0, n).sort((a, b) => a.i - b.i).map((r) => r.x);
}

/** Every library item (any status) as plain text, to explain *why* a keyword is missing. */
function libraryItems(data) {
  const items = [];
  for (const e of data.experience) for (const b of e.bullets) items.push({ text: b.text, status: b.status });
  for (const p of data.projects) {
    const stack = `${p.title} ${(p.techStack || []).join(' ')}`;
    for (const b of p.bullets) items.push({ text: `${stack} ${b.text}`, status: b.status });
  }
  for (const g of data.skills) for (const i of g.items) items.push({ text: i.name, status: i.status });
  for (const c of data.certifications) items.push({ text: c.text, status: c.status });
  return items;
}

/** How well a resume covers a target's keywords, and why the missing ones are missing. */
export function coverage(data, resume, kws) {
  const r = resolveResume(data, resume);
  const text = collectIncluded(r).map((i) => i.text).join('\n');
  const have = new Set(matchKeys(text, kws));
  const lib = libraryItems(data);
  const matched = kws.filter((k) => have.has(k.key));
  const missing = kws.filter((k) => !have.has(k.key)).map((k) => {
    const st = lib.filter((it) => matchKeys(it.text, [k]).length).map((it) => it.status);
    // Your explicit "exclude" decision outranks a knowledge-base bullet that merely mentions the term.
    const where = st.includes('confident') ? 'available' : st.includes('exclude') ? 'excluded' : st.includes('prep') ? 'needs-review' : 'absent';
    return { ...k, where };
  });
  const total = kws.reduce((s, k) => s + k.weight, 0) || 1;
  const got = matched.reduce((s, k) => s + k.weight, 0);
  return { pct: kws.length ? Math.round((got / total) * 100) : null, matched, missing };
}

/**
 * Build a resume selection for a target (or null target = sensible defaults).
 * Returns { selection, kws, report }.
 */
export function tailor(data, target, o = {}) {
  const opts = { maxProjects: 3, bulletsPerProject: 4, firstJobBullets: 5, otherJobBullets: 3, maxCerts: 4, ...o };
  const kws = analyzeJD(target?.jd || '', target?.keywords || []);
  const sel = emptySelection();

  sel.contactIds = (data.profile?.contact || []).filter((c) => c.on !== false).map((c) => c.id);

  const summaries = data.summaries.filter(isOk);
  sel.summaryId = (topN(summaries, 1, (s) => s.text, kws)[0] || summaries[0])?.id ?? null;

  for (const g of data.skills) {
    const items = g.items.filter(isOk);
    if (!items.length) continue;
    const ranked = items.map((x, i) => ({ x, i, s: scoreText(x.name, kws) })).sort((a, b) => b.s - a.s || a.i - b.i);
    sel.skills.push({ groupId: g.id, items: ranked.map((r) => r.x.id) });
  }

  let first = true;
  for (const e of data.experience.filter((x) => x.visible !== false)) {
    const bs = e.bullets.filter(isOk);
    if (!bs.length) continue;
    const cap = first ? opts.firstJobBullets : opts.otherJobBullets;
    first = false;
    sel.experience.push({ id: e.id, bullets: topN(bs, cap, (b) => b.text, kws).map((b) => b.id) });
  }

  const focus = new Set(target?.focusProjectIds || []);
  const cands = data.projects.filter((p) => p.visible !== false)
    .map((p) => ({ p, bs: p.bullets.filter(isOk) })).filter((c) => c.bs.length)
    .map((c, i) => {
      const text = [c.p.title, (c.p.techStack || []).join(' '), (c.p.tags || []).join(' '), ...c.bs.map((b) => b.text)].join(' ');
      // keyword match dominates; employer work gets a small tie-break edge over college/personal work
      const own = { company: 0.75, freelance: 0.5, personal: 0.25, college: 0 }[c.p.ownership] ?? 0;
      return { ...c, i, s: scoreText(text, kws) + own + (focus.has(c.p.id) ? 1000 : 0) + (c.p.kb?.score || 0) / 200 };
    })
    .sort((a, b) => b.s - a.s || a.i - b.i);
  for (const c of cands.slice(0, opts.maxProjects)) {
    sel.projects.push({ id: c.p.id, bullets: topN(c.bs, opts.bulletsPerProject, (b) => b.text, kws).map((b) => b.id) });
  }

  sel.education = data.education.map((e) => e.id);
  sel.involvement = data.involvement.map((e) => e.id);
  const certs = data.certifications.filter(isOk);
  const keep = new Set(topN(certs, opts.maxCerts, (c) => c.text, kws).map((c) => c.id));
  sel.certifications = certs.filter((c) => keep.has(c.id)).map((c) => c.id);

  const resume = { selection: sel, overrides: {}, options: {} };
  const report = { ...coverage(data, resume, kws), skippedProjects: data.projects.filter((p) => p.visible !== false && !p.bullets.some(isOk)).length };
  return { selection: sel, kws, report };
}
