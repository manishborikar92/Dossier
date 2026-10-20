// Merge the project knowledge base (JSON array) into the projects collection.
// Rule: never overwrite what you have written. KB data only fills gaps and adds *new*
// bullets as "needs review" - nothing from the KB is trusted until you mark it confident.
import { bid } from './ids.js';
import { extractTerms } from './terms.js';

const splitStack = (s = '') => s.split(',').map((x) => x.trim()).filter(Boolean);
const cleanUrl = (u) => (u ? String(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '') : '');
const ARCHIVE_BELOW = 50;

function kbMeta(k, project) {
  const haystack = [project.title, ...(project.techStack || []), ...project.bullets.map((b) => b.text)].join(' ').toLowerCase();
  const haveKeys = new Set(extractTerms(haystack).keys());
  const notListed = (k.primary_technologies || []).filter((t) => {
    const keys = [...extractTerms(t).keys()];
    return keys.length ? !keys.some((x) => haveKeys.has(x)) : !haystack.includes(t.toLowerCase());
  });
  return {
    rank: k.rank, score: k.score, isTop5: !!k.is_top_5, purpose: k.purpose, architecture: k.architecture,
    technicalAnalysis: k.technical_analysis, keyImplementation: k.key_implementation_details,
    technologies: k.primary_technologies || [], techNotListed: notListed,
    liveUrl: k.live_url || null, urlType: k.url_type || null, commitCount: k.commit_count,
    firstCommit: k.first_commit, lastCommit: k.last_commit, localPath: k.local_path,
  };
}

const kbBullets = (k) => (k.resume_entry?.bullets || []).map((text) => ({
  id: bid(`b-${k.id}`, text), text, tags: [], status: 'prep', source: 'kb',
}));

/** Returns { projects, stats } without mutating the input. */
export function mergeKB(projects, kbArray, { ownership = {} } = {}) {
  const out = structuredClone(projects);
  const stats = { added: 0, updated: 0, bulletsAdded: 0 };
  for (const k of kbArray) {
    const existing = out.find((p) => p.id === k.id);
    if (existing) {
      const have = new Set(existing.bullets.map((b) => b.id));
      const fresh = kbBullets(k).filter((b) => !have.has(b.id) && !existing.bullets.some((x) => x.text === b.text));
      existing.bullets.push(...fresh);
      stats.bulletsAdded += fresh.length;
      if (!existing.link) existing.link = cleanUrl(k.live_url);
      if (!existing.year) existing.year = k.resume_entry?.year || '';
      if (!existing.techStack.length) existing.techStack = splitStack(k.resume_entry?.tech_stack_summary);
      existing.kb = kbMeta(k, existing);
      stats.updated += 1;
    } else {
      const p = {
        id: k.id,
        title: k.resume_entry?.resume_title || k.title,
        ownership: ownership[k.id] || 'personal',
        link: cleanUrl(k.live_url),
        year: k.resume_entry?.year || '',
        techStack: splitStack(k.resume_entry?.tech_stack_summary),
        tags: [],
        visible: (k.score ?? 0) >= ARCHIVE_BELOW,
        notes: '',
        kb: null,
        bullets: kbBullets(k),
      };
      p.kb = kbMeta(k, p);
      out.push(p);
      stats.added += 1;
      stats.bulletsAdded += p.bullets.length;
    }
  }
  return { projects: out, stats };
}
