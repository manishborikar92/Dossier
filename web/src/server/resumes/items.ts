import type { DB } from '../db';
import { itemDataSchemas, leadershipDataSchema } from '@/lib/schemas';
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
import type { Certification, Education, Experience, ItemSection, Project, ResumeItem, Skill, SourceType, SyncDiff } from '@/lib/types';
import { badRequest, conflict, notFound } from '../errors';
import { getEntity, getProfile } from '../library';
import { getResumeRecord, loadItems, touch, type Row } from './core';

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
    db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM resume_items WHERE resume_id = ? AND section = ?')
      .get(resumeId, section) as {
      n: number;
    }
  ).n;
}

export function insertItem(db: DB, resumeId: number, sourceType: SourceType, sourceId: number, included = true): number {
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

function getItemRow(db: DB, resumeId: number, itemId: number): Row {
  const row = db.prepare('SELECT * FROM resume_items WHERE id = ? AND resume_id = ?').get(itemId, resumeId) as Row | undefined;
  if (!row) throw notFound('This resume item');
  return row;
}

export function addItem(db: DB, resumeId: number, input: { sourceType: SourceType; sourceId: number }): ResumeItem {
  getResumeRecord(db, resumeId);
  if (input.sourceType === 'profile') throw badRequest('The header is already part of every resume.');
  const itemId = db.transaction(() => {
    const built = buildFromSource(db, input.sourceType, input.sourceId);
    if (built.section === 'summary') {
      const existing = db.prepare("SELECT id FROM resume_items WHERE resume_id = ? AND section = 'summary'").get(resumeId) as
        { id: number } | undefined;
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

export function updateItem(db: DB, resumeId: number, itemId: number, patch: { included?: boolean; data?: unknown }): ResumeItem {
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
