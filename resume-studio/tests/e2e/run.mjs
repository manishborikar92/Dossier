// End-to-end tests: starts the built app on a temporary copy of your data, drives a real browser
// (your installed Chrome or Edge), and checks the main journeys plus accessibility.
//
//   npm run build        (once)
//   npm run test:e2e
//
// Set CHROME_PATH if your browser is not found automatically. Your real data/ folder is never touched.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');

// ---------- find a browser ----------
function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  return candidates.find((p) => fs.existsSync(p));
}
const browserPath = findBrowser();
if (!browserPath) { console.error('No Chrome or Edge found. Install one, or set CHROME_PATH to its executable.'); process.exit(2); }
if (!fs.existsSync(path.join(ROOT, '.next'))) { console.error('Run "npm run build" first.'); process.exit(2); }

// ---------- temp data + server ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-e2e-'));
fs.cpSync(path.join(ROOT, 'data'), tmp, { recursive: true, filter: (src) => !src.includes('_backups') });
const disk = (name) => JSON.parse(fs.readFileSync(path.join(tmp, `${name}.json`), 'utf8'));

const port = await new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const BASE = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: ROOT, env: { ...process.env, RESUME_DATA_DIR: tmp }, stdio: 'ignore',
});
const stop = () => { try { server.kill(); } catch { /* already stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }

const extra = process.env.E2E_CHROME_ARGS ? JSON.parse(process.env.E2E_CHROME_ARGS) : [];
const browser = await puppeteer.launch({
  executablePath: browserPath, headless: true,
  args: [...extra, ...(process.env.CI || process.env.E2E_NO_SANDBOX ? ['--no-sandbox'] : [])],
});

// ---------- tiny harness ----------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(pathname, { theme = 'light', width = 1440, height = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.evaluateOnNewDocument((t) => { try { if (!localStorage.getItem('rs-theme')) localStorage.setItem('rs-theme', t); } catch { /* ignore */ } }, theme);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.errors = errors;
  await page.goto(BASE + pathname, { waitUntil: 'networkidle0' });
  return page;
}
const click = (page, sel) => page.locator(sel).setTimeout(8000).click();
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 8000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const waitDisk = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (fn()) return true; } catch { /* retry */ } await sleep(150); } return false; };

// ---------- tests ----------
test('dashboard shows your resumes and the state of your library', async () => {
  const page = await open('/');
  await waitText(page, 'What your resumes can use');
  assert.equal(await page.$$eval('.sheetcard', (n) => n.length), 2);
  const t = await text(page);
  assert.match(t, /bullets you can stand behind/);
  assert.ok(await page.$('a.skip-link'), 'skip link present');
  assert.equal(await page.$eval('.nav__link.is-active', (a) => a.textContent.trim().split(/\s/)[0]), 'Resumes');
  assert.deepEqual(page.errors, []);
});

test('new-resume dialog opens, closes with Escape, and creates a resume', async () => {
  const page = await open('/');
  await click(page, '.page-header button::-p-text(New resume)');
  await page.waitForSelector('dialog[open]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  const before = disk('resumes').length;
  await click(page, '.page-header button::-p-text(New resume)');
  await page.waitForSelector('dialog[open]');
  await click(page, 'dialog input[value="default"]');
  await click(page, 'dialog button::-p-text(Create resume)');
  await page.waitForFunction(() => location.pathname.startsWith('/resume/'), { timeout: 20000 });
  assert.ok(await waitDisk(() => disk('resumes').length === before + 1), 'resume saved to disk');
  await page.waitForSelector('.sheet');
  assert.deepEqual(page.errors, []);
});

test('editor: ticking a project adds it, and unreviewed bullets are not slipped in', async () => {
  const page = await open('/resume/resume-current');
  await page.waitForSelector('.sheet');
  const row = await page.evaluateHandle(() => [...document.querySelectorAll('.entry')].find((e) => e.textContent.includes('EnRouteAR')));
  await (await row.$('input[type=checkbox]')).click();
  await page.waitForFunction(() => document.querySelector('.sheet').innerText.includes('EnRouteAR'));
  assert.ok(!(await page.$eval('.sheet', (s) => s.innerText)).includes('Developed an AR navigation system'), 'needs-review bullet must stay off');
  assert.ok(await waitDisk(() => disk('resumes').find((r) => r.id === 'resume-current').selection.projects.some((p) => p.id === 'enroutear')));
});

test('editor: template and per-resume wording autosave without touching the library', async () => {
  const page = await open('/resume/resume-current');
  await page.waitForSelector('.sheet');
  await click(page, '.tpl::-p-text(Compact)');
  assert.ok(await waitDisk(() => disk('resumes').find((r) => r.id === 'resume-current').template === 'compact'), 'template saved');
  await click(page, 'summary.disc__sum::-p-text(Summary)');
  const ta = 'textarea[aria-label="Summary text for this resume"]';
  await page.waitForSelector(ta);
  await page.$eval(ta, (el) => { el.focus(); el.select(); });
  await page.keyboard.type('A custom summary for this resume only.');
  assert.ok(await waitDisk(() => disk('resumes').find((r) => r.id === 'resume-current').overrides['summary:sum-fullstack'] === 'A custom summary for this resume only.'));
  assert.ok(disk('summaries')[0].text.startsWith('Full Stack Developer'), 'library untouched');
  await page.waitForFunction(() => document.querySelector('.sheet').innerText.includes('A custom summary'));
});

test('editor: exact page count, fit to pages, export formats', async () => {
  const page = await open('/resume/resume-current');
  await page.waitForFunction(() => /\d+ pages?/.test(document.querySelector('.pagechip')?.innerText || ''), { timeout: 15000 });
  await click(page, '[role=tab]::-p-text(Checks)');
  await click(page, 'button::-p-text(Fit to)');
  await page.waitForFunction(() => /fits in|Already fits|Still \d+ pages/i.test(document.body.innerText), { timeout: 20000 });
  await click(page, 'button[aria-haspopup="menu"]::-p-text(Export)');
  const items = await page.$$eval('[role=menuitem]', (n) => n.map((x) => x.textContent.trim()));
  assert.deepEqual(items, ['Download DOCX', 'Download PDF', 'Open PDF in a new tab', 'Download plain text']);
  const types = await page.evaluate(async () => Promise.all(['docx', 'pdf', 'txt'].map(async (f) => (await fetch(`/api/export/resume-current?format=${f}`)).headers.get('content-type'))));
  assert.match(types[0], /wordprocessingml/); assert.match(types[1], /pdf/); assert.match(types[2], /text\/plain/);
});

test('review queue: marking a bullet Confident persists and the row stays put', async () => {
  const page = await open('/library?tab=review');
  await page.waitForSelector('.rq');
  const count = () => disk('projects').flatMap((p) => p.bullets).filter((b) => b.status === 'confident').length;
  const before = count();
  const first = (await page.$$('.rq'))[0];
  await (await first.$('button::-p-text(Confident)')).click();
  assert.ok(await waitDisk(() => count() === before + 1), 'status saved');
  await page.waitForFunction(() => document.querySelector('.rq').classList.contains('rq--confident'));
});

test('library: deleting asks first, and Cancel keeps the item', async () => {
  const page = await open('/library?tab=certifications');
  await page.waitForSelector('.itemlist');
  await click(page, 'button::-p-text(Add certification)');
  await page.waitForSelector('.form__head h3');
  const n = disk('certifications').length;
  await click(page, '.form__head button::-p-text(Delete)');
  await page.waitForSelector('dialog[open]');
  await click(page, 'dialog button::-p-text(Cancel)');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.ok(await waitDisk(() => disk('certifications').length === n + 1), 'still there after cancel');
  await click(page, '.form__head button::-p-text(Delete)');
  await page.waitForSelector('dialog[open]');
  await click(page, 'dialog button::-p-text(Delete)');
  assert.ok(await waitDisk(() => disk('certifications').length === n), 'removed after confirming');
});

test('targets: creates a tailored resume and lands in the editor', async () => {
  const page = await open('/targets');
  await waitText(page, 'What your library can offer');
  const before = disk('resumes').length;
  await click(page, 'button::-p-text(Create tailored resume)');
  await page.waitForFunction(() => location.pathname.startsWith('/resume/'), { timeout: 30000 });
  assert.ok(await waitDisk(() => disk('resumes').length === before + 1));
  const made = disk('resumes').at(-1);
  assert.ok(made.selection.projects.length >= 1);
  await page.waitForSelector('.sheet');
});

test('dashboard: duplicate, delete with confirmation, and undo', async () => {
  const page = await open('/');
  await page.waitForSelector('.sheetcard');
  const start = disk('resumes').length;
  await click(page, 'button[aria-label="Actions for Current resume"]');
  await click(page, '[role=menuitem]::-p-text(Duplicate)');
  await waitText(page, 'Copy created', 20000);
  assert.ok(await waitDisk(() => disk('resumes').length === start + 1), 'duplicated');
  await page.waitForFunction((n) => document.querySelectorAll('.sheetcard').length === n, {}, start + 1);
  await click(page, 'button[aria-label="Actions for Current resume (copy)"]');
  await click(page, '[role=menuitem]::-p-text(Delete)');
  await page.waitForSelector('dialog[open]');
  await click(page, 'dialog button::-p-text(Delete resume)');
  await waitText(page, 'Resume deleted');
  assert.ok(await waitDisk(() => disk('resumes').length === start), 'deleted');
  await click(page, 'button.toast__action::-p-text(Undo)');
  assert.ok(await waitDisk(() => disk('resumes').length === start + 1), 'undo restored it');
});

test('theme toggle switches, and the choice is remembered', async () => {
  const page = await open('/');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await click(page, 'button[aria-label="Switch to dark theme"]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
});

test('keyboard: library tabs follow the arrow keys', async () => {
  const page = await open('/library');
  await page.waitForSelector('[role=tab][aria-selected=true]');
  await page.focus('[role=tab][aria-selected=true]');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.$eval('[role=tab][aria-selected=true]', (t) => t.textContent.trim().replace(/\d+$/, '').trim()), 'Profile');
  await page.keyboard.press('End');
  assert.equal(await page.$eval('[role=tab][aria-selected=true]', (t) => t.textContent.trim()), 'Involvement');
});

test('small screens: the menu opens and the editor shows one pane at a time', async () => {
  const page = await open('/', { width: 390, height: 800 });
  await click(page, 'button[aria-label="Open menu"]');
  await page.waitForSelector('.sidebar.is-open');
  const editor = await open('/resume/resume-current', { width: 390, height: 800 });
  await editor.waitForSelector('.sheet');
  assert.equal(await editor.$eval('.pane--content', (e) => getComputedStyle(e).display), 'none');
  await click(editor, '.composer__switch button::-p-text(Content)');
  assert.notEqual(await editor.$eval('.pane--content', (e) => getComputedStyle(e).display), 'none');
});

const A11Y_PAGES = ['/', '/library?tab=review', '/library?tab=projects', '/library?tab=profile', '/targets', '/resume/resume-current', '/prep/resume-current'];
for (const theme of ['light', 'dark']) {
  test(`accessibility (${theme}): no serious or critical violations on any page`, async () => {
    const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
    const problems = [];
    for (const p of A11Y_PAGES) {
      const page = await open(p, { theme });
      await page.waitForSelector('main h1, .composer .ctb', { timeout: 20000 });
      await sleep(900);
      await page.evaluate(axeSource);
      const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' '), help: v.help })));
      for (const v of res) if (v.impact === 'serious' || v.impact === 'critical') problems.push(`${p} [${theme}] ${v.id} (${v.n}x): ${v.help} -> ${v.sample}`);
      await page.close();
    }
    assert.deepEqual(problems, []);
  });
}

// ---------- run ----------
let failed = 0;
for (const t of tests) {
  const started = Date.now();
  try { await t.fn(); console.log(`  ok    ${t.name}  (${((Date.now() - started) / 1000).toFixed(1)}s)`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${String(e.message).split('\n').join('\n        ').slice(0, 1400)}`); }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
await browser.close();
stop();
process.exit(failed ? 1 : 0);
