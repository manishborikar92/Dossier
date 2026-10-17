const fs = require('fs');
const path = require('path');

// Default 7-factor dimension definitions and maximum raw points (must sum to 100)
const DIMENSIONS = {
  depth: {
    key: 'depth',
    name: 'Technical Depth',
    max_raw_points: 25,
    description: 'Algorithmic complexity, spatial math, WASM execution, binary protocols, concurrency.'
  },
  impact: {
    key: 'impact',
    name: 'Real-World Impact & Deployment',
    max_raw_points: 20,
    description: 'Verified production URL, active payment/telemetry gateways, real user transaction models.'
  },
  quality: {
    key: 'quality',
    name: 'Engineering Quality & Testing',
    max_raw_points: 15,
    description: 'Automated test suites (Pytest, Jest, Playwright), ORM/migrations, Dockerization, error handling.'
  },
  breadth: {
    key: 'breadth',
    name: 'Breadth of Skills',
    max_raw_points: 15,
    description: 'Full-stack integration spanning Frontend, Backend, Database, Cloud/CDN, and Security/Auth.'
  },
  uniqueness: {
    key: 'uniqueness',
    name: 'Architectural Uniqueness',
    max_raw_points: 10,
    description: 'Distinctive domains: 3D LiDAR, in-browser WASM IDE, vector search, companion robotics.'
  },
  readiness: {
    key: 'readiness',
    name: 'Production Readiness',
    max_raw_points: 10,
    description: 'Authentication/RBAC, rate limiting, request validation, environment isolation, logging.'
  },
  storytelling: {
    key: 'storytelling',
    name: 'Storytelling Potential',
    max_raw_points: 5,
    description: 'Clarity of problem-solution arc, measurable business/user value, interview demo appeal.'
  }
};

// Built-in role presets applying criterion weights (never hardcoded project multipliers)
const DEFAULT_ROLE_PRESETS = {
  general: {
    key: 'general',
    label: 'General-Purpose Software Developer',
    description: 'Balanced general-purpose engineering evaluation across all 7 dimensions equally.',
    weights: {
      depth: 1.00,
      impact: 1.00,
      quality: 1.00,
      breadth: 1.00,
      uniqueness: 1.00,
      readiness: 1.00,
      storytelling: 1.00
    }
  },
  fullstack: {
    key: 'fullstack',
    label: 'Full-Stack Developer',
    description: 'Prioritizes multi-tier integration breadth, deployment impact, testing, and production readiness.',
    weights: {
      depth: 0.85,
      impact: 1.30,
      quality: 1.25,
      breadth: 1.40,
      uniqueness: 0.80,
      readiness: 1.20,
      storytelling: 1.00
    }
  },
  backend: {
    key: 'backend',
    label: 'Backend / Systems Engineer',
    description: 'Emphasizes data modeling, testing quality, production readiness, and algorithmic depth.',
    weights: {
      depth: 1.30,
      impact: 1.15,
      quality: 1.35,
      breadth: 0.85,
      uniqueness: 0.85,
      readiness: 1.30,
      storytelling: 1.00
    }
  },
  ai_ml_data: {
    key: 'ai_ml_data',
    label: 'AI / Machine Learning / Data Engineer',
    description: 'Accentuates algorithmic depth, spatial/matrix math, domain uniqueness, and data pipelines.',
    weights: {
      depth: 1.50,
      impact: 0.70,
      quality: 1.15,
      breadth: 0.60,
      uniqueness: 1.40,
      readiness: 0.75,
      storytelling: 1.00
    }
  },
  systems_3d: {
    key: 'systems_3d',
    label: 'Systems / 3D Graphics / Computer Vision Developer',
    description: 'Focuses heavily on spatial algorithms, graphics/computational depth, and architectural novelty.',
    weights: {
      depth: 1.55,
      impact: 0.65,
      quality: 1.15,
      breadth: 0.55,
      uniqueness: 1.45,
      readiness: 0.75,
      storytelling: 1.00
    }
  }
};

/**
 * Loads role configuration from config/ranking-weights.json with fallback to defaults.
 *
 * @param {string} [configPath] - Optional custom path to ranking-weights.json
 * @returns {object} { dimensions, rolePresets, jdMatching }
 */
function loadRoleProfiles(configPath = null) {
  const filePath = configPath || path.resolve(__dirname, '../../config/ranking-weights.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        dimensions: data.dimensions || DIMENSIONS,
        rolePresets: data.role_presets || DEFAULT_ROLE_PRESETS,
        jdMatching: data.jd_matching || { default_alpha: 0.35, tech_weight: 0.70, context_weight: 0.30 }
      };
    } catch {}
  }
  return {
    dimensions: DIMENSIONS,
    rolePresets: DEFAULT_ROLE_PRESETS,
    jdMatching: { default_alpha: 0.35, tech_weight: 0.70, context_weight: 0.30 }
  };
}

/**
 * Calculates the maximum achievable weighted score for a given set of weights.
 *
 * MaxWeighted = sum(w_i * Max_i)
 *
 * @param {object} weights - Criterion weight mapping { depth, impact, ... }
 * @param {object} [dimensions] - Dimension definitions with max_raw_points
 * @returns {number} Maximum achievable weighted sum
 */
function calculateMaxWeightedScore(weights, dimensions = DIMENSIONS) {
  let total = 0;
  for (const [key, dim] of Object.entries(dimensions)) {
    const w = typeof weights[key] === 'number' ? weights[key] : 1.0;
    const maxPts = dim.max_raw_points || 0;
    total += w * maxPts;
  }
  return total;
}

/**
 * Computes the normalized weighted quality score strictly bounded between 0 and 100.
 *
 * S_quality(P, role) = (sum(w_i * r_i) / sum(w_i * Max_i)) * 100
 *
 * @param {object} rawScores - Raw dimension points { depth, impact, quality, breadth, uniqueness, readiness, storytelling }
 * @param {object} weights - Criterion weight multipliers
 * @param {object} [dimensions] - Dimension definitions
 * @returns {number} Normalized quality score strictly bounded in [0, 100]
 */
function normalizeQualityScore(rawScores, weights, dimensions = DIMENSIONS) {
  const maxWeighted = calculateMaxWeightedScore(weights, dimensions);
  if (!Number.isFinite(maxWeighted) || maxWeighted <= 0) {
    return 0;
  }

  let achievedWeighted = 0;
  for (const [key, dim] of Object.entries(dimensions)) {
    const w = typeof weights[key] === 'number' ? weights[key] : 1.0;
    const raw = typeof rawScores[key] === 'number' ? rawScores[key] : 0;
    // Cap raw score at max_raw_points to prevent overflow
    const boundedRaw = Math.max(0, Math.min(dim.max_raw_points, raw));
    achievedWeighted += w * boundedRaw;
  }

  const score = (achievedWeighted / maxWeighted) * 100;
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

module.exports = {
  DIMENSIONS,
  DEFAULT_ROLE_PRESETS,
  loadRoleProfiles,
  calculateMaxWeightedScore,
  normalizeQualityScore
};
