'use client';

import { ChevronRight, Menu as MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { cx } from '@/lib/classes';
import { useHeaderContext, type Crumb } from './HeaderContext';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  crumbs?: Crumb[];
  actions?: ReactNode;
}

export function Header({
  onOpenMobileMenu,
  crumbs: propCrumbs,
  actions: propActions,
}: HeaderProps) {
  const pathname = usePathname();
  const { crumbs: contextCrumbs, actions: contextActions } = useHeaderContext();

  const activeCrumbs = propCrumbs ?? (contextCrumbs && contextCrumbs.length > 0 ? contextCrumbs : null);
  const actions = propActions ?? contextActions ?? null;

  // Compute default breadcrumbs from pathname if page didn't specify custom ones
  const breadcrumbs: Crumb[] = useMemo(() => {
    if (activeCrumbs && activeCrumbs.length > 0) {
      return activeCrumbs;
    }

    if (pathname === '/') {
      return [{ label: 'Dashboard' }];
    }
    if (pathname === '/profile') {
      return [{ label: 'Profile' }];
    }
    if (pathname === '/career') {
      return [{ label: 'Experience & skills' }];
    }
    if (pathname === '/projects') {
      return [{ label: 'Projects' }];
    }
    if (pathname === '/projects/new') {
      return [{ label: 'Projects', href: '/projects' }, { label: 'New project' }];
    }
    if (pathname.startsWith('/projects/')) {
      return [{ label: 'Projects', href: '/projects' }, { label: 'Project details' }];
    }
    if (pathname === '/resumes') {
      return [{ label: 'Resumes' }];
    }
    if (pathname.startsWith('/resumes/')) {
      return [{ label: 'Resumes', href: '/resumes' }, { label: 'Resume editor' }];
    }
    if (pathname === '/settings') {
      return [{ label: 'Settings & backup' }];
    }

    return [{ label: 'Dashboard' }];
  }, [activeCrumbs, pathname]);

  return (
    <header className="border-line bg-surface sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 sm:px-6">
      {/* Left side: Mobile menu toggle + Breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {/* Mobile menu hamburger button (borderless) */}
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMobileMenu}
          className="text-ink-2 hover:bg-sunken -ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors lg:hidden"
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>

        {/* Breadcrumbs matching reference: 'Resumes > Manish Borikar' */}
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1 sm:gap-2 text-sm">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li
                  key={crumb.label + idx}
                  className={cx(
                    'flex items-center',
                    isLast ? 'min-w-0' : 'shrink-0 gap-1 sm:gap-2'
                  )}
                >
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-muted hover:text-ink shrink-0 font-medium transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={cx('truncate font-medium', isLast ? 'text-ink' : 'text-muted')}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast ? (
                    <ChevronRight className="text-muted/60 size-3.5 sm:size-4 shrink-0" aria-hidden />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Right side: Page action buttons (desktop only; on mobile rendered inline on page) */}
      {actions ? (
        <div className="hidden sm:flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
