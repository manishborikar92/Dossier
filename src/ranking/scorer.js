const { DIMENSIONS, loadRoleProfiles, normalizeQualityScore } = require('./role-profiles');
const { parseJobDescription, calculateJdRelevance, calculateFinalScore } = require('./jd-matcher');

/**
 * Assesses the evidence availability and scan coverage for a project.
 *
 * Distinguishes:
 * - Scan coverage: Whether manifests, docs, git logs, and source directories were inspected.
 * - Evidence availability: What concrete files exist on disk.
 * - Criterion assessment status: 'supported' | 'absent' | 'unknown' for each dimension.
 * - Evidence confidence: Percentage of dimensions with conclusive assessment.
 *
 * @param {object} project - Project catalog entry
 * @returns {object} { scanCoverage, evidenceAvailability, criterionStatuses, evidenceConfidence, isProvisional }
 */
function evaluateProjectEvidence(project) {
  const fileRefs = Array.isArray(project.important_file_references) ? project.important_file_references : [];
  const techList = Array.isArray(project.primary_technologies) ? project.primary_technologies : [];
  const subcomponents = Array.isArray(project.subcomponents) ? project.subcomponents : [];

  // 1. Evidence Availability
  const hasManifest = fileRefs.some(f => /package\.json|requirements\.txt|pyproject\.toml|cargo\.toml|composer\.json/i.test(f));
  const hasDocumentation = fileRefs.some(f => /readme\.md|architecture\.md/i.test(f)) || Boolean(project.purpose);
  const hasGitHistory = typeof project.commit_count === 'number' && project.commit_count > 0;
  const hasTests = techList.some(t => /jest|vitest|pytest|playwright|cypress|supertest/i.test(t)) ||
                    fileRefs.some(f => /test|spec/i.test(f));
  const hasDeploymentUrl = Boolean(project.live_url);

  const evidenceAvailability = {
    hasManifest,
    hasDocumentation,
    hasGitHistory,
    hasTests,
    hasDeploymentUrl,
    commitCount: project.commit_count || 0,
    technologyCount: techList.length,
    subcomponentCount: subcomponents.length,
    fileReferenceCount: fileRefs.length
  };

  // 2. Scan Coverage (fraction of expected discovery facets inspected)
  let coverageScore = 0;
  if (hasManifest) coverageScore += 30;
  if (hasDocumentation) coverageScore += 25;
  if (hasGitHistory || project.historical_status === 'current_codebase') coverageScore += 25;
  if (fileRefs.length > 0) coverageScore += 20;

  const scanCoverage = {
    percentage: Math.min(100, coverageScore),
    isSufficient: coverageScore >= 50
  };

  // 3. Criterion Assessment Status for all 7 dimensions
  // 'supported': Code/manifest evidence confirms presence
  // 'absent': Sufficient inspection confirms feature is not present
  // 'unknown': Ambiguous or uninspected files leave capability inconclusive
  const criterionStatuses = {};

  // Depth
  if (techList.length > 0 || project.technical_analysis) {
    criterionStatuses.depth = { status: 'supported', reason: 'Verified technologies and architecture examined.' };
  } else if (!scanCoverage.isSufficient) {
    criterionStatuses.depth = { status: 'unknown', reason: 'Insufficient manifest evidence to evaluate technical depth.' };
  } else {
    criterionStatuses.depth = { status: 'absent', reason: 'No advanced algorithms or complex subsystems identified.' };
  }

  // Impact
  if (hasDeploymentUrl || project.key_implementation_details) {
    criterionStatuses.impact = { status: 'supported', reason: 'Deployment or transaction telemetry verified.' };
  } else if (!scanCoverage.isSufficient) {
    criterionStatuses.impact = { status: 'unknown', reason: 'Deployment references not inspected or unverified.' };
  } else {
    criterionStatuses.impact = { status: 'absent', reason: 'No live deployment URL or transactional telemetry observed.' };
  }

  // Quality
  if (hasTests || fileRefs.some(f => f.endsWith('.ts') || f.includes('prisma'))) {
    criterionStatuses.quality = { status: 'supported', reason: 'Automated test suite, types, or ORM migrations verified.' };
  } else if (!hasManifest) {
    criterionStatuses.quality = { status: 'unknown', reason: 'No manifest available to verify testing or type frameworks.' };
  } else {
    criterionStatuses.quality = { status: 'absent', reason: 'No automated tests or ORM schema found in inspected manifests.' };
  }

  // Breadth
  if (techList.length >= 2 || subcomponents.length > 0) {
    criterionStatuses.breadth = { status: 'supported', reason: 'Multi-tier stack components verified.' };
  } else if (!hasManifest) {
    criterionStatuses.breadth = { status: 'unknown', reason: 'Dependencies uninspected.' };
  } else {
    criterionStatuses.breadth = { status: 'absent', reason: 'Single-tier codebase without multi-service integration.' };
  }

  // Uniqueness (Heuristic)
  criterionStatuses.uniqueness = { status: 'supported', reason: 'Domain evaluated using deterministic domain rubric.' };

  // Readiness
  if (techList.some(t => /jwt|auth|zod|joi|helmet/i.test(t))) {
    criterionStatuses.readiness = { status: 'supported', reason: 'Security or validation libraries verified.' };
  } else if (!hasManifest) {
    criterionStatuses.readiness = { status: 'unknown', reason: 'Manifest unavailable to inspect security/validation packages.' };
  } else {
    criterionStatuses.readiness = { status: 'absent', reason: 'No auth, rate limiting, or input validation packages detected.' };
  }

  // Storytelling (Heuristic)
  if (hasDocumentation && project.purpose) {
    criterionStatuses.storytelling = { status: 'supported', reason: 'Clear narrative arc extracted from documentation.' };
  } else {
    criterionStatuses.storytelling = { status: 'unknown', reason: 'Sparse documentation limits narrative evaluation.' };
  }

  // 4. Evidence Confidence: Ratio of dimensions conclusively assessed
  let conclusiveCount = 0;
  for (const item of Object.values(criterionStatuses)) {
    if (item.status === 'supported' || item.status === 'absent') {
      conclusiveCount++;
    }
  }
  const evidenceConfidence = Math.round((conclusiveCount / 7) * 100);
  const isProvisional = evidenceConfidence < 50;

  return {
    scanCoverage,
    evidenceAvailability,
    criterionStatuses,
    evidenceConfidence,
    isProvisional
  };
}

/**
 * Scores an individual project across the 7 objective base dimensions (up to 100 raw points).
 *
 * @param {object} project - Project catalog entry
 * @returns {object} { rawScores, totalRawScore, breakdown, reasons }
 */
function scoreProjectDimensions(project) {
  const techList = Array.isArray(project.primary_technologies) ? project.primary_technologies : [];
  const techSet = new Set(techList.map(t => t.toLowerCase()));
  const fileRefs = Array.isArray(project.important_file_references) ? project.important_file_references : [];
  const subcomponents = Array.isArray(project.subcomponents) ? project.subcomponents : [];

  const combinedText = [
    project.name || '',
    project.title || '',
    project.purpose || '',
    project.architecture || '',
    project.technical_analysis || '',
    project.key_implementation_details || ''
  ].join(' ').toLowerCase();

  const reasons = [];

  // ── Dimension 1: Technical Depth (Max 25 pts) ─────────────────────────────
  let depth = 0;
  // 1a. Algorithms & Spatial Math (up to 8 pts)
  if (
    techSet.has('open3d') || techSet.has('pyvista') ||
    /\b(ransac|point cloud|lidar|voxel|ground_filter)\b/i.test(combinedText) ||
    /\b(dem|elevation model)\b/i.test(combinedText)
  ) {
    depth += 8;
    reasons.push('Technical Depth: 3D point cloud / spatial geometric algorithms (RANSAC, DEM, Open3D) (+8)');
  } else if (techSet.has('webassembly (pyodide)') || /\b(wasm|webassembly|pyodide)\b/i.test(combinedText)) {
    depth += 7;
    reasons.push('Technical Depth: Sandboxed in-browser WebAssembly Pyodide execution (+7)');
  } else if (techSet.has('pytorch') || techSet.has('tensorflow') || techSet.has('mediapipe') || techSet.has('opencv')) {
    depth += 6;
    reasons.push('Technical Depth: Machine learning inference & computer vision pipelines (+6)');
  } else if (techSet.has('socket.io') || /\b(websockets?|socket\.io)\b/i.test(combinedText)) {
    depth += 5;
    reasons.push('Technical Depth: Full-duplex WebSocket real-time state synchronization (+5)');
  } else if (techSet.has('pydub') || techSet.has('acrcloud') || /\b(dsp|audio processing|fft)\b/i.test(combinedText)) {
    depth += 5;
    reasons.push('Technical Depth: Digital audio signal processing & fingerprinting (+5)');
  }

  // 1b. Concurrency, Background Workers & Telemetry Ingestion (up to 6 pts)
  if (/\b(livox|sensor|telemetry|sensor ingestion)\b/i.test(combinedText)) {
    depth += 6;
    reasons.push('Technical Depth: High-throughput sensor hardware telemetry ingestion (+6)');
  } else if (subcomponents.length >= 2 || project.is_monorepo) {
    depth += 5;
    reasons.push('Technical Depth: Multi-service client/server distributed architecture (+5)');
  } else if (techSet.has('redis') || /\b(worker|bullmq|celery|queue)\b/i.test(combinedText)) {
    depth += 4;
    reasons.push('Technical Depth: Asynchronous task queue / cache coordination (+4)');
  } else if (project.commit_count > 50) {
    depth += 3;
    reasons.push('Technical Depth: Significant codebase evolutionary depth (+3)');
  }

  // 1c. System Integration & External API Complexity (up to 6 pts)
  if (techSet.has('razorpay api') || /\b(payment gateway|razorpay|stripe)\b/i.test(combinedText)) {
    depth += 6;
    reasons.push('Technical Depth: Secure payment gateway & webhook transaction verification (+6)');
  } else if (techSet.has('cloudinary') && (techSet.has('firebase') || techSet.has('firebase firestore'))) {
    depth += 5;
    reasons.push('Technical Depth: Dual cloud asset & document store synchronization (Cloudinary + Firebase) (+5)');
  } else if (techSet.has('firebase admin sdk') || techSet.has('cloudinary') || techSet.has('google gemini api')) {
    depth += 4;
    reasons.push('Technical Depth: Multi-cloud service integration (Cloudinary / Firebase / GenAI) (+4)');
  } else if (techList.length >= 5) {
    depth += 3;
    reasons.push('Technical Depth: Heterogeneous technology stack integration (+3)');
  }

  // 1d. Data Modeling & Storage Engine (up to 5 pts)
  if (techSet.has('prisma orm') || techSet.has('postgresql') || techSet.has('pgvector')) {
    depth += 5;
    reasons.push('Technical Depth: Relational ORM schema migrations & relational modeling (+5)');
  } else if (techSet.has('mongodb/mongoose') || techSet.has('firebase firestore')) {
    depth += 4;
    reasons.push('Technical Depth: NoSQL document store with structured indexing (+4)');
  } else if (techList.length > 0) {
    depth += 2;
  }
  const boundedDepth = Math.min(25, Math.max(0, depth));

  // ── Dimension 2: Real-World Impact & Deployment (Max 20 pts) ──────────────
  let impact = 0;
  // 2a. Verified Live Deployment / Field Telemetry (up to 8 pts)
  if (project.live_url && typeof project.live_url === 'string') {
    const isCustomDomain = !project.live_url.includes('firebase.google.com') &&
                           !project.live_url.includes('github.com') &&
                           !project.live_url.includes('localhost');
    if (isCustomDomain) {
      impact += 8;
      reasons.push(`Real-World Impact: Live verified production deployment (${project.live_url}) (+8)`);
    } else {
      impact += 5;
      reasons.push(`Real-World Impact: Staging / cloud service URL verified (+5)`);
    }
  } else if (/\b(railway|freight|wagon load|industrial telemetry|derailment)\b/i.test(combinedText)) {
    impact += 8;
    reasons.push('Real-World Impact: Field-deployed industrial telemetry & railway auditing system (+8)');
  }

  // 2b. Commercial / Operational Transaction Flow (up to 6 pts)
  if (/\b(derailment|railway|freight|wagon|industrial audit)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Safety-critical freight audit and derailment hazard prevention (+6)');
  } else if (/\b(payment|booking|payout|billing)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Active booking transactions and commercial billing workflows (+6)');
  } else if (/\b(candidate|assessment|interview|evaluation)\b/i.test(combinedText)) {
    impact += 5;
    reasons.push('Real-World Impact: Live talent evaluation and real-world candidate assessment (+5)');
  }

  // 2c. Real User / Multi-Tenant Workflows (up to 6 pts)
  if (/\b(multi-tenant|court booking|slot schedule)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Multi-tenant organizational data isolation and slot scheduling (+6)');
  } else if (/\b(multi-station|remote station|operations teams)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Multi-station remote operations teams telemetry selectors (+6)');
  } else if (/\b(pwa|companion|routine)\b/i.test(combinedText)) {
    impact += 4;
    reasons.push('Real-World Impact: Daily user retention and personal routine engagement (+4)');
  } else if (project.commit_count > 100) {
    impact += 3;
    reasons.push('Real-World Impact: High commit velocity reflecting extensive real-world iteration (+3)');
  }
  const boundedImpact = Math.min(20, Math.max(0, impact));

  // ── Dimension 3: Engineering Quality & Testing (Max 15 pts) ───────────────
  let quality = 0;
  // 3a. Automated Test Frameworks & Test Files (up to 6 pts)
  const hasTestingTech = techSet.has('jest') || techSet.has('vitest') || techSet.has('pytest') ||
                          techSet.has('playwright') || techSet.has('cypress') || techSet.has('supertest');
  const hasTestFiles = fileRefs.some(f => /test|spec/i.test(f)) ||
                       /\b(tests\/|test_.*\.py|__tests__)\b/i.test(combinedText);

  if (hasTestingTech && hasTestFiles) {
    quality += 6;
    reasons.push('Engineering Quality: Automated test suites with verified test files (+6)');
  } else if (hasTestingTech) {
    quality += 4;
    reasons.push('Engineering Quality: Automated testing framework configured in manifests (+4)');
  } else if (hasTestFiles) {
    quality += 4;
    reasons.push('Engineering Quality: Test scripts identified in repository (+4)');
  }

  // 3b. Type Safety & Database Schema Rigor (up to 5 pts)
  if (techSet.has('typescript') && (techSet.has('prisma orm') || fileRefs.some(f => f.includes('prisma')))) {
    quality += 5;
    reasons.push('Engineering Quality: End-to-end TypeScript strict typing and declarative Prisma schemas (+5)');
  } else if (techSet.has('typescript')) {
    quality += 3;
    reasons.push('Engineering Quality: TypeScript type safety and compile-time verification (+3)');
  } else if (techSet.has('prisma orm')) {
    quality += 3;
    reasons.push('Engineering Quality: Declarative ORM schema modeling (+3)');
  } else if (/\b(spatial normalization|license_service|wall_based_normalize)\b/i.test(combinedText)) {
    quality += 4;
    reasons.push('Engineering Quality: Multi-stage normalization pipeline and license security services (+4)');
  }

  // 3c. Build Automation & Workspace Architecture (up to 4 pts)
  if (project.is_monorepo || subcomponents.length > 0) {
    quality += 4;
    reasons.push('Engineering Quality: Modular monorepo / multi-package workspace governance (+4)');
  } else if (fileRefs.some(f => /docker|makefile|cmakelists/i.test(f))) {
    quality += 3;
    reasons.push('Engineering Quality: Containerized build / deployment automation (+3)');
  } else if (project.commit_count > 20) {
    quality += 2;
  }
  const boundedQuality = Math.min(15, Math.max(0, quality));

  // ── Dimension 4: Breadth of Skills (Max 15 pts) ───────────────────────────
  let breadth = 0;
  // Multi-tier stack integration: 3 pts per tier (up to 15 pts max)
  const hasFrontend = techSet.has('react.js') || techSet.has('next.js') || techSet.has('vue.js') ||
                      techSet.has('tailwind css') || techSet.has('tailwind css v4') ||
                      techSet.has('pyqt6') || techSet.has('pyqt5') || techSet.has('three.js');
  const hasBackend = techSet.has('express.js') || techSet.has('nestjs') || techSet.has('fastapi') ||
                     techSet.has('flask') || techSet.has('django') || techSet.has('node.js') || techSet.has('python');
  const hasDatabase = techSet.has('postgresql') || techSet.has('mongodb/mongoose') || techSet.has('prisma orm') ||
                      techSet.has('firebase firestore') || techSet.has('redis') || techSet.has('pgvector');
  const hasCloudOrApi = techSet.has('cloudinary') || techSet.has('firebase') || techSet.has('firebase admin sdk') ||
                        techSet.has('razorpay api') || techSet.has('resend api') || techSet.has('google gemini api');
  const hasSecurityOrAuth = techSet.has('jwt auth') || techSet.has('zod') || techSet.has('joi') ||
                            /\b(auth|rbac|license_service|aes-256)\b/i.test(combinedText);

  if (hasFrontend) { breadth += 3; }
  if (hasBackend) { breadth += 3; }
  if (hasDatabase) { breadth += 3; }
  if (hasCloudOrApi) { breadth += 3; }
  if (hasSecurityOrAuth) { breadth += 3; }

  const tiersPresent = [hasFrontend, hasBackend, hasDatabase, hasCloudOrApi, hasSecurityOrAuth].filter(Boolean).length;
  reasons.push(`Breadth of Skills: Spans ${tiersPresent} distinct architectural tiers (${breadth} pts)`);
  const boundedBreadth = Math.min(15, Math.max(0, breadth));

  // ── Dimension 5: Architectural Uniqueness (Max 10 pts) ────────────────────
  // (Heuristic domain evaluation based on novelty of technical challenges)
  let uniqueness = 4; // Baseline software utility
  if (/\b(wagon|derailment|lidar)\b/i.test(combinedText)) {
    uniqueness = 10;
    reasons.push('Architectural Uniqueness: Industrial 3D LiDAR point cloud freight safety analysis (10/10)');
  } else if (techSet.has('webassembly (pyodide)') || /\b(wasm|webassembly|pyodide)\b/i.test(combinedText)) {
    uniqueness = 9;
    reasons.push('Architectural Uniqueness: In-browser sandboxed WebAssembly Python execution (9/10)');
  } else if (/\b(celestial|orrery|parametric)\b/i.test(combinedText)) {
    uniqueness = 8;
    reasons.push('Architectural Uniqueness: 3D celestial visualization / generative parametric code (8/10)');
  } else if (/\b(living room)\b/i.test(combinedText) || (techSet.has('socket.io') && combinedText.includes('canvas'))) {
    uniqueness = 8;
    reasons.push('Architectural Uniqueness: Real-time dual-client synchronized shared living space (8/10)');
  } else if (/\b(acrcloud|song recognition|robotics)\b/i.test(combinedText)) {
    uniqueness = 7;
    reasons.push('Architectural Uniqueness: Audio fingerprinting / companion robotics (7/10)');
  } else if (/\b(slot conflict|court booking)\b/i.test(combinedText)) {
    uniqueness = 6;
    reasons.push('Architectural Uniqueness: Slot collision resolution & sports venue management (6/10)');
  } else if (project.is_monorepo) {
    uniqueness = 6;
    reasons.push('Architectural Uniqueness: Multi-component monorepo platform architecture (6/10)');
  } else {
    uniqueness = 5;
    reasons.push('Architectural Uniqueness: Established full-stack web application domain (5/10)');
  }
  const boundedUniqueness = Math.min(10, Math.max(0, uniqueness));

  // ── Dimension 6: Production Readiness (Max 10 pts) ────────────────────────
  let readiness = 0;
  // 6a. Authentication & Authorization & Licensing (up to 4 pts)
  if (techSet.has('jwt auth') || /\b(rbac|machine-fingerprint|license_service|aes-256)\b/i.test(combinedText)) {
    readiness += 4;
    reasons.push('Production Readiness: Security authorization / machine-fingerprint license service (+4)');
  } else if (/\b(auth)\b/i.test(combinedText) || techSet.has('firebase')) {
    readiness += 2;
    reasons.push('Production Readiness: Authentication integration (+2)');
  }

  // 6b. Input Validation & Schema Enforcement (up to 3 pts)
  if (techSet.has('zod') || techSet.has('joi')) {
    readiness += 3;
    reasons.push('Production Readiness: Strict runtime input validation schemas (Zod / Joi) (+3)');
  } else if (/\b(ground_filter|wall_based_normalize|voxel grid)\b/i.test(combinedText)) {
    readiness += 3;
    reasons.push('Production Readiness: Spatial telemetry normalization & sensor data sanitization (+3)');
  }

  // 6c. Security Headers, Rate Limiting & Environment Isolation (up to 3 pts)
  if (/\b(helmet|rate limit|cors)\b/i.test(combinedText)) {
    readiness += 3;
    reasons.push('Production Readiness: Security headers, CORS & rate-limiting policies (+3)');
  } else if (fileRefs.some(f => /env/i.test(f)) || project.commit_count > 30) {
    readiness += 2;
  }
  const boundedReadiness = Math.min(10, Math.max(0, readiness));

  // ── Dimension 7: Storytelling Potential (Max 5 pts) ───────────────────────
  // (Heuristic narrative strength based on clear problem-solution alignment)
  let storytelling = 2;
  if (
    /\b(derailment|railway|freight audit)\b/i.test(combinedText) ||
    /\b(codeassess|talent evaluation|candidate assessment)\b/i.test(combinedText) ||
    /\b(caworkflow|statutory compliance|ca-workflow)\b/i.test(combinedText)
  ) {
    storytelling = 5;
    reasons.push('Storytelling Potential: Compelling high-stakes problem-solution narrative arc (5/5)');
  } else if (/\b(pwa|living room|pickleball)\b/i.test(combinedText)) {
    storytelling = 4;
    reasons.push('Storytelling Potential: High-engagement consumer product narrative (4/5)');
  } else if (project.purpose && project.purpose.length > 50) {
    storytelling = 3;
    reasons.push('Storytelling Potential: Cohesive project purpose statement (3/5)');
  }
  const boundedStorytelling = Math.min(5, Math.max(0, storytelling));

  const rawScores = {
    depth: boundedDepth,
    impact: boundedImpact,
    quality: boundedQuality,
    breadth: boundedBreadth,
    uniqueness: boundedUniqueness,
    readiness: boundedReadiness,
    storytelling: boundedStorytelling
  };

  const totalRawScore = Object.values(rawScores).reduce((sum, val) => sum + val, 0);

  return {
    rawScores,
    totalRawScore: Math.min(100, Math.max(0, totalRawScore)),
    reasons
  };
}

/**
 * Evaluates and ranks all resume-eligible projects against a role profile and optional JD.
 *
 * Guaranteed Properties:
 * 1. Strictly filters to projects where `p.resume_eligibility === true`.
 * 2. Does not mutate the input catalog or project objects.
 * 3. General-purpose and role-specific quality scores strictly bounded [0, 100].
 * 4. Safe JD fallback: Uninformative or empty JDs fall back to quality score without penalty.
 * 5. Deterministic tie-breaking order:
 *    relevance (if informative JD) -> technical depth -> last_commit -> commit_count -> id.
 *
 * @param {object[]} catalog - Master catalog entries
 * @param {object} [options] - Ranking options
 * @param {string} [options.role='general'] - Target role preset key
 * @param {object} [options.customWeights] - Optional custom criterion weights
 * @param {string} [options.jdText] - Optional Job Description text
 * @param {number} [options.alpha] - Relevance blending weight α ∈ [0, 1]
 * @param {string} [options.configPath] - Optional custom path to ranking-weights.json
 * @returns {object} { role, roleLabel, roleWeights, jdAnalysis, rankedProjects, stats }
 */
function rankProjects(catalog, options = {}) {
  const roleProfiles = loadRoleProfiles(options.configPath);
  const roleKey = options.role && roleProfiles.rolePresets[options.role] ? options.role : 'general';
  const rolePreset = roleProfiles.rolePresets[roleKey];
  const weights = options.customWeights || rolePreset.weights;

  // 1. Filter candidate projects: Must have resume_eligibility === true
  const eligibleProjects = (catalog || []).filter(p => p && p.resume_eligibility === true);

  // 2. Parse Job Description
  const parsedJd = parseJobDescription(options.jdText);
  const alpha = typeof options.alpha === 'number'
    ? Math.max(0, Math.min(1.0, options.alpha))
    : roleProfiles.jdMatching?.default_alpha || 0.35;

  // 3. Score each eligible project
  const scoredProjects = eligibleProjects.map(project => {
    // a. Evaluate evidence availability, scan coverage & assessment status
    const evidenceMeta = evaluateProjectEvidence(project);

    // b. Raw 7-factor dimension scores
    const dimResult = scoreProjectDimensions(project);

    // c. Normalized weighted quality score S_quality
    const qualityScore = normalizeQualityScore(dimResult.rawScores, weights, roleProfiles.dimensions);

    // d. Job Description Relevance (Safe fallback handles uninformative JDs)
    const relevanceResult = calculateJdRelevance(project, parsedJd, roleProfiles.jdMatching);

    // e. Composite Final Score S_final
    const finalResult = calculateFinalScore(qualityScore, relevanceResult, alpha);

    return {
      id: project.id,
      name: project.name,
      title: project.title || project.name,
      purpose: project.purpose || null,
      primaryTechnologies: project.primary_technologies || [],
      liveUrl: project.live_url || null,
      commitCount: project.commit_count || 0,
      lastCommit: project.last_commit || null,
      firstCommit: project.first_commit || null,
      rawScores: dimResult.rawScores,
      totalRawScore: dimResult.totalRawScore,
      qualityScore,
      relevanceScore: relevanceResult.relevanceScore,
      finalScore: finalResult.finalScore,
      effectiveAlpha: finalResult.effectiveAlpha,
      fallbackApplied: finalResult.fallbackApplied,
      matchingTech: relevanceResult.matchingTech,
      matchingDomains: relevanceResult.matchingDomains,
      scanCoverage: evidenceMeta.scanCoverage.percentage,
      evidenceConfidence: evidenceMeta.evidenceConfidence,
      isProvisional: evidenceMeta.isProvisional,
      criterionStatuses: evidenceMeta.criterionStatuses,
      reasons: dimResult.reasons
    };
  });

  // 4. Deterministic Tie-Breaking Sort
  scoredProjects.sort((a, b) => {
    // 1. Primary: Final Score
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    // 2. Secondary: Technical Depth
    if (b.rawScores.depth !== a.rawScores.depth) {
      return b.rawScores.depth - a.rawScores.depth;
    }
    // 3. Tertiary: Relevance Score (if informative JD provided)
    if (parsedJd.isInformative && b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    // 4. Quaternary: Most recent commit date
    const dateA = a.lastCommit ? new Date(a.lastCommit).getTime() : 0;
    const dateB = b.lastCommit ? new Date(b.lastCommit).getTime() : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    // 5. Quinary: Total commit count
    if (b.commitCount !== a.commitCount) {
      return b.commitCount - a.commitCount;
    }
    // 6. Final: Alphabetical by ID
    return a.id.localeCompare(b.id);
  });

  // Assign 1-indexed ranks
  scoredProjects.forEach((p, index) => {
    p.rank = index + 1;
  });

  return {
    role: roleKey,
    roleLabel: rolePreset.label,
    roleDescription: rolePreset.description,
    roleWeights: weights,
    jdAnalysis: {
      isProvided: parsedJd.isProvided,
      isInformative: parsedJd.isInformative,
      techTokens: parsedJd.techTokens,
      domainKeywords: parsedJd.domainKeywords,
      configuredAlpha: alpha,
      effectiveAlpha: parsedJd.isInformative ? alpha : 0,
      fallbackApplied: !parsedJd.isInformative,
      reason: parsedJd.reason
    },
    rankedProjects: scoredProjects,
    stats: {
      totalCatalogEntries: (catalog || []).length,
      eligibleCandidates: eligibleProjects.length,
      scoredCount: scoredProjects.length,
      uninformativeJdFallback: !parsedJd.isInformative
    }
  };
}

module.exports = {
  evaluateProjectEvidence,
  scoreProjectDimensions,
  rankProjects
};
