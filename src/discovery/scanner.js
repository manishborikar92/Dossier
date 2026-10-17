const fs = require('fs');
const path = require('path');
const { detectBoundary } = require('./boundary-detector');
const { inspectGit } = require('./git-inspector');
const { computeFingerprint } = require('./fingerprint');
const { parseProjectManifests } = require('./manifest-parser');
const { inspectDocs } = require('./doc-inspector');
const { mergeProjectCatalogs, saveCatalog, loadCatalogCache } = require('../knowledge/catalog-merger');

/**
 * Executes a safe, read-only project discovery scan.
 *
 * @param {object} options - { rootDir, settingsPath, refresh, catalogPath, internalDocsPath }
 * @returns {Promise<object>} Complete scan results and summary statistics
 */
async function scanProjects(options = {}) {
  const rootDir = options.rootDir || 'C:\\Users\\manis\\Projects';
  const refresh = Boolean(options.refresh);

  // Load settings
  let settings = {};
  const settingsFile = options.settingsPath || path.resolve(__dirname, '../../config/settings.json');
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {}
  }

  const internalDocsRoot = options.internalDocsPath || settings.scanner?.internal_docs_root || path.join(rootDir, 'InternalDocs');
  const catalogPath = options.catalogPath || path.resolve(__dirname, '../../data/catalog.json');

  // Load existing cache
  const cachedCatalog = !refresh ? loadCatalogCache(catalogPath) : null;
  const cacheByPath = new Map();
  if (cachedCatalog && Array.isArray(cachedCatalog)) {
    for (const item of cachedCatalog) {
      if (item.local_path && item.fingerprint) {
        cacheByPath.set(path.resolve(item.local_path).toLowerCase(), item);
      }
    }
  }

  // Read root directory
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Failed to read projects root directory ${rootDir}: ${err.message}`);
  }

  const scannedProjects = [];
  const excludedDirectories = [];
  let cachedCount = 0;
  let reanalyzedCount = 0;

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(rootDir, entry.name);

    // Guard against symlinks / directory junctions
    try {
      const lstat = fs.lstatSync(dirPath);
      if (lstat.isSymbolicLink()) {
        excludedDirectories.push({ name: entry.name, path: dirPath, reason: 'Symbolic link / directory junction' });
        continue;
      }
    } catch {
      continue;
    }

    // 1. Boundary Detection
    const boundary = detectBoundary(dirPath, settings);
    if (!boundary.isProject) {
      excludedDirectories.push({ name: entry.name, path: dirPath, reason: boundary.reason });
      continue;
    }

    // 2. Git Inspection & Fingerprinting
    const gitMeta = await inspectGit(dirPath);
    const fpInfo = await computeFingerprint(dirPath, gitMeta);

    // 3. Cache Evaluation
    const normPath = path.resolve(dirPath).toLowerCase();
    const cachedItem = cacheByPath.get(normPath);

    if (!refresh && cachedItem && cachedItem.fingerprint === fpInfo.fingerprint) {
      // Fingerprint matches: reuse analysis
      cachedCount++;
      scannedProjects.push({
        name: cachedItem.name || entry.name,
        localPath: dirPath,
        isMonorepo: cachedItem.is_monorepo || false,
        subcomponents: cachedItem.subcomponents || [],
        technologies: cachedItem.primary_technologies || [],
        evidenceFiles: cachedItem.important_file_references || [],
        title: cachedItem.title || entry.name,
        purpose: cachedItem.purpose || null,
        liveUrls: cachedItem.live_url ? [cachedItem.live_url] : [],
        git: {
          isGit: gitMeta.isGit,
          headSha: gitMeta.headSha,
          commitCount: cachedItem.commit_count || gitMeta.commitCount,
          firstCommit: cachedItem.first_commit || gitMeta.firstCommit,
          lastCommit: cachedItem.last_commit || gitMeta.lastCommit
        },
        fingerprint: fpInfo.fingerprint,
        wasCached: true
      });
      continue;
    }

    // 4. Fresh Analysis
    reanalyzedCount++;
    const manifests = parseProjectManifests(dirPath);
    const docs = inspectDocs(dirPath);

    scannedProjects.push({
      name: entry.name,
      localPath: dirPath,
      isMonorepo: boundary.isMonorepo,
      subcomponents: boundary.subcomponents,
      technologies: manifests.technologies,
      evidenceFiles: Array.from(new Set([...manifests.evidenceFiles, ...docs.docEvidenceFiles])),
      title: docs.title || entry.name,
      purpose: docs.purpose || manifests.description,
      liveUrls: docs.liveUrls,
      git: gitMeta,
      fingerprint: fpInfo.fingerprint,
      wasCached: false
    });
  }

  // 5. Merge with Master Knowledge Base
  const mergeResult = mergeProjectCatalogs(scannedProjects, internalDocsRoot, cachedCatalog);

  // 6. Save Catalog
  saveCatalog(mergeResult.catalog, catalogPath);

  return {
    rootDir,
    totalRootDirectories: rootEntries.filter(e => e.isDirectory()).length,
    scannedProjectsCount: scannedProjects.length,
    excludedCount: excludedDirectories.length,
    cachedCount,
    reanalyzedCount,
    excludedDirectories,
    stats: mergeResult.stats,
    catalog: mergeResult.catalog
  };
}

module.exports = {
  scanProjects
};
