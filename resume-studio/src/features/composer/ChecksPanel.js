'use client';
import { useState } from 'react';
import { Button, Field, Icon, Notice, StatusBadge } from '@/components/ui';
import { useToast } from '@/components/providers/ToastProvider';
import { plural } from '@/lib/client/format';

const Row = ({ ok, children }) => <li className={ok ? 'is-ok' : 'is-warn'}><Icon name={ok ? 'check' : 'alert'} size={15} />{children}</li>;

export default function ChecksPanel({ ed }) {
  const { pages, options: o, checks } = ed;
  const toast = useToast();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const target = o.targetPages;
  const within = pages != null && pages <= target;

  const fit = async () => {
    setBusy(true);
    try {
      const r = await ed.fit();
      if (!r) { setMsg({ ok: false, text: 'Could not measure the layout.' }); return; }
      const text = r.fitted
        ? (r.step === 0 ? `Already fits in ${plural(r.pages, 'page')}.` : `Fits in ${plural(r.pages, 'page')} after tightening spacing, margins and type.`)
        : `Still ${r.pages} pages at the tightest setting. Remove a project or a few bullets.`;
      setMsg({ ok: r.fitted, text });
      toast({ tone: r.fitted ? 'ok' : 'warn', title: r.fitted ? 'Fitted to your page target' : 'Could not fit the page target', description: text });
    } finally { setBusy(false); }
  };

  return (
    <div className="panel panel--form">
      <section className="dsec" aria-labelledby="c-len">
        <h3 id="c-len">Length</h3>
        <div className="bigstat">
          <div className="bigstat__n" aria-live="polite">{pages ?? '…'}</div>
          <div>
            <strong>{pages == null ? 'Counting pages' : pages === 1 ? 'page' : 'pages'}</strong>
            <small>exact, from the PDF renderer</small>
          </div>
        </div>
        <Field label="Page target">
          <select className="select" value={target} onChange={(e) => ed.opt('targetPages', Number(e.target.value))}>
            <option value={1}>1 page</option><option value={2}>2 pages</option><option value={3}>3 pages</option>
          </select>
        </Field>
        {pages != null && <Notice tone={within ? 'ok' : 'warn'}>{within ? `Within your ${plural(target, 'page')} target.` : `Over your ${plural(target, 'page')} target.`}</Notice>}
        <Button icon="fit" loading={busy} onClick={fit}>Fit to {plural(target, 'page')}</Button>
        {msg && <p className={`fitmsg ${msg.ok ? 'is-ok' : 'is-warn'}`} role="status">{msg.text}</p>}
        <p className="muted small">Fitting only adjusts spacing, margins and type size. It never deletes content.</p>
      </section>

      <section className="dsec" aria-labelledby="c-hon">
        <h3 id="c-hon">Is everything confirmed?</h3>
        {checks.notConfident.length > 0 ? (
          <Notice tone="warn" title={`${plural(checks.notConfident.length, 'item')} on this resume ${checks.notConfident.length === 1 ? 'is' : 'are'} not marked Confident`}>
            <ul className="plain-list">{checks.notConfident.slice(0, 6).map((i) => <li key={i.id}><StatusBadge status={i.status} /> {i.text.slice(0, 70)}{i.text.length > 70 ? '…' : ''}</li>)}</ul>
            <span>Review them in the library, or untick them here. They are highlighted in the preview.</span>
          </Notice>
        ) : <Notice tone="ok">Every item on this resume is marked Confident.</Notice>}
        <Button size="sm" icon="pencil" href="/library?tab=review">Open the review queue</Button>
      </section>

      <section className="dsec" aria-labelledby="c-ats">
        <h3 id="c-ats">Readable by recruiting software</h3>
        <ul className="checklist-ok">
          <Row ok={checks.hasEmail}>{checks.hasEmail ? 'Email is on the contact line' : 'Email is missing from the contact line'}</Row>
          <Row ok={checks.hasPhone}>{checks.hasPhone ? 'Phone is on the contact line' : 'Phone is missing from the contact line'}</Row>
          <Row ok={!checks.longBullets}>{checks.longBullets ? `${plural(checks.longBullets, 'bullet')} over 280 characters; consider trimming` : 'Bullet lengths are easy to read'}</Row>
          <Row ok={checks.projects <= 4}>{checks.projects > 4 ? 'More than 4 projects: depth beats quantity' : plural(checks.projects, 'project') + ' selected'}</Row>
          <Row ok>Single column, standard fonts, no tables, text boxes or images</Row>
        </ul>
      </section>
    </div>
  );
}
