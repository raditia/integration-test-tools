import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export interface IttoolsConfig {
  pixelDiffThreshold: number;
  failureThresholdType: 'percent' | 'pixel';
  snapshotDir: string;
  coverageReports: string[];
}

const defaults: IttoolsConfig = {
  pixelDiffThreshold: 0.01,
  failureThresholdType: 'percent',
  snapshotDir: '__image_snapshots__',
  coverageReports: [],
};

export function defineConfig(config: Partial<IttoolsConfig>): IttoolsConfig {
  return { ...defaults, ...config };
}

export async function loadConfig(cwd = process.cwd()): Promise<IttoolsConfig> {
  const candidates = ['ittools.config.js', 'ittools.config.mjs', 'ittools.config.cjs'];

  for (const candidate of candidates) {
    const filePath = resolve(cwd, candidate);
    if (existsSync(filePath)) {
      const mod = await import(pathToFileURL(filePath).href);
      return { ...defaults, ...(mod.default ?? mod) };
    }
  }

  return defaults;
}
