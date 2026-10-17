#!/usr/bin/env node

const { runWizard } = require('./wizard');
const pc = require('picocolors');

async function main() {
  const args = process.argv.slice(2);
  const refreshScan = args.includes('--refresh') || args.includes('-r');

  if (!process.stdin.isTTY) {
    console.error(pc.yellow('\n⚠ Interactive Terminal (TTY) Required'));
    console.error(pc.dim('The Resume Builder CLI interactive wizard requires an interactive terminal console with TTY support (e.g. Windows Terminal, PowerShell, or Command Prompt).'));
    console.error(pc.dim('When running in non-interactive headless subshells or redirected pipes, @clack/prompts cannot capture keystrokes.'));
    console.error(pc.cyan('\nTo launch the interactive wizard, open a terminal window and run:'));
    console.error(pc.bold('  cd C:\\Users\\manis\\Projects\\Resume-Builder && npm start\n'));
    process.exit(1);
  }

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
