import type { z } from 'zod';
import type { resumeCreateSchema, resumePatchSchema } from './schemas';
import type {
  AppSettingsPayload,
  Certification,
  CertificationInput,
  Education,
  EducationInput,
  EntityName,
  Experience,
  ExperienceInput,
  KbImportResult,
  ProfileData,
  ProfileInput,
  Project,
  ProjectInput,
  RestoreResult,
  ResumeDetail,
  ResumeItem,
  ResumeListEntry,
  ResumeMatch,
  ResumeRecord,
  ResumeVersion,
  Skill,
  SkillInput,
  SourceType,
  SyncDiff,
  TemplateId,
} from './types';

/* ---------- transport ---------- */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** JSON fetch for the app's own API. Throws ApiError with a readable message and any field errors. */
export async function request<T>(url: string, method: Method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Could not reach the app. Is it still running in the terminal?', 0);
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const d = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    throw new ApiError(d.error ?? `The request failed (${response.status}).`, response.status, d.fields ?? {});
  }
  return data as T;
}

/* ---------- typed endpoints ---------- */

interface EntityTypes {
  experiences: { record: Experience; input: ExperienceInput };
  education: { record: Education; input: EducationInput };
  certifications: { record: Certification; input: CertificationInput };
  skills: { record: Skill; input: SkillInput };
  projects: { record: Project; input: ProjectInput };
}

export type EntityRecord<E extends EntityName> = EntityTypes[E]['record'];
export type EntityInput<E extends EntityName> = EntityTypes[E]['input'];

export type ResumeCreateInput = z.infer<typeof resumeCreateSchema>;
export type ResumePatchInput = z.infer<typeof resumePatchSchema>;

export const api = {
  profile: {
    get: () => request<ProfileData>('/api/profile'),
    save: (body: ProfileInput) => request<ProfileData>('/api/profile', 'PUT', body),
  },

  library: {
    list: <E extends EntityName>(entity: E) => request<EntityTypes[E]['record'][]>(`/api/library/${entity}`),
    create: <E extends EntityName>(entity: E, body: EntityTypes[E]['input']) =>
      request<EntityTypes[E]['record']>(`/api/library/${entity}`, 'POST', body),
    update: <E extends EntityName>(entity: E, id: number, body: EntityTypes[E]['input']) =>
      request<EntityTypes[E]['record']>(`/api/library/${entity}/${id}`, 'PUT', body),
    remove: (entity: EntityName, id: number) => request<{ usedInResumes: number }>(`/api/library/${entity}/${id}`, 'DELETE'),
    reorder: (entity: EntityName, ids: number[]) => request<{ ok: true }>(`/api/library/${entity}/reorder`, 'POST', { ids }),
  },

  resumes: {
    list: () => request<ResumeListEntry[]>('/api/resumes'),
    create: (body: ResumeCreateInput) => request<{ resume: ResumeRecord; items: ResumeItem[] }>('/api/resumes', 'POST', body),
    get: (id: number) => request<ResumeDetail>(`/api/resumes/${id}`),
    update: (id: number, patch: ResumePatchInput) => request<ResumeRecord>(`/api/resumes/${id}`, 'PATCH', patch),
    remove: (id: number) => request<{ ok: true }>(`/api/resumes/${id}`, 'DELETE'),
    duplicate: (id: number, name?: string) => request<ResumeRecord>(`/api/resumes/${id}/duplicate`, 'POST', { name }),

    addItem: (id: number, body: { sourceType: Exclude<SourceType, 'profile'>; sourceId: number }) =>
      request<ResumeItem>(`/api/resumes/${id}/items`, 'POST', body),
    updateItem: (id: number, itemId: number, patch: { included?: boolean; data?: unknown }) =>
      request<ResumeItem>(`/api/resumes/${id}/items/${itemId}`, 'PATCH', patch),
    removeItem: (id: number, itemId: number) => request<{ ok: true }>(`/api/resumes/${id}/items/${itemId}`, 'DELETE'),
    reorderItems: (id: number, ids: number[]) => request<{ ok: true }>(`/api/resumes/${id}/items/reorder`, 'POST', { ids }),
    syncDiff: (id: number, itemId: number) => request<SyncDiff>(`/api/resumes/${id}/items/${itemId}/sync`),
    sync: (id: number, itemId: number, action: 'pull' | 'keep') =>
      request<ResumeItem>(`/api/resumes/${id}/items/${itemId}/sync`, 'POST', { action }),

    saveVersion: (id: number, label?: string) =>
      request<{ version: ResumeVersion; created: boolean }>(`/api/resumes/${id}/versions`, 'POST', { label }),
    restoreVersion: (id: number, versionId: number) =>
      request<ResumeDetail>(`/api/resumes/${id}/versions/${versionId}`, 'POST', { action: 'restore' }),

    match: (id: number) => request<ResumeMatch>(`/api/resumes/${id}/match`),
    applyProjects: (id: number, projectIds: number[]) => request<ResumeItem[]>(`/api/resumes/${id}/match/apply`, 'POST', { projectIds }),
  },

  backup: {
    restore: (data: unknown) => request<RestoreResult>('/api/backup/restore', 'POST', data),
  },
  importer: {
    knowledgeBase: (data: unknown[], minScore?: number) =>
      request<KbImportResult>('/api/import/knowledge-base', 'POST', { data, minScore }),
  },
  settings: {
    save: (body: { defaultPageSize: 'A4' | 'LETTER'; defaultTemplate: TemplateId }) =>
      request<AppSettingsPayload>('/api/settings', 'PUT', body),
  },
};

/* ---------- file URLs ---------- */

export const BACKUP_URL = '/api/backup';

export function resumeFileUrl(
  id: number,
  format: 'pdf' | 'docx',
  opts: { version?: number; download?: boolean; cacheKey?: number } = {},
): string {
  const params = new URLSearchParams();
  if (opts.version !== undefined) params.set('version', String(opts.version));
  if (opts.download) params.set('download', '1');
  if (opts.cacheKey !== undefined) params.set('ts', String(opts.cacheKey));
  const query = params.toString();
  return `/api/resumes/${id}/${format}${query ? `?${query}` : ''}`;
}
