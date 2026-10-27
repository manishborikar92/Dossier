import { describe, expect, it } from 'vitest';
import { matchJobDescription, normalize, type MatchLibrary } from '@/lib/matcher';

const lib: MatchLibrary = {
  skills: [
    { id: 1, name: 'Next.js 16 (App Router)', category: 'Frontend' },
    { id: 2, name: 'Node.js 18+', category: 'Backend' },
    { id: 3, name: 'PostgreSQL', category: 'Databases' },
    { id: 4, name: 'Open3D', category: 'Desktop & 3D' },
  ],
  projects: [
    {
      id: 10,
      name: 'Booking app',
      technologies: ['Next.js', 'PostgreSQL', 'Prisma'],
      tags: [],
      keywords: [],
      overview: 'Court booking platform.',
      description: '',
      role: '',
      contributions: '',
      features: '',
      results: '',
      bullets: [{ text: 'Implemented JWT authentication with role-based access control.' }],
    },
    {
      id: 11,
      name: 'Point cloud tool',
      technologies: ['Python', 'Open3D', 'NumPy'],
      tags: [],
      keywords: [],
      overview: 'LiDAR processing.',
      description: '',
      role: '',
      contributions: '',
      features: '',
      results: '',
      bullets: [],
    },
  ],
  experiences: [{ id: 20, title: 'Developer', org: 'Acme', description: '', bullets: [{ text: 'Built REST APIs with Express.' }] }],
};

describe('normalize', () => {
  it('rewrites aliases to one canonical form', () => {
    expect(normalize('We use Next.js, NodeJS and k8s')).toContain('nextjs');
    expect(normalize('Node.js and node js')).toBe('nodejs and nodejs');
    expect(normalize('PostgreSQL / postgres')).toBe('postgresql / postgresql');
  });
});

describe('matchJobDescription', () => {
  it('returns an empty result when there is no job description', () => {
    expect(matchJobDescription('   ', lib).hasJobDescription).toBe(false);
  });

  it('finds matches with evidence and ranks projects by relevance', () => {
    const jd = 'Senior engineer. Must know Next.js, Next.js SSR, PostgreSQL and Node.js. Docker is a plus.';
    const r = matchJobDescription(jd, lib);
    const labels = r.matched.map((m) => m.label);
    expect(labels).toEqual(expect.arrayContaining(['Next.js', 'PostgreSQL', 'Node.js']));
    expect(r.projects[0].name).toBe('Booking app');
    expect(r.projects[0].percent).toBe(100);
    expect(r.projects.some((p) => p.name === 'Point cloud tool')).toBe(false);
    const nextEvidence = r.matched.find((m) => m.label === 'Next.js')!.evidence;
    expect(nextEvidence.map((e) => e.type)).toEqual(expect.arrayContaining(['skill', 'project']));
  });

  it('lists requirements with no evidence as gaps and never suggests them', () => {
    const r = matchJobDescription('We use Kubernetes, Docker and Terraform with PostgreSQL.', lib);
    expect(r.gaps.map((g) => g.label)).toEqual(expect.arrayContaining(['Kubernetes', 'Docker', 'Terraform']));
    expect(r.matched.map((m) => m.label)).toEqual(['PostgreSQL']);
    for (const g of r.gaps) expect(g.evidence).toHaveLength(0);
    expect(r.skills.map((s) => s.name)).toEqual(['PostgreSQL']);
  });

  it('recognises terms from the library that are not in the built-in vocabulary', () => {
    const r = matchJobDescription('Experience with Open3D point cloud processing is required.', lib);
    expect(r.matched.map((m) => m.label)).toContain('Open3D');
    expect(r.projects[0].name).toBe('Point cloud tool');
  });

  it('finds evidence in experience and project bullet text, not only in skill lists', () => {
    const r = matchJobDescription('JWT, RBAC and Express experience needed.', lib);
    expect(r.matched.find((m) => m.label === 'JWT')!.evidence[0].type).toBe('project');
    expect(r.matched.find((m) => m.label === 'RBAC')!.evidence.length).toBeGreaterThan(0);
    expect(r.experiences[0].title).toBe('Developer');
  });

  it('does not match a term inside a longer word', () => {
    const r = matchJobDescription('You will manage javascripty things and gopher tools.', lib);
    expect(r.matched.concat(r.gaps)).toHaveLength(0);
  });
});
