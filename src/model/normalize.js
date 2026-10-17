/**
 * Canonical Data Normalization and Contract Invariant Validation.
 *
 * Provides pure, deterministic normalization functions that enforce
 * the canonical resume data model across all application layers.
 * Eliminates duplicated parsing logic across session state and exporters.
 */

/**
 * Normalizes a certification entry from diverse source formats (strings or objects)
 * into the canonical certification contract: { name, issuer, year, raw }.
 *
 * @param {string|object} cert - Raw certification entry
 * @returns {{ name: string, issuer: string, year: string, raw: string } | null}
 */
function normalizeCertification(cert) {
  if (!cert) return null;

  if (typeof cert === 'string') {
    const raw = cert.trim();
    if (!raw) return null;

    let text = raw;
    let year = '';
    let issuer = '';
    let name = '';

    // 1. Extract 4-digit year at end, preceded by bullet, dot, dash, comma or in parentheses
    const yearMatch = text.match(/(?:[·•\-|,]|\s+)\s*\(?(\b(?:19|20)\d{2}\b)\)?\s*$/);
    if (yearMatch) {
      year = yearMatch[1];
      text = text.slice(0, yearMatch.index).trim();
    } else {
      const parenMatch = text.match(/\((\b(?:19|20)\d{2}\b)\)\s*$/);
      if (parenMatch) {
        year = parenMatch[1];
        text = text.slice(0, parenMatch.index).trim();
      }
    }

    // 2. Extract issuer if separated by em-dash (—), en-dash (–), or spaced hyphen ( - )
    const dashMatch = text.match(/\s*(?:—|–|\s-\s)\s*/);
    if (dashMatch) {
      const splitIdx = dashMatch.index;
      name = text.slice(0, splitIdx).trim();
      issuer = text.slice(splitIdx + dashMatch[0].length).trim();
    } else {
      name = text.trim();
    }

    if (!name && !raw) return null;

    return {
      name: name || raw,
      issuer: issuer || '',
      year: year || '',
      raw
    };
  }

  if (typeof cert === 'object') {
    const name = (cert.name || cert.title || cert.credentialName || '').trim();
    const issuer = (cert.issuer || cert.organization || cert.issuingOrganization || cert.institution || '').trim();
    const year = cert.year ? String(cert.year).trim() : (cert.date ? String(cert.date).trim() : '');
    const raw = cert.raw || (name ? `${name}${issuer ? ' — ' + issuer : ''}${year ? ' · ' + year : ''}` : '');

    if (!name && !issuer && !year) {
      return null;
    }

    return {
      name: name || issuer || 'Certification',
      issuer,
      year,
      raw
    };
  }

  return null;
}

/**
 * Normalizes an education item.
 *
 * @param {object} edu - Raw education entry
 * @returns {object} Canonical education entry
 */
function normalizeEducation(edu) {
  if (!edu || typeof edu !== 'object') return null;
  const degree = (edu.degree || edu.title || '').trim();
  const institution = (edu.institution || edu.school || edu.university || '').trim();
  const dates = (edu.dates || edu.year || '').trim();
  const details = (edu.details || edu.score || edu.gpa || '').trim();

  if (!degree && !institution) return null;

  return {
    degree,
    institution,
    dates,
    details,
    score: details
  };
}

/**
 * Normalizes a work experience item.
 *
 * @param {object} exp - Raw experience entry
 * @param {number} [maxBullets=4] - Max bullet count for page budget
 * @returns {object} Canonical experience entry
 */
function normalizeExperience(exp, maxBullets = 5) {
  if (!exp || typeof exp !== 'object') return null;
  const role = (exp.role || exp.title || '').trim();
  const company = (exp.company || exp.employer || exp.organization || '').trim();
  const dates = (exp.dates || exp.duration || '').trim();
  const location = (exp.location || '').trim();
  const rawBullets = Array.isArray(exp.bullets) ? exp.bullets : [];
  const bullets = rawBullets
    .filter(b => typeof b === 'string' && b.trim().length > 0)
    .map(b => b.trim())
    .slice(0, maxBullets);

  if (!role && !company) return null;

  return {
    id: exp.id || company.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    role,
    company,
    dates,
    location,
    bullets
  };
}

/**
 * Normalizes a project item.
 *
 * @param {object} proj - Project entry from session state
 * @param {number} [maxBullets=4] - Max bullet count for page budget
 * @returns {object} Canonical project entry
 */
function normalizeProject(proj, maxBullets = 4) {
  if (!proj || typeof proj !== 'object') return null;
  const id = proj.id || (proj.name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const name = (proj.name || id).trim();
  const title = (proj.title || name).trim();
  const technologies = Array.isArray(proj.technologies)
    ? proj.technologies.filter(t => typeof t === 'string' && t.trim().length > 0)
    : [];
  const techSummary = proj.techSummary || technologies.slice(0, 8).join(', ');
  const liveUrl = (proj.liveUrl || proj.live_url || '').trim() || null;
  const year = (proj.year || (proj.lastCommit ? proj.lastCommit.slice(0, 4) : '2026')).trim();
  const rawBullets = Array.isArray(proj.bullets) ? proj.bullets : [];
  const bullets = rawBullets
    .filter(b => typeof b === 'string' && b.trim().length > 0)
    .map(b => b.trim())
    .slice(0, maxBullets);

  return {
    id,
    name,
    title,
    technologies,
    techSummary,
    liveUrl,
    year,
    bullets,
    scores: proj.scores || null
  };
}

/**
 * Validates canonical resume model invariants prior to document generation.
 * Throws actionable errors if model invariants are broken.
 *
 * @param {object} model - Canonical finalResumeModel
 */
function validateCanonicalModel(model) {
  if (!model || typeof model !== 'object') {
    throw new Error('Invalid resumeModel: Model must be a non-null object.');
  }

  // 1. Personal & Contact Invariants
  if (!model.personal || typeof model.personal !== 'object') {
    throw new Error('Invalid resumeModel: Missing mandatory "personal" contact information.');
  }
  if (!model.personal.name || typeof model.personal.name !== 'string' || model.personal.name.trim().length === 0) {
    throw new Error('Invalid resumeModel: "personal.name" is required and cannot be empty.');
  }
  if (!model.personal.email || typeof model.personal.email !== 'string' || model.personal.email.trim().length === 0) {
    throw new Error('Invalid resumeModel: "personal.email" is required for contact identification.');
  }

  // 2. Metadata Invariants
  if (!model.metadata || typeof model.metadata !== 'object') {
    throw new Error('Invalid resumeModel: Missing mandatory "metadata" section.');
  }
  const validLengths = ['1page', '2page'];
  if (!validLengths.includes(model.metadata.resumeLength)) {
    throw new Error(`Invalid resumeModel: "metadata.resumeLength" must be one of ${JSON.stringify(validLengths)}.`);
  }

  // 3. Projects Invariants (if populated)
  if (Array.isArray(model.projects)) {
    for (let i = 0; i < model.projects.length; i++) {
      const p = model.projects[i];
      if (!p || typeof p !== 'object') {
        throw new Error(`Invalid resumeModel: Project at index ${i} is not a valid object.`);
      }
      if (!p.id || !p.name) {
        throw new Error(`Invalid resumeModel: Project at index ${i} is missing mandatory "id" or "name".`);
      }
      if (!Array.isArray(p.bullets) || p.bullets.length === 0) {
        throw new Error(`Invalid resumeModel: Project "${p.name}" has no bullet points.`);
      }
    }
  }

  // 4. Certifications Invariants (if populated)
  if (Array.isArray(model.certifications)) {
    for (let i = 0; i < model.certifications.length; i++) {
      const c = model.certifications[i];
      if (!c) {
        throw new Error(`Invalid resumeModel: Certification at index ${i} is empty.`);
      }
      if (typeof c === 'string') {
        if (c.trim().length === 0) {
          throw new Error(`Invalid resumeModel: Certification at index ${i} cannot be an empty string.`);
        }
      } else if (typeof c === 'object') {
        const hasName = typeof c.name === 'string' && c.name.trim().length > 0;
        const hasRaw = typeof c.raw === 'string' && c.raw.trim().length > 0;
        if (!hasName && !hasRaw) {
          throw new Error(`Invalid resumeModel: Certification at index ${i} must have a non-empty "name" or "raw" property.`);
        }
      } else {
        throw new Error(`Invalid resumeModel: Certification at index ${i} is not a valid string or object.`);
      }
    }
  }

  return true;
}

module.exports = {
  normalizeCertification,
  normalizeEducation,
  normalizeExperience,
  normalizeProject,
  validateCanonicalModel
};
