import { ResumesManager } from '@/components/resumes/ResumesManager';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { getProfile } from '@/server/library';
import { listResumes } from '@/server/resumes';
import { getAppSettings } from '@/server/settings';

export const metadata = { title: 'Resumes' };

export default function ResumesPage() {
  const db = getDb();
  return (
    <>
      <PageHeader
        title="Resumes"
        description="Each resume is independent: its own projects, wording, order, template and saved versions."
      />
      <ResumesManager
        initial={listResumes(db)}
        canCreate={getProfile(db).fullName.trim() !== ''}
        defaultTemplate={getAppSettings(db).defaultTemplate}
      />
    </>
  );
}
