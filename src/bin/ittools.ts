#!/usr/bin/env node
import { loadConfig } from '../config';
import { mergeCoverage } from '../merge-coverage';

const [, , command, ...args] = process.argv;

async function main(): Promise<void> {
  const config = await loadConfig();

  switch (command) {
    case 'merge-coverage': {
      const inputs = args.length > 0 ? args : config.coverageReports;
      if (inputs.length === 0) {
        console.error('[ittools] No coverage files specified. Pass paths as args or set coverageReports in ittools.config.js.');
        process.exit(1);
      }
      await mergeCoverage(inputs);
      break;
    }

    case 'update-snapshots': {
      const pattern = args[0] ?? '\\.visual\\.test';
      console.log(
        [
          '[ittools] To update all visual snapshots:',
          `  jest --updateSnapshot --testPathPattern="${pattern}"`,
          '',
          '[ittools] To update a specific suite:',
          `  jest --updateSnapshot --testPathPattern="test-suites-1"`,
          '',
          '[ittools] Diff images in snapdiff/ are cleared automatically on next run after update.',
        ].join('\n')
      );
      break;
    }

    default: {
      console.log(
        [
          'Usage: ittools <command>',
          '',
          'Commands:',
          '  merge-coverage [file...]   Merge Istanbul JSON coverage reports into one',
          '  update-snapshots           Print the Jest command to refresh image snapshots',
        ].join('\n')
      );
    }
  }
}

main().catch((err: unknown) => {
  console.error('[ittools]', err);
  process.exit(1);
});
