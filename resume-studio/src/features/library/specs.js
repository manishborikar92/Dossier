import { Notice } from '@/components/ui';
import { uid } from '@/lib/domain/ids';
import { plural } from '@/lib/client/format';

const toReview = (bullets = []) => bullets.filter((b) => b.status !== 'confident').length;
const reviewFlag = (bullets) => { const n = toReview(bullets); return n ? `${n} to review` : null; };

export const SECTIONS = [
  { value: 'review', label: 'Review queue', icon: 'pencil', title: 'Review queue', text: 'Check every bullet that came from your knowledge base. Only bullets marked Confident are used when a resume is tailored automatically.' },
  { value: 'profile', label: 'Profile', icon: 'user', title: 'Profile', text: 'Your name and contact details.' },
  { value: 'summaries', label: 'Summaries', icon: 'file', title: 'Summaries', text: 'Opening paragraphs you can choose between for each resume.' },
  { value: 'experience', label: 'Experience', icon: 'folder', title: 'Experience', text: 'Jobs and internships, each with bullets you can reuse across resumes.' },
  { value: 'skills', label: 'Skills', icon: 'sliders', title: 'Skills', text: 'Skills grouped the way they appear on a resume. Excluded skills are never claimed.' },
  { value: 'projects', label: 'Projects', icon: 'layout', title: 'Projects', text: 'Everything you have built. Archive projects you will not use.' },
  { value: 'education', label: 'Education', icon: 'book', title: 'Education', text: 'Degrees and schools, with the grade exactly as you want it shown.' },
  { value: 'certifications', label: 'Certifications', icon: 'shield', title: 'Certifications', text: 'Certificates and courses, written as they should read.' },
  { value: 'involvement', label: 'Involvement', icon: 'user', title: 'Leadership and involvement', text: 'Clubs, volunteering and leadership roles.' },
];

export const SPECS = {
  summaries: {
    noun: 'summary', icon: 'file', label: (s) => s.label, meta: (s) => [s.status === 'confident' ? 'Confident' : 'Needs review'],
    newItem: () => ({ id: uid('sum'), label: 'New summary', text: '', status: 'confident' }),
    fields: [
      { key: 'label', type: 'text', label: 'Label', hint: 'Only you see this.' },
      { key: 'text', type: 'textarea', label: 'Summary text', rows: 7 },
      { key: 'status', type: 'status', label: 'Can you stand behind every claim in it?' },
    ],
  },
  experience: {
    noun: 'job', icon: 'folder', label: (e) => e.title, meta: (e) => [e.company, e.dates], flag: (e) => reviewFlag(e.bullets),
    newItem: () => ({ id: uid('exp'), company: '', title: '', location: '', dates: '', visible: true, bullets: [] }),
    fields: [
      { key: 'title', type: 'text', label: 'Role title' },
      { key: 'company', type: 'text', label: 'Company' },
      { key: 'location', type: 'text', label: 'Location' },
      { key: 'dates', type: 'text', label: 'Dates', hint: 'Shown exactly as you type them.' },
      { key: 'visible', type: 'bool', label: 'Available in the resume editor' },
      { key: 'bullets', type: 'bullets', label: 'Bullets' },
    ],
  },
  skills: {
    noun: 'skill group', icon: 'sliders', label: (g) => g.label, meta: (g) => [plural(g.items.length, 'skill')],
    newItem: () => ({ id: uid('sk'), label: 'New group', items: [] }),
    fields: [
      { key: 'label', type: 'text', label: 'Group name', hint: 'For example: Languages, Frontend, Tools.' },
      { key: 'items', type: 'skillitems', label: 'Skills' },
    ],
  },
  projects: {
    noun: 'project', icon: 'layout', searchable: true, dim: (p) => p.visible === false,
    label: (p) => p.title, meta: (p) => [p.ownership, p.year, p.visible === false ? 'archived' : null], flag: (p) => reviewFlag(p.bullets),
    newItem: () => ({ id: uid('proj'), title: '', ownership: 'personal', link: '', year: '', techStack: [], tags: [], visible: true, notes: '', kb: null, bullets: [] }),
    fields: [
      { key: 'title', type: 'text', label: 'Project title' },
      { key: 'ownership', type: 'select', label: 'Type', options: [{ value: 'company', label: 'Company or employer' }, { value: 'freelance', label: 'Freelance or client' }, { value: 'college', label: 'College' }, { value: 'personal', label: 'Personal' }], hint: 'Drives the optional "College Project" style labels. Company repositories are usually private, so do not link them.' },
      { key: 'link', type: 'text', label: 'Link shown on the resume', hint: 'Optional.' },
      { key: 'year', type: 'text', label: 'Year or dates', hint: 'Shown exactly as you type them.' },
      { key: 'techStack', type: 'tags', label: 'Tech stack shown on the resume', hint: 'Comma separated. Only list what you are comfortable being asked about.' },
      { key: 'visible', type: 'bool', label: 'Active', hint: 'Untick to archive. Archived projects are hidden in the resume editor.' },
      {
        key: 'kbinfo', type: 'info',
        render: (p) => !p.kb ? null : (
          <Notice tone="info" title={`Knowledge base: rank ${p.kb.rank}, score ${p.kb.score} of 100, ${plural(p.kb.commitCount || 0, 'commit')}`} className="kbnote">
            {p.kb.purpose && <span>{p.kb.purpose} </span>}
            {p.kb.liveUrl && <a href={p.kb.liveUrl} target="_blank" rel="noreferrer">Open live site</a>}
            {p.kb.techNotListed?.length > 0 && <span className="kbnote__warn"><b>In the knowledge base but not in your stack or bullets:</b> {p.kb.techNotListed.join(', ')}. Verify before adding any of these.</span>}
          </Notice>
        ),
      },
      { key: 'notes', type: 'textarea', label: 'Private notes', hint: 'Never exported.', rows: 2 },
      { key: 'bullets', type: 'bullets', label: 'Bullets' },
    ],
  },
  education: {
    noun: 'education entry', icon: 'book', label: (e) => e.degree, meta: (e) => [e.dates],
    newItem: () => ({ id: uid('edu'), degree: '', institution: '', dates: '', detail: '' }),
    fields: [
      { key: 'degree', type: 'text', label: 'Degree or qualification' },
      { key: 'institution', type: 'text', label: 'Institution' },
      { key: 'dates', type: 'text', label: 'Date', hint: 'Shown exactly as you type it.' },
      { key: 'detail', type: 'text', label: 'Grade, CGPA or percentage' },
    ],
  },
  certifications: {
    noun: 'certification', icon: 'shield', label: (c) => c.text.slice(0, 70), meta: (c) => [c.status === 'confident' ? 'Confident' : 'Needs review'],
    newItem: () => ({ id: uid('cert'), text: '', status: 'confident' }),
    fields: [
      { key: 'text', type: 'textarea', label: 'Certification, as it should read', rows: 2 },
      { key: 'status', type: 'status', label: 'Status' },
    ],
  },
  involvement: {
    noun: 'activity', icon: 'user', label: (e) => e.role, meta: (e) => [e.dates],
    newItem: () => ({ id: uid('inv'), role: '', org: '', dates: '', text: '' }),
    fields: [
      { key: 'role', type: 'text', label: 'Role' },
      { key: 'org', type: 'text', label: 'Organisation' },
      { key: 'dates', type: 'text', label: 'Dates' },
      { key: 'text', type: 'textarea', label: 'One-line description', hint: 'Optional.', rows: 2 },
    ],
  },
};
