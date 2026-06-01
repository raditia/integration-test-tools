import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export interface IttoolsConfig {
  headless: boolean;
  retries: number;
  testMatch: string[];
  testPathIgnorePatterns: string[];
  pixelDiffThreshold: number;
  failureThresholdType: 'percent' | 'pixel';
  snapshotDir: string;
  coverageReports: string[];
  baseUrl: string;
  dockerImage: string;
  dockerPort: number;
  containerName: string;
}

export const defaults: IttoolsConfig = {
  headless: true,
  retries: 0,
  testMatch: ['**/*.visual.test.ts'],
  testPathIgnorePatterns: ['**/node_modules/**'],
  pixelDiffThreshold: 0.01,
  failureThresholdType: 'percent',
  snapshotDir: 'snapshots',
  coverageReports: [],
  baseUrl: 'http://localhost:2900',
  dockerImage: 'ghcr.io/raditia/playwright-docker:latest',
  dockerPort: 3000,
  containerName: 'ittools-playwright',
};

export function defineConfig(config: Partial<IttoolsConfig>): IttoolsConfig {
  return { ...defaults, ...config };
}

export async function loadConfig(cwd = process.cwd()): Promise<IttoolsConfig> {
  const candidates = [
    'integration-test-tools.config.js',
    'integration-test-tools.config.mjs',
    'integration-test-tools.config.cjs',
  ];

  for (const candidate of candidates) {
    const filePath = resolve(cwd, candidate);
    if (existsSync(filePath)) {
      const mod = await import(pathToFileURL(filePath).href);
      return { ...defaults, ...(mod.default ?? mod) };
    }
  }

  return defaults;
}
