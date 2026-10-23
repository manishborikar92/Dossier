import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/layout/Shell';

// Every page reads the local database, so nothing here may be prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Resume Vault', template: '%s · Resume Vault' },
  description: 'Keep your career information in one place and build tailored resumes from it.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
