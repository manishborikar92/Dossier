import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cookies } from 'next/headers';
import { Shell } from '@/components/layout/Shell';
import { SIDEBAR_COOKIE_NAME } from '@/components/layout/nav';

// Every page reads the local database, so nothing here may be prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Dossier', template: '%s · Dossier' },
  description: 'A local-first career library and tailored resume engine.',
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
