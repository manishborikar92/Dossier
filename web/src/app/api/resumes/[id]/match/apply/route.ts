import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { applyProjectSelection } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  const { projectIds } = z.object({ projectIds: z.array(z.number().int().positive()).max(50) }).parse(await readJson(req));
  return json(applyProjectSelection(getDb(), id, projectIds));
});
