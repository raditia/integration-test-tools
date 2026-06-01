#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { loadConfig } from '../config';
import { mergeCoverage } from '../merge-coverage';
import { runInit } from '../init';

const [, , command, ...args] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case 'init': {
      await runInit();
      break;
    }

    case 'run': {
      const config = await loadConfig();
      const updateSnapshot = args.includes('--updateSnapshot');

      const jestArgs = [
        '--config', 'jest.visual.config.js',
        `--testRetries=${config.retries ?? 0}`,
        ...(updateSnapshot ? ['--updateSnapshot'] : []),
      ];

      const result = spawnSync('jest', jestArgs, { stdio: 'inherit', shell: true });
      process.exit(result.status ?? 1);
      break;
    }

    case 'merge-coverage': {
      const config = await loadConfig();
      const inputs = args.length > 0 ? args : config.coverageReports;
      if (inputs.length === 0) {
        console.error('[ittools] No coverage files specified. Pass paths as args or set coverageReports in integration-test-tools.config.js.');
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
          `  pnpm integration-test:updateSnapshot`,
          '',
          '[ittools] To update a specific suite:',
          `  jest --config jest.visual.config.js --updateSnapshot --testPathPattern="${pattern}"`,
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
          '  init                       Set up config and scripts in current project',
          '  run [--updateSnapshot]     Run visual tests (reads integration-test-tools.config.js)',
          '  merge-coverage [file...]   Merge Istanbul JSON coverage reports into one',
          '  update-snapshots           Print commands to refresh image snapshots',
        ].join('\n')
      );
    }
  }
}

main().catch((err: unknown) => {
  console.error('[ittools]', err);
  process.exit(1);
});
