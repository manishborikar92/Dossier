#!/usr/bin/env node

const { runWizard } = require('./wizard');
const pc = require('picocolors');

async function main() {
  const args = process.argv.slice(2);
  const refreshScan = args.includes('--refresh') || args.includes('-r');

  try {
    const result = await runWizard({ refreshScan });
    if (result.isCompleted) {
      process.exit(0);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(pc.red(`\n✖ Fatal CLI error: ${err.message}`));
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  runWizard
};
