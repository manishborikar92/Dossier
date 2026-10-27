import type { LucideIcon } from 'lucide-react';
import { Briefcase, FileText, FolderGit2, LayoutDashboard, Settings, User } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const MAIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Library',
    items: [
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/career', label: 'Experience & skills', icon: Briefcase },
      { href: '/projects', label: 'Projects', icon: FolderGit2 },
    ],
  },
  {
    label: 'Resumes',
    items: [{ href: '/resumes', label: 'Resumes', icon: FileText }],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  href: '/settings',
  label: 'Settings & backup',
  icon: Settings,
};

export const SIDEBAR_STORAGE_KEY = 'dossier_sidebar_collapsed';
export const SIDEBAR_COOKIE_NAME = SIDEBAR_STORAGE_KEY;

export const isNavActive = (pathname: string, href: string, exact = false): boolean => {
  if (exact || href === '/') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};
