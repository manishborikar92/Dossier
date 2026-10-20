import DashboardView from '@/features/dashboard/DashboardView';

export const metadata = { title: 'Resumes' };

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  return <DashboardView openNew={sp?.new === '1'} />;
}
