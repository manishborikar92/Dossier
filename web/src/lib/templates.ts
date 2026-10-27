import type { ResumeSettings, SectionKey, TemplateId } from './types';

export interface TemplateTokens {
  id: TemplateId;
  label: string;
  description: string;
  font: 'Helvetica' | 'Times-Roman';
  docxFont: string;
  base: number; // body size in pt
  nameSize: number;
  headingSize: number;
  margin: number; // pt
  headerAlign: 'center' | 'left';
  headingRule: boolean;
  headingUpper: boolean;
  sectionGap: number; // pt before a section
  entryGap: number; // pt before an entry
  bulletGap: number; // pt between bullets
  nameUpper: boolean; // print the name in capitals
  headerRule: boolean; // a full-width rule under the contact line
  contactSize: number; // pt
  contactLinks: 'blue' | 'muted'; // hyperlink look in the contact line
  titleLinks: 'title' | 'muted'; // links beside a project title: same bold style as the title, or small and grey
  headingTracking: number; // extra letter spacing in section headings (pt)
}

export const LINK_BLUE = '#0563C1';

export const TEMPLATES: Record<TemplateId, TemplateTokens> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Centred header, ruled section headings. Matches the layout of your current resume.',
    font: 'Helvetica',
    docxFont: 'Arial',
    base: 10,
    nameSize: 18,
    headingSize: 11,
    margin: 54,
    headerAlign: 'center',
    headingRule: true,
    headingUpper: true,
    sectionGap: 11,
    entryGap: 7,
    bulletGap: 2.5,
    nameUpper: true,
    headerRule: true,
    contactSize: 8.5,
    contactLinks: 'blue',
    titleLinks: 'title',
    headingTracking: 0,
  },
  compact: {
    id: 'compact',
    label: 'Compact',
    description: 'Tighter spacing and a left-aligned header. Fits more on one page.',
    font: 'Helvetica',
    docxFont: 'Arial',
    base: 9.5,
    nameSize: 16,
    headingSize: 10,
    margin: 40,
    headerAlign: 'left',
    headingRule: true,
    headingUpper: true,
    sectionGap: 8,
    entryGap: 5,
    bulletGap: 1.5,
    nameUpper: false,
    headerRule: false,
    contactSize: 8.5,
    contactLinks: 'muted',
    titleLinks: 'muted',
    headingTracking: 0.4,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Serif type, no rules. Quiet and easy to read.',
    font: 'Times-Roman',
    docxFont: 'Times New Roman',
    base: 10.5,
    nameSize: 20,
    headingSize: 11.5,
    margin: 58,
    headerAlign: 'left',
    headingRule: false,
    headingUpper: false,
    sectionGap: 12,
    entryGap: 7,
    bulletGap: 2.5,
    nameUpper: false,
    headerRule: false,
    contactSize: 9.5,
    contactLinks: 'muted',
    titleLinks: 'muted',
    headingTracking: 0,
  },
};

export const DENSITY_SCALE = { compact: 0.8, normal: 1, relaxed: 1.25 } as const;

export const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Navy', value: '#1F3864' },
  { label: 'Charcoal', value: '#333333' },
  { label: 'Teal', value: '#0F6B6B' },
  { label: 'Maroon', value: '#7A1F2B' },
  { label: 'Black', value: '#000000' },
];

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'leadership',
];

export const DEFAULT_SECTION_TITLES: Record<SectionKey, string> = {
  summary: 'Professional summary',
  skills: 'Technical skills',
  experience: 'Professional experience',
  projects: 'Key projects',
  education: 'Education',
  certifications: 'Certifications',
  leadership: 'Leadership & involvement',
};

export function defaultSettings(overrides: Partial<ResumeSettings> = {}): ResumeSettings {
  return {
    pageSize: 'A4',
    accent: '#1F3864',
    density: 'normal',
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    pageBreakBefore: [],
    sectionTitles: {},
    ...overrides,
  };
}

/** Fill in anything missing so older or partial settings never break rendering. */
export function normalizeSettings(raw: Partial<ResumeSettings> | undefined): ResumeSettings {
  const base = defaultSettings();
  const s = { ...base, ...(raw ?? {}) } as ResumeSettings;
  const order = s.sectionOrder.filter((k, i, a) => DEFAULT_SECTION_ORDER.includes(k) && a.indexOf(k) === i);
  for (const key of DEFAULT_SECTION_ORDER) if (!order.includes(key)) order.push(key);
  s.sectionOrder = order;
  s.hiddenSections = (s.hiddenSections ?? []).filter((k) => DEFAULT_SECTION_ORDER.includes(k));
  s.pageBreakBefore = (s.pageBreakBefore ?? []).filter((k) => DEFAULT_SECTION_ORDER.includes(k));
  s.sectionTitles = s.sectionTitles ?? {};
  return s;
}

export const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89, docx: { width: 11906, height: 16838 } },
  LETTER: { width: 612, height: 792, docx: { width: 12240, height: 15840 } },
} as const;
