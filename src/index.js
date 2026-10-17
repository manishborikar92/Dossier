#!/usr/bin/env node

const pc = require('picocolors');
const { scanProjects } = require('./discovery/scanner');

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh') || args.includes('-r');

  console.log(pc.bold(pc.cyan('\n🔍 Resume Builder — Automated Project Discovery & Reconciliation')));
  console.log(pc.dim('-----------------------------------------------------------------'));
  if (refresh) {
    console.log(pc.yellow('⚡ Force-refresh flag detected. Bypassing catalog cache.\n'));
  }

  const startTime = Date.now();

  try {
    const result = await scanProjects({ refresh });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(pc.green(`✔ Scan completed successfully in ${duration}s\n`));

    console.log(pc.bold('📊 Filesystem & Catalog Audit:'));
    console.log(`  • Total Root Directories on Disk:        ${pc.bold(result.totalRootDirectories)}`);
    console.log(`  • Resume-Eligible Projects on Disk:     ${pc.bold(pc.green(result.scannedProjectsCount))}`);
    console.log(`  • Reference / Non-Project Excluded:      ${pc.bold(pc.yellow(result.excludedCount))}`);
    console.log(`  • Analysis Reused from Cache:            ${pc.bold(result.cachedCount)}`);
    console.log(`  • Freshly Analyzed / Updated:            ${pc.bold(result.reanalyzedCount)}`);
    console.log(`  • Newly Discovered Projects (on disk):   ${pc.bold(pc.cyan(result.stats.newlyDiscoveredProjects))}`);
    console.log(`  • Reference Folders Preserved (on disk): ${pc.bold(result.stats.referenceDirectoriesOnDisk)}`);
    console.log(`  • Historical Missing Entries Preserved:  ${pc.bold(result.stats.missingHistoricalEntries)}`);
    console.log(`  • Total Catalog Entries in Cache:        ${pc.bold(result.stats.totalCatalogEntries)}\n`);

    if (result.excludedDirectories.length > 0) {
      console.log(pc.bold('🚫 Excluded Directories (Not Candidate Projects):'));
      for (const exc of result.excludedDirectories) {
        console.log(`  - ${pc.dim(exc.name)}: ${exc.reason}`);
      }
      console.log('');
    }

    console.log(pc.bold('📁 Discovered Resume-Eligible Projects (On Disk):'));
    const candidates = result.catalog.filter(p => p.resume_eligibility);
    for (const p of candidates) {
      const typeBadge = p.is_monorepo ? pc.magenta('[MONOREPO]') : pc.blue('[STANDALONE]');
      const statusBadge = p.historical_status === 'newly_discovered'
        ? pc.green('[NEW]')
        : pc.dim('[VERIFIED]');
      const liveBadge = p.live_url ? pc.cyan('🌐 ' + p.live_url) : pc.dim('No live URL');
      const tech = p.primary_technologies?.slice(0, 5).join(', ') || 'No detected dependencies';

      console.log(`  ${statusBadge} ${typeBadge} ${pc.bold(p.name)}`);
      console.log(`     ${pc.dim('Tech:')} ${tech}`);
      console.log(`     ${pc.dim('Live:')} ${liveBadge}`);
      if (p.subcomponents?.length > 0) {
        console.log(`     ${pc.dim('Components:')} ${p.subcomponents.map(s => s.name).join(', ')}`);
      }
    }

    const nonEligible = result.catalog.filter(p => !p.resume_eligibility);
    if (nonEligible.length > 0) {
      console.log(pc.bold('\n📦 Preserved Master Catalog Entries (Non-Candidate or Missing):'));
      for (const item of nonEligible) {
        const availBadge = item.physical_availability
          ? pc.yellow('[ON DISK - REFERENCE]')
          : pc.red('[MISSING ON DISK]');
        console.log(`  ${availBadge} ${pc.bold(item.name)} (${item.discovery_classification})`);
        const reason = item.exclusion_reason || item.missing_reason || 'Reference entry';
        console.log(`     ${pc.dim('Status:')} ${reason}`);
      }
    }

    console.log(pc.dim('\n-----------------------------------------------------------------'));
    console.log(pc.green(`✔ Normalized catalog saved to: data/catalog.json\n`));

  } catch (err) {
    console.error(pc.red(`\n✖ Project discovery scan failed: ${err.message}`));
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  scanProjects,
  ...require('./ranking/scorer'),
  ...require('./ranking/role-profiles'),
  ...require('./ranking/jd-matcher'),
  ...require('./cli/session-state'),
  ...require('./cli/formatter'),
  ...require('./cli/wizard'),
  ...require('./export/docx-generator'),
  ...require('./export/pdf-generator'),
  ...require('./export/html-template'),
  ...require('./export/validator')
};

