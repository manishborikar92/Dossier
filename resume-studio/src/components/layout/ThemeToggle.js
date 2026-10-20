'use client';
import { Button } from '@/components/ui';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function ThemeToggle({ variant = 'ghost' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return <Button variant={variant} size="sm" icon={dark ? 'sun' : 'moon'} onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'} />;
}
