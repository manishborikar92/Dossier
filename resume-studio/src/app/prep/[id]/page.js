import PrepView from '@/features/prep/PrepView';

export const metadata = { title: 'Interview prep' };

export default async function Page({ params }) {
  const { id } = await params;
  return <PrepView id={id} />;
}
