const fs = require('fs');
const path = require('path');

/**
 * Normalizes file paths for reliable cross-platform comparison.
 */
function normalizePath(p) {
  if (!p) return '';
  return path.resolve(p).toLowerCase().replace(/\\/g, '/');
}

/**
 * Loads the master knowledge base from InternalDocs if available.
 *
 * @param {string} internalDocsRoot - Path to InternalDocs root
 * @returns {Array<object>} Array of catalog project objects, or empty array
 */
function loadMasterKnowledgeBase(internalDocsRoot) {
  const jsonPath = path.join(internalDocsRoot, 'reference', 'project_knowledge_base.json');
  if (!fs.existsSync(jsonPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Merges freshly scanned project evidence with master catalog entries,
 * strictly separating physical availability, discovery classification,
 * resume eligibility, and historical status.
 *
 * @param {Array<object>} scannedProjects - Resume-eligible projects inspected from disk
 * @param {Array<object>} excludedDirectories - Directories excluded from resume candidacy
 * @param {string} internalDocsRoot - Path to InternalDocs
 * @param {object|null} existingCatalog - Previously cached catalog data if available
 * @returns {object} { catalog: Array<object>, stats: object }
 */
function mergeProjectCatalogs(scannedProjects, excludedDirectories = [], internalDocsRoot = '', existingCatalog = null) {
  const masterEntries = loadMasterKnowledgeBase(internalDocsRoot);
  const masterByPath = new Map();
  const masterByName = new Map();

  for (const entry of masterEntries) {
    if (entry.local_path) {
      masterByPath.set(normalizePath(entry.local_path), entry);
    }
    if (entry.name) {
      masterByName.set(entry.name.toLowerCase(), entry);
    }
    if (entry.id) {
      masterByName.set(entry.id.toLowerCase(), entry);
    }
  }

  const mergedCatalog = [];
  const processedMasterIds = new Set();

  let matchedResumeCount = 0;
  let newDiscoveredCount = 0;
  let referenceExcludedCount = 0;
  let missingHistoricalCount = 0;

  // 1. Process all resume-eligible projects on disk
  for (const scanned of scannedProjects) {
    const normScannedPath = normalizePath(scanned.localPath);
    const scannedName = scanned.name.toLowerCase();

    // Match in master catalog
    let masterMatch = masterByPath.get(normScannedPath) || masterByName.get(scannedName);

    if (masterMatch) {
      processedMasterIds.add(masterMatch.id || masterMatch.name);
      matchedResumeCount++;

      const techSet = new Set([
        ...(scanned.technologies || []),
        ...(masterMatch.primary_technologies || [])
      ]);

      const liveUrl = masterMatch.live_url || scanned.liveUrls?.[0] || null;

      mergedCatalog.push({
        id: masterMatch.id || scanned.name.toLowerCase(),
        name: masterMatch.name || scanned.name,
        title: masterMatch.title || scanned.title || scanned.name,
        rank: masterMatch.rank || null,
        score: masterMatch.score || null,
        score_breakdown: masterMatch.score_breakdown || null,
        purpose: masterMatch.purpose || scanned.purpose || null,
        primary_technologies: Array.from(techSet).sort(),
        architecture: masterMatch.architecture || (scanned.isMonorepo ? 'Monorepo application architecture' : 'Standalone architecture'),
        technical_analysis: masterMatch.technical_analysis || null,
        key_implementation_details: masterMatch.key_implementation_details || null,
        source_code_evidence: scanned.evidenceFiles?.length > 0 ? scanned.evidenceFiles.join(', ') : masterMatch.source_code_evidence || null,
        live_url: liveUrl,
        url_type: masterMatch.url_type || (liveUrl ? 'Production Web Application' : null),
        live_deployed_evidence: masterMatch.live_deployed_evidence || (liveUrl ? `Live deployment URL: ${liveUrl}` : null),
        resume_entry: masterMatch.resume_entry || {
          resume_title: masterMatch.title || scanned.name,
          tech_stack_summary: Array.from(techSet).slice(0, 6).join(', '),
          year: scanned.git?.lastCommit ? scanned.git.lastCommit.slice(0, 4) : '2026',
          bullets: []
        },
        important_file_references: masterMatch.important_file_references || scanned.evidenceFiles || [],
        year: masterMatch.year || (scanned.git?.lastCommit ? scanned.git.lastCommit.slice(0, 4) : '2026'),
        first_commit: scanned.git?.firstCommit || masterMatch.first_commit || null,
        last_commit: scanned.git?.lastCommit || masterMatch.last_commit || null,
        commit_count: scanned.git?.isGit ? scanned.git.commitCount : (masterMatch.commit_count || 0),
        local_path: scanned.localPath,

        // ── 4-Way Status Distinction ─────────────────────────────────────────
        physical_availability: true,
        available_locally: true,
        discovery_classification: scanned.isMonorepo ? 'monorepo' : (scanned.type === 'utility' ? 'utility' : 'standalone_project'),
        resume_eligibility: true,
        is_resume_candidate: true,
        historical_status: 'current_codebase',
        evidence_source: 'merged',

        is_monorepo: scanned.isMonorepo,
        subcomponents: scanned.subcomponents || [],
        fingerprint: scanned.fingerprint,
        analyzed_at: new Date().toISOString()
      });
    } else {
      // Newly discovered on disk
      newDiscoveredCount++;
      const techSet = new Set(scanned.technologies || []);
      const liveUrl = scanned.liveUrls?.[0] || null;

      mergedCatalog.push({
        id: scanned.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: scanned.name,
        title: scanned.title || scanned.name,
        rank: null,
        score: null,
        score_breakdown: null,
        purpose: scanned.purpose || 'Discovered software project repository',
        primary_technologies: Array.from(techSet).sort(),
        architecture: scanned.isMonorepo
          ? `Monorepo platform with subcomponents: ${scanned.subcomponents.map(s => s.name).join(', ')}`
          : 'Standalone software repository',
        technical_analysis: null,
        key_implementation_details: null,
        source_code_evidence: scanned.evidenceFiles?.join(', ') || null,
        live_url: liveUrl,
        url_type: liveUrl ? 'Production Web Application' : null,
        live_deployed_evidence: liveUrl ? `Live deployment URL found in documentation: ${liveUrl}` : null,
        resume_entry: {
          resume_title: scanned.title || scanned.name,
          tech_stack_summary: Array.from(techSet).slice(0, 6).join(', '),
          year: scanned.git?.lastCommit ? scanned.git.lastCommit.slice(0, 4) : '2026',
          bullets: []
        },
        important_file_references: scanned.evidenceFiles || [],
        year: scanned.git?.lastCommit ? scanned.git.lastCommit.slice(0, 4) : '2026',
        first_commit: scanned.git?.firstCommit || null,
        last_commit: scanned.git?.lastCommit || null,
        commit_count: scanned.git?.commitCount || 0,
        local_path: scanned.localPath,

        // ── 4-Way Status Distinction ─────────────────────────────────────────
        physical_availability: true,
        available_locally: true,
        discovery_classification: scanned.isMonorepo ? 'monorepo' : (scanned.type === 'utility' ? 'utility' : 'standalone_project'),
        resume_eligibility: true,
        is_resume_candidate: true,
        historical_status: 'newly_discovered',
        evidence_source: 'codebase',

        is_monorepo: scanned.isMonorepo,
        subcomponents: scanned.subcomponents || [],
        fingerprint: scanned.fingerprint,
        analyzed_at: new Date().toISOString()
      });
    }
  }

  // 2. Process excluded directories that exist physically on disk
  // (e.g. InternalDocs, Notes, manishborikar92)
  for (const exc of excludedDirectories) {
    const normExcPath = normalizePath(exc.path);
    const excName = exc.name.toLowerCase();

    // Check if this excluded directory was in the master catalog
    const masterMatch = masterByPath.get(normExcPath) || masterByName.get(excName);

    if (masterMatch) {
      processedMasterIds.add(masterMatch.id || masterMatch.name);
      referenceExcludedCount++;

      mergedCatalog.push({
        ...masterMatch,
        local_path: exc.path,

        // ── 4-Way Status Distinction ─────────────────────────────────────────
        physical_availability: true, // It physically exists on disk!
        available_locally: true,
        discovery_classification: 'reference_directory',
        resume_eligibility: false, // NOT eligible for resume project selection
        is_resume_candidate: false,
        historical_status: 'reference_catalog_entry',
        evidence_source: 'internal_docs',
        exclusion_reason: exc.reason || 'Engineering reference or documentation; excluded from resume candidates',

        analyzed_at: new Date().toISOString()
      });
    }
  }

  // 3. Process remaining historical master catalog entries NOT found on disk
  for (const master of masterEntries) {
    const key = master.id || master.name;
    if (!processedMasterIds.has(key)) {
      missingHistoricalCount++;

      // Distinguish sub-modules, superseded projects, and practice repos
      let classification = 'archived_project';
      let historicalStatus = 'missing_on_disk';
      let missingReason = 'Directory not found at root of projects directory';

      const lowerId = (master.id || '').toLowerCase();
      if (lowerId === 'merchant' || lowerId === 'evercut-customer') {
        classification = 'nested_component';
        historicalStatus = 'subsumed_by_parent';
        missingReason = 'Historical extraction sub-module belonging to EverCut platform';
      } else if (lowerId === 'regimen') {
        classification = 'archived_project';
        historicalStatus = 'superseded_project';
        missingReason = 'Predecessor habit-tracking application; superseded by Vritta';
      } else if (lowerId === 'frontend-projects' || lowerId === 'git-and-github-commands') {
        classification = 'practice_repository';
        historicalStatus = 'missing_on_disk';
        missingReason = 'Historical learning exercises or cheat sheet repository';
      }

      mergedCatalog.push({
        ...master,

        // ── 4-Way Status Distinction ─────────────────────────────────────────
        physical_availability: false, // Truly missing from disk
        available_locally: false,
        discovery_classification: classification,
        resume_eligibility: false,
        is_resume_candidate: false,
        historical_status: historicalStatus,
        evidence_source: 'internal_docs',
        missing_reason: missingReason,

        analyzed_at: new Date().toISOString()
      });
    }
  }

  return {
    catalog: mergedCatalog,
    stats: {
      totalCatalogEntries: mergedCatalog.length,
      physicallyAvailable: scannedProjects.length + referenceExcludedCount,
      resumeEligible: scannedProjects.length,
      matchedResumeProjects: matchedResumeCount,
      newlyDiscoveredProjects: newDiscoveredCount,
      referenceDirectoriesOnDisk: referenceExcludedCount,
      missingHistoricalEntries: missingHistoricalCount
    }
  };
}

/**
 * Saves the catalog to data/catalog.json.
 */
function saveCatalog(catalogData, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(catalogData, null, 2), 'utf8');
}

/**
 * Loads the existing catalog cache if available.
 */
function loadCatalogCache(cachePath) {
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  normalizePath,
  loadMasterKnowledgeBase,
  mergeProjectCatalogs,
  saveCatalog,
  loadCatalogCache
};
