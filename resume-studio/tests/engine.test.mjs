import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readAll } from '../lib/store.js';
import { extractTerms } from '../lib/terms.js';
import { analyzeJD, tailor, coverage } from '../lib/tailor.js';
import { buildModel, resolveResume, collectIncluded } from '../lib/model.js';
import { mergeKB } from '../lib/kb-import.js';
import { renderDocx } from '../lib/render-docx.js';
import { renderPdf } from '../lib/render-pdf.js';
import { renderText } from '../lib/render-text.js';
import { buildPrep } from '../lib/interview.js';
import { SCHEMAS } from '../lib/schemas.js';
import { fitResume, measure, tighten } from '../lib/fit.js';

const data = await readAll();
const find = (id) => data.resumes.find((r) => r.id === id);

test('term extraction understands common spellings', () => {
  const keys = [...extractTerms('Built REST APIs with Node.js, Express and MongoDB; JWT auth; Next.js SSR; C++ and CI/CD').keys()];
  for (const k of ['rest', 'nodejs', 'express', 'mongodb', 'jwt', 'nextjs', 'ssr', 'cpp', 'cicd']) assert.ok(keys.includes(k), `missing ${k}`);
  assert.ok(!keys.includes('java'), 'JavaScript must not match Java');
});

test('every seeded collection passes its schema', () => {
  for (const [name, schema] of Object.entries(SCHEMAS)) assert.doesNotThrow(() => schema.parse(data[name]), name);
});

test('"Current resume" reproduces the resume you are sending, paragraph for paragraph', async () => {
  const expected = JSON.parse(await fs.readFile(new URL('./fixtures/sent-resume.json', import.meta.url), 'utf8'));
  const { blocks } = buildModel(data, find('resume-current'));
  const actual = blocks.map((b) => {
    switch (b.type) {
      case 'name': case 'contact': case 'section': case 'paragraph': case 'bullet': return b.text;
      case 'labelValue': return `${b.label}  ${b.value}`;
      case 'entryHeader': return `${b.primary}${b.secondary || ''}${b.right ? `\t${b.right}` : ''}`;
      case 'subline': return `${b.label || ''}${b.text}`;
      default: return '';
    }
  }).filter((t) => t.trim());
  assert.deepEqual(actual, expected);
});

test('tailoring never selects anything that is not marked confident', () => {
  const tcs = data.targets.find((t) => t.id === 'target-tcs-prime');
  const { selection } = tailor(data, tcs);
  const r = resolveResume(data, { selection, overrides: {}, options: {} });
  const bad = collectIncluded(r).filter((i) => i.status !== 'confident');
  assert.equal(bad.length, 0, JSON.stringify(bad));
  assert.ok(selection.projects.length >= 1 && selection.projects.length <= 3);
  assert.ok(!r.skills.some((g) => g.items.some((i) => i.name === 'Docker')), 'excluded skills must never appear');
});

test('job-description analysis finds the important keywords and reports coverage', () => {
  const tcs = data.targets.find((t) => t.id === 'target-tcs-prime');
  const kws = analyzeJD(tcs.jd, tcs.keywords);
  const keys = kws.map((k) => k.key);
  for (const k of ['dsa', 'nodejs', 'express', 'rest', 'sql', 'mongodb', 'git']) assert.ok(keys.includes(k), k);
  const cov = coverage(data, find('resume-current'), kws);
  assert.ok(cov.pct > 30 && cov.pct <= 100);
  const docker = cov.missing.find((m) => m.key === 'docker');
  assert.equal(docker?.where, 'excluded', 'Docker is in your library as excluded');
});

test('focus targets force the chosen project to the top', () => {
  const { selection } = tailor(data, { jd: 'python', keywords: [], focusProjectIds: ['smart-healthcare'] });
  assert.equal(selection.projects[0].id, 'smart-healthcare');
});

test('knowledge-base import is idempotent and never overwrites edits', async () => {
  const kb = JSON.parse(await fs.readFile(new URL('../seed/project_knowledge_base.json', import.meta.url), 'utf8'));
  const edited = structuredClone(data.projects);
  edited.find((p) => p.id === 'iwlars').title = 'My own title';
  const again = mergeKB(edited, kb);
  assert.equal(again.stats.added, 0);
  assert.equal(again.stats.bulletsAdded, 0);
  assert.equal(again.projects.find((p) => p.id === 'iwlars').title, 'My own title');
});

test('exports render as valid DOCX, PDF and text', async () => {
  for (const id of ['resume-current', 'resume-tcs-tailored']) {
    const model = buildModel(data, find(id));
    const docx = await renderDocx(model, { author: data.profile.name, title: id });
    assert.equal(docx.subarray(0, 2).toString(), 'PK');
    const pdf = await renderPdf(model, { author: data.profile.name, title: id });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    const text = renderText(model);
    assert.match(text, /PROFESSIONAL EXPERIENCE/);
  }
});

test('interview prep covers topics that appear on the resume', () => {
  const prep = buildPrep(data, find('resume-current'));
  const keys = prep.topics.map((t) => t.key);
  for (const k of ['jwt', 'rbac', 'open3d']) assert.ok(keys.includes(k), k);
  assert.equal(prep.unverified.length, 0);
  assert.equal(prep.projects.length, 3);
});

test('fit-to-pages tightens formatting until the resume fits, and never deletes content', async () => {
  const r = find('resume-current');
  const before = await measure(data, r);
  assert.ok(before >= 2);
  const fit = await fitResume(data, r, 2);
  assert.ok(fit.fitted, `could not fit: ${fit.pages} pages`);
  assert.ok(fit.pages <= 2);
  assert.deepEqual(r.selection, find('resume-current').selection);
  // never loosens what the user already tightened
  assert.equal(tighten({ spacing: 'tight', margin: 0.5, fontSize: 9 }, { spacing: 'normal', margin: 0.75, fontSize: 10 }).margin, 0.5);
});
