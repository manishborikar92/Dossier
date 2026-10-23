import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  createEntity,
  deleteEntity,
  getEntity,
  getProfile,
  listEntities,
  reorderEntities,
  saveProfile,
  updateEntity,
} from '@/server/library';
import { createResume } from '@/server/resumes';
import type { Experience, Project } from '@/lib/types';
import { freshDb } from './helpers';

describe('profile', () => {
  it('saves identity, links and summary variants and bumps the version only when something changed', () => {
    const db = freshDb();
    const before = getProfile(db);
    expect(before.fullName).toBe('Alex Sample');
    expect(before.summaries).toHaveLength(2);

    const same = saveProfile(db, { ...before });
    expect(same.version).toBe(before.version);

    const changed = saveProfile(db, { ...before, headline: 'Updated headline' });
    expect(changed.version).toBe(before.version + 1);
    expect(changed.headline).toBe('Updated headline');
  });

  it('only bumps a summary variant version when that variant changes', () => {
    const db = freshDb();
    const p = getProfile(db);
    const edited = p.summaries.map((s, i) => (i === 0 ? { ...s, text: 'A new first summary.' } : s));
    const after = saveProfile(db, { ...p, summaries: edited });
    expect(after.summaries[0].version).toBe(p.summaries[0].version + 1);
    expect(after.summaries[1].version).toBe(p.summaries[1].version);
  });

  it('rejects an invalid email and a missing name', () => {
    const db = freshDb();
    const p = getProfile(db);
    expect(() => saveProfile(db, { ...p, email: 'not-an-email' })).toThrow(ZodError);
    expect(() => saveProfile(db, { ...p, fullName: '  ' })).toThrow(ZodError);
  });
});

describe('library entities', () => {
  it('creates, reads, updates and deletes an experience with bullets', () => {
    const db = freshDb(false);
    const created = createEntity<Experience>(db, 'experiences', {
      org: 'Acme',
      title: 'Engineer',
      location: '',
      start: '2024-02',
      end: '',
      kind: 'job',
      description: '',
      archived: false,
      bullets: [
        { text: 'Did a thing.', verified: false },
        { text: 'Did another thing.', verified: true },
      ],
    });
    expect(created.bullets.map((b) => b.text)).toEqual(['Did a thing.', 'Did another thing.']);
    expect(created.version).toBe(1);

    const updated = updateEntity<Experience>(db, 'experiences', created.id, {
      ...created,
      title: 'Senior Engineer',
      bullets: [{ ...created.bullets[1] }, { text: 'Brand new bullet.', verified: false }],
    });
    expect(updated.version).toBe(2);
    expect(updated.bullets.map((b) => b.text)).toEqual(['Did another thing.', 'Brand new bullet.']);
    expect(updated.bullets[0].id).toBe(created.bullets[1].id); // kept its identity

    const unchanged = updateEntity<Experience>(db, 'experiences', created.id, updated);
    expect(unchanged.version).toBe(2);

    deleteEntity(db, 'experiences', created.id);
    expect(() => getEntity(db, 'experiences', created.id)).toThrow(/not found/i);
    expect((db.prepare('SELECT COUNT(*) AS n FROM bullets').get() as { n: number }).n).toBe(0);
  });

  it('validates dates and required fields', () => {
    const db = freshDb(false);
    const bad = {
      org: 'Acme',
      title: 'Engineer',
      location: '',
      start: '2024-06',
      end: '2024-01',
      kind: 'job',
      description: '',
      archived: false,
      bullets: [],
    };
    expect(() => createEntity(db, 'experiences', bad)).toThrow(/end date/i);
    expect(() => createEntity(db, 'experiences', { ...bad, end: '', title: '' })).toThrow(/required/i);
    expect(() => createEntity(db, 'certifications', { name: 'X', issuer: '', year: '', url: 'not a url' })).toThrow(/link/i);
  });

  it('stores project lists as arrays and supports archive and reordering', () => {
    const db = freshDb();
    const projects = listEntities<Project>(db, 'projects');
    expect(projects[0].technologies).toContain('React');
    const archivedOne = projects.find((p) => p.status === 'archived');
    expect(archivedOne?.name).toBe('Sample Command-Line Tool');

    reorderEntities(db, 'projects', [projects[2].id, projects[0].id, projects[1].id, projects[3].id]);
    const reordered = listEntities<Project>(db, 'projects');
    expect(reordered[0].id).toBe(projects[2].id);
  });

  it('reports how many resumes used a deleted item, and those resumes keep their copy', () => {
    const db = freshDb();
    const project = listEntities<Project>(db, 'projects')[0];
    const { resume } = createResume(db, {
      name: 'R',
      targetTitle: '',
      targetCompany: '',
      template: 'classic',
      jdText: '',
      preselect: 'top',
    });
    expect(getEntity<Project>(db, 'projects', project.id).usedInCount).toBe(1);
    const res = deleteEntity(db, 'projects', project.id);
    expect(res.usedInResumes).toBe(1);
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM resume_items WHERE resume_id = ? AND source_type = 'project' AND source_id = ?")
      .get(resume.id, project.id) as { n: number };
    expect(row.n).toBe(1);
  });
});
