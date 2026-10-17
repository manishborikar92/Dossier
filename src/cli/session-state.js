const fs = require('fs');
const path = require('path');
const { rankProjects } = require('../ranking/scorer');
const { parseJobDescription } = require('../ranking/jd-matcher');
const { loadRoleProfiles } = require('../ranking/role-profiles');

/**
 * Loads baseline profile from config/profile.json or specified customPath.
 * Never silently loads profile.example.json as user's personal information.
 *
 * @param {string} [customPath]
 * @param {object} [options]
 * @param {boolean} [options.allowMissing=false] - If true, returns an empty schema when file does not exist
 * @returns {object} Profile object
 */
function loadProfile(customPath = null, options = {}) {
  const profilePath = customPath || path.resolve(__dirname, '../../config/profile.json');

  if (fs.existsSync(profilePath)) {
    try {
      const content = fs.readFileSync(profilePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Profile configuration file at "${profilePath}" contains invalid JSON: ${err.message}`);
    }
  }

  if (options.allowMissing) {
    return {
      personal: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
      summary: '',
      skills: {},
      experience: [],
      education: [],
      certifications: [],
      leadership: []
    };
  }

  throw new Error(
    `Profile configuration file not found at: "${profilePath}".\n` +
    `The application will not use placeholder or example profile data as your personal resume.\n` +
    `Please configure your verified personal details in "config/profile.json" before running the resume builder.`
  );
}

/**
 * Prioritizes skills categories based on target role.
 *
 * @param {object} skills - Categorized skills object
 * @param {string} role - Role preset key
 * @returns {Array<{ category: string, label: string, items: string[] }>}
 */
function prioritizeSkillsByRole(skills = {}, role = 'fullstack') {
  const categoryLabels = {
    languages: 'Languages',
    frontend: 'Frontend Development',
    backend: 'Backend & APIs',
    databases: 'Databases & Storage',
    core_cs: 'Core Computer Science',
    devops: 'DevOps & Testing',
    cloud: 'Cloud & Third-Party Services',
    ai_ml: 'AI & Machine Learning',
    desktop_3d: 'Systems & 3D Graphics'
  };

  const priorityOrder = {
    fullstack: ['frontend', 'backend', 'databases', 'languages', 'devops', 'cloud', 'core_cs', 'desktop_3d', 'ai_ml'],
    backend: ['backend', 'databases', 'languages', 'devops', 'core_cs', 'cloud', 'frontend', 'ai_ml', 'desktop_3d'],
    ai_ml_data: ['ai_ml', 'languages', 'databases', 'desktop_3d', 'core_cs', 'backend', 'cloud', 'devops', 'frontend'],
    systems_3d: ['desktop_3d', 'languages', 'core_cs', 'ai_ml', 'devops', 'backend', 'frontend', 'databases', 'cloud']
  };

  const order = priorityOrder[role] || priorityOrder.fullstack;
  const result = [];

  for (const cat of order) {
    if (Array.isArray(skills[cat]) && skills[cat].length > 0) {
      result.push({
        category: cat,
        label: categoryLabels[cat] || cat,
        items: [...skills[cat]]
      });
    }
  }

  // Include any categories not in the priority list
  for (const [cat, items] of Object.entries(skills)) {
    if (!order.includes(cat) && Array.isArray(items) && items.length > 0) {
      result.push({
        category: cat,
        label: categoryLabels[cat] || cat,
        items: [...items]
      });
    }
  }

  return result;
}

const {
  normalizeCertification,
  normalizeEducation,
  normalizeExperience,
  normalizeProject,
  validateCanonicalModel
} = require('../model/normalize');

const ROLE_TITLE_DEFAULTS = {
  fullstack: 'Full Stack Developer',
  backend: 'Backend / Systems Engineer',
  ai_ml_data: 'AI / Machine Learning & Data Engineer',
  systems_3d: 'Systems / 3D Graphics Developer'
};

/**
 * Creates and initializes a session state for the Resume Builder CLI.
 *
 * @param {object} [options]
 * @param {object[]} [options.catalog] - Pre-loaded project catalog
 * @param {string} [options.profilePath] - Optional custom path to profile.json
 * @returns {object} Session State instance
 */
function createSession(options = {}) {
  const profileData = loadProfile(options.profilePath, { allowMissing: Boolean(options.allowMissingProfile) });

  const state = {
    targetRole: 'fullstack',
    customRoleTitle: null,
    jobDescription: null,
    jdAnalysis: null,
    resumeLength: '2page', // '1page' | '2page'
    maxProjects: 4, // 2 for 1page, 4 for 2page

    // Catalog & Rankings
    rawCatalog: Array.isArray(options.catalog) ? [...options.catalog] : [],
    rankedProjects: [],

    // Project selections & ordering
    selectedProjectIds: [],
    projectOverrides: {},

    // Profile & Sections
    profile: JSON.parse(JSON.stringify(profileData)),
    profileOriginal: JSON.parse(JSON.stringify(profileData)),
    profileModified: false,
    profilePath: options.profilePath || path.resolve(__dirname, '../../config/profile.json'),

    enabledSections: {
      summary: true,
      skills: true,
      experience: true,
      projects: true,
      education: true,
      certifications: true,
      leadership: false // default off for compact, can be enabled
    },

    // Session status
    isCompleted: false,
    isCancelled: false,

    // Methods
    setTargetRole(roleKey, customTitle = null) {
      const validRoles = ['fullstack', 'backend', 'ai_ml_data', 'systems_3d', 'custom'];
      const resolvedKey = roleKey === 'general' ? 'fullstack' : roleKey;
      this.targetRole = validRoles.includes(resolvedKey) ? resolvedKey : 'fullstack';
      this.customRoleTitle = resolvedKey === 'custom' ? (customTitle || 'Custom Role') : null;
      this.refreshRankings();
    },

    setJobDescription(jdText) {
      const trimmed = typeof jdText === 'string' ? jdText.trim() : '';
      this.jobDescription = trimmed.length > 0 ? trimmed : null;
      this.refreshRankings();
    },

    setResumeLength(lengthKey) {
      if (lengthKey === '1page') {
        this.resumeLength = '1page';
        this.maxProjects = 2;
        // Truncate selected projects if currently exceeding limit
        if (this.selectedProjectIds.length > 2) {
          this.selectedProjectIds = this.selectedProjectIds.slice(0, 2);
        }
      } else {
        this.resumeLength = '2page';
        this.maxProjects = 4;
      }
    },

    setCatalog(catalog) {
      this.rawCatalog = Array.isArray(catalog) ? [...catalog] : [];
      this.refreshRankings();
    },

    refreshRankings() {
      if (!this.rawCatalog || this.rawCatalog.length === 0) {
        this.rankedProjects = [];
        this.jdAnalysis = null;
        return;
      }

      const roleForScorer = this.targetRole === 'custom' ? 'fullstack' : this.targetRole;
      const rankResult = rankProjects(this.rawCatalog, {
        role: roleForScorer,
        jdText: this.jobDescription
      });

      this.rankedProjects = rankResult.rankedProjects;
      this.jdAnalysis = rankResult.jdAnalysis;

      // Initialize overrides for projects if not present
      for (const p of this.rankedProjects) {
        if (!this.projectOverrides[p.id]) {
          const rawProject = this.rawCatalog.find(c => c.id === p.id) || {};
          const resumeEntry = rawProject.resume_entry || {};
          const defaultBullets = Array.isArray(resumeEntry.bullets) && resumeEntry.bullets.length > 0
            ? [...resumeEntry.bullets]
            : [
                rawProject.purpose || 'Engineered scalable system architecture with verified implementation artifacts.',
                `Integrated verified technology stack including ${(p.primaryTechnologies || []).slice(0, 4).join(', ')}.`
              ];

          this.projectOverrides[p.id] = {
            customTitle: resumeEntry.resume_title || p.title || p.name,
            bullets: defaultBullets,
            confirmedClaims: {},
            excludedClaims: []
          };
        }
      }

      // Retain previously selected projects in their exact explicit user order if they remain in catalog
      if (this.selectedProjectIds.length > 0) {
        this.selectedProjectIds = this.selectedProjectIds.filter(id => this.rawCatalog.some(p => p.id === id)).slice(0, this.maxProjects);
      }
    },

    selectProjects(projectIds) {
      if (!Array.isArray(projectIds)) return;
      const validIds = projectIds.filter(id => this.rankedProjects.some(p => p.id === id));
      this.selectedProjectIds = validIds.slice(0, this.maxProjects);
    },

    reorderSelectedProjects(orderedIds) {
      if (!Array.isArray(orderedIds)) return;
      const existingSet = new Set(this.selectedProjectIds);
      const reordered = orderedIds.filter(id => existingSet.has(id));
      for (const id of this.selectedProjectIds) {
        if (!reordered.includes(id)) {
          reordered.push(id);
        }
      }
      this.selectedProjectIds = reordered.slice(0, this.maxProjects);
    },

    getProjectDetails(projectId) {
      const ranked = this.rankedProjects.find(p => p.id === projectId);
      const raw = this.rawCatalog.find(p => p.id === projectId) || {};
      const override = this.projectOverrides[projectId] || { bullets: [], confirmedClaims: {} };

      if (!ranked) return null;

      return {
        ...ranked,
        architecture: raw.architecture || null,
        technicalAnalysis: raw.technical_analysis || null,
        keyImplementationDetails: raw.key_implementation_details || null,
        importantFileReferences: raw.important_file_references || [],
        sourceCodeEvidence: raw.source_code_evidence || null,
        liveDeployedEvidence: raw.live_deployed_evidence || null,
        resumeBullets: override.bullets,
        confirmedClaims: override.confirmedClaims,
        customTitle: override.customTitle
      };
    },

    updateProjectBullets(projectId, bullets) {
      if (!this.projectOverrides[projectId]) {
        this.projectOverrides[projectId] = {};
      }
      if (Array.isArray(bullets)) {
        this.projectOverrides[projectId].bullets = bullets.filter(b => typeof b === 'string' && b.trim().length > 0);
      }
    },

    confirmClaim(projectId, claimKey, isConfirmed) {
      if (!this.projectOverrides[projectId]) {
        this.projectOverrides[projectId] = { bullets: [], confirmedClaims: {} };
      }
      this.projectOverrides[projectId].confirmedClaims[claimKey] = Boolean(isConfirmed);
    },

    updateProfileField(section, field, value) {
      if (this.profile[section] && typeof this.profile[section] === 'object') {
        this.profile[section][field] = value;
        this.profileModified = true;
      }
    },

    updateSummary(newSummary) {
      if (typeof newSummary === 'string') {
        this.profile.summary = newSummary.trim();
        this.profileModified = true;
      }
    },

    toggleSection(sectionKey, isEnabled) {
      if (this.enabledSections.hasOwnProperty(sectionKey)) {
        this.enabledSections[sectionKey] = Boolean(isEnabled);
      }
    },

    saveProfileExplicit(targetPath = null) {
      const destination = targetPath || this.profilePath;
      fs.writeFileSync(destination, JSON.stringify(this.profile, null, 2), 'utf8');
      this.profileOriginal = JSON.parse(JSON.stringify(this.profile));
      this.profileModified = false;
      return destination;
    },

    revertProfileEdits() {
      this.profile = JSON.parse(JSON.stringify(this.profileOriginal));
      this.profileModified = false;
    },

    /**
     * Compiles the canonical Resume Data Model reflecting the current session state.
     * Matches the expected schema for Phase 5 DOCX/PDF generation.
     *
     * @returns {object} Final compiled resume document model
     */
    getFinalResumeModel() {
      const maxBullets = this.resumeLength === '1page' ? 2 : 4;
      const selectedProjectsData = [];

      for (const id of this.selectedProjectIds) {
        const details = this.getProjectDetails(id);
        if (details) {
          const normProj = normalizeProject({
            id: details.id,
            name: details.name,
            title: details.customTitle || details.title || details.name,
            technologies: details.primaryTechnologies || [],
            techSummary: (details.primaryTechnologies || []).slice(0, 8).join(', '),
            liveUrl: details.liveUrl || null,
            year: details.lastCommit ? details.lastCommit.slice(0, 4) : '2026',
            bullets: details.resumeBullets || [],
            scores: {
              final: details.finalScore,
              quality: details.qualityScore,
              relevance: details.relevanceScore
            }
          }, maxBullets);
          if (normProj) {
            selectedProjectsData.push(normProj);
          }
        }
      }

      // Prioritize skills by role
      const prioritizedSkills = prioritizeSkillsByRole(
        this.profile.skills,
        this.targetRole === 'custom' ? 'fullstack' : this.targetRole
      );

      // Trim and normalize experience per page budget
      const maxExpRoles = this.resumeLength === '1page' ? 2 : 3;
      const maxExpBullets = this.resumeLength === '1page' ? 2 : 5;
      const normalizedExperience = (this.profile.experience || [])
        .slice(0, maxExpRoles)
        .map(exp => normalizeExperience(exp, maxExpBullets))
        .filter(Boolean);

      // Normalize education
      const normalizedEducation = (this.profile.education || [])
        .map(normalizeEducation)
        .filter(Boolean);

      // Normalize certifications
      const normalizedCertifications = (this.profile.certifications || [])
        .map(normalizeCertification)
        .filter(Boolean);

      const targetRoleTitle = this.customRoleTitle || ROLE_TITLE_DEFAULTS[this.targetRole] || 'Full Stack Developer';

      const model = {
        metadata: {
          targetRole: this.targetRole,
          targetRoleTitle,
          resumeLength: this.resumeLength,
          generatedAt: new Date().toISOString(),
          totalSelectedProjects: selectedProjectsData.length,
          pageBudgetRules: {
            maxProjects: this.maxProjects,
            maxBulletsPerProject: maxBullets
          }
        },
        personal: { ...this.profile.personal },
        summary: this.enabledSections.summary ? this.profile.summary : null,
        skills: this.enabledSections.skills ? prioritizedSkills : [],
        experience: this.enabledSections.experience ? normalizedExperience : [],
        projects: this.enabledSections.projects ? selectedProjectsData : [],
        education: this.enabledSections.education ? normalizedEducation : [],
        certifications: this.enabledSections.certifications ? normalizedCertifications : [],
        leadership: this.enabledSections.leadership ? (this.profile.leadership || []) : []
      };

      validateCanonicalModel(model);
      return model;
    }
  };

  if (state.rawCatalog.length > 0) {
    state.refreshRankings();
  }

  return state;
}

module.exports = {
  loadProfile,
  prioritizeSkillsByRole,
  normalizeCertification,
  validateCanonicalModel,
  createSession,
  ROLE_TITLE_DEFAULTS
};

