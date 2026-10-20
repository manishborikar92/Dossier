import { uid } from './ids.js';
import { defaultOptions, DEFAULT_ORDER } from './templates.js';

export const emptySelection = () => ({
  summaryId: null, contactIds: [], skills: [], experience: [], projects: [],
  education: [], certifications: [], involvement: [],
});

export function newResume({ name = 'Untitled resume', targetId = null, template = 'classic', selection, overrides = {} } = {}) {
  const now = new Date().toISOString();
  return {
    id: uid('resume'), name, targetId, template,
    options: defaultOptions(template),
    sectionOrder: [...DEFAULT_ORDER], sections: {}, titles: {},
    selection: selection || emptySelection(), overrides,
    createdAt: now, updatedAt: now,
  };
}
