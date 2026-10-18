/**
 * Resume-Builder: Reusable Word Document (DOCX) Styling & Paragraph Helpers
 * Extracted and refined from C:\Users\manis\Downloads\generate_resume.js
 *
 * NOTE ON DOCX LIBRARY UNIT CONVENTIONS:
 * - TextRun 'size' is in half-points (e.g., 20 = 10pt, 36 = 18pt).
 * - Paragraph 'spacing' (before/after) is in twips (1 pt = 20 twips; 1 inch = 1440 twips).
 * - Border 'size' is in eighths of a point (size: 8 = 1pt).
 * - Page margins are in twips/dxa (1080 = 0.75 in; 720 = 0.50 in).
 */

const {
  Paragraph,
  TextRun,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  TabStopType,
  TabStopPosition
} = require('docx');

// ── Color Palette ─────────────────────────────────────────────────────────────
const COLORS = {
  ACCENT: "1F3864",  // Deep Navy
  BLACK: "000000",   // Primary Text
  GRAY: "444444"     // Subtitles, metadata, dates
};

// ── Typography Sizing (Half-Points: value / 2 = point size) ───────────────────
const SIZES = {
  NAME: 36,            // 18 pt
  SECTION_HEADER: 22,  // 11 pt
  ITEM_TITLE: 21,      // 10.5 pt
  BODY: 20,            // 10 pt
  META: 19,            // 9.5 pt
  CONTACT: 18          // 9 pt
};

// ── Numbering Configuration (Bullets) ─────────────────────────────────────────
const NUMBERING_CONFIG = {
  config: [
    {
      reference: "bullets",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 270 } } }
        }
      ]
    }
  ]
};

// ── Reusable Paragraph Builders ───────────────────────────────────────────────

/**
 * Creates a horizontal accent divider line.
 */
const hrParagraph = (spacing = { before: 60, after: 60 }) =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.ACCENT, space: 1 } },
    spacing,
    children: []
  });

/**
 * Creates an uppercase section header with an underline border.
 */
const sectionHeader = (text, spacing = { before: 160, after: 60 }) =>
  new Paragraph({
    spacing,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.ACCENT, space: 2 } },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: SIZES.SECTION_HEADER,
        color: COLORS.ACCENT,
        font: "Arial"
      })
    ]
  });

/**
 * Creates a standard bullet item with optional bold prefix.
 */
const bullet = (text, boldPrefix = null, spacing = { before: 30, after: 30 }) => {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({ text: boldPrefix + " ", bold: true, size: SIZES.BODY, font: "Arial", color: COLORS.BLACK })
    );
  }
  children.push(
    new TextRun({ text, size: SIZES.BODY, font: "Arial", color: COLORS.BLACK })
  );

  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing,
    children
  });
};

/**
 * Creates a two-column line with left-aligned label and right-aligned detail.
 */
const twoColLine = (left, right, leftBold = false, rightGray = false, spacing = { before: 0, after: 0 }) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing,
    children: [
      new TextRun({ text: left, bold: leftBold, size: SIZES.BODY, font: "Arial", color: COLORS.BLACK }),
      new TextRun({ text: "\t" + right, size: SIZES.META, font: "Arial", color: rightGray ? COLORS.GRAY : COLORS.BLACK, italics: rightGray })
    ]
  });

/**
 * Creates a job title header: Title — Company (left), Dates (right).
 */
const jobTitle = (company, title, dates, location = null, spacing = { before: 100, after: 30 }) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing,
    children: [
      new TextRun({ text: title, bold: true, size: SIZES.ITEM_TITLE, font: "Arial", color: COLORS.BLACK }),
      new TextRun({ text: " — " + company, size: SIZES.BODY, font: "Arial", color: COLORS.GRAY }),
      new TextRun({ text: "\t" + dates, size: SIZES.META, font: "Arial", color: COLORS.GRAY, italics: true })
    ]
  });

/**
 * Creates a project header: Project Name | Live URL (left), Dates (right).
 */
const projectHeader = (name, dates, liveUrl = null, spacing = { before: 100, after: 30 }) => {
  const children = [
    new TextRun({ text: name, bold: true, size: SIZES.ITEM_TITLE, font: "Arial", color: COLORS.BLACK })
  ];

  if (liveUrl) {
    children.push(
      new TextRun({ text: "  |  ", size: SIZES.META, font: "Arial", color: COLORS.GRAY }),
      new TextRun({ text: liveUrl, size: SIZES.META, font: "Arial", color: COLORS.ACCENT })
    );
  }

  children.push(
    new TextRun({ text: "\t" + dates, size: SIZES.META, font: "Arial", color: COLORS.GRAY, italics: true })
  );

  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing,
    children
  });
};

/**
 * Creates a project tech stack subtitle.
 */
const projectSubline = (tech, spacing = { before: 0, after: 30 }) =>
  new Paragraph({
    spacing,
    children: [
      new TextRun({ text: "Tech Stack: ", bold: true, size: SIZES.META, font: "Arial", color: COLORS.GRAY }),
      new TextRun({ text: tech, size: SIZES.META, font: "Arial", color: COLORS.GRAY, italics: true })
    ]
  });

/**
 * Creates plain paragraph text with customizable font size, color, and spacing.
 */
const plainPara = (text, size = SIZES.BODY, color = COLORS.BLACK, spacing = { before: 30, after: 30 }) =>
  new Paragraph({
    spacing,
    children: [new TextRun({ text, size, font: "Arial", color })]
  });

module.exports = {
  COLORS,
  SIZES,
  NUMBERING_CONFIG,
  hrParagraph,
  sectionHeader,
  bullet,
  twoColLine,
  jobTitle,
  projectHeader,
  projectSubline,
  plainPara
};
