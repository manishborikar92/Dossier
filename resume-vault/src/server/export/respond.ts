import { allDocText } from '@/lib/resumeDoc';
import { findUnsupportedChars } from '@/lib/text';
import { getDb } from '../db';
import { docForResume, getResumeRecord, saveVersion } from '../resumes';
import { intParam } from '../http';
import { renderResumeDocx } from './docx';
import { renderResumePdf } from './pdf';

const slug = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Build a PDF or DOCX response for a resume (or one of its saved versions).
 * Downloads of the current state also save a version, so what was sent can be reproduced later.
 */
export async function exportResponse(req: Request, resumeId: number, format: 'pdf' | 'docx'): Promise<Response> {
  const url = new URL(req.url);
  const versionParam = url.searchParams.get('version');
  const versionId = versionParam ? intParam(versionParam, 'version id') : undefined;
  const download = url.searchParams.get('download') === '1';

  const db = getDb();
  const resume = getResumeRecord(db, resumeId);
  if (download && versionId === undefined) {
    saveVersion(db, resumeId, { reason: 'export', label: `Exported as ${format.toUpperCase()}` });
  }
  const doc = docForResume(db, resumeId, versionId);
  const fileName = `${[slug(doc.name), slug(resume.name)].filter(Boolean).join('-') || 'resume'}.${format}`;

  const headers: Record<string, string> = {
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
    'Cache-Control': 'no-store',
    'X-Unverified-Count': String(doc.unverifiedBullets.length),
    'X-Unsupported-Chars': encodeURIComponent(findUnsupportedChars(allDocText(doc)).join('')),
  };

  if (format === 'pdf') {
    const { buffer, pages } = await renderResumePdf(doc);
    return new Response(new Uint8Array(buffer), {
      headers: { ...headers, 'Content-Type': 'application/pdf', 'X-Page-Count': String(pages) },
    });
  }
  const buffer = await renderResumeDocx(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      ...headers,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });
}
