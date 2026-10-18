/**
 * The PDF templates use the built-in PDF fonts (Helvetica / Times). Those fonts cover the
 * Windows-1252 character set, which is plenty for English resumes and is what ATS parsers
 * handle best. Anything outside it is replaced with a close equivalent so it never prints as garbage.
 */
const WIN_ANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const REPLACEMENTS: Record<number, string> = {
  0x2192: '->', 0x2190: '<-', 0x21d2: '=>', 0x2265: '>=', 0x2264: '<=', 0x2260: '!=', 0x2212: '-',
  0x00a0: ' ', 0x2009: ' ', 0x202f: ' ', 0x2007: ' ', 0x200b: '', 0x200c: '', 0x200d: '', 0xfeff: '',
  0x2713: '', 0x2714: '', 0x2605: '*', 0x25cf: '\u2022', 0x25aa: '\u2022', 0x2043: '-', 0x2010: '-', 0x2011: '-',
};

function supported(cp: number): boolean {
  return cp === 0x09 || cp === 0x0a || (cp >= 0x20 && cp < 0x7f) || (cp >= 0xa1 && cp <= 0xff) || WIN_ANSI_EXTRAS.has(cp);
}

/** Replace characters the built-in PDF fonts cannot draw. */
export function toWinAnsi(input: string): string {
  let out = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number;
    if (supported(cp)) out += ch;
    else if (cp in REPLACEMENTS) out += REPLACEMENTS[cp];
    else if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)) out += '';
    else out += '?';
  }
  return out;
}

/** Characters in `input` that had to be replaced (used to warn the user). */
export function findUnsupportedChars(input: string): string[] {
  const found = new Set<string>();
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number;
    if (!supported(cp) && !(cp in REPLACEMENTS && REPLACEMENTS[cp] === ' ') && cp !== 0x200b && cp !== 0x200c && cp !== 0x200d && cp !== 0xfeff) {
      found.add(ch);
    }
  }
  return [...found];
}
