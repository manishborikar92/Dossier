/**
 * Job Description (JD) Tokenizer, Matcher, and Composite Score Blending Engine.
 *
 * Implements safe, zero-guarded Sørensen-Dice technical overlap and Jaccard domain context
 * overlap. Correctly falls back to quality score without penalty when a JD is empty,
 * uninformative, or contains no recognized technical/domain terms.
 */

// Canonical technology dictionary for token extraction from free-form text
const KNOWN_TECHNOLOGIES = [
  // Languages & Core Runtimes
  { name: 'JavaScript', matchers: [/\bjavascript\b/i, /\bjs\b/i, /\bes6\b/i] },
  { name: 'TypeScript', matchers: [/\btypescript\b/i, /\bts\b/i] },
  { name: 'Python', matchers: [/\bpython\b/i, /\bpy\b/i, /\bpython3\b/i] },
  { name: 'Node.js', matchers: [/\bnode\.?js\b/i, /\bnodejs\b/i] },
  { name: 'Rust', matchers: [/\brust\b/i, /\bcargo\b/i] },
  { name: 'Go', matchers: [/\bgolang\b/i, /\bgo\b/i] },
  { name: 'C++', matchers: [/\bc\+\+\b/i, /\bcpp\b/i] },
  { name: 'Dart', matchers: [/\bdart\b/i, /\bflutter\b/i] },
  { name: 'SQL', matchers: [/\bsql\b/i] },

  // Frontend Frameworks & Libraries
  { name: 'React.js', matchers: [/\breact(\.js)?\b/i] },
  { name: 'Next.js', matchers: [/\bnext(\.js)?\b/i, /\bnextjs\b/i] },
  { name: 'Vue.js', matchers: [/\bvue(\.js)?\b/i] },
  { name: 'Svelte', matchers: [/\bsvelte\b/i] },
  { name: 'Tailwind CSS', matchers: [/\btailwind(\s?css)?\b/i] },
  { name: 'Three.js', matchers: [/\bthree(\.js)?\b/i, /\bwebgl\b/i] },
  { name: 'Zustand', matchers: [/\bzustand\b/i] },
  { name: 'Redux', matchers: [/\bredux\b/i] },
  { name: 'MapLibre GL', matchers: [/\bmaplibre\b/i, /\bmapbox\b/i] },

  // Backend Frameworks & APIs
  { name: 'Express.js', matchers: [/\bexpress(\.js)?\b/i] },
  { name: 'NestJS', matchers: [/\bnestjs\b/i, /\bnest\.js\b/i] },
  { name: 'FastAPI', matchers: [/\bfastapi\b/i] },
  { name: 'Flask', matchers: [/\bflask\b/i] },
  { name: 'Django', matchers: [/\bdjango\b/i] },
  { name: 'Socket.io', matchers: [/\bsocket\.io\b/i, /\bwebsockets?\b/i] },
  { name: 'GraphQL', matchers: [/\bgraphql\b/i] },
  { name: 'REST API', matchers: [/\brest(ful)?\s?(api|apis)?\b/i] },

  // Databases & ORMs
  { name: 'PostgreSQL', matchers: [/\bpostgres(ql)?\b/i, /\bpg\b/i] },
  { name: 'MongoDB', matchers: [/\bmongodb\b/i, /\bmongoose\b/i, /\bmongo\b/i] },
  { name: 'Redis', matchers: [/\bredis\b/i] },
  { name: 'Prisma ORM', matchers: [/\bprisma\b/i] },
  { name: 'Firebase Firestore', matchers: [/\bfirestore\b/i, /\bfirebase\b/i] },
  { name: 'pgvector', matchers: [/\bpgvector\b/i, /\bvector database\b/i] },

  // Cloud, Infrastructure & DevOps
  { name: 'Docker', matchers: [/\bdocker\b/i, /\bcontainers?\b/i] },
  { name: 'Kubernetes', matchers: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { name: 'AWS', matchers: [/\baws\b/i, /\bamazon web services\b/i, /\bs3\b/i] },
  { name: 'GCP', matchers: [/\bgcp\b/i, /\bgoogle cloud\b/i] },
  { name: 'Vercel', matchers: [/\bvercel\b/i] },
  { name: 'Cloudinary', matchers: [/\bcloudinary\b/i] },
  { name: 'CI/CD', matchers: [/\bci\/?cd\b/i, /\bgithub actions\b/i] },

  // AI, Computer Vision, 3D & Spatial Computing
  { name: 'Open3D', matchers: [/\bopen3d\b/i] },
  { name: 'PyTorch', matchers: [/\bpytorch\b/i, /\btorch\b/i] },
  { name: 'TensorFlow', matchers: [/\btensorflow\b/i] },
  { name: 'OpenCV', matchers: [/\bopencv\b/i, /\bcv2\b/i] },
  { name: 'MediaPipe', matchers: [/\bmediapipe\b/i] },
  { name: 'NumPy', matchers: [/\bnumpy\b/i] },
  { name: 'SciPy', matchers: [/\bscipy\b/i] },
  { name: 'Pandas', matchers: [/\bpandas\b/i] },
  { name: 'Scikit-learn', matchers: [/\bscikit-learn\b/i, /\bsklearn\b/i] },
  { name: 'WebAssembly (Pyodide)', matchers: [/\bwebassembly\b/i, /\bwasm\b/i, /\bpyodide\b/i] },
  { name: 'Google Gemini API', matchers: [/\bgemini\b/i, /\bllm\b/i, /\bgenai\b/i, /\blarge language models?\b/i] },

  // Testing & Quality
  { name: 'Jest', matchers: [/\bjest\b/i] },
  { name: 'Vitest', matchers: [/\bvitest\b/i] },
  { name: 'Pytest', matchers: [/\bpytest\b/i] },
  { name: 'Playwright', matchers: [/\bplaywright\b/i] },
  { name: 'Cypress', matchers: [/\bcypress\b/i] },
  { name: 'Supertest', matchers: [/\bsupertest\b/i] },

  // Security & Authentication
  { name: 'JWT Auth', matchers: [/\bjwt\b/i, /\bjson web tokens?\b/i] },
  { name: 'Zod', matchers: [/\bzod\b/i] },
  { name: 'Joi', matchers: [/\bjoi\b/i] },
  { name: 'Razorpay API', matchers: [/\brazorpay\b/i, /\bpayments?\b/i, /\bstripe\b/i] }
];

// Canonical domain and architectural keywords
const KNOWN_DOMAINS = [
  { keyword: 'frontend', matchers: [/\bfrontend\b/i, /\bfront-end\b/i, /\bui\b/i, /\bclient-side\b/i] },
  { keyword: 'backend', matchers: [/\bbackend\b/i, /\bback-end\b/i, /\bserver-side\b/i, /\bapi\b/i] },
  { keyword: 'fullstack', matchers: [/\bfullstack\b/i, /\bfull-stack\b/i, /\bend-to-end\b/i] },
  { keyword: 'machine learning', matchers: [/\bmachine learning\b/i, /\bml\b/i, /\bai\b/i, /\bdeep learning\b/i] },
  { keyword: 'computer vision', matchers: [/\bcomputer vision\b/i, /\bimage processing\b/i, /\bobject detection\b/i] },
  { keyword: 'point cloud', matchers: [/\bpoint cloud\b/i, /\blidar\b/i, /\b3d vision\b/i, /\bspatial\b/i] },
  { keyword: '3d graphics', matchers: [/\b3d\b/i, /\bthree\.js\b/i, /\bwebgl\b/i, /\bcanvas\b/i, /\bshaders?\b/i] },
  { keyword: 'real-time', matchers: [/\breal-time\b/i, /\brealtime\b/i, /\bstreaming\b/i, /\bsockets?\b/i] },
  { keyword: 'microservices', matchers: [/\bmicroservices?\b/i, /\bdistributed systems?\b/i] },
  { keyword: 'embedded/hardware', matchers: [/\bbluetooth\b/i, /\bble\b/i, /\biot\b/i, /\bsensors?\b/i, /\bhardware\b/i] },
  { keyword: 'pwa', matchers: [/\bpwa\b/i, /\bprogressive web app\b/i, /\boffline\b/i] },
  { keyword: 'telemetry', matchers: [/\btelemetry\b/i, /\bmonitoring\b/i, /\bindustrial\b/i, /\baes\b/i] },
  { keyword: 'audio processing', matchers: [/\baudio\b/i, /\bfingerprinting\b/i, /\bdsp\b/i, /\bmusic\b/i] },
  { keyword: 'saas/billing', matchers: [/\bsaas\b/i, /\bbilling\b/i, /\bsubscriptions?\b/i, /\bmulti-tenant\b/i] }
];

/**
 * Extracts technical tokens and domain keywords from job description text.
 *
 * @param {string} jdText - Raw Job Description text
 * @returns {object} { isProvided, isInformative, techTokens, domainKeywords, reason }
 */
function parseJobDescription(jdText) {
  if (!jdText || typeof jdText !== 'string' || !jdText.trim()) {
    return {
      isProvided: false,
      isInformative: false,
      techTokens: [],
      domainKeywords: [],
      reason: 'Job description text was not provided or contains only whitespace.'
    };
  }

  const cleanText = jdText.trim();
  const foundTech = new Set();
  const foundDomains = new Set();

  // 1. Identify canonical technologies
  for (const item of KNOWN_TECHNOLOGIES) {
    for (const rx of item.matchers) {
      if (rx.test(cleanText)) {
        foundTech.add(item.name.toLowerCase());
        break;
      }
    }
  }

  // 2. Identify domain context keywords
  for (const item of KNOWN_DOMAINS) {
    for (const rx of item.matchers) {
      if (rx.test(cleanText)) {
        foundDomains.add(item.keyword.toLowerCase());
        break;
      }
    }
  }

  const techTokens = Array.from(foundTech);
  const domainKeywords = Array.from(foundDomains);

  // If JD is ordinary prose with 0 recognized technical tokens and 0 recognized domain keywords,
  // it cannot provide a meaningful relevance comparison.
  if (techTokens.length === 0 && domainKeywords.length === 0) {
    return {
      isProvided: true,
      isInformative: false,
      techTokens: [],
      domainKeywords: [],
      reason: 'The job description did not provide recognizable technical tokens or domain keywords for relevance matching.'
    };
  }

  return {
    isProvided: true,
    isInformative: true,
    techTokens,
    domainKeywords,
    reason: null
  };
}

/**
 * Extracts technical tokens and domain keywords from a project catalog entry.
 *
 * @param {object} project - Project catalog entry
 * @returns {object} { techTokens: string[], domainKeywords: string[] }
 */
function extractProjectTokens(project) {
  const techSet = new Set();
  const domainSet = new Set();

  // 1. Add primary technologies
  if (Array.isArray(project.primary_technologies)) {
    for (const tech of project.primary_technologies) {
      techSet.add(tech.toLowerCase());
    }
  }

  // 2. Add technologies from resume_entry tech_stack_summary if present
  if (project.resume_entry?.tech_stack_summary) {
    const parts = project.resume_entry.tech_stack_summary.split(/[,·|•]/);
    for (const p of parts) {
      const clean = p.trim().toLowerCase();
      if (clean) techSet.add(clean);
    }
  }

  // 3. Infer domain keywords from purpose, architecture, and title text
  const combinedText = [
    project.name || '',
    project.title || '',
    project.purpose || '',
    project.architecture || '',
    project.technical_analysis || '',
    project.key_implementation_details || ''
  ].join(' ');

  for (const item of KNOWN_DOMAINS) {
    for (const rx of item.matchers) {
      if (rx.test(combinedText)) {
        domainSet.add(item.keyword.toLowerCase());
        break;
      }
    }
  }

  // Also check if technologies themselves imply domain keywords
  for (const tech of techSet) {
    if (['react.js', 'next.js', 'vue.js', 'svelte', 'tailwind css'].includes(tech)) domainSet.add('frontend');
    if (['express.js', 'nestjs', 'fastapi', 'flask', 'django'].includes(tech)) domainSet.add('backend');
    if (['open3d', 'pytorch', 'tensorflow', 'opencv', 'mediapipe'].includes(tech)) domainSet.add('computer vision');
    if (['three.js', 'webgl', 'pyvista'].includes(tech)) domainSet.add('3d graphics');
    if (['socket.io'].includes(tech)) domainSet.add('real-time');
  }

  return {
    techTokens: Array.from(techSet),
    domainKeywords: Array.from(domainSet)
  };
}

/**
 * Computes Sørensen-Dice technical overlap score: 2 * |A ∩ B| / (|A| + |B|).
 *
 * Guaranteed bounded in [0, 1]. Returns 0 if both sets are empty.
 *
 * @param {string[]} projTech - Project technologies
 * @param {string[]} jdTech - JD technologies
 * @returns {number} Score in [0, 1]
 */
function computeTechnicalOverlap(projTech, jdTech) {
  if (!projTech || !jdTech || (projTech.length === 0 && jdTech.length === 0)) {
    return 0;
  }
  const total = projTech.length + jdTech.length;
  if (total <= 0) return 0;

  const jdSet = new Set(jdTech.map(t => t.toLowerCase()));
  let intersectionCount = 0;

  for (const tech of projTech) {
    const lower = tech.toLowerCase();
    if (jdSet.has(lower)) {
      intersectionCount++;
    } else {
      // Check partial match (e.g. 'react' matches 'react.js')
      for (const jt of jdSet) {
        if (jt.startsWith(lower) || lower.startsWith(jt)) {
          intersectionCount += 0.85;
          break;
        }
      }
    }
  }

  const score = (2 * intersectionCount) / total;
  return Number.isFinite(score) ? Math.min(1.0, Math.max(0, score)) : 0;
}

/**
 * Computes Jaccard domain context overlap score: |A ∩ B| / |A ∪ B|.
 *
 * Guaranteed bounded in [0, 1]. Returns 0 if both sets are empty.
 *
 * @param {string[]} projKw - Project domain keywords
 * @param {string[]} jdKw - JD domain keywords
 * @returns {number} Score in [0, 1]
 */
function computeContextOverlap(projKw, jdKw) {
  if (!projKw || !jdKw || (projKw.length === 0 && jdKw.length === 0)) {
    return 0;
  }

  const pSet = new Set(projKw.map(k => k.toLowerCase()));
  const jSet = new Set(jdKw.map(k => k.toLowerCase()));

  const union = new Set([...pSet, ...jSet]);
  if (union.size === 0) return 0;

  let intersectionCount = 0;
  for (const item of pSet) {
    if (jSet.has(item)) intersectionCount++;
  }

  const score = intersectionCount / union.size;
  return Number.isFinite(score) ? Math.min(1.0, Math.max(0, score)) : 0;
}

/**
 * Calculates the JD relevance score for a project.
 *
 * Correctly distinguishes informative JDs from uninformative or empty JDs.
 *
 * @param {object} project - Project catalog entry
 * @param {object} parsedJd - Output from parseJobDescription
 * @param {object} [config] - Matching configuration
 * @returns {object} { isAvailable, relevanceScore, techScore, contextScore, matchingTech, matchingDomains, reason }
 */
function calculateJdRelevance(project, parsedJd, config = {}) {
  const techWeight = config.tech_weight || 0.70;
  const contextWeight = config.context_weight || 0.30;

  // Fallback: If JD is not informative, relevance scoring is unavailable
  if (!parsedJd || !parsedJd.isInformative) {
    return {
      isAvailable: false,
      relevanceScore: 0,
      techScore: 0,
      contextScore: 0,
      matchingTech: [],
      matchingDomains: [],
      reason: parsedJd?.reason || 'Job description was empty or uninformative.'
    };
  }

  const projectTokens = extractProjectTokens(project);
  const techScore = computeTechnicalOverlap(projectTokens.techTokens, parsedJd.techTokens);
  const contextScore = computeContextOverlap(projectTokens.domainKeywords, parsedJd.domainKeywords);

  // Determine matching items for explainability
  const jdTechSet = new Set(parsedJd.techTokens.map(t => t.toLowerCase()));
  const matchingTech = projectTokens.techTokens.filter(t => jdTechSet.has(t.toLowerCase()));

  const jdDomainSet = new Set(parsedJd.domainKeywords.map(k => k.toLowerCase()));
  const matchingDomains = projectTokens.domainKeywords.filter(k => jdDomainSet.has(k.toLowerCase()));

  let compositeRelevance = 0;

  if (parsedJd.techTokens.length > 0 && parsedJd.domainKeywords.length > 0) {
    // Both technical and domain keywords present
    compositeRelevance = (techWeight * techScore + contextWeight * contextScore) * 100;
  } else if (parsedJd.techTokens.length > 0) {
    // Technical-only JD
    compositeRelevance = techScore * 100;
  } else if (parsedJd.domainKeywords.length > 0) {
    // Domain-only JD
    compositeRelevance = contextScore * 100;
  }

  const boundedScore = Number.isFinite(compositeRelevance)
    ? Math.max(0, Math.min(100, Math.round(compositeRelevance * 100) / 100))
    : 0;

  return {
    isAvailable: true,
    relevanceScore: boundedScore,
    techScore: Math.round(techScore * 1000) / 10,
    contextScore: Math.round(contextScore * 1000) / 10,
    matchingTech,
    matchingDomains,
    reason: null
  };
}

/**
 * Calculates the final blended score between Quality and Relevance.
 *
 * If JD relevance is unavailable (e.g. empty or uninformative JD), α is automatically 0,
 * preserving quality score without reduction.
 *
 * @param {number} qualityScore - Normalized quality score [0, 100]
 * @param {object} relevanceResult - Output from calculateJdRelevance
 * @param {number} [configuredAlpha=0.35] - Relevance blend weight α ∈ [0, 1]
 * @returns {object} { finalScore, effectiveAlpha, qualityScore, relevanceScore, fallbackApplied }
 */
function calculateFinalScore(qualityScore, relevanceResult, configuredAlpha = 0.35) {
  const qScore = Number.isFinite(qualityScore) ? Math.max(0, Math.min(100, qualityScore)) : 0;

  if (!relevanceResult || !relevanceResult.isAvailable) {
    // Uninformative or absent JD: α is strictly 0. Never penalize project.
    return {
      finalScore: qScore,
      effectiveAlpha: 0,
      qualityScore: qScore,
      relevanceScore: 0,
      fallbackApplied: true,
      reason: relevanceResult?.reason || 'JD unavailable for relevance matching'
    };
  }

  const alpha = Math.max(0, Math.min(1.0, configuredAlpha));
  const rScore = Number.isFinite(relevanceResult.relevanceScore)
    ? Math.max(0, Math.min(100, relevanceResult.relevanceScore))
    : 0;

  const rawFinal = (1.0 - alpha) * qScore + alpha * rScore;
  const finalScore = Number.isFinite(rawFinal) ? Math.max(0, Math.min(100, Math.round(rawFinal * 100) / 100)) : 0;

  return {
    finalScore,
    effectiveAlpha: alpha,
    qualityScore: qScore,
    relevanceScore: rScore,
    fallbackApplied: false,
    reason: null
  };
}

module.exports = {
  KNOWN_TECHNOLOGIES,
  KNOWN_DOMAINS,
  parseJobDescription,
  extractProjectTokens,
  computeTechnicalOverlap,
  computeContextOverlap,
  calculateJdRelevance,
  calculateFinalScore
};
