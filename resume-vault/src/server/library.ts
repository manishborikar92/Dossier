import type { z } from 'zod';
import type { DB } from './db';
import { nowIso } from './db';
import {
  certificationSchema,
  educationSchema,
  experienceSchema,
  profileSchema,
  projectSchema,
  skillSchema,
} from '@/lib/schemas';
import type {
  Bullet,
  EntityName,
  ProfileData,
  ProfileInput,
  SourceType,
} from '@/lib/types';
import { notFound } from './errors';

/* ------------------------------------------------------------------ */
/* Generic entity helpers (experiences, education, certifications,    */
/* skills, projects). API objects use camelCase; columns use snake_case */
/* ------------------------------------------------------------------ */

interface Spec {
  table: string;
  sourceType: SourceType;
  cols: string[];
  readOnly: string[];
  json: string[];
  bool: string[];
  bulletOwner?: 'experience' | 'project';
  orderBy: string;
  schema: z.ZodType;
}

const COLUMN_OVERRIDES: Record<string, string> = { start: 'start_date', end: 'end_date' };
const col = (field: string): string =>
  COLUMN_OVERRIDES[field] ?? field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

export const SPECS: Record<EntityName, Spec> = {
  experiences: {
    table: 'experiences',
    sourceType: 'experience',
    cols: ['org', 'title', 'location', 'start', 'end', 'kind', 'description', 'archived'],
    readOnly: [],
    json: [],
    bool: ['archived'],
    bulletOwner: 'experience',
    orderBy: 'sort ASC, id ASC',
    schema: experienceSchema,
  },
  education: {
    table: 'education',
    sourceType: 'education',
    cols: ['institution', 'degree', 'field', 'location', 'start', 'end', 'grade', 'details'],
    readOnly: [],
    json: [],
    bool: [],
    orderBy: 'sort ASC, id ASC',
    schema: educationSchema,
  },
  certifications: {
    table: 'certifications',
    sourceType: 'certification',
    cols: ['name', 'issuer', 'year', 'url'],
    readOnly: [],
    json: [],
    bool: [],
    orderBy: 'sort ASC, id ASC',
    schema: certificationSchema,
  },
  skills: {
    table: 'skills',
    sourceType: 'skill',
    cols: ['name', 'category'],
    readOnly: [],
    json: [],
    bool: [],
    orderBy: 'sort ASC, id ASC',
    schema: skillSchema,
  },
  projects: {
    table: 'projects',
    sourceType: 'project',
    cols: [
      'name', 'category', 'overview', 'description', 'problem', 'solution', 'role', 'contributions',
      'technologies', 'features', 'decisions', 'results', 'repoUrl', 'demoUrl', 'docsUrl', 'tags',
      'keywords', 'yearLabel', 'family', 'status', 'notes',
    ],
    readOnly: ['sourceKey'],
    json: ['technologies', 'tags', 'keywords'],
    bool: [],
    bulletOwner: 'project',
    orderBy: 'sort ASC, id ASC',
    schema: projectSchema,
  },
};

export function isEntityName(value: string): value is EntityName {
  return Object.prototype.hasOwnProperty.call(SPECS, value);
}

type Row = Record<string, unknown>;
type Entity = Record<string, unknown> & { id: number; version: number; bullets?: Bullet[] };

function loadBullets(db: DB, owner: 'experience' | 'project', ownerId?: number): Map<number, Bullet[]> {
  const rows = (
    ownerId === undefined
      ? db.prepare('SELECT * FROM bullets WHERE owner_type = ? ORDER BY sort, id').all(owner)
      : db.prepare('SELECT * FROM bullets WHERE owner_type = ? AND owner_id = ? ORDER BY sort, id').all(owner, ownerId)
  ) as Row[];
  const map = new Map<number, Bullet[]>();
  for (const r of rows) {
    const list = map.get(r.owner_id as number) ?? [];
    list.push({ id: r.id as number, text: r.text as string, verified: !!r.verified });
    map.set(r.owner_id as number, list);
  }
  return map;
}

function rowToEntity(spec: Spec, row: Row, bullets: Map<number, Bullet[]>): Entity {
  const out: Row = {};
  for (const f of [...spec.cols, ...spec.readOnly]) {
    let v = row[col(f)];
    if (spec.json.includes(f)) v = JSON.parse(v as string);
    else if (spec.bool.includes(f)) v = !!v;
    out[f] = v;
  }
  out.id = row.id;
  out.version = row.version;
  out.sort = row.sort;
  out.createdAt = row.created_at;
  out.updatedAt = row.updated_at;
  out.usedInCount = (row.used_in as number | undefined) ?? 0;
  if (spec.bulletOwner) out.bullets = bullets.get(row.id as number) ?? [];
  return out as Entity;
}

const LIST_SQL = (spec: Spec) => `
  SELECT t.*, (
    SELECT COUNT(DISTINCT ri.resume_id) FROM resume_items ri
    WHERE ri.source_type = '${spec.sourceType}' AND ri.source_id = t.id
  ) AS used_in
  FROM ${spec.table} t`;

export function listEntities<T = Entity>(db: DB, name: EntityName): T[] {
  const spec = SPECS[name];
  const rows = db.prepare(`${LIST_SQL(spec)} ORDER BY ${spec.orderBy}`).all() as Row[];
  const bullets = spec.bulletOwner ? loadBullets(db, spec.bulletOwner) : new Map<number, Bullet[]>();
  return rows.map((r) => rowToEntity(spec, r, bullets) as T);
}

export function getEntity<T = Entity>(db: DB, name: EntityName, id: number): T {
  const spec = SPECS[name];
  const row = db.prepare(`${LIST_SQL(spec)} WHERE t.id = ?`).get(id) as Row | undefined;
  if (!row) throw notFound(spec.table === 'education' ? 'Education entry' : `This ${spec.sourceType}`);
  const bullets = spec.bulletOwner ? loadBullets(db, spec.bulletOwner, id) : new Map<number, Bullet[]>();
  return rowToEntity(spec, row, bullets) as T;
}

function signature(spec: Spec, value: Record<string, unknown>): string {
  const fields = spec.cols.map((f) => value[f]);
  const bullets = ((value.bullets as { text: string; verified: boolean }[] | undefined) ?? []).map((b) => [
    b.text,
    !!b.verified,
  ]);
  return JSON.stringify([fields, bullets]);
}

function toDbValue(spec: Spec, field: string, value: unknown): unknown {
  if (spec.json.includes(field)) return JSON.stringify(value ?? []);
  if (spec.bool.includes(field)) return value ? 1 : 0;
  return value ?? '';
}

function writeBullets(
  db: DB,
  owner: 'experience' | 'project',
  ownerId: number,
  bullets: { id?: number; text: string; verified: boolean }[],
): void {
  const existing = new Set(
    (db.prepare('SELECT id FROM bullets WHERE owner_type = ? AND owner_id = ?').all(owner, ownerId) as { id: number }[]).map(
      (r) => r.id,
    ),
  );
  const keep = new Set(bullets.filter((b) => b.id !== undefined && existing.has(b.id)).map((b) => b.id as number));
  for (const id of existing) if (!keep.has(id)) db.prepare('DELETE FROM bullets WHERE id = ?').run(id);
  bullets.forEach((b, index) => {
    if (b.id !== undefined && keep.has(b.id)) {
      db.prepare('UPDATE bullets SET text = ?, verified = ?, sort = ? WHERE id = ?').run(b.text, b.verified ? 1 : 0, index, b.id);
    } else {
      db.prepare('INSERT INTO bullets (owner_type, owner_id, text, verified, sort) VALUES (?,?,?,?,?)').run(
        owner,
        ownerId,
        b.text,
        b.verified ? 1 : 0,
        index,
      );
    }
  });
}

export interface CreateOptions {
  sort?: number;
  sourceKey?: string | null;
}

export function createEntity<T = Entity>(db: DB, name: EntityName, input: unknown, opts: CreateOptions = {}): T {
  const spec = SPECS[name];
  const value = spec.schema.parse(input) as Record<string, unknown>;
  const id = db.transaction(() => {
    const sort =
      opts.sort ??
      ((db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM ${spec.table}`).get() as { n: number }).n);
    const columns = spec.cols.map(col);
    const extra: string[] = [];
    const extraValues: unknown[] = [];
    if (name === 'projects' && opts.sourceKey) {
      extra.push('source_key');
      extraValues.push(opts.sourceKey);
    }
    const sql = `INSERT INTO ${spec.table} (${[...columns, ...extra, 'sort'].join(', ')}) VALUES (${[
      ...columns,
      ...extra,
      'sort',
    ]
      .map(() => '?')
      .join(', ')})`;
    const info = db
      .prepare(sql)
      .run(...spec.cols.map((f) => toDbValue(spec, f, value[f])), ...extraValues, sort);
    const newId = Number(info.lastInsertRowid);
    if (spec.bulletOwner) {
      writeBullets(db, spec.bulletOwner, newId, (value.bullets as never[]) ?? []);
    }
    return newId;
  })();
  return getEntity<T>(db, name, id);
}

export function updateEntity<T = Entity>(db: DB, name: EntityName, id: number, input: unknown): T {
  const spec = SPECS[name];
  const before = getEntity<Entity>(db, name, id);
  const value = spec.schema.parse(input) as Record<string, unknown>;
  if (signature(spec, before) === signature(spec, value)) return before as T;

  db.transaction(() => {
    const sets = spec.cols.map((f) => `${col(f)} = ?`).join(', ');
    db.prepare(`UPDATE ${spec.table} SET ${sets}, version = version + 1, updated_at = ? WHERE id = ?`).run(
      ...spec.cols.map((f) => toDbValue(spec, f, value[f])),
      nowIso(),
      id,
    );
    if (spec.bulletOwner) writeBullets(db, spec.bulletOwner, id, (value.bullets as never[]) ?? []);
  })();
  return getEntity<T>(db, name, id);
}

/** Deletes a library item. Resumes that already contain it keep their own copy. */
export function deleteEntity(db: DB, name: EntityName, id: number): { usedInResumes: number } {
  const spec = SPECS[name];
  const before = getEntity<Entity & { usedInCount: number }>(db, name, id);
  db.transaction(() => {
    if (spec.bulletOwner) db.prepare('DELETE FROM bullets WHERE owner_type = ? AND owner_id = ?').run(spec.bulletOwner, id);
    db.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).run(id);
  })();
  return { usedInResumes: before.usedInCount };
}

export function reorderEntities(db: DB, name: EntityName, ids: number[]): void {
  const spec = SPECS[name];
  db.transaction(() => {
    ids.forEach((id, index) => db.prepare(`UPDATE ${spec.table} SET sort = ? WHERE id = ?`).run(index, id));
  })();
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export function getProfile(db: DB): ProfileData {
  const p = db.prepare('SELECT * FROM profile WHERE id = 1').get() as Row;
  const links = db.prepare('SELECT id, label, url FROM profile_links ORDER BY sort, id').all() as ProfileData['links'];
  const summaries = (db.prepare('SELECT id, label, text, version FROM summaries ORDER BY sort, id').all() as ProfileData['summaries']);
  return {
    fullName: p.full_name as string,
    headline: p.headline as string,
    email: p.email as string,
    phone: p.phone as string,
    location: p.location as string,
    version: p.version as number,
    updatedAt: p.updated_at as string,
    links,
    summaries,
  };
}

export function saveProfile(db: DB, input: unknown): ProfileData {
  const value = profileSchema.parse(input) as ProfileInput;
  const before = getProfile(db);

  db.transaction(() => {
    const coreSignature = (v: { fullName: string; headline: string; email: string; phone: string; location: string; links: { label: string; url: string }[] }) =>
      JSON.stringify([v.fullName, v.headline, v.email, v.phone, v.location, v.links.map((l) => [l.label, l.url])]);
    if (coreSignature(before) !== coreSignature(value)) {
      db.prepare(
        'UPDATE profile SET full_name = ?, headline = ?, email = ?, phone = ?, location = ?, version = version + 1, updated_at = ? WHERE id = 1',
      ).run(value.fullName, value.headline, value.email, value.phone, value.location, nowIso());
    }
    db.prepare('DELETE FROM profile_links').run();
    value.links.forEach((l, i) =>
      db.prepare('INSERT INTO profile_links (label, url, sort) VALUES (?,?,?)').run(l.label, l.url, i),
    );

    const existing = new Map(before.summaries.map((s) => [s.id, s]));
    const keep = new Set(value.summaries.filter((s) => s.id !== undefined && existing.has(s.id)).map((s) => s.id as number));
    for (const s of before.summaries) if (!keep.has(s.id)) db.prepare('DELETE FROM summaries WHERE id = ?').run(s.id);
    value.summaries.forEach((s, index) => {
      const old = s.id !== undefined ? existing.get(s.id) : undefined;
      if (old) {
        const changed = old.label !== s.label || old.text !== s.text;
        db.prepare(
          `UPDATE summaries SET label = ?, text = ?, sort = ?${changed ? ', version = version + 1, updated_at = ?' : ''} WHERE id = ?`,
        ).run(...(changed ? [s.label, s.text, index, nowIso(), old.id] : [s.label, s.text, index, old.id]));
      } else {
        db.prepare('INSERT INTO summaries (label, text, sort) VALUES (?,?,?)').run(s.label, s.text, index);
      }
    });
  })();
  return getProfile(db);
}

/** Everything the keyword matcher and resume creation need from the library. */
export function profileIsEmpty(p: ProfileData): boolean {
  return p.fullName.trim() === '';
}
