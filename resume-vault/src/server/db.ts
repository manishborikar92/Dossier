import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS } from './migrations';

export type DB = Database.Database;

export const nowIso = (): string => new Date().toISOString();

/** Folder that holds the database file and automatic backups. */
export function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim() || './data';
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function backupDir(dataDir = resolveDataDir()): string {
  return path.join(dataDir, 'backups');
}

/** Copy the whole database into a single file using SQLite's VACUUM INTO. */
export function copyDatabase(db: DB, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Open (and migrate) a database. `file` may be ':memory:' for tests.
 * Before applying new migrations to an existing database a safety copy is written
 * to the backups folder.
 */
export function openDb(file: string, opts: { safetyBackupDir?: string } = {}): DB {
  const inMemory = file === ':memory:';
  if (!inMemory) fs.mkdirSync(path.dirname(file), { recursive: true });
  const existedWithData = !inMemory && fs.existsSync(file) && fs.statSync(file).size > 0;

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');

  const applied = new Set((db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map((r) => r.id));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));

  if (pending.length > 0 && existedWithData && applied.size > 0 && opts.safetyBackupDir) {
    copyDatabase(db, path.join(opts.safetyBackupDir, `pre-migration-${stamp()}.db`));
  }

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(migration.id, nowIso());
    })();
  }
  return db;
}

const globalForDb = globalThis as unknown as { __resumeVaultDb?: DB };

/** Shared database for the running server process. */
export function getDb(): DB {
  if (!globalForDb.__resumeVaultDb) {
    const dir = resolveDataDir();
    globalForDb.__resumeVaultDb = openDb(path.join(dir, 'vault.db'), { safetyBackupDir: backupDir(dir) });
  }
  return globalForDb.__resumeVaultDb;
}

export function databasePath(): string {
  return path.join(resolveDataDir(), 'vault.db');
}
