import { z } from 'zod';
import type { DB } from './db';
import { createEntity } from './library';
import type { KbImportResult } from '@/lib/types';
import { badRequest } from './errors';

/**
 * Imports the structured "project knowledge base" JSON (a list of project records).
 * Everything imported is marked unverified, and nothing the file does not state is invented:
 * role, contributions, results and repository links are left empty for you to fill in.
 */
const entrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  rank: z.number().optional(),
  score: z.number().optional(),
  purpose: z.string().optional(),
  architecture: z.string().optional(),
  technical_analysis: z.string().optional(),
  key_implementation_details: z.string().optional(),
  primary_technologies: z.array(z.string()).optional(),
  live_url: z.string().nullable().optional(),
  live_deployed_evidence: z.string().nullable().optional(),
  important_file_references: z.array(z.string()).optional(),
  year: z.string().optional(),
  first_commit: z.string().nullable().optional(),
  last_commit: z.string().nullable().optional(),
  commit_count: z.number().optional(),
  local_path: z.string().optional(),
  resume_entry: z.object({ bullets: z.array(z.string()).optional(), year: z.string().optional() }).optional(),
});

const clip = (s: string | undefined, max: number): string => (s ?? '').trim().slice(0, max);

export function importKnowledgeBase(db: DB, input: unknown, opts: { minScore?: number } = {}): KbImportResult {
  if (!Array.isArray(input)) throw badRequest('Expected a JSON list of projects (the project_knowledge_base.json file).');
  const result: KbImportResult = { imported: 0, skipped: [], belowMinScore: 0, failed: [] };

  for (const raw of input) {
    const rawId = typeof raw === 'object' && raw !== null && 'id' in raw ? String((raw as { id: unknown }).id) : '(no id)';
    const parsed = entrySchema.safeParse(raw);
    if (!parsed.success) {
      result.failed.push({ id: rawId, reason: parsed.error.issues[0]?.message ?? 'Unrecognised record' });
      continue;
    }
    const e = parsed.data;
    const sourceKey = `kb:${e.id}`;
    if (opts.minScore !== undefined && (e.score ?? 0) < opts.minScore) {
      result.belowMinScore += 1;
      continue;
    }
    if (db.prepare('SELECT 1 FROM projects WHERE source_key = ?').get(sourceKey)) {
      result.skipped.push(e.id);
      continue;
    }

    const noteLines = [
      `Imported from the project knowledge base (id ${e.id}${e.rank !== undefined ? `, rank ${e.rank}` : ''}${e.score !== undefined ? `, score ${e.score}/100` : ''}).`,
      e.commit_count !== undefined
        ? `Commits: ${e.commit_count}${e.first_commit ? `, ${e.first_commit} to ${e.last_commit ?? '?'}` : ''}.`
        : '',
      e.live_deployed_evidence ? `Deployment evidence: ${e.live_deployed_evidence}` : '',
      e.important_file_references?.length ? `Key files: ${e.important_file_references.join(', ')}` : '',
      e.local_path ? `Local folder: ${e.local_path}` : '',
    ].filter(Boolean);

    const year = e.year && e.year.toUpperCase() !== 'N/A' ? e.year : '';
    try {
      createEntity(
        db,
        'projects',
        {
          name: clip(e.title, 160),
          category: '',
          overview: clip(e.purpose, 500),
          description: clip(e.architecture, 4000),
          problem: '',
          solution: '',
          role: '',
          contributions: '',
          technologies: (e.primary_technologies ?? [])
            .map((t) => t.trim().slice(0, 60))
            .filter(Boolean)
            .slice(0, 60),
          features: clip(e.key_implementation_details, 2000),
          decisions: clip(e.technical_analysis, 2000),
          results: '',
          repoUrl: '',
          demoUrl: e.live_url && /^https?:\/\//i.test(e.live_url) ? e.live_url : '',
          docsUrl: '',
          tags: [],
          keywords: [],
          yearLabel: clip(year, 30),
          family: '',
          status: 'active',
          notes: clip(noteLines.join('\n'), 4000),
          bullets: (e.resume_entry?.bullets ?? [])
            .map((b) => b.trim().slice(0, 500))
            .filter(Boolean)
            .slice(0, 20)
            .map((text) => ({ text, verified: false })),
        },
        { sort: Math.round((e.rank ?? 1000) * 10), sourceKey },
      );
      result.imported += 1;
    } catch (error) {
      result.failed.push({ id: e.id, reason: error instanceof Error ? error.message : 'Could not import' });
    }
  }
  return result;
}
