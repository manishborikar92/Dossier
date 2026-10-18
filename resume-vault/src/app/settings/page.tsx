import { SettingsPanel } from '@/components/SettingsPanel';
import { PageHeader } from '@/components/ui';
import { backupDir, databasePath, getDb } from '@/server/db';
import { getAppSettings } from '@/server/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings & backup' };

export default function SettingsPage() {
  const db = getDb();
  const n = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return (
    <>
      <PageHeader title="Settings & backup" description="Keep your data safe and set defaults." />
      <SettingsPanel
        defaults={getAppSettings(db)}
        databasePath={databasePath()}
        backupsPath={backupDir()}
        counts={[
          { label: 'projects', value: n('projects') },
          { label: 'experience entries', value: n('experiences') },
          { label: 'skills', value: n('skills') },
          { label: 'resumes', value: n('resumes') },
          { label: 'saved versions', value: n('resume_versions') },
        ]}
      />
    </>
  );
}
