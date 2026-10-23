import path from 'node:path';
import type { DB } from './db';
import { copyDatabase, nowIso } from './db';
import type { RestoreResult } from '@/lib/types';
import { badRequest } from './errors';
import { MIGRATIONS } from './migrations';

export const BACKUP_APP = 'resume-vault';
export const BACKUP_FORMAT_VERSION = 1;

interface TableSpec {
  name: string;
  /** Columns stored as JSON text in SQLite; exported as real JSON. */
  json: string[];
}

// Parents before children: this is the order rows are inserted when restoring.
const TABLES: TableSpec[] = [
  { name: 'profile', json: [] },
  { name: 'profile_links', json: [] },
  { name: 'summaries', json: [] },
  { name: 'experiences', json: [] },
  { name: 'education', json: [] },
  { name: 'certifications', json: [] },
  { name: 'skills', json: [] },
  { name: 'projects', json: ['technologies', 'tags', 'keywords'] },
  { name: 'bullets', json: [] },
  { name: 'resumes', json: ['settings'] },
  { name: 'resume_items', json: ['data'] },
  { name: 'resume_versions', json: ['snapshot'] },
  { name: 'app_settings', json: [] },
];

type Row = Record<string, unknown>;

export interface BackupFile {
  app: string;
  formatVersion: number;
  exportedAt: string;
  migrations: string[];
  tables: Record<string, Row[]>;
}

export function exportBackup(db: DB): BackupFile {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${t.name} ORDER BY rowid`).all() as Row[];
    tables[t.name] = rows.map((r) => {
      const out: Row = { ...r };
      for (const c of t.json) if (typeof out[c] === 'string') out[c] = JSON.parse(out[c] as string);
      return out;
    });
  }
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: nowIso(), migrations: MIGRATIONS.map((m) => m.id), tables };
}

export function validateBackup(input: unknown): BackupFile {
  if (typeof input !== 'object' || input === null) throw badRequest('This file is not a Resume Vault backup.');
  const f = input as Partial<BackupFile>;
  if (f.app !== BACKUP_APP) throw badRequest('This file is not a Resume Vault backup (the "app" field is missing or different).');
  if (typeof f.formatVersion !== 'number' || f.formatVersion < 1) throw badRequest('The backup has no valid format version.');
  if (f.formatVersion > BACKUP_FORMAT_VERSION) {
    throw badRequest(`This backup was made by a newer version of Resume Vault (format ${f.formatVersion}). Update the app first.`);
  }
  if (typeof f.tables !== 'object' || f.tables === null) throw badRequest('The backup does not contain any data tables.');
  for (const [name, rows] of Object.entries(f.tables)) {
    if (!TABLES.some((t) => t.name === name)) continue;
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'object' || r === null || Array.isArray(r))) {
      throw badRequest(`The backup's "${name}" table is not a list of records.`);
    }
  }
  return f as BackupFile;
}

/**
 * Replace everything in the database with the contents of a backup. A copy of the current database
 * is written first (when the database is a file), and the replacement is all-or-nothing.
 */
export function restoreBackup(db: DB, input: unknown, opts: { safetyDir?: string } = {}): RestoreResult {
  const backup = validateBackup(input);

  let safetyCopy: string | null = null;
  if (opts.safetyDir && db.name && db.name !== ':memory:') {
    safetyCopy = path.join(opts.safetyDir, `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    copyDatabase(db, safetyCopy);
  }

  const counts: Record<string, number> = {};
  try {
    db.transaction(() => {
      for (const t of [...TABLES].reverse()) db.prepare(`DELETE FROM ${t.name}`).run();
      for (const t of TABLES) {
        const rows = (backup.tables[t.name] ?? []) as Row[];
        const known = new Set((db.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string }[]).map((c) => c.name));
        for (const row of rows) {
          const cols = Object.keys(row).filter((c) => known.has(c));
          if (cols.length === 0) continue;
          const values = cols.map((c) => {
            const v = row[c];
            if (t.json.includes(c)) return JSON.stringify(v);
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (typeof v === 'object' && v !== null) return JSON.stringify(v);
            return v ?? null;
          });
          db.prepare(`INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...values);
        }
        counts[t.name] = rows.length;
      }
      // The profile is a single fixed row; make sure it exists even if the backup had none.
      db.prepare('INSERT OR IGNORE INTO profile (id) VALUES (1)').run();
    })();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw badRequest(`The backup could not be restored, so nothing was changed. (${message})`);
  }
  return { counts, safetyCopy };
}
