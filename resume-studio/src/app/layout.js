import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/400-italic.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/ui.css';
import '@/styles/shell.css';
import '@/styles/features.css';
import Providers from '@/components/providers/Providers';
import AppShell from '@/components/layout/AppShell';
import { THEME_INIT_SCRIPT } from '@/components/providers/ThemeProvider';

export const metadata = {
  title: { default: 'Resume Studio', template: '%s | Resume Studio' },
  description: 'Keep your career facts in one place and build tailored, honest resumes in minutes.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#DCE0E7' }, { media: '(prefers-color-scheme: dark)', color: '#0F1217' }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
