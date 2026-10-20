import { Button, Icon } from '@/components/ui';

/** A real sequence: each step unlocks the next, so numbering is appropriate here. */
export default function GettingStarted({ stats, data, onNewResume }) {
  const steps = [
    { done: stats.review === 0, title: 'Review your library', text: `${stats.review} bullet${stats.review === 1 ? '' : 's'} came from your knowledge base and need a quick check. Mark what you could explain in an interview as Confident.`, cta: <Button size="sm" href="/library?tab=review">Open the review queue</Button> },
    { done: data.targets.some((t) => t.jd.trim()), title: 'Add a job target', text: 'Paste a job description to see which keywords your library covers and which it does not.', cta: <Button size="sm" href="/targets">Go to targets</Button> },
    { done: data.resumes.some((r) => r.targetId), title: 'Create a tailored resume', text: 'One click picks your best confident items and fits your page target.', cta: <Button size="sm" onClick={onNewResume}>New resume</Button> },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <section className="steps" aria-labelledby="steps-h">
      <h2 id="steps-h">Getting set up</h2>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'is-done' : undefined}>
            <span className="steps__n" aria-hidden="true">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
            <div className="steps__body">
              <strong>{s.title}{s.done && <span className="sr-only"> (done)</span>}</strong>
              {!s.done && <p>{s.text}</p>}
              {!s.done && s.cta}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
