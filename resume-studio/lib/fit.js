// "Fit to N pages": exact page counting (via the PDF renderer) and a ladder of gentle
// formatting tweaks. It never deletes content - if the ladder is not enough it says so.
import { buildModel } from './model.js';
import { renderPdfInfo } from './render-pdf.js';

const SPACING_RANK = { tight: 0, normal: 1, relaxed: 2 };

export const LADDER = [
  {},
  { spacing: 'tight' },
  { spacing: 'tight', margin: 0.65 },
  { spacing: 'tight', margin: 0.6, fontSize: 9.5 },
  { spacing: 'tight', margin: 0.5, fontSize: 9.5 },
  { spacing: 'tight', margin: 0.5, fontSize: 9 },
];

/** Apply a ladder step, but only ever make things tighter than the user's current choice. */
export function tighten(options = {}, patch = {}) {
  const out = { ...options };
  if (patch.spacing && (SPACING_RANK[patch.spacing] ?? 1) < (SPACING_RANK[out.spacing] ?? 1)) out.spacing = patch.spacing;
  if (patch.margin != null) out.margin = Math.min(Number(out.margin) || patch.margin, patch.margin);
  if (patch.fontSize != null) out.fontSize = Math.min(Number(out.fontSize) || patch.fontSize, patch.fontSize);
  return out;
}

export async function measure(data, resume) {
  const { pages } = await renderPdfInfo(buildModel(data, resume), { author: data.profile?.name, title: resume.name });
  return pages;
}

export async function fitResume(data, resume, target = 2) {
  let last = null;
  for (let i = 0; i < LADDER.length; i++) {
    const options = tighten(resume.options, LADDER[i]);
    const pages = await measure(data, { ...resume, options });
    last = { fitted: pages <= target, pages, step: i, options };
    if (last.fitted) return last;
  }
  return last;
}
