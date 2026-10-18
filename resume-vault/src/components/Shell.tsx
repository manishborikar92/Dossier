'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Briefcase, FileText, FolderGit2, LayoutDashboard, Menu, Settings, User, X } from 'lucide-react';
import { ToastProvider, cx } from './ui';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/career', label: 'Experience & skills', icon: Briefcase },
  { href: '/projects', label: 'Projects', icon: FolderGit2 },
  { href: '/resumes', label: 'Resumes', icon: FileText },
  { href: '/settings', label: 'Settings & backup', icon: Settings },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const isBuilder = /^\/resumes\/\d+/.test(pathname);

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={isActive(href) ? 'page' : undefined}
          className={cx(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
            isActive(href) ? 'bg-navy text-white' : 'text-ink hover:bg-navy-soft',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-60 shrink-0 border-r border-rule bg-surface lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-3 py-5">
            <div className="mb-6 px-3">
              <p className="font-serif text-xl font-semibold text-navy">Resume Vault</p>
              <p className="text-xs text-muted">Your career data, kept locally</p>
            </div>
            {nav}
            <p className="mt-auto px-3 text-xs text-muted">Data stays on this computer.</p>
          </div>
        </aside>

        <div className="border-b border-rule bg-surface lg:hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <p className="font-serif text-lg font-semibold text-navy">Resume Vault</p>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-sm"
            >
              {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
              Menu
            </button>
          </div>
          {open ? (
            <div id="mobile-nav" className="border-t border-rule px-3 py-2">
              {nav}
            </div>
          ) : null}
        </div>

        <main id="main" className={cx('min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', !isBuilder && 'mx-auto w-full max-w-5xl')}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
