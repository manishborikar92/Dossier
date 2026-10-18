import type { DB } from './db';
import { nowIso } from './db';
import {
  itemDataSchemas,
  leadershipDataSchema,
  resumeCreateSchema,
  resumePatchSchema,
  type SectionKey,
} from '@/lib/schemas';
import { buildResumeDoc, type ResumeDoc } from '@/lib/resumeDoc';
import {
  certificationData,
  describeItem,
  educationData,
  experienceData,
  headerFromProfile,
  projectData,
  sectionForExperience,
  skillData,
  summaryFromVariant,
} from '@/lib/itemData';
import { matchJobDescription, type MatchLibrary, type MatchResult } from '@/lib/matcher';
import { defaultSettings, normalizeSettings } from '@/lib/templates';
import type {
  Certification,
  Education,
  Experience,
  ItemDataMap,
  ItemSection,
  Project,
  ResumeItem,
  ResumeRecord,
  ResumeSettings,
  ResumeVersion,
  Skill,
  Snapshot,
  SourceType,
  SyncStatus,
} from '@/lib/types';
import { badRequest, conflict, notFound } from './errors';
import { getEntity, getProfile, listEntities } from './library';
import { getAppSettings } from './settings';

type Row = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

function rowToResume(r: Row): ResumeRecord {
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

function libraryVersions(db: DB): Map<string, number> {
  const map = new Map<string, number>();
  for (const [type, table] of Object.entries(LIBRARY_TABLE)) {
    for (const r of db.prepare(`SELECT id, version FROM ${table}`).all() as { id: number; version: number }[]) {
      map.set(`${type}:${r.id}`, r.version);
    }
  }
  return map;
}

function syncOf(
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

export function getResume(db: DB, id: number): { resume: ResumeRecord; items: ResumeItem[] } {
  return { resume: getResumeRecord(db, id), items: loadItems(db, id) };
}

export interface ResumeListEntry extends ResumeRecord {
  itemCount: number;
  projectCount: number;
  versionCount: number;
  outdatedCount: number;
}

export function listResumes(db: DB): ResumeListEntry[] {
  const versions = libraryVersions(db);
  const resumes = (db.prepare('SELECT * FROM resumes ORDER BY updated_at DESC, id DESC').all() as Row[]).map(rowToResume);
  const items = db.prepare('SELECT * FROM resume_items').all() as Row[];
  const vcount = new Map(
    (db.prepare('SELECT resume_id, COUNT(*) AS n FROM resume_versions GROUP BY resume_id').all() as { resume_id: number; n: number }[]).map(
      (r) => [r.resume_id, r.n],
    ),
  );
  return resumes.map((r) => {
    const mine = items.filter((i) => i.resume_id === r.id);
    return {
      ...r,
      itemCount: mine.length,
      projectCount: mine.filter((i) => i.section === 'projects' && i.included).length,
      versionCount: vcount.get(r.id) ?? 0,
      outdatedCount: mine.filter(
        (i) => syncOf(versions, i.source_type as string | null, i.source_id as number | null, i.source_version as number | null) === 'changed',
      ).length,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Copying library content into a resume                               */
/* ------------------------------------------------------------------ */

interface Built {
  section: ItemSection;
  data: unknown;
  version: number;
}

function buildFromSource(db: DB, sourceType: SourceType, sourceId: number): Built {
  switch (sourceType) {
    case 'profile': {
      const p = getProfile(db);
      return { section: 'header', data: headerFromProfile(p), version: p.version };
    }
    case 'summary': {
      const row = db.prepare('SELECT * FROM summaries WHERE id = ?').get(sourceId) as Row | undefined;
      if (!row) throw notFound('This summary');
      return { section: 'summary', data: summaryFromVariant({ text: row.text as string }), version: row.version as number };
    }
    case 'experience': {
      const e = getEntity<Experience>(db, 'experiences', sourceId);
      return { section: sectionForExperience(e.kind), data: experienceData(e), version: e.version };
    }
    case 'project': {
      const p = getEntity<Project>(db, 'projects', sourceId);
      return { section: 'projects', data: projectData(p), version: p.version };
    }
    case 'education': {
      const e = getEntity<Education>(db, 'education', sourceId);
      return { section: 'education', data: educationData(e), version: e.version };
    }
    case 'certification': {
      const c = getEntity<Certification>(db, 'certifications', sourceId);
      return { section: 'certifications', data: certificationData(c), version: c.version };
    }
    case 'skill': {
      const s = getEntity<Skill>(db, 'skills', sourceId);
      return { section: 'skills', data: skillData(s), version: s.version };
    }
  }
}

function nextPosition(db: DB, resumeId: number, section: string): number {
  return (
    db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM resume_items WHERE resume_id = ? AND section = ?').get(resumeId, section) as {
      n: number;
    }
  ).n;
}

function insertItem(db: DB, resumeId: number, sourceType: SourceType, sourceId: number, included = true): number {
  const built = buildFromSource(db, sourceType, sourceId);
  const info = db
    .prepare(
      'INSERT INTO resume_items (resume_id, section, source_type, source_id, source_version, position, included, data) VALUES (?,?,?,?,?,?,?,?)',
    )
    .run(
      resumeId,
      built.section,
      sourceType,
      sourceId,
      built.version,
      nextPosition(db, resumeId, built.section),
      included ? 1 : 0,
      JSON.stringify(built.data),
    );
  return Number(info.lastInsertRowid);
}

function touch(db: DB, resumeId: number): void {
  db.prepare('UPDATE resumes SET updated_at = ? WHERE id = ?').run(nowIso(), resumeId);
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export function loadMatchLibrary(db: DB): MatchLibrary {
  return {
    skills: listEntities<Skill>(db, 'skills'),
    projects: listEntities<Project>(db, 'projects').filter((p) => p.status === 'active'),
    experiences: listEntities<Experience>(db, 'experiences').filter((e) => !e.archived),
  };
}

export function matchText(db: DB, jdText: string): MatchResult {
  return matchJobDescription(jdText, loadMatchLibrary(db));
}

/* ------------------------------------------------------------------ */
/* Creating, updating, duplicating, deleting                            */
/* ------------------------------------------------------------------ */

export function createResume(db: DB, input: unknown): { resume: ResumeRecord; items: ResumeItem[] } {
  const value = resumeCreateSchema.parse(input);
  const profile = getProfile(db);
  if (profile.fullName.trim() === '') {
    throw badRequest('Add your name on the Profile page before creating a resume.');
  }
  const app = getAppSettings(db);

  const id = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO resumes (name, target_title, target_company, template, status, settings, jd_text) VALUES (?,?,?,?,?,?,?)')
      .run(
        value.name,
        value.targetTitle,
        value.targetCompany,
        value.template,
        'draft',
        JSON.stringify(defaultSettings({ pageSize: app.defaultPageSize })),
        value.jdText,
      );
    const resumeId = Number(info.lastInsertRowid);

    insertItem(db, resumeId, 'profile', 1);
    const firstSummary = db.prepare('SELECT id FROM summaries ORDER BY sort, id LIMIT 1').get() as { id: number } | undefined;
    if (firstSummary) insertItem(db, resumeId, 'summary', firstSummary.id);

    for (const e of listEntities<Experience>(db, 'experiences')) if (!e.archived) insertItem(db, resumeId, 'experience', e.id);
    for (const e of listEntities<Education>(db, 'education')) insertItem(db, resumeId, 'education', e.id);
    for (const c of listEntities<Certification>(db, 'certifications')) insertItem(db, resumeId, 'certification', c.id);
    for (const s of listEntities<Skill>(db, 'skills')) insertItem(db, resumeId, 'skill', s.id);

    if (value.preselect !== 'none') {
      const active = listEntities<Project>(db, 'projects').filter((p) => p.status === 'active');
      let chosen: number[] = active.slice(0, 3).map((p) => p.id);
      if (value.preselect === 'match' && value.jdText.trim() !== '') {
        const ranked = matchText(db, value.jdText).projects.slice(0, 3).map((p) => p.id);
        if (ranked.length > 0) chosen = ranked;
      }
      for (const pid of chosen) insertItem(db, resumeId, 'project', pid);
    }
    return resumeId;
  })();
  return getResume(db, id);
}

export function updateResume(db: DB, id: number, input: unknown): ResumeRecord {
  const current = getResumeRecord(db, id);
  const patch = resumePatchSchema.parse(input);
  const settings = normalizeSettings({ ...current.settings, ...(patch.settings ?? {}) });
  db.prepare(
    'UPDATE resumes SET name = ?, target_title = ?, target_company = ?, template = ?, status = ?, jd_text = ?, settings = ?, updated_at = ? WHERE id = ?',
  ).run(
    patch.name ?? current.name,
    patch.targetTitle ?? current.targetTitle,
    patch.targetCompany ?? current.targetCompany,
    patch.template ?? current.template,
    patch.status ?? current.status,
    patch.jdText ?? current.jdText,
    JSON.stringify(settings),
    nowIso(),
    id,
  );
  return getResumeRecord(db, id);
}

export function duplicateResume(db: DB, id: number, name?: string): ResumeRecord {
  const source = getResumeRecord(db, id);
  const newId = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO resumes (name, target_title, target_company, template, status, settings, jd_text, parent_id) VALUES (?,?,?,?,?,?,?,?)')
      .run(
        (name?.trim() || `Copy of ${source.name}`).slice(0, 120),
        source.targetTitle,
        source.targetCompany,
        source.template,
        'draft',
        JSON.stringify(source.settings),
        source.jdText,
        source.id,
      );
    const copyId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO resume_items (resume_id, section, source_type, source_id, source_version, position, included, data)
       SELECT ?, section, source_type, source_id, source_version, position, included, data FROM resume_items WHERE resume_id = ?`,
    ).run(copyId, id);
    return copyId;
  })();
  return getResumeRecord(db, newId);
}

export function deleteResume(db: DB, id: number): void {
  getResumeRecord(db, id);
  db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

function getItemRow(db: DB, resumeId: number, itemId: number): Row {
  const row = db.prepare('SELECT * FROM resume_items WHERE id = ? AND resume_id = ?').get(itemId, resumeId) as Row | undefined;
  if (!row) throw notFound('This resume item');
  return row;
}

export function addItem(
  db: DB,
  resumeId: number,
  input: { sourceType: SourceType; sourceId: number },
): ResumeItem {
  getResumeRecord(db, resumeId);
  if (input.sourceType === 'profile') throw badRequest('The header is already part of every resume.');
  const itemId = db.transaction(() => {
    const built = buildFromSource(db, input.sourceType, input.sourceId);
    if (built.section === 'summary') {
      const existing = db.prepare("SELECT id FROM resume_items WHERE resume_id = ? AND section = 'summary'").get(resumeId) as
        | { id: number }
        | undefined;
      if (existing) {
        db.prepare('UPDATE resume_items SET source_type = ?, source_id = ?, source_version = ?, data = ?, included = 1 WHERE id = ?').run(
          'summary',
          input.sourceId,
          built.version,
          JSON.stringify(built.data),
          existing.id,
        );
        touch(db, resumeId);
        return existing.id;
      }
    }
    const dup = db
      .prepare('SELECT id FROM resume_items WHERE resume_id = ? AND source_type = ? AND source_id = ?')
      .get(resumeId, input.sourceType, input.sourceId);
    if (dup) throw conflict('This item is already in the resume.');
    const id = insertItem(db, resumeId, input.sourceType, input.sourceId);
    touch(db, resumeId);
    return id;
  })();
  return loadItems(db, resumeId).find((i) => i.id === itemId) as ResumeItem;
}

export function updateItem(
  db: DB,
  resumeId: number,
  itemId: number,
  patch: { included?: boolean; data?: unknown },
): ResumeItem {
  const row = getItemRow(db, resumeId, itemId);
  const section = row.section as ItemSection;
  if (patch.data !== undefined) {
    const schema = section === 'leadership' ? leadershipDataSchema : itemDataSchemas[section as keyof typeof itemDataSchemas];
    const parsed = schema.parse(patch.data);
    db.prepare('UPDATE resume_items SET data = ? WHERE id = ?').run(JSON.stringify(parsed), itemId);
  }
  if (patch.included !== undefined) {
    if (section === 'header' && !patch.included) throw badRequest('The header cannot be hidden.');
    db.prepare('UPDATE resume_items SET included = ? WHERE id = ?').run(patch.included ? 1 : 0, itemId);
  }
  touch(db, resumeId);
  return loadItems(db, resumeId).find((i) => i.id === itemId) as ResumeItem;
}

export function removeItem(db: DB, resumeId: number, itemId: number): void {
  const row = getItemRow(db, resumeId, itemId);
  if (row.section === 'header') throw badRequest('The header cannot be removed.');
  db.prepare('DELETE FROM resume_items WHERE id = ?').run(itemId);
  touch(db, resumeId);
}

export function reorderItems(db: DB, resumeId: number, ids: number[]): void {
  getResumeRecord(db, resumeId);
  db.transaction(() => {
    ids.forEach((id, index) => {
      getItemRow(db, resumeId, id);
      db.prepare('UPDATE resume_items SET position = ? WHERE id = ?').run(index, id);
    });
    touch(db, resumeId);
  })();
}

export interface SyncDiff {
  status: SyncStatus;
  section: ItemSection;
  mine: string[];
  library: string[] | null;
}

export function syncDiff(db: DB, resumeId: number, itemId: number): SyncDiff {
  const item = loadItems(db, resumeId).find((i) => i.id === itemId);
  if (!item) throw notFound('This resume item');
  let library: string[] | null = null;
  if (item.sourceType && item.sourceId !== null && item.sync !== 'missing') {
    const built = buildFromSource(db, item.sourceType, item.sourceId);
    library = describeItem(built.section, built.data);
  }
  return { status: item.sync, section: item.section, mine: describeItem(item.section, item.data), library };
}

/** 'pull' replaces this resume's copy with the current library version; 'keep' accepts the difference. */
export function syncItem(db: DB, resumeId: number, itemId: number, action: 'pull' | 'keep'): ResumeItem {
  const item = loadItems(db, resumeId).find((i) => i.id === itemId);
  if (!item) throw notFound('This resume item');
  if (!item.sourceType || item.sourceId === null || item.sync === 'missing') {
    throw badRequest('This item has no library source to compare with.');
  }
  const built = buildFromSource(db, item.sourceType, item.sourceId);
  if (action === 'pull') {
    // The copy is replaced wholesale, so bullet edits and hidden bullets on this resume are replaced too.
    db.prepare('UPDATE resume_items SET data = ?, source_version = ? WHERE id = ?').run(JSON.stringify(built.data), built.version, itemId);
  } else {
    db.prepare('UPDATE resume_items SET source_version = ? WHERE id = ?').run(built.version, itemId);
  }
  touch(db, resumeId);
  return loadItems(db, resumeId).find((i) => i.id === itemId) as ResumeItem;
}

/* ------------------------------------------------------------------ */
/* Versions (immutable snapshots)                                       */
/* ------------------------------------------------------------------ */

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
  return (db.prepare('SELECT id, resume_id, number, label, reason, created_at FROM resume_versions WHERE resume_id = ? ORDER BY number DESC').all(resumeId) as Row[]).map(
    rowToVersion,
  );
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
  const latest = db.prepare('SELECT * FROM resume_versions WHERE resume_id = ? ORDER BY number DESC LIMIT 1').get(resumeId) as Row | undefined;
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
    | { snapshot: string }
    | undefined;
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
    ).run(r.name, r.targetTitle, r.targetCompany, r.template, r.status, JSON.stringify(normalizeSettings(r.settings)), r.jdText, nowIso(), resumeId);
    db.prepare('DELETE FROM resume_items WHERE resume_id = ?').run(resumeId);
    for (const it of snapshot.items) {
      db.prepare(
        'INSERT INTO resume_items (resume_id, section, source_type, source_id, source_version, position, included, data) VALUES (?,?,?,?,?,?,?,?)',
      ).run(resumeId, it.section, it.sourceType, it.sourceId, it.sourceVersion, it.position, it.included ? 1 : 0, JSON.stringify(it.data));
    }
  })();
  return getResume(db, resumeId);
}

/* ------------------------------------------------------------------ */
/* Export documents and matching for a resume                           */
/* ------------------------------------------------------------------ */

export function docForResume(db: DB, resumeId: number, versionId?: number): ResumeDoc {
  const snapshot = versionId === undefined ? snapshotResume(db, resumeId) : getVersionSnapshot(db, resumeId, versionId);
  return buildResumeDoc(snapshot);
}

export interface ResumeMatch {
  result: MatchResult;
  /** Library id -> whether it is currently included in this resume. */
  projectsInResume: Record<number, boolean>;
  skillsInResume: Record<number, boolean>;
}

export function matchForResume(db: DB, resumeId: number, jdText?: string): ResumeMatch {
  const resume = getResumeRecord(db, resumeId);
  const items = loadItems(db, resumeId);
  const flags = (type: SourceType) =>
    Object.fromEntries(items.filter((i) => i.sourceType === type && i.sourceId !== null).map((i) => [i.sourceId as number, i.included]));
  return {
    result: matchText(db, jdText ?? resume.jdText),
    projectsInResume: flags('project'),
    skillsInResume: flags('skill'),
  };
}

/** Make exactly these projects visible on the resume (adding any that are missing). */
export function applyProjectSelection(db: DB, resumeId: number, projectIds: number[]): ResumeItem[] {
  getResumeRecord(db, resumeId);
  db.transaction(() => {
    const wanted = new Set(projectIds);
    const items = loadItems(db, resumeId).filter((i) => i.sourceType === 'project');
    const present = new Set(items.map((i) => i.sourceId));
    for (const it of items) {
      db.prepare('UPDATE resume_items SET included = ? WHERE id = ?').run(wanted.has(it.sourceId as number) ? 1 : 0, it.id);
    }
    for (const pid of projectIds) if (!present.has(pid)) insertItem(db, resumeId, 'project', pid);
    touch(db, resumeId);
  })();
  return loadItems(db, resumeId);
}

export type { SectionKey, ItemDataMap };
