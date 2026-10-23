// End-to-end smoke test against a RUNNING copy of the app, using only fictional data.
//
//   DATA_DIR=./data-smoke npm run start      (in one terminal, after `npm run build`)
//   npm run smoke                            (in another; optional: BASE_URL=http://localhost:3000)
//
// Use a throwaway DATA_DIR: the test adds sample records and does a backup restore.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let failures = 0;
let passes = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passes += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
  }
}

async function call(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const bytes = async (res) => new Uint8Array(await res.arrayBuffer());
const ascii = (u8, n) => Buffer.from(u8.slice(0, n)).toString('latin1');

console.log(`Smoke test against ${BASE}\n`);

console.log('Pages');
const PAGES = [
  ['/', 'Welcome'],
  ['/profile', 'Identity and contact'],
  ['/career', 'Experience &amp; skills'],
  ['/career?tab=skills', 'Skills'],
  ['/projects', 'Projects'],
  ['/projects/new', 'Add a project'],
  ['/resumes', 'Resumes'],
  ['/settings', 'Backup and restore'],
];
for (const [path, heading] of PAGES) {
  const res = await call(path, { raw: true });
  const html = await res.text();
  check(
    `GET ${path} renders its content`,
    res.status === 200 && html.includes('Resume Vault') && html.includes(heading) && !html.includes('Something went wrong'),
    `status ${res.status}`,
  );
}
check('unknown project is a 404', (await call('/projects/99999', { raw: true })).status === 404);
check('unknown resume is a 404', (await call('/resumes/99999', { raw: true })).status === 404);

console.log('\nNetwork safeguards');
{
  const http = await import('node:http');
  const u = new URL(BASE);
  const status = (headers, method = 'GET', path = '/api/profile') =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path, method, headers }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end(method === 'GET' ? undefined : '{}');
    });
  check('a request addressed to another host name is refused', (await status({ Host: 'evil.example' })) === 403);
  check(
    'a cross-site change request is refused',
    (await status({ Origin: 'https://evil.example', 'Content-Type': 'text/plain' }, 'PUT')) === 403,
  );
  check(
    'a cross-site fetch-metadata request is refused',
    (await status({ 'Sec-Fetch-Site': 'cross-site' }, 'POST', '/api/resumes')) === 403,
  );
  check('a normal local request is served', (await status({})) === 200);
}

console.log('\nValidation and safeguards');
const blocked = await call('/api/resumes', {
  method: 'POST',
  body: { name: 'Too early', targetTitle: '', targetCompany: '', template: 'classic', jdText: '', preselect: 'none' },
});
check('creating a resume before a profile exists is refused', blocked.status === 400 && /Profile/.test(blocked.data.error));
const badProfile = await call('/api/profile', {
  method: 'PUT',
  body: { fullName: '', headline: '', email: 'nope', phone: '', location: '', links: [], summaries: [] },
});
check(
  'invalid profile is rejected with field messages',
  badProfile.status === 400 && badProfile.data.fields?.fullName && badProfile.data.fields?.email,
);
const badJson = await fetch(BASE + '/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
check('malformed JSON is rejected', badJson.status === 400);
check('unknown record type is a 404', (await call('/api/library/nonsense')).status === 404);

console.log('\nProfile and library');
const profile = await call('/api/profile', {
  method: 'PUT',
  body: {
    fullName: 'Casey Smoketest',
    headline: 'Developer (smoke test)',
    email: 'casey@example.com',
    phone: '+00 000 000 000',
    location: 'Testville',
    links: [{ label: 'github.com/casey-smoke', url: 'https://github.com/casey-smoke' }],
    summaries: [{ label: 'General', text: 'Fictional summary used only by the smoke test.' }],
  },
});
check('profile saved', profile.status === 200 && profile.data.fullName === 'Casey Smoketest' && profile.data.summaries.length === 1);

const exp = await call('/api/library/experiences', {
  method: 'POST',
  body: {
    org: 'Example Co',
    title: 'Engineer',
    location: '',
    start: '2024-01',
    end: '',
    kind: 'job',
    description: '',
    archived: false,
    bullets: [
      { text: 'Built a fictional service with Node.js and PostgreSQL.', verified: true },
      { text: 'Second fictional bullet.', verified: false },
    ],
  },
});
check('experience created with bullets', exp.status === 201 && exp.data.bullets.length === 2);
check(
  'education created',
  (
    await call('/api/library/education', {
      method: 'POST',
      body: {
        institution: 'Example University',
        degree: 'B.Sc.',
        field: 'Computing',
        location: '',
        start: '',
        end: '2023-06',
        grade: '',
        details: '',
      },
    })
  ).status === 201,
);
check(
  'skill created',
  (await call('/api/library/skills', { method: 'POST', body: { name: 'Node.js', category: 'Backend' } })).status === 201,
);
check(
  'invalid skill rejected',
  (await call('/api/library/skills', { method: 'POST', body: { name: '', category: 'Backend' } })).status === 400,
);
const proj = await call('/api/library/projects', {
  method: 'POST',
  body: {
    name: 'Fictional Booking App',
    category: '',
    overview: 'A made-up app.',
    description: '',
    problem: '',
    solution: '',
    role: '',
    contributions: '',
    technologies: ['Node.js', 'PostgreSQL'],
    features: '',
    decisions: '',
    results: '',
    repoUrl: '',
    demoUrl: 'https://example.com/',
    docsUrl: '',
    tags: [],
    keywords: [],
    yearLabel: '2024',
    family: '',
    status: 'active',
    notes: '',
    bullets: [{ text: 'Built booking flows with role-based access.', verified: true }],
  },
});
check('project created', proj.status === 201 && proj.data.technologies.length === 2);

console.log('\nKnowledge-base import');
const kb = await call('/api/import/knowledge-base', {
  method: 'POST',
  body: [
    {
      id: 'fictional-kb',
      title: 'Fictional KB Project',
      rank: 5,
      score: 70,
      purpose: 'Made up.',
      primary_technologies: ['Python'],
      resume_entry: { bullets: ['A fictional imported bullet.'] },
    },
  ],
});
check('knowledge-base import works', kb.status === 200 && kb.data.imported === 1);
const kb2 = await call('/api/import/knowledge-base', { method: 'POST', body: [{ id: 'fictional-kb', title: 'Fictional KB Project' }] });
check('importing again skips existing projects', kb2.data.imported === 0 && kb2.data.skipped.length === 1);

console.log('\nResumes');
const created = await call('/api/resumes', {
  method: 'POST',
  body: {
    name: 'Smoke resume',
    targetTitle: 'Developer',
    targetCompany: 'Example Co',
    template: 'classic',
    jdText: 'Looking for Node.js and PostgreSQL experience.',
    preselect: 'match',
  },
});
check('resume created', created.status === 201);
const rid = created.data.resume.id;
const projectItem = created.data.items.find((i) => i.section === 'projects');
check('job-description match pre-selected the booking app', projectItem?.data.name === 'Fictional Booking App');

const copy = await call(`/api/resumes/${rid}/duplicate`, { method: 'POST', body: { name: 'Smoke copy' } });
check('resume duplicated', copy.status === 201 && copy.data.parentId === rid);
const summaryItem = created.data.items.find((i) => i.section === 'summary');
const edit = await call(`/api/resumes/${rid}/items/${summaryItem.id}`, {
  method: 'PATCH',
  body: { data: { text: 'Edited only on the first resume.' } },
});
check('item edited on one resume', edit.status === 200);
const copyDetail = await call(`/api/resumes/${copy.data.id}`);
check(
  'the duplicate is unaffected by the edit',
  copyDetail.data.items.find((i) => i.section === 'summary').data.text.startsWith('Fictional summary'),
);

const match = await call(`/api/resumes/${rid}/match`);
check('match endpoint ranks projects', match.status === 200 && match.data.result.projects[0].name === 'Fictional Booking App');

console.log('\nExports');
const pdf = await call(`/api/resumes/${rid}/pdf`, { raw: true });
const pdfBytes = await bytes(pdf);
check(
  'PDF preview is a real PDF',
  pdf.status === 200 && ascii(pdfBytes, 5) === '%PDF-' && pdf.headers.get('content-type') === 'application/pdf',
);
check('PDF reports its page count', Number(pdf.headers.get('x-page-count')) >= 1);
const before = (await call(`/api/resumes/${rid}/versions`)).data.length;
const pdfDl = await call(`/api/resumes/${rid}/pdf?download=1`, { raw: true });
check('PDF download is an attachment', /attachment/.test(pdfDl.headers.get('content-disposition') ?? ''));
await pdfDl.arrayBuffer();
const docx = await call(`/api/resumes/${rid}/docx?download=1`, { raw: true });
const docxBytes = await bytes(docx);
check('Word download is a real .docx (zip) file', docx.status === 200 && ascii(docxBytes, 2) === 'PK');
const versions = (await call(`/api/resumes/${rid}/versions`)).data;
check(
  'downloading saved a version automatically (once, not twice)',
  versions.length === before + 1,
  `before ${before}, after ${versions.length}`,
);

console.log('\nVersions');
const saved = await call(`/api/resumes/${rid}/versions`, { method: 'POST', body: { label: 'Smoke label' } });
check('manual version saved', saved.status === 201 && saved.data.version.label === 'Smoke label');
await call(`/api/resumes/${rid}/items/${summaryItem.id}`, { method: 'PATCH', body: { data: { text: 'A later edit.' } } });
const restored = await call(`/api/resumes/${rid}/versions/${saved.data.version.id}`, { method: 'POST', body: { action: 'restore' } });
check(
  'restoring a version brings the old content back',
  restored.status === 200 && restored.data.items.find((i) => i.section === 'summary').data.text === 'Edited only on the first resume.',
);

console.log('\nLibrary changes and the hybrid update strategy');
const libProject = (await call(`/api/library/projects/${proj.data.id}`)).data;
await call(`/api/library/projects/${proj.data.id}`, {
  method: 'PUT',
  body: { ...libProject, bullets: [{ text: 'Rewritten in the library.', verified: true }] },
});
const flagged = (await call(`/api/resumes/${rid}`)).data.items.find((i) => i.section === 'projects');
check(
  'the resume flags the changed library item but keeps its own text',
  flagged.sync === 'changed' && flagged.data.bullets[0].text !== 'Rewritten in the library.',
);
const pulled = await call(`/api/resumes/${rid}/items/${flagged.id}/sync`, { method: 'POST', body: { action: 'pull' } });
check(
  'pulling brings in the library text',
  pulled.data.data.bullets[0].text === 'Rewritten in the library.' && pulled.data.sync === 'current',
);

console.log('\nBackup and restore');
const backupRes = await call('/api/backup', { raw: true });
const backupText = await backupRes.text();
const backup = JSON.parse(backupText);
check(
  'backup downloads as JSON with all tables',
  backupRes.status === 200 && backup.app === 'resume-vault' && backup.tables.projects.length >= 2,
);
await call(`/api/resumes/${copy.data.id}`, { method: 'DELETE' });
check('resume deleted', (await call(`/api/resumes/${copy.data.id}`)).status === 404);
const bad = await call('/api/backup/restore', { method: 'POST', body: { hello: 'world' } });
check('a non-backup file is rejected', bad.status === 400);
const restoredBackup = await call('/api/backup/restore', { method: 'POST', body: backup });
check('restore succeeds and writes a safety copy', restoredBackup.status === 200 && !!restoredBackup.data.safetyCopy);
check('the deleted resume is back after restoring', (await call(`/api/resumes/${copy.data.id}`)).status === 200);

console.log('\nSettings');
const settings = await call('/api/settings', { method: 'PUT', body: { defaultPageSize: 'LETTER', defaultTemplate: 'compact' } });
check('settings saved', settings.status === 200 && settings.data.defaultPageSize === 'LETTER');

console.log(`\n${passes} passed, ${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
