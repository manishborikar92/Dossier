// Zod schemas for every data collection. Used by the API (on save) and the seed script.
import { z } from 'zod';

export const STATUS = ['confident', 'prep', 'exclude'];
export const OWNERSHIP = ['company', 'freelance', 'college', 'personal'];

const status = z.enum(STATUS);
const str = z.string().default('');
const strList = z.array(z.string()).default([]);

export const bulletSchema = z.object({
  id: z.string().min(1),
  text: str,
  tags: strList,
  status: status.default('prep'),
  source: z.string().default('manual'),
});

const contactItem = z.object({
  id: z.string().min(1), type: str, label: str, value: str, short: str, on: z.boolean().default(true),
});

const selectionSchema = z.object({
  summaryId: z.string().nullable().default(null),
  contactIds: strList,
  skills: z.array(z.object({ groupId: z.string(), items: strList })).default([]),
  experience: z.array(z.object({ id: z.string(), bullets: strList })).default([]),
  projects: z.array(z.object({ id: z.string(), bullets: strList })).default([]),
  education: strList,
  certifications: strList,
  involvement: strList,
});

export const SCHEMAS = {
  profile: z.object({ name: str, contact: z.array(contactItem).default([]) }),
  summaries: z.array(z.object({ id: z.string().min(1), label: str, text: str, status: status.default('prep') })),
  experience: z.array(z.object({
    id: z.string().min(1), company: str, title: str, location: str, dates: str,
    visible: z.boolean().default(true), bullets: z.array(bulletSchema).default([]),
  })),
  skills: z.array(z.object({
    id: z.string().min(1), label: str,
    items: z.array(z.object({ id: z.string().min(1), name: str, status: status.default('prep'), tags: strList })).default([]),
  })),
  projects: z.array(z.object({
    id: z.string().min(1), title: str, ownership: z.enum(OWNERSHIP).default('personal'),
    link: str, year: str, techStack: strList, tags: strList, visible: z.boolean().default(true),
    notes: str, kb: z.record(z.any()).nullable().default(null), bullets: z.array(bulletSchema).default([]),
  })),
  education: z.array(z.object({ id: z.string().min(1), degree: str, institution: str, dates: str, detail: str })),
  certifications: z.array(z.object({ id: z.string().min(1), text: str, status: status.default('confident') })),
  involvement: z.array(z.object({ id: z.string().min(1), role: str, org: str, dates: str, text: str })),
  targets: z.array(z.object({
    id: z.string().min(1), name: str, kind: z.enum(['job', 'focus']).default('job'), company: str,
    jd: str, keywords: strList, focusProjectIds: strList, notes: str,
  })),
  resumes: z.array(z.object({
    id: z.string().min(1), name: str, targetId: z.string().nullable().default(null),
    template: z.string().default('classic'), options: z.record(z.any()).default({}),
    sectionOrder: strList, sections: z.record(z.boolean()).default({}), titles: z.record(z.string()).default({}),
    selection: selectionSchema.default({}), overrides: z.record(z.string()).default({}),
    createdAt: str, updatedAt: str,
  })),
};

export const COLLECTIONS = Object.keys(SCHEMAS);
export const EMPTY = { profile: { name: '', contact: [] } };
export const emptyFor = (name) => (name === 'profile' ? structuredClone(EMPTY.profile) : []);
