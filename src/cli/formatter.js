const pc = require('picocolors');

/**
 * Returns a compact deployment badge string based on project evidence.
 *
 * @param {object} p - Project entry
 * @returns {string} Formatted badge
 */
function getDeploymentBadge(p) {
  if (p.liveUrl) {
    return pc.green(`🌐 ${p.liveUrl}`);
  }
  const tech = (p.primaryTechnologies || []).map(t => t.toLowerCase());
  if (tech.some(t => /inno setup|pyinstaller/i.test(t))) {
    return pc.cyan('📦 Packaged Desktop App');
  }
  if (tech.some(t => /binary protocols|udp sockets|setuptools/i.test(t))) {
    return pc.blue('🔌 Driver / Library SDK');
  }
  if (tech.some(t => /docker compose|kubernetes/i.test(t))) {
    return pc.magenta('🐳 Container Infrastructure');
  }
  return pc.dim('Local Codebase');
}

/**
 * Formats a list of candidate projects into an aligned terminal table.
 *
 * @param {object[]} rankedProjects - Ranked projects array
 * @param {string[]} [selectedIds=[]] - Array of currently selected project IDs
 * @returns {string} Aligned ASCII table string
 */
function formatProjectTable(rankedProjects, selectedIds = []) {
  if (!rankedProjects || rankedProjects.length === 0) {
    return pc.yellow('  No eligible projects found in catalog.\n');
  }

  const selectedSet = new Set(selectedIds);
  const lines = [];

  lines.push(pc.dim('┌──────┬──────┬─────────────────────┬─────────┬───────────────┬─────────────────────────────┬──────────┐'));
  lines.push(pc.dim('│') + pc.bold(' Sel  ') + pc.dim('│') + pc.bold(' Rank ') + pc.dim('│') + pc.bold(' Project Name        ') + pc.dim('│') + pc.bold(' Score   ') + pc.dim('│') + pc.bold(' Status        ') + pc.dim('│') + pc.bold(' Primary Technologies         ') + pc.dim('│') + pc.bold(' Coverage ') + pc.dim('│'));
  lines.push(pc.dim('├──────┼──────┼─────────────────────┼─────────┼───────────────┼─────────────────────────────┼──────────┤'));

  rankedProjects.forEach((p, idx) => {
    const isSelected = selectedSet.has(p.id);
    const selBadge = isSelected ? pc.green(pc.bold(' [✔]  ')) : pc.dim(' [ ]  ');
    const rankStr = (idx + 1).toString().padStart(4) + ' ';
    const nameStr = p.name.length > 19 ? p.name.slice(0, 18) + '…' : p.name.padEnd(19);

    const scoreStr = `${p.finalScore.toFixed(0).padStart(3)}/100 `;
    const coloredScore = p.finalScore >= 80 ? pc.green(scoreStr) : (p.finalScore >= 60 ? pc.cyan(scoreStr) : pc.yellow(scoreStr));

    let statusText = 'Verified     ';
    if (p.liveUrl) {
      statusText = pc.green('Live Deployed');
    } else if ((p.primaryTechnologies || []).some(t => /inno setup|pyinstaller/i.test(t))) {
      statusText = pc.cyan('Desktop Pkg  ');
    } else if ((p.primaryTechnologies || []).some(t => /udp sockets|binary protocols/i.test(t))) {
      statusText = pc.blue('Protocol SDK ');
    } else if (p.isProvisional) {
      statusText = pc.yellow('Provisional  ');
    }

    const techSummary = (p.primaryTechnologies || []).slice(0, 3).join(', ');
    const techStr = techSummary.length > 27 ? techSummary.slice(0, 26) + '…' : techSummary.padEnd(27);
    const covStr = `${p.scanCoverage || 70}%`.padStart(8) + ' ';

    lines.push(pc.dim('│') + selBadge + pc.dim('│') + rankStr + pc.dim('│') + pc.bold(nameStr) + pc.dim('│') + coloredScore + pc.dim('│') + statusText + pc.dim('│') + pc.dim(techStr) + pc.dim('│') + covStr + pc.dim('│'));
  });

  lines.push(pc.dim('└──────┴──────┴─────────────────────┴─────────┴───────────────┴─────────────────────────────┴──────────┘'));
  return lines.join('\n');
}

/**
 * Formats detailed score breakdown and evidence card for a single project.
 *
 * @param {object} p - Project details object from sessionState.getProjectDetails()
 * @returns {string} Formatted detail card
 */
function formatProjectDetailCard(p) {
  if (!p) return pc.red('Project not found.');

  const lines = [];
  lines.push(pc.bold(pc.cyan(`\n════════════════════════════════════════════════════════════════════════════════`)));
  lines.push(pc.bold(`  📂 ${p.title || p.name} ${pc.dim(`(ID: ${p.id})`)}`));
  lines.push(pc.bold(pc.cyan(`════════════════════════════════════════════════════════════════════════════════`)));

  lines.push(`  • ${pc.bold('Composite Final Score:')} ${pc.bold(pc.green(p.finalScore.toFixed(1)))} / 100  ${pc.dim(`(Quality: ${p.qualityScore.toFixed(1)}, Relevance: ${p.relevanceScore.toFixed(1)})`)}`);
  lines.push(`  • ${pc.bold('Deployment Status:')}     ${getDeploymentBadge(p)}`);
  lines.push(`  • ${pc.bold('Scan Coverage:')}         ${p.scanCoverage || 70}% ${p.isProvisional ? pc.yellow('[PROVISIONAL - LOW EVIDENCE CONFIDENCE]') : pc.green('[CONFIRMED]')}`);
  lines.push(`  • ${pc.bold('Commit Activity:')}      ${p.commitCount || 0} commits  ${pc.dim(`(First: ${p.firstCommit || 'N/A'}, Last: ${p.lastCommit || 'N/A'})`)}`);
  lines.push(`  • ${pc.bold('Verified Stack:')}        ${(p.primaryTechnologies || []).join(', ') || pc.dim('None detected')}`);

  if (p.purpose) {
    lines.push(`\n  ${pc.bold('Purpose & High-Level Summary:')}`);
    lines.push(`  ${pc.dim(p.purpose)}`);
  }

  if (p.rawScores) {
    lines.push(`\n  ${pc.bold('7-Factor Objective Dimension Breakdown:')}`);
    const r = p.rawScores;
    lines.push(`    1. Technical Depth:           ${r.depth.toString().padStart(2)} / 25 pts`);
    lines.push(`    2. Real-World Impact:         ${r.impact.toString().padStart(2)} / 20 pts`);
    lines.push(`    3. Engineering Quality:       ${r.quality.toString().padStart(2)} / 15 pts`);
    lines.push(`    4. Breadth of Skills:         ${r.breadth.toString().padStart(2)} / 15 pts`);
    lines.push(`    5. Architectural Uniqueness:  ${r.uniqueness.toString().padStart(2)} / 10 pts`);
    lines.push(`    6. Production Readiness:      ${r.readiness.toString().padStart(2)} / 10 pts`);
    lines.push(`    7. Storytelling Potential:    ${r.storytelling.toString().padStart(2)} /  5 pts`);
    lines.push(`    ${pc.bold('Total Raw Dimension Score:')}   ${pc.bold((p.totalRawScore || 0).toString().padStart(2))} / 100 pts`);
  }

  if (p.reasons && p.reasons.length > 0) {
    lines.push(`\n  ${pc.bold('Observable Evidence & Heuristic Rationale:')}`);
    for (const r of p.reasons) {
      lines.push(`    ✔ ${pc.dim(r)}`);
    }
  }

  if (p.importantFileReferences && p.importantFileReferences.length > 0) {
    lines.push(`\n  ${pc.bold('Verified Source References on Disk:')}`);
    for (const ref of p.importantFileReferences.slice(0, 5)) {
      lines.push(`    📄 ${pc.dim(ref)}`);
    }
  }

  if (p.resumeBullets && p.resumeBullets.length > 0) {
    lines.push(`\n  ${pc.bold('Proposed Resume Bullet Points:')}`);
    p.resumeBullets.forEach((bullet, idx) => {
      lines.push(`    [${idx + 1}] • ${bullet}`);
    });
  }

  lines.push(pc.bold(pc.cyan(`════════════════════════════════════════════════════════════════════════════════\n`)));
  return lines.join('\n');
}

/**
 * Formats the complete structured in-terminal resume preview.
 *
 * @param {object} resumeModel - Final resume data model
 * @returns {string} Formatted terminal resume preview
 */
function formatResumePreview(resumeModel) {
  const lines = [];
  const p = resumeModel.personal || {};
  const meta = resumeModel.metadata || {};

  lines.push(pc.dim('┌──────────────────────────────────────────────────────────────────────────────┐'));
  lines.push(pc.dim('│') + pc.bold(pc.cyan(` RESUME PREVIEW — ${meta.targetRoleTitle?.toUpperCase() || 'GENERAL'} (${meta.resumeLength?.toUpperCase() || '2PAGE'})`)).padEnd(85) + pc.dim('│'));
  lines.push(pc.dim('└──────────────────────────────────────────────────────────────────────────────┘\n'));

  // 1. Header & Contact Info
  lines.push(pc.bold(pc.blue(`  ${p.name || 'MANISH BORIKAR'}`)));
  const contacts = [
    p.location,
    p.phone,
    p.email ? pc.cyan(p.email) : null,
    p.linkedin ? pc.cyan(p.linkedin) : null,
    p.github ? pc.cyan(p.github) : null
  ].filter(Boolean);
  lines.push(`  ${pc.dim(contacts.join('  •  '))}\n`);

  // 2. Professional Summary
  if (resumeModel.summary) {
    lines.push(pc.bold(pc.underline('PROFESSIONAL SUMMARY')));
    lines.push(`  ${resumeModel.summary}\n`);
  }

  // 3. Technical Skills
  if (Array.isArray(resumeModel.skills) && resumeModel.skills.length > 0) {
    lines.push(pc.bold(pc.underline('TECHNICAL SKILLS')));
    for (const cat of resumeModel.skills) {
      lines.push(`  • ${pc.bold(cat.label)}: ${cat.items.join(', ')}`);
    }
    lines.push('');
  }

  // 4. Professional Experience
  if (Array.isArray(resumeModel.experience) && resumeModel.experience.length > 0) {
    lines.push(pc.bold(pc.underline('PROFESSIONAL EXPERIENCE')));
    for (const exp of resumeModel.experience) {
      lines.push(`  ${pc.bold(exp.role)}  |  ${exp.company} ${pc.dim(`(${exp.dates}  •  ${exp.location})`)}`);
      if (Array.isArray(exp.bullets)) {
        for (const b of exp.bullets) {
          lines.push(`    • ${b}`);
        }
      }
      lines.push('');
    }
  }

  // 5. Selected Projects
  if (Array.isArray(resumeModel.projects) && resumeModel.projects.length > 0) {
    lines.push(pc.bold(pc.underline('PROJECTS & TECHNICAL DELIVERABLES')));
    for (const proj of resumeModel.projects) {
      const linkBadge = proj.liveUrl ? `  •  🌐 ${pc.cyan(proj.liveUrl)}` : '';
      lines.push(`  ${pc.bold(proj.title || proj.name)}  ${pc.dim(`[${proj.techSummary}]`)}${linkBadge}`);
      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          lines.push(`    • ${b}`);
        }
      }
      lines.push('');
    }
  }

  // 6. Education
  if (Array.isArray(resumeModel.education) && resumeModel.education.length > 0) {
    lines.push(pc.bold(pc.underline('EDUCATION')));
    for (const edu of resumeModel.education) {
      lines.push(`  • ${pc.bold(edu.degree)} — ${edu.institution} ${pc.dim(`(${edu.dates || ''} ${edu.details ? '• ' + edu.details : ''})`)}`);
    }
    lines.push('');
  }

  // 7. Certifications
  if (Array.isArray(resumeModel.certifications) && resumeModel.certifications.length > 0) {
    lines.push(pc.bold(pc.underline('CERTIFICATIONS')));
    for (const cert of resumeModel.certifications) {
      lines.push(`  • ${cert}`);
    }
    lines.push('');
  }

  // 8. Leadership (Optional)
  if (Array.isArray(resumeModel.leadership) && resumeModel.leadership.length > 0) {
    lines.push(pc.bold(pc.underline('LEADERSHIP & ACTIVITIES')));
    for (const lead of resumeModel.leadership) {
      lines.push(`  • ${pc.bold(lead.title)} — ${lead.institution} ${pc.dim(`(${lead.dates || ''})`)}`);
      if (Array.isArray(lead.bullets)) {
        for (const b of lead.bullets) {
          lines.push(`      - ${b}`);
        }
      }
    }
    lines.push('');
  }

  lines.push(pc.dim('--------------------------------------------------------------------------------'));
  lines.push(pc.dim(`  Budget: ${meta.resumeLength === '1page' ? 'One-Page Compact (Max 2 Projects)' : 'Two-Page Extended (3-4 Projects)'}  •  Selected Projects: ${meta.totalSelectedProjects}`));
  lines.push(pc.dim('--------------------------------------------------------------------------------\n'));

  return lines.join('\n');
}

module.exports = {
  getDeploymentBadge,
  formatProjectTable,
  formatProjectDetailCard,
  formatResumePreview
};
