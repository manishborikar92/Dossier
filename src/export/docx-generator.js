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

// ── Color Palette & Sizing Constants ──────────────────────────────────────────
const COLORS = {
  ACCENT: '1F3864',  // Deep Navy
  BLACK: '000000',   // Primary Text
  GRAY: '444444'     // Metadata, dates, sublines
};

const SIZES = {
  NAME: 36,            // 18 pt (half-points: 36 / 2 = 18pt)
  SECTION_HEADER: 22,  // 11 pt
  ITEM_TITLE: 21,      // 10.5 pt
  BODY: 20,            // 10 pt
  META: 19,            // 9.5 pt
  CONTACT: 18          // 9 pt
};

// ── Helper Constructors ───────────────────────────────────────────────────────

function createHr(is1Page) {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.ACCENT, space: 1 } },
    spacing: { before: is1Page ? 40 : 60, after: is1Page ? 40 : 60 },
    children: []
  });
}

function createSectionHeader(title, is1Page) {
  return new Paragraph({
    spacing: { before: is1Page ? 100 : 160, after: is1Page ? 30 : 50 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.ACCENT, space: 2 } },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: is1Page ? 20 : SIZES.SECTION_HEADER,
        color: COLORS.ACCENT,
        font: 'Arial'
      })
    ]
  });
}

function createBullet(text, boldPrefix = null, is1Page = false) {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({ text: boldPrefix + ' ', bold: true, size: is1Page ? 18 : SIZES.BODY, font: 'Arial', color: COLORS.BLACK })
    );
  }
  children.push(
    new TextRun({ text, size: is1Page ? 18 : SIZES.BODY, font: 'Arial', color: COLORS.BLACK })
  );

  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: is1Page ? 20 : 30, after: is1Page ? 20 : 30 },
    children
  });
}

function createTwoColLine(left, right, leftBold = false, rightGray = false, is1Page = false) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: is1Page ? 10 : 20, after: is1Page ? 10 : 20 },
    children: [
      new TextRun({ text: left, bold: leftBold, size: is1Page ? 18 : SIZES.BODY, font: 'Arial', color: COLORS.BLACK }),
      new TextRun({ text: '\t' + right, size: is1Page ? 17 : SIZES.META, font: 'Arial', color: rightGray ? COLORS.GRAY : COLORS.BLACK, italics: rightGray })
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

  const is1Page = resumeModel.metadata?.resumeLength === '1page';
  const marginTwips = is1Page ? 720 : 1080; // 0.50 in vs 0.75 in
  const personal = resumeModel.personal || {};

  const outputDir = options.outputPath
    ? path.dirname(path.resolve(options.outputPath))
    : path.resolve(__dirname, '../../output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetRoleSlug = (resumeModel.metadata?.targetRole || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetLength = resumeModel.metadata?.resumeLength || '2page';
  const timestamp = Date.now();
  const defaultFilename = `Manish_Borikar_${targetRoleSlug}_${targetLength}_${timestamp}.docx`;

  const finalDocxPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(outputDir, defaultFilename);

  const children = [];

  // ── 1. Name ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: is1Page ? 30 : 60 },
      children: [
        new TextRun({
          text: personal.name || 'MANISH BORIKAR',
          bold: true,
          size: is1Page ? 32 : SIZES.NAME,
          font: 'Arial',
          color: COLORS.ACCENT
        })
      ]
    })
  );

  // ── 2. Contact Information ─────────────────────────────────────────────────
  const contactChildren = [];
  if (personal.location) {
    contactChildren.push(new TextRun({ text: personal.location, size: SIZES.CONTACT, font: 'Arial', color: COLORS.GRAY }));
  }
  if (personal.email) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: '  •  ', size: SIZES.CONTACT, font: 'Arial', color: COLORS.GRAY }));
    }
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({ text: personal.email, size: SIZES.CONTACT, font: 'Arial', color: COLORS.ACCENT, underline: {} })
        ],
        link: sanitizeUrl(`mailto:${personal.email}`)
      })
    );
  }
  if (personal.phone) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: '  •  ', size: SIZES.CONTACT, font: 'Arial', color: COLORS.GRAY }));
    }
    contactChildren.push(
      new TextRun({ text: personal.phone, size: SIZES.CONTACT, font: 'Arial', color: COLORS.GRAY })
    );
  }
  if (personal.linkedin) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: '  •  ', size: SIZES.CONTACT, font: 'Arial', color: COLORS.GRAY }));
    }
    const cleanLink = personal.linkedin.replace(/^https?:\/\/(www\.)?/i, '');
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({ text: cleanLink, size: SIZES.CONTACT, font: 'Arial', color: COLORS.ACCENT, underline: {} })
        ],
        link: sanitizeUrl(personal.linkedin)
      })
    );
  }
  if (personal.github) {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: '  •  ', size: SIZES.CONTACT, font: 'Arial', color: COLORS.GRAY }));
    }
    const cleanGit = personal.github.replace(/^https?:\/\/(www\.)?/i, '');
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({ text: cleanGit, size: SIZES.CONTACT, font: 'Arial', color: COLORS.ACCENT, underline: {} })
        ],
        link: sanitizeUrl(personal.github)
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: is1Page ? 20 : 40 },
      children: contactChildren
    })
  );

  children.push(createHr(is1Page));

  // ── 3. Professional Summary (if populated) ─────────────────────────────────
  if (resumeModel.summary && resumeModel.summary.trim().length > 0) {
    children.push(createSectionHeader('Professional Summary', is1Page));
    children.push(
      new Paragraph({
        spacing: { before: is1Page ? 30 : 60, after: is1Page ? 40 : 80 },
        children: [
          new TextRun({
            text: resumeModel.summary.trim(),
            size: is1Page ? 18 : SIZES.BODY,
            font: 'Arial',
            color: COLORS.BLACK
          })
        ]
      })
    );
  }

  // ── 4. Technical Skills (if populated) ─────────────────────────────────────
  if (Array.isArray(resumeModel.skills) && resumeModel.skills.length > 0) {
    children.push(createSectionHeader('Technical Skills', is1Page));
    for (const cat of resumeModel.skills) {
      const itemsText = Array.isArray(cat.items) ? cat.items.join(', ') : '';
      if (itemsText.length > 0) {
        children.push(
          new Paragraph({
            spacing: { before: is1Page ? 15 : 25, after: is1Page ? 15 : 25 },
            children: [
              new TextRun({
                text: `${cat.label || cat.category}: `,
                bold: true,
                size: is1Page ? 18 : SIZES.BODY,
                font: 'Arial',
                color: COLORS.BLACK
              }),
              new TextRun({
                text: itemsText,
                size: is1Page ? 18 : SIZES.BODY,
                font: 'Arial',
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
    children.push(createSectionHeader('Professional Experience', is1Page));
    for (const exp of resumeModel.experience) {
      const locText = exp.location ? ` (${exp.location})` : '';
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { before: is1Page ? 60 : 100, after: is1Page ? 20 : 30 },
          children: [
            new TextRun({
              text: exp.role,
              bold: true,
              size: is1Page ? 19 : SIZES.ITEM_TITLE,
              font: 'Arial',
              color: COLORS.BLACK
            }),
            new TextRun({
              text: ` — ${exp.company}${locText}`,
              size: is1Page ? 18 : SIZES.BODY,
              font: 'Arial',
              color: COLORS.GRAY
            }),
            new TextRun({
              text: `\t${exp.dates || ''}`,
              size: is1Page ? 17 : SIZES.META,
              font: 'Arial',
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
    children.push(createSectionHeader('Projects & Technical Deliverables', is1Page));
    for (const proj of resumeModel.projects) {
      const projHeaderChildren = [
        new TextRun({
          text: proj.title || proj.name,
          bold: true,
          size: is1Page ? 19 : SIZES.ITEM_TITLE,
          font: 'Arial',
          color: COLORS.BLACK
        })
      ];

      if (proj.liveUrl) {
        projHeaderChildren.push(
          new TextRun({ text: '  |  ', size: is1Page ? 17 : SIZES.META, font: 'Arial', color: COLORS.GRAY }),
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: proj.liveUrl,
                size: is1Page ? 17 : SIZES.META,
                font: 'Arial',
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
          size: is1Page ? 17 : SIZES.META,
          font: 'Arial',
          color: COLORS.GRAY,
          italics: true
        })
      );

      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { before: is1Page ? 60 : 100, after: is1Page ? 15 : 25 },
          children: projHeaderChildren
        })
      );

      const techStackText = proj.techSummary || (proj.technologies || []).slice(0, 5).join(', ');
      if (techStackText) {
        children.push(
          new Paragraph({
            spacing: { before: 0, after: is1Page ? 20 : 30 },
            children: [
              new TextRun({ text: 'Tech Stack: ', bold: true, size: is1Page ? 17 : SIZES.META, font: 'Arial', color: COLORS.GRAY }),
              new TextRun({ text: techStackText, size: is1Page ? 17 : SIZES.META, font: 'Arial', color: COLORS.GRAY, italics: true })
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
    children.push(createSectionHeader('Education', is1Page));
    for (const edu of resumeModel.education) {
      const locText = edu.location ? ` — ${edu.location}` : '';
      const scoreText = edu.score ? ` • ${edu.score}` : '';
      children.push(
        createTwoColLine(
          `${edu.degree} — ${edu.institution}${locText}`,
          `${edu.dates || ''}${scoreText}`,
          false,
          true,
          is1Page
        )
      );
    }
  }

  // ── 8. Certifications (if populated) ──────────────────────────────────────
  if (Array.isArray(resumeModel.certifications) && resumeModel.certifications.length > 0) {
    children.push(createSectionHeader('Certifications & Credentials', is1Page));
    for (const cert of resumeModel.certifications) {
      const issuerText = cert.issuer ? ` — ${cert.issuer}` : '';
      const yearText = cert.year ? ` (${cert.year})` : '';
      children.push(
        createBullet(`${issuerText}${yearText}`, cert.name, is1Page)
      );
    }
  }

  // ── 9. Leadership (if populated) ──────────────────────────────────────────
  if (Array.isArray(resumeModel.leadership) && resumeModel.leadership.length > 0) {
    children.push(createSectionHeader('Leadership & Activities', is1Page));
    for (const lead of resumeModel.leadership) {
      const text = typeof lead === 'string' ? lead : (lead.title || lead.description || '');
      if (text) {
        children.push(createBullet(text, null, is1Page));
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
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 270 } } }
            }
          ]
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // Letter: 8.5 x 11 inches
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
  COLORS,
  SIZES
};
