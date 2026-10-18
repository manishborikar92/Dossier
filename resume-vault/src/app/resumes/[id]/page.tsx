import { notFound } from 'next/navigation';
import { ResumeBuilder } from '@/components/builder/ResumeBuilder';
import type { BuilderLibrary } from '@/components/builder/helpers';
import { getDb } from '@/server/db';
import { HttpError } from '@/server/errors';
import { listEntities } from '@/server/library';
import { getResume, listVersions } from '@/server/resumes';
import type { Certification, Education, Experience, Project, Skill } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resume builder' };

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const db = getDb();
  let data;
  try {
    data = { ...getResume(db, n), versions: listVersions(db, n) };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const library: BuilderLibrary = {
    summaries: (db.prepare('SELECT id, label, text FROM summaries ORDER BY sort, id').all() as BuilderLibrary['summaries']),
    experiences: listEntities<Experience>(db, 'experiences'),
    projects: listEntities<Project>(db, 'projects'),
    education: listEntities<Education>(db, 'education'),
    certifications: listEntities<Certification>(db, 'certifications'),
    skills: listEntities<Skill>(db, 'skills'),
  };
  return <ResumeBuilder key={n} initial={data} library={library} />;
}
