const pc = require('picocolors');
const { scanProjects } = require('../discovery/scanner');
const { createSession } = require('./session-state');
const { formatProjectTable, formatProjectDetailCard, formatResumePreview } = require('./formatter');
const {
  defaultPrompter,
  promptSelectRole,
  promptJobDescription,
  promptResumeLength,
  promptProjectActionMenu,
  promptSelectProjects,
  promptReorderProjects,
  promptEditBulletPoints,
  promptProfileMenu,
  promptPreviewMenu
} = require('./prompts');

/**
 * Executes the complete step-by-step Resume Builder CLI wizard.
 *
 * @param {object} [options]
 * @param {object} [options.prompter=defaultPrompter] - Prompt provider (injectable for testing)
 * @param {object[]} [options.catalog] - Optional pre-loaded catalog to bypass scanning
 * @param {string} [options.profilePath] - Optional custom path to profile.json
 * @param {boolean} [options.refreshScan=false] - Force cache bypass if scanning
 * @param {boolean} [options.skipIntro=false] - Skip intro banners in tests
 * @returns {Promise<{ sessionState: object, finalResumeModel: object|null, isCompleted: boolean, isCancelled: boolean }>}
 */
async function runWizard(options = {}) {
  const prompter = options.prompter || defaultPrompter;

  if (!options.skipIntro) {
    prompter.intro(pc.bold(pc.cyan('📄 Intelligent Resume Builder — Terminal Workflow')));
    prompter.log.info(pc.dim('Discovers your strongest projects, ranks them heuristically, and helps tailor an ATS-friendly resume.'));
  }

  // 1. Obtain Catalog (from preloaded option or scanner)
  let catalog = options.catalog;
  if (!catalog || !Array.isArray(catalog)) {
    try {
      prompter.log.step('Scanning local projects across workspace...');
      const scanResult = await scanProjects({ refresh: Boolean(options.refreshScan) });
      catalog = scanResult.catalog;
    } catch (err) {
      prompter.log.error(`Project scanning failed: ${err.message}`);
      return { sessionState: null, finalResumeModel: null, isCompleted: false, isCancelled: true };
    }
  }

  // Initialize Session State
  const session = createSession({
    catalog,
    profilePath: options.profilePath
  });

  let currentStep = 'role';

  while (true) {
    // ── STEP 1: Choose Target Role ──────────────────────────────────────────
    if (currentStep === 'role') {
      const roleResult = await promptSelectRole(prompter);
      if (prompter.isCancel(roleResult)) {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }

      session.setTargetRole(roleResult.role, roleResult.customTitle);
      prompter.log.success(`Target role set to: ${pc.bold(session.customRoleTitle || session.targetRole)}`);
      currentStep = 'jd';
    }

    // ── STEP 2: Optional Job Description ────────────────────────────────────
    else if (currentStep === 'jd') {
      const jdResult = await promptJobDescription(prompter);
      if (prompter.isCancel(jdResult)) {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }

      session.setJobDescription(jdResult);

      if (session.jdAnalysis) {
        if (!session.jdAnalysis.isInformative) {
          prompter.log.warn(pc.yellow('Job Description note: No recognizable technical or domain keywords found in input prose. Relevance scoring bypassed; ranking safely uses quality scores.'));
        } else {
          prompter.log.success(`Job Description parsed: Found ${session.jdAnalysis.techTokens?.length || 0} tech tokens, ${session.jdAnalysis.domainKeywords?.length || 0} domain terms.`);
        }
      }

      currentStep = 'length';
    }

    // ── STEP 3: Resume Length Budget ────────────────────────────────────────
    else if (currentStep === 'length') {
      const lengthResult = await promptResumeLength(prompter);
      if (prompter.isCancel(lengthResult)) {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }

      session.setResumeLength(lengthResult);
      prompter.log.success(`Resume format set to: ${pc.bold(session.resumeLength.toUpperCase())} (Maximum ${session.maxProjects} projects).`);
      currentStep = 'projects';
    }

    // ── STEP 4 & 5: Discover, Rank, Select & Reorder Projects ───────────────
    else if (currentStep === 'projects') {
      console.log('\n' + formatProjectTable(session.rankedProjects, session.selectedProjectIds));

      const action = await promptProjectActionMenu(session.selectedProjectIds.length, session.maxProjects, prompter);
      if (prompter.isCancel(action)) {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }

      if (action === 'continue') {
        if (session.selectedProjectIds.length === 0) {
          prompter.log.warn('No projects selected. Please select at least one project before continuing.');
        } else {
          if (session.resumeLength === '2page' && session.selectedProjectIds.length < 3) {
            prompter.log.info(pc.cyan(`Note: Two-page extended format standard recommendation is 3 to 4 projects. You selected ${session.selectedProjectIds.length} project(s); proceeding with your deliberate selection without forcing additional projects.`));
          }
          currentStep = 'bullets';
        }
      } else if (action === 'select') {
        const selected = await promptSelectProjects(session.rankedProjects, session.maxProjects, session.selectedProjectIds, prompter);
        if (!prompter.isCancel(selected)) {
          session.selectProjects(selected);
          prompter.log.success(`Selected ${session.selectedProjectIds.length} project(s).`);
          if (session.resumeLength === '2page' && session.selectedProjectIds.length < 3 && session.selectedProjectIds.length > 0) {
            prompter.log.info(pc.cyan(`Note: Two-page extended format typically showcases 3 to 4 projects. You have selected ${session.selectedProjectIds.length} project(s); respecting your choice.`));
          }
        }
      } else if (action === 'reorder') {
        const selectedProjects = session.selectedProjectIds.map(id => session.getProjectDetails(id)).filter(Boolean);
        const reordered = await promptReorderProjects(selectedProjects, prompter);
        if (!prompter.isCancel(reordered)) {
          session.reorderSelectedProjects(reordered);
          prompter.log.success('Project order updated.');
        }
      } else if (action === 'inspect') {
        const projectToInspect = await prompter.select({
          message: 'Select a project to inspect score card and concrete evidence:',
          options: session.rankedProjects.map(p => ({
            value: p.id,
            label: `${p.name} (Score: ${p.finalScore.toFixed(0)})`
          }))
        });

        if (!prompter.isCancel(projectToInspect)) {
          const details = session.getProjectDetails(projectToInspect);
          console.log(formatProjectDetailCard(details));
        }
      }
    }

    // ── STEP 6: Review Project Bullets & Confirm Claims ─────────────────────
    else if (currentStep === 'bullets') {
      prompter.log.step('Step 6: Review Project Highlights & Proposed Bullet Points');

      const selectedProjects = session.selectedProjectIds.map(id => session.getProjectDetails(id)).filter(Boolean);
      for (const proj of selectedProjects) {
        const updatedBullets = await promptEditBulletPoints(proj, proj.resumeBullets, prompter);
        if (prompter.isCancel(updatedBullets)) {
          session.isCancelled = true;
          prompter.cancel('Resume building session cancelled.');
          return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
        }
        session.updateProjectBullets(proj.id, updatedBullets);
      }

      prompter.log.success('Project highlights and bullet points approved.');
      currentStep = 'profile';
    }

    // ── STEP 7: Review Personal & Profile Information ───────────────────────
    else if (currentStep === 'profile') {
      prompter.log.step('Step 7: Personal & Professional Information Review');

      const action = await promptProfileMenu(session.profile, prompter);
      if (prompter.isCancel(action)) {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }

      if (action === 'continue') {
        currentStep = 'preview';
      } else if (action === 'edit_summary') {
        const newSummary = await prompter.text({
          message: 'Edit Professional Summary statement:',
          initialValue: session.profile.summary,
          validate: v => (!v || v.trim().length === 0 ? 'Summary cannot be empty.' : undefined)
        });
        if (!prompter.isCancel(newSummary)) {
          session.updateSummary(newSummary);
          prompter.log.success('Summary updated in session.');
        }
      } else if (action === 'edit_contact') {
        const newLocation = await prompter.text({
          message: 'Location:',
          initialValue: session.profile.personal.location || ''
        });
        if (!prompter.isCancel(newLocation)) {
          session.updateProfileField('personal', 'location', newLocation.trim());
        }
        const newPhone = await prompter.text({
          message: 'Phone:',
          initialValue: session.profile.personal.phone || ''
        });
        if (!prompter.isCancel(newPhone)) {
          session.updateProfileField('personal', 'phone', newPhone.trim());
        }
        prompter.log.success('Contact details updated in session.');
      } else if (action === 'toggle_sections') {
        const secChoices = await prompter.multiselect({
          message: 'Enable / Disable Optional Sections:',
          options: [
            { value: 'summary', label: 'Professional Summary', hint: 'Top executive summary' },
            { value: 'skills', label: 'Technical Skills Matrix', hint: 'Categorized skills' },
            { value: 'experience', label: 'Work Experience', hint: 'Prior roles & achievements' },
            { value: 'projects', label: 'Projects & Deliverables', hint: 'Selected projects' },
            { value: 'education', label: 'Education', hint: 'University degrees' },
            { value: 'certifications', label: 'Certifications', hint: 'Verified credentials' },
            { value: 'leadership', label: 'Leadership & Activities', hint: 'Extracurricular & volunteer' }
          ],
          initialValues: Object.entries(session.enabledSections).filter(([, v]) => v).map(([k]) => k)
        });

        if (!prompter.isCancel(secChoices)) {
          for (const key of Object.keys(session.enabledSections)) {
            session.toggleSection(key, secChoices.includes(key));
          }
          prompter.log.success('Optional sections updated.');
        }
      } else if (action === 'save_profile') {
        const confirmSave = await prompter.confirm({
          message: `Are you sure you want to overwrite config/profile.json with your session edits?`,
          initialValue: false
        });
        if (!prompter.isCancel(confirmSave) && confirmSave) {
          session.saveProfileExplicit();
          prompter.log.success('Profile saved to config/profile.json.');
        }
      }
    }

    // ── STEP 8: In-Terminal Preview & Revision Loop ─────────────────────────
    else if (currentStep === 'preview') {
      const resumeModel = session.getFinalResumeModel();
      console.log('\n' + formatResumePreview(resumeModel));

      const navAction = await promptPreviewMenu(prompter);
      if (prompter.isCancel(navAction)) {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }

      if (navAction === 'approve') {
        session.isCompleted = true;
        prompter.outro(pc.bold(pc.green('✔ Resume Content Model Finalized & Ready for Document Export!')));
        prompter.log.success(`Target Role: ${pc.bold(resumeModel.metadata.targetRoleTitle)}`);
        prompter.log.success(`Format Budget: ${pc.bold(resumeModel.metadata.resumeLength.toUpperCase())}`);
        prompter.log.success(`Selected Projects: ${pc.bold(resumeModel.projects.map(p => p.name).join(', '))}`);
        return {
          sessionState: session,
          finalResumeModel: resumeModel,
          isCompleted: true,
          isCancelled: false
        };
      } else if (navAction === 'edit_projects') {
        currentStep = 'projects';
      } else if (navAction === 'edit_bullets') {
        currentStep = 'bullets';
      } else if (navAction === 'edit_profile') {
        currentStep = 'profile';
      } else if (navAction === 'edit_role') {
        currentStep = 'role';
      } else if (navAction === 'edit_length') {
        currentStep = 'length';
      } else if (navAction === 'cancel') {
        session.isCancelled = true;
        prompter.cancel('Resume building session cancelled without saving.');
        return { sessionState: session, finalResumeModel: null, isCompleted: false, isCancelled: true };
      }
    }
  }
}

module.exports = {
  runWizard
};
