import type { z } from 'zod';
import type { MatchResult } from './matcher';
import type {
  bulletSchema,
  experienceSchema,
  educationSchema,
  certificationSchema,
  skillSchema,
  projectSchema,
  summaryVariantSchema,
  profileLinkSchema,
  profileSchema,
  resumeSettingsSchema,
  SectionKey,
  TemplateId,
} from './schemas';

export type { SectionKey, TemplateId };

export type BulletInput = z.infer<typeof bulletSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type SkillInput = z.infer<typeof skillSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type SummaryVariantInput = z.infer<typeof summaryVariantSchema>;
export type ProfileLinkInput = z.infer<typeof profileLinkSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ResumeSettings = z.infer<typeof resumeSettingsSchema>;

export interface Meta {
  id: number;
  version: number;
  sort: number;
  usedInCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface Bullet {
  id: number;
  text: string;
  verified: boolean;
}

export type Experience = Omit<ExperienceInput, 'bullets'> & Meta & { bullets: Bullet[] };
export type Education = EducationInput & Meta;
export type Certification = CertificationInput & Meta;
export type Skill = SkillInput & Meta;
export type Project = Omit<ProjectInput, 'bullets'> & Meta & { sourceKey: string | null; bullets: Bullet[] };

export interface ProfileData {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  version: number;
  updatedAt: string;
  links: { id: number; label: string; url: string }[];
  summaries: { id: number; label: string; text: string; version: number }[];
}

export type EntityName = 'experiences' | 'education' | 'certifications' | 'skills' | 'projects';
export const ENTITY_NAMES: EntityName[] = ['experiences', 'education', 'certifications', 'skills', 'projects'];

/* ---------- resume item data ---------- */

export interface ItemBullet {
  text: string;
  included: boolean;
  verified: boolean;
}
export interface ItemLink {
  label: string;
  url: string;
  show: boolean;
}
export interface HeaderData {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: ItemLink[];
  show: { headline: boolean; email: boolean; phone: boolean; location: boolean };
}
export interface SummaryData {
  text: string;
}
export interface SkillData {
  name: string;
  category: string;
}
export interface ExperienceData {
  org: string;
  title: string;
  location: string;
  start: string;
  end: string;
  kind: string;
  description: string;
  bullets: ItemBullet[];
}
export interface ProjectData {
  name: string;
  techLine: string;
  yearLabel: string;
  overview: string;
  links: ItemLink[];
  bullets: ItemBullet[];
}
export interface EducationData {
  institution: string;
  degree: string;
  field: string;
  location: string;
  start: string;
  end: string;
  grade: string;
  details: string;
}
export interface CertificationData {
  name: string;
  issuer: string;
  year: string;
  url: string;
}

export interface ItemDataMap {
  header: HeaderData;
  summary: SummaryData;
  skills: SkillData;
  experience: ExperienceData;
  projects: ProjectData;
  education: EducationData;
  certifications: CertificationData;
  leadership: ExperienceData;
}
export type ItemSection = keyof ItemDataMap;
export type SourceType = 'profile' | 'summary' | 'experience' | 'project' | 'education' | 'certification' | 'skill';
export type SyncStatus = 'current' | 'changed' | 'missing' | 'manual';

export interface ResumeItem<S extends ItemSection = ItemSection> {
  id: number;
  resumeId: number;
  section: S;
  sourceType: SourceType | null;
  sourceId: number | null;
  sourceVersion: number | null;
  position: number;
  included: boolean;
  data: ItemDataMap[S];
  sync: SyncStatus;
}

export interface ResumeRecord {
  id: number;
  name: string;
  targetTitle: string;
  targetCompany: string;
  template: TemplateId;
  status: 'draft' | 'final';
  settings: ResumeSettings;
  jdText: string;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotItem {
  section: ItemSection;
  sourceType: SourceType | null;
  sourceId: number | null;
  sourceVersion: number | null;
  position: number;
  included: boolean;
  data: unknown;
}
export interface Snapshot {
  resume: {
    name: string;
    targetTitle: string;
    targetCompany: string;
    template: TemplateId;
    status: 'draft' | 'final';
    settings: ResumeSettings;
    jdText: string;
  };
  items: SnapshotItem[];
}

export interface ResumeVersion {
  id: number;
  resumeId: number;
  number: number;
  label: string;
  reason: string;
  createdAt: string;
}

/* ---------- shapes returned by the API (shared by server and browser) ---------- */

export interface ResumeListEntry extends ResumeRecord {
  itemCount: number;
  projectCount: number;
  versionCount: number;
  outdatedCount: number;
}

export interface ResumeDetail {
  resume: ResumeRecord;
  items: ResumeItem[];
  versions: ResumeVersion[];
}

/** Side-by-side comparison of a resume item with the library item it was copied from. */
export interface SyncDiff {
  status: SyncStatus;
  section: ItemSection;
  mine: string[];
  library: string[] | null;
}

export interface ResumeMatch {
  result: MatchResult;
  /** Library id -> whether it is currently included in this resume. */
  projectsInResume: Record<number, boolean>;
  skillsInResume: Record<number, boolean>;
}

export interface KbImportResult {
  imported: number;
  skipped: string[];
  belowMinScore: number;
  failed: { id: string; reason: string }[];
}

export interface RestoreResult {
  counts: Record<string, number>;
  safetyCopy: string | null;
}

export interface AppSettingsPayload {
  defaultPageSize: 'A4' | 'LETTER';
  defaultTemplate: TemplateId;
  databasePath: string;
  dataDir: string;
}
