'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Check } from '@/components/ui';
import ResumePreview from '@/features/preview/ResumePreview';

export default function PreviewPane({ ed }) {
  const { model, checks } = ed;
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState('fit');
  const [proof, setProof] = useState(true);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paperPx = model.tokens.paper.w * 96;
  const fitZoom = width ? Math.max(0.35, Math.min(1.3, (width - 48) / paperPx)) : 0.8;
  const zoom = mode === 'fit' ? fitZoom : mode;
  const step = (d) => setMode(Math.min(1.5, Math.max(0.4, Math.round((zoom + d) * 20) / 20)));
  const flagged = checks.notConfident.length;

  return (
    <div className="previewpane">
      <div className="previewbar">
        <div className="previewbar__zoom" role="group" aria-label="Zoom">
          <Button variant="ghost" size="sm" icon="minus" aria-label="Zoom out" onClick={() => step(-0.1)} />
          <span className="previewbar__pct" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" icon="plus" aria-label="Zoom in" onClick={() => step(0.1)} />
          <Button variant="ghost" size="sm" icon="fit" onClick={() => setMode('fit')} aria-pressed={mode === 'fit'}>Fit width</Button>
        </div>
        <Check label={flagged ? `Highlight unconfirmed text (${flagged})` : 'Highlight unconfirmed text'} checked={proof} onChange={setProof} />
      </div>
      <div className="canvas" ref={canvas} tabIndex={0} role="region" aria-label="Resume preview, scrollable">
        <ResumePreview model={model} zoom={zoom} proof={proof} />
      </div>
      <p className="previewpane__note">Dashed lines mark approximate page breaks. The exact page count comes from the exported PDF.</p>
    </div>
  );
}
