// DOCX renderer. ATS-safe: real paragraphs and bullets only - no tables, text boxes or images.
import { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle, TabStopType } from 'docx';

const hex = (c) => c.replace('#', '').toUpperCase();

export async function renderDocx(model, meta = {}) {
  const { blocks, tokens: t } = model;
  const font = t.font.docx;
  const hp = (x) => Math.round(x * 2);      // points -> half-points
  const tw = (x) => Math.round(x * 20);     // points -> twips
  const accent = hex(t.accent);
  const GRAY = '444444';
  const sp = t.space;
  const S = t.size;
  const tabPos = Math.round(t.contentWpt * 20);
  const run = (text, o = {}) => new TextRun({ text, font, size: hp(o.size || S.base), bold: o.bold, italics: o.italics, color: o.color || '000000' });
  const align = t.o.nameAlign === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER;

  let pendingBreak = false;
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'name':
        out.push(new Paragraph({ alignment: align, spacing: { before: 0, after: tw(3) }, children: [run(b.text, { size: S.name, bold: true, color: accent })] }));
        break;
      case 'contact':
        out.push(new Paragraph({ alignment: align, spacing: { before: 0, after: tw(2) }, children: [run(b.text, { size: S.small - 1, color: GRAY })] }));
        break;
      case 'rule':
        out.push(new Paragraph({ spacing: { before: tw(4), after: tw(4) }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 1 } }, children: [] }));
        break;
      case 'pageBreak':
        pendingBreak = true;
        break;
      case 'section':
        out.push(new Paragraph({
          pageBreakBefore: pendingBreak, keepNext: true,
          spacing: { before: tw(pendingBreak ? 0 : sp.sectionBefore), after: tw(sp.sectionAfter) },
          border: t.o.sectionStyle === 'rule' ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } } : undefined,
          children: [run(b.text, { size: S.section, bold: true, color: accent })],
        }));
        pendingBreak = false;
        break;
      case 'paragraph':
        out.push(new Paragraph({ spacing: { before: tw(sp.para), after: tw(sp.para) }, children: [run(b.text)] }));
        break;
      case 'labelValue':
        out.push(new Paragraph({ spacing: { before: tw(sp.skill), after: tw(sp.skill) }, children: [run(`${b.label}  `, { bold: true }), run(b.value)] }));
        break;
      case 'entryHeader':
        out.push(new Paragraph({
          keepNext: true, tabStops: [{ type: TabStopType.RIGHT, position: tabPos }],
          spacing: { before: tw(sp.entryBefore), after: tw(sp.entryAfter) },
          children: [
            run(b.primary, { size: S.entry, bold: true }),
            ...(b.secondary ? [run(b.secondary, { color: GRAY })] : []),
            ...(b.right ? [run(`\t${b.right}`, { size: S.small, italics: true, color: GRAY })] : []),
          ],
        }));
        break;
      case 'subline':
        out.push(new Paragraph({
          keepNext: true, spacing: { before: 0, after: tw(sp.bullet * 1.5) },
          children: b.label
            ? [run(b.label, { size: S.small, bold: true, color: GRAY }), run(b.text, { size: S.small, italics: true, color: GRAY })]
            : [run(b.text, { size: S.small, color: GRAY })],
        }));
        break;
      case 'bullet':
        out.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { before: tw(sp.bullet), after: tw(sp.bullet) }, children: [run(b.text)] }));
        break;
      default:
        break;
    }
  }

  const doc = new Document({
    creator: meta.author || '', title: meta.title || 'Resume',
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
    styles: { default: { document: { run: { font, size: hp(S.base) } } } },
    sections: [{
      properties: { page: { size: { width: Math.round(t.paper.w * 1440), height: Math.round(t.paper.h * 1440) }, margin: { top: Math.round(t.margin * 1440), right: Math.round(t.margin * 1440), bottom: Math.round(t.margin * 1440), left: Math.round(t.margin * 1440) } } },
      children: out,
    }],
  });
  return Packer.toBuffer(doc);
}
