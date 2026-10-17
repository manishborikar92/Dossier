const fs = require('fs');
const path = require('path');

const BOUNDARY_TYPES = {
  STANDALONE: 'STANDALONE',
  MONOREPO: 'MONOREPO',
  UTILITY: 'UTILITY',
  NON_PROJECT: 'NON_PROJECT'
};

/**
 * Determines project boundary type and discovers nested subprojects.
 *
 * @param {string} dirPath - Absolute path to inspect
 * @param {object} settings - Application settings
 * @returns {object} { type, isProject, isMonorepo, subcomponents, reason }
 */
function detectBoundary(dirPath, settings = {}) {
  const dirName = path.basename(dirPath);
  const nonProjects = new Set(
    (settings.scanner?.non_project_directories || [
      'InternalDocs',
      'Notes',
      'manishborikar92',
      'Git-and-Github-Commands',
      'Resume-Builder'
    ]).map(s => s.toLowerCase())
  );

  // 1. Check if explicitly in non-project list
  if (nonProjects.has(dirName.toLowerCase())) {
    return {
      type: BOUNDARY_TYPES.NON_PROJECT,
      isProject: false,
      isMonorepo: false,
      subcomponents: [],
      reason: `Configured as non-project directory (${dirName})`
    };
  }

  // 2. Check if utility / scaffold repository
  const utilityNames = new Set(['boilerplate', 'pre-built tools']);
  const isUtility = utilityNames.has(dirName.toLowerCase());

  // 3. Inspect directory entries
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    return {
      type: BOUNDARY_TYPES.NON_PROJECT,
      isProject: false,
      isMonorepo: false,
      subcomponents: [],
      reason: `Inaccessible directory: ${err.message}`
    };
  }

  const fileNames = new Set(entries.filter(e => e.isFile()).map(e => e.name));
  const subDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  // 4. Check monorepo indicators
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

  // 5. Discover subcomponents
  const subcomponents = [];
  if (isMonorepo) {
    for (const subDir of subDirs) {
      const subDirPath = path.join(dirPath, subDir.name);
      // Avoid node_modules or build dirs
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
        // Direct sub-directory (e.g. web, server, admin, client, simulation)
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
    isMonorepo,
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
