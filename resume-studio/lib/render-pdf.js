// PDF renderer (pdfkit). Produces a real text PDF (selectable / ATS-parsable) using built-in
// Helvetica or Times, so nothing needs to be installed and nothing is downloaded.
import PDFDocument from 'pdfkit';

// Built-in PDF fonts only cover Western characters; swap anything else for a safe fallback.
const safe = (s) => String(s ?? '')
  .replace(/\u2192/g, '->')
  .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u2122\u20ac]/g, '?');

/** Renders the PDF and also reports the exact page count. */
export function renderPdfInfo(model, meta = {}) {
  const { blocks, tokens: t } = model;
  return new Promise((resolve, reject) => {
    const m = t.margin * 72;
    const doc = new PDFDocument({
      size: [t.pageWpt, t.pageHpt],
      margins: { top: m, bottom: m, left: m, right: m },
      info: { Title: meta.title || 'Resume', Author: meta.author || '' },
      bufferPages: true,
    });
    let pages = 1;
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pages }));
    doc.on('error', reject);

    const L = m, W = t.contentWpt, R = L + W, bottom = t.pageHpt - m;
    const F = t.font.pdf, S = t.size, sp = t.space;
    const gap = (size) => Math.max(0, (sp.line - 1.15) * size);
    const ensure = (h) => { if (doc.y + h > bottom) doc.addPage(); };
    const center = t.o.nameAlign === 'left' ? 'left' : 'center';
    const BLACK = '#000000';

    for (const b of blocks) {
      switch (b.type) {
        case 'name':
          doc.font(F.b).fontSize(S.name).fillColor(t.accent).text(safe(b.text), L, doc.y, { width: W, align: center });
          doc.y += 2;
          break;
        case 'contact':
          doc.font(F.r).fontSize(S.small - 1).fillColor(t.gray).text(safe(b.text), L, doc.y, { width: W, align: center });
          break;
        case 'rule': {
          const y = doc.y + 3;
          doc.save().moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(t.accent).stroke().restore();
          doc.y = y + 3;
          break;
        }
        case 'pageBreak':
          doc.addPage();
          break;
        case 'section': {
          ensure(S.section * 2 + 45);
          if (doc.y > m + 1) doc.y += sp.sectionBefore;
          doc.font(F.b).fontSize(S.section).fillColor(t.accent).text(safe(b.text), L, doc.y, { width: W });
          if (t.o.sectionStyle === 'rule') {
            const y = doc.y + 1;
            doc.save().moveTo(L, y).lineTo(R, y).lineWidth(0.75).strokeColor(t.accent).stroke().restore();
            doc.y = y + sp.sectionAfter;
          } else doc.y += sp.sectionAfter;
          break;
        }
        case 'paragraph':
          doc.y += sp.para / 2;
          doc.font(F.r).fontSize(S.base).fillColor(BLACK).text(safe(b.text), L, doc.y, { width: W, lineGap: gap(S.base) });
          doc.y += sp.para;
          break;
        case 'labelValue':
          ensure(S.base * 1.6);
          doc.y += sp.skill / 2;
          doc.fillColor(BLACK).font(F.b).fontSize(S.base).text(safe(`${b.label}  `), L, doc.y, { continued: true, width: W });
          doc.font(F.r).text(safe(b.value), { width: W, lineGap: gap(S.base) });
          doc.y += sp.skill / 2;
          break;
        case 'entryHeader': {
          ensure(S.entry * 2 + S.base * 2.8 + sp.entryBefore);
          doc.y += sp.entryBefore;
          const y0 = doc.y;
          let rw = 0;
          if (b.right) {
            doc.font(F.i).fontSize(S.small);
            rw = doc.widthOfString(safe(b.right));
            doc.fillColor(t.gray).text(safe(b.right), R - rw, y0 + (S.entry - S.small) * 0.8, { lineBreak: false });
            doc.y = y0;
          }
          doc.font(F.b).fontSize(S.entry).fillColor(BLACK).text(safe(b.primary), L, y0, { width: W - rw - 10, continued: !!b.secondary });
          if (b.secondary) doc.font(F.r).fontSize(S.base).fillColor(t.gray).text(safe(b.secondary), { continued: false });
          doc.x = L;
          doc.y += sp.entryAfter;
          break;
        }
        case 'subline':
          ensure(S.small * 2.4);
          doc.fillColor(t.gray).fontSize(S.small);
          if (b.label) {
            doc.font(F.b).text(safe(b.label), L, doc.y, { continued: true, width: W });
            doc.font(F.i).text(safe(b.text), { width: W });
          } else doc.font(F.r).text(safe(b.text), L, doc.y, { width: W });
          doc.y += sp.bullet * 1.5;
          break;
        case 'bullet': {
          ensure(S.base * 1.8);
          const y0 = doc.y + sp.bullet;
          doc.font(F.r).fontSize(S.base).fillColor(BLACK).text('\u2022', L + 10, y0, { lineBreak: false });
          doc.text(safe(b.text), L + 24, y0, { width: W - 24, lineGap: gap(S.base) });
          doc.x = L;
          doc.y += sp.bullet;
          break;
        }
        default:
          break;
      }
    }
    pages = doc.bufferedPageRange().count;
    doc.end();
  });
}

export const renderPdf = async (model, meta = {}) => (await renderPdfInfo(model, meta)).buffer;
