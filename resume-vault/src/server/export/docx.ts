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
import { isUnbreakable, type EntryBlock, type ResumeDoc, type SectionDoc } from '@/lib/resumeDoc';
import { DENSITY_SCALE, LINK_BLUE, PAGE_SIZES, TEMPLATES } from '@/lib/templates';

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
  const align = t.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;

  const run = (text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) =>
    new TextRun({ text, font, size: size(o.size ?? t.base), bold: o.bold, italics: o.italics, color: o.color ?? BLACK });

  const link = (
    text: string,
    url: string,
    o: { color?: string; pt?: number; underlined?: boolean; bold?: boolean } = {},
  ): ExternalHyperlink =>
    new ExternalHyperlink({
      link: url,
      children: [
        new TextRun({
          text,
          font,
          size: size(o.pt ?? t.base),
          color: o.color ?? GRAY,
          bold: o.bold,
          style: o.underlined === false ? undefined : 'Hyperlink',
        }),
      ],
    });

  const heading = (title: string, pageBreakBefore: boolean) =>
    new Paragraph({
      keepNext: true,
      pageBreakBefore,
      spacing: { before: twips(t.sectionGap * scale), after: twips(4 * scale) },
      border: t.headingRule ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } } : undefined,
      children: [run(t.headingUpper ? title.toUpperCase() : title, { bold: true, color: accent, size: t.headingSize })],
    });

  const bullet = (children: ParagraphChild[], keepNext = false) =>
    new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      keepNext,
      keepLines: true,
      spacing: { before: twips(t.bulletGap * scale), after: twips(t.bulletGap * scale) },
      children,
    });

  const entry = (e: EntryBlock): Paragraph[] => {
    const plain = e.variant === 'plain';
    const titleSize = plain ? t.base : t.base + 0.5;
    const whole = isUnbreakable(e);
    const head: ParagraphChild[] = [run(e.title, { bold: true, size: titleSize })];
    if (e.org) head.push(run(` \u2014 ${e.org}`, { color: GRAY }));
    for (const l of e.links) {
      if (t.titleLinks === 'title') {
        head.push(run('  |  ', { bold: true, size: titleSize }));
        head.push(link(l.text, l.url, { color: BLACK, pt: titleSize, underlined: false, bold: true }));
      } else {
        head.push(run('  |  ', { color: GRAY }));
        head.push(link(l.text, l.url));
      }
    }
    if (e.right) {
      head.push(
        plain ? run(`\t${e.right}`, { size: t.base - 0.5 }) : run(`\t${e.right}`, { italics: true, color: GRAY, size: t.base - 0.5 }),
      );
    }

    const hasMore = (from: 'sub' | 'meta' | 'description') => {
      if (from === 'sub') return !!(e.meta || e.description || e.bullets.length);
      if (from === 'meta') return !!(e.description || e.bullets.length);
      return e.bullets.length > 0;
    };

    const out: Paragraph[] = [
      new Paragraph({
        keepNext: true,
        keepLines: true,
        tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
        spacing: { before: twips((plain ? Math.max(2, t.entryGap - 3) : t.entryGap) * scale), after: twips(1.5) },
        children: head,
      }),
    ];
    if (e.sub) {
      out.push(
        new Paragraph({
          keepNext: hasMore('sub'),
          keepLines: true,
          spacing: { before: 0, after: twips(1) },
          children: [run(e.sub, { color: GRAY, size: t.base - 0.5 })],
        }),
      );
    }
    if (e.meta) {
      const children: ParagraphChild[] = e.meta.startsWith('Tech Stack: ')
        ? [
            run('Tech Stack: ', { bold: true, color: GRAY, size: t.base - 0.5 }),
            run(e.meta.slice('Tech Stack: '.length), { italics: true, color: GRAY, size: t.base - 0.5 }),
          ]
        : [run(e.meta, { color: GRAY, size: t.base - 0.5 })];
      out.push(new Paragraph({ keepNext: hasMore('meta'), keepLines: true, spacing: { before: 0, after: twips(2) }, children }));
    }
    if (e.description) {
      out.push(
        new Paragraph({
          keepNext: hasMore('description'),
          keepLines: true,
          spacing: { before: twips(2 * scale), after: twips(2) },
          children: [run(e.description)],
        }),
      );
    }
    // A short entry is kept together on one page. A long one only keeps its header with its first bullet
    // (the header paragraphs above already carry "keep with next").
    e.bullets.forEach((b, i) => out.push(bullet([run(b)], whole && i < e.bullets.length - 1)));
    return out;
  };

  const section = (sec: SectionDoc): Paragraph[] => {
    const out: Paragraph[] = [heading(sec.title, sec.pageBreakBefore === true)];
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
    for (const l of sec.lines ?? []) out.push(bullet([l.url ? link(l.text, l.url, { color: BLACK, underlined: false }) : run(l.text)]));
    return out;
  };

  const name = t.nameUpper ? doc.name.toUpperCase() : doc.name;
  const header: Paragraph[] = [
    new Paragraph({
      alignment: align,
      spacing: { before: 0, after: twips(3) },
      children: [run(name, { bold: true, color: accent, size: t.nameSize })],
    }),
  ];
  if (doc.headline) {
    header.push(
      new Paragraph({ alignment: align, spacing: { before: 0, after: twips(2) }, children: [run(doc.headline, { color: GRAY })] }),
    );
  }
  if (doc.contact.length > 0) {
    const children: ParagraphChild[] = [];
    doc.contact.forEach((c, i) => {
      if (i > 0) children.push(run('  \u00b7  ', { color: GRAY, size: t.contactSize }));
      if (!c.url) children.push(run(c.text, { color: GRAY, size: t.contactSize }));
      else if (t.contactLinks === 'blue' && !c.url.startsWith('mailto:')) {
        children.push(link(c.text, c.url, { color: LINK_BLUE.replace('#', ''), pt: t.contactSize }));
      } else children.push(link(c.text, c.url, { color: GRAY, pt: t.contactSize, underlined: false }));
    });
    header.push(new Paragraph({ alignment: align, spacing: { before: 0, after: twips(2) }, children }));
  }
  if (t.headerRule) {
    header.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 1 } },
        spacing: { before: 80, after: 80 },
        children: [],
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
      characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', run: { color: accent, underline: {} } }],
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
