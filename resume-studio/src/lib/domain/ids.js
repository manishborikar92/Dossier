// Small helpers for ids. Safe to use in browser and Node.
export const uid = (prefix = 'id') =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

export function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Stable id derived from text, so re-importing the same bullet never duplicates it.
export const bid = (prefix, text) => `${prefix}-${hash(String(text))}`;
