import { exportBackup } from '@/server/backup';
import { getDb } from '@/server/db';
import { handle } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const backup = exportBackup(getDb());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="resume-vault-backup-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
