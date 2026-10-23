import { notFound } from 'next/navigation';
import { HttpError } from './errors';

/** Run a loader for a page; a "not found" error from the data layer becomes the app's 404 page. */
export function orNotFound<T>(load: () => T): T {
  try {
    return load();
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}

/** Parse a numeric id from a route segment, or show the 404 page. */
export function idOrNotFound(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return n;
}
