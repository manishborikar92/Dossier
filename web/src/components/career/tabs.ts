// Plain constants (not a client module) so server pages can import them too.
export const CAREER_TABS = ['experience', 'education', 'skills', 'certifications'] as const;
export type CareerTab = (typeof CAREER_TABS)[number];
