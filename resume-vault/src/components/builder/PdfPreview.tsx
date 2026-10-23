'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useEffect, useRef, useState } from 'react';
import { resumeFileUrl } from '@/lib/api';
import { cx } from '@/lib/classes';
import { Notice, Spinner } from '../ui';

export interface PreviewInfo {
  pages: number;
  unsupportedChars: string;
}

type Zoom = 'fit' | '1' | '1.25' | '1.5';
const ZOOMS: { value: Zoom; label: string }[] = [
  { value: 'fit', label: 'Fit width' },
  { value: '1', label: '100%' },
  { value: '1.25', label: '125%' },
  { value: '1.5', label: '150%' },
];

/** CSS pixels per PDF point at 100% zoom. */
const PX_PER_POINT = 96 / 72;

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  }
  return pdfjs;
}

/** One PDF page drawn onto a canvas at the width it is asked for. */
function PdfPage({
  pdf,
  pageNumber,
  total,
  width,
  zoom,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  total: number;
  width: number;
  zoom: Zoom;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      const natural = page.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? Math.max(width, 240) / natural.width : Number(zoom) * PX_PER_POINT;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * ratio });
      const el = canvas.current;
      if (!el || cancelled) return;
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      el.style.width = `${Math.floor(viewport.width / ratio)}px`;
      el.style.height = `${Math.floor(viewport.height / ratio)}px`;
      const context = el.getContext('2d');
      if (!context) return;
      task = page.render({ canvasContext: context, viewport });
      await task.promise;
    })().catch(() => {
      /* a cancelled render is expected when the preview refreshes */
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, zoom]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`Resume preview, page ${pageNumber} of ${total}`}
      className="shadow-pop mx-auto block max-w-none bg-white"
    />
  );
}

/** Draws the exported PDF itself, so the preview and the download are always the same document. */
export function PdfPreview({
  resumeId,
  refreshKey,
  onInfo,
}: {
  resumeId: number;
  refreshKey: number;
  onInfo?: (info: PreviewInfo | null) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const scroller = useRef<HTMLDivElement>(null);

  // Track the width available for "fit width".
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width) - 32));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch and parse the PDF whenever the resume changes.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(resumeFileUrl(resumeId, 'pdf', { cacheKey: refreshKey }), { cache: 'no-store' });
        if (!res.ok) {
          let message = 'The preview could not be generated.';
          try {
            message = ((await res.json()) as { error?: string }).error ?? message;
          } catch {
            /* keep the default message */
          }
          throw new Error(message);
        }
        const data = new Uint8Array(await res.arrayBuffer());
        const unsupportedChars = decodeURIComponent(res.headers.get('X-Unsupported-Chars') ?? '');
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdf(doc);
        const next = { pages: doc.numPages, unsupportedChars };
        setInfo(next);
        setError(null);
        setLoadedKey(refreshKey);
        onInfo?.(next);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'The preview could not be generated.');
        setLoadedKey(refreshKey);
        onInfo?.(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resumeId, refreshKey, onInfo]);

  // Release the previous document when a newer one replaces it.
  useEffect(
    () => () => {
      void pdf?.destroy();
    },
    [pdf],
  );

  const loading = loadedKey !== refreshKey;
  return (
    <div className="border-line bg-surface shadow-card flex h-full flex-col overflow-hidden rounded-xl border">
      <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-ink text-sm font-semibold">Live preview</h2>
          {info ? (
            <span className="bg-brand-soft text-brand rounded-md px-1.5 py-0.5 text-xs font-medium">
              {info.pages} {info.pages === 1 ? 'page' : 'pages'}
            </span>
          ) : null}
          {loading ? <Spinner label="Updating" /> : null}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="preview-zoom" className="sr-only">
            Zoom
          </label>
          <select
            id="preview-zoom"
            value={zoom}
            onChange={(e) => setZoom(e.target.value as Zoom)}
            className="border-line-strong bg-surface text-ink-2 rounded-md border py-1 pr-7 pl-2 text-xs"
          >
            {ZOOMS.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          <a
            href={resumeFileUrl(resumeId, 'pdf')}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-brand inline-flex items-center gap-1 text-xs font-medium"
            title="Open the PDF in a new tab (print from there)"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Open
          </a>
        </div>
      </div>

      {info?.unsupportedChars ? (
        <Notice tone="warn" className="mx-3 mt-3 text-xs">
          These characters cannot be drawn by the PDF fonts and were replaced: {info.unsupportedChars}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="bad" alert className="mx-3 mt-3 text-xs">
          {error}
        </Notice>
      ) : null}

      <div
        ref={scroller}
        className={cx('bg-desk flex-1 overflow-auto p-4 lg:max-h-[calc(100dvh-11.5rem)]', !pdf && 'min-h-[50vh]')}
        data-testid="preview-scroller"
      >
        {pdf ? (
          <div className="flex w-max min-w-full flex-col gap-4">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i} pdf={pdf} pageNumber={i + 1} total={pdf.numPages} width={width} zoom={zoom} />
            ))}
          </div>
        ) : (
          <div className="text-muted flex h-full min-h-[40vh] items-center justify-center text-sm">
            {loading ? 'Preparing preview\u2026' : <AlertTriangle className="size-5" aria-label="No preview available" />}
          </div>
        )}
      </div>
    </div>
  );
}
