// File-based storage: one JSON file per collection in ./data (override with RESUME_DATA_DIR).
// Server-side only. Every save is validated, written atomically, and periodically backed up.
import fs from 'node:fs/promises';
import path from 'node:path';
import { SCHEMAS, COLLECTIONS, emptyFor } from './schemas.js';

export const DATA_DIR = () => process.env.RESUME_DATA_DIR || path.join(process.cwd(), 'data');
const fileFor = (name) => path.join(DATA_DIR(), `${name}.json`);
const BACKUP_EVERY_MS = 10 * 60 * 1000;
const BACKUP_KEEP = 30;

export function assertName(name) {
  if (!COLLECTIONS.includes(name)) throw Object.assign(new Error(`Unknown collection "${name}"`), { status: 404 });
}

export async function readCollection(name) {
  assertName(name);
  try {
    return JSON.parse(await fs.readFile(fileFor(name), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return emptyFor(name);
    throw e;
  }
}

export async function readAll() {
  const out = {};
  for (const name of COLLECTIONS) out[name] = await readCollection(name);
  return out;
}

async function backupIfDue(name) {
  const dir = path.join(DATA_DIR(), '_backups');
  let existing;
  try { existing = await fs.readFile(fileFor(name), 'utf8'); } catch { return; }
  await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter((f) => f.startsWith(`${name}.`)).sort();
  if (files.length) {
    const last = await fs.stat(path.join(dir, files[files.length - 1]));
    if (Date.now() - last.mtimeMs < BACKUP_EVERY_MS) return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(path.join(dir, `${name}.${stamp}.json`), existing);
  const all = (await fs.readdir(dir)).filter((f) => f.startsWith(`${name}.`)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) await fs.unlink(path.join(dir, f));
}

/** Validate then save. Throws a ZodError (status 400) when data is invalid. */
export async function writeCollection(name, value) {
  assertName(name);
  const parsed = SCHEMAS[name].parse(value);
  await fs.mkdir(DATA_DIR(), { recursive: true });
  await backupIfDue(name);
  const tmp = `${fileFor(name)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(parsed, null, 2) + '\n');
  await fs.rename(tmp, fileFor(name));
  return parsed;
}
