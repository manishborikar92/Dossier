'use client';

import { FileCheck2, Menu as MenuIcon, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/classes';
import { ToastProvider } from '../ui';
import { NAV_GROUPS, isNavActive } from './nav';

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-2 py-1">
      <span className="bg-brand flex size-9 items-center justify-center rounded-xl text-white shadow-xs">
        <FileCheck2 className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="text-ink block text-[15px] font-semibold tracking-tight">Resume Vault</span>
        <span className="text-muted block text-xs">Career data, kept locally</span>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label ? <p className="text-muted mb-1.5 px-3 text-[11px] font-semibold tracking-wider uppercase">{group.label}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                    )}
                  >
                    <Icon className={cx('size-[18px]', active ? 'text-brand' : 'text-muted')} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function LocalNote({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="border-line bg-sunken rounded-xl border p-3.5">
      <p className="text-ink flex items-center gap-2 text-[13px] font-semibold">
        <ShieldCheck className="text-ok size-4" aria-hidden />
        Stored on this computer
      </p>
      <p className="text-muted mt-1 text-xs leading-relaxed">Nothing is sent to any server. Download a backup now and then.</p>
      <Link href="/settings" onClick={onNavigate} className="link mt-2 inline-block text-xs font-medium">
        Back up your data
      </Link>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const wide = /^\/resumes\/\d+/.test(pathname);

  useEffect(() => {
    const el = drawer.current;
    if (!el) return;
    if (drawerOpen && !el.open) el.showModal();
    if (!drawerOpen && el.open) el.close();
  }, [drawerOpen]);

  return (
    <ToastProvider>
      <a
        href="#main"
        className="bg-surface text-ink sr-only rounded-lg px-4 py-2 font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80]"
      >
        Skip to content
      </a>

      <div className="min-h-dvh lg:flex">
        <aside className="border-line bg-surface hidden w-64 shrink-0 border-r lg:block">
          <div className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-3 py-5">
            <Brand />
            <NavList pathname={pathname} />
            <div className="mt-auto">
              <LocalNote />
            </div>
          </div>
        </aside>

        <header className="border-line bg-surface sticky top-0 z-30 flex items-center justify-between border-b px-4 py-2.5 lg:hidden">
          <Brand />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="border-line-strong text-ink-2 hover:bg-sunken inline-flex size-10 items-center justify-center rounded-lg border"
          >
            <MenuIcon className="size-5" aria-hidden />
          </button>
        </header>

        <dialog
          ref={drawer}
          aria-label="Menu"
          onCancel={(e) => {
            e.preventDefault();
            setDrawerOpen(false);
          }}
          onClick={(e) => {
            if (e.target === drawer.current) setDrawerOpen(false);
          }}
          className="bg-surface m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] border-0 p-0 shadow-xl lg:hidden"
        >
          {drawerOpen ? (
            <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
              <div className="flex items-center justify-between">
                <Brand onNavigate={() => setDrawerOpen(false)} />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="text-muted hover:bg-sunken rounded-lg p-2"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
              <div className="mt-auto">
                <LocalNote onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          ) : null}
        </dialog>

        <main id="main" className={cx('min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-9', !wide && 'mx-auto w-full max-w-[1120px]')}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
