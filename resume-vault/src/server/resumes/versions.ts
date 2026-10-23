import type { DB } from '../db';
import { nowIso } from '../db';
import { buildResumeDoc, type ResumeDoc } from '@/lib/resumeDoc';
import { normalizeSettings } from '@/lib/templates';
import type { ItemSection, ResumeItem, ResumeRecord, ResumeVersion, Snapshot, SourceType } from '@/lib/types';
import { notFound } from '../errors';
import { getResume } from './records';
import { getResumeRecord, type Row } from './core';

export function snapshotResume(db: DB, id: number): Snapshot {
  const resume = getResumeRecord(db, id);
  const rows = db.prepare('SELECT * FROM resume_items WHERE resume_id = ? ORDER BY section, position, id').all(id) as Row[];
  return {
    resume: {
      name: resume.name,
      targetTitle: resume.targetTitle,
      targetCompany: resume.targetCompany,
      template: resume.template,
      status: resume.status,
      settings: resume.settings,
      jdText: resume.jdText,
    },
    items: rows.map((r) => ({
      section: r.section as ItemSection,
      sourceType: (r.source_type as SourceType | null) ?? null,
      sourceId: (r.source_id as number | null) ?? null,
      sourceVersion: (r.source_version as number | null) ?? null,
      position: r.position as number,
      included: !!r.included,
      data: JSON.parse(r.data as string),
    })),
  };
}

function rowToVersion(r: Row): ResumeVersion {
  return {
    id: r.id as number,
    resumeId: r.resume_id as number,
    number: r.number as number,
    label: r.label as string,
    reason: r.reason as string,
    createdAt: r.created_at as string,
  };
}

export function listVersions(db: DB, resumeId: number): ResumeVersion[] {
  getResumeRecord(db, resumeId);
  return (
    db
      .prepare('SELECT id, resume_id, number, label, reason, created_at FROM resume_versions WHERE resume_id = ? ORDER BY number DESC')
      .all(resumeId) as Row[]
  ).map(rowToVersion);
}

/**
 * Save the current state as a new version. Automatic saves (exports, restores) are skipped when
 * nothing changed since the latest version; manual saves always create a version.
 */
export function saveVersion(
  db: DB,
  resumeId: number,
  opts: { label?: string; reason?: 'manual' | 'export' | 'before-restore' } = {},
): { version: ResumeVersion; created: boolean } {
  const reason = opts.reason ?? 'manual';
  const snapshot = JSON.stringify(snapshotResume(db, resumeId));
  const latest = db.prepare('SELECT * FROM resume_versions WHERE resume_id = ? ORDER BY number DESC LIMIT 1').get(resumeId) as
    Row | undefined;
  if (latest && reason !== 'manual' && latest.snapshot === snapshot) {
    return { version: rowToVersion(latest), created: false };
  }
  const number = ((latest?.number as number | undefined) ?? 0) + 1;
  const info = db
    .prepare('INSERT INTO resume_versions (resume_id, number, label, reason, snapshot) VALUES (?,?,?,?,?)')
    .run(resumeId, number, (opts.label ?? '').trim().slice(0, 120), reason, snapshot);
  const row = db.prepare('SELECT * FROM resume_versions WHERE id = ?').get(Number(info.lastInsertRowid)) as Row;
  return { version: rowToVersion(row), created: true };
}

export function getVersionSnapshot(db: DB, resumeId: number, versionId: number): Snapshot {
  const row = db.prepare('SELECT snapshot FROM resume_versions WHERE id = ? AND resume_id = ?').get(versionId, resumeId) as
    { snapshot: string } | undefined;
  if (!row) throw notFound('This version');
  return JSON.parse(row.snapshot) as Snapshot;
}

export function restoreVersion(db: DB, resumeId: number, versionId: number): { resume: ResumeRecord; items: ResumeItem[] } {
  const snapshot = getVersionSnapshot(db, resumeId, versionId);
  db.transaction(() => {
    saveVersion(db, resumeId, { reason: 'before-restore', label: 'Before restoring an older version' });
    const r = snapshot.resume;
    db.prepare(
      'UPDATE resumes SET name = ?, target_title = ?, target_company = ?, template = ?, status = ?, settings = ?, jd_text = ?, updated_at = ? WHERE id = ?',
    ).run(
      r.name,
      r.targetTitle,
      r.targetCompany,
      r.template,
      r.status,
      JSON.stringify(normalizeSettings(r.settings)),
      r.jdText,
      nowIso(),
      resumeId,
    );
    db.prepare('DELETE FROM resume_items WHERE resume_id = ?').run(resumeId);
    for (const it of snapshot.items) {
      db.prepare(
        'INSERT INTO resume_items (resume_id, section, source_type, source_id, source_version, position, included, data) VALUES (?,?,?,?,?,?,?,?)',
      ).run(resumeId, it.section, it.sourceType, it.sourceId, it.sourceVersion, it.position, it.included ? 1 : 0, JSON.stringify(it.data));
    }
  })();
  return getResume(db, resumeId);
}

export function docForResume(db: DB, resumeId: number, versionId?: number): ResumeDoc {
  const snapshot = versionId === undefined ? snapshotResume(db, resumeId) : getVersionSnapshot(db, resumeId, versionId);
  return buildResumeDoc(snapshot);
}
