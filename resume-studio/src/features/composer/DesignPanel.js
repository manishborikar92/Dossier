'use client';
import { cx } from '@/lib/client/cx';
import { Check, Field, Icon, Segmented } from '@/components/ui';
import { FONTS, PAPERS, SPACING, TEMPLATES } from '@/lib/domain/templates';
import { toggleIn } from '@/lib/client/format';

const withCurrent = (list, v) => (list.includes(v) ? list : [...list, v].sort((a, b) => a - b));
const ACCENTS = [
  { value: '#14182A', name: 'Ink' }, { value: '#1F3864', name: 'Navy' }, { value: '#0F766E', name: 'Teal' },
  { value: '#7A3E9D', name: 'Plum' }, { value: '#B3261E', name: 'Red' }, { value: '#2B2B2B', name: 'Charcoal' },
];

export default function DesignPanel({ ed }) {
  const { resume, options: o, opt } = ed;
  return (
    <div className="panel panel--form">
      <section className="dsec" aria-labelledby="d-tpl">
        <h3 id="d-tpl">Template</h3>
        <div className="tpls">
          {Object.entries(TEMPLATES).map(([k, t]) => (
            <button key={k} type="button" className={cx('tpl', resume.template === k && 'is-on')} aria-pressed={resume.template === k} onClick={() => ed.applyTemplate(k)}>
              <span className={cx('tpl__swatch', t.defaults.fontFamily === 'serif' && 'is-serif')} data-align={t.defaults.nameAlign} style={{ '--a': t.defaults.accent }} aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="tpl__name">{t.label}{resume.template === k && <Icon name="check" size={14} />}</span>
              <small>{t.note}</small>
            </button>
          ))}
        </div>
        <p className="muted small">Every template is a single column with standard fonts, so applicant tracking systems read it correctly.</p>
      </section>

      <section className="dsec" aria-labelledby="d-page">
        <h3 id="d-page">Page</h3>
        <div className="form__row">
          <Field label="Paper"><select className="select" value={o.paper} onChange={(e) => opt('paper', e.target.value)}>{Object.entries(PAPERS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></Field>
          <Field label="Margins (inches)"><select className="select" value={o.margin} onChange={(e) => opt('margin', Number(e.target.value))}>{withCurrent([0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1], Number(o.margin)).map((v) => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Font"><select className="select" value={o.fontFamily} onChange={(e) => opt('fontFamily', e.target.value)}>{Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></Field>
          <Field label="Font size (pt)"><select className="select" value={o.fontSize} onChange={(e) => opt('fontSize', Number(e.target.value))}>{withCurrent([8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12], Number(o.fontSize)).map((v) => <option key={v}>{v}</option>)}</select></Field>
        </div>
        <Field label="Spacing"><Segmented label="Spacing" value={o.spacing} onChange={(v) => opt('spacing', v)} options={Object.keys(SPACING).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))} /></Field>
      </section>

      <section className="dsec" aria-labelledby="d-style">
        <h3 id="d-style">Style</h3>
        <div className="field">
          <span className="field__label" id="accent-l">Accent colour</span>
          <div className="swatches" role="group" aria-labelledby="accent-l">
            {ACCENTS.map((a) => (
              <button key={a.value} type="button" className={cx('swatch', o.accent.toLowerCase() === a.value.toLowerCase() && 'is-on')} style={{ '--c': a.value }} aria-label={a.name} aria-pressed={o.accent.toLowerCase() === a.value.toLowerCase()} onClick={() => opt('accent', a.value)} />
            ))}
            <label className="swatch swatch--custom"><span className="sr-only">Custom colour</span><input type="color" value={o.accent} onChange={(e) => opt('accent', e.target.value)} /></label>
          </div>
        </div>
        <Field label="Name alignment"><Segmented label="Name alignment" value={o.nameAlign} onChange={(v) => opt('nameAlign', v)} options={[{ value: 'center', label: 'Centered' }, { value: 'left', label: 'Left' }]} /></Field>
        <Field label="Section headings"><Segmented label="Section headings" value={o.sectionStyle} onChange={(v) => opt('sectionStyle', v)} options={[{ value: 'rule', label: 'Underlined' }, { value: 'plain', label: 'Plain' }]} /></Field>
        <Field label="Contact separator"><select className="select" value={o.contactSeparator} onChange={(e) => opt('contactSeparator', e.target.value)}>{['·', '|', '•', '/', '–'].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </section>

      <section className="dsec" aria-labelledby="d-content">
        <h3 id="d-content">Details</h3>
        <Check label="Name in capitals" checked={!!o.nameUpper} onChange={(c) => opt('nameUpper', c)} />
        <Check label="Short links" hint="For example in/yourname instead of linkedin.com/in/yourname" checked={!!o.shortLinks} onChange={(c) => opt('shortLinks', c)} />
        <Check label="Show project links" checked={!!o.showProjectLinks} onChange={(c) => opt('showProjectLinks', c)} />
        <Check label="Start Projects on a new page" checked={!!o.projectsOnNewPage} onChange={(c) => opt('projectsOnNewPage', c)} />
        <fieldset className="fieldset fieldset--flat">
          <legend>Label these project types</legend>
          <div className="row wrap">
            {['college', 'freelance', 'personal', 'company'].map((t) => (
              <Check key={t} label={t[0].toUpperCase() + t.slice(1)} checked={(o.projectTypeLabels || []).includes(t)} onChange={() => opt('projectTypeLabels', toggleIn(o.projectTypeLabels || [], t))} />
            ))}
          </div>
        </fieldset>
      </section>

      <section className="dsec" aria-labelledby="d-file">
        <h3 id="d-file">Download</h3>
        <Field label="File name" hint="Without the extension. Leave empty to use your name.">
          <input className="input" value={o.fileName} placeholder={`${ed.data.profile.name.replace(/\s+/g, '-')}-Resume`} onChange={(e) => opt('fileName', e.target.value)} />
        </Field>
      </section>
    </div>
  );
}
