const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createSession,
  loadProfile,
  prioritizeSkillsByRole
} = require('../src/cli/session-state');

const {
  formatProjectTable,
  formatProjectDetailCard,
  formatResumePreview
} = require('../src/cli/formatter');

const { runWizard } = require('../src/cli/wizard');

// Helper to create a predictable mock prompter
function createMockPrompter(responses = {}) {
  const history = [];

  const mock = {
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

  return mock;
}

// Sample mock projects for isolated unit tests
const mockCatalog = [
  {
    id: 'court-booking',
    name: 'Pickleball Arena SaaS',
    title: 'Court Booking & Venue SaaS',
    purpose: 'End-to-end court reservation SaaS with PhonePe integration and Prisma.',
    resume_eligibility: true,
    primary_technologies: ['Next.js', 'Express.js', 'PostgreSQL', 'Prisma ORM', 'PhonePe Payment Gateway', 'TypeScript'],
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
    commit_count: 200,
    last_commit: '2026-08-01',
    resume_entry: {
      resume_title: '3D LiDAR Processing System',
      bullets: [
        'Engineered point cloud filtering pipeline using Open3D and RANSAC.',
        'Packaged desktop application with Inno Setup installer.'
      ]
    }
  },
  {
    id: 'ai-vector-search',
    name: 'Vector Search Engine',
    title: 'AI Semantic Search Platform',
    purpose: 'Algorithmic feed ranking and pgvector HNSW similarity search.',
    resume_eligibility: true,
    primary_technologies: ['FastAPI', 'PostgreSQL', 'pgvector', 'sentence-transformers (all-MiniLM-L6-v2)'],
    commit_count: 80,
    last_commit: '2026-07-01',
    resume_entry: {
      resume_title: 'AI Semantic Vector Search Platform',
      bullets: [
        'Implemented pgvector HNSW cosine similarity search over 384-dimensional embeddings.'
      ]
    }
  },
  {
    id: 'ineligible-docs',
    name: 'Internal Documentation',
    title: 'Internal Docs',
    resume_eligibility: false,
    primary_technologies: ['Markdown']
  }
];

describe('Phase 4 Interactive Terminal CLI Workflow Test Suite', () => {

  // Case 1: Session state initialization and candidate project exclusion
  test('Case 1: Session state initializes correctly and strictly excludes ineligible catalog entries', () => {
    const session = createSession({ catalog: mockCatalog });

    assert.equal(session.rawCatalog.length, 4);
    // Ineligible project 'ineligible-docs' must never be in rankedProjects
    assert.equal(session.rankedProjects.length, 3);
    assert.ok(session.rankedProjects.every(p => p.id !== 'ineligible-docs'));
    assert.equal(session.resumeLength, '2page');
    assert.equal(session.maxProjects, 4);
  });

  // Case 2: Role selection and dynamic re-ranking in session
  test('Case 2: Role selection updates session state and calculates role-specific rankings', () => {
    const session = createSession({ catalog: mockCatalog });

    // Test Full-Stack preset
    session.setTargetRole('fullstack');
    assert.equal(session.targetRole, 'fullstack');
    assert.equal(session.rankedProjects[0].id, 'court-booking', 'Full-stack role must rank web SaaS highest');

    // Test Systems / 3D preset
    session.setTargetRole('systems_3d');
    assert.equal(session.targetRole, 'systems_3d');
    assert.equal(session.rankedProjects[0].id, 'lidar-core', 'Systems/3D role must rank LiDAR core highest');

    // Test AI / ML preset
    session.setTargetRole('ai_ml_data');
    assert.equal(session.targetRole, 'ai_ml_data');
    assert.equal(session.rankedProjects[0].id, 'ai-vector-search', 'AI/ML role must rank vector search highest');

    // Test Custom Role
    session.setTargetRole('custom', 'Cloud Infrastructure Architect');
    assert.equal(session.targetRole, 'custom');
    assert.equal(session.customRoleTitle, 'Cloud Infrastructure Architect');
  });

  // Case 3: Job Description matching and uninformative prose fallback
  test('Case 3: Job Description matching handles informative and uninformative prose gracefully', () => {
    const session = createSession({ catalog: mockCatalog });

    // Informative JD
    const techJd = 'Looking for an engineer with FastAPI, sentence-transformers, and PostgreSQL pgvector experience.';
    session.setJobDescription(techJd);
    assert.equal(session.jdAnalysis.isInformative, true);
    assert.equal(session.jdAnalysis.effectiveAlpha, 0.35);
    assert.equal(session.rankedProjects[0].id, 'ai-vector-search', 'Targeted tech JD must elevate matching project');

    // Nonempty Uninformative Prose JD
    const proseJd = 'Looking for a warm team player with great energy, great vibes, and synergy.';
    session.setJobDescription(proseJd);
    assert.equal(session.jdAnalysis.isInformative, false);
    assert.equal(session.jdAnalysis.effectiveAlpha, 0);
    assert.equal(session.jdAnalysis.fallbackApplied, true);
    // Project score must equal quality score without reduction
    const topProj = session.rankedProjects[0];
    assert.equal(topProj.finalScore, topProj.qualityScore);
  });

  // Case 4: Page budget limits (1-page compact vs 2-page extended)
  test('Case 4: Resume length budget strictly limits selected projects (max 2 for 1page, max 4 for 2page)', () => {
    const session = createSession({ catalog: mockCatalog });

    // Default 2-page: allows up to 4
    session.setResumeLength('2page');
    assert.equal(session.maxProjects, 4);
    session.selectProjects(['court-booking', 'lidar-core', 'ai-vector-search']);
    assert.equal(session.selectedProjectIds.length, 3);

    // Switch to 1-page: limits to max 2 and auto-truncates
    session.setResumeLength('1page');
    assert.equal(session.maxProjects, 2);
    assert.equal(session.selectedProjectIds.length, 2, 'Switching to 1page must truncate selection to 2');

    // Attempting to select 3 projects in 1-page mode is capped at 2
    session.selectProjects(['court-booking', 'lidar-core', 'ai-vector-search']);
    assert.equal(session.selectedProjectIds.length, 2);
  });

  // Case 5: Project selection, deselection, and custom ordering
  test('Case 5: Projects can be selected, deselected, and reordered explicitly in session', () => {
    const session = createSession({ catalog: mockCatalog });
    session.setResumeLength('2page');

    session.selectProjects(['lidar-core', 'court-booking']);
    assert.deepEqual(session.selectedProjectIds, ['lidar-core', 'court-booking']);

    // Reorder: promote court-booking to #1
    session.reorderSelectedProjects(['court-booking', 'lidar-core']);
    assert.deepEqual(session.selectedProjectIds, ['court-booking', 'lidar-core']);
  });

  // Case 6: Bullet point review and claim confirmation
  test('Case 6: Bullet points can be updated, and unconfirmed claims are tracked', () => {
    const session = createSession({ catalog: mockCatalog });

    const projId = 'court-booking';
    const details = session.getProjectDetails(projId);
    assert.ok(Array.isArray(details.resumeBullets));
    assert.equal(details.resumeBullets.length, 2);

    // Edit bullet points
    const customBullets = [
      'Architected high-throughput court reservation SaaS with Prisma ORM.',
      'Integrated PhonePe payments with webhook validation and zero downtime.'
    ];
    session.updateProjectBullets(projId, customBullets);

    const updated = session.getProjectDetails(projId);
    assert.deepEqual(updated.resumeBullets, customBullets);

    // Confirm claim
    session.confirmClaim(projId, 'processed_50k_bookings', true);
    assert.equal(session.projectOverrides[projId].confirmedClaims['processed_50k_bookings'], true);
  });

  // Case 7: Role-prioritized skill taxonomy
  test('Case 7: Skill matrix is prioritized according to target role without fabricating skills', () => {
    const sampleSkills = {
      languages: ['Python', 'TypeScript'],
      frontend: ['React.js', 'Next.js'],
      backend: ['Node.js', 'Express.js', 'FastAPI'],
      databases: ['PostgreSQL', 'MongoDB'],
      desktop_3d: ['Open3D', 'PyQt6'],
      ai_ml: ['TensorFlow', 'pgvector']
    };

    // Full-Stack: Frontend and Backend first
    const fsSkills = prioritizeSkillsByRole(sampleSkills, 'fullstack');
    assert.equal(fsSkills[0].category, 'frontend');
    assert.equal(fsSkills[1].category, 'backend');

    // Systems / 3D: Desktop/3D first
    const sysSkills = prioritizeSkillsByRole(sampleSkills, 'systems_3d');
    assert.equal(sysSkills[0].category, 'desktop_3d');

    // AI / ML: AI/ML first
    const aiSkills = prioritizeSkillsByRole(sampleSkills, 'ai_ml_data');
    assert.equal(aiSkills[0].category, 'ai_ml');
  });

  // Case 8: Profile editing and explicit persistence
  test('Case 8: Profile changes are tracked in memory and only written upon explicit user action', () => {
    const tempProfilePath = path.resolve(__dirname, '../data/test-profile.tmp.json');
    const initialProfile = {
      personal: { name: 'Manish Test', location: 'Hyderabad' },
      summary: 'Initial Summary',
      skills: {},
      experience: []
    };
    fs.writeFileSync(tempProfilePath, JSON.stringify(initialProfile, null, 2), 'utf8');

    try {
      const session = createSession({ catalog: mockCatalog, profilePath: tempProfilePath });

      // Edit summary in session
      session.updateSummary('Updated Modern Professional Summary');
      assert.equal(session.profile.summary, 'Updated Modern Professional Summary');
      assert.equal(session.profileModified, true);

      // Verify file on disk is NOT modified yet
      const onDiskBefore = JSON.parse(fs.readFileSync(tempProfilePath, 'utf8'));
      assert.equal(onDiskBefore.summary, 'Initial Summary', 'File on disk must not be modified before explicit save');

      // Revert edits
      session.revertProfileEdits();
      assert.equal(session.profile.summary, 'Initial Summary');
      assert.equal(session.profileModified, false);

      // Re-edit and explicitly save
      session.updateSummary('Approved Final Summary');
      session.saveProfileExplicit();

      const onDiskAfter = JSON.parse(fs.readFileSync(tempProfilePath, 'utf8'));
      assert.equal(onDiskAfter.summary, 'Approved Final Summary', 'File on disk must update after explicit save');
    } finally {
      if (fs.existsSync(tempProfilePath)) {
        fs.unlinkSync(tempProfilePath);
      }
    }
  });

  // Case 9: Complete resume model compilation matching Phase 5 requirements
  test('Case 9: Final resume data model compiles accurately reflecting all approved session edits', () => {
    const session = createSession({ catalog: mockCatalog });
    session.setTargetRole('fullstack');
    session.setResumeLength('1page');
    session.selectProjects(['court-booking', 'ai-vector-search']);

    const finalModel = session.getFinalResumeModel();

    assert.equal(finalModel.metadata.targetRole, 'fullstack');
    assert.equal(finalModel.metadata.resumeLength, '1page');
    assert.equal(finalModel.projects.length, 2);
    assert.equal(finalModel.projects[0].id, 'court-booking');
    assert.equal(finalModel.projects[1].id, 'ai-vector-search');
    assert.ok(Array.isArray(finalModel.skills));
    assert.ok(finalModel.personal.name);
  });

  // Case 10: Formatting helpers (table, detail card, preview) generate non-empty strings
  test('Case 10: Formatting helpers generate structured, readable terminal output', () => {
    const session = createSession({ catalog: mockCatalog });
    session.setTargetRole('general');
    session.selectProjects(['court-booking']);

    // Format table
    const tableStr = formatProjectTable(session.rankedProjects, ['court-booking']);
    assert.ok(tableStr.includes('Pickleball Arena'));
    assert.ok(tableStr.includes('[✔]'));

    // Format detail card
    const details = session.getProjectDetails('court-booking');
    const cardStr = formatProjectDetailCard(details);
    assert.ok(cardStr.includes('Court Booking & Venue SaaS'));
    assert.ok(cardStr.includes('Technical Depth:'));
    assert.ok(cardStr.includes('Real-World Impact:'));

    // Format preview
    const previewStr = formatResumePreview(session.getFinalResumeModel());
    assert.ok(previewStr.includes('RESUME PREVIEW'));
    assert.ok(previewStr.includes('TECHNICAL SKILLS'));
    assert.ok(previewStr.includes('PROJECTS & TECHNICAL DELIVERABLES'));
  });

  // Case 11: End-to-end wizard execution with simulated prompt responses (Happy Path)
  test('Case 11: End-to-end wizard runs smoothly to completion with explicit project selection', async () => {
    const mockPrompter = createMockPrompter({
      selectQueue: [
        'fullstack',     // Step 1: Role
        '2page',         // Step 3: Length
        'select',        // Step 4: Projects action menu -> explicitly select projects
        'continue',      // Step 4: Projects action menu -> continue to bullets
        'done',          // Step 6: Bullets review for proj 1 -> done
        'done',          // Step 6: Bullets review for proj 2 -> done
        'done',          // Step 6: Bullets review for proj 3 -> done
        'continue',      // Step 7: Profile menu -> continue
        'approve'        // Step 8: Preview menu -> approve & complete
      ],
      multiselectQueue: [
        ['court-booking', 'lidar-core', 'ai-vector-search'] // Step 4: promptSelectProjects
      ],
      confirmQueue: [
        false            // Step 2: Wants JD? -> false
      ]
    });

    const result = await runWizard({
      prompter: mockPrompter,
      catalog: mockCatalog,
      skipIntro: true
    });

    assert.equal(result.isCompleted, true);
    assert.equal(result.isCancelled, false);
    assert.ok(result.finalResumeModel);
    assert.equal(result.finalResumeModel.metadata.targetRole, 'fullstack');
    assert.equal(result.finalResumeModel.metadata.resumeLength, '2page');
    assert.equal(result.finalResumeModel.projects.length, 3);
  });

  // Case 12: Wizard cancellation handling at step 1
  test('Case 12: Wizard handles user cancellation gracefully without partial writes or crashes', async () => {
    const cancelSymbol = Symbol.for('cancel');
    const mockPrompter = createMockPrompter({
      selectQueue: [cancelSymbol] // User hits Ctrl+C at Role prompt
    });

    const result = await runWizard({
      prompter: mockPrompter,
      catalog: mockCatalog,
      skipIntro: true
    });

    assert.equal(result.isCompleted, false);
    assert.equal(result.isCancelled, true);
    assert.equal(result.finalResumeModel, null);
  });

  // Case 13: Project selection limits and deliberate choice verification
  test('Case 13: Budget enforcement preserves user choices and handles fewer projects in 2-page mode without forcing lower-ranked projects', () => {
    const session = createSession({ catalog: mockCatalog });

    // 1-page compact: max 2 projects
    session.setResumeLength('1page');
    assert.equal(session.maxProjects, 2);
    // User attempts to select 3 projects -> strictly capped at 2
    session.selectProjects(['court-booking', 'lidar-core', 'ai-vector-search']);
    assert.equal(session.selectedProjectIds.length, 2);
    assert.deepEqual(session.selectedProjectIds, ['court-booking', 'lidar-core']);

    // 2-page extended: user deliberately selects 1 project
    session.setResumeLength('2page');
    assert.equal(session.maxProjects, 4);
    session.selectProjects(['court-booking']);
    assert.equal(session.selectedProjectIds.length, 1);
    assert.deepEqual(session.selectedProjectIds, ['court-booking'], 'Must not force lower-ranked projects to meet an arbitrary 3-project minimum');

    // 2-page extended: user deliberately selects 2 projects
    session.selectProjects(['court-booking', 'lidar-core']);
    assert.equal(session.selectedProjectIds.length, 2);
    assert.deepEqual(session.selectedProjectIds, ['court-booking', 'lidar-core'], 'Must accept 2 projects in 2-page mode without silent auto-fill');

    // Switching back to 1-page keeps the 2 selected projects
    session.setResumeLength('1page');
    assert.equal(session.selectedProjectIds.length, 2);

    // Switching to 2-page does not silently select more projects
    session.setResumeLength('2page');
    assert.equal(session.selectedProjectIds.length, 2, 'Switching from 1-page to 2-page must not silently add projects');
  });

  // Case 14: Profile cancellation and save safety
  test('Case 14: Cancelling the wizard or declining to save leaves profile file on disk completely untouched', () => {
    const crypto = require('crypto');
    const tempProfilePath = path.resolve(__dirname, '../data/test-cancel-profile.tmp.json');
    const initialProfile = {
      personal: { name: 'Original Name', email: 'orig@example.com' },
      summary: 'Original Pristine Summary',
      skills: { languages: ['Python'] },
      experience: []
    };
    fs.writeFileSync(tempProfilePath, JSON.stringify(initialProfile, null, 2), 'utf8');
    const initialHash = crypto.createHash('sha256').update(fs.readFileSync(tempProfilePath)).digest('hex');

    try {
      const session = createSession({ catalog: mockCatalog, profilePath: tempProfilePath });

      // Simulate modifications during wizard session
      session.updateSummary('Modified Draft Summary that user decided NOT to save');
      session.updateProfileField('personal', 'name', 'Draft Name');
      assert.equal(session.profileModified, true);

      // Verify file on disk is still identical byte-for-byte
      const currentBytes = fs.readFileSync(tempProfilePath);
      const currentHash = crypto.createHash('sha256').update(currentBytes).digest('hex');
      assert.equal(currentHash, initialHash, 'Profile on disk must not change before explicit save');

      // Revert edits (simulating cancellation or declining save)
      session.revertProfileEdits();
      assert.equal(session.profile.summary, 'Original Pristine Summary');
      assert.equal(session.profileModified, false);

      const finalHash = crypto.createHash('sha256').update(fs.readFileSync(tempProfilePath)).digest('hex');
      assert.equal(finalHash, initialHash, 'Profile on disk must remain pristine after cancellation');

      // Verify that if a non-existent path is used, cancelled session does not create it
      const nonExistentPath = path.resolve(__dirname, '../data/non-existent-profile.tmp.json');
      if (fs.existsSync(nonExistentPath)) fs.unlinkSync(nonExistentPath);

      const emptySession = createSession({ catalog: mockCatalog, profilePath: nonExistentPath });
      emptySession.updateSummary('Transient text');
      emptySession.revertProfileEdits();
      assert.equal(fs.existsSync(nonExistentPath), false, 'Non-existent profile file must not be created on cancellation');
    } finally {
      if (fs.existsSync(tempProfilePath)) {
        fs.unlinkSync(tempProfilePath);
      }
    }
  });

});
