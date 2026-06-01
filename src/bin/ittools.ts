#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { loadConfig } from '../config';
import { mergeCoverage } from '../merge-coverage';
import { runInit } from '../init';

const [, , command, ...args] = process.argv;

function isContainerRunning(containerName: string): boolean {
  const result = spawnSync(
    'docker',
    ['inspect', '--format', '{{.State.Running}}', containerName],
    { encoding: 'utf-8' }
  );
  return result.stdout.trim() === 'true';
}

function imageExistsLocally(image: string): boolean {
  const result = spawnSync('docker', ['image', 'inspect', image], { encoding: 'utf-8' });
  return result.status === 0;
}

async function main(): Promise<void> {
  switch (command) {
    case 'init': {
      await runInit();
      break;
    }

    case 'run-docker': {
      const config = await loadConfig();
      const { dockerImage, dockerPort, containerName } = config;

      // Pull image if not present locally
      if (!imageExistsLocally(dockerImage)) {
        console.log(`[ittools] Image not found locally. Pulling ${dockerImage}...`);
        const pull = spawnSync('docker', ['pull', dockerImage], { stdio: 'inherit' });
        if (pull.status !== 0) {
          console.error('[ittools] Failed to pull image.');
          process.exit(1);
        }
      }

      // Idempotent: skip if already running
      if (isContainerRunning(containerName)) {
        console.log(`[ittools] Container "${containerName}" already running on port ${dockerPort}.`);
        process.exit(0);
      }

      // Remove stopped container with same name if it exists
      spawnSync('docker', ['rm', '-f', containerName], { encoding: 'utf-8' });

      // Start container as Playwright server
      const run = spawnSync(
        'docker',
        ['run', '-d', '--name', containerName, '-p', `${dockerPort}:3000`, dockerImage],
        { stdio: 'inherit' }
      );

      if (run.status !== 0) {
        console.error('[ittools] Failed to start container.');
        process.exit(1);
      }

      console.log(`[ittools] Playwright server started → ws://localhost:${dockerPort}`);
      console.log(`[ittools] Run tests: pnpm integration-test:base`);
      console.log(`[ittools] Stop when done: pnpm integration-test:stop-docker`);
      break;
    }

    case 'stop-docker': {
      const config = await loadConfig();
      const { containerName } = config;

      if (!isContainerRunning(containerName)) {
        console.log(`[ittools] Container "${containerName}" is not running.`);
        process.exit(0);
      }

      spawnSync('docker', ['stop', containerName], { stdio: 'inherit' });
      spawnSync('docker', ['rm', containerName], { stdio: 'inherit' });
      console.log(`[ittools] Container "${containerName}" stopped and removed.`);
      break;
    }

    case 'run': {
      const config = await loadConfig();
      const { containerName, dockerPort, retries } = config;
      const updateSnapshot = args.includes('--updateSnapshot');

      // Guard: container must be running
      if (!isContainerRunning(containerName)) {
        console.error(`[ittools] Playwright Docker container "${containerName}" is not running.`);
        console.error('[ittools] Start it first: pnpm integration-test:run-docker');
        process.exit(1);
      }

      const wsEndpoint = `ws://localhost:${dockerPort}`;

      const jestArgs = [
        '--config', 'jest.visual.config.js',
        `--testRetries=${retries}`,
        ...(updateSnapshot ? ['--updateSnapshot'] : []),
      ];

      const result = spawnSync('jest', jestArgs, {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, ITTOOLS_PLAYWRIGHT_WS: wsEndpoint },
      });

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
          '  pnpm integration-test:updateSnapshot',
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
          '  run-docker                 Pull image if needed + start Playwright Docker server',
          '  stop-docker                Stop and remove Playwright Docker container',
          '  run [--updateSnapshot]     Run visual tests against Docker Playwright server',
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
