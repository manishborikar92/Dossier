import { openDb, type DB } from '@/server/db';
import { createEntity, getProfile, listEntities, saveProfile } from '@/server/library';
import { getResume } from '@/server/resumes';
import type { ResumeItem } from '@/lib/types';

export function seedTestFixtures(db: DB): void {
  if (getProfile(db).fullName !== '' || listEntities(db, 'projects').length > 0) {
    throw new Error('The library already has data; test fixtures were not added.');
  }

  saveProfile(db, {
    fullName: 'Alex Sample',
    headline: 'Full-stack developer (sample data)',
    email: 'alex.sample@example.com',
    phone: '+00 000 000 0000',
    location: 'Sample City, Sampleland',
    links: [
      { label: 'github.com/alex-sample', url: 'https://github.com/alex-sample' },
      { label: 'linkedin.com/in/alex-sample', url: 'https://linkedin.com/in/alex-sample' },
    ],
    summaries: [
      {
        label: 'General',
        text: 'Sample summary: a developer who builds and maintains web applications from the interface to the database.',
      },
      { label: 'Backend focus', text: 'Sample summary: a developer focused on APIs, data modelling and reliable back-end services.' },
    ],
  });

  createEntity(db, 'experiences', {
    org: 'Example Software Ltd',
    title: 'Software Developer',
    location: 'Sample City',
    start: '2024-01',
    end: '',
    kind: 'job',
    description: '',
    archived: false,
    bullets: [
      { text: 'Built and maintained a sample REST API used by the sample web client.', verified: true },
      { text: 'Wrote automated tests for the sample billing module.', verified: true },
    ],
  });
  createEntity(db, 'experiences', {
    org: 'Example Studio',
    title: 'Web Development Intern',
    location: '',
    start: '2023-05',
    end: '2023-07',
    kind: 'internship',
    description: '',
    archived: false,
    bullets: [{ text: 'Built responsive sample pages with HTML, CSS and JavaScript.', verified: true }],
  });
  createEntity(db, 'experiences', {
    org: 'Sample University Coding Club',
    title: 'Technical Lead',
    location: '',
    start: '2022-08',
    end: '2023-04',
    kind: 'leadership',
    description: 'Organised sample workshops and coordinated a small team of volunteers.',
    archived: false,
    bullets: [],
  });

  createEntity(db, 'education', {
    institution: 'Sample University',
    degree: 'B.Sc.',
    field: 'Computer Science',
    location: '',
    start: '2020-08',
    end: '2024-05',
    grade: 'GPA: 3.5/4.0',
    details: '',
  });
  createEntity(db, 'certifications', { name: 'Sample Web Development Certificate', issuer: 'Example Academy', year: '2023', url: '' });

  const skills: [string, string][] = [
    ['Python', 'Languages'],
    ['JavaScript', 'Languages'],
    ['SQL', 'Languages'],
    ['React', 'Frontend'],
    ['Next.js', 'Frontend'],
    ['Node.js', 'Backend'],
    ['Express', 'Backend'],
    ['PostgreSQL', 'Databases'],
    ['MongoDB', 'Databases'],
    ['Git', 'Tools'],
    ['Docker', 'Tools'],
  ];
  for (const [name, category] of skills) createEntity(db, 'skills', { name, category });

  const base = {
    category: '',
    description: '',
    problem: '',
    solution: '',
    role: '',
    contributions: '',
    features: '',
    decisions: '',
    results: '',
    repoUrl: '',
    demoUrl: '',
    docsUrl: '',
    tags: [],
    keywords: [],
    family: '',
    status: 'active',
    notes: '',
  };
  createEntity(db, 'projects', {
    ...base,
    name: 'Sample Task Tracker',
    overview: 'A sample task management web application.',
    technologies: ['React', 'Node.js', 'Express', 'PostgreSQL'],
    yearLabel: '2024',
    demoUrl: 'https://example.com/task-tracker',
    bullets: [
      { text: 'Built a sample task board with drag-and-drop ordering and role-based access.', verified: true },
      { text: 'Designed a sample PostgreSQL schema for users, boards and tasks.', verified: true },
    ],
  });
  createEntity(db, 'projects', {
    ...base,
    name: 'Sample Image Classifier',
    overview: 'A sample machine learning project that classifies images.',
    technologies: ['Python', 'TensorFlow', 'NumPy'],
    yearLabel: '2023',
    bullets: [{ text: 'Trained a sample convolutional model and served predictions through a small API.', verified: true }],
  });
  createEntity(db, 'projects', {
    ...base,
    name: 'Sample Analytics Dashboard',
    overview: 'A sample dashboard built with Next.js and TypeScript.',
    technologies: ['Next.js', 'TypeScript', 'MongoDB'],
    yearLabel: '2024',
    repoUrl: 'https://github.com/alex-sample/analytics-dashboard',
    bullets: [{ text: 'Built sample charts and filters that query a MongoDB collection.', verified: true }],
  });
  createEntity(db, 'projects', {
    ...base,
    name: 'Sample Command-Line Tool',
    overview: 'A sample command-line utility written in Go.',
    technologies: ['Go', 'Docker'],
    yearLabel: '2022',
    status: 'archived',
    bullets: [],
  });
}

export function freshDb(withFixtures = true): DB {
  const db = openDb(':memory:');
  if (withFixtures) seedTestFixtures(db);
  return db;
}

export function itemsOf(db: DB, resumeId: number, section?: string): ResumeItem[] {
  const items = getResume(db, resumeId).items;
  return section ? items.filter((i) => i.section === section) : items;
}

/** Extract page count, text and link targets from a PDF using pdf.js (no external tools needed). */
export async function inspectPdf(
  buffer: Uint8Array,
): Promise<{ pages: number; text: string; links: string[]; lastLines: string[]; firstLines: string[]; pageTexts: string[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, verbosity: 0 });
  const pdf = await task.promise;
  let text = '';
  const links: string[] = [];
  const lastLines: string[] = [];
  const firstLines: string[] = [];
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => ('str' in it ? it.str : '')).join(' ');
    pageTexts.push(pageText);
    text += pageText + '\n';
    for (const a of await page.getAnnotations()) if (a.url) links.push(a.url as string);
    // The text on the lowest line of the page (used to check that headings are never stranded at a page bottom).
    const placed = content.items
      .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && it.str.trim() !== '')
      .map((it) => ({ str: it.str, y: it.transform[5], x: it.transform[4] }));
    const highest = Math.max(...placed.map((p) => p.y));
    firstLines.push(
      placed
        .filter((p) => Math.abs(p.y - highest) < 3)
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' '),
    );
    const lowest = Math.min(...placed.map((p) => p.y));
    lastLines.push(
      placed
        .filter((p) => Math.abs(p.y - lowest) < 3)
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' '),
    );
  }
  const pages = pdf.numPages;
  await pdf.destroy();
  return { pages, text, links, lastLines, firstLines, pageTexts };
}
