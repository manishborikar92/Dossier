import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { matchForResume } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => json(matchForResume(getDb(), intParam((await ctx.params).id))));

/** Match an unsaved job description (the text typed in the box) without changing the resume. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  const { jdText } = z.object({ jdText: z.string().max(20000) }).parse(await readJson(req));
  return json(matchForResume(getDb(), id, jdText));
});
