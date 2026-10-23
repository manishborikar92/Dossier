import { idListSchema } from '@/lib/schemas';
import { getDb } from '@/server/db';
import { notFound } from '@/server/errors';
import { handle, json, readJson } from '@/server/http';
import { isEntityName, reorderEntities } from '@/server/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const { entity } = await ctx.params;
  if (!isEntityName(entity)) throw notFound('This kind of record');
  const { ids } = idListSchema.parse(await readJson(req));
  reorderEntities(getDb(), entity, ids);
  return json({ ok: true });
});
