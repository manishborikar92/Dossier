import { idListSchema } from '@/lib/schemas';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { reorderItems } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  const { ids } = idListSchema.parse(await readJson(req));
  reorderItems(getDb(), id, ids);
  return json({ ok: true });
});
