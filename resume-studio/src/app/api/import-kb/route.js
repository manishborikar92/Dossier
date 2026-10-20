import fs from 'node:fs/promises';
import path from 'node:path';
import { readCollection, writeCollection } from '@/lib/server/store.js';
import { mergeKB } from '@/lib/domain/kb-import.js';
import { json, fail } from '@/lib/server/http.js';

export const dynamic = 'force-dynamic';

// POST a knowledge-base JSON array to import it, or POST nothing to re-read seed/project_knowledge_base.json.
export async function POST(request) {
  try {
    let kb;
    const text = await request.text();
    if (text.trim()) kb = JSON.parse(text);
    else kb = JSON.parse(await fs.readFile(path.join(process.cwd(), 'seed', 'project_knowledge_base.json'), 'utf8'));
    if (!Array.isArray(kb) || !kb.every((k) => k && k.id)) return json({ error: 'Expected a JSON array of projects, each with an "id".' }, 400);
    const { projects, stats } = mergeKB(await readCollection('projects'), kb);
    await writeCollection('projects', projects);
    return json(stats);
  } catch (e) { return fail(e); }
}
