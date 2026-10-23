import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { PageHeader } from '@/components/ui';
import { backupDir, databasePath, getDb } from '@/server/db';
import { getAppSettings } from '@/server/settings';
import { getStorageCounts } from '@/server/stats';

export const metadata = { title: 'Settings & backup' };

export default function SettingsPage() {
  const db = getDb();
  return (
    <>
      <PageHeader title="Settings & backup" description="Keep your data safe and set defaults for new resumes." />
      <SettingsPanel defaults={getAppSettings(db)} databasePath={databasePath()} backupsPath={backupDir()} counts={getStorageCounts(db)} />
    </>
  );
}
