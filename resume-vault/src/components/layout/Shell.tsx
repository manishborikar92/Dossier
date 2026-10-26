'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { cx } from '@/lib/classes';
import { ToastProvider } from '../ui';
import { Header } from './Header';
import { HeaderProvider } from './HeaderContext';
import { Sidebar } from './Sidebar';

const SIDEBAR_STORAGE_KEY = 'resume_vault_sidebar_collapsed';
const sidebarListeners = new Set<() => void>();

function subscribeToSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    sidebarListeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function getSidebarSnapshot(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function toggleSidebarCollapsed(current: boolean) {
  const next = !current;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
  sidebarListeners.forEach((l) => l());
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );

  const [projectCount, setProjectCount] = useState<number | undefined>(undefined);
  const [resumeCount, setResumeCount] = useState<number | undefined>(undefined);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);

  const wide = /^\/resumes\/\d+/.test(pathname);

  // Global keyboard shortcut to toggle sidebar: Ctrl+Shift+S (or Cmd+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleSidebarCollapsed(sidebarCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed]);

  // Fetch counts for sidebar badges
  useEffect(() => {
    let cancelled = false;

    api.resumes
      .list()
      .then((resumes) => {
        if (!cancelled) {
          setResumeCount(resumes.length);
          const outdated = resumes.filter((r) => r.outdatedCount > 0).length;
          setNeedsReviewCount(outdated);
        }
      })
      .catch(() => undefined);

    api.library
      .list('projects')
      .then((projects) => {
        if (!cancelled) setProjectCount(projects.length);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <HeaderProvider>
      <ToastProvider>
        {/* Skip to content link */}
        <a
          href="#main"
          className="bg-brand text-white sr-only rounded-lg px-4 py-2 font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80]"
        >
          Skip to content
        </a>

        {/* Outer Layout Container - Sidebar on the left, Header & Main on the right */}
        <div className="min-h-dvh bg-canvas text-ink lg:flex">
          {/* Left Sidebar (fixed Settings at bottom, 'Resume Vault' at top) */}
          <Sidebar
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => toggleSidebarCollapsed(sidebarCollapsed)}
            projectCount={projectCount}
            resumeCount={resumeCount}
            needsReviewCount={needsReviewCount}
          />

          {/* Right Column: Top Header + Main Content */}
          <div className="flex-1 min-w-0 flex flex-col min-h-dvh">
            <Header onOpenMobileMenu={() => setMobileOpen(true)} />

            <main id="main" className="flex-1 min-w-0">
              <div className={cx('min-w-0 p-4 sm:p-6 lg:p-8', !wide && 'mx-auto max-w-[1240px]')}>
                {children}
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </HeaderProvider>
  );
}
