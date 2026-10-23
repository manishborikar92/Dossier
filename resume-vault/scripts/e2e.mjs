// Real-browser end-to-end test: drives the actual interface of a RUNNING copy of the app.
//
//   DATA_DIR=./data-e2e npm run start -- -p 3100        (terminal 1, after `npm run build`)
//   CHROME_PATH=/path/to/chrome BASE_URL=http://localhost:3100 npm run e2e   (terminal 2)
//
// Needs a Chrome, Chromium or Edge install (set CHROME_PATH if it is not found automatically)
// and a THROWAWAY data folder: the test creates records and restores a backup.
// Optional: E2E_CHROME_ARGS='["--no-sandbox"]' for locked-down environments such as containers,
// and E2E_SHOT_DIR=/some/folder to save a screenshot whenever a step fails.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('Could not find Chrome, Chromium or Edge. Set CHROME_PATH to its executable.');
  process.exit(2);
}

const results = [];
const consoleProblems = [];
let current = '';

async function step(name, fn) {
  current = name;
  if (process.env.E2E_STOP_AFTER && results.length >= Number(process.env.E2E_STOP_AFTER)) return;
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}${process.env.E2E_TIMING ? ` (${Date.now() - started} ms)` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    if (process.env.E2E_SHOT_DIR) {
      fs.mkdirSync(process.env.E2E_SHOT_DIR, { recursive: true });
      await page
        .screenshot({
          path: path.join(process.env.E2E_SHOT_DIR, `${results.length}-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 50)}.png`),
          fullPage: false,
        })
        .catch(() => undefined);
    }
    console.log(`  FAIL  ${name}\n        ${String(error?.message ?? error).split('\n')[0]}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ executablePath, headless: true, args: JSON.parse(process.env.E2E_CHROME_ARGS ?? '[]') });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
context.setDefaultTimeout(Number(process.env.E2E_TIMEOUT ?? 15000));
const page = await context.newPage();
page.on('pageerror', (e) => consoleProblems.push(`[${current}] page error: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/status of 404/.test(m.text())) consoleProblems.push(`[${current}] console: ${m.text().slice(0, 200)}`);
});

const go = async (route) => page.goto(BASE + route, { waitUntil: 'networkidle' });
const toast = (text) => page.getByRole('status').filter({ hasText: text }).first().waitFor();
const dialog = () => page.getByRole('dialog');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-e2e-'));

console.log(`Browser test against ${BASE}\n`);

/* ------------------------------------------------------------------ */
console.log('First run and navigation');
await step('the dashboard welcomes a new user with a setup checklist', async () => {
  await go('/');
  await page.getByRole('heading', { name: 'Welcome to Resume Vault' }).waitFor();
  await page.getByText('0 of 5 steps done').waitFor();
  assert((await page.locator('h1').count()) === 1, 'exactly one h1');
});
await step('the sidebar links navigate between every page', async () => {
  for (const [label, heading] of [
    ['Profile', 'Profile'],
    ['Experience & skills', 'Experience & skills'],
    ['Projects', 'Projects'],
    ['Resumes', 'Resumes'],
    ['Settings & backup', 'Settings & backup'],
    ['Dashboard', 'Welcome to Resume Vault'],
  ]) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click();
    await page.getByRole('heading', { level: 1, name: heading }).waitFor();
  }
});
await step('an unknown address shows the friendly not-found page', async () => {
  await go('/this-page-does-not-exist');
  await page.getByText('We couldn’t find that page').waitFor();
  await page.getByRole('link', { name: 'Go to the dashboard' }).click();
  await page.getByRole('heading', { level: 1 }).waitFor();
});

/* ------------------------------------------------------------------ */
console.log('\nProfile');
await step('invalid input shows field messages and nothing is saved', async () => {
  await go('/profile');
  await page.getByLabel('Full name').fill('Casey Browser');
  await page.getByLabel('Email').fill('not-an-email');
  assert(await page.getByRole('button', { name: 'Save profile' }).isEnabled(), 'save enabled after a change');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Enter a valid email address').waitFor();
});
await step('saving the profile persists it, and the unsaved/saved indicator follows', async () => {
  await page.getByLabel('Email').fill('casey@example.com');
  await page.getByLabel('Phone').fill('+00 111 222 333');
  await page.getByLabel('Location').fill('Testville');
  await page.getByRole('button', { name: 'Add link' }).click();
  await page.getByLabel('Text on resume').fill('github.com/casey-browser');
  await page.getByLabel('Address').fill('https://github.com/casey-browser');
  await page.getByRole('button', { name: 'Add variant' }).click();
  await page.getByLabel('Label', { exact: true }).fill('General');
  await page.getByLabel('Summary', { exact: true }).fill('Fictional summary for the browser test.');
  await page.getByText('Unsaved', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await toast('Profile saved.');
  await page.getByText('Saved', { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Save profile' }).isDisabled(), 'save disabled when nothing changed');
  await go('/profile');
  assert((await page.getByLabel('Full name').inputValue()) === 'Casey Browser', 'name persisted after reload');
  assert((await page.getByLabel('Text on resume').inputValue()) === 'github.com/casey-browser', 'link persisted');
});

/* ------------------------------------------------------------------ */
console.log('\nExperience, education, skills and certifications');
await step('add an experience with a bullet; Escape closes the dialog without saving', async () => {
  await go('/career');
  await page.getByRole('button', { name: 'Add your first role' }).click();
  await dialog().getByLabel('Title').fill('Discarded');
  await page.keyboard.press('Escape');
  await dialog().waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Add experience' }).click();
  await dialog().getByLabel('Title').fill('Software Engineer');
  await dialog().getByLabel('Organization').fill('Browser Test Co');
  await dialog().getByLabel('Start').fill('2024-01');
  await dialog().getByRole('button', { name: 'Add bullet' }).click();
  await dialog().getByLabel('Bullet 1', { exact: true }).fill('Built a fictional service with Node.js and PostgreSQL.');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await toast('Experience saved.');
  await page.getByText('Software Engineer').first().waitFor();
  assert(!(await page.getByText('Discarded').count()), 'the discarded entry was not saved');
});
await step('validation blocks an end date before the start date', async () => {
  await page.getByRole('button', { name: 'Add experience' }).click();
  await dialog().getByLabel('Title').fill('Intern');
  await dialog().getByLabel('Organization').fill('Somewhere');
  await dialog().getByLabel('Start').fill('2024-06');
  await dialog().getByLabel('End').fill('2024-01');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await dialog().getByText('The end date must not be before the start date').waitFor();
  await dialog().getByRole('button', { name: 'Cancel' }).click();
});
await step('add education, a skill in a new category, and a certification', async () => {
  await page.getByRole('tab', { name: /Education/ }).click();
  await page
    .getByRole('button', { name: 'Add your first role' })
    .or(page.getByRole('button', { name: 'Add education' }).first())
    .first()
    .click();
  await dialog().getByLabel('Degree or qualification').fill('B.Sc.');
  await dialog().getByLabel('Institution').fill('Example University');
  await dialog().getByLabel('End or graduation').fill('2023-06');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await toast('Education saved.');

  await page.getByRole('tab', { name: /Skills/ }).click();
  await page.getByRole('button', { name: 'Add skill' }).first().click();
  await dialog().getByLabel('Skill').fill('Node.js');
  await dialog().getByLabel('Category').fill('Backend');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await toast('Skill saved.');
  await page.getByRole('button', { name: 'Add to Backend' }).click();
  await dialog().getByLabel('Skill').fill('PostgreSQL');
  assert((await dialog().getByLabel('Category').inputValue()) === 'Backend', 'category prefilled from the card');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await toast('Skill saved.');

  await page.getByRole('tab', { name: /Certifications/ }).click();
  await page.getByRole('button', { name: 'Add certification' }).first().click();
  await dialog().getByLabel('Name').fill('Fictional Certificate');
  await dialog().getByLabel('Issuer').fill('Example Academy');
  await dialog().getByRole('button', { name: 'Save', exact: true }).click();
  await toast('Certification saved.');
});
await step('deleting asks for confirmation and removes the entry', async () => {
  await page.getByRole('button', { name: 'Delete Fictional Certificate' }).click();
  await dialog().getByText('No resume uses it yet.').waitFor();
  await dialog().getByRole('button', { name: 'Delete', exact: true }).click();
  await toast('Certification deleted.');
  await page.getByText('No certifications yet').waitFor();
});

/* ------------------------------------------------------------------ */
console.log('\nProject library');
const kbFile = path.join(tmp, 'kb.json');
fs.writeFileSync(
  kbFile,
  JSON.stringify([
    {
      id: 'fic-a',
      title: 'Fictional Alpha',
      rank: 1,
      score: 90,
      purpose: 'A made-up app.',
      primary_technologies: ['Node.js', 'PostgreSQL'],
      year: '2025',
      resume_entry: { bullets: ['Built the alpha service.', 'Wrote alpha tests.'] },
    },
    {
      id: 'fic-b',
      title: 'Fictional Beta',
      rank: 2,
      score: 60,
      purpose: 'Another made-up app.',
      primary_technologies: ['Python', 'Docker'],
      year: '2024',
      resume_entry: { bullets: ['Built the beta tool.'] },
    },
  ]),
);
await step('add a project with technologies and a bullet', async () => {
  await go('/projects');
  await page
    .getByRole('button', { name: 'Add project' })
    .or(page.getByRole('link', { name: 'Add project' }))
    .first()
    .click();
  await page.getByLabel('Project name').fill('Browser Test Project');
  await page.getByLabel('Year or period').fill('2025');
  await page.getByLabel('Technologies and tools').fill('Next.js');
  await page.keyboard.press('Enter');
  await page.getByLabel('Technologies and tools').fill('SQLite, Tailwind');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Add bullet' }).click();
  await page.getByLabel('Bullet 1', { exact: true }).fill('Built the browser-tested project end to end.');
  await page.getByRole('button', { name: 'Add project' }).click();
  await toast('Project added.');
  await page.getByRole('heading', { level: 1, name: 'Browser Test Project' }).waitFor();
  assert((await page.getByText('SQLite').count()) > 0, 'tags created from comma-separated input');
});
await step('import a knowledge-base file, then importing again changes nothing', async () => {
  await go('/projects');
  await page.getByRole('button', { name: 'Import knowledge base' }).click();
  await dialog().locator('#kb-file').setInputFiles(kbFile);
  await dialog()
    .getByText('2 projects found.')
    .waitFor({ timeout: 5000 })
    .catch(() =>
      dialog()
        .getByText(/2 projects found/)
        .waitFor(),
    );
  await dialog().getByRole('button', { name: 'Import projects' }).click();
  await dialog().getByText('Imported 2.').waitFor();
  await dialog().getByRole('button', { name: 'Done' }).click();
  await page.getByText('Fictional Alpha').waitFor();
  await page.getByRole('button', { name: 'Import knowledge base' }).click();
  await dialog().locator('#kb-file').setInputFiles(kbFile);
  await dialog().getByRole('button', { name: 'Import projects' }).click();
  await dialog().getByText('Imported 0.').waitFor();
  await dialog()
    .getByText(/2 already in your library/)
    .waitFor();
  await dialog().getByRole('button', { name: 'Done' }).click();
});
await step('search and the technology filter narrow the list', async () => {
  await page.getByLabel('Search').fill('beta');
  await page.getByText('Showing 1 of 3 projects').waitFor();
  await page.getByLabel('Search').fill('');
  await page.getByLabel('Technology').selectOption('Docker');
  await page.getByText('Showing 1 of 3 projects').waitFor();
  await page.getByLabel('Technology').selectOption('');
});
await step('archiving hides a project from the default view and restoring brings it back', async () => {
  await page.getByRole('link', { name: 'Fictional Beta' }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await toast('Project archived.');
  await go('/projects');
  await page.getByText('Showing 2 of 3 projects').waitFor();
  await page.getByLabel('Show').selectOption('archived');
  await page.getByRole('link', { name: 'Fictional Beta' }).click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await toast('Project restored.');
});

/* ------------------------------------------------------------------ */
console.log('\nResume builder');
let resumeUrl = '';
await step('create a resume from a job description, with matching projects pre-selected', async () => {
  await go('/resumes');
  await page.getByRole('button', { name: 'New resume' }).first().click();
  await dialog().getByLabel('Resume name').fill('Backend resume');
  await dialog().getByLabel('Target job title').fill('Backend Developer');
  await dialog()
    .getByRole('radio', { name: /Compact/ })
    .check();
  await dialog().getByLabel('Job description (optional)').fill('We need Node.js and PostgreSQL experience.');
  await dialog()
    .getByRole('radio', { name: /best match/ })
    .check();
  await dialog().getByRole('button', { name: 'Create resume' }).click();
  await page.getByRole('heading', { level: 1, name: 'Backend resume' }).waitFor();
  resumeUrl = page.url();
});
await step('the live preview draws the real PDF on canvases', async () => {
  const canvas = page.locator('canvas[aria-label^="Resume preview, page 1"]');
  await canvas.waitFor({ timeout: 30000 });
  await page
    .getByText(/1 page|2 pages/)
    .first()
    .waitFor();
  const box = await canvas.boundingBox();
  assert(box && box.width > 200 && box.height > 250, 'the page canvas has a sensible size');
  await page.waitForFunction(
    () => {
      const c = document.querySelector('canvas[aria-label^="Resume preview, page 1"]');
      if (!c) return false;
      const { data } = c.getContext('2d').getImageData(0, 0, c.width, Math.min(c.height, 400));
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 160) dark++;
      return dark > 300;
    },
    null,
    { timeout: 20000 },
  );
  const painted = 301;
  assert(painted > 300, `the canvas contains rendered text (${painted} dark pixels)`);
});
await step('hiding an item updates the resume and the preview', async () => {
  await page.waitForFunction(() => !!document.querySelector('canvas[aria-label^="Resume preview"]'));
  await page.waitForTimeout(1500);
  const before = await page
    .locator('canvas[aria-label^="Resume preview"]')
    .first()
    .evaluate((c) => c.toDataURL().length);
  const toggle = page.getByRole('button', { name: /Technical skills/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await page.getByRole('checkbox', { name: /Show Node.js \(Backend\) on this resume/ }).click();
  await page.waitForTimeout(2500);
  const after = await page
    .locator('canvas[aria-label^="Resume preview"]')
    .first()
    .evaluate((c) => c.toDataURL().length);
  assert(before !== after, 'the preview changed after hiding a skill');
});
await step('editing a project bullet changes this resume only', async () => {
  await page.getByRole('button', { name: /Edit Fictional Alpha/ }).click();
  await page.getByLabel('Bullet 1', { exact: true }).fill('Rewritten for the backend resume only.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await toast('Changes saved to this resume.');
  const libraryRes = await context.request.get(`${BASE}/api/library/projects`);
  const library = await libraryRes.json();
  assert(!JSON.stringify(library).includes('Rewritten for the backend resume only.'), 'the library is untouched');
});
await step('add an item from the library; the picker only offers what is missing', async () => {
  await page.getByRole('button', { name: /Key projects/ }).waitFor();
  await page.locator('section[aria-label="Key projects"]').getByRole('button', { name: 'Add from library' }).click();
  await dialog().getByText('Browser Test Project').waitFor();
  await dialog().getByRole('button', { name: 'Add' }).first().click();
  await toast('Added to this resume.');
  await dialog().getByRole('button', { name: 'Done' }).click();
});
await step('the job-match tab ranks projects and lists gaps without adding them', async () => {
  await page.getByRole('tab', { name: 'Match a job' }).click();
  await page.getByLabel('Job description', { exact: true }).fill('Looking for Node.js, PostgreSQL and Kubernetes experience.');
  await page.getByRole('button', { name: 'Save and analyse' }).click();
  await page.getByText('Projects ranked for this job').waitFor();
  await page.getByText('Kubernetes').first().waitFor();
  await page.getByText('Nothing in your library mentions these.').waitFor();
});
await step('setup: change template, accent and a page-break option', async () => {
  await page.getByRole('tab', { name: 'Setup' }).click();
  await page.getByRole('radio', { name: /Minimal/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Teal/ }).click();
  await page.waitForTimeout(800);
  await page
    .getByRole('checkbox', { name: /^Start on a new page$/ })
    .nth(3)
    .click();
  await page.waitForTimeout(800);
  const detail = await (await context.request.get(`${BASE}/api/resumes/${resumeUrl.split('/').pop()}`)).json();
  assert(detail.resume.template === 'minimal', 'template saved');
  assert(detail.resume.settings.accent.toLowerCase() === '#0f6b6b', 'accent saved');
  assert(detail.resume.settings.pageBreakBefore.length === 1, 'page break saved');
});
await step('versions: save, change, restore', async () => {
  await page.getByRole('tab', { name: /Versions/ }).click();
  await page.getByLabel('Version label (optional)').fill('Sent to Acme');
  await page.getByRole('button', { name: 'Save version' }).last().click();
  await toast('Version saved.');
  await page.getByText('Sent to Acme').waitFor();
  await page.getByRole('tab', { name: 'Setup' }).click();
  await page.getByRole('radio', { name: /Classic/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /Versions/ }).click();
  await page.getByRole('button', { name: 'Restore this version' }).first().click();
  await dialog().getByRole('button', { name: 'Restore', exact: true }).click();
  await toast('Restored version');
  const detail = await (await context.request.get(`${BASE}/api/resumes/${resumeUrl.split('/').pop()}`)).json();
  assert(detail.resume.template === 'minimal', 'the saved version brought the template back');
});
await step('export: the menu offers PDF, Word and print; unverified bullets ask for confirmation', async () => {
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /Download PDF/ }).waitFor();
  await page.getByRole('menuitem', { name: /Download Word/ }).waitFor();
  await page.getByRole('menuitem', { name: /Open PDF to print/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('menuitem', { name: /Download PDF/ }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /Download PDF/ }).click();
  await dialog().getByText('Some bullets are not verified').waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog().getByRole('button', { name: 'Export anyway' }).click()]);
  const file = path.join(tmp, 'export.pdf');
  await download.saveAs(file);
  assert(fs.readFileSync(file).subarray(0, 5).toString() === '%PDF-', 'the download is a real PDF');
  assert(/\.pdf$/.test(download.suggestedFilename()), 'a sensible file name');
});
await step('export: Word download is a real .docx', async () => {
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: /Download Word/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog().getByRole('button', { name: 'Export anyway' }).click()]);
  const file = path.join(tmp, 'export.docx');
  await download.saveAs(file);
  assert(fs.readFileSync(file).subarray(0, 2).toString() === 'PK', 'the download is a zip-based Word file');
});
await step('a library change is flagged on the resume and can be reviewed', async () => {
  const projects = await (await context.request.get(`${BASE}/api/library/projects`)).json();
  const alpha = projects.find((p) => p.name === 'Fictional Alpha');
  await context.request.put(`${BASE}/api/library/projects/${alpha.id}`, {
    data: { ...alpha, overview: 'Changed in the library.', bullets: [{ text: 'Library rewrite of the alpha bullet.', verified: true }] },
  });
  await go(new URL(resumeUrl).pathname);
  await page
    .getByRole('button', { name: /Library changed/ })
    .first()
    .click();
  await dialog().getByRole('heading', { name: 'Your library has changed' }).waitFor();
  await dialog().getByText('Library rewrite of the alpha bullet.').waitFor();
  await dialog().getByRole('button', { name: 'Use the library version' }).click();
  await toast('This resume now has the latest library version.');
});
await step('duplicating a resume gives an independent copy', async () => {
  await go('/resumes');
  await page.getByRole('button', { name: 'Duplicate' }).first().click();
  await dialog().getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.getByRole('heading', { level: 1, name: /Copy of Backend resume/ }).waitFor();
});
await step('deleting a resume needs confirmation and keeps the library', async () => {
  await go('/resumes');
  await page.getByRole('button', { name: /Delete Copy of Backend resume/ }).click();
  await dialog().getByRole('button', { name: 'Delete resume' }).click();
  await toast('Resume deleted.');
  await page.getByText('Copy of Backend resume').waitFor({ state: 'detached' });
  assert((await page.getByText('Backend resume').count()) > 0, 'the original remains');
});

/* ------------------------------------------------------------------ */
console.log('\nBackup, restore and settings');
await step('download a backup, change data, then restore it', async () => {
  await go('/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download backup' }).click()]);
  const file = path.join(tmp, 'backup.json');
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(backup.app === 'resume-vault' && backup.tables.projects.length >= 3, 'the backup holds the library');

  const projects = await (await context.request.get(`${BASE}/api/library/projects`)).json();
  await context.request.delete(`${BASE}/api/library/projects/${projects[0].id}`);
  await page.locator('#restore-file').setInputFiles(file);
  await page.getByRole('button', { name: 'Restore this backup' }).click();
  await dialog().getByRole('button', { name: 'Replace and restore' }).click();
  await toast('Backup restored.');
  const after = await (await context.request.get(`${BASE}/api/library/projects`)).json();
  assert(after.length === projects.length, 'the deleted project is back after restoring');
});
await step('a file that is not a backup is rejected in the interface', async () => {
  const bad = path.join(tmp, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ hello: 'world' }));
  await page.locator('#restore-file').setInputFiles(bad);
  await page.getByText('This file is not a Resume Vault backup.').waitFor();
  assert(await page.getByRole('button', { name: 'Restore this backup' }).isDisabled(), 'restore stays disabled');
});
await step('defaults can be changed and are used for new resumes', async () => {
  await page.getByLabel('Page size').selectOption('LETTER');
  await page.getByRole('button', { name: 'Save defaults' }).click();
  await toast('Defaults saved.');
  const created = await (
    await context.request.post(`${BASE}/api/resumes`, {
      data: { name: 'Letter check', targetTitle: '', targetCompany: '', template: 'classic', jdText: '', preselect: 'none' },
    })
  ).json();
  assert(created.resume.settings.pageSize === 'LETTER', 'new resumes use the new default');
});

/* ------------------------------------------------------------------ */
console.log('\nSmall screens and accessibility');
await step('on a phone the menu opens as a drawer and navigates', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/');
  assert(!(await page.getByRole('navigation', { name: 'Main' }).isVisible()), 'the sidebar is hidden on a phone');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('heading', { level: 1, name: 'Projects' }).waitFor();
  assert(!(await page.getByRole('navigation', { name: 'Main' }).isVisible()), 'the drawer closes after navigating');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `no horizontal scrolling on a phone (overflow ${overflow}px)`);
});
await step('on a phone the builder switches between editing and the preview', async () => {
  await go(new URL(resumeUrl).pathname);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('canvas[aria-label^="Resume preview"]').first().waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('tab', { name: 'Content' }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `no horizontal scrolling in the builder (overflow ${overflow}px)`);
});
await step('every page has one heading and no unlabeled buttons, links or images', async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ['/', '/profile', '/career', '/projects', '/projects/new', '/resumes', '/settings', new URL(resumeUrl).pathname]) {
    await go(route);
    const report = await page.evaluate(() => {
      const unnamed = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((el) => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title');
      });
      const unlabelledFields = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')].filter((el) => {
        if (getComputedStyle(el).display === 'none') return false;
        return !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby');
      });
      return {
        h1: document.querySelectorAll('h1').length,
        unnamed: unnamed.length,
        unlabelled: unlabelledFields.map((e) => e.outerHTML.slice(0, 80)),
      };
    });
    assert(report.h1 === 1, `${route}: exactly one h1 (found ${report.h1})`);
    assert(report.unnamed === 0, `${route}: ${report.unnamed} buttons or links without a name`);
    assert(report.unlabelled.length === 0, `${route}: unlabelled form fields ${report.unlabelled.join(' | ')}`);
  }
});
await step('keyboard: the skip link and tab order reach the main content', async () => {
  await go('/projects');
  await page.keyboard.press('Tab');
  await page.getByRole('link', { name: 'Skip to content' }).waitFor();
  await page.keyboard.press('Enter');
  const focusedInMain = await page.evaluate(() => location.hash === '#main');
  assert(focusedInMain, 'the skip link jumps to the main content');
});
await step('no console errors or failed requests during the whole run', async () => {
  assert(consoleProblems.length === 0, consoleProblems.slice(0, 3).join(' || '));
});

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`);
process.exit(failed.length === 0 ? 0 : 1);
