'use client';

import { useState } from 'react';
import type { Certification, Education, Experience, Skill } from '@/lib/types';
import { Badge, Tabs, tabId, tabPanelId } from '../ui';
import { useHeader } from '../layout/HeaderContext';
import { CertificationsSection } from './CertificationsSection';
import { EducationSection } from './EducationSection';
import { ExperienceSection } from './ExperienceSection';
import { SkillsSection } from './SkillsSection';
import type { CareerTab } from './tabs';

interface Props {
  initialTab: CareerTab;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  certifications: Certification[];
}

export function CareerManager({ initialTab, experiences, education, skills, certifications }: Props) {
  const [tab, setTab] = useState<CareerTab>(initialTab);

  useHeader({
    crumbs: [{ label: 'Experience & skills' }],
    title: 'Experience & skills',
  });
  return (
    <div>
      <Tabs
        label="Career data"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'experience', label: 'Experience', badge: <Badge>{experiences.length}</Badge> },
          { id: 'education', label: 'Education', badge: <Badge>{education.length}</Badge> },
          { id: 'skills', label: 'Skills', badge: <Badge>{skills.length}</Badge> },
          { id: 'certifications', label: 'Certifications', badge: <Badge>{certifications.length}</Badge> },
        ]}
      />
      <div role="tabpanel" id={tabPanelId(tab)} aria-labelledby={tabId(tab)} className="pt-6">
        {tab === 'experience' ? <ExperienceSection initial={experiences} /> : null}
        {tab === 'education' ? <EducationSection initial={education} /> : null}
        {tab === 'skills' ? <SkillsSection initial={skills} /> : null}
        {tab === 'certifications' ? <CertificationsSection initial={certifications} /> : null}
      </div>
    </div>
  );
}
