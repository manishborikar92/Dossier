import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from 'docx';
import type { ResumeDoc, EntryBlock, SectionDoc } from '@/lib/resumeDoc';
import { DENSITY_SCALE, PAGE_SIZES, TEMPLATES } from '@/lib/templates';

const GRAY = '444444';
const BLACK = '000000';
const hex = (c: string) => c.replace('#', '').toUpperCase();
const twips = (pt: number) => Math.round(pt * 20);

export async function renderResumeDocx(doc: ResumeDoc): Promise<Buffer> {
  const t = TEMPLATES[doc.template];
  const scale = DENSITY_SCALE[doc.settings.density];
  const accent = hex(doc.settings.accent);
  const page = PAGE_SIZES[doc.settings.pageSize];
  const marginX = twips(t.margin);
  const marginY = twips(t.margin * 0.8);
  const contentWidth = page.docx.width - marginX * 2;
  const font = t.docxFont;
  const size = (pt: number) => Math.round(pt * 2); // docx sizes are in half-points

  const run = (text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) =>
    new TextRun({ text, font, size: size(o.size ?? t.base), bold: o.bold, italics: o.italics, color: o.color ?? BLACK });

  const link = (text: string, url: string, color = GRAY, pt = t.base, underlined = true): ExternalHyperlink =>
    new ExternalHyperlink({
      link: url,
      children: [new TextRun({ text, font, size: size(pt), color, style: underlined ? 'Hyperlink' : undefined })],
    });

  const heading = (title: string) =>
    new Paragraph({
      keepNext: true,
      spacing: { before: twips(t.sectionGap * scale), after: twips(4 * scale) },
      border: t.headingRule ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } } : undefined,
      children: [run(t.headingUpper ? title.toUpperCase() : title, { bold: true, color: accent, size: t.headingSize })],
    });

  const bullet = (children: ParagraphChild[]) =>
    new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      spacing: { before: twips(t.bulletGap * scale), after: twips(t.bulletGap * scale) },
      children,
    });

  const entry = (e: EntryBlock): Paragraph[] => {
    const head: ParagraphChild[] = [run(e.title, { bold: true, size: t.base + 0.5 })];
    if (e.org) head.push(run(` \u2014 ${e.org}`, { color: GRAY }));
    for (const l of e.links) {
      head.push(run('  |  ', { color: GRAY }));
      head.push(link(l.text, l.url));
    }
    if (e.right) head.push(run(`\t${e.right}`, { italics: true, color: GRAY, size: t.base - 0.5 }));
    const out: Paragraph[] = [
      new Paragraph({
        keepNext: true,
        keepLines: true,
        tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
        spacing: { before: twips(t.entryGap * scale), after: twips(1.5) },
        children: head,
      }),
    ];
    if (e.sub) out.push(new Paragraph({ keepNext: !!(e.meta || e.description || e.bullets.length), spacing: { before: 0, after: twips(1) }, children: [run(e.sub, { color: GRAY, size: t.base - 0.5 })] }));
    if (e.meta) {
      const children: ParagraphChild[] = e.meta.startsWith('Tech Stack: ')
        ? [
            run('Tech Stack: ', { bold: true, color: GRAY, size: t.base - 0.5 }),
            run(e.meta.slice('Tech Stack: '.length), { italics: true, color: GRAY, size: t.base - 0.5 }),
          ]
        : [run(e.meta, { color: GRAY, size: t.base - 0.5 })];
      out.push(new Paragraph({ keepNext: e.bullets.length > 0, spacing: { before: 0, after: twips(2) }, children }));
    }
    if (e.description) out.push(new Paragraph({ spacing: { before: twips(2 * scale), after: twips(2) }, children: [run(e.description)] }));
    for (const b of e.bullets) out.push(bullet([run(b)]));
    return out;
  };

  const section = (sec: SectionDoc): Paragraph[] => {
    const out: Paragraph[] = [heading(sec.title)];
    if (sec.text) out.push(new Paragraph({ spacing: { before: twips(2), after: twips(2) }, children: [run(sec.text)] }));
    for (const g of sec.skillGroups ?? []) {
      out.push(
        new Paragraph({
          spacing: { before: twips(2 * scale), after: twips(2 * scale) },
          children: [run(`${g.category}:  `, { bold: true }), run(g.items.join(', '))],
        }),
      );
    }
    for (const e of sec.entries ?? []) out.push(...entry(e));
    for (const l of sec.lines ?? []) out.push(bullet([l.url ? link(l.text, l.url, BLACK, t.base, false) : run(l.text)]));
    return out;
  };

  const header: Paragraph[] = [
    new Paragraph({
      alignment: t.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 0, after: twips(2) },
      children: [run(doc.name, { bold: true, color: accent, size: t.nameSize })],
    }),
  ];
  if (doc.headline) {
    header.push(
      new Paragraph({
        alignment: t.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: twips(2) },
        children: [run(doc.headline, { color: GRAY })],
      }),
    );
  }
  if (doc.contact.length > 0) {
    const children: ParagraphChild[] = [];
    doc.contact.forEach((c, i) => {
      if (i > 0) children.push(run('  \u00b7  ', { color: GRAY, size: t.base - 1 }));
      children.push(c.url ? link(c.text, c.url, GRAY, t.base - 1, false) : run(c.text, { color: GRAY, size: t.base - 1 }));
    });
    header.push(
      new Paragraph({
        alignment: t.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: twips(2) },
        children,
      }),
    );
  }

  const document = new Document({
    creator: 'Resume Vault',
    title: doc.title,
    description: 'Resume generated by Resume Vault',
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 270 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font, size: size(t.base) } } },
      characterStyles: [
        { id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', run: { color: accent, underline: {} } },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: page.docx.width, height: page.docx.height },
            margin: { top: marginY, bottom: marginY, left: marginX, right: marginX },
          },
        },
        children: [...header, ...doc.sections.flatMap(section)],
      },
    ],
  });
  return Packer.toBuffer(document);
}
