export const csvList = (arr = []) => arr.join(', ');
export const parseCsvList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
