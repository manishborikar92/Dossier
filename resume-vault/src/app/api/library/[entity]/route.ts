import { getDb } from '@/server/db';
import { notFound } from '@/server/errors';
import { handle, json, readJson } from '@/server/http';
import { createEntity, isEntityName, listEntities } from '@/server/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string }> };

async function entityOf(ctx: Ctx) {
  const { entity } = await ctx.params;
  if (!isEntityName(entity)) throw notFound('This kind of record');
  return entity;
}

export const GET = handle<Ctx>(async (_req, ctx) => json(listEntities(getDb(), await entityOf(ctx))));

export const POST = handle<Ctx>(async (req, ctx) => json(createEntity(getDb(), await entityOf(ctx), await readJson(req)), 201));
