const fs = require('fs');
const path = require('path');
const { detectBoundary } = require('./boundary-detector');
const { checkGitFast, inspectGitDetails } = require('./git-inspector');
const { computeFingerprint } = require('./fingerprint');
const { parseProjectManifests } = require('./manifest-parser');
const { inspectDocs } = require('./doc-inspector');
const { mergeProjectCatalogs, saveCatalog, loadCatalogCache } = require('../knowledge/catalog-merger');

/**
 * Concurrently processes an array of items with a fixed concurrency limit.
 */
async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Executes a safe, read-only project discovery scan with fast caching.
 *
 * @param {object} options - { rootDir, settingsPath, refresh, catalogPath, internalDocsPath, concurrency }
 * @returns {Promise<object>} Complete scan results and summary statistics
 */
async function scanProjects(options = {}) {
  const rootDir = options.rootDir || 'C:\\Users\\manis\\Projects';
  const refresh = Boolean(options.refresh);
  const concurrency = options.concurrency || 6;

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

  // Read root directory entries
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Failed to read projects root directory ${rootDir}: ${err.message}`);
  }

  const excludedDirectories = [];
  const candidateDirectories = [];

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

    // Boundary Detection
    const boundary = detectBoundary(dirPath, settings);
    if (!boundary.isResumeCandidate) {
      excludedDirectories.push({
        name: entry.name,
        path: dirPath,
        reason: boundary.reason,
        type: boundary.type
      });
      continue;
    }

    candidateDirectories.push({ entry, dirPath, boundary });
  }

  let cachedCount = 0;
  let reanalyzedCount = 0;

  // Process candidate directories with concurrent batching
  const scannedProjects = await mapConcurrent(candidateDirectories, concurrency, async ({ entry, dirPath, boundary }) => {
    // 1. Fast Git status check & content-based fingerprinting
    const gitFast = await checkGitFast(dirPath);
    const fpInfo = await computeFingerprint(dirPath, gitFast);

    // 2. Cache Evaluation
    const normPath = path.resolve(dirPath).toLowerCase();
    const cachedItem = cacheByPath.get(normPath);

    if (!refresh && cachedItem && cachedItem.fingerprint === fpInfo.fingerprint) {
      cachedCount++;
      return {
        name: cachedItem.name || entry.name,
        localPath: dirPath,
        isMonorepo: cachedItem.is_monorepo || false,
        subcomponents: cachedItem.subcomponents || boundary.subcomponents || [],
        technologies: cachedItem.primary_technologies || [],
        evidenceFiles: cachedItem.important_file_references || [],
        title: cachedItem.title || entry.name,
        purpose: cachedItem.purpose || null,
        liveUrls: cachedItem.live_url ? [cachedItem.live_url] : [],
        git: {
          isGit: gitFast.isGit,
          headSha: gitFast.headSha,
          commitCount: cachedItem.commit_count || 0,
          firstCommit: cachedItem.first_commit || null,
          lastCommit: cachedItem.last_commit || null
        },
        fingerprint: fpInfo.fingerprint,
        type: boundary.type,
        wasCached: true
      };
    }

    // 3. Fresh Analysis (Cache miss or modified)
    reanalyzedCount++;

    // Run deeper git inspection (commit count & dates) concurrently with manifest & doc parsing
    const [gitDetails, manifests, docs] = await Promise.all([
      gitFast.isGit && gitFast.headSha ? inspectGitDetails(dirPath) : Promise.resolve({ commitCount: 0, firstCommit: null, lastCommit: null }),
      Promise.resolve(parseProjectManifests(dirPath)),
      Promise.resolve(inspectDocs(dirPath))
    ]);

    const fullGit = {
      ...gitFast,
      ...gitDetails
    };

    return {
      name: entry.name,
      localPath: dirPath,
      isMonorepo: boundary.isMonorepo,
      subcomponents: boundary.subcomponents,
      technologies: manifests.technologies,
      evidenceFiles: Array.from(new Set([...manifests.evidenceFiles, ...docs.docEvidenceFiles])),
      title: docs.title || entry.name,
      purpose: docs.purpose || manifests.description,
      liveUrls: docs.liveUrls,
      git: fullGit,
      fingerprint: fpInfo.fingerprint,
      type: boundary.type,
      wasCached: false
    };
  });

  // 4. Merge with Master Knowledge Base and Excluded Reference Folders
  const mergeResult = mergeProjectCatalogs(scannedProjects, excludedDirectories, internalDocsRoot, cachedCatalog);

  // 5. Save Normalized Catalog
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
