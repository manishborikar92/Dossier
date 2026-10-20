import LibraryView from '@/features/library/LibraryView';

export const metadata = { title: 'Library' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  return <LibraryView initialTab={sp?.tab} />;
}
