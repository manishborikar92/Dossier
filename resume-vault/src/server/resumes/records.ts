import type { DB } from '../db';
import { nowIso } from '../db';
import { resumeCreateSchema, resumePatchSchema } from '@/lib/schemas';
import { defaultSettings, normalizeSettings } from '@/lib/templates';
import type { Certification, Education, Experience, ResumeItem, ResumeListEntry, ResumeRecord, Skill, Project } from '@/lib/types';
import { badRequest } from '../errors';
import { getProfile, listEntities } from '../library';
import { getAppSettings } from '../settings';
import { getResumeRecord, libraryVersions, loadItems, rowToResume, syncOf, type Row } from './core';
import { insertItem } from './items';
import { matchText } from './match';

export function getResume(db: DB, id: number): { resume: ResumeRecord; items: ResumeItem[] } {
  return { resume: getResumeRecord(db, id), items: loadItems(db, id) };
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
        (i) =>
          syncOf(versions, i.source_type as string | null, i.source_id as number | null, i.source_version as number | null) === 'changed',
      ).length,
    };
  });
}

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
        const ranked = matchText(db, value.jdText)
          .projects.slice(0, 3)
          .map((p) => p.id);
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
      .prepare(
        'INSERT INTO resumes (name, target_title, target_company, template, status, settings, jd_text, parent_id) VALUES (?,?,?,?,?,?,?,?)',
      )
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
