const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Runs a git command safely with argument arrays.
 *
 * @param {string} cwd - Project directory
 * @param {string[]} args - Git command arguments
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string|null>} Stdout trimmed, or null if failed
 */
function runGit(cwd, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Inspects a Git repository safely.
 *
 * @param {string} dirPath - Directory to inspect
 * @returns {Promise<object>} Git metadata
 */
async function inspectGit(dirPath) {
  const gitDir = path.join(dirPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      isGit: false,
      headSha: null,
      commitCount: 0,
      firstCommit: null,
      lastCommit: null,
      workingTreeClean: true,
      modifiedFiles: [],
      untrackedFiles: []
    };
  }

  // Verify inside work tree
  const isInside = await runGit(dirPath, ['rev-parse', '--is-inside-work-tree']);
  if (isInside !== 'true') {
    return {
      isGit: false,
      headSha: null,
      commitCount: 0,
      firstCommit: null,
      lastCommit: null,
      workingTreeClean: true,
      modifiedFiles: [],
      untrackedFiles: []
    };
  }

  // 1. Get HEAD commit SHA
  const headSha = await runGit(dirPath, ['rev-parse', 'HEAD']);

  // If there are no commits yet (empty repo)
  if (!headSha) {
    return {
      isGit: true,
      headSha: null,
      commitCount: 0,
      firstCommit: null,
      lastCommit: null,
      workingTreeClean: true,
      modifiedFiles: [],
      untrackedFiles: []
    };
  }

  // 2. Commit count
  const countStr = await runGit(dirPath, ['rev-list', '--count', 'HEAD']);
  const commitCount = countStr ? parseInt(countStr, 10) || 0 : 0;

  // 3. First commit date (ISO)
  const firstCommit = await runGit(dirPath, ['log', '--reverse', '--format=%aI', '-n', '1']);

  // 4. Last commit date (ISO)
  const lastCommit = await runGit(dirPath, ['log', '-n', '1', '--format=%aI']);

  // 5. Working tree status (staged, unstaged, untracked, renamed, deleted)
  const statusOutput = await runGit(dirPath, ['status', '--porcelain', '-uall']);
  const modifiedFiles = [];
  const untrackedFiles = [];

  if (statusOutput) {
    const lines = statusOutput.split('\n').filter(Boolean);
    for (const line of lines) {
      const code = line.slice(0, 2);
      const filePath = line.slice(3).trim();

      if (code === '??') {
        untrackedFiles.push(filePath);
      } else {
        modifiedFiles.push({ code: code.trim(), path: filePath });
      }
    }
  }

  return {
    isGit: true,
    headSha,
    commitCount,
    firstCommit: firstCommit ? firstCommit.split('T')[0] : null,
    lastCommit: lastCommit ? lastCommit.split('T')[0] : null,
    workingTreeClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
    modifiedFiles,
    untrackedFiles
  };
}

module.exports = {
  runGit,
  inspectGit
};
