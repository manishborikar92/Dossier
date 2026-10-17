/**
 * Document Export Validator
 *
 * Performs multi-point verification on generated DOCX and PDF deliverables:
 * - Strict page count budget compliance (exact 1 page or 2 pages)
 * - Searchable text extraction & content integrity
 * - Single-column reading order sequencing
 * - Working clickable hyperlinks & URI target verification
 * - Layout boundary and empty section handling
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

/**
 * Extracts all /URI targets from a PDF buffer.
 *
 * @param {Buffer} pdfBuffer - Raw PDF buffer
 * @returns {string[]} Array of extracted URI target strings
 */
function extractPdfUris(pdfBuffer) {
  const text = pdfBuffer.toString('latin1');
  const uris = [];
  const regex = /\/URI\s*\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    uris.push(match[1]);
  }
  return uris;
}

/**
 * Validates a generated PDF resume against its source finalResumeModel.
 *
 * @param {string} pdfPath - Absolute or relative path to PDF file
 * @param {object} resumeModel - Canonical finalResumeModel
 * @returns {Promise<{
 *   valid: boolean,
 *   format: string,
 *   filePath: string,
 *   fileSize: number,
 *   pageCount: number,
 *   expectedPages: number,
 *   errors: string[],
 *   warnings: string[],
 *   metrics: object
 * }>}
 */
async function validatePdfResume(pdfPath, resumeModel) {
  const errors = [];
  const warnings = [];

  const resolvedPath = path.resolve(pdfPath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      valid: false,
      format: 'pdf',
      filePath: resolvedPath,
      fileSize: 0,
      pageCount: 0,
      expectedPages: resumeModel?.metadata?.resumeLength === '1page' ? 1 : 2,
      errors: [`PDF file does not exist at: ${resolvedPath}`],
      warnings: [],
      metrics: {}
    };
  }

  const stats = fs.statSync(resolvedPath);
  if (stats.size === 0) {
    return {
      valid: false,
      format: 'pdf',
      filePath: resolvedPath,
      fileSize: 0,
      pageCount: 0,
      expectedPages: resumeModel?.metadata?.resumeLength === '1page' ? 1 : 2,
      errors: [`PDF file is completely empty (0 bytes).`],
      warnings: [],
      metrics: {}
    };
  }

  const pdfBuffer = fs.readFileSync(resolvedPath);
  const parser = new PDFParse(new Uint8Array(pdfBuffer));

  let info;
  let textObj;

  try {
    info = await parser.getInfo();
    textObj = await parser.getText();
  } catch (err) {
    return {
      valid: false,
      format: 'pdf',
      filePath: resolvedPath,
      fileSize: stats.size,
      pageCount: 0,
      expectedPages: resumeModel?.metadata?.resumeLength === '1page' ? 1 : 2,
      errors: [`PDF text parsing failed: ${err.message}`],
      warnings: [],
      metrics: {}
    };
  }

  const actualPages = info.total || 0;
  const is1Page = resumeModel?.metadata?.resumeLength === '1page';
  const expectedPages = is1Page ? 1 : 2;

  // ── 1. Strict Page Count Budget Check ──────────────────────────────────────
  if (actualPages !== expectedPages) {
    errors.push(
      `Strict page budget violated: Expected exactly ${expectedPages} page(s) for ${is1Page ? '1-Page Compact' : '2-Page Extended'} format, but generated PDF contains ${actualPages} page(s).`
    );
  }

  const extractedText = (textObj.text || '').trim();
  if (extractedText.length === 0) {
    errors.push('Extracted PDF text is empty; document is not text-selectable or contains only raster graphics.');
  }

  // ── 2. Content Integrity Checks ───────────────────────────────────────────
  const personal = resumeModel.personal || {};

  // Check Name
  if (personal.name && !extractedText.toLowerCase().includes(personal.name.toLowerCase())) {
    errors.push(`Candidate name "${personal.name}" was not found in extracted PDF text.`);
  }

  // Check Email
  if (personal.email && !extractedText.toLowerCase().includes(personal.email.toLowerCase())) {
    errors.push(`Contact email "${personal.email}" was not found in extracted PDF text.`);
  }

  // Check Summary
  if (resumeModel.summary && resumeModel.summary.trim().length > 0) {
    // Check first 40 chars of summary
    const sampleSummary = resumeModel.summary.trim().slice(0, 40).toLowerCase();
    if (!extractedText.toLowerCase().includes(sampleSummary)) {
      warnings.push(`Professional Summary snippet was not detected in extracted PDF text.`);
    }
  }

  // Check Selected Projects & Order
  const projectPositions = [];
  if (Array.isArray(resumeModel.projects)) {
    for (const proj of resumeModel.projects) {
      const projTitle = (proj.title || proj.name || '').toLowerCase();
      const pos = extractedText.toLowerCase().indexOf(projTitle);
      if (pos === -1) {
        errors.push(`Approved project "${proj.title || proj.name}" was not found in extracted PDF text.`);
      } else {
        projectPositions.push({ id: proj.id, name: proj.title || proj.name, pos });
      }

      // Check at least one bullet point
      if (Array.isArray(proj.bullets) && proj.bullets.length > 0) {
        const firstBulletSnippet = proj.bullets[0].slice(0, 30).toLowerCase();
        if (!extractedText.toLowerCase().includes(firstBulletSnippet)) {
          warnings.push(`Project bullet for "${proj.name}" was not found in extracted text.`);
        }
      }
    }

    // Verify Project Display Order
    for (let i = 0; i < projectPositions.length - 1; i++) {
      if (projectPositions[i].pos > projectPositions[i + 1].pos) {
        errors.push(
          `Project order mismatch: "${projectPositions[i].name}" was expected before "${projectPositions[i + 1].name}", but appears after in the extracted PDF text.`
        );
      }
    }
  }

  // Check Professional Experience
  if (Array.isArray(resumeModel.experience)) {
    for (const exp of resumeModel.experience) {
      if (exp.company && !extractedText.toLowerCase().includes(exp.company.toLowerCase())) {
        errors.push(`Experience employer "${exp.company}" was not found in extracted PDF text.`);
      }
    }
  }

  // Check Education
  if (Array.isArray(resumeModel.education)) {
    for (const edu of resumeModel.education) {
      if (edu.institution && !extractedText.toLowerCase().includes(edu.institution.toLowerCase())) {
        errors.push(`Education institution "${edu.institution}" was not found in extracted PDF text.`);
      }
    }
  }

  // ── 3. Reading Order Sequencing Check ──────────────────────────────────────
  // ATS single-column expectations:
  // Name/Contact -> Summary (if present) -> Skills (if present) -> Experience (if present) -> Projects -> Education
  const sectionsToCheck = [
    { name: 'Professional Summary', token: 'professional summary', required: Boolean(resumeModel.summary) },
    { name: 'Technical Skills', token: 'technical skills', required: Array.isArray(resumeModel.skills) && resumeModel.skills.length > 0 },
    { name: 'Professional Experience', token: 'professional experience', required: Array.isArray(resumeModel.experience) && resumeModel.experience.length > 0 },
    { name: 'Projects & Deliverables', token: 'projects', required: Array.isArray(resumeModel.projects) && resumeModel.projects.length > 0 },
    { name: 'Education', token: 'education', required: Array.isArray(resumeModel.education) && resumeModel.education.length > 0 }
  ];

  let lastIndex = -1;
  const sectionPositions = [];

  for (const sec of sectionsToCheck) {
    if (!sec.required) continue;
    const idx = extractedText.toLowerCase().indexOf(sec.token);
    if (idx !== -1) {
      sectionPositions.push({ section: sec.name, index: idx });
      if (idx < lastIndex) {
        errors.push(
          `Reading order anomaly: Section "${sec.name}" (at char ${idx}) appears before previous section (at char ${lastIndex}), indicating broken single-column layout flow.`
        );
      }
      lastIndex = idx;
    }
  }

  // ── 4. Hyperlink Preservation & Scheme Validation ──────────────────────────
  const pdfUris = extractPdfUris(pdfBuffer);
  const validatedLinks = [];

  if (personal.email) {
    const hasEmailUri = pdfUris.some(u => u.toLowerCase().includes(personal.email.toLowerCase()));
    if (!hasEmailUri) {
      warnings.push(`Email link "mailto:${personal.email}" was not detected as an active PDF annotation.`);
    } else {
      validatedLinks.push(`mailto:${personal.email}`);
    }
  }

  if (personal.linkedin) {
    const hasLinkedinUri = pdfUris.some(u => u.toLowerCase().includes('linkedin.com'));
    if (!hasLinkedinUri) {
      warnings.push(`LinkedIn link was not detected as an active PDF annotation.`);
    } else {
      validatedLinks.push(personal.linkedin);
    }
  }

  if (personal.github) {
    const hasGithubUri = pdfUris.some(u => u.toLowerCase().includes('github.com'));
    if (!hasGithubUri) {
      warnings.push(`GitHub link was not detected as an active PDF annotation.`);
    } else {
      validatedLinks.push(personal.github);
    }
  }

  if (Array.isArray(resumeModel.projects)) {
    for (const proj of resumeModel.projects) {
      if (proj.liveUrl) {
        const cleanUrl = proj.liveUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
        const hasProjUri = pdfUris.some(u => u.toLowerCase().includes(cleanUrl.toLowerCase()));
        if (!hasProjUri) {
          warnings.push(`Project live link "${proj.liveUrl}" was not detected as an active PDF annotation.`);
        } else {
          validatedLinks.push(proj.liveUrl);
        }
      }
    }
  }

  // Validate that all detected PDF URIs use safe protocols
  for (const uri of pdfUris) {
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(uri)) {
      errors.push(`Unsafe or invalid URI scheme found in PDF: "${uri}"`);
    }
  }

  const isValid = errors.length === 0;

  return {
    valid: isValid,
    format: 'pdf',
    filePath: resolvedPath,
    fileSize: stats.size,
    pageCount: actualPages,
    expectedPages,
    errors,
    warnings,
    metrics: {
      textLength: extractedText.length,
      detectedPdfUris: pdfUris.length,
      validatedLinksCount: validatedLinks.length,
      sectionOrder: sectionPositions.map(s => s.section)
    }
  };
}

/**
 * Validates a generated DOCX resume file.
 *
 * @param {string} docxPath - Path to DOCX file
 * @param {object} resumeModel - Canonical finalResumeModel
 * @returns {Promise<{
 *   valid: boolean,
 *   format: string,
 *   filePath: string,
 *   fileSize: number,
 *   errors: string[],
 *   warnings: string[],
 *   metrics: object
 * }>}
 */
async function validateDocxResume(docxPath, resumeModel) {
  const errors = [];
  const warnings = [];

  const resolvedPath = path.resolve(docxPath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      valid: false,
      format: 'docx',
      filePath: resolvedPath,
      fileSize: 0,
      errors: [`DOCX file does not exist at: ${resolvedPath}`],
      warnings: [],
      metrics: {}
    };
  }

  const stats = fs.statSync(resolvedPath);
  if (stats.size === 0) {
    return {
      valid: false,
      format: 'docx',
      filePath: resolvedPath,
      fileSize: 0,
      errors: ['DOCX file is completely empty (0 bytes).'],
      warnings: [],
      metrics: {}
    };
  }

  const buf = fs.readFileSync(resolvedPath);
  // Check valid ZIP PK header (0x50, 0x4B, 0x03, 0x04)
  if (buf[0] !== 0x50 || buf[1] !== 0x4B) {
    errors.push('File is not a valid OpenXML ZIP archive (missing PK signature).');
  }

  const bufStr = buf.toString('latin1');
  if (!bufStr.includes('word/document.xml')) {
    errors.push('DOCX archive missing mandatory word/document.xml entry.');
  }

  return {
    valid: errors.length === 0,
    format: 'docx',
    filePath: resolvedPath,
    fileSize: stats.size,
    errors,
    warnings,
    metrics: {
      fileSize: stats.size
    }
  };
}

/**
 * Validates both DOCX and PDF deliverables if available.
 *
 * @param {{ docxPath?: string, pdfPath?: string }} deliverables
 * @param {object} resumeModel - Canonical finalResumeModel
 * @returns {Promise<{
 *   allValid: boolean,
 *   docx?: object,
 *   pdf?: object,
 *   summaryErrors: string[]
 * }>}
 */
async function validateDeliverables(deliverables, resumeModel) {
  const results = {};
  const summaryErrors = [];

  if (deliverables.docxPath) {
    results.docx = await validateDocxResume(deliverables.docxPath, resumeModel);
    if (!results.docx.valid) {
      summaryErrors.push(...results.docx.errors);
    }
  }

  if (deliverables.pdfPath) {
    results.pdf = await validatePdfResume(deliverables.pdfPath, resumeModel);
    if (!results.pdf.valid) {
      summaryErrors.push(...results.pdf.errors);
    }
  }

  const allValid = summaryErrors.length === 0;

  return {
    allValid,
    ...results,
    summaryErrors
  };
}

module.exports = {
  validatePdfResume,
  validateDocxResume,
  validateDeliverables,
  extractPdfUris
};
