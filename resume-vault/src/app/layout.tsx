import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cookies } from 'next/headers';
import { Shell } from '@/components/layout/Shell';
import { SIDEBAR_COOKIE_NAME } from '@/components/layout/nav';

// Every page reads the local database, so nothing here may be prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Resume Vault', template: '%s · Resume Vault' },
  description: 'Keep your career information in one place and build tailored resumes from it.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value === 'true';

  return (
    <html lang="en">
      <body>
        <Shell initialCollapsed={initialCollapsed}>{children}</Shell>
      </body>
    </html>
  );
}
