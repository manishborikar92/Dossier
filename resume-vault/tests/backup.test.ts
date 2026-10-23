import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup, validateBackup } from '@/server/backup';
import { openDb } from '@/server/db';
import { createResume, saveVersion, updateItem } from '@/server/resumes';
import { listEntities } from '@/server/library';
import type { Project } from '@/lib/types';
import { seedSample } from '@/server/sample';
import { freshDb } from './helpers';

const NEW = {
  name: 'Backup me',
  targetTitle: 'Dev',
  targetCompany: 'Acme',
  template: 'compact',
  jdText: 'React and Node.js',
  preselect: 'top',
} as const;

const strip = (b: ReturnType<typeof exportBackup>) => ({ ...b, exportedAt: '' });

describe('backup and restore', () => {
  it('round-trips the whole library, resumes and versions into an empty database', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    updateItem(db, resume.id, items.find((i) => i.section === 'summary')!.id, { data: { text: 'Custom summary for this resume.' } });
    saveVersion(db, resume.id, { label: 'v1' });

    const backup = exportBackup(db);
    const json = JSON.parse(JSON.stringify(backup)); // as it would be written to a file

    const target = openDb(':memory:');
    const result = restoreBackup(target, json);
    expect(result.counts.projects).toBe(4);
    expect(strip(exportBackup(target))).toEqual(strip(backup));
    expect(listEntities<Project>(target, 'projects')[0].technologies.length).toBeGreaterThan(0);
  });

  it('replaces existing data and keeps working afterwards', () => {
    const source = freshDb();
    createResume(source, NEW);
    const backup = JSON.parse(JSON.stringify(exportBackup(source)));

    const target = freshDb();
    createResume(target, { ...NEW, name: 'Will be replaced' });
    createResume(target, { ...NEW, name: 'Also replaced' });
    restoreBackup(target, backup);
    expect((target.prepare('SELECT COUNT(*) AS n FROM resumes').get() as { n: number }).n).toBe(1);
    // new rows get fresh ids after a restore
    expect(createResume(target, { ...NEW, name: 'After restore' }).resume.id).toBeGreaterThan(1);
  });

  it('rejects files that are not backups, and a failed restore changes nothing', () => {
    expect(() => validateBackup(null)).toThrow(/not a Resume Vault backup/);
    expect(() => validateBackup({ app: 'something-else' })).toThrow(/not a Resume Vault backup/);
    expect(() => validateBackup({ app: 'resume-vault', formatVersion: 99, tables: {} })).toThrow(/newer version/);

    const db = freshDb();
    const before = strip(exportBackup(db));
    const broken = JSON.parse(JSON.stringify(exportBackup(db)));
    broken.tables.skills[0].name = null; // violates NOT NULL, discovered mid-restore
    expect(() => restoreBackup(db, broken)).toThrow(/nothing was changed/);
    expect(strip(exportBackup(db))).toEqual(before);
  });

  it('writes a safety copy of a file database before restoring', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    try {
      const db = openDb(path.join(dir, 'vault.db'));
      seedSample(db);
      const backup = JSON.parse(JSON.stringify(exportBackup(db)));
      const result = restoreBackup(db, backup, { safetyDir: path.join(dir, 'backups') });
      expect(result.safetyCopy).toBeTruthy();
      expect(fs.existsSync(result.safetyCopy as string)).toBe(true);
      const copy = openDb(result.safetyCopy as string);
      expect((copy.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n).toBe(4);
      copy.close();
      db.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists data across closing and reopening the database file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-persist-'));
    try {
      const file = path.join(dir, 'vault.db');
      const first = openDb(file);
      seedSample(first);
      createResume(first, NEW);
      first.close();

      const second = openDb(file);
      expect((second.prepare('SELECT COUNT(*) AS n FROM resumes').get() as { n: number }).n).toBe(1);
      expect((second.prepare('SELECT full_name FROM profile WHERE id = 1').get() as { full_name: string }).full_name).toBe('Alex Sample');
      second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
