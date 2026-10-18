import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { duplicateResume } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  const body = z.object({ name: z.string().trim().max(120).optional() }).parse(await readJson(req).catch(() => ({})));
  return json(duplicateResume(getDb(), id, body.name), 201);
});
