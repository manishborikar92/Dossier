import type { DB } from './db';
import { createEntity, getProfile, listEntities, saveProfile } from './library';

/**
 * Clearly fictional sample data, used by `npm run seed:sample` and by the automated tests.
 * It contains no real person's information.
 */
export function seedSample(db: DB): void {
  if (getProfile(db).fullName !== '' || listEntities(db, 'projects').length > 0) {
    throw new Error('The library already has data; sample data was not added.');
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
      { label: 'General', text: 'Sample summary: a developer who builds and maintains web applications from the interface to the database.' },
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
    category: '', description: '', problem: '', solution: '', role: '', contributions: '', features: '', decisions: '', results: '',
    repoUrl: '', demoUrl: '', docsUrl: '', tags: [], keywords: [], family: '', status: 'active', notes: '',
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
