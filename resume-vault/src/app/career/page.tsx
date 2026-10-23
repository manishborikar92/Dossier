import { CareerManager } from '@/components/career/CareerManager';
import { CAREER_TABS } from '@/components/career/tabs';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { listEntities } from '@/server/library';
import type { Certification, Education, Experience, Skill } from '@/lib/types';

export const metadata = { title: 'Experience & skills' };

export default async function CareerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const db = getDb();
  return (
    <>
      <PageHeader
        title="Experience & skills"
        description="The facts about your work history, education and skills. Resumes copy from here."
      />
      <CareerManager
        initialTab={CAREER_TABS.find((t) => t === tab) ?? 'experience'}
        experiences={listEntities<Experience>(db, 'experiences')}
        education={listEntities<Education>(db, 'education')}
        skills={listEntities<Skill>(db, 'skills')}
        certifications={listEntities<Certification>(db, 'certifications')}
      />
    </>
  );
}
