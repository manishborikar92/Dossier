import { databasePath, getDb, resolveDataDir } from '@/server/db';
import { handle, json, readJson } from '@/server/http';
import { getAppSettings, saveAppSettings } from '@/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payload = () => ({ ...getAppSettings(getDb()), databasePath: databasePath(), dataDir: resolveDataDir() });

export const GET = handle(async () => json(payload()));

export const PUT = handle(async (req) => {
  saveAppSettings(getDb(), await readJson(req));
  return json(payload());
});
