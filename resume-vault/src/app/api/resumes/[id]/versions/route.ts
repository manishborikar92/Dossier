import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { listVersions, saveVersion } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => json(listVersions(getDb(), intParam((await ctx.params).id))));

export const POST = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  const body = z.object({ label: z.string().trim().max(120).optional() }).parse(await readJson(req).catch(() => ({})));
  return json(saveVersion(getDb(), id, { label: body.label, reason: 'manual' }), 201);
});
