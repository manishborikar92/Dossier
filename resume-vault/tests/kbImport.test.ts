import { describe, expect, it } from 'vitest';
import { importKnowledgeBase } from '@/server/kbImport';
import { listEntities } from '@/server/library';
import type { Project } from '@/lib/types';
import { freshDb } from './helpers';

// A small, fictional file in the same shape as project_knowledge_base.json.
const entry = (id: string, rank: number, score: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  title: `Fictional ${id}`,
  rank,
  score,
  purpose: 'A fictional project for tests.',
  architecture: 'Fictional architecture description.',
  technical_analysis: 'Fictional analysis.',
  key_implementation_details: 'Fictional details.',
  primary_technologies: ['Python', 'Docker'],
  live_url: null,
  live_deployed_evidence: null,
  important_file_references: ['src/main.py'],
  year: '2025',
  first_commit: '2025-01-01',
  last_commit: '2025-06-01',
  commit_count: 12,
  local_path: 'C:\\Fictional\\path',
  resume_entry: { resume_title: `Fictional ${id}`, tech_stack_summary: 'Python', year: '2025', bullets: ['First fictional bullet.', 'Second fictional bullet.'] },
  ...extra,
});

describe('knowledge base import', () => {
  it('imports projects as unverified, keeps order by rank, and invents nothing', () => {
    const db = freshDb(false);
    const result = importKnowledgeBase(db, [entry('b', 2, 80), entry('a', 1, 90, { live_url: 'https://example.com/' })]);
    expect(result).toMatchObject({ imported: 2, skipped: [], failed: [] });
    const [first, second] = listEntities<Project>(db, 'projects');
    expect(first.name).toBe('Fictional a'); // rank 1 first
    expect(first.demoUrl).toBe('https://example.com/');
    expect(second.demoUrl).toBe('');
    expect(first.bullets.every((b) => b.verified === false)).toBe(true);
    expect(first.role).toBe('');
    expect(first.contributions).toBe('');
    expect(first.results).toBe('');
    expect(first.repoUrl).toBe('');
    expect(first.sourceKey).toBe('kb:a');
    expect(first.notes).toContain('score 90/100');
  });

  it('skips projects that are already in the library, so re-importing is safe', () => {
    const db = freshDb(false);
    importKnowledgeBase(db, [entry('a', 1, 90)]);
    const again = importKnowledgeBase(db, [entry('a', 1, 90), entry('c', 3, 70)]);
    expect(again.imported).toBe(1);
    expect(again.skipped).toEqual(['a']);
    expect(listEntities(db, 'projects')).toHaveLength(2);
  });

  it('honours a minimum score and reports records it cannot read', () => {
    const db = freshDb(false);
    const result = importKnowledgeBase(db, [entry('hi', 1, 90), entry('lo', 2, 20), { id: 'broken' }], { minScore: 50 });
    expect(result.imported).toBe(1);
    expect(result.belowMinScore).toBe(1);
    expect(result.failed.map((f) => f.id)).toEqual(['broken']);
  });

  it('rejects a file that is not a list', () => {
    expect(() => importKnowledgeBase(freshDb(false), { nope: true })).toThrow(/list of projects/);
  });
});
