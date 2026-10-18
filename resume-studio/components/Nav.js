'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [['/', 'Resumes'], ['/library', 'Library'], ['/targets', 'Targets']];

export default function Nav() {
  const path = usePathname();
  const active = (href) => (href === '/' ? path === '/' || path.startsWith('/resume') || path.startsWith('/prep') : path.startsWith(href));
  return (
    <nav className="nav noprint">
      <span className="brand">Resume Studio</span>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={active(href) ? 'active' : ''}>{label}</Link>
      ))}
    </nav>
  );
}
