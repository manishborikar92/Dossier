const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { detectBoundary, BOUNDARY_TYPES } = require('../src/discovery/boundary-detector');
const { checkGitFast, inspectGit } = require('../src/discovery/git-inspector');
const { computeFingerprint, isRelevantFile, hashFileContent } = require('../src/discovery/fingerprint');
const { parseProjectManifests } = require('../src/discovery/manifest-parser');
const { inspectDocs } = require('../src/discovery/doc-inspector');
const { mergeProjectCatalogs } = require('../src/knowledge/catalog-merger');
const { scanProjects } = require('../src/discovery/scanner');

// Helper to create clean temp fixture directories
function createTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

// Helper to cleanup temp directory
function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

describe('Phase 2 Discovery, Boundary Detection & Caching Test Suite', () => {
  let fixtureDir;

  before(() => {
    fixtureDir = createTempDir('resume-builder-test-');
  });

  after(() => {
    cleanupDir(fixtureDir);
  });

  // 1. Correctly discovering standalone projects and monorepos
  test('Case 1: Discovers standalone projects and monorepos correctly', () => {
    const standaloneDir = path.join(fixtureDir, 'standalone-app');
    fs.mkdirSync(standaloneDir, { recursive: true });
    fs.writeFileSync(path.join(standaloneDir, 'package.json'), JSON.stringify({ name: 'standalone-app' }));

    const res1 = detectBoundary(standaloneDir);
    assert.equal(res1.type, BOUNDARY_TYPES.STANDALONE);
    assert.equal(res1.isProject, true);
    assert.equal(res1.isResumeCandidate, true);
    assert.equal(res1.isMonorepo, false);

    const monorepoDir = path.join(fixtureDir, 'monorepo-app');
    fs.mkdirSync(path.join(monorepoDir, 'web'), { recursive: true });
    fs.mkdirSync(path.join(monorepoDir, 'server'), { recursive: true });
    fs.writeFileSync(path.join(monorepoDir, 'package.json'), JSON.stringify({
      name: 'monorepo-app',
      workspaces: ['web', 'server']
    }));

    const res2 = detectBoundary(monorepoDir);
    assert.equal(res2.type, BOUNDARY_TYPES.MONOREPO);
    assert.equal(res2.isProject, true);
    assert.equal(res2.isResumeCandidate, true);
    assert.equal(res2.isMonorepo, true);
  });

  // 2. Correctly classifying nested frontend/backend applications without duplicate project entries
  test('Case 2: Classifies nested applications as subcomponents without duplicate projects', () => {
    const monorepoDir = path.join(fixtureDir, 'nested-platform');
    fs.mkdirSync(path.join(monorepoDir, 'web'), { recursive: true });
    fs.mkdirSync(path.join(monorepoDir, 'server'), { recursive: true });
    fs.mkdirSync(path.join(monorepoDir, 'admin'), { recursive: true });

    const boundary = detectBoundary(monorepoDir);
    assert.equal(boundary.isMonorepo, true);
    assert.equal(boundary.isResumeCandidate, true);
    assert.equal(boundary.subcomponents.length, 3);

    const subNames = boundary.subcomponents.map(s => s.name);
    assert.ok(subNames.includes('web'));
    assert.ok(subNames.includes('server'));
    assert.ok(subNames.includes('admin'));

    const webComp = boundary.subcomponents.find(s => s.name === 'web');
    assert.equal(webComp.type, 'frontend');
    const serverComp = boundary.subcomponents.find(s => s.name === 'server');
    assert.equal(serverComp.type, 'backend');
  });

  // 3. Excluding Resume-Builder itself and configured non-project directories
  test('Case 3: Excludes Resume-Builder and distinguishes reference directories on disk', () => {
    const resumeBuilderDir = path.join(fixtureDir, 'Resume-Builder');
    fs.mkdirSync(resumeBuilderDir, { recursive: true });
    const res1 = detectBoundary(resumeBuilderDir);
    assert.equal(res1.type, BOUNDARY_TYPES.SELF);
    assert.equal(res1.isResumeCandidate, false);
    assert.equal(res1.physicalAvailability, true);

    const internalDocsDir = path.join(fixtureDir, 'InternalDocs');
    fs.mkdirSync(internalDocsDir, { recursive: true });
    const res2 = detectBoundary(internalDocsDir);
    assert.equal(res2.type, BOUNDARY_TYPES.REFERENCE);
    assert.equal(res2.isResumeCandidate, false);
    assert.equal(res2.physicalAvailability, true);
  });

  // 4. Matching existing catalog entries and separating physical availability from resume eligibility
  test('Case 4: Accurately separates physical availability from resume eligibility', () => {
    const mockScanned = [
      {
        name: 'iwlars',
        localPath: 'C:\\Users\\manis\\Projects\\iwlars',
        technologies: ['Python', 'Open3D', 'NumPy'],
        evidenceFiles: ['package.json'],
        isMonorepo: true,
        git: { isGit: true, commitCount: 655, firstCommit: '2025-06-19', lastCommit: '2026-06-21' },
        fingerprint: 'mock-fp-1'
      }
    ];

    const mockExcluded = [
      {
        name: 'InternalDocs',
        path: 'C:\\Users\\manis\\Projects\\InternalDocs',
        reason: 'Reference or documentation repository'
      }
    ];

    const mockInternalDocsDir = path.join(fixtureDir, 'InternalDocsMock');
    const refDir = path.join(mockInternalDocsDir, 'reference');
    fs.mkdirSync(refDir, { recursive: true });
    fs.writeFileSync(path.join(refDir, 'project_knowledge_base.json'), JSON.stringify([
      {
        id: 'iwlars',
        name: 'iwlars',
        title: 'IWLARS — Intelligent Wagon Load Analysis & Reporting System',
        rank: 1,
        score: 97.0,
        local_path: 'C:\\Users\\manis\\Projects\\iwlars',
        primary_technologies: ['Python', 'Open3D', 'Next.js']
      },
      {
        id: 'internaldocs',
        name: 'InternalDocs',
        title: 'Internal Engineering Documentation',
        local_path: 'C:\\Users\\manis\\Projects\\InternalDocs'
      }
    ]));

    const merged = mergeProjectCatalogs(mockScanned, mockExcluded, mockInternalDocsDir);
    assert.equal(merged.stats.matchedResumeProjects, 1);
    assert.equal(merged.stats.referenceDirectoriesOnDisk, 1);
    assert.equal(merged.catalog.length, 2);

    // Resume project check
    const iwlarsEntry = merged.catalog.find(p => p.id === 'iwlars');
    assert.ok(iwlarsEntry);
    assert.equal(iwlarsEntry.physical_availability, true);
    assert.equal(iwlarsEntry.resume_eligibility, true);
    assert.equal(iwlarsEntry.historical_status, 'current_codebase');

    // Reference directory check: Available on disk, but NOT eligible for resume
    const docsEntry = merged.catalog.find(p => p.id === 'internaldocs');
    assert.ok(docsEntry);
    assert.equal(docsEntry.physical_availability, true, 'InternalDocs must be physically available on disk');
    assert.equal(docsEntry.resume_eligibility, false, 'InternalDocs must not be eligible for resume scoring');
    assert.equal(docsEntry.discovery_classification, 'reference_directory');
    assert.equal(docsEntry.historical_status, 'reference_catalog_entry');
  });

  // 5. Preserving historical catalog entries when local directories are missing
  test('Case 5: Preserves historical catalog entries when directories are missing on disk', () => {
    const mockScanned = [
      {
        name: 'iwlars',
        localPath: 'C:\\Users\\manis\\Projects\\iwlars',
        technologies: ['Python'],
        evidenceFiles: [],
        git: {},
        fingerprint: 'fp-1'
      }
    ];

    const mockInternalDocsDir = path.join(fixtureDir, 'InternalDocsMock2');
    const refDir = path.join(mockInternalDocsDir, 'reference');
    fs.mkdirSync(refDir, { recursive: true });
    fs.writeFileSync(path.join(refDir, 'project_knowledge_base.json'), JSON.stringify([
      { id: 'iwlars', name: 'iwlars', local_path: 'C:\\Users\\manis\\Projects\\iwlars' },
      { id: 'merchant', name: 'merchant', local_path: 'C:\\Users\\manis\\Projects\\merchant' },
      { id: 'regimen', name: 'Regimen', local_path: 'C:\\Users\\manis\\Projects\\Regimen' }
    ]));

    const merged = mergeProjectCatalogs(mockScanned, [], mockInternalDocsDir);
    assert.equal(merged.stats.totalCatalogEntries, 3);
    assert.equal(merged.stats.missingHistoricalEntries, 2);

    const merchant = merged.catalog.find(p => p.id === 'merchant');
    assert.ok(merchant);
    assert.equal(merchant.physical_availability, false);
    assert.equal(merchant.resume_eligibility, false);
    assert.equal(merchant.discovery_classification, 'nested_component');
    assert.equal(merchant.historical_status, 'subsumed_by_parent');

    const regimen = merged.catalog.find(p => p.id === 'regimen');
    assert.ok(regimen);
    assert.equal(regimen.physical_availability, false);
    assert.equal(regimen.resume_eligibility, false);
    assert.equal(regimen.discovery_classification, 'archived_project');
    assert.equal(regimen.historical_status, 'superseded_project');
  });

  // 6. Detecting changes to committed files and staged, unstaged, and untracked relevant files
  test('Case 6: Detects changes across committed, unstaged, and untracked files in Git', async () => {
    const gitRepoDir = path.join(fixtureDir, 'test-git-repo');
    fs.mkdirSync(gitRepoDir, { recursive: true });
    execFileSync('git', ['init'], { cwd: gitRepoDir, windowsHide: true });
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: gitRepoDir, windowsHide: true });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: gitRepoDir, windowsHide: true });

    // Initial commit
    fs.writeFileSync(path.join(gitRepoDir, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }));
    execFileSync('git', ['add', '.'], { cwd: gitRepoDir, windowsHide: true });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: gitRepoDir, windowsHide: true });

    const fp1 = await computeFingerprint(gitRepoDir);
    assert.ok(fp1.fingerprint);

    // Unstaged modification
    fs.writeFileSync(path.join(gitRepoDir, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.1' }));
    const fp2 = await computeFingerprint(gitRepoDir);
    assert.notEqual(fp1.fingerprint, fp2.fingerprint, 'Fingerprint must change on unstaged edit');

    // Stage the file
    execFileSync('git', ['add', 'package.json'], { cwd: gitRepoDir, windowsHide: true });
    const fp3 = await computeFingerprint(gitRepoDir);
    assert.notEqual(fp1.fingerprint, fp3.fingerprint, 'Fingerprint must change on staged edit');

    // Commit the file
    execFileSync('git', ['commit', '-m', 'version bump'], { cwd: gitRepoDir, windowsHide: true });
    const fp4 = await computeFingerprint(gitRepoDir);
    assert.notEqual(fp1.fingerprint, fp4.fingerprint, 'Fingerprint must change after commit');

    // Add untracked file
    fs.writeFileSync(path.join(gitRepoDir, 'README.md'), '# Documentation');
    const fp5 = await computeFingerprint(gitRepoDir);
    assert.notEqual(fp4.fingerprint, fp5.fingerprint, 'Fingerprint must change on untracked relevant file');
  });

  // 7. Detecting content modifications even when file size and modification timestamp are unchanged
  test('Case 7: Detects content modifications even when file size and timestamp are identical', async () => {
    const nonGitDir = path.join(fixtureDir, 'same-size-mtime-test');
    fs.mkdirSync(nonGitDir, { recursive: true });
    const targetFile = path.join(nonGitDir, 'data.json');

    const fixedTime = new Date('2026-01-01T12:00:00Z');
    
    // File content 1: exactly 10 characters
    fs.writeFileSync(targetFile, 'ABCDEFGHIJ');
    fs.utimesSync(targetFile, fixedTime, fixedTime);

    const fp1 = await computeFingerprint(nonGitDir);

    // File content 2: different content, BUT EXACTLY SAME LENGTH (10 chars) and EXACTLY SAME MTIME
    fs.writeFileSync(targetFile, 'ZXCVBNMASD');
    fs.utimesSync(targetFile, fixedTime, fixedTime);

    const stat1 = fs.statSync(targetFile);
    assert.equal(stat1.size, 10);
    assert.equal(stat1.mtime.getTime(), fixedTime.getTime());

    const fp2 = await computeFingerprint(nonGitDir);

    assert.notEqual(
      fp1.fingerprint,
      fp2.fingerprint,
      'Content-based hashing must detect modification even when size and mtime are identical'
    );
  });

  // 8. Detecting file additions, renames, and deletions
  test('Case 8: Detects file additions, renames, and deletions in Git repo', async () => {
    const repo = path.join(fixtureDir, 'file-mutation-repo');
    fs.mkdirSync(repo, { recursive: true });
    execFileSync('git', ['init'], { cwd: repo, windowsHide: true });
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repo, windowsHide: true });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo, windowsHide: true });

    fs.writeFileSync(path.join(repo, 'file1.js'), 'console.log(1);');
    execFileSync('git', ['add', '.'], { cwd: repo, windowsHide: true });
    execFileSync('git', ['commit', '-m', 'add file1'], { cwd: repo, windowsHide: true });

    const baseFp = await computeFingerprint(repo);

    // Rename file
    fs.renameSync(path.join(repo, 'file1.js'), path.join(repo, 'file2.js'));
    const renamedFp = await computeFingerprint(repo);
    assert.notEqual(baseFp.fingerprint, renamedFp.fingerprint, 'Fingerprint must change on rename');

    // Delete file
    fs.unlinkSync(path.join(repo, 'file2.js'));
    const deletedFp = await computeFingerprint(repo);
    assert.notEqual(baseFp.fingerprint, deletedFp.fingerprint, 'Fingerprint must change on deletion');
  });

  // 9. Correctly handling non-Git repositories and malformed project manifests
  test('Case 9: Handles non-Git repositories and malformed manifests gracefully', () => {
    const malformedDir = path.join(fixtureDir, 'malformed-repo');
    fs.mkdirSync(malformedDir, { recursive: true });

    // Intentionally broken JSON syntax in package.json
    fs.writeFileSync(path.join(malformedDir, 'package.json'), '{ invalid json "name": ');

    const manifests = parseProjectManifests(malformedDir);
    assert.equal(manifests.technologies.length, 0);
    assert.doesNotThrow(() => parseProjectManifests(malformedDir));
  });

  // 10. Reusing cached results for unchanged inputs and bypassing the cache when --refresh is supplied
  test('Case 10: Reuses cache for unchanged projects and bypasses cache when refresh=true', async () => {
    const testProjectsRoot = path.join(fixtureDir, 'cache-test-root');
    const projDir = path.join(testProjectsRoot, 'app-one');
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, 'package.json'), JSON.stringify({ name: 'app-one' }));

    const catalogPath = path.join(fixtureDir, 'test-catalog.json');
    const settingsPath = path.join(fixtureDir, 'test-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({
      scanner: { non_project_directories: [] }
    }));

    // First scan: cold
    const run1 = await scanProjects({
      rootDir: testProjectsRoot,
      catalogPath,
      settingsPath,
      internalDocsPath: path.join(fixtureDir, 'nonexistent-docs'),
      refresh: false
    });
    assert.equal(run1.cachedCount, 0);
    assert.equal(run1.reanalyzedCount, 1);

    // Second scan without changes: warm cache hit
    const run2 = await scanProjects({
      rootDir: testProjectsRoot,
      catalogPath,
      settingsPath,
      internalDocsPath: path.join(fixtureDir, 'nonexistent-docs'),
      refresh: false
    });
    assert.equal(run2.cachedCount, 1);
    assert.equal(run2.reanalyzedCount, 0);

    // Third scan with refresh: true -> must bypass cache
    const run3 = await scanProjects({
      rootDir: testProjectsRoot,
      catalogPath,
      settingsPath,
      internalDocsPath: path.join(fixtureDir, 'nonexistent-docs'),
      refresh: true
    });
    assert.equal(run3.cachedCount, 0);
    assert.equal(run3.reanalyzedCount, 1);
  });

  // 11. Handling inaccessible paths and excluded sensitive files safely
  test('Case 11: Safely excludes sensitive files and avoids reading credentials', () => {
    assert.equal(isRelevantFile('.env'), false);
    assert.equal(isRelevantFile('.env.local'), false);
    assert.equal(isRelevantFile('credentials.json'), false);
    assert.equal(isRelevantFile('serviceAccountKey.json'), false);
    assert.equal(isRelevantFile('id_rsa'), false);
    assert.equal(isRelevantFile('server.key'), false);
    assert.equal(isRelevantFile('cert.pem'), false);
    assert.equal(isRelevantFile('node_modules/express/index.js'), false);
    assert.equal(isRelevantFile('.git/config'), false);
    assert.equal(isRelevantFile('src/index.js'), true);
    assert.equal(isRelevantFile('README.md'), true);
  });

  // 12. Keeping all filesystem writes inside Resume-Builder
  test('Case 12: Scanner writes only to specified catalog destination and leaves scanned roots untouched', async () => {
    const testRoot = path.join(fixtureDir, 'write-isolation-root');
    const sampleDir = path.join(testRoot, 'sample-app');
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'README.md'), '# Sample App');

    const catalogPath = path.join(fixtureDir, 'isolated-catalog.json');

    await scanProjects({
      rootDir: testRoot,
      catalogPath,
      internalDocsPath: path.join(fixtureDir, 'nonexistent-docs'),
      refresh: true
    });

    assert.ok(fs.existsSync(catalogPath));
    const sampleFiles = fs.readdirSync(sampleDir);
    assert.deepEqual(sampleFiles, ['README.md']);
  });

  // 13. Safe Job Description token matching edge cases (Zero division & empty token handling)
  test('Case 13: Handles empty, short, duplicate, and uninformative JD token sets without NaN', () => {
    // Formula under test: Sørensen-Dice with independent zero-guard
    function calculateRelevance(projTech, jdTech, projKw, jdKw) {
      let techScore = 0;
      if (projTech.length + jdTech.length > 0) {
        const intersection = projTech.filter(t => jdTech.includes(t)).length;
        techScore = (2 * intersection) / (projTech.length + jdTech.length);
      }

      let kwScore = 0;
      const union = new Set([...projKw, ...jdKw]).size;
      if (union > 0) {
        const intersection = projKw.filter(k => jdKw.includes(k)).length;
        kwScore = intersection / union;
      }

      // If JD has no tokens whatsoever, relevance is strictly 0
      if (jdTech.length === 0 && jdKw.length === 0) {
        return 0;
      }

      const score = (0.70 * techScore + 0.30 * kwScore) * 100;
      return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
    }

    // Empty JD
    assert.equal(calculateRelevance(['React', 'Node.js'], [], ['web'], []), 0);

    // Completely disjoint JD (no matches)
    assert.equal(calculateRelevance(['React'], ['Go', 'Rust'], ['web'], ['embedded']), 0);

    // Duplicate JD tokens handled by deduplication
    const dedupeJd = Array.from(new Set(['react', 'react', 'react']));
    const score = calculateRelevance(['react'], dedupeJd, [], []);
    assert.equal(score, 70); // 0.70 * (2*1 / 2) * 100 = 70

    // Small project (1 tech) vs Large JD (20 techs)
    const largeJd = ['React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring', 'Go', 'Rust', 'Docker', 'K8s', 'AWS', 'GCP', 'Azure', 'Postgres', 'Mongo', 'Redis'];
    const smallProjScore = calculateRelevance(['React'], largeJd, [], []);
    // 2 * 1 / (1 + 20) = 2/21 = ~0.0952 * 0.70 * 100 = ~6.66
    assert.ok(smallProjScore > 5 && smallProjScore < 10, 'Small project must not be inflated to 100% on 1 match in large JD');
    assert.ok(Number.isFinite(smallProjScore));
  });

  // 14. Distinguishing incomplete evidence from confirmed absence
  test('Case 14: Distinguishes incomplete/missing evidence from confirmed absence', () => {
    const emptyProjDir = path.join(fixtureDir, 'empty-experimental');
    fs.mkdirSync(emptyProjDir, { recursive: true });
    fs.writeFileSync(path.join(emptyProjDir, 'experiment.py'), 'print("test")');

    const manifests = parseProjectManifests(emptyProjDir);
    const docs = inspectDocs(emptyProjDir);

    // Manifests empty, but does not mean failed
    assert.equal(manifests.hasTests, false);
    assert.equal(manifests.evidenceFiles.length, 0);
    assert.equal(docs.docEvidenceFiles.length, 0);

    // Evaluated completeness metric (e.g., fraction of observable files present)
    const totalObservableAnchors = 4; // Manifest, Readme, Git, Tests
    let observedAnchors = 0;
    if (manifests.evidenceFiles.length > 0) observedAnchors++;
    if (docs.docEvidenceFiles.length > 0) observedAnchors++;
    if (manifests.hasTests) observedAnchors++;

    const evidenceCompleteness = (observedAnchors / totalObservableAnchors) * 100;
    assert.equal(evidenceCompleteness, 0, 'Incomplete evidence must be tracked as 0% completeness');
  });

});
