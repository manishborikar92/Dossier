'use client';
// Live HTML preview. It draws the same layout blocks the DOCX/PDF renderers use.
// Page guides are approximate; the exact page count comes from the real PDF renderer.
import { useLayoutEffect, useRef, useState } from 'react';

const pt = (n) => `${n}pt`;

export default function Preview({ model, zoom = 0.85 }) {
  const { blocks, tokens: t } = model;
  const { size: S, space: sp, accent, gray } = t;
  const ref = useRef(null);
  const [height, setHeight] = useState(0);
  const usablePx = t.usableHin * 96;
  const align = t.o.nameAlign === 'left' ? 'left' : 'center';

  // Forced page breaks become spacers that push the next block to the next page.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pbs = [...root.querySelectorAll('[data-pb]')];
    pbs.forEach((el) => { el.style.height = '0px'; });
    pbs.forEach((el) => {
      const rem = usablePx - (el.offsetTop % usablePx);
      el.style.height = `${rem >= usablePx - 1 ? 0 : rem}px`;
    });
    setHeight(root.scrollHeight);
  });

  const guides = [];
  for (let k = 1; k * usablePx < height - 4; k++) guides.push(k);

  return (
    <div
      className="sheet"
      style={{
        width: t.paper.w * 96, padding: t.margin * 96, zoom,
        fontFamily: t.font.css, fontSize: pt(S.base), lineHeight: sp.line + 0.02, color: '#000',
      }}
    >
      <div ref={ref} style={{ position: 'relative' }}>
        {blocks.map((b, i) => {
          switch (b.type) {
            case 'name': return <div key={i} style={{ fontSize: pt(S.name), fontWeight: 700, color: accent, textAlign: align, lineHeight: 1.15 }}>{b.text}</div>;
            case 'contact': return <div key={i} style={{ fontSize: pt(S.small - 1), color: gray, textAlign: align }}>{b.text}</div>;
            case 'rule': return <div key={i} style={{ borderBottom: `1pt solid ${accent}`, margin: '3pt 0' }} />;
            case 'pageBreak': return <div key={i} className="pv-pb" data-pb="1" />;
            case 'section': return (
              <div key={i} style={{ marginTop: pt(sp.sectionBefore), marginBottom: pt(sp.sectionAfter), paddingBottom: '1pt', fontSize: pt(S.section), fontWeight: 700, color: accent, borderBottom: t.o.sectionStyle === 'rule' ? `0.75pt solid ${accent}` : 'none' }}>{b.text}</div>
            );
            case 'paragraph': return <div key={i} style={{ margin: `${pt(sp.para)} 0` }}>{b.text}</div>;
            case 'labelValue': return <div key={i} style={{ margin: `${pt(sp.skill)} 0`, whiteSpace: 'pre-wrap' }}><b>{b.label}</b>{'  '}{b.value}</div>;
            case 'entryHeader': return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: pt(sp.entryBefore), marginBottom: pt(sp.entryAfter) }}>
                <span><b style={{ fontSize: pt(S.entry) }}>{b.primary}</b>{b.secondary && <span style={{ color: gray }}>{b.secondary}</span>}</span>
                {b.right && <i style={{ color: gray, fontSize: pt(S.small), whiteSpace: 'nowrap' }}>{b.right}</i>}
              </div>
            );
            case 'subline': return (
              <div key={i} style={{ fontSize: pt(S.small), color: gray, marginBottom: pt(sp.bullet * 1.5) }}>
                {b.label && <b>{b.label}</b>}<span style={{ fontStyle: b.label ? 'italic' : 'normal' }}>{b.text}</span>
              </div>
            );
            case 'bullet': return (
              <div key={i} style={{ display: 'flex', margin: `${pt(sp.bullet)} 0` }}>
                <span style={{ width: pt(24), paddingLeft: pt(10), flexShrink: 0, boxSizing: 'border-box' }}>•</span>
                <span>{b.text}</span>
              </div>
            );
            default: return null;
          }
        })}
        <div className="pv-guides noprint">
          {guides.map((k) => (
            <div key={k} style={{ position: 'absolute', left: -8, right: -8, top: k * usablePx, borderTop: '1px dashed rgba(211,51,51,.55)' }}>
              <span style={{ position: 'absolute', right: 0, top: -13, font: '10px system-ui', color: '#d33' }}>page {k + 1} starts ≈ here</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
