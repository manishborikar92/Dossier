import { describe, expect, it } from 'vitest';
import {
  addItem,
  applyProjectSelection,
  createResume,
  deleteResume,
  docForResume,
  duplicateResume,
  getResume,
  listResumes,
  listVersions,
  matchForResume,
  removeItem,
  reorderItems,
  restoreVersion,
  saveVersion,
  syncDiff,
  syncItem,
  updateItem,
  updateResume,
} from '@/server/resumes';
import { listEntities, saveProfile, getProfile, updateEntity } from '@/server/library';
import type { ExperienceData, Project, ProjectData, SummaryData } from '@/lib/types';
import { freshDb, itemsOf } from './helpers';

const NEW = { name: 'General', targetTitle: 'Developer', targetCompany: '', template: 'classic', jdText: '', preselect: 'top' } as const;

describe('creating a resume', () => {
  it('copies the header, summary, experience, education, skills and top projects from the library', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    expect(resume.status).toBe('draft');
    const sections = items.map((i) => i.section);
    expect(sections.filter((s) => s === 'header')).toHaveLength(1);
    expect(sections.filter((s) => s === 'summary')).toHaveLength(1);
    expect(sections.filter((s) => s === 'experience')).toHaveLength(2); // job + internship
    expect(sections.filter((s) => s === 'leadership')).toHaveLength(1);
    expect(sections.filter((s) => s === 'skills')).toHaveLength(11);
    const projects = items.filter((i) => i.section === 'projects');
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.length).toBeLessThanOrEqual(3);
    // archived projects are never pre-selected
    expect(projects.map((p) => (p.data as ProjectData).name)).not.toContain('Sample Command-Line Tool');
    expect(items.every((i) => i.sync === 'current')).toBe(true);
  });

  it('refuses to create a resume before the profile has a name', () => {
    const db = freshDb(false);
    expect(() => createResume(db, NEW)).toThrow(/Profile/);
  });

  it('can pre-select projects that match a job description', () => {
    const db = freshDb();
    const { items } = createResume(db, { ...NEW, preselect: 'match', jdText: 'We need someone with TensorFlow and Python experience for machine learning.' });
    const names = items.filter((i) => i.section === 'projects').map((i) => (i.data as ProjectData).name);
    expect(names[0]).toBe('Sample Image Classifier');
  });
});

describe('resume independence', () => {
  it('editing one resume never changes another resume or the library', () => {
    const db = freshDb();
    const a = createResume(db, { ...NEW, name: 'A' });
    const b = createResume(db, { ...NEW, name: 'B' });
    const aProject = a.items.find((i) => i.section === 'projects')!;
    const data = aProject.data as ProjectData;
    updateItem(db, a.resume.id, aProject.id, {
      data: { ...data, bullets: [{ text: 'Rewritten only for resume A.', included: true, verified: true }] },
    });

    const aAfter = itemsOf(db, a.resume.id, 'projects').find((i) => i.id === aProject.id)!.data as ProjectData;
    expect(aAfter.bullets[0].text).toBe('Rewritten only for resume A.');
    const bProject = itemsOf(db, b.resume.id, 'projects')[0].data as ProjectData;
    expect(bProject.bullets[0].text).not.toBe('Rewritten only for resume A.');
    const lib = listEntities<Project>(db, 'projects').find((p) => p.name === data.name)!;
    expect(lib.bullets[0].text).not.toBe('Rewritten only for resume A.');
  });

  it('keeps hidden bullets out of the exported document', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const exp = items.find((i) => i.section === 'experience')!;
    const data = exp.data as ExperienceData;
    updateItem(db, resume.id, exp.id, { data: { ...data, bullets: data.bullets.map((b, i) => ({ ...b, included: i !== 0 })) } });
    const doc = docForResume(db, resume.id);
    const entry = doc.sections.find((s) => s.key === 'experience')!.entries![0];
    expect(entry.bullets).toHaveLength(data.bullets.length - 1);
    expect(entry.bullets).not.toContain(data.bullets[0].text);
  });

  it('validates edited item data', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const summary = items.find((i) => i.section === 'summary')!;
    expect(() => updateItem(db, resume.id, summary.id, { data: { text: '' } })).toThrow();
    expect(() => updateItem(db, resume.id, items.find((i) => i.section === 'header')!.id, { included: false })).toThrow(/header/i);
  });
});

describe('library changes and the hybrid update strategy', () => {
  it('flags changed sources, lets you pull or keep, and never edits the resume by itself', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const projectItem = items.find((i) => i.section === 'projects')!;
    const before = projectItem.data as ProjectData;
    const lib = listEntities<Project>(db, 'projects').find((p) => p.id === projectItem.sourceId)!;
    updateEntity(db, 'projects', lib.id, { ...lib, overview: 'A different overview.', bullets: [{ text: 'Library bullet changed.', verified: true }] });

    const flagged = itemsOf(db, resume.id, 'projects').find((i) => i.id === projectItem.id)!;
    expect(flagged.sync).toBe('changed');
    expect((flagged.data as ProjectData).bullets[0].text).toBe(before.bullets[0].text); // untouched
    expect(listResumes(db).find((r) => r.id === resume.id)!.outdatedCount).toBe(1);

    const diff = syncDiff(db, resume.id, projectItem.id);
    expect(diff.library!.join('\n')).toContain('Library bullet changed.');
    expect(diff.mine.join('\n')).toContain(before.bullets[0].text);

    const kept = syncItem(db, resume.id, projectItem.id, 'keep');
    expect(kept.sync).toBe('current');
    expect((kept.data as ProjectData).bullets[0].text).toBe(before.bullets[0].text);

    updateEntity(db, 'projects', lib.id, { ...lib, overview: 'Changed again.', bullets: [{ text: 'Second library change.', verified: true }] });
    const pulled = syncItem(db, resume.id, projectItem.id, 'pull');
    expect(pulled.sync).toBe('current');
    expect((pulled.data as ProjectData).bullets[0].text).toBe('Second library change.');
  });

  it('flags the header when the profile changes and keeps a deleted source as a normal item', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    saveProfile(db, { ...getProfile(db), phone: '+11 111 111 1111' });
    expect(itemsOf(db, resume.id, 'header')[0].sync).toBe('changed');
    const header = items.find((i) => i.section === 'header')!;
    expect(syncItem(db, resume.id, header.id, 'pull').sync).toBe('current');

    db.prepare("DELETE FROM skills WHERE id = ?").run(items.find((i) => i.section === 'skills')!.sourceId);
    const skill = itemsOf(db, resume.id, 'skills')[0];
    expect(skill.sync).toBe('missing');
    expect(docForResume(db, resume.id).sections.some((s) => s.key === 'skills')).toBe(true);
  });
});

describe('versions', () => {
  it('saves immutable snapshots, restores them, and protects the current state first', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const { version: v1, created } = saveVersion(db, resume.id, { label: 'First send' });
    expect(created).toBe(true);
    expect(v1.number).toBe(1);

    const summary = items.find((i) => i.section === 'summary')!;
    updateItem(db, resume.id, summary.id, { data: { text: 'Edited after the first version.' } });
    updateResume(db, resume.id, { name: 'Renamed' });

    // The saved snapshot is unaffected by later edits.
    const stored = JSON.parse((db.prepare('SELECT snapshot FROM resume_versions WHERE id = ?').get(v1.id) as { snapshot: string }).snapshot);
    expect(stored.resume.name).toBe('General');

    expect(saveVersion(db, resume.id, { reason: 'export' }).created).toBe(true);
    expect(saveVersion(db, resume.id, { reason: 'export' }).created).toBe(false); // nothing changed

    // An unsaved edit made after the last version must survive a restore.
    updateItem(db, resume.id, summary.id, { data: { text: 'Unsaved edit before restoring.' } });
    const restored = restoreVersion(db, resume.id, v1.id);
    expect(restored.resume.name).toBe('General');
    expect((restored.items.find((i) => i.section === 'summary')!.data as SummaryData).text).not.toContain('edit');
    const versions = listVersions(db, resume.id);
    expect(versions).toHaveLength(3);
    const protectedVersion = versions.find((v) => v.reason === 'before-restore')!;
    const snap = JSON.parse((db.prepare('SELECT snapshot FROM resume_versions WHERE id = ?').get(protectedVersion.id) as { snapshot: string }).snapshot);
    expect(JSON.stringify(snap.items)).toContain('Unsaved edit before restoring.');
  });

  it('exports a saved version exactly as it was', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const { version } = saveVersion(db, resume.id, {});
    const summary = items.find((i) => i.section === 'summary')!;
    updateItem(db, resume.id, summary.id, { data: { text: 'Later edit.' } });
    expect(docForResume(db, resume.id, version.id).sections.find((s) => s.key === 'summary')!.text).not.toBe('Later edit.');
    expect(docForResume(db, resume.id).sections.find((s) => s.key === 'summary')!.text).toBe('Later edit.');
  });
});

describe('managing resumes and sections', () => {
  it('duplicates, renames, reorders, hides sections and deletes safely', () => {
    const db = freshDb();
    const a = createResume(db, NEW);
    const copy = duplicateResume(db, a.resume.id, 'Backend copy');
    expect(copy.parentId).toBe(a.resume.id);
    expect(getResume(db, copy.id).items.length).toBe(a.items.length);
    updateItem(db, copy.id, itemsOf(db, copy.id, 'summary')[0].id, { data: { text: 'Copy-only summary.' } });
    expect((itemsOf(db, a.resume.id, 'summary')[0].data as SummaryData).text).not.toBe('Copy-only summary.');

    const skills = itemsOf(db, a.resume.id, 'skills');
    reorderItems(db, a.resume.id, [...skills].reverse().map((s) => s.id));
    expect(docForResume(db, a.resume.id).sections.find((s) => s.key === 'skills')!.skillGroups![0].category).toBe('Tools');

    updateResume(db, a.resume.id, { settings: { hiddenSections: ['certifications'], sectionOrder: ['experience', 'summary'] } });
    const keys = docForResume(db, a.resume.id).sections.map((s) => s.key);
    expect(keys).not.toContain('certifications');
    expect(keys[0]).toBe('experience');
    expect(keys).toContain('leadership'); // sections missing from a custom order are appended, not lost

    deleteResume(db, copy.id);
    expect(() => getResume(db, copy.id)).toThrow(/not found/i);
    expect(getResume(db, a.resume.id).items.length).toBe(a.items.length);
  });

  it('adds library items, rejects duplicates, and replaces the summary instead of adding a second one', () => {
    const db = freshDb();
    const { resume } = createResume(db, { ...NEW, preselect: 'none' });
    const projects = listEntities<Project>(db, 'projects');
    const added = addItem(db, resume.id, { sourceType: 'project', sourceId: projects[1].id });
    expect(added.section).toBe('projects');
    expect(() => addItem(db, resume.id, { sourceType: 'project', sourceId: projects[1].id })).toThrow(/already/);

    const secondSummary = (db.prepare('SELECT id FROM summaries ORDER BY id DESC LIMIT 1').get() as { id: number }).id;
    addItem(db, resume.id, { sourceType: 'summary', sourceId: secondSummary });
    expect(itemsOf(db, resume.id, 'summary')).toHaveLength(1);
    expect((itemsOf(db, resume.id, 'summary')[0].data as SummaryData).text).toContain('back-end');

    removeItem(db, resume.id, added.id);
    expect(itemsOf(db, resume.id, 'projects')).toHaveLength(0);
  });

  it('applies a project selection from the matcher', () => {
    const db = freshDb();
    const { resume } = createResume(db, { ...NEW, jdText: 'Looking for React, Node.js and PostgreSQL skills.' });
    const match = matchForResume(db, resume.id);
    expect(match.result.projects[0].name).toBe('Sample Task Tracker');
    const ids = match.result.projects.slice(0, 1).map((p) => p.id);
    const items = applyProjectSelection(db, resume.id, ids);
    const visible = items.filter((i) => i.section === 'projects' && i.included).map((i) => i.sourceId);
    expect(visible).toEqual(ids);
  });
});
