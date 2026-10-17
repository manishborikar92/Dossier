/**
 * HTML/CSS Print Template for Headless Microsoft Edge PDF Generation
 *
 * Generates single-column ATS-friendly HTML resumes styled for print output.
 * Fully offline: zero remote fonts, zero CDN links, zero external tracking.
 */

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
  // If protocol-relative or bare domain like linkedin.com/...
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
    const linkText = personal.linkedin.replace(/^https?:\/\/(www\.)?/i, '');
    contactParts.push(`<a href="${linkUrl}">${escapeHtml(linkText)}</a>`);
  }
  if (personal.github) {
    const gitUrl = sanitizeUrl(personal.github);
    const gitText = personal.github.replace(/^https?:\/\/(www\.)?/i, '');
    contactParts.push(`<a href="${gitUrl}">${escapeHtml(gitText)}</a>`);
  }
  if (personal.portfolio) {
    const portUrl = sanitizeUrl(personal.portfolio);
    const portText = personal.portfolio.replace(/^https?:\/\/(www\.)?/i, '');
    contactParts.push(`<a href="${portUrl}">${escapeHtml(portText)}</a>`);
  }

  // Styles tailored specifically for 1-page compact vs 2-page extended
  const css = `
    @page {
      size: letter;
      margin: ${is1Page ? '0.38in 0.45in' : '0.52in 0.58in'};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      background: #ffffff;
      font-size: ${is1Page ? '8.8pt' : '9.5pt'};
      line-height: ${is1Page ? '1.24' : '1.34'};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    a {
      color: #1F3864;
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
      font-size: ${is1Page ? '17pt' : '20pt'};
      font-weight: bold;
      color: #1F3864;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .contact-line {
      font-size: ${is1Page ? '8pt' : '8.8pt'};
      color: #444444;
      line-height: 1.3;
    }

    .contact-line span, .contact-line a {
      margin: 0 4px;
    }

    .contact-line a {
      color: #1F3864;
    }

    .divider {
      border: 0;
      border-top: 1px solid #1F3864;
      margin: ${is1Page ? '4px 0 6px 0' : '6px 0 10px 0'};
    }

    .section {
      margin-bottom: ${is1Page ? '6px' : '10px'};
    }

    .section-title {
      font-size: ${is1Page ? '10pt' : '11pt'};
      font-weight: bold;
      color: #1F3864;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 1.2px solid #1F3864;
      padding-bottom: 1px;
      margin-bottom: ${is1Page ? '3px' : '5px'};
    }

    .summary-text {
      text-align: justify;
      color: #000000;
      font-size: ${is1Page ? '8.6pt' : '9.3pt'};
      line-height: ${is1Page ? '1.24' : '1.34'};
    }

    .skill-row {
      margin-bottom: ${is1Page ? '2px' : '3px'};
      font-size: ${is1Page ? '8.6pt' : '9.2pt'};
    }

    .skill-label {
      font-weight: bold;
      color: #000000;
      display: inline;
    }

    .skill-items {
      color: #222222;
      display: inline;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: ${is1Page ? '3px' : '6px'};
      margin-bottom: 1px;
    }

    .item-title-group {
      font-size: ${is1Page ? '9.2pt' : '10pt'};
    }

    .item-title {
      font-weight: bold;
      color: #000000;
    }

    .item-subtitle {
      color: #444444;
    }

    .item-date {
      font-size: ${is1Page ? '8.2pt' : '8.8pt'};
      color: #444444;
      font-style: italic;
      text-align: right;
      white-space: nowrap;
    }

    .project-tech {
      font-size: ${is1Page ? '8.2pt' : '8.8pt'};
      color: #444444;
      font-style: italic;
      margin-bottom: 2px;
    }

    .project-tech strong {
      font-style: normal;
      color: #333333;
    }

    ul.bullets {
      list-style-type: disc;
      margin-left: ${is1Page ? '14px' : '18px'};
      margin-top: 1px;
      margin-bottom: ${is1Page ? '2px' : '4px'};
    }

    ul.bullets li {
      font-size: ${is1Page ? '8.5pt' : '9.1pt'};
      color: #000000;
      margin-bottom: ${is1Page ? '1.5px' : '2.5px'};
      line-height: ${is1Page ? '1.23' : '1.32'};
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
  <title>${escapeHtml(personal.name || 'Resume')} - ${escapeHtml(model.metadata?.targetRoleTitle || 'Resume')}</title>
  <style>${css}</style>
</head>
<body>
  <div class="header">
    <div class="name">${escapeHtml(personal.name || 'MANISH BORIKAR')}</div>
    <div class="contact-line">
      ${contactParts.join(' • ')}
    </div>
  </div>
  <hr class="divider" />
`;

  // 1. Professional Summary (if populated)
  if (model.summary && model.summary.trim().length > 0) {
    html += `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary-text">${escapeHtml(model.summary)}</div>
  </div>`;
  }

  // 2. Technical Skills (if populated)
  if (Array.isArray(model.skills) && model.skills.length > 0) {
    html += `
  <div class="section">
    <div class="section-title">Technical Skills</div>`;
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
    <div class="section-title">Professional Experience</div>`;
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

  // For 2-page extended, insert clean section break before projects if needed
  const projectPageBreakClass = (!is1Page && (model.experience || []).length >= 2) ? 'avoid-break' : 'avoid-break';

  // 4. Projects & Technical Deliverables (if populated)
  if (Array.isArray(model.projects) && model.projects.length > 0) {
    html += `
  <div class="section ${projectPageBreakClass}">
    <div class="section-title">Projects & Technical Deliverables</div>`;
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
    <div class="section-title">Education</div>`;
    for (const edu of model.education) {
      const gradeText = edu.score ? ` • ${escapeHtml(edu.score)}` : '';
      const locationText = edu.location ? ` — ${escapeHtml(edu.location)}` : '';
      html += `
    <div class="item-header">
      <div class="item-title-group">
        <span class="item-title">${escapeHtml(edu.degree)}</span>
        <span class="item-subtitle"> — ${escapeHtml(edu.institution)}${locationText}</span>
      </div>
      <div class="item-date">${escapeHtml(edu.dates || '')}${gradeText}</div>
    </div>`;
    }
    html += `
  </div>`;
  }

  // 6. Certifications (if populated)
  if (Array.isArray(model.certifications) && model.certifications.length > 0) {
    html += `
  <div class="section avoid-break">
    <div class="section-title">Certifications & Credentials</div>
    <ul class="bullets">`;
    for (const cert of model.certifications) {
      const issuerText = cert.issuer ? ` — ${escapeHtml(cert.issuer)}` : '';
      const yearText = cert.year ? ` (${escapeHtml(cert.year)})` : '';
      html += `
      <li><strong>${escapeHtml(cert.name)}</strong>${issuerText}${yearText}</li>`;
    }
    html += `
    </ul>
  </div>`;
  }

  // 7. Leadership & Activities (if populated)
  if (Array.isArray(model.leadership) && model.leadership.length > 0) {
    html += `
  <div class="section avoid-break">
    <div class="section-title">Leadership & Activities</div>
    <ul class="bullets">`;
    for (const lead of model.leadership) {
      const text = typeof lead === 'string' ? lead : (lead.title || lead.description || '');
      if (text) {
        html += `
      <li>${escapeHtml(text)}</li>`;
      }
    }
    html += `
    </ul>
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
  generateResumeHtml
};
