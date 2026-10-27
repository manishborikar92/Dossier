import { getDb } from '@/server/db';
import { notFound } from '@/server/errors';
import { handle, intParam, json, readJson } from '@/server/http';
import { deleteEntity, getEntity, isEntityName, updateEntity } from '@/server/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string; id: string }> };

async function target(ctx: Ctx) {
  const { entity, id } = await ctx.params;
  if (!isEntityName(entity)) throw notFound('This kind of record');
  return { entity, id: intParam(id) };
}

export const GET = handle<Ctx>(async (_req, ctx) => {
  const { entity, id } = await target(ctx);
  return json(getEntity(getDb(), entity, id));
});

export const PUT = handle<Ctx>(async (req, ctx) => {
  const { entity, id } = await target(ctx);
  return json(updateEntity(getDb(), entity, id, await readJson(req)));
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { entity, id } = await target(ctx);
  return json(deleteEntity(getDb(), entity, id));
});
