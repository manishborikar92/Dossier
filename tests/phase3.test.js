const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  DIMENSIONS,
  DEFAULT_ROLE_PRESETS,
  loadRoleProfiles,
  calculateMaxWeightedScore,
  normalizeQualityScore
} = require('../src/ranking/role-profiles');

const {
  parseJobDescription,
  extractProjectTokens,
  computeTechnicalOverlap,
  computeContextOverlap,
  calculateJdRelevance,
  calculateFinalScore
} = require('../src/ranking/jd-matcher');

const {
  evaluateProjectEvidence,
  scoreProjectDimensions,
  rankProjects
} = require('../src/ranking/scorer');

describe('Phase 3 Scoring & Role-Weighting Engine Test Suite', () => {

  // 1. All seven raw scoring dimensions use correct maximum points
  test('Case 1: All seven raw scoring dimensions adhere strictly to maximum point allocations', () => {
    assert.equal(DIMENSIONS.depth.max_raw_points, 25);
    assert.equal(DIMENSIONS.impact.max_raw_points, 20);
    assert.equal(DIMENSIONS.quality.max_raw_points, 15);
    assert.equal(DIMENSIONS.breadth.max_raw_points, 15);
    assert.equal(DIMENSIONS.uniqueness.max_raw_points, 10);
    assert.equal(DIMENSIONS.readiness.max_raw_points, 10);
    assert.equal(DIMENSIONS.storytelling.max_raw_points, 5);

    const totalMax = Object.values(DIMENSIONS).reduce((sum, d) => sum + d.max_raw_points, 0);
    assert.equal(totalMax, 100, 'Sum of maximum raw points across all 7 dimensions must equal exactly 100');

    // Test with maximally featured synthetic project
    const maxProject = {
      id: 'max-proj',
      name: 'Maximal Project',
      title: 'Full Platform',
      purpose: 'A comprehensive high-stakes platform with multi-tenant scheduling, derailment analysis, and routine engagement.',
      primary_technologies: [
        'Open3D', 'PyVista', 'WebAssembly (Pyodide)', 'Socket.io', 'Razorpay API',
        'Prisma ORM', 'PostgreSQL', 'TypeScript', 'Jest', 'Playwright',
        'React.js', 'Next.js', 'Express.js', 'Firebase Admin SDK', 'JWT Auth', 'Zod'
      ],
      live_url: 'https://maxproject.example.com',
      commit_count: 500,
      important_file_references: ['package.json', 'README.md', 'prisma/schema.prisma', 'tests/app.test.ts', 'Dockerfile'],
      subcomponents: [{ name: 'web' }, { name: 'server' }],
      is_monorepo: true
    };

    const scored = scoreProjectDimensions(maxProject);
    assert.ok(scored.rawScores.depth <= 25, 'Depth must not exceed 25');
    assert.ok(scored.rawScores.impact <= 20, 'Impact must not exceed 20');
    assert.ok(scored.rawScores.quality <= 15, 'Quality must not exceed 15');
    assert.ok(scored.rawScores.breadth <= 15, 'Breadth must not exceed 15');
    assert.ok(scored.rawScores.uniqueness <= 10, 'Uniqueness must not exceed 10');
    assert.ok(scored.rawScores.readiness <= 10, 'Readiness must not exceed 10');
    assert.ok(scored.rawScores.storytelling <= 5, 'Storytelling must not exceed 5');
    assert.ok(scored.totalRawScore <= 100, 'Total raw score must never exceed 100');
  });

  // 2. Normalized quality scores are strictly bounded in [0, 100] across all role presets
  test('Case 2: Quality score normalization strictly bounds output to [0, 100] across all presets', () => {
    const roleProfiles = loadRoleProfiles();
    const presets = Object.keys(roleProfiles.rolePresets);
    assert.ok(presets.includes('general'));
    assert.ok(presets.includes('fullstack'));
    assert.ok(presets.includes('backend'));
    assert.ok(presets.includes('ai_ml_data'));
    assert.ok(presets.includes('systems_3d'));

    const sampleScores = [
      { depth: 0, impact: 0, quality: 0, breadth: 0, uniqueness: 0, readiness: 0, storytelling: 0 },
      { depth: 25, impact: 20, quality: 15, breadth: 15, uniqueness: 10, readiness: 10, storytelling: 5 },
      { depth: 15, impact: 10, quality: 8, breadth: 12, uniqueness: 6, readiness: 7, storytelling: 3 },
      { depth: 999, impact: 999, quality: 999, breadth: 999, uniqueness: 999, readiness: 999, storytelling: 999 } // overflow attempt
    ];

    for (const presetKey of presets) {
      const weights = roleProfiles.rolePresets[presetKey].weights;
      for (const raw of sampleScores) {
        const normalized = normalizeQualityScore(raw, weights, roleProfiles.dimensions);
        assert.ok(Number.isFinite(normalized), `Score must be finite for preset ${presetKey}`);
        assert.ok(normalized >= 0, `Score must be >= 0 for preset ${presetKey}`);
        assert.ok(normalized <= 100, `Score must be <= 100 for preset ${presetKey}`);
      }
    }
  });

  // 3. Role-weight changes affect criteria rather than introducing project-name preferences
  test('Case 3: Role-weighting alters criterion balance objectively without project-name favoritism', () => {
    // Project A: Heavy in Technical Depth and Systems Math (e.g. 3D spatial simulation)
    const projectSystems = {
      id: 'systems-proj',
      name: '3D LiDAR Spatial Core',
      title: '3D LiDAR Point Cloud Processing Core',
      purpose: 'Automated 3D LiDAR point-cloud processing, RANSAC plane segmentation, DEM elevation volume estimation, and telemetry ingestion.',
      technical_analysis: 'RANSAC ground plane removal, voxel grid downsampling, and spatial normalization pipeline.',
      resume_eligibility: true,
      primary_technologies: ['Open3D', 'PyVista', 'Python', 'NumPy', 'SciPy', 'C++'],
      commit_count: 120,
      important_file_references: ['CMakeLists.txt', 'README.md', 'tests/test_spatial.py']
    };

    // Project B: Heavy in Fullstack Breadth, Deployment & Payments (e.g. Web SaaS)
    const projectFullstack = {
      id: 'fullstack-proj',
      name: 'Commercial SaaS App',
      title: 'Fullstack Multi-Tenant Workspace',
      purpose: 'Customer billing portals, appointment scheduling, and multi-tenant workspace management.',
      resume_eligibility: true,
      primary_technologies: ['React.js', 'Next.js', 'Express.js', 'PostgreSQL', 'Prisma ORM', 'Razorpay API', 'Tailwind CSS'],
      live_url: 'https://saas.example.com',
      commit_count: 120,
      important_file_references: ['package.json', 'README.md', 'prisma/schema.prisma']
    };

    const mockCatalog = [projectSystems, projectFullstack];

    // Under systems_3d preset: Systems Engine should score higher
    const systemsRanking = rankProjects(mockCatalog, { role: 'systems_3d' });
    const systemsScoreA = systemsRanking.rankedProjects.find(p => p.id === 'systems-proj').finalScore;
    const systemsScoreB = systemsRanking.rankedProjects.find(p => p.id === 'fullstack-proj').finalScore;
    assert.ok(
      systemsScoreA > systemsScoreB,
      `Under systems_3d role, systems project (${systemsScoreA}) must rank higher than fullstack SaaS (${systemsScoreB})`
    );

    // Under fullstack preset: Fullstack SaaS should score higher
    const fullstackRanking = rankProjects(mockCatalog, { role: 'fullstack' });
    const fsScoreA = fullstackRanking.rankedProjects.find(p => p.id === 'systems-proj').finalScore;
    const fsScoreB = fullstackRanking.rankedProjects.find(p => p.id === 'fullstack-proj').finalScore;
    assert.ok(
      fsScoreB > fsScoreA,
      `Under fullstack role, fullstack SaaS (${fsScoreB}) must rank higher than systems project (${fsScoreA})`
    );
  });

  // 4. JD relevance safe fallback handles empty, whitespace, and uninformative prose without penalizing projects
  test('Case 4: JD relevance safe fallback handles uninformative inputs without reducing scores', () => {
    const sampleProject = {
      id: 'proj-1',
      name: 'Sample App',
      resume_eligibility: true,
      primary_technologies: ['React.js', 'Node.js', 'PostgreSQL'],
      commit_count: 50
    };

    const catalog = [sampleProject];

    // Baseline: No JD
    const baseRank = rankProjects(catalog, { role: 'general' });
    const baselineScore = baseRank.rankedProjects[0].finalScore;

    // Test 4a: Null JD
    const rankNull = rankProjects(catalog, { role: 'general', jdText: null });
    assert.equal(rankNull.rankedProjects[0].finalScore, baselineScore);
    assert.equal(rankNull.jdAnalysis.effectiveAlpha, 0);
    assert.equal(rankNull.jdAnalysis.fallbackApplied, true);

    // Test 4b: Empty string JD
    const rankEmpty = rankProjects(catalog, { role: 'general', jdText: '' });
    assert.equal(rankEmpty.rankedProjects[0].finalScore, baselineScore);
    assert.equal(rankEmpty.jdAnalysis.fallbackApplied, true);

    // Test 4c: Whitespace only JD
    const rankWhitespace = rankProjects(catalog, { role: 'general', jdText: '   \n\t  ' });
    assert.equal(rankWhitespace.rankedProjects[0].finalScore, baselineScore);
    assert.equal(rankWhitespace.jdAnalysis.fallbackApplied, true);

    // Test 4d: Ordinary prose with no recognizable technical or domain keywords
    const uninformativeProse = 'We are looking for a nice person with good vibes who loves team lunches and coffee breaks.';
    const rankProse = rankProjects(catalog, { role: 'general', jdText: uninformativeProse });
    assert.equal(
      rankProse.rankedProjects[0].finalScore,
      baselineScore,
      'Uninformative prose JD must fall back to quality score without reducing project score'
    );
    assert.equal(rankProse.jdAnalysis.isInformative, false);
    assert.equal(rankProse.jdAnalysis.effectiveAlpha, 0);
    assert.equal(rankProse.jdAnalysis.fallbackApplied, true);
    assert.ok(rankProse.jdAnalysis.reason.includes('did not provide recognizable'));
  });

  // 5. JD relevance correctly evaluates technical-only, domain-only, and mixed inputs
  test('Case 5: JD relevance correctly evaluates technical-only, domain-only, and mixed JDs', () => {
    const project = {
      primary_technologies: ['React.js', 'Next.js', 'TypeScript', 'Tailwind CSS'],
      purpose: 'Modern frontend user interface for real-time collaboration.'
    };

    // 5a. Technical-only JD (e.g. mentions only React and TypeScript, no domain keywords)
    const parsedTechOnly = parseJobDescription('We require strong experience with React and TypeScript.');
    assert.ok(parsedTechOnly.isInformative);
    assert.ok(parsedTechOnly.techTokens.includes('react.js'));
    assert.ok(parsedTechOnly.techTokens.includes('typescript'));
    const relTechOnly = calculateJdRelevance(project, parsedTechOnly);
    assert.ok(relTechOnly.relevanceScore > 50, 'Technical match must yield high relevance');

    // 5b. Domain-only JD (e.g. mentions frontend and UI without specific libraries)
    const parsedDomainOnly = parseJobDescription('Seeking an engineer focused on frontend and user interface architecture.');
    assert.ok(parsedDomainOnly.isInformative);
    assert.ok(parsedDomainOnly.domainKeywords.includes('frontend'));
    const relDomainOnly = calculateJdRelevance(project, parsedDomainOnly);
    assert.ok(relDomainOnly.relevanceScore > 0, 'Domain match must yield positive relevance');

    // 5c. Mixed JD (both tech and domain)
    const parsedMixed = parseJobDescription('Senior Frontend Engineer with deep Next.js, React, and real-time UI experience.');
    assert.ok(parsedMixed.isInformative);
    assert.ok(parsedMixed.techTokens.length > 0);
    assert.ok(parsedMixed.domainKeywords.length > 0);
    const relMixed = calculateJdRelevance(project, parsedMixed);
    assert.ok(relMixed.relevanceScore > 40);

    // 5d. Blending calculation verification
    const blendResult = calculateFinalScore(80, relMixed, 0.35);
    assert.ok(Number.isFinite(blendResult.finalScore));
    assert.equal(blendResult.effectiveAlpha, 0.35);
    assert.equal(blendResult.fallbackApplied, false);
  });

  // 6. Handles adversarial numeric edge cases without NaN or Infinity
  test('Case 6: Handles adversarial numeric edge cases without NaN or Infinity', () => {
    // Empty inputs
    assert.equal(computeTechnicalOverlap([], []), 0);
    assert.equal(computeContextOverlap([], []), 0);

    // Project with 0 technologies and 0 domain terms
    const emptyProj = { primary_technologies: [], purpose: '' };
    const parsedJd = parseJobDescription('Requires React and Python.');
    const rel = calculateJdRelevance(emptyProj, parsedJd);
    assert.equal(rel.relevanceScore, 0);
    assert.ok(Number.isFinite(rel.relevanceScore));

    // Zero-weights role preset
    const zeroWeights = { depth: 0, impact: 0, quality: 0, breadth: 0, uniqueness: 0, readiness: 0, storytelling: 0 };
    const zeroNorm = normalizeQualityScore({ depth: 25 }, zeroWeights);
    assert.equal(zeroNorm, 0);
    assert.ok(Number.isFinite(zeroNorm));

    // Final score with out-of-range alpha
    const blendOver = calculateFinalScore(85, { isAvailable: true, relevanceScore: 90 }, 1.5);
    assert.ok(blendOver.finalScore <= 100);
    const blendUnder = calculateFinalScore(85, { isAvailable: true, relevanceScore: 90 }, -0.5);
    assert.ok(blendUnder.finalScore >= 0);
  });

  // 7. Separates scan coverage from evidence availability and distinguishes unknown from absent
  test('Case 7: Separates scan coverage from evidence availability, and distinguishes unknown criteria from confirmed absence', () => {
    // Project with full inspection and complete manifests, but confirmed zero automated tests
    const projectCompleteScan = {
      id: 'full-scan-no-test',
      primary_technologies: ['React.js', 'Express.js'],
      important_file_references: ['package.json', 'README.md'],
      purpose: 'Fully documented web tool.',
      commit_count: 30
    };

    const metaComplete = evaluateProjectEvidence(projectCompleteScan);
    assert.equal(metaComplete.scanCoverage.isSufficient, true, 'Scan coverage must be sufficient');
    assert.equal(metaComplete.evidenceAvailability.hasManifest, true);
    assert.equal(metaComplete.evidenceAvailability.hasTests, false);
    // Quality criterion should be confirmed 'absent', NOT 'unknown'
    assert.equal(metaComplete.criterionStatuses.quality.status, 'absent');
    assert.ok(metaComplete.criterionStatuses.quality.reason.includes('No automated tests'));

    // Project with no manifest and uninspected structure (e.g. unknown state)
    const projectUninspected = {
      id: 'sparse-proj',
      primary_technologies: [],
      important_file_references: [],
      purpose: null,
      commit_count: 0
    };

    const metaSparse = evaluateProjectEvidence(projectUninspected);
    assert.equal(metaSparse.scanCoverage.isSufficient, false, 'Scan coverage must be marked insufficient');
    assert.equal(metaSparse.criterionStatuses.quality.status, 'unknown');
    assert.equal(metaSparse.isProvisional, true, 'Project with sparse evidence must be flagged provisional');
  });

  // 8. Low evidence confidence is surfaced rather than falsely presenting certainty
  test('Case 8: Low evidence confidence is surfaced rather than falsely presenting certainty', () => {
    const lowEvidenceProject = {
      id: 'low-evidence-1',
      name: 'Unclear Repo',
      resume_eligibility: true,
      primary_technologies: [],
      important_file_references: [],
      purpose: null
    };

    const ranking = rankProjects([lowEvidenceProject], { role: 'general' });
    const scored = ranking.rankedProjects[0];

    assert.equal(scored.isProvisional, true, 'Project with minimal evidence must be flagged provisional');
    assert.ok(scored.evidenceConfidence < 50, 'Evidence confidence must reflect low conclusive assessments');
  });

  // 9. Ranking output is 100% deterministic across identical runs
  test('Case 9: Ranking output is 100% deterministic across identical runs', () => {
    const projectA = {
      id: 'proj-a',
      name: 'Project Alpha',
      resume_eligibility: true,
      primary_technologies: ['TypeScript', 'Express.js'],
      commit_count: 25,
      last_commit: '2026-05-01'
    };
    const projectB = {
      id: 'proj-b',
      name: 'Project Beta',
      resume_eligibility: true,
      primary_technologies: ['Python', 'FastAPI'],
      commit_count: 25,
      last_commit: '2026-05-01'
    };

    const catalog = [projectA, projectB];

    const run1 = rankProjects(catalog, { role: 'backend', jdText: 'FastAPI and Python backend' });
    const run2 = rankProjects(catalog, { role: 'backend', jdText: 'FastAPI and Python backend' });

    assert.deepEqual(
      run1.rankedProjects.map(p => ({ id: p.id, rank: p.rank, score: p.finalScore })),
      run2.rankedProjects.map(p => ({ id: p.id, rank: p.rank, score: p.finalScore })),
      'Consecutive ranking runs with identical inputs must yield identical order and scores'
    );
  });

  // 10. Ineligible entries (reference directories, missing historical entries, Resume-Builder) are strictly excluded
  test('Case 10: Ineligible entries are strictly excluded from ranking candidates', () => {
    const mixedCatalog = [
      { id: 'valid-1', name: 'Valid Project', resume_eligibility: true, primary_technologies: ['React.js'] },
      { id: 'internaldocs', name: 'InternalDocs', resume_eligibility: false, discovery_classification: 'reference_directory' },
      { id: 'resume-builder', name: 'Resume-Builder', resume_eligibility: false, discovery_classification: 'application_self' },
      { id: 'notes', name: 'Notes', resume_eligibility: false, discovery_classification: 'reference_directory' },
      { id: 'remotion', name: 'Remotion', resume_eligibility: false, physical_availability: false }
    ];

    const result = rankProjects(mixedCatalog, { role: 'general' });
    assert.equal(result.rankedProjects.length, 1, 'Only the single eligible project must be scored');
    assert.equal(result.rankedProjects[0].id, 'valid-1');
    assert.equal(result.stats.eligibleCandidates, 1);
    assert.equal(result.stats.totalCatalogEntries, 5);
  });

  // 11. Ranking pipeline does not mutate canonical catalog objects, timestamps, or fingerprints
  test('Case 11: Ranking pipeline does not mutate canonical catalog objects or fingerprints', () => {
    const originalCatalog = [
      {
        id: 'immutable-proj',
        name: 'Immutable Project',
        resume_eligibility: true,
        fingerprint: 'orig-fp-12345',
        commit_count: 42,
        primary_technologies: ['Next.js', 'Prisma ORM']
      }
    ];

    const originalJson = JSON.stringify(originalCatalog);

    // Execute ranking
    rankProjects(originalCatalog, { role: 'fullstack', jdText: 'Next.js developer with Prisma' });

    // Verify catalog was not mutated
    assert.equal(
      JSON.stringify(originalCatalog),
      originalJson,
      'rankProjects must not mutate the original catalog objects or tamper with cached fingerprints'
    );
  });

  // 12. Deterministic tie-breaking order resolves identical final scores consistently
  test('Case 12: Deterministic tie-breaking order resolves identical scores consistently', () => {
    // Both projects have identical final score of 50, but Project X has higher technical depth
    const projX = {
      id: 'proj-x',
      name: 'Project X',
      resume_eligibility: true,
      primary_technologies: ['Open3D'], // yields depth
      commit_count: 10,
      last_commit: '2026-01-01'
    };

    const projY = {
      id: 'proj-y',
      name: 'Project Y',
      resume_eligibility: true,
      primary_technologies: [],
      commit_count: 10,
      last_commit: '2026-01-01'
    };

    const res = rankProjects([projY, projX], { role: 'general' });
    // ProjX should be ranked higher due to technical depth tie-breaker
    assert.equal(res.rankedProjects[0].id, 'proj-x');
    assert.equal(res.rankedProjects[1].id, 'proj-y');
  });

  // 13. Role presets produce sensible relative rankings across clearly differentiated archetypes
  test('Case 13: Role presets produce sensible relative rankings across differentiated archetypes', () => {
    // Archetype 1: Full-Stack Web SaaS (Next.js, Express, Postgres, Prisma, PhonePe, Live domain, Supertest)
    const webSaaS = {
      id: 'web-saas',
      name: 'Court Booking Platform',
      title: 'Full-Stack Venue Reservation SaaS',
      purpose: 'End-to-end court booking, slot concurrency control, PhonePe payment processing, and customer retention platform.',
      resume_eligibility: true,
      primary_technologies: ['Next.js', 'React.js', 'Express.js', 'PostgreSQL', 'Prisma ORM', 'PhonePe Payment Gateway', 'Supertest', 'TypeScript', 'Zod'],
      live_url: 'https://www.venuebooking.example.com',
      is_monorepo: true,
      subcomponents: [{ name: 'web' }, { name: 'server' }],
      commit_count: 150,
      important_file_references: ['package.json', 'README.md', 'server/prisma/schema.prisma', 'tests/booking.test.js']
    };

    // Archetype 2: 3D Point Cloud Desktop Visualizer (Open3D, PyVista, VTK, PyQt6, Inno Setup)
    const tool3D = {
      id: 'tool-3d',
      name: 'PointViz 3D',
      title: '3D LiDAR Point Cloud Visualizer Desktop App',
      purpose: 'Interactive 3D LiDAR point cloud visualization, RANSAC ground plane segmentation, and voxel downsampling.',
      technical_analysis: 'Employs RANSAC plane segmentation, KD-Tree spatial queries, and VTK OpenGL rendering.',
      resume_eligibility: true,
      primary_technologies: ['Open3D', 'PyVista', 'VTK', 'PyQt6', 'Python', 'NumPy', 'Inno Setup', 'PyInstaller'],
      commit_count: 85,
      important_file_references: ['setup.py', 'README.md', 'inno_setup.iss', 'tests/test_geometry.py']
    };

    // Archetype 3: AI / Semantic Vector Search Microservice (FastAPI, pgvector, sentence-transformers)
    const aiPlatform = {
      id: 'ai-platform',
      name: 'TrueSemantic',
      title: 'AI Semantic Search & Vector Embeddings Engine',
      purpose: 'Algorithmic feed ranking engine and natural language semantic vector search using high-dimensional embeddings.',
      technical_analysis: 'In-database vector calculations using pgvector HNSW indexing, 384-dimensional dense embeddings with sentence-transformers.',
      resume_eligibility: true,
      primary_technologies: ['FastAPI', 'Python', 'PostgreSQL', 'pgvector', 'sentence-transformers', 'Docker Compose', 'NumPy'],
      commit_count: 90,
      important_file_references: ['requirements.txt', 'README.md', 'Dockerfile', 'docker-compose.yml', 'migrations/001_hnsw.sql']
    };

    // Archetype 4: Low-Level Binary UDP Driver (UDP Sockets, binary packet deserialization, CRC16/32)
    const binaryDriver = {
      id: 'binary-driver',
      name: 'LiDAR Driver',
      title: 'Binary Protocol UDP Sensor Driver',
      purpose: 'Low-level UDP socket deserialization, binary unpack, and CRC32 hardware sensor telemetry parser.',
      technical_analysis: 'Binary unpack with 0xAA preamble verification, little-endian struct unpack, and dual CRC16/CRC32 checksum checking.',
      resume_eligibility: true,
      primary_technologies: ['Binary Protocols', 'UDP Sockets', 'Python', 'NumPy', 'Setuptools'],
      commit_count: 60,
      important_file_references: ['setup.py', 'README.md', 'tests/test_crc.py']
    };

    const archetypes = [webSaaS, tool3D, aiPlatform, binaryDriver];

    // Under Full-Stack preset: Web SaaS MUST rank #1
    const fsRank = rankProjects(archetypes, { role: 'fullstack' });
    assert.equal(fsRank.rankedProjects[0].id, 'web-saas', 'Full-Stack role must rank full-stack web SaaS #1');

    // Under Systems / 3D preset: 3D Visualizer and Binary Driver MUST rank in the top 2
    const sysRank = rankProjects(archetypes, { role: 'systems_3d' });
    const top2SysIds = [sysRank.rankedProjects[0].id, sysRank.rankedProjects[1].id];
    assert.ok(top2SysIds.includes('tool-3d'), 'Systems / 3D role must rank 3D tool in top 2');
    assert.ok(top2SysIds.includes('binary-driver') || top2SysIds.includes('tool-3d'), 'Systems / 3D role must prioritize systems archetypes');
    assert.ok(
      sysRank.rankedProjects.find(p => p.id === 'tool-3d').qualityScore > sysRank.rankedProjects.find(p => p.id === 'web-saas').qualityScore,
      '3D tool must have higher quality score than web SaaS in systems_3d'
    );

    // Under AI/ML preset: AI Semantic Platform MUST rank #1
    const aiRank = rankProjects(archetypes, { role: 'ai_ml_data' });
    assert.equal(aiRank.rankedProjects[0].id, 'ai-platform', 'AI/ML role must rank semantic vector search #1');
    assert.ok(
      aiRank.rankedProjects.find(p => p.id === 'ai-platform').qualityScore > aiRank.rankedProjects.find(p => p.id === 'web-saas').qualityScore,
      'AI platform must score higher than web SaaS in ai_ml_data role'
    );
  });

  // 14. Weight sensitivity test: Increasing a criterion weight mathematically increases relative advantage
  test('Case 14: Weight sensitivity dynamically shifts ranking according to mathematical expectations', () => {
    // Project High Depth / Low Breadth
    const projDepth = {
      id: 'high-depth',
      name: 'Deep Algorithms',
      resume_eligibility: true,
      primary_technologies: ['Open3D', 'PyVista', 'NumPy'],
      commit_count: 50
    };

    // Project Low Depth / High Breadth
    const projBreadth = {
      id: 'high-breadth',
      name: 'Broad Portal',
      resume_eligibility: true,
      primary_technologies: ['React.js', 'Express.js', 'PostgreSQL', 'Cloudinary', 'JWT Auth'],
      commit_count: 50
    };

    const catalog = [projDepth, projBreadth];

    // High depth weight preset (depth: 2.0, breadth: 0.2)
    const customDepthWeights = { depth: 2.0, impact: 1.0, quality: 1.0, breadth: 0.2, uniqueness: 1.0, readiness: 1.0, storytelling: 1.0 };
    const depthRank = rankProjects(catalog, { role: 'general', customWeights: customDepthWeights });
    assert.equal(depthRank.rankedProjects[0].id, 'high-depth');

    // High breadth weight preset (depth: 0.2, breadth: 2.0)
    const customBreadthWeights = { depth: 0.2, impact: 1.0, quality: 1.0, breadth: 2.0, uniqueness: 1.0, readiness: 1.0, storytelling: 1.0 };
    const breadthRank = rankProjects(catalog, { role: 'general', customWeights: customBreadthWeights });
    assert.equal(breadthRank.rankedProjects[0].id, 'high-breadth');
  });

  // 15. Non-web impact regression: Packaged desktop installers and distributed libraries receive impact credit
  test('Case 15: Non-web software releases receive concrete real-world impact credit', () => {
    const desktopApp = {
      id: 'desktop-installer',
      name: 'Desktop App with Installer',
      resume_eligibility: true,
      primary_technologies: ['Inno Setup', 'PyInstaller', 'PyQt6', 'Python'],
      important_file_references: ['setup.iss', 'build.bat']
    };

    const libraryPkg = {
      id: 'python-lib',
      name: 'Distributed Python Driver',
      resume_eligibility: true,
      primary_technologies: ['Binary Protocols', 'UDP Sockets', 'Setuptools', 'Python']
    };

    const scoredDesktop = scoreProjectDimensions(desktopApp, 'general');
    const scoredLib = scoreProjectDimensions(libraryPkg, 'general');

    assert.ok(scoredDesktop.rawScores.impact >= 7, 'Desktop app with Inno Setup must receive >= 7 impact points');
    assert.ok(scoredLib.rawScores.impact >= 6, 'Reusable driver library with setuptools must receive >= 6 impact points');
  });

  // 16. Vector search and algorithmic depth regression
  test('Case 16: pgvector and sentence-transformers receive algorithmic depth and uniqueness credit', () => {
    const vectorProj = {
      id: 'vec-proj',
      name: 'Semantic Feed',
      resume_eligibility: true,
      primary_technologies: ['FastAPI', 'PostgreSQL', 'pgvector', 'sentence-transformers (all-MiniLM-L6-v2)'],
      technical_analysis: 'pgvector HNSW cosine similarity search over 384-dimensional dense vectors.'
    };

    const scoredGeneral = scoreProjectDimensions(vectorProj, 'general');
    const scoredAi = scoreProjectDimensions(vectorProj, 'ai_ml_data');

    assert.ok(scoredGeneral.rawScores.depth >= 13, 'General role must credit vector search depth (>= 13 pts)');
    assert.ok(scoredAi.rawScores.depth >= 17, 'AI/ML role must credit vector search depth heavily (>= 17 pts)');
    assert.equal(scoredAi.rawScores.uniqueness, 10, 'AI/ML role must award maximum uniqueness (10/10) to HNSW vector search');
  });

});

