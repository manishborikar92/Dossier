'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/client/cx';
import { Icon, Logo, MeterBar } from '@/components/ui';
import { useStore } from '@/components/providers/StoreProvider';
import { libraryStats } from '@/lib/domain/stats';
import { plural } from '@/lib/client/format';
import ThemeToggle from './ThemeToggle.js';
import SaveIndicator from './SaveIndicator.js';

const NAV = [
  { href: '/', label: 'Resumes', icon: 'file', match: (p) => p === '/' || p.startsWith('/prep') },
  { href: '/library', label: 'Library', icon: 'book', match: (p) => p.startsWith('/library') },
  { href: '/targets', label: 'Targets', icon: 'target', match: (p) => p.startsWith('/targets') },
];

export default function Sidebar({ open, onNavigate }) {
  const path = usePathname();
  const { data } = useStore();
  const stats = data ? libraryStats(data) : null;
  return (
    <aside className={cx('sidebar', open && 'is-open')} aria-label="Primary">
      <Link href="/" className="brand" onClick={onNavigate}><Logo /><span>Resume Studio</span></Link>
      <nav>
        <ul className="nav">
          {NAV.map((n) => {
            const active = n.match(path);
            return (
              <li key={n.href}>
                <Link href={n.href} className={cx('nav__link', active && 'is-active')} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                  <Icon name={n.icon} size={18} />
                  <span>{n.label}</span>
                  {n.href === '/library' && stats?.review > 0 && <span className="nav__badge" title="Bullets waiting for your review">{stats.review}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {stats && (
        <Link href="/library?tab=review" className="side-honesty" onClick={onNavigate}>
          <span className="side-honesty__title">Library honesty</span>
          <MeterBar label={`${stats.confident} confident, ${stats.review} to review, ${stats.excluded} excluded`} segments={[{ tone: 'ok', value: stats.confident }, { tone: 'hl', value: stats.review }, { tone: 'no', value: stats.excluded }]} />
          <span className="side-honesty__text">{stats.review ? `${plural(stats.review, 'bullet')} to review` : 'Everything is reviewed'}</span>
        </Link>
      )}
      <div className="sidebar__foot"><SaveIndicator /><ThemeToggle /></div>
    </aside>
  );
}
