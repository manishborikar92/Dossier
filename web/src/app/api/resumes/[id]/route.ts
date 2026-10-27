import { getDb } from '@/server/db';
import { handle, intParam, json, readJson } from '@/server/http';
import { deleteResume, getResume, listVersions, updateResume } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, ctx) => {
  const id = intParam((await ctx.params).id);
  const db = getDb();
  return json({ ...getResume(db, id), versions: listVersions(db, id) });
});

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const id = intParam((await ctx.params).id);
  return json(updateResume(getDb(), id, await readJson(req)));
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  deleteResume(getDb(), intParam((await ctx.params).id));
  return json({ ok: true });
});
