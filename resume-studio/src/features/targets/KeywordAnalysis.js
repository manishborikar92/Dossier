import { Icon, MeterBar } from '@/components/ui';

const REASON = {
  available: { tone: 'warn', text: 'in your library, not selected' },
  'needs-review': { tone: 'hl', text: 'needs your review' },
  excluded: { tone: 'no', text: 'excluded by you' },
  absent: { tone: 'bad', text: 'not in your library' },
};

/** Coverage of a job description's keywords by an auto-tailored resume, with the reason each gap exists. */
export default function KeywordAnalysis({ plan, data }) {
  const { report, selection } = plan;
  return (
    <div className="analysis">
      <div className="analysis__score">
        <div className="analysis__pct" aria-label={`${report.pct} percent keyword coverage`}>{report.pct}<span>%</span></div>
        <div className="analysis__meter">
          <strong>Keyword coverage</strong>
          <MeterBar label={`${report.pct}% of keywords covered`} segments={[{ tone: 'ok', value: report.pct }, { tone: 'none', value: 100 - report.pct }]} />
          <small>With an auto-tailored resume built from your confident items.</small>
        </div>
      </div>

      <h3 className="analysis__h">Covered</h3>
      <ul className="kws">
        {report.matched.map((k) => <li key={k.key} className="kw kw--ok"><Icon name="check" size={13} />{k.label}</li>)}
        {!report.matched.length && <li className="muted">None yet.</li>}
      </ul>

      <h3 className="analysis__h">Not on the tailored resume</h3>
      <ul className="kws">
        {report.missing.map((k) => (
          <li key={k.key} className={`kw kw--${REASON[k.where].tone}`}><b>{k.label}</b><small>{REASON[k.where].text}</small></li>
        ))}
        {!report.missing.length && <li className="muted">Nothing missing.</li>}
      </ul>
      <p className="muted">Be honest about the gaps: only add a skill if you could answer a basic question about it. Learning it first is a perfectly good plan.</p>

      <h3 className="analysis__h">Projects it would feature</h3>
      <ol className="plain-list">
        {selection.projects.map((p) => <li key={p.id}>{data.projects.find((x) => x.id === p.id)?.title}</li>)}
      </ol>
      {report.skippedProjects > 0 && (
        <p className="muted">{report.skippedProjects} active projects were skipped because none of their bullets are marked Confident yet. Review them in the Library if you want them considered.</p>
      )}
    </div>
  );
}
