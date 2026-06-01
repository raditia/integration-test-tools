import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CONFIG_FILE = 'integration-test-tools.config.js';
const JEST_CONFIG_FILE = 'jest.visual.config.js';

const CONFIG_TEMPLATE = `/** @type {import('integration-test-tools').IttoolsConfig} */
module.exports = {
  headless: true,
  retries: 0,
  testMatch: ['**/*.visual.test.ts'],
  testPathIgnorePatterns: ['**/node_modules/**'],
  pixelDiffThreshold: 0.01,
  failureThresholdType: 'percent',
  snapshotDir: 'snapshots',
  baseUrl: 'http://localhost:2900',
  coverageReports: [],
};
`;

const JEST_CONFIG_TEMPLATE = `const config = require('./integration-test-tools.config');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'integration-test-tools',
  testMatch: config.testMatch ?? ['**/*.visual.test.ts'],
  testPathIgnorePatterns: config.testPathIgnorePatterns ?? ['**/node_modules/**'],
  globals: {
    ittoolsConfig: config,
  },
};
`;

const SCRIPTS = {
  'integration-test:base': 'ittools run',
  'integration-test:updateSnapshot': 'ittools run --updateSnapshot',
};

export async function runInit(cwd = process.cwd()): Promise<void> {
  let created = 0;

  // 1. integration-test-tools.config.js
  const configPath = resolve(cwd, CONFIG_FILE);
  if (existsSync(configPath)) {
    console.log(`[ittools] ${CONFIG_FILE} already exists — skipped`);
  } else {
    writeFileSync(configPath, CONFIG_TEMPLATE, 'utf-8');
    console.log(`[ittools] Created ${CONFIG_FILE}`);
    created++;
  }

  // 2. jest.visual.config.js
  const jestConfigPath = resolve(cwd, JEST_CONFIG_FILE);
  if (existsSync(jestConfigPath)) {
    console.log(`[ittools] ${JEST_CONFIG_FILE} already exists — skipped`);
  } else {
    writeFileSync(jestConfigPath, JEST_CONFIG_TEMPLATE, 'utf-8');
    console.log(`[ittools] Created ${JEST_CONFIG_FILE}`);
    created++;
  }

  // 3. package.json scripts
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) {
    console.warn(`[ittools] package.json not found at ${cwd} — skipping script injection`);
    return;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };

  pkg.scripts = pkg.scripts ?? {};
  let scriptsAdded = 0;

  for (const [name, command] of Object.entries(SCRIPTS)) {
    if (pkg.scripts[name]) {
      console.log(`[ittools] script "${name}" already exists — skipped`);
    } else {
      pkg.scripts[name] = command;
      console.log(`[ittools] Added script "${name}": "${command}"`);
      scriptsAdded++;
    }
  }

  if (scriptsAdded > 0) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }

  if (created === 0 && scriptsAdded === 0) {
    console.log('[ittools] Nothing to do — project already initialized.');
  } else {
    console.log('\n[ittools] Done. Next steps:');
    console.log('  1. Edit integration-test-tools.config.js to match your project');
    console.log('  2. Write tests in files matching testMatch pattern');
    console.log('  3. pnpm integration-test:base');
  }
}
