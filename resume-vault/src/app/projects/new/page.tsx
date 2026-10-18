import { ProjectForm } from '@/components/ProjectForm';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'New project' };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="Add a project" />
      <ProjectForm initial={null} />
    </>
  );
}
