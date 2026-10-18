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
 * Fast git status check used for fingerprinting and cache validation.
 * Runs rev-parse and status --porcelain in parallel.
 *
 * @param {string} dirPath - Directory to check
 * @returns {Promise<object>} { isGit, headSha, modifiedFiles, untrackedFiles, workingTreeClean }
 */
async function checkGitFast(dirPath) {
  const gitDir = path.join(dirPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      isGit: false,
      headSha: null,
      workingTreeClean: true,
      modifiedFiles: [],
      untrackedFiles: []
    };
  }

  // Run HEAD check and status check concurrently
  const [headSha, statusOutput] = await Promise.all([
    runGit(dirPath, ['rev-parse', 'HEAD']),
    runGit(dirPath, ['status', '--porcelain', '-uall'])
  ]);

  if (!headSha) {
    return {
      isGit: true,
      headSha: null,
      workingTreeClean: true,
      modifiedFiles: [],
      untrackedFiles: []
    };
  }

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
    workingTreeClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
    modifiedFiles,
    untrackedFiles
  };
}

/**
 * Retrieves detailed commit statistics (commit count, date ranges).
 * Deferred to cold scans or modified repositories to optimize warm cache performance.
 *
 * @param {string} dirPath - Directory to inspect
 * @returns {Promise<object>} { commitCount, firstCommit, lastCommit }
 */
async function inspectGitDetails(dirPath) {
  const [countStr, firstCommit, lastCommit] = await Promise.all([
    runGit(dirPath, ['rev-list', '--count', 'HEAD']),
    runGit(dirPath, ['log', '--reverse', '--format=%aI', '-n', '1']),
    runGit(dirPath, ['log', '-n', '1', '--format=%aI'])
  ]);

  return {
    commitCount: countStr ? parseInt(countStr, 10) || 0 : 0,
    firstCommit: firstCommit ? firstCommit.split('T')[0] : null,
    lastCommit: lastCommit ? lastCommit.split('T')[0] : null
  };
}

/**
 * Full git inspection (fast check + commit statistics).
 *
 * @param {string} dirPath - Directory to inspect
 * @returns {Promise<object>} Complete Git metadata
 */
async function inspectGit(dirPath) {
  const fast = await checkGitFast(dirPath);
  if (!fast.isGit || !fast.headSha) {
    return {
      ...fast,
      commitCount: 0,
      firstCommit: null,
      lastCommit: null
    };
  }

  const details = await inspectGitDetails(dirPath);
  return {
    ...fast,
    ...details
  };
}

module.exports = {
  runGit,
  checkGitFast,
  inspectGitDetails,
  inspectGit
};
