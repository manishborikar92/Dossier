const fs = require('fs');
const path = require('path');

// Common technology mappings from package/dependency names to display names
const TECH_MAP = {
  // JavaScript / TypeScript ecosystem
  'react': 'React.js',
  'next': 'Next.js',
  'vue': 'Vue.js',
  'svelte': 'Svelte',
  'express': 'Express.js',
  '@nestjs/core': 'NestJS',
  'fastify': 'Fastify',
  'typescript': 'TypeScript',
  'tailwindcss': 'Tailwind CSS',
  '@tailwindcss/postcss': 'Tailwind CSS v4',
  'three': 'Three.js',
  '@prisma/client': 'Prisma ORM',
  'prisma': 'Prisma ORM',
  'drizzle-orm': 'Drizzle ORM',
  'mongoose': 'MongoDB/Mongoose',
  'pg': 'PostgreSQL',
  'ioredis': 'Redis',
  'redis': 'Redis',
  'socket.io': 'Socket.io',
  'firebase': 'Firebase',
  'firebase-admin': 'Firebase Admin SDK',
  'cloudinary': 'Cloudinary',
  'razorpay': 'Razorpay API',
  'resend': 'Resend API',
  'jsonwebtoken': 'JWT Auth',
  'zod': 'Zod',
  'joi': 'Joi',
  'pydub': 'Pydub',
  'remotion': 'Remotion',
  '@google/genai': 'Google Gemini API',
  '@google/generative-ai': 'Google Gemini API',
  'zustand': 'Zustand',
  '@codemirror/state': 'CodeMirror',
  'pyodide': 'WebAssembly (Pyodide)',
  'maplibre-gl': 'MapLibre GL',

  // Testing
  'jest': 'Jest',
  'vitest': 'Vitest',
  'playwright': 'Playwright',
  '@playwright/test': 'Playwright',
  'cypress': 'Cypress',
  'supertest': 'Supertest',

  // Python ecosystem (canonical lowercased)
  'flask': 'Flask',
  'fastapi': 'FastAPI',
  'django': 'Django',
  'tensorflow': 'TensorFlow',
  'torch': 'PyTorch',
  'pytorch': 'PyTorch',
  'open3d': 'Open3D',
  'pyvista': 'PyVista',
  'pyqt6': 'PyQt6',
  'pyqt5': 'PyQt5',
  'mediapipe': 'MediaPipe',
  'opencv-python': 'OpenCV',
  'cv2': 'OpenCV',
  'scikit-learn': 'Scikit-learn',
  'sklearn': 'Scikit-learn',
  'numpy': 'NumPy',
  'scipy': 'SciPy',
  'pandas': 'Pandas',
  'weasyprint': 'WeasyPrint',
  'reportlab': 'ReportLab',
  'bleak': 'Bleak (Bluetooth)',
  'pygame': 'Pygame',
  'pyautogui': 'PyAutoGUI',
  'pytest': 'Pytest',
  'yt-dlp': 'yt-dlp',
  'python-telegram-bot': 'python-telegram-bot',
  'acrcloud': 'ACRCloud API',
  'sentence-transformers': 'sentence-transformers',
  'pgvector': 'pgvector'
};

/**
 * Safely parses package.json if present.
 */
function parsePackageJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const deps = { ...(data.dependencies || {}), ...(data.devDependencies || {}) };
    return {
      name: data.name || null,
      description: data.description || null,
      version: data.version || null,
      workspaces: data.workspaces || null,
      dependencies: Object.keys(deps),
      scripts: data.scripts || {}
    };
  } catch {
    return null;
  }
}

/**
 * Safely parses requirements.txt or pip requirements.
 */
function parseRequirementsTxt(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');
    const packages = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      // Extract package name before ==, >=, <=, ~=, <, >
      const match = line.match(/^([a-zA-Z0-9_\-\.]+)/);
      if (match) {
        packages.push(match[1].toLowerCase());
      }
    }
    return packages;
  } catch {
    return [];
  }
}

/**
 * Parses all manifests in a project directory.
 *
 * @param {string} dirPath - Project directory
 * @returns {object} Manifest analysis results
 */
function parseProjectManifests(dirPath) {
  const technologies = new Set();
  const evidenceFiles = [];
  const testFrameworks = new Set();
  let description = null;

  // 1. Root package.json
  const rootPkgPath = path.join(dirPath, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    evidenceFiles.push('package.json');
    const pkg = parsePackageJson(rootPkgPath);
    if (pkg) {
      if (pkg.description) description = pkg.description;
      for (const dep of pkg.dependencies) {
        const canonical = TECH_MAP[dep.toLowerCase()];
        if (canonical) {
          technologies.add(canonical);
          if (['Jest', 'Vitest', 'Playwright', 'Cypress', 'Supertest'].includes(canonical)) {
            testFrameworks.add(canonical);
          }
        }
      }
    }
  }

  // 2. Nested package.json files (e.g. in web/, server/, apps/*)
  const nestedDirs = ['web', 'server', 'client', 'admin', 'apps/api', 'apps/trainer-web', 'apps/gym-web'];
  for (const rel of nestedDirs) {
    const nestedPkg = path.join(dirPath, rel, 'package.json');
    if (fs.existsSync(nestedPkg)) {
      evidenceFiles.push(`${rel}/package.json`);
      const pkg = parsePackageJson(nestedPkg);
      if (pkg) {
        for (const dep of pkg.dependencies) {
          const canonical = TECH_MAP[dep.toLowerCase()];
          if (canonical) {
            technologies.add(canonical);
            if (['Jest', 'Vitest', 'Playwright', 'Cypress', 'Supertest'].includes(canonical)) {
              testFrameworks.add(canonical);
            }
          }
        }
      }
    }
  }

  // 3. Python manifests (root and core)
  const pyFiles = ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py'];
  for (const pyFile of pyFiles) {
    const fullPath = path.join(dirPath, pyFile);
    if (fs.existsSync(fullPath)) {
      evidenceFiles.push(pyFile);
      const pkgs = parseRequirementsTxt(fullPath);
      for (const pkg of pkgs) {
        const canonical = TECH_MAP[pkg];
        if (canonical) {
          technologies.add(canonical);
          if (canonical === 'Pytest') testFrameworks.add('Pytest');
        }
      }
    }
  }

  // Check nested python requirements (e.g. iwlars-core/requirements.txt or python_service/)
  const nestedPyDirs = ['iwlars-core', 'python_service', 'simulation', 'model', 'server'];
  for (const rel of nestedPyDirs) {
    const nestedReq = path.join(dirPath, rel, 'requirements.txt');
    if (fs.existsSync(nestedReq)) {
      evidenceFiles.push(`${rel}/requirements.txt`);
      const pkgs = parseRequirementsTxt(nestedReq);
      for (const pkg of pkgs) {
        const canonical = TECH_MAP[pkg];
        if (canonical) {
          technologies.add(canonical);
          if (canonical === 'Pytest') testFrameworks.add('Pytest');
        }
      }
    }
  }

  // 4. Prisma Schema
  const prismaPath = path.join(dirPath, 'server', 'prisma', 'schema.prisma');
  const rootPrismaPath = path.join(dirPath, 'prisma', 'schema.prisma');
  if (fs.existsSync(prismaPath) || fs.existsSync(rootPrismaPath)) {
    technologies.add('Prisma ORM');
    technologies.add('PostgreSQL');
    evidenceFiles.push(fs.existsSync(prismaPath) ? 'server/prisma/schema.prisma' : 'prisma/schema.prisma');
  }

  // 5. Dockerfile & docker-compose
  if (fs.existsSync(path.join(dirPath, 'Dockerfile'))) {
    technologies.add('Docker');
    evidenceFiles.push('Dockerfile');
  }
  if (fs.existsSync(path.join(dirPath, 'docker-compose.yml')) || fs.existsSync(path.join(dirPath, 'docker-compose.yaml'))) {
    technologies.add('Docker Compose');
    evidenceFiles.push('docker-compose.yml');
  }

  // 6. Test directories
  let hasTests = testFrameworks.size > 0;
  const testDirNames = ['tests', '__tests__', 'test'];
  for (const tDir of testDirNames) {
    if (fs.existsSync(path.join(dirPath, tDir))) {
      hasTests = true;
      evidenceFiles.push(`${tDir}/`);
      break;
    }
  }

  return {
    description,
    technologies: Array.from(technologies).sort(),
    evidenceFiles: Array.from(new Set(evidenceFiles)),
    testFrameworks: Array.from(testFrameworks),
    hasTests,
    hasDocker: technologies.has('Docker') || technologies.has('Docker Compose')
  };
}

module.exports = {
  TECH_MAP,
  parsePackageJson,
  parseRequirementsTxt,
  parseProjectManifests
};
