/**
 * Shared Design Specification & Design Tokens for Intelligent Resume Builder.
 *
 * Authoritative baseline derived directly from C:\Users\manis\Downloads\generate_resume.js.
 * Acts as the single source of truth for visual hierarchy, typography, colors,
 * margins, spacing scale, divider treatment, tab stops, and section ordering.
 *
 * Provides structured design tokens and helper adapters for:
 * 1. Microsoft Word (.docx) OpenXML metrics (twips, half-points, border eighth-points)
 * 2. Headless Chromium / Edge HTML/CSS print metrics (pt, in, rem, hex)
 */

// ── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  ACCENT: '1F3864',       // Dark Navy (primary branding, name, section headers, dividers)
  BLACK: '000000',        // Deep Black (body text, primary bullet runs)
  GRAY: '444444',         // Muted Gray (metadata, dates, sublines, contact line)
  SUBTLE: '222222',       // Subtle Charcoal (skill items, secondary text)
  WHITE: 'FFFFFF'
};

// ── Typography Hierarchy ──────────────────────────────────────────────────────
// Standard typographic scale in Points (pt).
// For Word OpenXML: half-points = pt * 2 (e.g. 18pt = 36 hp).
const TYPOGRAPHY = {
  fontFamily: 'Arial',
  fontFamilyFallback: 'Arial, Helvetica, sans-serif',
  twoPage: {
    // Reference line 123: size 36 (18pt)
    name: { pt: 18, halfPoints: 36, weight: 'bold', color: COLORS.ACCENT },
    // Reference line 34: size 22 (11pt)
    sectionHeader: { pt: 11, halfPoints: 22, weight: 'bold', color: COLORS.ACCENT, textTransform: 'uppercase' },
    // Reference lines 60, 71: size 21 (10.5pt)
    itemTitle: { pt: 10.5, halfPoints: 21, weight: 'bold', color: COLORS.BLACK },
    // Reference lines 42, 50, 108: size 20 (10pt)
    body: { pt: 10, halfPoints: 20, weight: 'normal', color: COLORS.BLACK },
    // Reference lines 51, 62, 72, 80: size 19 (9.5pt)
    meta: { pt: 9.5, halfPoints: 19, weight: 'normal', color: COLORS.GRAY, italic: true },
    // Reference line 133: size 17 (8.5pt)
    contact: { pt: 8.5, halfPoints: 17, weight: 'normal', color: COLORS.GRAY }
  },
  onePage: {
    name: { pt: 16, halfPoints: 32, weight: 'bold', color: COLORS.ACCENT },
    sectionHeader: { pt: 10, halfPoints: 20, weight: 'bold', color: COLORS.ACCENT, textTransform: 'uppercase' },
    itemTitle: { pt: 9.5, halfPoints: 19, weight: 'bold', color: COLORS.BLACK },
    body: { pt: 9, halfPoints: 18, weight: 'normal', color: COLORS.BLACK },
    meta: { pt: 8.5, halfPoints: 17, weight: 'normal', color: COLORS.GRAY, italic: true },
    contact: { pt: 8, halfPoints: 16, weight: 'normal', color: COLORS.GRAY }
  }
};

// ── Page Geometry & Margins ──────────────────────────────────────────────────
// Reference lines 112-114: Letter size (12240 x 15840 twips = 8.5 x 11 inches)
// Margin: 1080 twips = 0.75 in on all sides (two-page extended)
const PAGE = {
  size: 'letter',
  dimensions: {
    widthInches: 8.5,
    heightInches: 11.0,
    widthTwips: 12240,
    heightTwips: 15840,
    widthPt: 612,
    heightPt: 792
  },
  margins: {
    twoPage: {
      inches: 0.75,
      twips: 1080,
      pt: 54,
      css: '0.75in'
    },
    onePage: {
      inches: 0.50,
      twips: 720,
      pt: 36,
      css: '0.50in'
    }
  }
};

// ── Spacing Scale (in Word twips; 20 twips = 1 pt = 1.33 px) ──────────────────
const SPACING = {
  twoPage: {
    name: { before: 0, after: 60 },
    contact: { before: 0, after: 40 },
    hr: { before: 80, after: 80 },
    sectionHeader: { before: 120, after: 30 },
    summary: { before: 80, after: 80 },
    skillRow: { before: 35, after: 35 },
    itemHeader: { before: 100, after: 20 },
    projectSubline: { before: 0, after: 25 },
    bullet: { before: 18, after: 18 },
    twoColLine: { before: 10, after: 10 },
    grayLine: { before: 10, after: 20 }
  },
  onePage: {
    name: { before: 0, after: 30 },
    contact: { before: 0, after: 20 },
    hr: { before: 40, after: 40 },
    sectionHeader: { before: 100, after: 30 },
    summary: { before: 40, after: 40 },
    skillRow: { before: 15, after: 15 },
    itemHeader: { before: 80, after: 20 },
    projectSubline: { before: 0, after: 20 },
    bullet: { before: 15, after: 15 },
    twoColLine: { before: 10, after: 10 },
    grayLine: { before: 10, after: 20 }
  }
};

// ── Borders & Dividers ───────────────────────────────────────────────────────
const BORDERS = {
  // Reference line 23: BorderStyle.SINGLE, size: 8 (eighth-points: 8 = 1pt), color: ACCENT
  divider: {
    wordSize: 8,       // 1 pt (size in 1/8 pt: 8 = 1 pt)
    cssSize: '1px',
    color: COLORS.ACCENT,
    space: 1
  },
  // Reference line 31: BorderStyle.SINGLE, size: 6 (eighth-points: 6 = 0.75pt), color: ACCENT
  sectionUnderline: {
    wordSize: 6,       // 0.75 pt (size in 1/8 pt: 6 = 0.75 pt)
    cssSize: '1.2px',
    color: COLORS.ACCENT,
    space: 2
  }
};

// ── Bullet Formatting ───────────────────────────────────────────────────────
// Reference lines 97-102: bullet \u2022, left indent 540 twips (0.375 in), hanging 270 twips (0.1875 in)
const BULLETS = {
  character: '\u2022',
  leftIndentTwips: 540,
  hangingTwips: 270,
  leftIndentInches: 0.375,
  hangingInches: 0.1875
};

// ── Section Ordering & Titles ───────────────────────────────────────────────
const SECTIONS = {
  canonicalOrder: [
    'summary',
    'skills',
    'experience',
    'projects',
    'education',
    'certifications',
    'leadership'
  ],
  titles: {
    summary: 'Professional Summary',
    skills: 'Technical Skills',
    experience: 'Professional Experience',
    projects: 'Key Projects',
    education: 'Education',
    certifications: 'Certifications',
    leadership: 'Leadership & Involvement'
  }
};

// ── Default Headline & Role Key ──────────────────────────────────────────────
const DEFAULT_ROLE_KEY = 'fullstack';
const DEFAULT_ROLE_TITLE = 'Full Stack Developer';

module.exports = {
  COLORS,
  TYPOGRAPHY,
  PAGE,
  SPACING,
  BORDERS,
  BULLETS,
  SECTIONS,
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_TITLE
};
