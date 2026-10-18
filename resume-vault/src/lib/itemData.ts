import { displayUrl } from './format';
import type {
  CertificationData,
  Certification,
  Education,
  EducationData,
  Experience,
  ExperienceData,
  HeaderData,
  ItemBullet,
  ItemLink,
  ItemSection,
  ProfileData,
  Project,
  ProjectData,
  Skill,
  SkillData,
  SourceType,
  SummaryData,
} from './types';

/* Builders that copy a library record into the data stored on a resume item. */

export function headerFromProfile(p: ProfileData): HeaderData {
  return {
    fullName: p.fullName,
    headline: p.headline,
    email: p.email,
    phone: p.phone,
    location: p.location,
    links: p.links.map((l) => ({ label: l.label, url: l.url, show: true })),
    show: { headline: p.headline !== '', email: true, phone: true, location: true },
  };
}

export function summaryFromVariant(s: { text: string }): SummaryData {
  return { text: s.text };
}

const toItemBullets = (bullets: { text: string; verified: boolean }[]): ItemBullet[] =>
  bullets.map((b) => ({ text: b.text, included: true, verified: b.verified }));

export function sectionForExperience(kind: string): 'experience' | 'leadership' {
  return kind === 'leadership' || kind === 'volunteer' ? 'leadership' : 'experience';
}

export function experienceData(e: Experience): ExperienceData {
  return {
    org: e.org,
    title: e.title,
    location: e.location,
    start: e.start,
    end: e.end,
    kind: e.kind,
    description: e.description,
    bullets: toItemBullets(e.bullets),
  };
}

export function projectData(p: Project): ProjectData {
  // Show one link by default (the live site, otherwise the repository); the rest stay available to toggle on.
  const candidates: { url: string }[] = [{ url: p.demoUrl }, { url: p.repoUrl }, { url: p.docsUrl }];
  const firstWithUrl = candidates.findIndex((c) => c.url !== '');
  const links: ItemLink[] = candidates
    .map((c, i) => ({ label: c.url ? displayUrl(c.url) : '', url: c.url, show: i === firstWithUrl }))
    .filter((l) => l.url !== '');
  return {
    name: p.name,
    techLine: p.technologies.join(', '),
    yearLabel: p.yearLabel,
    overview: p.overview,
    links,
    bullets: toItemBullets(p.bullets),
  };
}

export function educationData(e: Education): EducationData {
  return {
    institution: e.institution,
    degree: e.degree,
    field: e.field,
    location: e.location,
    start: e.start,
    end: e.end,
    grade: e.grade,
    details: e.details,
  };
}

export function certificationData(c: Certification): CertificationData {
  return { name: c.name, issuer: c.issuer, year: c.year, url: c.url };
}

export function skillData(s: Skill): SkillData {
  return { name: s.name, category: s.category };
}

/** Which resume section a library source belongs to. */
export function sectionForSource(sourceType: SourceType, experienceKind?: string): ItemSection {
  switch (sourceType) {
    case 'profile':
      return 'header';
    case 'summary':
      return 'summary';
    case 'experience':
      return sectionForExperience(experienceKind ?? 'job');
    case 'project':
      return 'projects';
    case 'education':
      return 'education';
    case 'certification':
      return 'certifications';
    case 'skill':
      return 'skills';
  }
}

/** Human-readable lines describing an item's content, used for side-by-side comparisons. */
export function describeItem(section: ItemSection, data: unknown): string[] {
  const d = data as Record<string, unknown>;
  const lines: string[] = [];
  const push = (label: string, v: unknown) => {
    if (typeof v === 'string' && v.trim() !== '') lines.push(`${label}: ${v}`);
  };
  switch (section) {
    case 'header': {
      push('Name', d.fullName);
      push('Headline', d.headline);
      push('Email', d.email);
      push('Phone', d.phone);
      push('Location', d.location);
      for (const l of (d.links as ItemLink[]) ?? []) lines.push(`Link: ${l.label} ${l.url}`.trim());
      break;
    }
    case 'summary':
      push('Summary', d.text);
      break;
    case 'skills':
      push('Skill', `${d.name} (${d.category})`);
      break;
    case 'experience':
    case 'leadership':
      push('Title', d.title);
      push('Organization', d.org);
      push('Location', d.location);
      push('Start', d.start);
      push('End', (d.end as string) || 'Present');
      push('Description', d.description);
      for (const b of (d.bullets as ItemBullet[]) ?? []) lines.push(`Bullet: ${b.text}`);
      break;
    case 'projects':
      push('Name', d.name);
      push('Tech', d.techLine);
      push('Year', d.yearLabel);
      for (const l of (d.links as ItemLink[]) ?? []) lines.push(`Link: ${l.url}`);
      for (const b of (d.bullets as ItemBullet[]) ?? []) lines.push(`Bullet: ${b.text}`);
      break;
    case 'education':
      push('Degree', d.degree);
      push('Field', d.field);
      push('Institution', d.institution);
      push('Start', d.start);
      push('End', d.end);
      push('Grade', d.grade);
      push('Details', d.details);
      break;
    case 'certifications':
      push('Name', d.name);
      push('Issuer', d.issuer);
      push('Year', d.year);
      push('Link', d.url);
      break;
  }
  return lines;
}
