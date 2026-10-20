import { Button, EmptyState } from '@/components/ui';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="page">
      <EmptyState icon="search" title="That page does not exist" action={<Button variant="primary" href="/">Back to your resumes</Button>}>
        Check the address, or go back to the resume list.
      </EmptyState>
    </div>
  );
}
