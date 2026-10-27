import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { removeItem, updateItem } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const patchSchema = z.object({ included: z.boolean().optional(), data: z.unknown().optional() });

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { id, itemId } = await ctx.params;
  const patch = patchSchema.parse(await readJson(req));
  return json(updateItem(getDb(), intParam(id), intParam(itemId, 'item id'), patch));
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id, itemId } = await ctx.params;
  removeItem(getDb(), intParam(id), intParam(itemId, 'item id'));
  return json({ ok: true });
});
