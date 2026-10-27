import type { DB } from './db';
import { getProfile, listEntities } from './library';
import { listResumes } from './resumes';
import type { ProfileData, Project, ResumeListEntry } from '@/lib/types';

export type CountableTable = 'experiences' | 'education' | 'certifications' | 'skills' | 'projects' | 'resumes' | 'resume_versions';

/** Number of rows in one of the app's own tables (the name comes from a fixed list, never from input). */
export function countRows(db: DB, table: CountableTable): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

export function countUnverifiedBullets(db: DB): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM bullets WHERE verified = 0').get() as { n: number }).n;
}

export interface SetupStep {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export interface DashboardData {
  profile: ProfileData;
  counts: { projects: number; experiences: number; skills: number; resumes: number };
  unverifiedBullets: number;
  resumes: ResumeListEntry[];
  /** Resumes that contain items whose library source has changed since they were copied. */
  needsReview: ResumeListEntry[];
  steps: SetupStep[];
}

export function getDashboardData(db: DB): DashboardData {
  const profile = getProfile(db);
  const projects = listEntities<Project>(db, 'projects');
  const resumes = listResumes(db);
  const counts = {
    projects: projects.filter((p) => p.status === 'active').length,
    experiences: countRows(db, 'experiences'),
    skills: countRows(db, 'skills'),
    resumes: resumes.length,
  };
  const steps: SetupStep[] = [
    { id: 'profile', label: 'Add your name and contact details', href: '/profile', done: profile.fullName !== '' },
    {
      id: 'career',
      label: 'Add your experience and education',
      href: '/career',
      done: counts.experiences > 0 && countRows(db, 'education') > 0,
    },
    { id: 'skills', label: 'Add your skills', href: '/career?tab=skills', done: counts.skills > 0 },
    { id: 'projects', label: 'Add or import your projects', href: '/projects', done: projects.length > 0 },
    { id: 'resume', label: 'Create your first resume', href: '/resumes', done: resumes.length > 0 },
  ];
  return {
    profile,
    counts,
    unverifiedBullets: countUnverifiedBullets(db),
    resumes,
    needsReview: resumes.filter((r) => r.outdatedCount > 0),
    steps,
  };
}

/** Row counts shown on the Settings page. */
export function getStorageCounts(db: DB): { label: string; value: number }[] {
  return [
    { label: 'projects', value: countRows(db, 'projects') },
    { label: 'experience entries', value: countRows(db, 'experiences') },
    { label: 'skills', value: countRows(db, 'skills') },
    { label: 'resumes', value: countRows(db, 'resumes') },
    { label: 'saved versions', value: countRows(db, 'resume_versions') },
  ];
}
