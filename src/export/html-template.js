/**
 * HTML/CSS Print Template for Headless Microsoft Edge PDF Generation
 *
 * Generates single-column ATS-friendly HTML resumes styled for print output.
 * Fully offline: zero remote fonts, zero CDN links, zero external tracking.
 * Consumes authoritative design tokens from ./design-spec.js and canonical
 * normalization helpers from ../model/normalize.js.
 */

const {
  COLORS,
  TYPOGRAPHY,
  PAGE,
  SPACING,
  BORDERS,
  BULLETS,
  SECTIONS,
  DEFAULT_ROLE_TITLE
} = require('./design-spec');

const {
  normalizeCertification,
  validateCanonicalModel
} = require('../model/normalize');

/**
 * Escapes HTML characters to prevent XSS and malformed markup.
 *
 * @param {string} str - Raw string
 * @returns {string} Escaped HTML string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and normalizes URLs to safe protocols (https, http, mailto, tel).
 *
 * @param {string} url - Candidate URL
 * @returns {string} Sanitized URL or empty string if invalid/unsafe
 */
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
 * Generates an HTML document tailored for printing via Headless Edge.
 *
 * @param {object} model - Canonical finalResumeModel
 * @returns {string} Complete HTML document string
 */
function generateResumeHtml(model) {
  if (!model || typeof model !== 'object') {
    throw new Error('Invalid resumeModel provided to generateResumeHtml.');
  }

  // Validate canonical schema invariants
  validateCanonicalModel(model);

  const is1Page = model.metadata?.resumeLength === '1page';
  const personal = model.personal || {};

  // Build contact line items
  const contactParts = [];
  if (personal.location) {
    contactParts.push(`<span>${escapeHtml(personal.location)}</span>`);
  }
  if (personal.email) {
    const emailUrl = sanitizeUrl(`mailto:${personal.email}`);
    contactParts.push(`<a href="${emailUrl}">${escapeHtml(personal.email)}</a>`);
  }
  if (personal.phone) {
    const phoneUrl = sanitizeUrl(`tel:${personal.phone.replace(/\s+/g, '')}`);
    contactParts.push(`<a href="${phoneUrl}">${escapeHtml(personal.phone)}</a>`);
  }
  if (personal.linkedin) {
    const linkUrl = sanitizeUrl(personal.linkedin);
    let linkText = personal.linkedin.replace(/^https?:\/\/(www\.)?/i, '').replace(/^linkedin\.com\//i, '');
    if (!linkText.startsWith('in/')) {
      linkText = 'in/' + linkText;
    }
    contactParts.push(`<a href="${linkUrl}">${escapeHtml(linkText)}</a>`);
  }
  if (personal.github) {
    const gitUrl = sanitizeUrl(personal.github);
    let gitText = personal.github.replace(/^https?:\/\/(www\.)?/i, '').replace(/^github\.com\//i, '');
    if (!gitText.startsWith('github/')) {
      gitText = 'github/' + gitText;
    }
    contactParts.push(`<a href="${gitUrl}">${escapeHtml(gitText)}</a>`);
  }
  if (personal.portfolio) {
    const portUrl = sanitizeUrl(personal.portfolio);
    const portText = personal.portfolio.replace(/^https?:\/\/(www\.)?/i, '');
    contactParts.push(`<a href="${portUrl}">${escapeHtml(portText)}</a>`);
  }

  const pageMargin = is1Page ? '0.38in 0.45in' : '0.45in 0.50in';
  const nameSize = is1Page ? TYPOGRAPHY.onePage.name.pt : TYPOGRAPHY.twoPage.name.pt;
  const sectionHeaderSize = is1Page ? TYPOGRAPHY.onePage.sectionHeader.pt : TYPOGRAPHY.twoPage.sectionHeader.pt;
  const itemTitleSize = is1Page ? TYPOGRAPHY.onePage.itemTitle.pt : TYPOGRAPHY.twoPage.itemTitle.pt;
  const bodySize = is1Page ? TYPOGRAPHY.onePage.body.pt : TYPOGRAPHY.twoPage.body.pt;
  const metaSize = is1Page ? TYPOGRAPHY.onePage.meta.pt : TYPOGRAPHY.twoPage.meta.pt;
  const contactSize = is1Page ? TYPOGRAPHY.onePage.contact.pt : TYPOGRAPHY.twoPage.contact.pt;

  const css = `
    @page {
      size: ${PAGE.size};
      margin: ${pageMargin};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: ${TYPOGRAPHY.fontFamilyFallback};
      color: #${COLORS.BLACK};
      background: #${COLORS.WHITE};
      font-size: ${bodySize}pt;
      line-height: ${is1Page ? '1.24' : '1.28'};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    a {
      color: #${COLORS.ACCENT};
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .header {
      text-align: center;
      margin-bottom: ${is1Page ? '4px' : '8px'};
    }

    .name {
      font-size: ${nameSize}pt;
      font-weight: bold;
      color: #${COLORS.ACCENT};
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .contact-line {
      font-size: ${contactSize}pt;
      color: #${COLORS.GRAY};
      line-height: 1.3;
    }

    .contact-line span, .contact-line a {
      margin: 0 4px;
    }

    .contact-line a {
      color: #${COLORS.GRAY};
    }

    .divider {
      border: 0;
      border-top: ${BORDERS.divider.cssSize} solid #${BORDERS.divider.color};
      margin: ${is1Page ? '4px 0 6px 0' : '6px 0 10px 0'};
    }

    .section {
      margin-bottom: ${is1Page ? '5px' : '7px'};
    }

    .section-title {
      font-size: ${sectionHeaderSize}pt;
      font-weight: bold;
      color: #${COLORS.ACCENT};
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: ${BORDERS.sectionUnderline.cssSize} solid #${BORDERS.sectionUnderline.color};
      padding-bottom: 1px;
      margin-bottom: ${is1Page ? '3px' : '4px'};
    }

    .summary-text {
      text-align: justify;
      color: #${COLORS.BLACK};
      font-size: ${bodySize}pt;
      line-height: ${is1Page ? '1.24' : '1.28'};
    }

    .skill-row {
      margin-bottom: ${is1Page ? '2px' : '2.5px'};
      font-size: ${bodySize}pt;
    }

    .skill-label {
      font-weight: bold;
      color: #${COLORS.BLACK};
      display: inline;
    }

    .skill-items {
      color: #${COLORS.SUBTLE};
      display: inline;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: ${is1Page ? '3px' : '5px'};
      margin-bottom: 1px;
    }

    .item-title-group {
      font-size: ${itemTitleSize}pt;
    }

    .item-title {
      font-weight: bold;
      color: #${COLORS.BLACK};
    }

    .item-subtitle {
      color: #${COLORS.GRAY};
    }

    .item-date {
      font-size: ${metaSize}pt;
      color: #${COLORS.GRAY};
      font-style: italic;
      text-align: right;
      white-space: nowrap;
    }

    .item-gray-line {
      font-size: ${metaSize}pt;
      color: #${COLORS.GRAY};
      margin-top: 1px;
      margin-bottom: ${is1Page ? '2px' : '3px'};
    }

    .project-tech {
      font-size: ${metaSize}pt;
      color: #${COLORS.GRAY};
      font-style: italic;
      margin-bottom: 2px;
    }

    .project-tech strong {
      font-style: normal;
      color: #${COLORS.GRAY};
    }

    ul.bullets {
      list-style-type: disc;
      margin-left: ${BULLETS.leftIndentInches}in;
      margin-top: 1px;
      margin-bottom: ${is1Page ? '2px' : '3px'};
    }

    ul.bullets li {
      font-size: ${bodySize}pt;
      color: #${COLORS.BLACK};
      margin-bottom: ${is1Page ? '1.5px' : '1.8px'};
      line-height: ${is1Page ? '1.23' : '1.27'};
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  `;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(personal.name || 'Resume')} - ${escapeHtml(model.metadata?.targetRoleTitle || DEFAULT_ROLE_TITLE)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="header">
    <div class="name">${escapeHtml(personal.name || 'MANISH BORIKAR')}</div>
    <div class="contact-line">
      ${contactParts.join('  \u00B7  ')}
    </div>
  </div>
  <hr class="divider" />
`;

  // 1. Professional Summary (if populated)
  if (model.summary && model.summary.trim().length > 0) {
    html += `
  <div class="section">
    <div class="section-title">${SECTIONS.titles.summary}</div>
    <div class="summary-text">${escapeHtml(model.summary)}</div>
  </div>`;
  }

  // 2. Technical Skills (if populated)
  if (Array.isArray(model.skills) && model.skills.length > 0) {
    html += `
  <div class="section">
    <div class="section-title">${SECTIONS.titles.skills}</div>`;
    for (const skillCat of model.skills) {
      const itemsStr = Array.isArray(skillCat.items) ? skillCat.items.join(', ') : '';
      if (itemsStr.length > 0) {
        html += `
    <div class="skill-row">
      <div class="skill-label">${escapeHtml(skillCat.label || skillCat.category)}: </div>
      <div class="skill-items">${escapeHtml(itemsStr)}</div>
    </div>`;
      }
    }
    html += `
  </div>`;
  }

  // 3. Professional Experience (if populated)
  if (Array.isArray(model.experience) && model.experience.length > 0) {
    html += `
  <div class="section">
    <div class="section-title">${SECTIONS.titles.experience}</div>`;
    for (const exp of model.experience) {
      const locationText = exp.location ? ` (${escapeHtml(exp.location)})` : '';
      html += `
    <div class="avoid-break">
      <div class="item-header">
        <div class="item-title-group">
          <span class="item-title">${escapeHtml(exp.role)}</span>
          <span class="item-subtitle"> — ${escapeHtml(exp.company)}${locationText}</span>
        </div>
        <div class="item-date">${escapeHtml(exp.dates || '')}</div>
      </div>`;
      if (Array.isArray(exp.bullets) && exp.bullets.length > 0) {
        html += `
      <ul class="bullets">`;
        for (const bullet of exp.bullets) {
          html += `
        <li>${escapeHtml(bullet)}</li>`;
        }
        html += `
      </ul>`;
      }
      html += `
    </div>`;
    }
    html += `
  </div>`;
  }

  // 4. Projects & Technical Deliverables (if populated)
  if (Array.isArray(model.projects) && model.projects.length > 0) {
    const projectBreakClass = is1Page ? 'avoid-break' : 'page-break';
    html += `
  <div class="section ${projectBreakClass}">
    <div class="section-title">${SECTIONS.titles.projects}</div>`;
    for (const proj of model.projects) {
      const liveLink = proj.liveUrl ? sanitizeUrl(proj.liveUrl) : null;
      const liveLinkHtml = liveLink
        ? ` <span class="item-subtitle"> | </span><a href="${liveLink}" target="_blank">${escapeHtml(proj.liveUrl)}</a>`
        : '';
      html += `
    <div class="avoid-break">
      <div class="item-header">
        <div class="item-title-group">
          <span class="item-title">${escapeHtml(proj.title || proj.name)}</span>${liveLinkHtml}
        </div>
        <div class="item-date">${escapeHtml(proj.year || '2026')}</div>
      </div>`;
      if (proj.techSummary || (proj.technologies && proj.technologies.length > 0)) {
        const techStr = proj.techSummary || proj.technologies.slice(0, 5).join(', ');
        html += `
      <div class="project-tech"><strong>Tech Stack:</strong> ${escapeHtml(techStr)}</div>`;
      }
      if (Array.isArray(proj.bullets) && proj.bullets.length > 0) {
        html += `
      <ul class="bullets">`;
        for (const bullet of proj.bullets) {
          html += `
        <li>${escapeHtml(bullet)}</li>`;
        }
        html += `
      </ul>`;
      }
      html += `
    </div>`;
    }
    html += `
  </div>`;
  }

  // 5. Education (if populated)
  if (Array.isArray(model.education) && model.education.length > 0) {
    html += `
  <div class="section avoid-break">
    <div class="section-title">${SECTIONS.titles.education}</div>`;
    for (const edu of model.education) {
      const sublineParts = [edu.institution, edu.location, edu.details || edu.score].filter(Boolean);
      const sublineText = sublineParts.join('  |  ');
      html += `
    <div class="avoid-break">
      <div class="item-header">
        <div class="item-title-group">
          <span class="item-title">${escapeHtml(edu.degree)}</span>
        </div>
        <div class="item-date">${escapeHtml(edu.dates || '')}</div>
      </div>`;
      if (sublineText) {
        html += `
      <div class="item-gray-line">${escapeHtml(sublineText)}</div>`;
      }
      html += `
    </div>`;
    }
    html += `
  </div>`;
  }

  // 6. Certifications (if populated)
  if (Array.isArray(model.certifications) && model.certifications.length > 0) {
    const certItems = [];
    for (const rawCert of model.certifications) {
      const cert = normalizeCertification(rawCert);
      if (!cert || (!cert.name && !cert.raw)) continue;
      const fullText = cert.raw || [cert.name, cert.issuer, cert.year].filter(Boolean).join(' — ');
      certItems.push(`<li>${escapeHtml(fullText)}</li>`);
    }
    if (certItems.length > 0) {
      html += `
  <div class="section avoid-break">
    <div class="section-title">${SECTIONS.titles.certifications}</div>
    <ul class="bullets">
      ${certItems.join('\n      ')}
    </ul>
  </div>`;
    }
  }

  // 7. Leadership & Activities (if populated)
  if (Array.isArray(model.leadership) && model.leadership.length > 0) {
    html += `
  <div class="section avoid-break">
    <div class="section-title">${SECTIONS.titles.leadership}</div>`;
    for (const lead of model.leadership) {
      if (typeof lead === 'string') {
        html += `
    <ul class="bullets">
      <li>${escapeHtml(lead)}</li>
    </ul>`;
      } else if (lead && typeof lead === 'object') {
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
        html += `
    <div class="avoid-break">
      <div class="item-header">
        <div class="item-title-group">
          <span class="item-title">${escapeHtml(lead.title || '')}</span>
        </div>
        <div class="item-date">${escapeHtml(lead.dates || '')}</div>
      </div>`;
        if (desc) {
          html += `
      <div class="item-gray-line">${escapeHtml(desc)}</div>`;
        }
        html += `
    </div>`;
      }
    }
    html += `
  </div>`;
  }

  html += `
</body>
</html>`;

  return html;
}

module.exports = {
  escapeHtml,
  sanitizeUrl,
  normalizeCertification,
  generateResumeHtml
};
