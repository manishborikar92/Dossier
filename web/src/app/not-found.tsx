import { Compass } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, buttonClass } from '@/components/ui';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg pt-16">
      <EmptyState
        icon={Compass}
        title="We couldn’t find that page"
        action={
          <>
            <Link href="/" className={buttonClass('primary')}>
              Go to the dashboard
            </Link>
            <Link href="/resumes" className={buttonClass('secondary')}>
              Open resumes
            </Link>
          </>
        }
      >
        The link may be out of date, or the item may have been deleted.
      </EmptyState>
    </div>
  );
}
