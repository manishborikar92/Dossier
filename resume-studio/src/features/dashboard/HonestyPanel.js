import { Button, MeterBar } from '@/components/ui';
import { plural } from '@/lib/client/format';

/** The state of your library at a glance: how much you can stand behind versus how much is still marked up. */
export default function HonestyPanel({ stats }) {
  return (
    <section className="honesty" aria-labelledby="honesty-h">
      <div className="honesty__main">
        <h2 id="honesty-h">What your resumes can use</h2>
        <p>
          {plural(stats.confident, 'bullet')} you can stand behind.{' '}
          {stats.review ? `${stats.review} more ${stats.review === 1 ? 'is' : 'are'} waiting for your review and will not be used until you confirm ${stats.review === 1 ? 'it' : 'them'}.` : 'Everything has been reviewed.'}
        </p>
        <MeterBar
          label={`${stats.confident} confident, ${stats.review} need review, ${stats.excluded} excluded`}
          segments={[{ tone: 'ok', value: stats.confident }, { tone: 'hl', value: stats.review }, { tone: 'no', value: stats.excluded }]}
        />
        <ul className="legend">
          <li><i className="dot dot--ok" />{stats.confident} confident</li>
          <li><i className="dot dot--hl" />{stats.review} need review</li>
          <li><i className="dot dot--no" />{stats.excluded} excluded</li>
        </ul>
      </div>
      {stats.review > 0 && <Button href="/library?tab=review" icon="pencil">Review bullets</Button>}
    </section>
  );
}
