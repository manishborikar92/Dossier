import { restoreBackup } from '@/server/backup';
import { backupDir, getDb } from '@/server/db';
import { handle, json, readJson } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const result = restoreBackup(getDb(), body, { safetyDir: backupDir() });
  return json(result);
});
