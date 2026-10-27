import type { Metadata } from 'next';
import { ResumeBuilder } from '@/components/builder/ResumeBuilder';
import type { BuilderLibrary } from '@/components/builder/helpers';
import { getDb } from '@/server/db';
import { listEntities } from '@/server/library';
import { idOrNotFound, orNotFound } from '@/server/pages';
import { getResume, listVersions } from '@/server/resumes';
import type { Certification, Education, Experience, Project, Skill } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

const load = async ({ params }: Props) => {
  const id = idOrNotFound((await params).id);
  const db = getDb();
  return { id, db, detail: orNotFound(() => ({ ...getResume(db, id), versions: listVersions(db, id) })) };
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { detail } = await load(props);
  return { title: detail.resume.name };
}

export default async function ResumePage(props: Props) {
  const { id, db, detail } = await load(props);
  const library: BuilderLibrary = {
    summaries: db.prepare('SELECT id, label, text FROM summaries ORDER BY sort, id').all() as BuilderLibrary['summaries'],
    experiences: listEntities<Experience>(db, 'experiences'),
    projects: listEntities<Project>(db, 'projects'),
    education: listEntities<Education>(db, 'education'),
    certifications: listEntities<Certification>(db, 'certifications'),
    skills: listEntities<Skill>(db, 'skills'),
  };
  return <ResumeBuilder key={id} initial={detail} library={library} />;
}
