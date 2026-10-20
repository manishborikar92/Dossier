'use client';
import { Button, EmptyState } from '@/components/ui';

export default function Error({ error, reset }) {
  return (
    <div className="page">
      <EmptyState icon="alert" title="Something went wrong" action={<Button variant="primary" onClick={() => reset()}>Try again</Button>}>
        {error?.message || 'An unexpected error occurred. Your data on disk is safe.'}
      </EmptyState>
    </div>
  );
}
