const fs = require('fs');
const path = require('path');

const BOUNDARY_TYPES = {
  STANDALONE: 'standalone_project',
  MONOREPO: 'monorepo',
  UTILITY: 'utility',
  REFERENCE: 'reference_directory',
  SELF: 'application_self',
  INACCESSIBLE: 'inaccessible'
};

/**
 * Determines project boundary type, physical availability, and resume eligibility.
 *
 * @param {string} dirPath - Absolute path to inspect
 * @param {object} settings - Application settings
 * @returns {object} { type, isProject, isResumeCandidate, isMonorepo, physicalAvailability, subcomponents, reason }
 */
function detectBoundary(dirPath, settings = {}) {
  const dirName = path.basename(dirPath);
  const lowerName = dirName.toLowerCase();

  // 1. Self exclusion (Resume-Builder itself)
  if (lowerName === 'resume-builder') {
    return {
      type: BOUNDARY_TYPES.SELF,
      isProject: false,
      isResumeCandidate: false,
      isMonorepo: false,
      physicalAvailability: true,
      subcomponents: [],
      reason: 'Application self-directory (Resume-Builder excluded to prevent self-evaluation)'
    };
  }

  // 2. Reference / documentation / profile repositories on disk
  const referenceNames = new Set([
    'internaldocs',
    'notes',
    'manishborikar92',
    'git-and-github-commands'
  ]);

  if (referenceNames.has(lowerName)) {
    return {
      type: BOUNDARY_TYPES.REFERENCE,
      isProject: false,
      isResumeCandidate: false,
      isMonorepo: false,
      physicalAvailability: true,
      subcomponents: [],
      reason: `Reference or documentation repository (${dirName})`
    };
  }

  // 3. Inspect directory entries
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    return {
      type: BOUNDARY_TYPES.INACCESSIBLE,
      isProject: false,
      isResumeCandidate: false,
      isMonorepo: false,
      physicalAvailability: false,
      subcomponents: [],
      reason: `Inaccessible directory: ${err.message}`
    };
  }

  // 4. Check if utility / scaffold repository
  const utilityNames = new Set(['boilerplate', 'pre-built tools']);
  const isUtility = utilityNames.has(lowerName);

  const fileNames = new Set(entries.filter(e => e.isFile()).map(e => e.name));
  const subDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  // 5. Check monorepo indicators
  let isMonorepo = false;
  let monorepoReason = '';

  if (fileNames.has('pnpm-workspace.yaml') || fileNames.has('lerna.json')) {
    isMonorepo = true;
    monorepoReason = 'Has workspace configuration file';
  } else if (fileNames.has('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf8'));
      if (pkg.workspaces && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
        isMonorepo = true;
        monorepoReason = 'package.json defines workspaces';
      }
    } catch {
      // Ignore JSON parse errors in boundary detection
    }
  }

  // Check common dual-component patterns: web + server, client + server, apps, etc.
  const subDirNames = new Set(subDirs.map(d => d.name.toLowerCase()));
  if (
    (subDirNames.has('web') && subDirNames.has('server')) ||
    (subDirNames.has('client') && subDirNames.has('server')) ||
    subDirNames.has('apps') ||
    (subDirNames.has('admin') && subDirNames.has('server'))
  ) {
    isMonorepo = true;
    monorepoReason = monorepoReason || 'Contains dual-tier web/server or apps structure';
  }

  // 6. Discover subcomponents
  const subcomponents = [];
  if (isMonorepo) {
    for (const subDir of subDirs) {
      const subDirPath = path.join(dirPath, subDir.name);
      if (['node_modules', 'dist', 'build', '.git', '.next', 'out'].includes(subDir.name)) {
        continue;
      }

      // If it's an "apps" or "packages" directory, inspect its children
      if (['apps', 'packages', 'modules'].includes(subDir.name.toLowerCase())) {
        try {
          const nestedApps = fs.readdirSync(subDirPath, { withFileTypes: true });
          for (const app of nestedApps) {
            if (app.isDirectory() && !app.name.startsWith('.')) {
              subcomponents.push({
                name: `${subDir.name}/${app.name}`,
                path: path.join(subDir.name, app.name),
                type: classifySubcomponent(app.name)
              });
            }
          }
        } catch {}
      } else {
        subcomponents.push({
          name: subDir.name,
          path: subDir.name,
          type: classifySubcomponent(subDir.name)
        });
      }
    }
  }

  const finalType = isMonorepo
    ? BOUNDARY_TYPES.MONOREPO
    : isUtility
    ? BOUNDARY_TYPES.UTILITY
    : BOUNDARY_TYPES.STANDALONE;

  return {
    type: finalType,
    isProject: true,
    isResumeCandidate: true,
    isMonorepo,
    physicalAvailability: true,
    subcomponents,
    reason: isMonorepo ? monorepoReason : isUtility ? 'Scaffold or developer utility' : 'Standalone repository'
  };
}

function classifySubcomponent(name) {
  const lower = name.toLowerCase();
  if (lower.includes('web') || lower.includes('client') || lower.includes('frontend') || lower.includes('ui')) {
    return 'frontend';
  }
  if (lower.includes('server') || lower.includes('api') || lower.includes('backend')) {
    return 'backend';
  }
  if (lower.includes('admin') || lower.includes('portal')) {
    return 'admin';
  }
  if (lower.includes('sim') || lower.includes('core')) {
    return 'core_simulation';
  }
  if (lower.includes('worker') || lower.includes('cron')) {
    return 'worker';
  }
  return 'module';
}

module.exports = {
  BOUNDARY_TYPES,
  detectBoundary,
  classifySubcomponent
};
