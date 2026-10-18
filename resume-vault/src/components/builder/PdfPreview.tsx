'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Spinner } from '../ui';

export interface PreviewInfo {
  pages: number;
  unsupportedChars: string;
}

interface Result {
  key: number;
  url: string | null;
  info: PreviewInfo | null;
  error: string | null;
}

/** Shows the real exported PDF, so the preview and the download are the same document. */
export function PdfPreview({ resumeId, refreshKey, onInfo }: { resumeId: number; refreshKey: number; onInfo?: (info: PreviewInfo | null) => void }) {
  const [result, setResult] = useState<Result | null>(null);
  const currentUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}/pdf?ts=${refreshKey}`, { cache: 'no-store' });
        if (!res.ok) {
          let message = 'The preview could not be generated.';
          try {
            message = ((await res.json()) as { error?: string }).error ?? message;
          } catch {
            /* keep default */
          }
          if (!cancelled) {
            setResult({ key: refreshKey, url: currentUrl.current, info: null, error: message });
            onInfo?.(null);
          }
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = url;
        const info: PreviewInfo = {
          pages: Number(res.headers.get('X-Page-Count') ?? '1'),
          unsupportedChars: decodeURIComponent(res.headers.get('X-Unsupported-Chars') ?? ''),
        };
        setResult({ key: refreshKey, url, info, error: null });
        onInfo?.(info);
      } catch {
        if (!cancelled) setResult({ key: refreshKey, url: currentUrl.current, info: null, error: 'Could not reach the app.' });
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resumeId, refreshKey, onInfo]);

  useEffect(
    () => () => {
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    },
    [],
  );

  const loading = !result || result.key !== refreshKey;
  return (
    <div className="flex h-full flex-col rounded-lg bg-desk p-3">
      <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink">Live preview</span>
        <span className="flex flex-wrap items-center gap-2">
          {loading ? <Spinner label="Updating" /> : null}
          {result?.info ? (
            <span className="rounded bg-surface px-2 py-0.5 font-medium">
              {result.info.pages} {result.info.pages === 1 ? 'page' : 'pages'}
            </span>
          ) : null}
        </span>
      </div>
      {result?.info?.unsupportedChars ? (
        <p role="status" className="mb-2 flex items-start gap-1.5 rounded bg-warn-bg px-2 py-1.5 text-xs text-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>These characters cannot be drawn by the PDF fonts and were replaced: {result.info.unsupportedChars}</span>
        </p>
      ) : null}
      {result?.error ? (
        <p role="alert" className="mb-2 rounded bg-bad-bg px-2 py-1.5 text-xs font-medium text-bad">
          {result.error}
        </p>
      ) : null}
      {result?.url ? (
        <iframe title="Resume preview (PDF)" src={`${result.url}#toolbar=0&navpanes=0&view=FitH`} className="min-h-[70vh] w-full flex-1 rounded border-0 bg-white shadow-md lg:min-h-[calc(100vh-11rem)]" />
      ) : (
        <div className="flex min-h-[40vh] flex-1 items-center justify-center rounded bg-white/60 text-sm text-muted">{loading ? 'Preparing preview\u2026' : 'No preview available.'}</div>
      )}
      <p className="mt-2 text-[11px] text-muted">If the preview does not show on your device, use Open PDF above.</p>
    </div>
  );
}
