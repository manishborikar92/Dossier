import type { DB } from '../db';
import { nowIso } from '../db';
import { normalizeSettings } from '@/lib/templates';
import type { ItemSection, ResumeItem, ResumeRecord, ResumeSettings, SourceType, SyncStatus } from '@/lib/types';
import { notFound } from '../errors';

export type Row = Record<string, unknown>;

export function rowToResume(r: Row): ResumeRecord {
  let settings: Partial<ResumeSettings> = {};
  try {
    settings = JSON.parse(r.settings as string);
  } catch {
    /* fall back to defaults */
  }
  return {
    id: r.id as number,
    name: r.name as string,
    targetTitle: r.target_title as string,
    targetCompany: r.target_company as string,
    template: r.template as ResumeRecord['template'],
    status: r.status as ResumeRecord['status'],
    settings: normalizeSettings(settings),
    jdText: r.jd_text as string,
    parentId: (r.parent_id as number | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

const LIBRARY_TABLE: Record<SourceType, string> = {
  profile: 'profile',
  summary: 'summaries',
  experience: 'experiences',
  project: 'projects',
  education: 'education',
  certification: 'certifications',
  skill: 'skills',
};

export function libraryVersions(db: DB): Map<string, number> {
  const map = new Map<string, number>();
  for (const [type, table] of Object.entries(LIBRARY_TABLE)) {
    for (const r of db.prepare(`SELECT id, version FROM ${table}`).all() as { id: number; version: number }[]) {
      map.set(`${type}:${r.id}`, r.version);
    }
  }
  return map;
}

export function syncOf(
  versions: Map<string, number>,
  sourceType: string | null,
  sourceId: number | null,
  sourceVersion: number | null,
): SyncStatus {
  if (!sourceType || sourceId === null) return 'manual';
  const current = versions.get(`${sourceType}:${sourceId}`);
  if (current === undefined) return 'missing';
  return current === sourceVersion ? 'current' : 'changed';
}

function rowToItem(r: Row, versions: Map<string, number>): ResumeItem {
  return {
    id: r.id as number,
    resumeId: r.resume_id as number,
    section: r.section as ItemSection,
    sourceType: (r.source_type as SourceType | null) ?? null,
    sourceId: (r.source_id as number | null) ?? null,
    sourceVersion: (r.source_version as number | null) ?? null,
    position: r.position as number,
    included: !!r.included,
    data: JSON.parse(r.data as string),
    sync: syncOf(versions, r.source_type as string | null, r.source_id as number | null, r.source_version as number | null),
  } as ResumeItem;
}

export function loadItems(db: DB, resumeId: number): ResumeItem[] {
  const versions = libraryVersions(db);
  const rows = db.prepare('SELECT * FROM resume_items WHERE resume_id = ? ORDER BY position, id').all(resumeId) as Row[];
  return rows.map((r) => rowToItem(r, versions));
}

export function getResumeRecord(db: DB, id: number): ResumeRecord {
  const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw notFound('This resume');
  return rowToResume(row);
}

/** Mark a resume as changed just now. */
export function touch(db: DB, resumeId: number): void {
  db.prepare('UPDATE resumes SET updated_at = ? WHERE id = ?').run(nowIso(), resumeId);
}
