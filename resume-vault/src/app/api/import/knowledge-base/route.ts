import { z } from 'zod';
import { getDb } from '@/server/db';
import { handle, json, readJson } from '@/server/http';
import { importKnowledgeBase } from '@/server/kbImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Body: the knowledge-base list itself, or { data: [...], minScore?: number }. */
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const wrapped = z.object({ data: z.array(z.unknown()), minScore: z.number().min(0).max(100).optional() }).safeParse(body);
  const result = wrapped.success
    ? importKnowledgeBase(getDb(), wrapped.data.data, { minScore: wrapped.data.minScore })
    : importKnowledgeBase(getDb(), body);
  return json(result);
});
