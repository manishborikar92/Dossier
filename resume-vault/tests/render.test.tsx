import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// The components use Next's router hooks; give them harmless stand-ins for server-side rendering.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { CareerManager } from '@/components/career/CareerManager';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { ProjectsManager } from '@/components/projects/ProjectsManager';
import { ResumesManager } from '@/components/resumes/ResumesManager';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ToastProvider } from '@/components/ui';
import { ContentTab } from '@/components/builder/ContentTab';
import { ItemEditor } from '@/components/builder/ItemEditor';
import { MatchTab } from '@/components/builder/MatchTab';
import { SetupTab } from '@/components/builder/SetupTab';
import { VersionsTab } from '@/components/builder/VersionsTab';
import type { BuilderLibrary } from '@/components/builder/helpers';
import { getProfile, listEntities, updateEntity } from '@/server/library';
import { createResume, getResume, listResumes, listVersions, saveVersion } from '@/server/resumes';
import type { Certification, Education, Experience, Project, Skill } from '@/lib/types';
import { freshDb } from './helpers';

const html = (el: ReactElement) => renderToStaticMarkup(<ToastProvider>{el}</ToastProvider>);
const mutate = async () => true;

function setup() {
  const db = freshDb();
  const library: BuilderLibrary = {
    summaries: db.prepare('SELECT id, label, text FROM summaries ORDER BY sort, id').all() as BuilderLibrary['summaries'],
    experiences: listEntities<Experience>(db, 'experiences'),
    projects: listEntities<Project>(db, 'projects'),
    education: listEntities<Education>(db, 'education'),
    certifications: listEntities<Certification>(db, 'certifications'),
    skills: listEntities<Skill>(db, 'skills'),
  };
  return { db, library };
}

describe('screens render without errors', () => {
  it('renders the profile editor with the saved profile', () => {
    const { db } = setup();
    const out = html(<ProfileEditor initial={getProfile(db)} />);
    expect(out).toContain('Alex Sample');
    expect(out).toContain('github.com/alex-sample');
    expect(out).toContain('Summary variants');
    expect(out).toContain('Header preview');
  });

  it('renders every tab of the experience and skills page, and its empty states', () => {
    const { db, library } = setup();
    for (const tab of ['experience', 'education', 'skills', 'certifications'] as const) {
      const out = html(
        <CareerManager
          initialTab={tab}
          experiences={library.experiences}
          education={library.education}
          skills={library.skills}
          certifications={library.certifications}
        />,
      );
      expect(out).toContain(`id="panel-${tab}"`);
    }
    const first = html(
      <CareerManager initialTab="experience" experiences={library.experiences} education={[]} skills={[]} certifications={[]} />,
    );
    expect(first).toContain('Software Developer');
    expect(first).toContain('Jan 2024');
    expect(html(<CareerManager initialTab="skills" experiences={[]} education={[]} skills={[]} certifications={[]} />)).toContain(
      'No skills yet',
    );
    expect(db).toBeTruthy();
  });

  it('renders the project list, its empty state and the project form (new and existing)', () => {
    const { library } = setup();
    const list = html(<ProjectsManager initial={library.projects} />);
    expect(list).toContain('Sample Task Tracker');
    expect(list).not.toContain('Sample Command-Line Tool'); // archived projects are hidden by default
    expect(html(<ProjectsManager initial={[]} />)).toContain('Your project library is empty');
    expect(html(<ProjectForm initial={null} />)).toContain('Add project');
    const edit = html(<ProjectForm initial={library.projects[0]} />);
    expect(edit).toContain('Sample Task Tracker');
    expect(edit).toContain('Resume bullets');
    expect(edit).toContain('Archive');
  });

  it('renders the resume list and the settings page', () => {
    const { db } = setup();
    createResume(db, { name: 'Listed', targetTitle: 'Dev', targetCompany: 'Acme', template: 'classic', jdText: '', preselect: 'top' });
    const out = html(<ResumesManager initial={listResumes(db)} canCreate defaultTemplate="classic" />);
    expect(out).toContain('Listed');
    expect(out).toContain('Dev at Acme');
    expect(html(<ResumesManager initial={[]} canCreate={false} defaultTemplate="classic" />)).toContain('Add your name on the');
    const settings = html(
      <SettingsPanel
        defaults={{ defaultPageSize: 'A4', defaultTemplate: 'classic' }}
        databasePath="/x/vault.db"
        backupsPath="/x/backups"
        counts={[{ label: 'projects', value: 4 }]}
      />,
    );
    expect(settings).toContain('Download backup');
    expect(settings).toContain('/x/vault.db');
  });
});

describe('resume builder renders', () => {
  it('renders the content tab with every section, and flags library changes', () => {
    const { db, library } = setup();
    const { resume, items } = createResume(db, {
      name: 'B',
      targetTitle: '',
      targetCompany: '',
      template: 'classic',
      jdText: '',
      preselect: 'top',
    });
    let out = html(<ContentTab resume={resume} items={items} library={library} mutate={mutate} />);
    for (const label of [
      'Header: Alex Sample',
      'Professional summary',
      'Technical skills',
      'Professional experience',
      'Key projects',
      'Education',
      'Certifications',
      'Leadership &amp; involvement',
    ]) {
      expect(out).toContain(label);
    }
    expect(out).not.toContain('Library changed');

    const lib = listEntities<Experience>(db, 'experiences')[0];
    updateEntity(db, 'experiences', lib.id, { ...lib, title: 'Lead Developer' });
    const after = getResume(db, resume.id);
    out = html(<ContentTab resume={after.resume} items={after.items} library={library} mutate={mutate} />);
    expect(out).toContain('Library changed');
  });

  it('shows unverified bullets and a final-status notice', () => {
    const { db, library } = setup();
    const exp = listEntities<Experience>(db, 'experiences')[0];
    updateEntity(db, 'experiences', exp.id, { ...exp, bullets: [{ text: 'An imported claim.', verified: false }] });
    const { resume, items } = createResume(db, {
      name: 'B',
      targetTitle: '',
      targetCompany: '',
      template: 'classic',
      jdText: '',
      preselect: 'top',
    });
    const finalResume = { ...resume, status: 'final' as const };
    const out = html(<ContentTab resume={finalResume} items={items} library={library} mutate={mutate} />);
    expect(out).toContain('1 unverified');
    expect(out).toContain('marked <strong>final</strong>');
  });

  it('renders an editor for every kind of item', () => {
    const { db } = setup();
    const { items } = createResume(db, {
      name: 'B',
      targetTitle: '',
      targetCompany: '',
      template: 'classic',
      jdText: '',
      preselect: 'top',
    });
    const expectations: Record<string, string[]> = {
      header: ['Full name', 'Show on this resume', 'Links'],
      summary: ['Summary'],
      skills: ['Skill', 'Category'],
      experience: ['Organization', 'Bullet 1', 'Show bullet 1 on this resume'],
      leadership: ['Organization', 'Description'],
      projects: ['Technology line', 'Show link 1 on this resume', 'Bullet 1'],
      education: ['Degree', 'Institution'],
      certifications: ['Issuer', 'Link'],
    };
    for (const [section, labels] of Object.entries(expectations)) {
      const item = items.find((i) => i.section === section);
      expect(item, `a ${section} item exists`).toBeTruthy();
      const out = html(<ItemEditor item={item!} onSave={async () => undefined} onCancel={() => undefined} />);
      for (const label of labels) expect(out, `${section} editor shows "${label}"`).toContain(label);
      expect(out).toContain('Save changes');
    }
  });

  it('renders the setup, versions and match tabs', () => {
    const { db } = setup();
    const { resume } = createResume(db, {
      name: 'B',
      targetTitle: 'Dev',
      targetCompany: '',
      template: 'minimal',
      jdText: 'We need React and Node.js.',
      preselect: 'top',
    });
    saveVersion(db, resume.id, { label: 'First send' });
    const current = getResume(db, resume.id).resume;

    const setupOut = html(<SetupTab resume={current} mutate={mutate} />);
    for (const label of ['Details', 'Template', 'Accent colour', 'Sections', 'Page size', 'Minimal']) expect(setupOut).toContain(label);

    const versionsOut = html(<VersionsTab resume={current} versions={listVersions(db, resume.id)} mutate={mutate} />);
    expect(versionsOut).toContain('Version 1');
    expect(versionsOut).toContain('First send');
    expect(versionsOut).toContain(`/api/resumes/${resume.id}/pdf?version=`);
    expect(html(<VersionsTab resume={current} versions={[]} mutate={mutate} />)).toContain('No versions yet');

    const matchOut = html(<MatchTab resume={current} mutate={mutate} />);
    expect(matchOut).toContain('Job description');
    expect(matchOut).toContain('We need React and Node.js.');
  });
});
