import { z } from 'zod';

/* ---------- small building blocks ---------- */

export const SECTION_KEYS = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'leadership',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const EXPERIENCE_KINDS = ['job', 'internship', 'freelance', 'leadership', 'volunteer'] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number];

export const TEMPLATE_IDS = ['classic', 'compact', 'minimal'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isHttpUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const required = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Keep this under ${max} characters`);
const monthOrEmpty = z
  .string()
  .refine((v) => v === '' || MONTH_RE.test(v), 'Use a month like 2025-06, or leave it empty');
const urlOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === '' || isHttpUrl(v), 'Enter a full link starting with https://');
const emailOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address');
const tagList = z.array(z.string().trim().min(1).max(60)).max(60);

/* ---------- library entities ---------- */

export const bulletSchema = z.object({
  id: z.number().int().positive().optional(),
  text: required(500, 'Bullet text'),
  verified: z.boolean(),
});

export const experienceSchema = z
  .object({
    org: required(120, 'Organization'),
    title: required(120, 'Title'),
    location: text(120),
    start: z.string().regex(MONTH_RE, 'Use a month like 2025-06'),
    end: monthOrEmpty,
    kind: z.enum(EXPERIENCE_KINDS),
    description: text(800),
    archived: z.boolean(),
    bullets: z.array(bulletSchema).max(20),
  })
  .refine((v) => v.end === '' || v.end >= v.start, {
    path: ['end'],
    message: 'The end date must not be before the start date',
  });

export const educationSchema = z
  .object({
    institution: required(160, 'Institution'),
    degree: required(120, 'Degree'),
    field: text(120),
    location: text(120),
    start: monthOrEmpty,
    end: monthOrEmpty,
    grade: text(60),
    details: text(500),
  })
  .refine((v) => v.start === '' || v.end === '' || v.end >= v.start, {
    path: ['end'],
    message: 'The end date must not be before the start date',
  });

export const certificationSchema = z.object({
  name: required(160, 'Name'),
  issuer: text(120),
  year: text(20),
  url: urlOrEmpty,
});

export const skillSchema = z.object({
  name: required(80, 'Skill'),
  category: required(60, 'Category'),
});

export const PROJECT_STATUSES = ['active', 'archived'] as const;

export const projectSchema = z.object({
  name: required(160, 'Project name'),
  category: text(60),
  overview: text(500),
  description: text(4000),
  problem: text(2000),
  solution: text(2000),
  role: text(2000),
  contributions: text(2000),
  technologies: tagList,
  features: text(2000),
  decisions: text(2000),
  results: text(2000),
  repoUrl: urlOrEmpty,
  demoUrl: urlOrEmpty,
  docsUrl: urlOrEmpty,
  tags: tagList,
  keywords: tagList,
  yearLabel: text(30),
  family: text(80),
  status: z.enum(PROJECT_STATUSES),
  notes: text(4000),
  bullets: z.array(bulletSchema).max(20),
});

export const summaryVariantSchema = z.object({
  id: z.number().int().positive().optional(),
  label: required(60, 'Label'),
  text: required(1200, 'Summary text'),
});

export const profileLinkSchema = z.object({
  id: z.number().int().positive().optional(),
  label: required(60, 'Label'),
  url: urlOrEmpty,
});

export const profileSchema = z.object({
  fullName: required(120, 'Full name'),
  headline: text(120),
  email: emailOrEmpty,
  phone: text(40),
  location: text(120),
  links: z.array(profileLinkSchema).max(12),
  summaries: z.array(summaryVariantSchema).max(12),
});

/* ---------- resumes ---------- */

export const resumeSettingsSchema = z.object({
  pageSize: z.enum(['A4', 'LETTER']),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #1F3864'),
  density: z.enum(['compact', 'normal', 'relaxed']),
  sectionOrder: z.array(z.enum(SECTION_KEYS)),
  hiddenSections: z.array(z.enum(SECTION_KEYS)),
  sectionTitles: z.record(z.string(), z.string().trim().max(60)),
});

export const resumeCreateSchema = z.object({
  name: required(120, 'Resume name'),
  targetTitle: text(120),
  targetCompany: text(120),
  template: z.enum(TEMPLATE_IDS),
  jdText: text(20000),
  preselect: z.enum(['none', 'top', 'match']),
});

export const resumePatchSchema = z
  .object({
    name: required(120, 'Resume name'),
    targetTitle: text(120),
    targetCompany: text(120),
    template: z.enum(TEMPLATE_IDS),
    status: z.enum(['draft', 'final']),
    jdText: text(20000),
    settings: resumeSettingsSchema.partial(),
  })
  .partial();

/* ---------- resume item data (per-resume copies) ---------- */

export const itemBulletSchema = z.object({
  text: required(500, 'Bullet text'),
  included: z.boolean(),
  verified: z.boolean(),
});
const itemLinkSchema = z.object({ label: text(60), url: urlOrEmpty, show: z.boolean() });

export const itemDataSchemas = {
  header: z.object({
    fullName: required(120, 'Full name'),
    headline: text(120),
    email: emailOrEmpty,
    phone: text(40),
    location: text(120),
    links: z.array(itemLinkSchema).max(12),
    show: z.object({ headline: z.boolean(), email: z.boolean(), phone: z.boolean(), location: z.boolean() }),
  }),
  summary: z.object({ text: required(1200, 'Summary text') }),
  skills: z.object({ name: required(80, 'Skill'), category: required(60, 'Category') }),
  experience: z.object({
    org: required(120, 'Organization'),
    title: required(120, 'Title'),
    location: text(120),
    start: z.string().regex(MONTH_RE, 'Use a month like 2025-06'),
    end: monthOrEmpty,
    kind: z.enum(EXPERIENCE_KINDS),
    description: text(800),
    bullets: z.array(itemBulletSchema).max(20),
  }),
  projects: z.object({
    name: required(160, 'Project name'),
    techLine: text(400),
    yearLabel: text(30),
    overview: text(500),
    links: z.array(itemLinkSchema).max(6),
    bullets: z.array(itemBulletSchema).max(20),
  }),
  education: z.object({
    institution: required(160, 'Institution'),
    degree: required(120, 'Degree'),
    field: text(120),
    location: text(120),
    start: monthOrEmpty,
    end: monthOrEmpty,
    grade: text(60),
    details: text(500),
  }),
  certifications: z.object({
    name: required(160, 'Name'),
    issuer: text(120),
    year: text(20),
    url: urlOrEmpty,
  }),
} as const;
// leadership entries have the same shape as experience entries
export const leadershipDataSchema = itemDataSchemas.experience;

export const appSettingsSchema = z.object({
  defaultPageSize: z.enum(['A4', 'LETTER']),
  defaultTemplate: z.enum(TEMPLATE_IDS),
});

/* ---------- helpers ---------- */

export interface FieldIssues {
  [field: string]: string;
}

/** Turn zod issues into `{ field: message }` (first message per top-level field). */
export function issuesToFields(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): FieldIssues {
  const out: FieldIssues = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
