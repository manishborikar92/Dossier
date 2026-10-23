import { describe, expect, it } from 'vitest';
import { isNavActive } from '@/components/layout/nav';
import { createEntity } from '@/server/library';
import { createResume } from '@/server/resumes';
import { countRows, countUnverifiedBullets, getDashboardData, getStorageCounts } from '@/server/stats';
import { freshDb } from './helpers';

describe('dashboard data', () => {
  it('starts an empty library with every setup step open', () => {
    const data = getDashboardData(freshDb(false));
    expect(data.steps.every((s) => !s.done)).toBe(true);
    expect(data.counts).toEqual({ projects: 0, experiences: 0, skills: 0, resumes: 0 });
    expect(data.resumes).toEqual([]);
  });

  it('reports counts, completed steps, unverified bullets and resumes that need review', () => {
    const db = freshDb();
    createEntity(db, 'projects', {
      name: 'Unverified one',
      category: '',
      overview: '',
      description: '',
      problem: '',
      solution: '',
      role: '',
      contributions: '',
      technologies: [],
      features: '',
      decisions: '',
      results: '',
      repoUrl: '',
      demoUrl: '',
      docsUrl: '',
      tags: [],
      keywords: [],
      yearLabel: '',
      family: '',
      status: 'active',
      notes: '',
      bullets: [{ text: 'Not yet checked.', verified: false }],
    });
    createResume(db, { name: 'R', targetTitle: '', targetCompany: '', template: 'classic', jdText: '', preselect: 'top' });
    const data = getDashboardData(db);
    expect(data.counts.projects).toBe(4); // three active sample projects plus the new one (the archived one is not counted)
    expect(data.counts.resumes).toBe(1);
    expect(data.steps.every((s) => s.done)).toBe(true);
    expect(data.unverifiedBullets).toBe(1);
    expect(data.needsReview).toEqual([]);
    expect(countUnverifiedBullets(db)).toBe(1);
  });

  it('counts rows for the settings page', () => {
    const db = freshDb();
    expect(countRows(db, 'skills')).toBe(11);
    const counts = Object.fromEntries(getStorageCounts(db).map((c) => [c.label, c.value]));
    expect(counts).toMatchObject({ projects: 4, 'experience entries': 3, skills: 11, resumes: 0, 'saved versions': 0 });
  });
});

describe('navigation', () => {
  it('marks the current section as active, including nested pages', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/projects/12', '/')).toBe(false);
    expect(isNavActive('/projects/12', '/projects')).toBe(true);
    expect(isNavActive('/projects-archive', '/projects')).toBe(false);
  });
});
