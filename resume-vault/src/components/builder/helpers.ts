import { formatRange } from '@/lib/format';
import type {
  CertificationData,
  EducationData,
  ExperienceData,
  HeaderData,
  ProjectData,
  ResumeItem,
  SkillData,
  SummaryData,
} from '@/lib/types';
import type { Certification, Education, Experience, Project, Skill } from '@/lib/types';

export interface BuilderLibrary {
  summaries: { id: number; label: string; text: string }[];
  experiences: Experience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  skills: Skill[];
}

export function itemTitle(item: ResumeItem): string {
  switch (item.section) {
    case 'header':
      return `Header: ${(item.data as HeaderData).fullName}`;
    case 'summary': {
      const t = (item.data as SummaryData).text;
      return t.length > 70 ? `${t.slice(0, 70)}\u2026` : t;
    }
    case 'skills': {
      const d = item.data as SkillData;
      return `${d.name} (${d.category})`;
    }
    case 'experience':
    case 'leadership': {
      const d = item.data as ExperienceData;
      return `${d.title} \u2014 ${d.org}`;
    }
    case 'projects':
      return (item.data as ProjectData).name;
    case 'education': {
      const d = item.data as EducationData;
      return [d.degree, d.field].filter(Boolean).join(' \u2013 ');
    }
    case 'certifications':
      return (item.data as CertificationData).name;
  }
}

export function itemMeta(item: ResumeItem): string {
  switch (item.section) {
    case 'experience':
    case 'leadership': {
      const d = item.data as ExperienceData;
      return formatRange(d.start, d.end);
    }
    case 'projects': {
      const d = item.data as ProjectData;
      return [d.yearLabel, d.techLine].filter(Boolean).join(' \u00b7 ');
    }
    case 'education': {
      const d = item.data as EducationData;
      return [d.institution, formatRange(d.start, d.end)].filter(Boolean).join(' \u00b7 ');
    }
    case 'certifications': {
      const d = item.data as CertificationData;
      return [d.issuer, d.year].filter(Boolean).join(' \u00b7 ');
    }
    default:
      return '';
  }
}

/** Number of bullets that will be printed but are not marked verified. */
export function unverifiedCount(item: ResumeItem): number {
  if (!item.included) return 0;
  if (item.section === 'experience' || item.section === 'leadership' || item.section === 'projects') {
    const bullets = (item.data as ExperienceData | ProjectData).bullets;
    return bullets.filter((b) => b.included && !b.verified).length;
  }
  return 0;
}
