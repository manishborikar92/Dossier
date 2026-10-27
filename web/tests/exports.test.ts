import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildResumeDoc } from '@/lib/resumeDoc';
import { findUnsupportedChars, toWinAnsi } from '@/lib/text';
import { TEMPLATES, normalizeSettings } from '@/lib/templates';
import { formatMonth, formatRange } from '@/lib/format';
import { addItem, createResume, docForResume, saveVersion, snapshotResume, updateItem, updateResume } from '@/server/resumes';
import { createEntity, listEntities } from '@/server/library';
import { renderResumeDocx } from '@/server/export/docx';
import { countPdfPages, renderResumePdf } from '@/server/export/pdf';
import type { ExperienceData, Project } from '@/lib/types';
import { freshDb, inspectPdf, itemsOf } from './helpers';

const NEW = { name: 'Export test', targetTitle: 'Dev', targetCompany: '', template: 'classic', jdText: '', preselect: 'top' } as const;

describe('formatting helpers', () => {
  it('formats months and ranges', () => {
    expect(formatMonth('2025-06')).toBe('Jun 2025');
    expect(formatMonth('2021-04', 'long')).toBe('April 2021');
    expect(formatMonth('bad')).toBe('');
    expect(formatRange('2025-06', '')).toBe('Jun 2025 \u2013 Present');
    expect(formatRange('2023-04', '2023-06')).toBe('Apr 2023 \u2013 Jun 2023');
    expect(formatRange('', '2025-05')).toBe('May 2025');
  });

  it('replaces characters the PDF fonts cannot draw and reports them', () => {
    expect(toWinAnsi('Fast \u2192 reliable \u2265 99%')).toBe('Fast -> reliable >= 99%');
    expect(toWinAnsi('Caf\u00e9 \u2013 \u201cquoted\u201d \u2022')).toBe('Caf\u00e9 \u2013 \u201cquoted\u201d \u2022');
    expect(findUnsupportedChars('plain text')).toEqual([]);
    expect(findUnsupportedChars('arrow \u2192 here')).toEqual(['\u2192']);
  });
});

describe('PDF export', () => {
  it('produces a real PDF with selectable text and clickable links', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const doc = docForResume(db, resume.id);
    const { buffer, pages } = await renderResumePdf(doc);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const info = await inspectPdf(buffer);
    expect(info.pages).toBe(pages);
    expect(countPdfPages(buffer)).toBe(info.pages);
    for (const needle of [
      'ALEX SAMPLE',
      'alex.sample@example.com',
      'PROFESSIONAL EXPERIENCE',
      'Software Developer',
      'Example Software Ltd',
      'Jan 2024',
      'Present',
      'Tech Stack:',
    ]) {
      expect(info.text).toContain(needle);
    }
    expect(info.links).toEqual(expect.arrayContaining(['https://github.com/alex-sample', 'mailto:alex.sample@example.com']));
  });

  it('does not print hidden bullets, hidden sections or unincluded items', async () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const exp = items.find((i) => i.section === 'experience')!;
    const d = exp.data as ExperienceData;
    updateItem(db, resume.id, exp.id, { data: { ...d, bullets: d.bullets.map((b, i) => ({ ...b, included: i === 1 })) } });
    updateResume(db, resume.id, { settings: { hiddenSections: ['certifications'] } });
    const { buffer } = await renderResumePdf(docForResume(db, resume.id));
    const info = await inspectPdf(buffer);
    expect(info.text).not.toContain(d.bullets[0].text);
    expect(info.text).toContain(d.bullets[1].text);
    expect(info.text).not.toContain('CERTIFICATIONS');
  });

  it('flows long content onto several pages without losing text', async () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const exp = items.find((i) => i.section === 'experience')!;
    const d = exp.data as ExperienceData;
    const many = Array.from({ length: 20 }, (_, i) => ({
      text: `Long sample bullet number ${i + 1} describing a piece of work in enough words that the line wraps across the page width and keeps going for a while.`,
      included: true,
      verified: true,
    }));
    updateItem(db, resume.id, exp.id, { data: { ...d, bullets: many } });
    const extra = itemsOf(db, resume.id, 'experience');
    expect(extra.length).toBeGreaterThan(0);
    const { buffer, pages } = await renderResumePdf(docForResume(db, resume.id));
    const info = await inspectPdf(buffer);
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(info.pages).toBe(pages);
    expect(info.text).toContain('Long sample bullet number 1 ');
    expect(info.text).toContain('Long sample bullet number 20 ');
  });

  it('never strands a section heading, entry header or tech line at the bottom of a page', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const projects = listEntities<Project>(db, 'projects');
    // Many entries of varying length so page breaks fall in many different places.
    for (let i = 0; i < 14; i++) {
      const p = createEntity<Project>(db, 'projects', {
        name: `Generated project ${i + 1}`,
        category: '',
        overview: '',
        description: '',
        problem: '',
        solution: '',
        role: '',
        contributions: '',
        technologies: ['Python', 'Docker'],
        features: '',
        decisions: '',
        results: '',
        repoUrl: '',
        demoUrl: '',
        docsUrl: '',
        tags: [],
        keywords: [],
        yearLabel: '2024',
        family: '',
        status: 'active',
        notes: '',
        bullets: Array.from({ length: 2 + (i % 4) }, (_, k) => ({
          text: `Bullet ${k + 1} of project ${i + 1}: ${'a fairly long sentence about the work that wraps across lines '.repeat(1 + ((i + k) % 3))}`,
          verified: true,
        })),
      });
      addItem(db, resume.id, { sourceType: 'project', sourceId: p.id });
    }
    expect(projects.length).toBeGreaterThan(0);
    for (const template of ['classic', 'compact', 'minimal'] as const) {
      updateResume(db, resume.id, { template });
      const info = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
      expect(info.pages).toBeGreaterThanOrEqual(2);
      for (const last of info.lastLines.slice(0, -1)) {
        expect(last).not.toMatch(
          /^(PROFESSIONAL|TECHNICAL|KEY PROJECTS|EDUCATION|CERTIFICATIONS|LEADERSHIP|Professional|Technical|Key projects|Education|Certifications|Leadership)/,
        );
        expect(last).not.toMatch(/Tech Stack:/);
        expect(last).not.toMatch(/Generated project \d+\s+(\||2024)/);
      }
    }
  });

  it('supports every template, both page sizes and every density', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    for (const template of ['classic', 'compact', 'minimal'] as const) {
      for (const pageSize of ['A4', 'LETTER'] as const) {
        updateResume(db, resume.id, { template, settings: { pageSize, density: template === 'compact' ? 'compact' : 'relaxed' } });
        const { buffer } = await renderResumePdf(docForResume(db, resume.id));
        const info = await inspectPdf(buffer);
        expect(info.text.toLowerCase()).toContain('alex sample');
        expect(info.pages).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('exports an older saved version, not the current edits', async () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const { version } = saveVersion(db, resume.id, {});
    updateItem(db, resume.id, items.find((i) => i.section === 'summary')!.id, { data: { text: 'ONLY IN THE LATER EDIT' } });
    const old = await inspectPdf((await renderResumePdf(docForResume(db, resume.id, version.id))).buffer);
    const current = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(old.text).not.toContain('ONLY IN THE LATER EDIT');
    expect(current.text).toContain('ONLY IN THE LATER EDIT');
  });
});

describe('DOCX export', () => {
  it('produces a valid Word document with the same content, real hyperlinks and the chosen page size', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const buffer = await renderResumeDocx(docForResume(db, resume.id));
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
    const text = xml.replace(/<[^>]+>/g, ' ');
    for (const needle of [
      'ALEX SAMPLE',
      'PROFESSIONAL EXPERIENCE',
      'Software Developer',
      'Example Software Ltd',
      'Jan 2024',
      'Present',
      'Tech Stack:',
    ]) {
      expect(text).toContain(needle);
    }
    expect(xml).toContain('<w:hyperlink');
    expect(rels).toContain('https://github.com/alex-sample');
    expect(rels).toContain('mailto:alex.sample@example.com');
    expect(xml).toMatch(/w:w="11906"/); // A4 width
    expect(xml).toContain('w:numId'); // real bullet list, not typed bullet characters
  });

  it('uses Letter size when chosen and omits hidden bullets', async () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const exp = items.find((i) => i.section === 'experience')!;
    const d = exp.data as ExperienceData;
    updateItem(db, resume.id, exp.id, { data: { ...d, bullets: d.bullets.map((b, i) => ({ ...b, included: i !== 0 })) } });
    updateResume(db, resume.id, { settings: { pageSize: 'LETTER' } });
    const zip = await JSZip.loadAsync(await renderResumeDocx(docForResume(db, resume.id)));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toMatch(/w:w="12240"/);
    expect(xml).not.toContain(d.bullets[0].text);
  });
});

describe('matching the reference resume style', () => {
  it('prints the name in capitals in the Classic template only', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const classic = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(classic.text).toContain('ALEX SAMPLE');
    updateResume(db, resume.id, { template: 'minimal' });
    const minimal = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(minimal.text).toContain('Alex Sample');
    expect(minimal.text).not.toContain('ALEX SAMPLE');
  });

  it('draws a rule under the contact line in Classic (header rule plus one per section) and not in Minimal', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const count = async () => {
      const zip = await JSZip.loadAsync(await renderResumeDocx(docForResume(db, resume.id)));
      const xml = await zip.file('word/document.xml')!.async('string');
      return { rules: (xml.match(/<w:pBdr>/g) ?? []).length, sections: docForResume(db, resume.id).sections.length };
    };
    const classic = await count();
    expect(classic.rules).toBe(classic.sections + 1);
    updateResume(db, resume.id, { template: 'minimal' });
    expect((await count()).rules).toBe(0);
  });

  it('prints education dates with full month names and everything else abbreviated', () => {
    const db = freshDb();
    createEntity(db, 'education', {
      institution: 'Example College',
      degree: 'HSC',
      field: '',
      location: '',
      start: '',
      end: '2021-04',
      grade: '',
      details: '',
    });
    const { resume } = createResume(db, NEW);
    const doc = docForResume(db, resume.id);
    const education = doc.sections.find((s) => s.key === 'education')!.entries!;
    expect(education.map((e) => e.right)).toContain('April 2021');
    expect(education.map((e) => e.right)).toContain('August 2020 \u2013 May 2024');
    expect(doc.sections.find((s) => s.key === 'experience')!.entries![0].right).toBe('Jan 2024 \u2013 Present');
    expect(education.every((e) => e.variant === 'plain')).toBe(true);
  });

  it('puts a leadership role on two lines: title with dates, then organisation and description on one grey line', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const entry = docForResume(db, resume.id).sections.find((s) => s.key === 'leadership')!.entries![0];
    expect(entry.title).toBe('Technical Lead');
    expect(entry.org).toBeUndefined();
    expect(entry.sub).toBe('Sample University Coding Club \u2014 Organised sample workshops and coordinated a small team of volunteers.');
    expect(entry.description).toBeUndefined();
    const info = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(info.text).toContain('Sample University Coding Club \u2014 Organised sample workshops');
  });

  it('starts a section on a new page when asked, and ignores the request for the first section', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const base = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(base.pages).toBe(1);

    expect(() => updateResume(db, resume.id, { settings: { pageBreakBefore: ['nonsense' as never] } })).toThrow();
    expect(normalizeSettings({ pageBreakBefore: ['nonsense' as never, 'projects'] }).pageBreakBefore).toEqual(['projects']);
    updateResume(db, resume.id, { settings: { pageBreakBefore: ['projects'] } });
    const doc = docForResume(db, resume.id);
    expect(doc.settings.pageBreakBefore).toEqual(['projects']);
    expect(doc.sections.find((s) => s.key === 'projects')!.pageBreakBefore).toBe(true);
    const broken = await inspectPdf((await renderResumePdf(doc)).buffer);
    expect(broken.pages).toBe(2);
    expect(broken.firstLines[1]).toMatch(/^KEY PROJECTS/);
    expect(broken.pageTexts[0]).not.toContain('KEY PROJECTS');

    const zip = await JSZip.loadAsync(await renderResumeDocx(doc));
    expect(await zip.file('word/document.xml')!.async('string')).toContain('<w:pageBreakBefore');

    updateResume(db, resume.id, { settings: { pageBreakBefore: ['summary'] } });
    const first = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(first.pages).toBe(1); // no blank first page
  });

  it('never splits a short entry across two pages', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    for (let i = 0; i < 12; i++) {
      const p = createEntity<Project>(db, 'projects', {
        name: `Keep together project ${i + 1}`,
        category: '',
        overview: '',
        description: '',
        problem: '',
        solution: '',
        role: '',
        contributions: '',
        technologies: ['Python'],
        features: '',
        decisions: '',
        results: '',
        repoUrl: '',
        demoUrl: '',
        docsUrl: '',
        tags: [],
        keywords: [],
        yearLabel: '2024',
        family: '',
        status: 'active',
        notes: '',
        bullets: Array.from({ length: 3 + (i % 3) }, (_, k) => ({
          text: `Detail ${k + 1} of keep together project ${i + 1}: ${'words that make this bullet wrap onto a second line '.repeat(2)}`,
          verified: true,
        })),
      });
      addItem(db, resume.id, { sourceType: 'project', sourceId: p.id });
    }
    for (const template of ['classic', 'compact', 'minimal'] as const) {
      updateResume(db, resume.id, { template });
      const info = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
      expect(info.pages).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < 12; i++) {
        const lastBullet = `Detail ${3 + (i % 3)} of keep together project ${i + 1}:`;
        const titlePage = info.pageTexts.findIndex((t) => t.includes(`Keep together project ${i + 1} `));
        const endPage = info.pageTexts.findIndex((t) => t.includes(lastBullet));
        expect(titlePage, `${template}: project ${i + 1} title found`).toBeGreaterThanOrEqual(0);
        expect(endPage, `${template}: project ${i + 1} on one page`).toBe(titlePage);
      }
    }
  });

  it('keeps project links clickable while styling them like the title in Classic', async () => {
    const db = freshDb();
    const { resume } = createResume(db, NEW);
    const info = await inspectPdf((await renderResumePdf(docForResume(db, resume.id))).buffer);
    expect(info.links).toContain('https://example.com/task-tracker');
    expect(TEMPLATES.classic.titleLinks).toBe('title');
    expect(TEMPLATES.classic.contactLinks).toBe('blue');
    expect(TEMPLATES.minimal.contactLinks).toBe('muted');
  });
});

describe('document model', () => {
  it('reports included bullets that are not marked verified', () => {
    const db = freshDb();
    const { resume, items } = createResume(db, NEW);
    const exp = items.find((i) => i.section === 'experience')!;
    const d = exp.data as ExperienceData;
    updateItem(db, resume.id, exp.id, { data: { ...d, bullets: [{ text: 'An unverified claim.', included: true, verified: false }] } });
    const doc = buildResumeDoc(snapshotResume(db, resume.id));
    expect(doc.unverifiedBullets).toEqual(['An unverified claim.']);
  });
});
