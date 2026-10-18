import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { listVersions, restoreVersion } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id, versionId } = await ctx.params;
  z.object({ action: z.literal('restore') }).parse(await readJson(req));
  const db = getDb();
  const result = restoreVersion(db, intParam(id), intParam(versionId, 'version id'));
  return json({ ...result, versions: listVersions(db, intParam(id)) });
});
