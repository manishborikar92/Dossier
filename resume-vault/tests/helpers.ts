import { openDb, type DB } from '@/server/db';
import { seedSample } from '@/server/sample';
import { getResume } from '@/server/resumes';
import type { ResumeItem } from '@/lib/types';

export function freshDb(withSample = true): DB {
  const db = openDb(':memory:');
  if (withSample) seedSample(db);
  return db;
}

export function itemsOf(db: DB, resumeId: number, section?: string): ResumeItem[] {
  const items = getResume(db, resumeId).items;
  return section ? items.filter((i) => i.section === section) : items;
}

/** Extract page count, text and link targets from a PDF using pdf.js (no external tools needed). */
export async function inspectPdf(buffer: Uint8Array): Promise<{ pages: number; text: string; links: string[]; lastLines: string[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, verbosity: 0 });
  const pdf = await task.promise;
  let text = '';
  const links: string[] = [];
  const lastLines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
    for (const a of await page.getAnnotations()) if (a.url) links.push(a.url as string);
    // The text on the lowest line of the page (used to check that headings are never stranded at a page bottom).
    const placed = content.items
      .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && it.str.trim() !== '')
      .map((it) => ({ str: it.str, y: it.transform[5], x: it.transform[4] }));
    const lowest = Math.min(...placed.map((p) => p.y));
    lastLines.push(placed.filter((p) => Math.abs(p.y - lowest) < 3).sort((a, b) => a.x - b.x).map((p) => p.str).join(' '));
  }
  const pages = pdf.numPages;
  await pdf.destroy();
  return { pages, text, links, lastLines };
}
