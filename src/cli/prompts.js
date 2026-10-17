const p = require('@clack/prompts');
const pc = require('picocolors');

/**
 * Default prompter implementation delegating directly to @clack/prompts.
 */
const defaultPrompter = {
  intro: p.intro,
  outro: p.outro,
  select: p.select,
  multiselect: p.multiselect,
  confirm: p.confirm,
  text: p.text,
  note: p.note,
  isCancel: p.isCancel,
  cancel: p.cancel,
  log: p.log
};

/**
 * Step 1: Prompt for Target Role.
 *
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<{ role: string, customTitle?: string } | symbol>}
 */
async function promptSelectRole(prompter = defaultPrompter) {
  const roleChoice = await prompter.select({
    message: 'Step 1: Choose your target role for resume ranking:',
    options: [
      { value: 'general', label: 'General-Purpose Software Developer (Default balanced scoring)', hint: 'No specific role bias' },
      { value: 'fullstack', label: 'Full-Stack Developer', hint: 'Emphasizes multi-tier web integration, ORM, deployments & auth' },
      { value: 'backend', label: 'Backend / Systems Engineer', hint: 'Emphasizes relational schema design, concurrency & API reliability' },
      { value: 'ai_ml_data', label: 'AI / Machine Learning & Data Engineer', hint: 'Emphasizes embeddings, vector search, model pipelines & math' },
      { value: 'systems_3d', label: 'Systems / 3D Graphics / Computer Vision Developer', hint: 'Emphasizes spatial math, point clouds, binary protocols & WASM' },
      { value: 'custom', label: 'Custom Target Role...', hint: 'Specify your own job title and criteria' },
      { value: 'skip', label: 'Skip role selection (Use General-Purpose)', hint: 'Quick start' }
    ]
  });

  if (prompter.isCancel(roleChoice)) {
    return roleChoice;
  }

  if (roleChoice === 'skip') {
    return { role: 'general' };
  }

  if (roleChoice === 'custom') {
    const customTitle = await prompter.text({
      message: 'Enter your custom target job title:',
      placeholder: 'e.g., DevOps / Cloud Platform Engineer',
      validate: val => (!val || val.trim().length === 0 ? 'Title cannot be empty.' : undefined)
    });
    if (prompter.isCancel(customTitle)) return customTitle;
    return { role: 'custom', customTitle: customTitle.trim() };
  }

  return { role: roleChoice };
}

/**
 * Step 2: Prompt for Optional Job Description.
 *
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string | null | symbol>}
 */
async function promptJobDescription(prompter = defaultPrompter) {
  const wantsJd = await prompter.confirm({
    message: 'Step 2: Do you want to provide a Job Description (JD) to match relevance?',
    initialValue: false
  });

  if (prompter.isCancel(wantsJd)) return wantsJd;
  if (!wantsJd) return null;

  const jdText = await prompter.text({
    message: 'Paste or type the target Job Description text (press Enter to submit):',
    placeholder: 'Paste keywords, requirements, or responsibilities...',
    validate: val => (!val || val.trim().length === 0 ? 'Job description text cannot be empty if provided.' : undefined)
  });

  if (prompter.isCancel(jdText)) return jdText;
  return jdText.trim();
}

/**
 * Step 3: Prompt for Resume Length Budget.
 *
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string | symbol>} '1page' | '2page'
 */
async function promptResumeLength(prompter = defaultPrompter) {
  const lengthChoice = await prompter.select({
    message: 'Step 3: Choose target resume format and length budget:',
    options: [
      {
        value: '1page',
        label: 'One-Page Compact Resume (Max 2 selected projects)',
        hint: 'Tight layout, high-impact concise bullets, consolidated skills'
      },
      {
        value: '2page',
        label: 'Two-Page Extended Resume (3 to 4 selected projects)',
        hint: 'Comprehensive project depth, complete work experience, detailed skills'
      }
    ]
  });

  return lengthChoice;
}

/**
 * Step 4/5: Prompt project catalog action menu.
 *
 * @param {number|object} [selectedCountOrPrompter=0] - Number of currently selected projects or prompter
 * @param {number} [maxAllowed=4] - Max projects allowed for current budget
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string | symbol>}
 */
async function promptProjectActionMenu(selectedCountOrPrompter = 0, maxAllowed = 4, maybePrompter = defaultPrompter) {
  let selectedCount = 0;
  let max = 4;
  let prompter = defaultPrompter;

  if (typeof selectedCountOrPrompter === 'object' && selectedCountOrPrompter !== null && selectedCountOrPrompter.select) {
    prompter = selectedCountOrPrompter;
  } else {
    selectedCount = typeof selectedCountOrPrompter === 'number' ? selectedCountOrPrompter : 0;
    max = typeof maxAllowed === 'number' ? maxAllowed : 4;
    prompter = maybePrompter || defaultPrompter;
  }

  const continueLabel = selectedCount > 0
    ? `✔ Continue to bullet review (${selectedCount} selected)`
    : '✔ Continue to bullet review (none selected)';

  const action = await prompter.select({
    message: `Project Selection & Inspection Options [${selectedCount}/${max} selected]:`,
    options: [
      { value: 'select', label: `📝 Select / Deselect candidate projects (${selectedCount} of max ${max} selected)`, hint: `Pick which projects appear (max ${max})` },
      { value: 'continue', label: continueLabel, hint: 'Proceed to content review' },
      { value: 'reorder', label: `↕ Reorder selected projects (${selectedCount} selected)`, hint: 'Change display order on resume' },
      { value: 'inspect', label: '🔍 Inspect project details & score card', hint: 'View 7-factor breakdown & evidence' }
    ]
  });

  return action;
}

/**
 * Prompt to select candidate projects with budget enforcement.
 *
 * @param {object[]} rankedProjects - Candidate projects
 * @param {number} maxAllowed - Max allowable selections (2 for 1page, 4 for 2page)
 * @param {string[]} currentSelectedIds - Currently selected IDs
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string[] | symbol>}
 */
async function promptSelectProjects(rankedProjects, maxAllowed, currentSelectedIds = [], prompter = defaultPrompter) {
  const options = rankedProjects.map(p => {
    const liveTag = p.liveUrl ? ' [🌐 Live]' : '';
    return {
      value: p.id,
      label: `${p.name} (Score: ${p.finalScore.toFixed(0)}) — ${(p.primaryTechnologies || []).slice(0, 3).join(', ')}${liveTag}`
    };
  });

  const selected = await prompter.multiselect({
    message: `Select candidate projects (Maximum ${maxAllowed} allowed for this page budget):`,
    options,
    initialValues: currentSelectedIds.slice(0, maxAllowed),
    required: true
  });

  if (prompter.isCancel(selected)) return selected;

  if (selected.length > maxAllowed) {
    prompter.log.warn(pc.yellow(`You selected ${selected.length} projects, but the budget allows a maximum of ${maxAllowed}. Truncating to top ${maxAllowed} selections.`));
    return selected.slice(0, maxAllowed);
  }

  return selected;
}

/**
 * Prompt to reorder the selected projects.
 *
 * @param {object[]} selectedProjects - Array of selected project objects
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string[] | symbol>}
 */
async function promptReorderProjects(selectedProjects, prompter = defaultPrompter) {
  if (selectedProjects.length <= 1) {
    prompter.log.info('Only one project selected; reordering is not needed.');
    return selectedProjects.map(p => p.id);
  }

  const ids = selectedProjects.map(p => p.id);
  const choice = await prompter.select({
    message: 'Current project ordering. Would you like to adjust?',
    options: [
      { value: 'keep', label: `Keep current order: ${selectedProjects.map((p, i) => `${i + 1}. ${p.name}`).join(', ')}` },
      { value: 'reverse', label: `Reverse order: ${[...selectedProjects].reverse().map((p, i) => `${i + 1}. ${p.name}`).join(', ')}` },
      { value: 'top', label: `Move project to #1 position...` }
    ]
  });

  if (prompter.isCancel(choice)) return choice;

  if (choice === 'reverse') {
    return [...ids].reverse();
  }

  if (choice === 'top') {
    const projectToPromote = await prompter.select({
      message: 'Choose which project should be in the #1 position:',
      options: selectedProjects.map(p => ({ value: p.id, label: p.name }))
    });
    if (prompter.isCancel(projectToPromote)) return projectToPromote;

    const remaining = ids.filter(id => id !== projectToPromote);
    return [projectToPromote, ...remaining];
  }

  return ids;
}

/**
 * Step 6: Prompt to review and edit bullet points for a project.
 *
 * @param {object} project - Project details
 * @param {string[]} currentBullets - Bullets
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string[] | symbol>}
 */
async function promptEditBulletPoints(project, currentBullets, prompter = defaultPrompter) {
  let bullets = [...currentBullets];

  while (true) {
    const options = [
      { value: 'done', label: '✔ Done reviewing bullet points for this project' },
      { value: 'add', label: '➕ Add a new bullet point' }
    ];

    bullets.forEach((b, idx) => {
      const truncated = b.length > 60 ? b.slice(0, 58) + '…' : b;
      options.push({ value: `edit_${idx}`, label: `✏ Edit bullet [${idx + 1}]: "${truncated}"` });
      options.push({ value: `delete_${idx}`, label: `🗑 Remove bullet [${idx + 1}]` });
    });

    const action = await prompter.select({
      message: `Bullet Point Review for ${pc.bold(project.title || project.name)} (${bullets.length} bullets):`,
      options
    });

    if (prompter.isCancel(action)) return action;

    if (action === 'done') {
      break;
    }

    if (action === 'add') {
      const newBullet = await prompter.text({
        message: 'Enter text for the new bullet point (must be evidence-grounded):',
        placeholder: 'Engineered...',
        validate: v => (!v || v.trim().length === 0 ? 'Bullet text cannot be empty.' : undefined)
      });
      if (prompter.isCancel(newBullet)) return newBullet;
      bullets.push(newBullet.trim());
      prompter.log.success('Bullet point added.');
    } else if (action.startsWith('edit_')) {
      const idx = parseInt(action.replace('edit_', ''), 10);
      const updated = await prompter.text({
        message: `Edit bullet point [${idx + 1}]:`,
        initialValue: bullets[idx],
        validate: v => (!v || v.trim().length === 0 ? 'Bullet text cannot be empty.' : undefined)
      });
      if (prompter.isCancel(updated)) return updated;
      bullets[idx] = updated.trim();
      prompter.log.success('Bullet point updated.');
    } else if (action.startsWith('delete_')) {
      const idx = parseInt(action.replace('delete_', ''), 10);
      bullets.splice(idx, 1);
      prompter.log.success('Bullet point removed.');
    }
  }

  return bullets;
}

/**
 * Step 7: Prompt to review profile information.
 *
 * @param {object} profile - Profile object
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string | symbol>}
 */
async function promptProfileMenu(profile, prompter = defaultPrompter) {
  const action = await prompter.select({
    message: 'Profile & Personal Information Options:',
    options: [
      { value: 'continue', label: '✔ Keep current profile data and proceed to Preview', hint: 'No changes' },
      { value: 'edit_summary', label: '📝 Edit Professional Summary statement', hint: 'Tailor summary text' },
      { value: 'edit_contact', label: '📞 Edit Contact Details (Location, phone, links)', hint: 'Update header info' },
      { value: 'toggle_sections', label: '⚙ Configure optional sections (Leadership, Certs)', hint: 'Toggle sections' },
      { value: 'save_profile', label: '💾 Persist profile changes to config/profile.json', hint: 'Permanent save' }
    ]
  });

  return action;
}

/**
 * Step 8: Prompt preview navigation menu.
 *
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string | symbol>}
 */
async function promptPreviewMenu(prompter = defaultPrompter) {
  const action = await prompter.select({
    message: 'Resume Preview Approved? Choose next action:',
    options: [
      { value: 'approve', label: '🚀 Approve Resume & Finalize CLI Session', hint: 'Complete Phase 4' },
      { value: 'edit_projects', label: '📁 Modify selected projects or ordering', hint: 'Return to Step 5' },
      { value: 'edit_bullets', label: '✏ Edit project bullet points', hint: 'Return to Step 6' },
      { value: 'edit_profile', label: '👤 Edit summary or profile details', hint: 'Return to Step 7' },
      { value: 'edit_role', label: '🎯 Change target role preset or JD', hint: 'Return to Step 1 & 2' },
      { value: 'edit_length', label: '📄 Change resume length budget (1-page vs 2-page)', hint: 'Return to Step 3' },
      { value: 'cancel', label: '❌ Cancel session without saving', hint: 'Exit CLI' }
    ]
  });

  return action;
}

/**
 * Step 8: Prompt document export options.
 *
 * @param {object} [prompter=defaultPrompter]
 * @returns {Promise<string | symbol>}
 */
async function promptExportMenu(prompter = defaultPrompter) {
  const choice = await prompter.select({
    message: 'Export finalized resume deliverables to output/?',
    options: [
      { value: 'both', label: '📄 Export both Word (.docx) and PDF (.pdf) deliverables', hint: 'Recommended' },
      { value: 'docx', label: '📝 Export Word document (.docx) only', hint: 'Editable format' },
      { value: 'pdf', label: '📑 Export PDF document (.pdf) only', hint: 'Searchable vector PDF' },
      { value: 'skip', label: '⏭ Skip document export', hint: 'Finalize in-memory model only' }
    ]
  });

  return choice;
}

module.exports = {
  defaultPrompter,
  promptSelectRole,
  promptJobDescription,
  promptResumeLength,
  promptProjectActionMenu,
  promptSelectProjects,
  promptReorderProjects,
  promptEditBulletPoints,
  promptProfileMenu,
  promptPreviewMenu,
  promptExportMenu
};

