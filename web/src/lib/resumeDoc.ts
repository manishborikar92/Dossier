import { formatRange } from './format';
import { DEFAULT_SECTION_TITLES, normalizeSettings } from './templates';
import type {
  CertificationData,
  EducationData,
  ExperienceData,
  HeaderData,
  ProjectData,
  ResumeSettings,
  SectionKey,
  SkillData,
  Snapshot,
  SummaryData,
  TemplateId,
} from './types';

/** A resume turned into plain, layout-ready content. PDF and DOCX both render from this. */
export interface ContactPart {
  text: string;
  url?: string;
}
export interface EntryLink {
  text: string;
  url: string;
}
export interface EntryBlock {
  /** 'role' (jobs, projects): italic grey date. 'plain' (education, leadership): regular black date, slightly smaller title. */
  variant?: 'role' | 'plain';
  title: string;
  org?: string;
  right?: string;
  sub?: string;
  meta?: string;
  links: EntryLink[];
  description?: string;
  bullets: string[];
}
export interface LineItem {
  text: string;
  url?: string;
}
export interface SectionDoc {
  key: SectionKey;
  title: string;
  /** Start this section on a new page (never set for the first section). */
  pageBreakBefore?: boolean;
  text?: string;
  skillGroups?: { category: string; items: string[] }[];
  entries?: EntryBlock[];
  lines?: LineItem[];
}
export interface ResumeDoc {
  title: string;
  name: string;
  headline: string;
  contact: ContactPart[];
  sections: SectionDoc[];
  template: TemplateId;
  settings: ResumeSettings;
  /** Included bullets that have not been marked as verified. */
  unverifiedBullets: string[];
}

type SnapItem = Snapshot['items'][number];

function byPosition(items: SnapItem[]): SnapItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

function bulletsOf(list: { text: string; included: boolean; verified: boolean }[], unverified: string[]): string[] {
  const out: string[] = [];
  for (const b of list) {
    if (!b.included) continue;
    out.push(b.text);
    if (!b.verified) unverified.push(b.text);
  }
  return out;
}

/** Entries this short are never split across two pages. */
export function isUnbreakable(e: EntryBlock): boolean {
  return e.bullets.length <= 8 && e.bullets.join('').length + (e.description?.length ?? 0) <= 1600;
}

export function buildResumeDoc(snapshot: Snapshot): ResumeDoc {
  const settings = normalizeSettings(snapshot.resume.settings);
  const unverified: string[] = [];
  const included = snapshot.items.filter((i) => i.included);
  const ofSection = (s: string) => byPosition(included.filter((i) => i.section === s));

  const headerItem = snapshot.items.find((i) => i.section === 'header');
  const header = (headerItem?.data ?? {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    show: { headline: false, email: true, phone: true, location: true },
  }) as HeaderData;

  const contact: ContactPart[] = [];
  if (header.show.location && header.location) contact.push({ text: header.location });
  if (header.show.email && header.email) contact.push({ text: header.email, url: `mailto:${header.email}` });
  if (header.show.phone && header.phone) contact.push({ text: header.phone });
  for (const l of header.links) {
    if (l.show && l.label) contact.push({ text: l.label, url: l.url || undefined });
  }

  const sections: SectionDoc[] = [];
  for (const key of settings.sectionOrder) {
    if (settings.hiddenSections.includes(key)) continue;
    const items = ofSection(key);
    if (items.length === 0) continue;
    const title = settings.sectionTitles[key]?.trim() || DEFAULT_SECTION_TITLES[key];
    const section: SectionDoc = { key, title };

    if (key === 'summary') {
      section.text = (items[0].data as SummaryData).text;
    } else if (key === 'skills') {
      const groups = new Map<string, string[]>();
      for (const it of items) {
        const d = it.data as SkillData;
        groups.set(d.category, [...(groups.get(d.category) ?? []), d.name]);
      }
      section.skillGroups = [...groups].map(([category, list]) => ({ category, items: list }));
    } else if (key === 'experience') {
      section.entries = items.map((it) => {
        const d = it.data as ExperienceData;
        return {
          title: d.title,
          org: [d.org, d.location].filter(Boolean).join(', '),
          right: formatRange(d.start, d.end),
          description: d.description || undefined,
          links: [],
          bullets: bulletsOf(d.bullets, unverified),
        };
      });
    } else if (key === 'leadership') {
      // Title and dates on the first line; organisation and description together on a grey line below.
      section.entries = items.map((it) => {
        const d = it.data as ExperienceData;
        return {
          variant: 'plain' as const,
          title: d.title,
          right: formatRange(d.start, d.end) || undefined,
          sub: [[d.org, d.location].filter(Boolean).join(', '), d.description].filter(Boolean).join(' \u2014 ') || undefined,
          links: [],
          bullets: bulletsOf(d.bullets, unverified),
        };
      });
    } else if (key === 'projects') {
      section.entries = items.map((it) => {
        const d = it.data as ProjectData;
        const bullets = bulletsOf(d.bullets, unverified);
        return {
          title: d.name,
          right: d.yearLabel || undefined,
          meta: d.techLine ? `Tech Stack: ${d.techLine}` : undefined,
          links: d.links.filter((l) => l.show && l.url).map((l) => ({ text: l.label || l.url, url: l.url })),
          description: bullets.length === 0 && d.overview ? d.overview : undefined,
          bullets,
        };
      });
    } else if (key === 'education') {
      section.entries = items.map((it) => {
        const d = it.data as EducationData;
        return {
          variant: 'plain' as const,
          title: [d.degree, d.field].filter(Boolean).join(' \u2013 '),
          right: formatRange(d.start, d.end, 'long') || undefined,
          sub: [[d.institution, d.location].filter(Boolean).join(', '), d.grade].filter(Boolean).join('  |  '),
          description: d.details || undefined,
          links: [],
          bullets: [],
        };
      });
    } else if (key === 'certifications') {
      section.lines = items.map((it) => {
        const d = it.data as CertificationData;
        const text = [d.name, d.issuer].filter(Boolean).join(' \u2014 ') + (d.year ? ` \u00b7 ${d.year}` : '');
        return { text, url: d.url || undefined };
      });
    }
    section.pageBreakBefore = sections.length > 0 && settings.pageBreakBefore.includes(key);
    sections.push(section);
  }

  const target = [snapshot.resume.targetTitle, snapshot.resume.targetCompany].filter(Boolean).join(' - ');
  return {
    title: [header.fullName, 'Resume', target].filter(Boolean).join(' - '),
    name: header.fullName,
    headline: header.show.headline ? header.headline : '',
    contact,
    sections,
    template: snapshot.resume.template,
    settings,
    unverifiedBullets: unverified,
  };
}

/** All text a resume will print (used to warn about characters the PDF fonts cannot draw). */
export function allDocText(doc: ResumeDoc): string {
  const parts: string[] = [doc.name, doc.headline, ...doc.contact.map((c) => c.text)];
  for (const s of doc.sections) {
    parts.push(s.title, s.text ?? '');
    for (const g of s.skillGroups ?? []) parts.push(g.category, ...g.items);
    for (const l of s.lines ?? []) parts.push(l.text);
    for (const e of s.entries ?? []) {
      parts.push(
        e.title,
        e.org ?? '',
        e.right ?? '',
        e.sub ?? '',
        e.meta ?? '',
        e.description ?? '',
        ...e.bullets,
        ...e.links.map((l) => l.text),
      );
    }
  }
  return parts.join('\n');
}
