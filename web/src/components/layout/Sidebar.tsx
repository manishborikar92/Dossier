'use client';

import { FolderArchive, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cx } from '@/lib/classes';
import { MAIN_NAV_GROUPS, SETTINGS_NAV_ITEM, isNavActive } from './nav';

export function SidebarIcon({ isCollapsed = false, className = 'h-4 w-4' }: { isCollapsed?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="4" />
      {isCollapsed ? <line x1="8" y1="7" x2="8" y2="17" /> : <line x1="16" y1="7" x2="16" y2="17" />}
    </svg>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  projectCount?: number;
  resumeCount?: number;
  needsReviewCount?: number;
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
  projectCount,
  resumeCount,
  needsReviewCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);

  // Sync mobile dialog open state
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (mobileOpen && !el.open) el.showModal();
    if (!mobileOpen && el.open) el.close();
  }, [mobileOpen]);

  const getBadgeInfo = (href: string): { text: string | number | null; tone: 'neutral' | 'warn' } => {
    if (href === '/projects' && typeof projectCount === 'number') {
      return { text: projectCount, tone: 'neutral' };
    }
    if (href === '/resumes') {
      if (needsReviewCount > 0) {
        return { text: `${needsReviewCount} review`, tone: 'warn' };
      }
      if (typeof resumeCount === 'number') {
        return { text: resumeCount, tone: 'neutral' };
      }
    }
    return { text: null, tone: 'neutral' };
  };

  // Mobile Drawer Navigation List (Always expanded in mobile dialog)
  const renderMobileNavList = () => (
    <div className="flex flex-col gap-5">
      {MAIN_NAV_GROUPS.map((group, groupIdx) => (
        <div key={group.label ?? groupIdx}>
          {group.label ? (
            <p className="text-muted/80 mb-1.5 px-3 text-[11px] font-semibold tracking-wider uppercase">{group.label}</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const active = isNavActive(pathname, href, exact);
              const { text: badgeText, tone: badgeTone } = getBadgeInfo(href);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onCloseMobile}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={cx('size-4.5 shrink-0', active ? 'text-brand' : 'text-muted')} aria-hidden />
                      <span className="truncate">{label}</span>
                    </div>

                    {badgeText !== null ? (
                      <span
                        className={cx(
                          'ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                          badgeTone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-sunken text-muted border border-line',
                        )}
                      >
                        {badgeText}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR - Matches reference images with butter-smooth transition */}
      <aside
        aria-label="Sidebar navigation"
        className={cx(
          'border-line bg-surface hidden shrink-0 border-r lg:flex lg:flex-col lg:h-dvh lg:sticky lg:top-0 z-30 transition-[width] duration-300 ease-in-out overflow-x-hidden',
          collapsed ? 'w-14' : 'w-64',
        )}
      >
        {/* TOP HEADER ROW (height: 56px / h-14, padding: px-2 when collapsed, px-3 when expanded) */}
        <div
          className={cx(
            'border-line flex h-14 shrink-0 items-center justify-between border-b overflow-hidden transition-[padding] duration-300 ease-in-out',
            collapsed ? 'px-2' : 'px-3',
          )}
        >
          {/* Left item: Logo + Title (or Toggle in collapsed state) */}
          <div className="flex items-center min-w-0">
            <div className="relative group/topbtn flex size-10 shrink-0 items-center justify-center">
              {collapsed ? (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Expand sidebar (Ctrl+Shift+S)"
                  aria-label="Toggle sidebar (Ctrl+Shift+S)"
                  className="flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                >
                  {/* Default state: Logo asset */}
                  <span className="bg-brand flex size-8 items-center justify-center rounded-lg text-white shadow-xs group-hover/topbtn:hidden group-focus-visible/topbtn:hidden transition-transform">
                    <FolderArchive className="size-4.5" aria-hidden />
                  </span>

                  {/* Hover/focus state: SidebarIcon with divider line on left */}
                  <span className="hidden items-center justify-center text-ink-2 group-hover/topbtn:flex group-focus-visible/topbtn:flex">
                    <SidebarIcon isCollapsed={true} className="size-5" />
                  </span>
                </button>
              ) : (
                <Link
                  href="/"
                  aria-label="Dossier home"
                  className="flex size-10 items-center justify-center rounded-lg transition-opacity hover:opacity-90"
                >
                  <span className="bg-brand flex size-8 items-center justify-center rounded-lg text-white shadow-xs">
                    <FolderArchive className="size-4.5" aria-hidden />
                  </span>
                </Link>
              )}
            </div>

            {/* Brand Title: 'Dossier' with smooth slide & fade */}
            <div
              className={cx(
                'flex items-center min-w-0 overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out',
                collapsed ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none' : 'max-w-[140px] opacity-100 translate-x-0 pl-1',
              )}
            >
              <Link href="/" className="text-ink font-semibold text-[15px] tracking-tight truncate whitespace-nowrap">
                Dossier
              </Link>
            </div>
          </div>

          {/* Right item when expanded: Toggle button (smooth slide & fade) */}
          <div
            className={cx(
              'shrink-0 overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out',
              collapsed
                ? 'max-w-0 opacity-0 pointer-events-none translate-x-2'
                : 'max-w-[40px] opacity-100 pointer-events-auto translate-x-0',
            )}
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              tabIndex={collapsed ? -1 : 0}
              title="Collapse sidebar (Ctrl+Shift+S)"
              aria-label="Toggle sidebar (Ctrl+Shift+S)"
              className="text-ink-2 hover:text-ink hover:bg-sunken flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
            >
              <SidebarIcon isCollapsed={false} className="size-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION CONTAINER */}
        <nav aria-label="Main" className="flex flex-col flex-1 min-h-0 justify-between">
          {/* MIDDLE NAVIGATION CONTAINER (px-2 when collapsed, px-3 when expanded) */}
          <div
            className={cx(
              'flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 transition-[padding] duration-300 ease-in-out',
              collapsed ? 'px-2' : 'px-3',
            )}
          >
            <div className="flex flex-col gap-3">
              {MAIN_NAV_GROUPS.map((group, groupIdx) => (
                <div key={group.label ?? groupIdx} className="flex flex-col">
                  {/* Category label container with smooth height & opacity transition */}
                  {group.label ? (
                    <div
                      className={cx(
                        'overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out',
                        collapsed ? 'max-h-0 opacity-0 mb-0' : 'max-h-6 opacity-100 mb-1.5',
                      )}
                    >
                      <p className="text-muted/80 px-3 text-[11px] font-semibold tracking-wider uppercase truncate">{group.label}</p>
                    </div>
                  ) : null}

                  {/* Subtle divider in collapsed mode between groups */}
                  {groupIdx > 0 ? (
                    <div
                      className={cx(
                        'border-t border-line transition-[max-height,opacity,margin,width] duration-300 ease-in-out overflow-hidden',
                        collapsed ? 'max-h-4 opacity-100 my-1.5 w-8 mx-1' : 'max-h-0 opacity-0 my-0 w-0 mx-0',
                      )}
                      aria-hidden
                    />
                  ) : null}

                  <ul className="flex flex-col gap-1 w-full">
                    {group.items.map(({ href, label, icon: Icon, exact }) => {
                      const active = isNavActive(pathname, href, exact);
                      const { text: badgeText, tone: badgeTone } = getBadgeInfo(href);
                      const navLabel = badgeText !== null ? `${label} (${badgeText})` : label;

                      return (
                        <li key={href} className={cx('w-full flex', collapsed ? 'justify-start' : '')}>
                          <Link
                            href={href}
                            aria-label={navLabel}
                            title={collapsed ? navLabel : undefined}
                            aria-current={active ? 'page' : undefined}
                            className={cx(
                              'relative flex h-10 items-center rounded-lg transition-colors overflow-hidden',
                              collapsed ? 'w-10 shrink-0' : 'w-full',
                              active ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                            )}
                          >
                            {/* Left Icon Container: size-10 (40px) */}
                            <div className="relative size-10 shrink-0 flex items-center justify-center">
                              <Icon className={cx('size-5 shrink-0 transition-colors', active ? 'text-brand' : 'text-muted')} aria-hidden />
                              {/* Collapsed indicator dot */}
                              {badgeText !== null ? (
                                <span
                                  className={cx(
                                    'absolute top-2 right-2 size-2 rounded-full transition-opacity duration-300',
                                    collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none',
                                    badgeTone === 'warn' ? 'bg-warn' : 'bg-brand',
                                  )}
                                  aria-hidden
                                />
                              ) : null}
                            </div>

                            {/* Label & Expanded Badge Pill with smooth slide & fade */}
                            <div
                              className={cx(
                                'flex items-center justify-between min-w-0 flex-1 overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out',
                                collapsed
                                  ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                                  : 'max-w-[190px] opacity-100 translate-x-0 pr-2.5',
                              )}
                            >
                              <span className="truncate text-sm font-medium whitespace-nowrap">{label}</span>
                              {badgeText !== null ? (
                                <span
                                  className={cx(
                                    'ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums whitespace-nowrap',
                                    badgeTone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-sunken text-muted border border-line',
                                  )}
                                >
                                  {badgeText}
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM FIXED SETTINGS (p-2 when collapsed, p-3 when expanded) */}
          <div
            className={cx(
              'shrink-0 border-t border-line overflow-hidden transition-[padding] duration-300 ease-in-out',
              collapsed ? 'p-2' : 'p-3',
            )}
          >
            <Link
              href={SETTINGS_NAV_ITEM.href}
              aria-label={SETTINGS_NAV_ITEM.label}
              title={collapsed ? SETTINGS_NAV_ITEM.label : undefined}
              aria-current={isNavActive(pathname, SETTINGS_NAV_ITEM.href) ? 'page' : undefined}
              className={cx(
                'flex h-10 items-center rounded-lg transition-colors overflow-hidden',
                collapsed ? 'w-10 shrink-0' : 'w-full',
                isNavActive(pathname, SETTINGS_NAV_ITEM.href)
                  ? 'bg-brand-soft text-brand font-semibold'
                  : 'text-ink-2 hover:bg-sunken hover:text-ink',
              )}
            >
              {/* Left Icon Container: size-10 (40px) */}
              <div className="size-10 shrink-0 flex items-center justify-center">
                <Settings
                  className={cx(
                    'size-5 shrink-0 transition-colors',
                    isNavActive(pathname, SETTINGS_NAV_ITEM.href) ? 'text-brand' : 'text-muted',
                  )}
                  aria-hidden
                />
              </div>

              {/* Label with smooth slide & fade */}
              <div
                className={cx(
                  'flex items-center min-w-0 overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out',
                  collapsed ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none' : 'max-w-[190px] opacity-100 translate-x-0 pr-2.5',
                )}
              >
                <span className="truncate text-sm font-medium whitespace-nowrap">{SETTINGS_NAV_ITEM.label}</span>
              </div>
            </Link>
          </div>
        </nav>
      </aside>

      {/* MOBILE DRAWER */}
      <dialog
        ref={drawerRef}
        aria-label="Navigation menu"
        onCancel={(e) => {
          e.preventDefault();
          onCloseMobile();
        }}
        onClick={(e) => {
          if (e.target === drawerRef.current) onCloseMobile();
        }}
        className="bg-surface m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] border-r border-line p-0 shadow-2xl backdrop:bg-black/50 lg:hidden"
      >
        {mobileOpen ? (
          <div className="flex h-full flex-col">
            {/* Top row in mobile drawer with Logo + Brand */}
            <div className="border-line flex h-14 items-center justify-between border-b px-4">
              <Link href="/" onClick={onCloseMobile} className="flex items-center gap-2.5">
                <span className="bg-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-xs">
                  <FolderArchive className="size-4.5" aria-hidden />
                </span>
                <span className="text-ink text-base font-semibold tracking-tight">Dossier</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={onCloseMobile}
                className="text-muted hover:bg-sunken hover:text-ink -mr-1 rounded-lg p-1.5"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {/* Mobile navigation landmark covering main links and settings */}
            <nav aria-label="Main" className="flex flex-col flex-1 min-h-0 justify-between">
              {/* Middle navigation area */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">{renderMobileNavList()}</div>

              {/* Bottom fixed Settings */}
              <div className="shrink-0 border-t border-line p-3">
                <Link
                  href={SETTINGS_NAV_ITEM.href}
                  onClick={onCloseMobile}
                  aria-label={SETTINGS_NAV_ITEM.label}
                  aria-current={isNavActive(pathname, SETTINGS_NAV_ITEM.href) ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isNavActive(pathname, SETTINGS_NAV_ITEM.href)
                      ? 'bg-brand-soft text-brand font-semibold'
                      : 'text-ink-2 hover:bg-sunken hover:text-ink',
                  )}
                >
                  <Settings
                    className={cx('size-4.5 shrink-0', isNavActive(pathname, SETTINGS_NAV_ITEM.href) ? 'text-brand' : 'text-muted')}
                    aria-hidden
                  />
                  <span className="truncate">{SETTINGS_NAV_ITEM.label}</span>
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
