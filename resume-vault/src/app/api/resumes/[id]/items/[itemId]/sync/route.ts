import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { syncDiff, syncItem } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => {
  const { id, itemId } = await ctx.params;
  return json(syncDiff(getDb(), intParam(id), intParam(itemId, 'item id')));
});

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  const { action } = z.object({ action: z.enum(['pull', 'keep']) }).parse(await readJson(req));
  return json(syncItem(getDb(), intParam(id), intParam(itemId, 'item id'), action));
});
