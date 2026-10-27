import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => '/projects',
  useSearchParams: () => new URLSearchParams(),
}));

import { Header } from '@/components/layout/Header';
import { HeaderProvider } from '@/components/layout/HeaderContext';
import { Sidebar, SidebarIcon } from '@/components/layout/Sidebar';

const renderWithProviders = (el: ReactElement) =>
  renderToStaticMarkup(<HeaderProvider>{el}</HeaderProvider>);

describe('Header & Sidebar Layout (Matching Reference Layout)', () => {
  it('renders Header with breadcrumbs and top-right actions without theme, quick-search or sqlite badges', () => {
    const out = renderWithProviders(
      <Header
        onOpenMobileMenu={() => undefined}
        crumbs={[{ label: 'Resumes', href: '/resumes' }, { label: 'Manish Borikar' }]}
        actions={<button type="button">Custom Action</button>}
      />,
    );

    // Breadcrumbs matching reference: 'Resumes > Manish Borikar' with compact mobile spacing
    expect(out).toContain('Resumes');
    expect(out).toContain('Manish Borikar');
    expect(out).toContain('Custom Action');
    expect(out).toContain('gap-1 sm:gap-2');
    expect(out).toContain('size-3.5 sm:size-4');

    // Completely removed features:
    expect(out).not.toContain('Quick search');
    expect(out).not.toContain('Local SQLite');
    expect(out).not.toContain('Switch to');
    expect(out).not.toContain('Resume Vault home');
    expect(out).not.toContain('border-line-strong');
  });

  it('ensures Save profile, New resume, Download backup, Archive, Save changes, and Add project are removed from header actions', () => {
    const out = renderWithProviders(
      <Header
        onOpenMobileMenu={() => undefined}
        crumbs={[{ label: 'Profile' }]}
      />,
    );
    expect(out).not.toContain('Save profile');
    expect(out).not.toContain('New resume');
    expect(out).not.toContain('Download backup');
    expect(out).not.toContain('Archive');
    expect(out).not.toContain('Save changes');
    expect(out).not.toContain('Add project');
  });

  it('renders Sidebar in expanded state with Logo, "Resume Vault", categorized nav groups, toggle button, and fixed bottom Settings', () => {
    const out = renderWithProviders(
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => undefined}
        collapsed={false}
        onToggleCollapse={() => undefined}
        projectCount={35}
        resumeCount={2}
      />,
    );

    // Top Header row in sidebar: Logo and 'Resume Vault'
    expect(out).toContain('Resume Vault');

    // Sidebar collapse toggle control and keyboard shortcut hint
    expect(out).toContain('Toggle sidebar (Ctrl+Shift+S)');
    expect(out).toContain('Ctrl+Shift+S');

    // Categorized groups
    expect(out).toContain('Main');
    expect(out).toContain('Library');
    expect(out).toContain('Resumes');
    expect(out).toContain('Dashboard');
    expect(out).toContain('Profile');
    expect(out).toContain('Experience &amp; skills');
    expect(out).toContain('Projects');

    // Badge counts
    expect(out).toContain('35');
    expect(out).toContain('2');

    // Fixed bottom Settings matching reference
    expect(out).toContain('Settings &amp; backup');

    // Completely removed features (including floating tooltips):
    expect(out).not.toContain('Local SQLite');
    expect(out).not.toContain('Quick search');
    expect(out).not.toContain('bg-neutral-900');
  });

  it('renders Sidebar in collapsed state with toggle button, icon-only rail, and fixed bottom Settings', () => {
    const out = renderWithProviders(
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => undefined}
        collapsed={true}
        onToggleCollapse={() => undefined}
        projectCount={35}
        resumeCount={2}
      />,
    );

    // Collapsed rail width
    expect(out).toContain('w-14');

    // Top slot has toggle button with tooltip and shortcut
    expect(out).toContain('Toggle sidebar (Ctrl+Shift+S)');
    expect(out).toContain('Ctrl+Shift+S');

    // Nav icons present, floating tooltips removed
    expect(out).toContain('Dashboard');
    expect(out).toContain('Profile');
    expect(out).toContain('Projects');
    expect(out).toContain('Settings &amp; backup');
    expect(out).not.toContain('bg-neutral-900');

    // Does not render expanded group label headers in collapsed rail
    expect(out).not.toContain('<p className="text-muted/80 mb-1.5');
  });

  it('renders SidebarIcon with correct divider line in collapsed and expanded states', () => {
    const collapsedSvg = renderToStaticMarkup(<SidebarIcon isCollapsed={true} />);
    expect(collapsedSvg).toContain('x1="8"');
    expect(collapsedSvg).toContain('y1="7"');

    const expandedSvg = renderToStaticMarkup(<SidebarIcon isCollapsed={false} />);
    expect(expandedSvg).toContain('x1="16"');
    expect(expandedSvg).toContain('y1="7"');
  });

  it('keeps navigation accessible landmark name "Main" across expanded and collapsed states', () => {
    const expanded = renderWithProviders(
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => undefined}
        collapsed={false}
        onToggleCollapse={() => undefined}
      />,
    );
    expect(expanded).toContain('aria-label="Main"');

    const collapsed = renderWithProviders(
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => undefined}
        collapsed={true}
        onToggleCollapse={() => undefined}
      />,
    );
    expect(collapsed).toContain('aria-label="Main"');
  });
});
