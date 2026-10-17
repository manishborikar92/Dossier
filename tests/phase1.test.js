const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

describe('Phase 1 Scaffolding & Configuration Verification', () => {

  test('Project directories exist', () => {
    const requiredDirs = ['config', 'src', 'templates', 'data', 'output'];
    for (const dir of requiredDirs) {
      const fullPath = path.join(ROOT, dir);
      assert.ok(fs.existsSync(fullPath), `Directory missing: ${dir}`);
      assert.ok(fs.statSync(fullPath).isDirectory(), `Not a directory: ${dir}`);
    }
  });

  test('package.json is valid and contains required dependencies', () => {
    const pkgPath = path.join(ROOT, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'package.json missing');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.name, 'resume-builder');
    assert.ok(pkg.dependencies['@clack/prompts'], '@clack/prompts missing');
    assert.ok(pkg.dependencies['docx'], 'docx missing');
    assert.ok(pkg.dependencies['picocolors'], 'picocolors missing');
  });

  test('JSON configuration files parse without error', () => {
    const jsonFiles = [
      'config/profile.example.json',
      'config/profile.json',
      'config/ranking-weights.json',
      'config/settings.json'
    ];

    for (const relPath of jsonFiles) {
      const fullPath = path.join(ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `Config file missing: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(content), `Invalid JSON in ${relPath}`);
    }
  });

  test('Profile configuration contains verified data', () => {
    const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/profile.json'), 'utf8'));
    assert.equal(profile.personal.name, 'MANISH BORIKAR');
    assert.ok(profile.personal.email.includes('manishborikar92'));
    assert.ok(Array.isArray(profile.experience));
    assert.ok(profile.experience.length >= 3);
    assert.ok(Array.isArray(profile.education));
    assert.ok(profile.education.length >= 2);
    assert.ok(Array.isArray(profile.certifications));
    assert.equal(profile.certifications.length, 7);
  });

  test('Ranking weights configuration defines all 7 dimensions and role presets', () => {
    const weightsConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/ranking-weights.json'), 'utf8'));
    const expectedDims = ['depth', 'impact', 'quality', 'breadth', 'uniqueness', 'readiness', 'storytelling'];
    
    for (const dim of expectedDims) {
      assert.ok(weightsConfig.dimensions[dim], `Missing dimension: ${dim}`);
    }

    const totalRawPoints = Object.values(weightsConfig.dimensions)
      .reduce((sum, d) => sum + d.max_raw_points, 0);
    assert.equal(totalRawPoints, 100, 'Sum of max raw points across 7 dimensions must equal 100');

    const expectedRoles = ['general', 'fullstack', 'backend', 'ai_ml_data', 'systems_3d'];
    for (const role of expectedRoles) {
      assert.ok(weightsConfig.role_presets[role], `Missing role preset: ${role}`);
      for (const dim of expectedDims) {
        assert.ok(
          typeof weightsConfig.role_presets[role].weights[dim] === 'number',
          `Missing weight ${dim} in role ${role}`
        );
      }
    }
  });

  test('Settings configuration defines scanning and unit conventions', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/settings.json'), 'utf8'));
    assert.ok(settings.scanner.projects_root);
    assert.ok(settings.scanner.ignore_directories.includes('.git'));
    assert.ok(settings.scanner.ignore_directories.includes('node_modules'));
    assert.ok(settings.export.edge_path);
    assert.equal(settings.export.units.twips_per_inch, 1440);
    assert.equal(settings.export.units.twips_per_point, 20);
    assert.equal(settings.export.units.half_points_per_point, 2);
  });

  test('.gitignore protects private profiles, caches, and deliverables', () => {
    const gitignorePath = path.join(ROOT, '.gitignore');
    assert.ok(fs.existsSync(gitignorePath), '.gitignore missing');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(gitignoreContent.includes('config/profile.json'));
    assert.ok(gitignoreContent.includes('output/*.docx'));
    assert.ok(gitignoreContent.includes('output/*.pdf'));
    assert.ok(gitignoreContent.includes('data/catalog.json'));
    assert.ok(gitignoreContent.includes('node_modules/'));
  });

  test('docx-styles module loads and builds document nodes successfully', () => {
    const styles = require('../templates/docx-styles.js');
    assert.ok(styles.COLORS.ACCENT);
    assert.equal(styles.SIZES.NAME, 36); // 18pt in half-points

    const hr = styles.hrParagraph();
    assert.ok(hr);

    const header = styles.sectionHeader('Experience');
    assert.ok(header);

    const b = styles.bullet('Test bullet', 'Bold prefix');
    assert.ok(b);

    const twoCol = styles.twoColLine('Left', 'Right');
    assert.ok(twoCol);

    const job = styles.jobTitle('Company', 'Title', '2025 – Present');
    assert.ok(job);

    const proj = styles.projectHeader('Project Name', '2026', 'https://example.com');
    assert.ok(proj);

    const sub = styles.projectSubline('React, Node.js');
    assert.ok(sub);
  });

});
