// Template presets, paper sizes and the "tokens" every renderer reads from.
export const PAPERS = {
  letter: { label: 'US Letter', w: 8.5, h: 11 },
  a4: { label: 'A4', w: 8.27, h: 11.69 },
};

// All values in points (pt).
export const SPACING = {
  tight:   { sectionBefore: 8,  sectionAfter: 3, entryBefore: 5,  entryAfter: 1.5, bullet: 1.5,  para: 3, skill: 2,   line: 1.12 },
  normal:  { sectionBefore: 11, sectionAfter: 4, entryBefore: 8,  entryAfter: 2,   bullet: 2.75, para: 5, skill: 3,   line: 1.18 },
  relaxed: { sectionBefore: 15, sectionAfter: 5, entryBefore: 11, entryAfter: 3,   bullet: 4,    para: 7, skill: 4.5, line: 1.25 },
};

export const TEMPLATES = {
  classic: {
    label: 'Classic',
    note: 'Centered name, navy accent, ruled section headings.',
    defaults: { fontFamily: 'sans', fontSize: 10, accent: '#1F3864', nameAlign: 'center', sectionStyle: 'rule', spacing: 'normal', margin: 0.75 },
  },
  modern: {
    label: 'Modern',
    note: 'Left-aligned name, teal accent, slightly larger headings.',
    defaults: { fontFamily: 'sans', fontSize: 10, accent: '#0F766E', nameAlign: 'left', sectionStyle: 'rule', spacing: 'normal', margin: 0.7 },
  },
  compact: {
    label: 'Compact',
    note: 'Smaller type and tighter spacing to fit one page.',
    defaults: { fontFamily: 'sans', fontSize: 9.5, accent: '#2B2B2B', nameAlign: 'left', sectionStyle: 'rule', spacing: 'tight', margin: 0.6 },
  },
  serif: {
    label: 'Serif',
    note: 'Traditional serif look, plain headings.',
    defaults: { fontFamily: 'serif', fontSize: 10.5, accent: '#1B1B1B', nameAlign: 'center', sectionStyle: 'rule', spacing: 'normal', margin: 0.8 },
  },
};

export const FONTS = {
  sans:  { label: 'Sans (Arial / Helvetica)', docx: 'Arial', css: "Arial, 'Liberation Sans', Helvetica, sans-serif", pdf: { r: 'Helvetica', b: 'Helvetica-Bold', i: 'Helvetica-Oblique' } },
  serif: { label: 'Serif (Times)',            docx: 'Times New Roman', css: "'Times New Roman', 'Liberation Serif', Times, serif", pdf: { r: 'Times-Roman', b: 'Times-Bold', i: 'Times-Italic' } },
};

export const DEFAULT_ORDER = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'involvement'];
export const SECTION_TITLES = {
  summary: 'Professional Summary',
  skills: 'Technical Skills',
  experience: 'Professional Experience',
  projects: 'Key Projects',
  education: 'Education',
  certifications: 'Certifications',
  involvement: 'Leadership & Involvement',
};

export function defaultOptions(template = 'classic') {
  const t = TEMPLATES[template] || TEMPLATES.classic;
  return {
    paper: 'letter',
    contactSeparator: '·',
    shortLinks: true,
    showProjectLinks: true,
    projectsOnNewPage: false,
    projectTypeLabels: ['college'],
    nameUpper: true,
    targetPages: 2,
    fileName: '',
    ...t.defaults,
  };
}

/** Derive every number a renderer needs from a resume's options. */
export function resolveTokens(resume) {
  const o = { ...defaultOptions(resume?.template), ...(resume?.options || {}) };
  const paper = PAPERS[o.paper] || PAPERS.letter;
  const sp = SPACING[o.spacing] || SPACING.normal;
  const base = Number(o.fontSize) || 10;
  const margin = Number(o.margin) || 0.75;
  const font = FONTS[o.fontFamily] || FONTS.sans;
  return {
    o,
    paper,
    font,
    margin,
    pageWpt: paper.w * 72,
    pageHpt: paper.h * 72,
    contentWpt: (paper.w - 2 * margin) * 72,
    usableHin: paper.h - 2 * margin,
    size: { base, name: Math.round(base * 1.8 * 2) / 2, section: base + 1, entry: base + 0.5, small: Math.max(7, base - 0.5) },
    accent: /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : '#1F3864',
    gray: '#444444',
    space: sp,
  };
}
