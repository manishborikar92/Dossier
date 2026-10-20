import ComposerView from '@/features/composer/ComposerView';

export const metadata = { title: 'Resume editor' };

export default async function Page({ params }) {
  const { id } = await params;
  return <ComposerView id={id} />;
}
