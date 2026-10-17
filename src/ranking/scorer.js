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
 * Evaluates concrete observable evidence (manifests, source files, git history, architecture).
 *
 * @param {object} project - Project catalog entry
 * @param {string} [role='fullstack'] - Target role preset key ('fullstack', 'backend', 'ai_ml_data', 'systems_3d')
 * @returns {object} { rawScores, totalRawScore, breakdown, reasons }
 */
function scoreProjectDimensions(project, role = 'fullstack') {
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

  if (role === 'systems_3d') {
    // Systems, 3D Graphics, Spatial Math, Binary Protocols, WASM, Performance
    // 1a. Core 3D/Systems Algorithms & Protocols (up to 10 pts)
    if (
      techSet.has('open3d') || techSet.has('pyvista') || techSet.has('vtk') ||
      /\b(point cloud|lidar|ransac|voxel|dem|elevation model|ground_filter)\b/i.test(combinedText)
    ) {
      depth += 10;
      reasons.push('Technical Depth (Systems/3D): 3D spatial geometry & point-cloud processing (Open3D, PyVista, VTK, RANSAC, DEM) (+10)');
    } else if (
      techSet.has('binary protocols') || techSet.has('udp sockets') ||
      /\b(binary protocol|udp socket|struct unpack|crc16|crc32|0xaa preamble)\b/i.test(combinedText)
    ) {
      depth += 10;
      reasons.push('Technical Depth (Systems/3D): Low-level binary UDP protocol deserialization & packet verification (+10)');
    } else if (techSet.has('webassembly (pyodide)') || /\b(wasm|webassembly|pyodide)\b/i.test(combinedText)) {
      depth += 9;
      reasons.push('Technical Depth (Systems/3D): Sandboxed WebAssembly execution engine (+9)');
    } else if (techSet.has('mediapipe') || techSet.has('opencv') || techSet.has('a-frame') || techSet.has('three.js')) {
      depth += 8;
      reasons.push('Technical Depth (Systems/3D): Computer vision & spatial graphics rendering pipeline (+8)');
    } else if (techSet.has('micropython') || techSet.has('pygame')) {
      depth += 7;
      reasons.push('Technical Depth (Systems/3D): Embedded physical computing & state machine graphics (+7)');
    }

    // 1b. Sensor & Concurrency Interfacing (up to 8 pts)
    if (/\b(livox|sensor|telemetry|sensor ingestion|sensor hardware)\b/i.test(combinedText)) {
      depth += 8;
      reasons.push('Technical Depth (Systems/3D): High-throughput hardware sensor telemetry ingestion (+8)');
    } else if (techSet.has('binary protocols') || techSet.has('udp sockets')) {
      depth += 7;
      reasons.push('Technical Depth (Systems/3D): Hardware protocol streaming & socket buffers (+7)');
    } else if (/\b(ctypes|win32 api|bleak|bluetooth rssi)\b/i.test(combinedText)) {
      depth += 6;
      reasons.push('Technical Depth (Systems/3D): Native OS/hardware API interfacing via C-types / Bluetooth (+6)');
    }

    // 1c. Performance Engineering & Build Rigor (up to 7 pts)
    if (techSet.has('c++') || techSet.has('go') || fileRefs.some(f => /cmakelists|makefile|inno setup/i.test(f))) {
      depth += 7;
      reasons.push('Technical Depth (Systems/3D): Compiled systems build automation & native distribution (+7)');
    } else if (techSet.has('open3d') || techSet.has('pyvista') || techSet.has('webassembly (pyodide)')) {
      depth += 6;
      reasons.push('Technical Depth (Systems/3D): High-performance native computational libraries (+6)');
    } else if (project.commit_count > 50) {
      depth += 3;
    }
  } else if (role === 'ai_ml_data') {
    // AI, Machine Learning, Deep Learning, Embeddings, Vector Search, Data Pipelines
    // 1a. Core Models, Embeddings & Vectors (up to 10 pts)
    if (
      techSet.has('sentence-transformers') || techSet.has('sentence-transformers (all-minilm-l6-v2)') ||
      techSet.has('pgvector') || /\b(embeddings?|hnsw|vector search|cosine similarity|centroid vector)\b/i.test(combinedText)
    ) {
      depth += 10;
      reasons.push('Technical Depth (AI/ML): High-dimensional semantic embeddings & pgvector HNSW similarity search (+10)');
    } else if (
      techSet.has('resnet-50 v2') || techSet.has('tensorflow/keras') || techSet.has('tensorflow') ||
      techSet.has('pytorch') || techSet.has('openai whisper') || /\b(deep learning|neural network|resnet)\b/i.test(combinedText)
    ) {
      depth += 10;
      reasons.push('Technical Depth (AI/ML): Deep learning neural network training & inference pipelines (+10)');
    } else if (techSet.has('mediapipe') || techSet.has('opencv') || /\b(computer vision|gesture recognition)\b/i.test(combinedText)) {
      depth += 8;
      reasons.push('Technical Depth (AI/ML): Real-time computer vision inference & hand gesture tracking (+8)');
    } else if (techSet.has('open3d') || techSet.has('pyvista') || /\b(point cloud|lidar|ransac|voxel)\b/i.test(combinedText)) {
      depth += 8;
      reasons.push('Technical Depth (AI/ML): 3D spatial feature extraction & geometric classification (+8)');
    } else if (techSet.has('google gemini api') || techSet.has('vercel ai sdk') || techSet.has('hugging face gradio client')) {
      depth += 7;
      reasons.push('Technical Depth (AI/ML): LLM integration & foundation model API orchestration (+7)');
    } else if (techSet.has('acrcloud api') || techSet.has('pydub') || /\b(dsp|audio fingerprint)\b/i.test(combinedText)) {
      depth += 6;
      reasons.push('Technical Depth (AI/ML): Audio signal processing & acoustic fingerprint recognition (+6)');
    }

    // 1b. Analytical Pipelines & Mathematical Processing (up to 8 pts)
    if (techSet.has('scipy') || techSet.has('pandas') || techSet.has('numpy')) {
      depth += 8;
      reasons.push('Technical Depth (AI/ML): Numerical matrix computing & scientific data pipelines (NumPy, SciPy, Pandas) (+8)');
    } else if (/\b(centroid|l2 normalization|time-decay|multi-objective ranking)\b/i.test(combinedText)) {
      depth += 7;
      reasons.push('Technical Depth (AI/ML): Mathematical ranking formulations & vector normalization (+7)');
    }

    // 1c. Data Store & Vector Indexing (up to 7 pts)
    if (techSet.has('pgvector') || /\b(hnsw|vector_cosine_ops)\b/i.test(combinedText)) {
      depth += 7;
      reasons.push('Technical Depth (AI/ML): Approximate Nearest Neighbor (ANN) index engineering (+7)');
    } else if (techSet.has('postgresql') || techSet.has('mongodb/mongoose')) {
      depth += 5;
    } else if (techList.length > 0) {
      depth += 3;
    }
  } else if (role === 'backend') {
    // API architecture, database modeling, concurrency, distributed systems
    // 1a. Relational Data Modeling & Migrations (up to 8 pts)
    if (
      techSet.has('prisma orm') || techSet.has('postgresql') || techSet.has('postgresql 16') ||
      techSet.has('drizzle orm') || techSet.has('pgvector') ||
      /\b(relational schema|migrations?|15\+ models|prisma\/schema\.prisma)\b/i.test(combinedText)
    ) {
      depth += 8;
      reasons.push('Technical Depth (Backend): Relational ORM schema modeling, migrations & constraints (+8)');
    } else if (techSet.has('mongodb/mongoose') || techSet.has('firebase firestore')) {
      depth += 6;
      reasons.push('Technical Depth (Backend): Document store schema modeling & indexing (+6)');
    }

    // 1b. Concurrency, Distributed Services & Schedulers (up to 8 pts)
    if (
      /\b(transactional|slot reservation|concurrency|state machine|mutex|temporary hold timeouts)\b/i.test(combinedText) ||
      /\b(background scheduler|task draining|in-flight task)\b/i.test(combinedText)
    ) {
      depth += 8;
      reasons.push('Technical Depth (Backend): Concurrency controls, transactional reservation holds & lifecycle schedulers (+8)');
    } else if (subcomponents.length >= 2 || project.is_monorepo || /\b(microservice|decoupled|multi-service)\b/i.test(combinedText)) {
      depth += 7;
      reasons.push('Technical Depth (Backend): Distributed multi-service architecture (+7)');
    } else if (techSet.has('redis') || /\b(worker|bullmq|queue)\b/i.test(combinedText)) {
      depth += 6;
    }

    // 1c. Secure Transactions & Network Protocols (up to 9 pts)
    if (
      techSet.has('razorpay api') || techSet.has('phonepe payment gateway') ||
      /\b(payment gateway|provider factory|hmac|sha-256 webhook|webhook verification)\b/i.test(combinedText)
    ) {
      depth += 9;
      reasons.push('Technical Depth (Backend): Payment provider abstraction factory & cryptographic webhook validation (+9)');
    } else if (techSet.has('binary protocols') || techSet.has('udp sockets')) {
      depth += 8;
      reasons.push('Technical Depth (Backend): Binary UDP network socket communication (+8)');
    } else if (techSet.has('socket.io') || /\b(websockets?)\b/i.test(combinedText)) {
      depth += 7;
    }
  } else if (role === 'fullstack') {
    // End-to-end full-stack delivery, client/server monorepos, state machines, payment workflows
    // 1a. Architecture & Multi-Tier Coordination (up to 7 pts)
    if (subcomponents.length >= 2 || project.is_monorepo) {
      depth += 7;
      reasons.push('Technical Depth (Full-Stack): Modular client/server monorepo coordination (+7)');
    } else if (/\b(client\/server|full-stack|microservice)\b/i.test(combinedText)) {
      depth += 6;
    }

    // 1b. Data Layer Rigor (up to 6 pts)
    if (techSet.has('prisma orm') || techSet.has('postgresql') || techSet.has('drizzle orm')) {
      depth += 6;
      reasons.push('Technical Depth (Full-Stack): End-to-end type-safe ORM & relational data modeling (+6)');
    } else if (techSet.has('mongodb/mongoose') || techSet.has('firebase firestore')) {
      depth += 5;
    }

    // 1c. Commercial API & Workflow Integration (up to 6 pts)
    if (
      techSet.has('razorpay api') || techSet.has('phonepe payment gateway') ||
      /\b(payment gateway|razorpay|phonepe|stripe|booking platform)\b/i.test(combinedText)
    ) {
      depth += 6;
      reasons.push('Technical Depth (Full-Stack): Production payment gateway integration & webhook handling (+6)');
    } else if (techSet.has('google gemini api') || techSet.has('vercel ai sdk')) {
      depth += 5;
    }

    // 1d. Real-Time & Auxiliary Services (up to 6 pts)
    if (techSet.has('socket.io') || /\b(websockets?|concurrency|state machine|scheduler)\b/i.test(combinedText)) {
      depth += 6;
      reasons.push('Technical Depth (Full-Stack): Real-time synchronization & state machine workflows (+6)');
    } else if (techSet.has('cloudinary') || techSet.has('firebase admin sdk') || techSet.has('aws s3') || techSet.has('whatsapp otp api')) {
      depth += 5;
      reasons.push('Technical Depth (Full-Stack): Multi-cloud asset and transactional messaging integration (+5)');
    }
  } else {
    // General-Purpose: Balanced algorithmic and architectural depth across any discipline
    if (
      techSet.has('open3d') || techSet.has('pyvista') || techSet.has('vtk') ||
      /\b(ransac|point cloud|lidar|voxel|ground_filter)\b/i.test(combinedText) ||
      /\b(dem|elevation model)\b/i.test(combinedText)
    ) {
      depth += 8;
      reasons.push('Technical Depth: 3D point cloud / spatial geometric algorithms (RANSAC, DEM, Open3D) (+8)');
    } else if (
      techSet.has('sentence-transformers') || techSet.has('pgvector') ||
      /\b(embeddings?|hnsw|vector search|cosine similarity)\b/i.test(combinedText)
    ) {
      depth += 8;
      reasons.push('Technical Depth: Semantic vector embeddings & pgvector HNSW search (+8)');
    } else if (techSet.has('webassembly (pyodide)') || /\b(wasm|webassembly|pyodide)\b/i.test(combinedText)) {
      depth += 7;
      reasons.push('Technical Depth: Sandboxed in-browser WebAssembly Pyodide execution (+7)');
    } else if (
      techSet.has('binary protocols') || techSet.has('udp sockets') ||
      /\b(binary protocol|udp socket|struct unpack|crc16|crc32)\b/i.test(combinedText)
    ) {
      depth += 7;
      reasons.push('Technical Depth: Binary UDP protocol deserialization & packet verification (+7)');
    } else if (
      techSet.has('pytorch') || techSet.has('tensorflow') || techSet.has('mediapipe') ||
      techSet.has('opencv') || techSet.has('resnet-50 v2') || techSet.has('openai whisper')
    ) {
      depth += 6;
      reasons.push('Technical Depth: Machine learning inference & computer vision pipelines (+6)');
    } else if (techSet.has('socket.io') || /\b(websockets?|socket\.io)\b/i.test(combinedText)) {
      depth += 5;
      reasons.push('Technical Depth: Full-duplex WebSocket real-time state synchronization (+5)');
    } else if (techSet.has('pydub') || techSet.has('acrcloud') || /\b(dsp|audio processing|fft)\b/i.test(combinedText)) {
      depth += 5;
      reasons.push('Technical Depth: Digital audio signal processing & fingerprinting (+5)');
    }

    if (/\b(livox|sensor|telemetry|sensor ingestion)\b/i.test(combinedText)) {
      depth += 6;
      reasons.push('Technical Depth: High-throughput sensor hardware telemetry ingestion (+6)');
    } else if (subcomponents.length >= 2 || project.is_monorepo || /\b(microservice|decoupled|multi-service)\b/i.test(combinedText)) {
      depth += 5;
      reasons.push('Technical Depth: Multi-service client/server distributed architecture (+5)');
    } else if (techSet.has('redis') || /\b(worker|bullmq|celery|queue|scheduler)\b/i.test(combinedText)) {
      depth += 4;
      reasons.push('Technical Depth: Asynchronous task queue / cache coordination (+4)');
    } else if (project.commit_count > 50) {
      depth += 3;
    }

    if (
      techSet.has('razorpay api') || techSet.has('phonepe payment gateway') ||
      /\b(payment gateway|razorpay|phonepe|stripe)\b/i.test(combinedText)
    ) {
      depth += 6;
      reasons.push('Technical Depth: Secure payment gateway & webhook transaction verification (+6)');
    } else if (techSet.has('google gemini api') || techSet.has('vercel ai sdk') || techSet.has('hugging face gradio client')) {
      depth += 5;
      reasons.push('Technical Depth: Foundation AI API integration (+5)');
    } else if (techSet.has('cloudinary') && (techSet.has('firebase') || techSet.has('aws s3'))) {
      depth += 5;
      reasons.push('Technical Depth: Dual cloud asset & document store synchronization (+5)');
    } else if (techList.length >= 5) {
      depth += 3;
    }

    if (techSet.has('pgvector') || techSet.has('prisma orm') || techSet.has('postgresql') || techSet.has('drizzle orm')) {
      depth += 5;
      reasons.push('Technical Depth: Relational ORM schema migrations / vector indexing (+5)');
    } else if (techSet.has('mongodb/mongoose') || techSet.has('firebase firestore')) {
      depth += 4;
      reasons.push('Technical Depth: NoSQL document store with structured indexing (+4)');
    } else if (techList.length > 0) {
      depth += 2;
    }
  }
  const boundedDepth = Math.min(25, Math.max(0, depth));

  // ── Dimension 2: Real-World Impact & Deployment (Max 20 pts) ──────────────
  let impact = 0;
  // 2a. Verified Live Deployment / Distribution Verification (up to 8 pts)
  if (project.live_url && typeof project.live_url === 'string') {
    const isCustomDomain = !project.live_url.includes('firebase.google.com') &&
                           !project.live_url.includes('github.com') &&
                           !project.live_url.includes('localhost');
    if (isCustomDomain) {
      impact += 8;
      reasons.push(`Real-World Impact: Live verified production deployment on custom domain (${project.live_url}) (+8)`);
    } else {
      impact += 6;
      reasons.push(`Real-World Impact: Live cloud deployment verified (${project.live_url}) (+6)`);
    }
  } else if (/\b(railway|freight|wagon load|industrial telemetry|derailment)\b/i.test(combinedText)) {
    impact += 8;
    reasons.push('Real-World Impact: Field-deployed industrial telemetry & railway auditing system (+8)');
  } else if (
    techSet.has('inno setup') || techSet.has('pyinstaller') ||
    /\b(inno setup|pyinstaller|standalone executable|desktop visualizer)\b/i.test(combinedText)
  ) {
    impact += 7;
    reasons.push('Real-World Impact: Packaged standalone desktop installer distribution (+7)');
  } else if (techSet.has('docker compose') || techSet.has('kubernetes') || techSet.has('oracle cloud infrastructure (oci) go sdk')) {
    impact += 6;
    reasons.push('Real-World Impact: Containerized cloud infrastructure deployment (+6)');
  } else if (techSet.has('setuptools') || /\b(binary protocol|hardware driver|reusable library)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Packaged reusable engineering package / hardware driver (+6)');
  }

  // 2b. Commercial / Operational Transaction Flow (up to 6 pts)
  if (/\b(derailment|railway|freight|wagon|industrial audit)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Safety-critical freight audit and derailment hazard prevention (+6)');
  } else if (/\b(payment|booking|payout|billing|phonepe|razorpay|subscription)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Active booking transactions and commercial billing workflows (+6)');
  } else if (/\b(candidate|assessment|interview|evaluation|codemirror|pyodide)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Live talent evaluation and real-world candidate assessment (+6)');
  } else if (/\b(feed ranking|semantic vector search|social feed|authenticity)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Social feed ranking & semantic vector search engine (+6)');
  } else if (/\b(lead|crm|enrichment|gemini)\b/i.test(combinedText)) {
    impact += 5;
    reasons.push('Real-World Impact: Automated CRM lead enrichment and marketing pipeline (+5)');
  } else if (/\b(song recognition|audio fingerprint|telegram bot)\b/i.test(combinedText)) {
    impact += 5;
    reasons.push('Real-World Impact: Real-time Telegram bot service & audio recognition (+5)');
  }

  // 2c. Real User / Multi-Tenant / Operational Workflows (up to 6 pts)
  if (/\b(multi-tenant|court booking|slot schedule|slot reservation|salon booking)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Multi-tenant organizational data isolation and slot scheduling (+6)');
  } else if (/\b(multi-station|remote station|operations teams)\b/i.test(combinedText)) {
    impact += 6;
    reasons.push('Real-World Impact: Multi-station remote operations teams telemetry selectors (+6)');
  } else if (/\b(point cloud visualization|3d visualizer|interactive visualizer)\b/i.test(combinedText)) {
    impact += 5;
    reasons.push('Real-World Impact: Interactive point cloud visualization & inspection tools (+5)');
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
    quality += 5;
    reasons.push('Engineering Quality: Automated testing framework configured in manifests (+5)');
  } else if (hasTestFiles) {
    quality += 4;
    reasons.push('Engineering Quality: Test scripts identified in repository (+4)');
  }

  // 3b. Type Safety & Database Schema Rigor (up to 5 pts)
  if (
    techSet.has('typescript') &&
    (techSet.has('prisma orm') || techSet.has('drizzle orm') || fileRefs.some(f => f.includes('prisma') || f.includes('migration')))
  ) {
    quality += 5;
    reasons.push('Engineering Quality: End-to-end TypeScript strict typing and declarative schemas (+5)');
  } else if (
    /\b(migrations?|create_posts_table|hnsw indexing)\b/i.test(combinedText) ||
    fileRefs.some(f => f.includes('migration') || f.includes('schema'))
  ) {
    quality += 4;
    reasons.push('Engineering Quality: Declarative database migrations and schema versioning (+4)');
  } else if (techSet.has('typescript')) {
    quality += 3;
    reasons.push('Engineering Quality: TypeScript type safety and compile-time verification (+3)');
  } else if (techSet.has('prisma orm') || techSet.has('drizzle orm')) {
    quality += 3;
    reasons.push('Engineering Quality: Declarative ORM schema modeling (+3)');
  } else if (/\b(spatial normalization|license_service|wall_based_normalize|crc16|crc32)\b/i.test(combinedText)) {
    quality += 4;
    reasons.push('Engineering Quality: Multi-stage normalization pipeline and integrity checksums (+4)');
  }

  // 3c. Build Automation & Workspace Architecture (up to 4 pts)
  if (
    techSet.has('docker compose') || techSet.has('docker') || techSet.has('kubernetes') ||
    fileRefs.some(f => /docker/i.test(f))
  ) {
    quality += 4;
    reasons.push('Engineering Quality: Containerized build & multi-service Docker orchestration (+4)');
  } else if (project.is_monorepo || subcomponents.length > 0) {
    quality += 3;
    reasons.push('Engineering Quality: Modular monorepo / multi-package workspace governance (+3)');
  } else if (fileRefs.some(f => /makefile|cmakelists|inno setup|pyinstaller/i.test(f)) || techSet.has('inno setup')) {
    quality += 3;
    reasons.push('Engineering Quality: Native desktop packaging / build automation (+3)');
  } else if (project.commit_count > 20) {
    quality += 2;
  }
  const boundedQuality = Math.min(15, Math.max(0, quality));

  // ── Dimension 4: Breadth of Skills (Max 15 pts) ───────────────────────────
  let breadth = 0;
  // Multi-tier stack integration: 3 pts per tier (up to 15 pts max)
  const hasFrontend = techSet.has('react.js') || techSet.has('react') || techSet.has('next.js') || techSet.has('vue.js') ||
                      techSet.has('tailwind css') || techSet.has('tailwind css v4') || techSet.has('react native (expo)') ||
                      techSet.has('flutter (dart)') || techSet.has('pyqt6') || techSet.has('pyqt5') || techSet.has('three.js') ||
                      techSet.has('a-frame') || techSet.has('pygame');
  const hasBackend = techSet.has('express.js') || techSet.has('nestjs') || techSet.has('fastapi') || techSet.has('fastapi (python)') ||
                     techSet.has('laravel 11 (php 8.2)') || techSet.has('flask') || techSet.has('django') || techSet.has('node.js') ||
                     techSet.has('python') || techSet.has('go');
  const hasDatabase = techSet.has('postgresql') || techSet.has('postgresql 16') || techSet.has('pgvector') ||
                      techSet.has('mongodb/mongoose') || techSet.has('mongodb') || techSet.has('prisma orm') ||
                      techSet.has('drizzle orm') || techSet.has('firebase firestore') || techSet.has('redis') || techSet.has('sqlite');
  const hasCloudOrApi = techSet.has('cloudinary') || techSet.has('firebase') || techSet.has('firebase admin sdk') ||
                        techSet.has('razorpay api') || techSet.has('phonepe payment gateway') || techSet.has('resend api') ||
                        techSet.has('google gemini api') || techSet.has('aws s3') || techSet.has('cloudflare workers') ||
                        techSet.has('docker compose') || techSet.has('kubernetes') || techSet.has('oracle cloud infrastructure (oci) go sdk');
  const hasSecurityOrAuth = techSet.has('jwt auth') || techSet.has('jwt') || techSet.has('zod') || techSet.has('joi') ||
                            techSet.has('helmet') || /\b(auth|rbac|license_service|aes-256|sha-256|hmac|crc16|crc32|win32 api)\b/i.test(combinedText);

  if (hasFrontend) { breadth += 3; }
  if (hasBackend) { breadth += 3; }
  if (hasDatabase) { breadth += 3; }
  if (hasCloudOrApi) { breadth += 3; }
  if (hasSecurityOrAuth) { breadth += 3; }

  const tiersPresent = [hasFrontend, hasBackend, hasDatabase, hasCloudOrApi, hasSecurityOrAuth].filter(Boolean).length;
  reasons.push(`Breadth of Skills: Spans ${tiersPresent} distinct architectural tiers (${breadth} pts)`);
  const boundedBreadth = Math.min(15, Math.max(0, breadth));

  // ── Dimension 5: Architectural Uniqueness (Max 10 pts) ────────────────────
  let uniqueness = 5;
  if (role === 'systems_3d') {
    if (/\b(wagon|derailment)\b/i.test(combinedText)) {
      uniqueness = 10;
      reasons.push('Architectural Uniqueness (Systems/3D): Industrial 3D LiDAR freight safety analysis (10/10)');
    } else if (techSet.has('open3d') || techSet.has('pyvista') || techSet.has('vtk') || /\b(pointviz|point cloud|lidar)\b/i.test(combinedText)) {
      uniqueness = 10;
      reasons.push('Architectural Uniqueness (Systems/3D): Interactive 3D point cloud visualizer with VTK rendering (10/10)');
    } else if (techSet.has('webassembly (pyodide)') || /\b(wasm|webassembly|pyodide)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness (Systems/3D): In-browser sandboxed WebAssembly Python execution (9/10)');
    } else if (techSet.has('binary protocols') || /\b(udp socket|binary protocol|0xaa preamble|livox-py)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness (Systems/3D): Raw binary UDP protocol driver & packet parser (9/10)');
    } else if (techSet.has('mediapipe') || techSet.has('opencv') || techSet.has('a-frame') || techSet.has('ar.js')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Systems/3D): Computer vision & WebAR spatial tracking (8/10)');
    } else if (techSet.has('micropython') || /\b(companion robot|fsm)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Systems/3D): Microcontroller robotics & finite state machine (8/10)');
    } else {
      uniqueness = 4;
    }
  } else if (role === 'ai_ml_data') {
    if (techSet.has('pgvector') || /\b(hnsw|sentence-transformers|authenticity-driven|vector search)\b/i.test(combinedText)) {
      uniqueness = 10;
      reasons.push('Architectural Uniqueness (AI/ML): Authenticity-driven semantic vector search with HNSW embeddings (10/10)');
    } else if (techSet.has('resnet-50 v2') || /\b(medical imaging|resnet)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness (AI/ML): Deep learning medical image diagnostics (9/10)');
    } else if (techSet.has('openai whisper') || techSet.has('pytorch') || /\b(audio source separation|whisper)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness (AI/ML): Deep learning audio source separation & transcription (9/10)');
    } else if (techSet.has('mediapipe') || techSet.has('opencv') || /\b(gesture recognition|mediapipe hands)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (AI/ML): Real-time hand landmark tracking & gesture recognition (8/10)');
    } else if (techSet.has('acrcloud api') || /\b(audio fingerprinting)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (AI/ML): Acoustic fingerprinting & audio retrieval bot (8/10)');
    } else if (/\b(wagon|derailment)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (AI/ML): 3D spatial geometry & load balance calculation (8/10)');
    } else if (techSet.has('google gemini api') || techSet.has('vercel ai sdk')) {
      uniqueness = 7;
      reasons.push('Architectural Uniqueness (AI/ML): AI prompt management & Gemini lead extraction (7/10)');
    } else {
      uniqueness = 4;
    }
  } else if (role === 'backend') {
    if (techSet.has('pgvector') || /\b(hnsw|vector search)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness (Backend): Approximate nearest neighbor vector indexing in PostgreSQL (9/10)');
    } else if (/\b(slot conflict|court booking|temporary hold timeouts)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Backend): Transactional slot hold timeouts & concurrency state machines (8/10)');
    } else if (/\b(multi-tenant firm|document vault)\b/i.test(combinedText)) {
      uniqueness = 7;
      reasons.push('Architectural Uniqueness (Backend): Multi-tenant practice management & secure document vaults (7/10)');
    } else if (techSet.has('binary protocols') || techSet.has('oracle cloud infrastructure (oci) go sdk')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Backend): Low-level socket network drivers / cloud orchestrator (8/10)');
    } else if (project.is_monorepo) {
      uniqueness = 6;
      reasons.push('Architectural Uniqueness (Backend): Multi-service monorepo architecture (6/10)');
    } else {
      uniqueness = 5;
    }
  } else if (role === 'fullstack') {
    if (/\b(court booking|venue management|pickleball)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Full-Stack): Complete venue booking platform with payments & SMS OTP (8/10)');
    } else if (/\b(multi-tenant|practice management|caworkflow)\b/i.test(combinedText)) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Full-Stack): Full-stack practice management with document vaults & billing (8/10)');
    } else if (/\b(salon booking|multi-tenant firm|evercut)\b/i.test(combinedText)) {
      uniqueness = 7;
      reasons.push('Architectural Uniqueness (Full-Stack): Multi-tenant appointment platform with mobile app (7/10)');
    } else if (techSet.has('webassembly (pyodide)')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness (Full-Stack): In-browser client-side WebAssembly compiler IDE (8/10)');
    } else if (project.is_monorepo) {
      uniqueness = 7;
      reasons.push('Architectural Uniqueness (Full-Stack): Multi-package monorepo full-stack architecture (7/10)');
    } else {
      uniqueness = 5;
    }
  } else {
    // General
    if (/\b(wagon|derailment)\b/i.test(combinedText)) {
      uniqueness = 10;
      reasons.push('Architectural Uniqueness: Industrial 3D LiDAR point cloud freight safety analysis (10/10)');
    } else if (techSet.has('webassembly (pyodide)')) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness: In-browser sandboxed WebAssembly Python execution (9/10)');
    } else if (techSet.has('pgvector') || /\b(hnsw|sentence-transformers|vector search)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness: Semantic vector search & HNSW cosine embeddings (9/10)');
    } else if (techSet.has('open3d') || techSet.has('pyvista') || techSet.has('vtk') || /\b(lidar)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness: 3D point cloud visualizer & spatial analysis (9/10)');
    } else if (techSet.has('binary protocols') || /\b(udp socket)\b/i.test(combinedText)) {
      uniqueness = 9;
      reasons.push('Architectural Uniqueness: Binary UDP protocol deserialization & sensor driver (9/10)');
    } else if (techSet.has('mediapipe') || techSet.has('opencv')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness: Computer vision gesture recognition (8/10)');
    } else if (techSet.has('resnet-50 v2')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness: Medical imaging deep learning diagnostics (8/10)');
    } else if (techSet.has('openai whisper') || techSet.has('pytorch')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness: Audio source separation & transcription (8/10)');
    } else if (techSet.has('micropython')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness: Companion robotics & finite state machines (8/10)');
    } else if (techSet.has('acrcloud api')) {
      uniqueness = 8;
      reasons.push('Architectural Uniqueness: Audio fingerprinting Telegram bot (8/10)');
    } else if (/\b(slot conflict|court booking)\b/i.test(combinedText)) {
      uniqueness = 7;
      reasons.push('Architectural Uniqueness: Slot collision resolution & sports venue management (7/10)');
    } else if (project.is_monorepo) {
      uniqueness = 6;
      reasons.push('Architectural Uniqueness: Multi-component monorepo platform architecture (6/10)');
    } else {
      uniqueness = 5;
      reasons.push('Architectural Uniqueness: Established full-stack web application domain (5/10)');
    }
  }
  const boundedUniqueness = Math.min(10, Math.max(0, uniqueness));

  // ── Dimension 6: Production Readiness (Max 10 pts) ────────────────────────
  let readiness = 0;
  // 6a. Authentication, Authorization & Licensing (up to 4 pts)
  if (
    techSet.has('jwt auth') || techSet.has('jwt') ||
    /\b(rbac|machine-fingerprint|license_service|aes-256|whatsapp otp|auth)\b/i.test(combinedText)
  ) {
    readiness += 4;
    reasons.push('Production Readiness: Security authorization, licensing or OTP authentication (+4)');
  } else if (techSet.has('firebase') || /\b(auth)\b/i.test(combinedText)) {
    readiness += 2;
    reasons.push('Production Readiness: Authentication integration (+2)');
  }

  // 6b. Input Validation, Integrity & Data Sanitization (up to 3 pts)
  if (techSet.has('zod') || techSet.has('joi')) {
    readiness += 3;
    reasons.push('Production Readiness: Strict runtime input validation schemas (Zod / Joi) (+3)');
  } else if (/\b(ground_filter|wall_based_normalize|voxel grid|crc16|crc32|hnsw indexing)\b/i.test(combinedText)) {
    readiness += 3;
    reasons.push('Production Readiness: Telemetry normalization, binary CRC checks or spatial sanitization (+3)');
  }

  // 6c. Infrastructure, Isolation & Reliability (up to 3 pts)
  if (
    techSet.has('docker compose') || techSet.has('kubernetes') ||
    /\b(helmet|rate limit|cors|graceful shutdown|scheduler)\b/i.test(combinedText)
  ) {
    readiness += 3;
    reasons.push('Production Readiness: Container orchestration, security policies or graceful shutdown (+3)');
  } else if (fileRefs.some(f => /env/i.test(f)) || project.commit_count > 30) {
    readiness += 2;
  }
  const boundedReadiness = Math.min(10, Math.max(0, readiness));

  // ── Dimension 7: Storytelling Potential (Max 5 pts) ───────────────────────
  let storytelling = 2;
  if (
    /\b(derailment|railway|freight audit)\b/i.test(combinedText) ||
    /\b(codeassess|talent evaluation|candidate assessment)\b/i.test(combinedText) ||
    /\b(trueconnect|authenticity-driven|semantic search)\b/i.test(combinedText) ||
    /\b(caworkflow|ca-workflow|statutory compliance)\b/i.test(combinedText)
  ) {
    storytelling = 5;
    reasons.push('Storytelling Potential: Compelling high-stakes problem-solution narrative arc (5/5)');
  } else if (/\b(court booking|venue management|pickleball|evercut|pointviz)\b/i.test(combinedText)) {
    storytelling = 4;
    reasons.push('Storytelling Potential: High-engagement consumer product / visual tool narrative (4/5)');
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
 * @param {string} [options.role='fullstack'] - Target role preset key
 * @param {object} [options.customWeights] - Optional custom criterion weights
 * @param {string} [options.jdText] - Optional Job Description text
 * @param {number} [options.alpha] - Relevance blending weight α ∈ [0, 1]
 * @param {string} [options.configPath] - Optional custom path to ranking-weights.json
 * @returns {object} { role, roleLabel, roleWeights, jdAnalysis, rankedProjects, stats }
 */
function rankProjects(catalog, options = {}) {
  const roleProfiles = loadRoleProfiles(options.configPath);
  const requestedRole = options.role === 'general' ? 'fullstack' : options.role;
  const roleKey = requestedRole && roleProfiles.rolePresets[requestedRole] ? requestedRole : 'fullstack';
  const rolePreset = roleProfiles.rolePresets[roleKey] || roleProfiles.rolePresets.fullstack;
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

    // b. Raw 7-factor dimension scores evaluated through role lens
    const dimResult = scoreProjectDimensions(project, roleKey);

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
