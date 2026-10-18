const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const JSZip = require('jszip');

const { createSession, loadProfile, normalizeCertification } = require('../src/cli/session-state');
const { generateResumeHtml, escapeHtml, sanitizeUrl } = require('../src/export/html-template');
const { generateResumeDocx } = require('../src/export/docx-generator');
const { generateResumePdf, resolveEdgePath } = require('../src/export/pdf-generator');
const { validatePdfResume, validateDocxResume, validateDeliverables, extractPdfUris } = require('../src/export/validator');
const { runWizard } = require('../src/cli/wizard');

// Synthetic catalog for deterministic export tests
const testCatalog = [
  {
    id: 'court-booking',
    name: 'Pickleball Arena SaaS',
    title: 'Court Booking & Venue SaaS',
    purpose: 'End-to-end court reservation SaaS with PhonePe integration and Prisma.',
    resume_eligibility: true,
    primary_technologies: ['Next.js', 'Express.js', 'PostgreSQL', 'Prisma ORM', 'PhonePe', 'TypeScript'],
    live_url: 'https://venue.example.com',
    is_monorepo: true,
    commit_count: 120,
    last_commit: '2026-09-01',
    resume_entry: {
      resume_title: 'Pickleball SaaS Platform',
      bullets: [
        'Architected court reservation SaaS with Prisma ORM and PostgreSQL.',
        'Integrated PhonePe payment gateway with SHA-256 HMAC webhook verification.'
      ]
    }
  },
  {
    id: 'lidar-core',
    name: '3D LiDAR Core',
    title: '3D LiDAR Point Cloud Processing Core',
    purpose: 'Automated 3D point cloud analysis and RANSAC ground filtering.',
    resume_eligibility: true,
    primary_technologies: ['Open3D', 'PyVista', 'NumPy', 'Python', 'Inno Setup'],
    live_url: null,
    is_monorepo: false,
    commit_count: 85,
    last_commit: '2026-08-15',
    resume_entry: {
      resume_title: '3D LiDAR Processing System',
      bullets: [
        'Engineered point cloud filtering pipeline using Open3D and RANSAC algorithms.',
        'Packaged desktop application with Inno Setup installer for client deployment.'
      ]
    }
  },
  {
    id: 'ai-vector-search',
    name: 'Vector Search Engine',
    title: 'AI Semantic Vector Search Platform',
    purpose: 'Embeddings search using FastAPI, sentence-transformers, and PostgreSQL pgvector.',
    resume_eligibility: true,
    primary_technologies: ['FastAPI', 'PostgreSQL', 'pgvector', 'sentence-transformers', 'Docker'],
    live_url: 'https://search.example.com',
    is_monorepo: false,
    commit_count: 95,
    last_commit: '2026-07-20',
    resume_entry: {
      resume_title: 'AI Semantic Vector Search Platform',
      bullets: [
        'Implemented pgvector HNSW cosine similarity search over 384-dimensional embeddings.',
        'Containerized microservices architecture with Docker Compose and automated health checks.'
      ]
    }
  },
  {
    id: 'enterprise-workflow',
    name: 'Enterprise CA Platform',
    title: 'Chartered Accountant Workflow Platform',
    purpose: 'Enterprise workflow management with Razorpay billing and Cloudinary CDN.',
    resume_eligibility: true,
    primary_technologies: ['Node.js', 'Express.js', 'MongoDB', 'Razorpay', 'Cloudinary CDN'],
    live_url: 'https://workflow.example.com',
    is_monorepo: false,
    commit_count: 140,
    last_commit: '2026-06-10',
    resume_entry: {
      resume_title: 'CA-Workflow Enterprise Platform',
      bullets: [
        'Architected multi-tenant compliance platform processing client audit records.',
        'Integrated Razorpay subscription billing handling automated invoice generation.'
      ]
    }
  }
];

// Helper to create mock prompter for testing
function createMockPrompter(responses = {}) {
  const history = [];
  return {
    history,
    intro: (msg) => history.push({ type: 'intro', msg }),
    outro: (msg) => history.push({ type: 'outro', msg }),
    log: {
      info: (msg) => history.push({ type: 'log:info', msg }),
      warn: (msg) => history.push({ type: 'log:warn', msg }),
      error: (msg) => history.push({ type: 'log:error', msg }),
      success: (msg) => history.push({ type: 'log:success', msg }),
      step: (msg) => history.push({ type: 'log:step', msg })
    },
    isCancel: (val) => val === Symbol.for('cancel'),
    cancel: (msg) => history.push({ type: 'cancel', msg }),
    select: async ({ message, options }) => {
      history.push({ type: 'select', message, optionsCount: options.length });
      if (responses.selectQueue && responses.selectQueue.length > 0) {
        return responses.selectQueue.shift();
      }
      return options[0].value;
    },
    multiselect: async ({ message, options, initialValues }) => {
      history.push({ type: 'multiselect', message, optionsCount: options.length });
      if (responses.multiselectQueue && responses.multiselectQueue.length > 0) {
        return responses.multiselectQueue.shift();
      }
      return initialValues || [options[0].value];
    },
    confirm: async ({ message, initialValue }) => {
      history.push({ type: 'confirm', message });
      if (responses.confirmQueue && responses.confirmQueue.length > 0) {
        return responses.confirmQueue.shift();
      }
      return initialValue !== undefined ? initialValue : true;
    },
    text: async ({ message, initialValue }) => {
      history.push({ type: 'text', message });
      if (responses.textQueue && responses.textQueue.length > 0) {
        return responses.textQueue.shift();
      }
      return initialValue || 'Mock Input Text';
    }
  };
}

describe('Phase 5 Document Exporters and Output Validation Test Suite', () => {
  const testOutputDir = path.resolve(__dirname, '../output/test_phase5');

  before(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up temporary test files
    if (fs.existsSync(testOutputDir)) {
      try {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      } catch {
        // Silently ignore cleanup errors
      }
    }
  });

  // Case 1: DOCX generation from 1-page compact model
  test('Case 1: DOCX generator produces valid OpenXML Word document for 1-page compact model', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking', 'ai-vector-search']);
    const model = session.getFinalResumeModel();

    const targetDocx = path.join(testOutputDir, 'test_1page.docx');
    const result = await generateResumeDocx(model, { outputPath: targetDocx });

    assert.equal(result.format, 'docx');
    assert.equal(fs.existsSync(result.filePath), true);
    assert.ok(result.fileSize > 5000, 'DOCX file size should be substantial');

    const valResult = await validateDocxResume(result.filePath, model);
    assert.equal(valResult.valid, true);
    assert.equal(valResult.errors.length, 0);
  });

  // Case 2: DOCX generation from 2-page extended model with right-aligned tabs and hyperlinks
  test('Case 2: DOCX generator produces valid document for 2-page extended model preserving links and tab stops', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('backend');
    session.setResumeLength('2page');
    session.selectProjects(['court-booking', 'lidar-core', 'ai-vector-search', 'enterprise-workflow']);
    const model = session.getFinalResumeModel();

    const targetDocx = path.join(testOutputDir, 'test_2page.docx');
    const result = await generateResumeDocx(model, { outputPath: targetDocx });

    assert.equal(fs.existsSync(result.filePath), true);

    const docxBuf = fs.readFileSync(result.filePath);
    const bufStr = docxBuf.toString('latin1');

    // Verify OpenXML package structure
    assert.ok(bufStr.includes('word/document.xml'));
    assert.ok(bufStr.includes('word/_rels/document.xml.rels'));

    const valResult = await validateDocxResume(result.filePath, model);
    assert.equal(valResult.valid, true);
  });

  // Case 3: HTML template rendering with proper entity escaping and safe links
  test('Case 3: HTML template sanitizes user inputs, escapes entities, and formats links safely', () => {
    const rawXss = '<script>alert("xss")</script> & "quotes"';
    const escaped = escapeHtml(rawXss);
    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));

    assert.equal(sanitizeUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeUrl('https://example.com/safe'), 'https://example.com/safe');
    assert.equal(sanitizeUrl('mailto:test@example.com'), 'mailto:test@example.com');
    assert.equal(sanitizeUrl('linkedin.com/in/test'), 'https://linkedin.com/in/test');

    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.selectProjects(['court-booking']);
    const model = session.getFinalResumeModel();

    const html = generateResumeHtml(model);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('@page'));
    assert.ok(html.includes('MANISH BORIKAR'));
    assert.ok(html.includes('Pickleball SaaS Platform'));
    assert.ok(html.includes('https://venue.example.com'));
  });

  // Case 4: Headless Microsoft Edge PDF generation for 1-page compact (actual 1 page verified)
  test('Case 4: Headless Microsoft Edge generates PDF that renders to strictly 1 page for 1-page compact budget', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking', 'ai-vector-search']);
    const model = session.getFinalResumeModel();

    const targetPdf = path.join(testOutputDir, 'test_1page.pdf');
    const result = await generateResumePdf(model, { outputPath: targetPdf });

    assert.equal(result.format, 'pdf');
    assert.equal(fs.existsSync(result.filePath), true);
    assert.ok(result.fileSize > 10000);
    assert.equal(result.pageCount, 1, '1-page compact format must render strictly as 1 page');

    const valResult = await validatePdfResume(result.filePath, model);
    assert.equal(valResult.valid, true);
    assert.equal(valResult.pageCount, 1);
    assert.equal(valResult.expectedPages, 1);
    assert.equal(valResult.errors.length, 0);
  });

  // Case 5: Headless Microsoft Edge PDF generation for 2-page extended (actual 2 pages verified)
  test('Case 5: Headless Microsoft Edge generates PDF that renders to strictly 2 pages for 2-page extended budget', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('2page');
    session.selectProjects(['court-booking', 'lidar-core', 'ai-vector-search', 'enterprise-workflow']);
    const model = session.getFinalResumeModel();

    const targetPdf = path.join(testOutputDir, 'test_2page.pdf');
    const result = await generateResumePdf(model, { outputPath: targetPdf });

    assert.equal(fs.existsSync(result.filePath), true);
    assert.equal(result.pageCount, 2, '2-page extended format must render strictly as 2 pages');

    const valResult = await validatePdfResume(result.filePath, model);
    assert.equal(valResult.valid, true);
    assert.equal(valResult.pageCount, 2);
    assert.equal(valResult.expectedPages, 2);
    assert.equal(valResult.errors.length, 0);
  });

  // Case 6: Strict page count budget enforcement detects overflow
  test('Case 6: Strict page count validator detects and reports page count mismatches', async () => {
    // Use the 2-page PDF but pretend the model required 1page
    const targetPdf = path.join(testOutputDir, 'test_2page.pdf');
    assert.ok(fs.existsSync(targetPdf), '2-page PDF should exist from prior test');

    const mismatchedModel = {
      metadata: { resumeLength: '1page' },
      personal: { name: 'MANISH BORIKAR', email: 'manishborikar92@gmail.com' },
      projects: [],
      experience: []
    };

    const valResult = await validatePdfResume(targetPdf, mismatchedModel);
    assert.equal(valResult.valid, false);
    assert.ok(valResult.errors.some(e => e.includes('Strict page budget violated')));
    assert.equal(valResult.pageCount, 2);
    assert.equal(valResult.expectedPages, 1);
  });

  // Case 7: Content integrity and text extraction reading order verification
  test('Case 7: Text extraction confirms top-to-bottom ATS single-column reading order', async () => {
    const targetPdf = path.join(testOutputDir, 'test_1page.pdf');
    assert.ok(fs.existsSync(targetPdf), '1-page PDF should exist from prior test');

    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking', 'ai-vector-search']);
    const model = session.getFinalResumeModel();

    const valResult = await validatePdfResume(targetPdf, model);
    assert.equal(valResult.valid, true);

    const order = valResult.metrics.sectionOrder;
    assert.ok(Array.isArray(order));
    assert.ok(order.length >= 4);

    // Verify ordering sequence
    const expIdx = order.indexOf('Professional Experience');
    const projIdx = order.indexOf('Projects & Deliverables');
    const eduIdx = order.indexOf('Education');

    assert.ok(expIdx !== -1 && projIdx !== -1 && eduIdx !== -1);
    assert.ok(expIdx < projIdx, 'Experience must precede Projects in reading order');
    assert.ok(projIdx < eduIdx, 'Projects must precede Education in reading order');
  });

  // Case 8: Hyperlink preservation and target validation
  test('Case 8: Hyperlinks in PDF are preserved with valid protocols and correct targets', async () => {
    const targetPdf = path.join(testOutputDir, 'test_1page.pdf');
    const pdfBuf = fs.readFileSync(targetPdf);
    const uris = extractPdfUris(pdfBuf);

    assert.ok(Array.isArray(uris));
    assert.ok(uris.length > 0, 'PDF should contain URI link annotations');

    // Check that email, linkedin, and project link are present
    assert.ok(uris.some(u => u.includes('mailto:manishborikar92@gmail.com')));
    assert.ok(uris.some(u => u.includes('linkedin.com')));
    assert.ok(uris.some(u => u.includes('venue.example.com')));

    // All URIs must use safe protocols
    for (const uri of uris) {
      assert.ok(/^(https?:\/\/|mailto:|tel:)/i.test(uri), `URI ${uri} must use valid safe protocol`);
    }
  });

  // Case 9: Empty optional sections handling (e.g. omitted summary, omitted leadership)
  test('Case 9: Exporters omit empty optional sections cleanly without inserting placeholder filler', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('systems_3d');
    session.setResumeLength('1page');
    session.selectProjects(['lidar-core']);
    session.toggleSection('summary', false);
    session.toggleSection('leadership', false);
    session.toggleSection('certifications', false);

    const model = session.getFinalResumeModel();
    assert.equal(model.summary, null);
    assert.deepEqual(model.certifications, []);
    assert.deepEqual(model.leadership, []);

    const targetDocx = path.join(testOutputDir, 'test_no_summary.docx');
    const targetPdf = path.join(testOutputDir, 'test_no_summary.pdf');

    const docxRes = await generateResumeDocx(model, { outputPath: targetDocx });
    const pdfRes = await generateResumePdf(model, { outputPath: targetPdf });

    const valPdf = await validatePdfResume(pdfRes.filePath, model);
    assert.equal(valPdf.valid, true);

    const pdfBuf = fs.readFileSync(pdfRes.filePath);
    const parser = new PDFParse(new Uint8Array(pdfBuf));
    const textObj = await parser.getText();

    assert.ok(!textObj.text.includes('PROFESSIONAL SUMMARY'), 'Summary heading must not appear when disabled');
    assert.ok(!textObj.text.includes('LEADERSHIP & ACTIVITIES'), 'Leadership heading must not appear when disabled');
    assert.ok(textObj.text.includes('3D LiDAR Processing System'), 'Selected project must appear');
  });

  // Case 10: Selected project ordering preservation in export
  test('Case 10: Exporters preserve custom project ordering in final document', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');

    // Select in order: ai-vector-search FIRST, then court-booking SECOND
    session.selectProjects(['ai-vector-search', 'court-booking']);
    const model = session.getFinalResumeModel();

    assert.equal(model.projects[0].id, 'ai-vector-search');
    assert.equal(model.projects[1].id, 'court-booking');

    const targetPdf = path.join(testOutputDir, 'test_order.pdf');
    const pdfRes = await generateResumePdf(model, { outputPath: targetPdf });

    const valResult = await validatePdfResume(pdfRes.filePath, model);
    assert.equal(valResult.valid, true);

    const pdfBuf = fs.readFileSync(pdfRes.filePath);
    const parser = new PDFParse(new Uint8Array(pdfBuf));
    const textObj = await parser.getText();

    const posVector = textObj.text.indexOf('AI Semantic Vector Search Platform');
    const posPickle = textObj.text.indexOf('Pickleball SaaS Platform');

    assert.ok(posVector !== -1 && posPickle !== -1);
    assert.ok(posVector < posPickle, 'AI Vector Search must appear before Pickleball SaaS per user selection');
  });

  // Case 11: Error handling for invalid Edge path
  test('Case 11: PDF generator handles missing Edge executable gracefully with actionable error', async () => {
    const session = createSession({ catalog: testCatalog });
    const model = session.getFinalResumeModel();

    await assert.rejects(
      async () => {
        await generateResumePdf(model, {
          outputPath: path.join(testOutputDir, 'invalid.pdf'),
          edgePath: 'C:\\NonExistentPath\\msedge.exe'
        });
      },
      /Microsoft Edge executable not found|conversion failed/i
    );
  });

  // Case 12: Profile safety: export operations never modify config/profile.json
  test('Case 12: Document export never alters the personal profile on disk', async () => {
    const crypto = require('crypto');
    const profilePath = path.resolve(__dirname, '../config/profile.json');

    let initialHash = null;
    if (fs.existsSync(profilePath)) {
      initialHash = crypto.createHash('sha256').update(fs.readFileSync(profilePath)).digest('hex');
    }

    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking']);
    const model = session.getFinalResumeModel();

    const docxPath = path.join(testOutputDir, 'safety_check.docx');
    const pdfPath = path.join(testOutputDir, 'safety_check.pdf');

    await generateResumeDocx(model, { outputPath: docxPath });
    await generateResumePdf(model, { outputPath: pdfPath });

    if (fs.existsSync(profilePath) && initialHash) {
      const postHash = crypto.createHash('sha256').update(fs.readFileSync(profilePath)).digest('hex');
      assert.equal(postHash, initialHash, 'Profile on disk must not change after export');
    }
  });

  // Case 13: End-to-end wizard integration with export approval
  test('Case 13: End-to-end wizard completes export and validation upon user approval', async () => {
    const mockPrompter = createMockPrompter({
      selectQueue: [
        'fullstack',     // Step 1: Role
        '1page',         // Step 3: Length
        'select',        // Step 4: Projects action menu -> select projects
        'continue',      // Step 4: Projects action menu -> continue to bullets
        'done',          // Step 6: Bullets review for proj 1 -> done
        'done',          // Step 6: Bullets review for proj 2 -> done
        'continue',      // Step 7: Profile menu -> continue
        'approve',       // Step 8: Preview menu -> approve & complete
        'both'           // Step 8: Export menu -> export both DOCX & PDF
      ],
      multiselectQueue: [
        ['court-booking', 'ai-vector-search'] // Step 4: promptSelectProjects
      ],
      confirmQueue: [
        false            // Step 2: Wants JD? -> false
      ]
    });

    const result = await runWizard({
      prompter: mockPrompter,
      catalog: testCatalog,
      skipIntro: true
    });

    assert.equal(result.isCompleted, true);
    assert.equal(result.isCancelled, false);
    assert.ok(result.deliverables);
    assert.ok(result.deliverables.docx);
    assert.ok(result.deliverables.pdf);
    assert.equal(fs.existsSync(result.deliverables.docx.filePath), true);
    assert.equal(fs.existsSync(result.deliverables.pdf.filePath), true);
    assert.ok(result.validation);
    assert.equal(result.validation.allValid, true);

    // Clean up deliverables generated during test
    if (fs.existsSync(result.deliverables.docx.filePath)) {
      fs.unlinkSync(result.deliverables.docx.filePath);
    }
    if (fs.existsSync(result.deliverables.pdf.filePath)) {
      fs.unlinkSync(result.deliverables.pdf.filePath);
    }
  });

  // Case 14: ATS Layout Validation: Detects and rejects prohibited layout tables in DOCX
  test('Case 14: ATS layout verification detects and rejects prohibited <w:tbl> layout tables in DOCX', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking']);
    const model = session.getFinalResumeModel();

    const targetDocx = path.join(testOutputDir, 'test_table_detection.docx');
    await generateResumeDocx(model, { outputPath: targetDocx });

    // Legitimate DOCX has no tables
    const validCheck = await validateDocxResume(targetDocx, model);
    assert.equal(validCheck.valid, true);
    assert.equal(validCheck.metrics.hasTable, false);

    // Intentionally inject a layout table <w:tbl> into the DOCX zip archive
    const docxBuf = fs.readFileSync(targetDocx);
    const zip = await JSZip.loadAsync(docxBuf);
    let docXml = await zip.file('word/document.xml').async('text');
    docXml = docXml.replace('</w:body>', '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Injected Layout Table</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>');
    zip.file('word/document.xml', docXml);
    const tamperedBuf = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(targetDocx, tamperedBuf);

    // Validate that our ATS inspector rejects the document with table structure
    const tamperedCheck = await validateDocxResume(targetDocx, model);
    assert.equal(tamperedCheck.valid, false);
    assert.ok(tamperedCheck.errors.some(e => e.includes('Prohibited layout structure found in DOCX')));
  });

  // Case 15: DOCX sequential text extraction and single-column reading order
  test('Case 15: DOCX text extraction verifies sequential single-column ATS reading order', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking', 'ai-vector-search']);
    const model = session.getFinalResumeModel();

    const targetDocx = path.join(testOutputDir, 'test_reading_order.docx');
    await generateResumeDocx(model, { outputPath: targetDocx });

    const val = await validateDocxResume(targetDocx, model);
    assert.equal(val.valid, true);
    assert.ok(val.metrics.extractedTextLength > 500);
    assert.ok(val.metrics.paragraphCount > 10);
    assert.equal(val.metrics.hasTable, false);

    // Verify sections appeared in strictly correct ATS sequential reading order
    const expectedOrder = ['Professional Summary', 'Technical Skills', 'Professional Experience', 'Projects & Deliverables', 'Education'];
    for (let i = 0; i < expectedOrder.length; i++) {
      assert.equal(val.metrics.sectionOrder[i], expectedOrder[i]);
    }
  });

  // Case 16: Profile loader safety: rejects missing profile configuration without falling back to sample data
  test('Case 16: Profile loader rejects missing profile configuration without falling back to sample or placeholder data', () => {
    const missingPath = path.resolve(__dirname, '../data/strictly-nonexistent-profile.json');
    assert.throws(
      () => loadProfile(missingPath),
      /Profile configuration file not found/
    );

    // With allowMissing option, returns empty template without sample data
    const emptyProfile = loadProfile(missingPath, { allowMissing: true });
    assert.equal(emptyProfile.personal.name, '');
    assert.equal(emptyProfile.personal.email, '');
    assert.notEqual(emptyProfile.personal.name, 'Jane Doe');
    assert.notEqual(emptyProfile.personal.email, 'jane.doe@example.com');
  });

  // Case 17: Profile loader rejects malformed JSON profiles with a descriptive syntax error
  test('Case 17: Profile loader rejects malformed JSON profiles with a descriptive syntax error', () => {
    const malformedPath = path.join(testOutputDir, 'malformed-profile.json');
    fs.writeFileSync(malformedPath, '{ "personal": { "name": "Broken", } }', 'utf8');

    try {
      assert.throws(
        () => loadProfile(malformedPath),
        /contains invalid JSON/
      );
    } finally {
      if (fs.existsSync(malformedPath)) {
        fs.unlinkSync(malformedPath);
      }
    }
  });

  // Case 18: Stress test: handles very long job description and special characters deterministically
  test('Case 18: System handles very long job description and non-ASCII Unicode characters gracefully', () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('backend');

    // Generate 25,000+ character JD with dense requirements, punctuation, and Unicode symbols
    const longJdText = 'Seeking Principal Backend Architect proficient in Node.js, Express.js, PostgreSQL, Docker, and distributed systems. '
      .repeat(250) + ' Special requirements: 🚀 microservices, high-throughput caching with Redis, & zero-downtime migrations.';

    session.setJobDescription(longJdText);
    assert.ok(session.rankedProjects.length > 0);
    assert.ok(session.jdAnalysis);
    assert.ok(session.jdAnalysis.effectiveAlpha > 0);

    const model = session.getFinalResumeModel();
    assert.ok(model);
    assert.equal(model.metadata.targetRole, 'backend');
  });

  // Case 19: normalizeCertification handles diverse string and object schemas
  test('Case 19: normalizeCertification normalizes diverse string and object schemas into canonical objects', () => {
    // String with em-dash and middle dot
    const c1 = normalizeCertification('Machine Learning with Python — freeCodeCamp · 2025');
    assert.deepEqual(c1, {
      name: 'Machine Learning with Python',
      issuer: 'freeCodeCamp',
      year: '2025',
      raw: 'Machine Learning with Python — freeCodeCamp · 2025'
    });

    // String without em-dash but with middle dot
    const c2 = normalizeCertification('OpenEDG Python Institute: Programming with Python Professional Certificate · 2025');
    assert.deepEqual(c2, {
      name: 'OpenEDG Python Institute: Programming with Python Professional Certificate',
      issuer: '',
      year: '2025',
      raw: 'OpenEDG Python Institute: Programming with Python Professional Certificate · 2025'
    });

    // String with parentheses year
    const c3 = normalizeCertification('AWS Certified Solutions Architect (2024)');
    assert.deepEqual(c3, {
      name: 'AWS Certified Solutions Architect',
      issuer: '',
      year: '2024',
      raw: 'AWS Certified Solutions Architect (2024)'
    });

    // String with hyphen separator
    const c4 = normalizeCertification('React Native Developer - Meta - 2023');
    assert.deepEqual(c4, {
      name: 'React Native Developer',
      issuer: 'Meta',
      year: '2023',
      raw: 'React Native Developer - Meta - 2023'
    });

    // Solo string with no year
    const c5 = normalizeCertification('Certified Kubernetes Administrator');
    assert.deepEqual(c5, {
      name: 'Certified Kubernetes Administrator',
      issuer: '',
      year: '',
      raw: 'Certified Kubernetes Administrator'
    });

    // Object with canonical properties
    const c6 = normalizeCertification({ name: 'Docker Foundations', issuer: 'Docker, Inc.', year: '2025' });
    assert.deepEqual(c6, {
      name: 'Docker Foundations',
      issuer: 'Docker, Inc.',
      year: '2025',
      raw: 'Docker Foundations — Docker, Inc. · 2025'
    });

    // Object with property aliases (title, organization, date)
    const c7 = normalizeCertification({ title: 'Cloud Architect', organization: 'Google Cloud', date: 2024 });
    assert.deepEqual(c7, {
      name: 'Cloud Architect',
      issuer: 'Google Cloud',
      year: '2024',
      raw: 'Cloud Architect — Google Cloud · 2024'
    });

    // Null, empty, and falsy inputs
    assert.equal(normalizeCertification(null), null);
    assert.equal(normalizeCertification(''), null);
    assert.equal(normalizeCertification({}), null);
  });

  // Case 20: Full CLI/session pipeline normalizes profile string certifications and renders all 7 without empty bullets
  test('Case 20: CLI session model normalizes profile string certifications and renders fully in DOCX and PDF', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('2page');
    session.selectProjects(['court-booking', 'enterprise-workflow', 'lidar-core']);

    const model = session.getFinalResumeModel();
    assert.ok(Array.isArray(model.certifications));
    assert.equal(model.certifications.length, 7);
    assert.ok(model.certifications.every(c => typeof c === 'object' && c.name && c.year));

    const targetDocx = path.join(testOutputDir, 'test_certs_2page.docx');
    const targetPdf = path.join(testOutputDir, 'test_certs_2page.pdf');

    await generateResumeDocx(model, { outputPath: targetDocx });
    await generateResumePdf(model, { outputPath: targetPdf });

    // Validate deliverables with comprehensive validator
    const val = await validateDeliverables({ docxPath: targetDocx, pdfPath: targetPdf }, model);
    assert.equal(val.allValid, true);
    assert.equal(val.docx.valid, true);
    assert.equal(val.pdf.valid, true);

    // Verify DOCX contains zero empty bullet paragraphs
    const docxBuf = fs.readFileSync(targetDocx);
    const zip = await JSZip.loadAsync(docxBuf);
    const xml = await zip.file('word/document.xml').async('text');
    const bulletParagraphs = [...xml.matchAll(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*?<w:numPr>(?:(?!<\/w:p>).)*?<\/w:p>/gs)];
    for (const bp of bulletParagraphs) {
      const textContent = [...bp[0].matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(m => m[1]).join('').trim();
      assert.ok(textContent.length > 0, 'Found empty bullet paragraph in DOCX');
    }

    // Verify all 7 certification names exist in DOCX XML
    for (const cert of model.certifications) {
      assert.ok(xml.includes(cert.name.slice(0, 20)), `DOCX missing cert: ${cert.name}`);
    }

    // Verify HTML has zero empty bullets
    const html = generateResumeHtml(model);
    assert.ok(!html.includes('<li><strong></strong></li>'), 'HTML contains empty bullet');
    assert.ok(!html.includes('<li></li>'), 'HTML contains empty li');
  });

  // Case 21: Exporter defense when raw strings are passed directly to generateResumeDocx and generateResumeHtml
  test('Case 21: Exporters defensively handle raw string certifications without producing undefined tokens or empty bullets', async () => {
    const rawStringModel = {
      personal: { name: 'Raw Test Candidate', email: 'raw@example.com' },
      metadata: { resumeLength: '1page', targetRole: 'fullstack' },
      certifications: [
        'Direct String Certification — Direct Issuer · 2025',
        'Solo Credential Without Issuer (2024)'
      ],
      education: [{ degree: 'B.S. CS', institution: 'University', dates: '2024' }],
      skills: [{ category: 'languages', label: 'Languages', items: ['JavaScript'] }],
      experience: [],
      projects: []
    };

    // Test HTML template
    const html = generateResumeHtml(rawStringModel);
    assert.ok(html.includes('Direct String Certification'));
    assert.ok(html.includes('Direct Issuer'));
    assert.ok(html.includes('Solo Credential Without Issuer'));
    assert.ok(!html.includes('undefined'));
    assert.ok(!html.includes('<li><strong></strong></li>'));

    // Test DOCX generator
    const rawDocxPath = path.join(testOutputDir, 'test_raw_strings.docx');
    await generateResumeDocx(rawStringModel, { outputPath: rawDocxPath });

    const docxBuf = fs.readFileSync(rawDocxPath);
    const zip = await JSZip.loadAsync(docxBuf);
    const xml = await zip.file('word/document.xml').async('text');
    assert.ok(xml.includes('Direct String Certification'));
    assert.ok(xml.includes('Direct Issuer'));
    assert.ok(xml.includes('Solo Credential Without Issuer'));
    assert.ok(!xml.includes('undefined'));
  });

  // Case 22: Validator detects empty bullets in DOCX
  test('Case 22: Validator detects and reports empty bullet paragraphs in DOCX', async () => {
    const session = createSession({ catalog: testCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking']);
    const model = session.getFinalResumeModel();

    const targetDocx = path.join(testOutputDir, 'test_empty_bullet_detection.docx');
    await generateResumeDocx(model, { outputPath: targetDocx });

    // Intentionally inject an empty bullet paragraph into DOCX
    const docxBuf = fs.readFileSync(targetDocx);
    const zip = await JSZip.loadAsync(docxBuf);
    let docXml = await zip.file('word/document.xml').async('text');
    docXml = docXml.replace('</w:body>', '<w:p><w:pPr><w:numPr><w:numId w:val="1"/><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t></w:t></w:r></w:p></w:body>');
    zip.file('word/document.xml', docXml);
    const tamperedBuf = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(targetDocx, tamperedBuf);

    const val = await validateDocxResume(targetDocx, model);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('Found empty bullet paragraph')));
  });
});
