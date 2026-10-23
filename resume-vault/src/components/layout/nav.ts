import type { LucideIcon } from 'lucide-react';
import { Briefcase, FileText, FolderGit2, LayoutDashboard, Settings, User } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Library',
    items: [
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/career', label: 'Experience & skills', icon: Briefcase },
      { href: '/projects', label: 'Projects', icon: FolderGit2 },
    ],
  },
  { label: 'Resumes', items: [{ href: '/resumes', label: 'Resumes', icon: FileText }] },
  { label: 'System', items: [{ href: '/settings', label: 'Settings & backup', icon: Settings }] },
];

export const isNavActive = (pathname: string, href: string): boolean =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
