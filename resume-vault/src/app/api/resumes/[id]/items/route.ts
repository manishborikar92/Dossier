import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { addItem } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  sourceType: z.enum(['summary', 'experience', 'project', 'education', 'certification', 'skill']),
  sourceId: z.number().int().positive(),
});

export const POST = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  return json(addItem(getDb(), id, bodySchema.parse(await readJson(req))), 201);
});
