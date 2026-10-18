import { CareerManager } from '@/components/CareerManager';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { listEntities } from '@/server/library';
import type { Certification, Education, Experience, Skill } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Experience & skills' };

const TABS = ['experience', 'education', 'skills', 'certifications'] as const;

export default async function CareerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const db = getDb();
  return (
    <>
      <PageHeader title="Experience & skills" description="The facts about your work history, education and skills. Resumes copy from here." />
      <CareerManager
        initialTab={TABS.find((t) => t === tab) ?? 'experience'}
        experiences={listEntities<Experience>(db, 'experiences')}
        education={listEntities<Education>(db, 'education')}
        skills={listEntities<Skill>(db, 'skills')}
        certifications={listEntities<Certification>(db, 'certifications')}
      />
    </>
  );
}
