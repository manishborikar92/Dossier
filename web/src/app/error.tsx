'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button, EmptyState, buttonClass } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg pt-16">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        action={
          <>
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
            <Link href="/" className={buttonClass('secondary')}>
              Go to the dashboard
            </Link>
          </>
        }
      >
        This page could not be loaded. Your data is safe. If it keeps happening, check the terminal where the app is running for details
        {error.digest ? ` (reference ${error.digest})` : ''}.
      </EmptyState>
    </div>
  );
}
