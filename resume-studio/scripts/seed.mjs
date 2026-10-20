// Creates the starting data/ folder from your resume + the project knowledge base.
// Usage:  npm run seed            (only if data/ is empty)
//         npm run seed -- --force (wipes data/ and starts over - backups are kept in data/_backups)
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeCollection, DATA_DIR } from '../src/lib/server/store.js';
import { mergeKB } from '../src/lib/domain/kb-import.js';
import { tailor } from '../src/lib/domain/tailor.js';
import { newResume } from '../src/lib/domain/defaults.js';
import { fitResume } from '../src/lib/server/fit.js';
import * as seed from '../seed/resume-data.mjs';

const force = process.argv.includes('--force');
const marker = path.join(DATA_DIR(), 'profile.json');
const exists = await fs.access(marker).then(() => true, () => false);
if (exists && !force) {
  console.log('data/ already exists - nothing changed. Use "npm run seed -- --force" to start over.');
  process.exit(0);
}

const kb = JSON.parse(await fs.readFile(new URL('../seed/project_knowledge_base.json', import.meta.url), 'utf8'));
const { projects, stats } = mergeKB(seed.resumeProjects, kb);

const data = {
  profile: seed.profile, summaries: seed.summaries, experience: seed.experience, skills: seed.skills,
  projects, education: seed.education, certifications: seed.certifications, involvement: seed.involvement,
  targets: seed.targets, resumes: [],
};

// 1) A resume that reproduces the one you are sending today, exactly.
const current = tailor(data, null, { maxProjects: 0 }).selection;
current.skills = current.skills.filter((g) => g.groupId !== 'sk-excluded');
current.projects = ['iwlars', 'ca-workflow', 'smart-healthcare'].map((id) => {
  const p = projects.find((x) => x.id === id);
  return { id, bullets: p.bullets.filter((b) => b.status === 'confident').map((b) => b.id) };
});
current.certifications = seed.certifications.map((c) => c.id);
current.experience = seed.experience.map((e) => ({ id: e.id, bullets: e.bullets.map((b) => b.id) }));
const r1 = newResume({ name: 'Current resume', selection: current });
r1.id = 'resume-current';
r1.options.projectsOnNewPage = true;

// 2) A tailored example for the TCS target.
const tcs = seed.targets[0];
const t = tailor(data, tcs);
const r2 = newResume({ name: 'TCS Prime — auto-tailored', targetId: tcs.id, selection: t.selection });
r2.id = 'resume-tcs-tailored';
data.resumes = [r1, r2];
// Make sure both fit the default target (2 pages) by gently tightening formatting - content is never removed.
for (const r of data.resumes) {
  const fit = await fitResume(data, r, 2);
  r.options = fit.options;
  console.log(`  ${r.name}: ${fit.pages} page(s)${fit.fitted ? '' : ' (could not fit - trim content)'}`);
}

for (const [name, value] of Object.entries(data)) await writeCollection(name, value);
console.log(`Seeded data/ — ${projects.length} projects (${stats.added} from the knowledge base, ${stats.bulletsAdded} bullets marked "needs review").`);
console.log(`Tailored example covers ${t.report.pct}% of TCS keywords.`);
