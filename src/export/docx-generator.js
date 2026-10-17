/**
 * Editable Microsoft Word (.docx) Resume Generator
 *
 * Generates ATS-compliant, single-column DOCX resumes from canonical finalResumeModel
 * adhering to established typography, half-point sizes, and twips spacing.
 */

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  TabStopType,
  TabStopPosition
} = require('docx');

const {
  COLORS,
  TYPOGRAPHY,
  PAGE,
  SPACING,
  BORDERS,
  BULLETS,
  SECTIONS
} = require('./design-spec');
const {
  normalizeCertification,
  validateCanonicalModel
} = require('../model/normalize');

// Legacy backwards-compatible sizing constants for existing test assertions
const SIZES = {
  NAME: TYPOGRAPHY.twoPage.name.halfPoints,
  SECTION_HEADER: TYPOGRAPHY.twoPage.sectionHeader.halfPoints,
  ITEM_TITLE: TYPOGRAPHY.twoPage.itemTitle.halfPoints,
  BODY: TYPOGRAPHY.twoPage.body.halfPoints,
  META: TYPOGRAPHY.twoPage.meta.halfPoints,
  CONTACT: TYPOGRAPHY.twoPage.contact.halfPoints
};

// ── Helper Constructors ───────────────────────────────────────────────────────

function createHr(is1Page) {
  const sp = is1Page ? SPACING.onePage.hr : SPACING.twoPage.hr;
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: BORDERS.divider.wordSize, color: BORDERS.divider.color, space: BORDERS.divider.space } },
    spacing: { before: sp.before, after: sp.after },
    children: []
  });
}

function createSectionHeader(title, is1Page, pageBreakBefore = false) {
  const sp = is1Page ? SPACING.onePage.sectionHeader : SPACING.twoPage.sectionHeader;
  const typo = is1Page ? TYPOGRAPHY.onePage.sectionHeader : TYPOGRAPHY.twoPage.sectionHeader;
  return new Paragraph({
    pageBreakBefore: Boolean(pageBreakBefore),
    spacing: { before: sp.before, after: sp.after },
    border: { bottom: { style: BorderStyle.SINGLE, size: BORDERS.sectionUnderline.wordSize, color: BORDERS.sectionUnderline.color, space: BORDERS.sectionUnderline.space } },
    keepNext: true,
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: typo.halfPoints,
        color: typo.color,
        font: TYPOGRAPHY.fontFamily
      })
    ]
  });
}

function createBullet(text, boldPrefix = null, is1Page = false) {
  const cleanPrefix = boldPrefix ? boldPrefix.trim() : '';
  const cleanText = typeof text === 'string' ? text.trim() : '';

  if (!cleanPrefix && !cleanText) {
    return null;
  }

  const sp = is1Page ? SPACING.onePage.bullet : SPACING.twoPage.bullet;
  const typo = is1Page ? TYPOGRAPHY.onePage.body : TYPOGRAPHY.twoPage.body;

  const children = [];
  if (cleanPrefix) {
    children.push(
      new TextRun({
        text: cleanPrefix + (cleanText ? ' ' : ''),
        bold: true,
        size: typo.halfPoints,
        font: TYPOGRAPHY.fontFamily,
        color: COLORS.BLACK
      })
    );
  }
  if (cleanText) {
    children.push(
      new TextRun({
        text: cleanText,
        size: typo.halfPoints,
        font: TYPOGRAPHY.fontFamily,
        color: COLORS.BLACK
      })
    );
  }

  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: sp.before, after: sp.after },
    children
  });
}

function createTwoColLine(left, right, leftBold = false, rightGray = false, is1Page = false) {
  const sp = is1Page ? SPACING.onePage.twoColLine : SPACING.twoPage.twoColLine;
  const leftTypo = is1Page ? TYPOGRAPHY.onePage.body : TYPOGRAPHY.twoPage.body;
  const rightTypo = is1Page ? TYPOGRAPHY.onePage.meta : TYPOGRAPHY.twoPage.meta;
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: sp.before, after: sp.after },
    children: [
      new TextRun({ text: left, bold: leftBold, size: leftTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.BLACK }),
      new TextRun({ text: '\t' + right, size: rightTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: rightGray ? COLORS.GRAY : COLORS.BLACK, italics: rightGray })
    ]
  });
}

function createGrayLine(text, afterTwips = 40, is1Page = false) {
  const typo = is1Page ? TYPOGRAPHY.onePage.meta : TYPOGRAPHY.twoPage.meta;
  const beforeTwips = is1Page ? SPACING.onePage.grayLine.before : SPACING.twoPage.grayLine.before;
  return new Paragraph({
    spacing: { before: beforeTwips, after: afterTwips },
    children: [
      new TextRun({
        text,
        size: typo.halfPoints,
        font: TYPOGRAPHY.fontFamily,
        color: COLORS.GRAY
      })
    ]
  });
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return 'https://' + trimmed;
  }
  return '';
}

/**
 * Generates an editable DOCX resume from the canonical finalResumeModel.
 *
 * @param {object} resumeModel - Approved finalResumeModel
 * @param {object} [options]
 * @param {string} [options.outputPath] - Target file path
 * @returns {Promise<{ filePath: string, fileSize: number, format: string }>}
 */
async function generateResumeDocx(resumeModel, options = {}) {
  if (!resumeModel || typeof resumeModel !== 'object') {
    throw new Error('Invalid resumeModel provided to generateResumeDocx.');
  }

  // Validate canonical schema invariants
  validateCanonicalModel(resumeModel);

  const is1Page = resumeModel.metadata?.resumeLength === '1page';
  const marginTwips = is1Page ? PAGE.margins.onePage.twips : PAGE.margins.twoPage.twips;
  const personal = resumeModel.personal || {};

  const outputDir = options.outputPath
    ? path.dirname(path.resolve(options.outputPath))
    : path.resolve(__dirname, '../../output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const candidateSlug = (personal.name || 'Candidate').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetRoleSlug = (resumeModel.metadata?.targetRole || 'fullstack').replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetLength = resumeModel.metadata?.resumeLength || '2page';
  const timestamp = Date.now();
  const defaultFilename = `${candidateSlug}_${targetRoleSlug}_${targetLength}_${timestamp}.docx`;

  const finalDocxPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(outputDir, defaultFilename);

  const children = [];

  // ── 1. Name ────────────────────────────────────────────────────────────────
  if (personal.name && personal.name.trim().length > 0) {
    const typo = is1Page ? TYPOGRAPHY.onePage.name : TYPOGRAPHY.twoPage.name;
    const sp = is1Page ? SPACING.onePage.name : SPACING.twoPage.name;
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: sp.before, after: sp.after },
        children: [
          new TextRun({
            text: personal.name.trim(),
            bold: true,
            size: typo.halfPoints,
            font: TYPOGRAPHY.fontFamily,
            color: typo.color
          })
        ]
      })
    );
  }

  // ── 2. Contact Information ─────────────────────────────────────────────────
  const contactChildren = [];
  const contactTypo = is1Page ? TYPOGRAPHY.onePage.contact : TYPOGRAPHY.twoPage.contact;
  const contactSp = is1Page ? SPACING.onePage.contact : SPACING.twoPage.contact;
  const dotSep = '  \u00B7  ';

  if (personal.location) {
    contactChildren.push(new TextRun({ text: personal.location, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }));
  }
  if (personal.email) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: dotSep, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }));
    }
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({ text: personal.email, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY })
        ],
        link: sanitizeUrl(`mailto:${personal.email}`)
      })
    );
  }
  if (personal.phone) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: dotSep, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }));
    }
    contactChildren.push(
      new TextRun({ text: personal.phone, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY })
    );
  }
  if (personal.linkedin) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: dotSep, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }));
    }
    let cleanLink = personal.linkedin.replace(/^https?:\/\/(www\.)?/i, '').replace(/^linkedin\.com\//i, '');
    if (!cleanLink.startsWith('in/')) {
      cleanLink = 'in/' + cleanLink;
    }
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({ text: cleanLink, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY })
        ],
        link: sanitizeUrl(personal.linkedin)
      })
    );
  }
  if (personal.github) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: dotSep, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }));
    }
    let cleanGit = personal.github.replace(/^https?:\/\/(www\.)?/i, '').replace(/^github\.com\//i, '');
    if (!cleanGit.startsWith('github/')) {
      cleanGit = 'github/' + cleanGit;
    }
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({ text: cleanGit, size: contactTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY })
        ],
        link: sanitizeUrl(personal.github)
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: contactSp.before, after: contactSp.after },
      children: contactChildren
    })
  );

  children.push(createHr(is1Page));

  // ── 3. Professional Summary (if populated) ─────────────────────────────────
  if (resumeModel.summary && resumeModel.summary.trim().length > 0) {
    const sp = is1Page ? SPACING.onePage.summary : SPACING.twoPage.summary;
    const typo = is1Page ? TYPOGRAPHY.onePage.body : TYPOGRAPHY.twoPage.body;
    children.push(createSectionHeader(SECTIONS.titles.summary, is1Page));
    children.push(
      new Paragraph({
        spacing: { before: sp.before, after: sp.after },
        children: [
          new TextRun({
            text: resumeModel.summary.trim(),
            size: typo.halfPoints,
            font: TYPOGRAPHY.fontFamily,
            color: typo.color
          })
        ]
      })
    );
  }

  // ── 4. Technical Skills (if populated) ─────────────────────────────────────
  if (Array.isArray(resumeModel.skills) && resumeModel.skills.length > 0) {
    const sp = is1Page ? SPACING.onePage.skillRow : SPACING.twoPage.skillRow;
    const typo = is1Page ? TYPOGRAPHY.onePage.body : TYPOGRAPHY.twoPage.body;
    children.push(createSectionHeader(SECTIONS.titles.skills, is1Page));
    for (const cat of resumeModel.skills) {
      const itemsText = Array.isArray(cat.items) ? cat.items.join(', ') : '';
      if (itemsText.length > 0) {
        children.push(
          new Paragraph({
            spacing: { before: sp.before, after: sp.after },
            children: [
              new TextRun({
                text: `${cat.label || cat.category}: `,
                bold: true,
                size: typo.halfPoints,
                font: TYPOGRAPHY.fontFamily,
                color: COLORS.BLACK
              }),
              new TextRun({
                text: itemsText,
                size: typo.halfPoints,
                font: TYPOGRAPHY.fontFamily,
                color: COLORS.BLACK
              })
            ]
          })
        );
      }
    }
  }

  // ── 5. Professional Experience (if populated) ──────────────────────────────
  if (Array.isArray(resumeModel.experience) && resumeModel.experience.length > 0) {
    const sp = is1Page ? SPACING.onePage.itemHeader : SPACING.twoPage.itemHeader;
    const titleTypo = is1Page ? TYPOGRAPHY.onePage.itemTitle : TYPOGRAPHY.twoPage.itemTitle;
    const bodyTypo = is1Page ? TYPOGRAPHY.onePage.body : TYPOGRAPHY.twoPage.body;
    const metaTypo = is1Page ? TYPOGRAPHY.onePage.meta : TYPOGRAPHY.twoPage.meta;
    children.push(createSectionHeader(SECTIONS.titles.experience, is1Page));
    for (const exp of resumeModel.experience) {
      const locText = exp.location ? ` (${exp.location})` : '';
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { before: sp.before, after: sp.after },
          children: [
            new TextRun({
              text: exp.role,
              bold: true,
              size: titleTypo.halfPoints,
              font: TYPOGRAPHY.fontFamily,
              color: titleTypo.color
            }),
            new TextRun({
              text: ` — ${exp.company}${locText}`,
              size: bodyTypo.halfPoints,
              font: TYPOGRAPHY.fontFamily,
              color: COLORS.GRAY
            }),
            new TextRun({
              text: `\t${exp.dates || ''}`,
              size: metaTypo.halfPoints,
              font: TYPOGRAPHY.fontFamily,
              color: COLORS.GRAY,
              italics: true
            })
          ]
        })
      );

      if (Array.isArray(exp.bullets)) {
        for (const b of exp.bullets) {
          children.push(createBullet(b, null, is1Page));
        }
      }
    }
  }

  // ── 6. Projects & Deliverables (if populated) ──────────────────────────────
  if (Array.isArray(resumeModel.projects) && resumeModel.projects.length > 0) {
    const sp = is1Page ? SPACING.onePage.itemHeader : SPACING.twoPage.itemHeader;
    const sublineSp = is1Page ? SPACING.onePage.projectSubline : SPACING.twoPage.projectSubline;
    const titleTypo = is1Page ? TYPOGRAPHY.onePage.itemTitle : TYPOGRAPHY.twoPage.itemTitle;
    const metaTypo = is1Page ? TYPOGRAPHY.onePage.meta : TYPOGRAPHY.twoPage.meta;

    children.push(createSectionHeader(SECTIONS.titles.projects, is1Page, !is1Page));

    for (const proj of resumeModel.projects) {
      const projHeaderChildren = [
        new TextRun({
          text: proj.title || proj.name,
          bold: true,
          size: titleTypo.halfPoints,
          font: TYPOGRAPHY.fontFamily,
          color: titleTypo.color
        })
      ];

      if (proj.liveUrl) {
        projHeaderChildren.push(
          new TextRun({ text: '  |  ', size: metaTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }),
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: proj.liveUrl,
                size: metaTypo.halfPoints,
                font: TYPOGRAPHY.fontFamily,
                color: COLORS.ACCENT,
                underline: {}
              })
            ],
            link: sanitizeUrl(proj.liveUrl)
          })
        );
      }

      projHeaderChildren.push(
        new TextRun({
          text: `\t${proj.year || '2026'}`,
          size: metaTypo.halfPoints,
          font: TYPOGRAPHY.fontFamily,
          color: COLORS.GRAY,
          italics: true
        })
      );

      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { before: sp.before, after: sp.after },
          children: projHeaderChildren
        })
      );

      const techStackText = proj.techSummary || (proj.technologies || []).slice(0, 5).join(', ');
      if (techStackText) {
        children.push(
          new Paragraph({
            spacing: { before: sublineSp.before, after: sublineSp.after },
            children: [
              new TextRun({ text: 'Tech Stack: ', bold: true, size: metaTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY }),
              new TextRun({ text: techStackText, size: metaTypo.halfPoints, font: TYPOGRAPHY.fontFamily, color: COLORS.GRAY, italics: true })
            ]
          })
        );
      }

      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          children.push(createBullet(b, null, is1Page));
        }
      }
    }
  }

  // ── 7. Education (if populated) ───────────────────────────────────────────
  if (Array.isArray(resumeModel.education) && resumeModel.education.length > 0) {
    children.push(createSectionHeader(SECTIONS.titles.education, is1Page));
    for (const edu of resumeModel.education) {
      children.push(
        createTwoColLine(
          edu.degree,
          edu.dates || '',
          true,
          false,
          is1Page
        )
      );

      const sublineParts = [edu.institution, edu.location, edu.details || edu.score].filter(Boolean);
      if (sublineParts.length > 0) {
        children.push(createGrayLine(sublineParts.join('  |  '), is1Page ? 20 : 35, is1Page));
      }
    }
  }

  // ── 8. Certifications (if populated) ──────────────────────────────────────
  if (Array.isArray(resumeModel.certifications) && resumeModel.certifications.length > 0) {
    const certBullets = [];
    for (const rawCert of resumeModel.certifications) {
      const cert = normalizeCertification(rawCert);
      if (!cert || (!cert.name && !cert.raw)) continue;
      const fullText = cert.raw || [cert.name, cert.issuer, cert.year].filter(Boolean).join(' — ');
      const bullet = createBullet(fullText, null, is1Page);
      if (bullet) {
        certBullets.push(bullet);
      }
    }
    if (certBullets.length > 0) {
      children.push(createSectionHeader(SECTIONS.titles.certifications, is1Page));
      children.push(...certBullets);
    }
  }

  // ── 9. Leadership (if populated) ──────────────────────────────────────────
  if (Array.isArray(resumeModel.leadership) && resumeModel.leadership.length > 0) {
    children.push(createSectionHeader(SECTIONS.titles.leadership, is1Page));
    for (const lead of resumeModel.leadership) {
      if (typeof lead === 'string') {
        const bullet = createBullet(lead, null, is1Page);
        if (bullet) children.push(bullet);
      } else if (lead && typeof lead === 'object') {
        if (lead.title) {
          children.push(createTwoColLine(lead.title, lead.dates || '', true, false, is1Page));
        }
        let desc = '';
        if (lead.institution && Array.isArray(lead.bullets) && lead.bullets[0]) {
          desc = `${lead.institution} — ${lead.bullets[0]}`;
        } else if (lead.institution) {
          desc = lead.institution;
        } else if (Array.isArray(lead.bullets) && lead.bullets[0]) {
          desc = lead.bullets[0];
        } else if (lead.description) {
          desc = lead.description;
        }
        if (desc) {
          children.push(createGrayLine(desc, is1Page ? 20 : 40, is1Page));
        }
      }
    }
  }

  // ── Construct Document ─────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: BULLETS.character,
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: BULLETS.leftIndentTwips, hanging: BULLETS.hangingTwips } } }
            }
          ]
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.dimensions.widthTwips, height: PAGE.dimensions.heightTwips },
            margin: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips }
          }
        },
        children
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(finalDocxPath, buffer);

  const stats = fs.statSync(finalDocxPath);
  return {
    filePath: finalDocxPath,
    fileSize: stats.size,
    format: 'docx'
  };
}

module.exports = {
  generateResumeDocx,
  normalizeCertification,
  COLORS,
  SIZES
};
