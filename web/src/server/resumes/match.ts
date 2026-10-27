import type { DB } from '../db';
import { matchJobDescription, type MatchLibrary, type MatchResult } from '@/lib/matcher';
import type { Experience, Project, ResumeItem, ResumeMatch, Skill, SourceType } from '@/lib/types';
import { listEntities } from '../library';
import { getResumeRecord, loadItems, touch } from './core';
import { insertItem } from './items';

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
