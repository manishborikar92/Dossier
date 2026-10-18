const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { checkGitFast } = require('./git-inspector');

// File extensions and patterns considered relevant for project analysis
const RELEVANT_EXTENSIONS = new Set([
  '.json', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.php', '.dart',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.swift',
  '.md', '.txt', '.toml', '.yaml', '.yml', '.prisma', '.sql', '.html', '.css', '.scss'
]);

const RELEVANT_FILENAMES = new Set([
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'yarn.lock', 'requirements.txt', 'pyproject.toml', 'pipfile', 'setup.py',
  'cargo.toml', 'composer.json', 'dockerfile', 'docker-compose.yml', 'makefile',
  'cmakelists.txt', 'gemfile', 'readme.md', 'architecture.md', 'license', 'license.md'
]);

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'venv', '.venv', '__pycache__', 'dist', 'build',
  '.next', 'out', 'coverage', '.idea', '.vscode', '.cache', 'target', 'vendor'
]);

const SENSITIVE_FILES = new Set([
  'credentials.json', 'serviceaccountkey.json', 'client_secret.json',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519'
]);

/**
 * Checks if a relative file path is relevant for analysis fingerprinting.
 */
function isRelevantFile(relPath) {
  const parts = relPath.split(/[/\\]/);
  for (const part of parts) {
    if (IGNORED_DIRS.has(part.toLowerCase())) {
      return false;
    }
  }

  const base = path.basename(relPath).toLowerCase();

  // Guard: Exclude sensitive credentials, keys, certificates, and env files
  if (
    base.startsWith('.env') ||
    SENSITIVE_FILES.has(base) ||
    base.endsWith('.pem') ||
    base.endsWith('.key') ||
    base.endsWith('.pfx')
  ) {
    return false;
  }

  if (RELEVANT_FILENAMES.has(base)) {
    return true;
  }

  const ext = path.extname(relPath).toLowerCase();
  return RELEVANT_EXTENSIONS.has(ext);
}

/**
 * Computes SHA-256 hash of a file's content.
 */
function hashFileContent(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return 'READ_ERROR';
  }
}

/**
 * Recursively collects relevant files from a directory up to maxDepth.
 */
function collectRelevantFiles(dirPath, currentDepth = 0, maxDepth = 6, baseDir = dirPath) {
  const results = [];
  if (currentDepth > maxDepth) return results;

  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') {
      // Skip hidden directories/files like .git, .next, etc.
      if (entry.isDirectory()) continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    // Skip symlinks to avoid recursion loops
    try {
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) continue;
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name.toLowerCase())) {
        results.push(...collectRelevantFiles(fullPath, currentDepth + 1, maxDepth, baseDir));
      }
    } else if (entry.isFile()) {
      if (isRelevantFile(relPath)) {
        results.push(relPath);
      }
    }
  }

  return results;
}

/**
 * Computes a robust, content-based project fingerprint.
 *
 * @param {string} dirPath - Project directory
 * @param {object} gitMeta - Optional pre-computed git metadata from checkGitFast
 * @returns {Promise<object>} { fingerprint, strategy, fileCount, modifiedCount }
 */
async function computeFingerprint(dirPath, gitMeta = null) {
  const git = gitMeta || (await checkGitFast(dirPath));
  const hasher = crypto.createHash('sha256');

  if (git.isGit && git.headSha) {
    // ── Git Repository Fingerprint ──────────────────────────────────────────
    hasher.update(`git:head:${git.headSha}`);

    // Collect all uncommitted (staged, unstaged, untracked, deleted) files
    const changedItems = [];

    // 1. Modified tracked files
    for (const item of git.modifiedFiles) {
      if (isRelevantFile(item.path)) {
        const fullPath = path.join(dirPath, item.path);
        if (fs.existsSync(fullPath)) {
          const contentHash = hashFileContent(fullPath);
          changedItems.push(`${item.path}:${item.code}:${contentHash}`);
        } else {
          changedItems.push(`${item.path}:${item.code}:DELETED`);
        }
      }
    }

    // 2. Untracked files
    for (const relPath of git.untrackedFiles) {
      if (isRelevantFile(relPath)) {
        const fullPath = path.join(dirPath, relPath);
        if (fs.existsSync(fullPath)) {
          const contentHash = hashFileContent(fullPath);
          changedItems.push(`${relPath}:UNTRACKED:${contentHash}`);
        }
      }
    }

    // 3. Always hash key root manifests and docs directly by content to protect
    // against edge cases where working tree content is modified without git detecting it
    const primaryFiles = ['package.json', 'requirements.txt', 'pyproject.toml', 'README.md', 'prisma/schema.prisma'];
    for (const file of primaryFiles) {
      const fullPath = path.join(dirPath, file);
      if (fs.existsSync(fullPath)) {
        const h = hashFileContent(fullPath);
        changedItems.push(`root:${file}:${h}`);
      }
    }

    // Sort to ensure deterministic hash order
    changedItems.sort();
    for (const item of changedItems) {
      hasher.update('|' + item);
    }

    return {
      fingerprint: hasher.digest('hex'),
      strategy: 'git_head_plus_content_diff',
      fileCount: changedItems.length,
      modifiedCount: git.modifiedFiles.length + git.untrackedFiles.length,
      headSha: git.headSha
    };
  } else {
    // ── Non-Git Directory Fingerprint (Content-Based) ────────────────────────
    const files = collectRelevantFiles(dirPath);
    files.sort();

    for (const relPath of files) {
      const fullPath = path.join(dirPath, relPath);
      const contentHash = hashFileContent(fullPath);
      hasher.update(`${relPath}:${contentHash}|`);
    }

    return {
      fingerprint: hasher.digest('hex'),
      strategy: 'nongit_recursive_content_hash',
      fileCount: files.length,
      modifiedCount: 0,
      headSha: null
    };
  }
}

module.exports = {
  isRelevantFile,
  hashFileContent,
  collectRelevantFiles,
  computeFingerprint
};
