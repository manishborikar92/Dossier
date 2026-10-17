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
  } catch (err) {
    return [];
  }
}

/**
 * Merges freshly scanned project evidence with master catalog entries and cached state.
 *
 * @param {Array<object>} scannedProjects - Projects inspected from disk
 * @param {string} internalDocsRoot - Path to InternalDocs
 * @param {object|null} existingCatalog - Previously cached catalog data if available
 * @returns {object} { catalog: Array<object>, stats: object }
 */
function mergeProjectCatalogs(scannedProjects, internalDocsRoot, existingCatalog = null) {
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
  const matchedMasterIds = new Set();

  let matchedCount = 0;
  let newDiscoveredCount = 0;

  // 1. Process all scanned projects on disk
  for (const scanned of scannedProjects) {
    const normScannedPath = normalizePath(scanned.localPath);
    const scannedName = scanned.name.toLowerCase();

    // Find match in master catalog
    let masterMatch = masterByPath.get(normScannedPath) || masterByName.get(scannedName);

    if (masterMatch) {
      matchedMasterIds.add(masterMatch.id || masterMatch.name);
      matchedCount++;

      // Combine technologies from code manifests and catalog
      const techSet = new Set([
        ...(scanned.technologies || []),
        ...(masterMatch.primary_technologies || [])
      ]);

      // Prioritize verified production deployment URLs from master knowledge base
      const liveUrl = masterMatch.live_url || scanned.liveUrls?.[0] || null;

      mergedCatalog.push({
        id: masterMatch.id || scanned.name.toLowerCase(),
        name: masterMatch.name || scanned.name,
        title: masterMatch.title || scanned.title || scanned.name,
        rank: masterMatch.rank || null,
        score: masterMatch.score || null,
        score_breakdown: masterMatch.score_breakdown || null,
        purpose: scanned.purpose || masterMatch.purpose || null,
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
        available_locally: true,
        availability_status: 'verified_on_disk',
        evidence_source: 'merged',
        is_monorepo: scanned.isMonorepo,
        subcomponents: scanned.subcomponents || [],
        fingerprint: scanned.fingerprint,
        analyzed_at: new Date().toISOString()
      });
    } else {
      // Newly discovered project on disk
      newDiscoveredCount++;
      const techSet = new Set(scanned.technologies || []);
      const liveUrl = scanned.liveUrls?.[0] || null;

      mergedCatalog.push({
        id: scanned.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: scanned.name,
        title: scanned.title || scanned.name,
        rank: null, // Scored in Phase 3
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
        available_locally: true,
        availability_status: 'newly_discovered',
        evidence_source: 'codebase',
        is_monorepo: scanned.isMonorepo,
        subcomponents: scanned.subcomponents || [],
        fingerprint: scanned.fingerprint,
        analyzed_at: new Date().toISOString()
      });
    }
  }

  // 2. Preserve historical catalog entries whose directories are missing on disk
  let historicalPreservedCount = 0;
  for (const master of masterEntries) {
    const key = master.id || master.name;
    if (!matchedMasterIds.has(key)) {
      historicalPreservedCount++;
      mergedCatalog.push({
        ...master,
        available_locally: false,
        availability_status: 'missing_on_disk',
        evidence_source: 'internal_docs',
        missing_reason: 'Directory not found at root of projects directory (may be sub-module, renamed, or historical archive)',
        analyzed_at: new Date().toISOString()
      });
    }
  }

  return {
    catalog: mergedCatalog,
    stats: {
      totalCatalogEntries: mergedCatalog.length,
      availableLocally: scannedProjects.length,
      matchedFromMaster: matchedCount,
      newlyDiscovered: newDiscoveredCount,
      historicalPreserved: historicalPreservedCount
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
