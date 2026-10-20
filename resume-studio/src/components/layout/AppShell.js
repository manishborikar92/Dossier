'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button, Logo } from '@/components/ui';
import Sidebar from './Sidebar.js';

/** Sidebar layout for most pages; the resume editor is a full-bleed workspace with its own toolbar. */
export default function AppShell({ children }) {
  const path = usePathname();
  const workspace = path.startsWith('/resume/');
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      {workspace ? (
        <main id="main" className="workspace">{children}</main>
      ) : (
        <div className="shell">
          <header className="mobilebar">
            <Button variant="ghost" icon="menu" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} />
            <Link href="/" className="brand"><Logo size={24} /><span>Resume Studio</span></Link>
          </header>
          <Sidebar open={open} onNavigate={() => setOpen(false)} />
          {open && <button type="button" className="shell__scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
          <main id="main" className="shell__main">{children}</main>
        </div>
      )}
    </>
  );
}
