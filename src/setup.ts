import { configureToMatchImageSnapshot } from 'jest-image-snapshot';
import type { MatchImageSnapshotOptions } from 'jest-image-snapshot';
import type { IttoolsConfig } from './config';

// Loaded from jest.config.js globals.ittoolsConfig
const userConfig: Partial<IttoolsConfig> = (global as Record<string, unknown>).ittoolsConfig as Partial<IttoolsConfig> ?? {};

const options: MatchImageSnapshotOptions = {
  failureThreshold: userConfig.pixelDiffThreshold ?? 0.01,
  failureThresholdType: userConfig.failureThresholdType ?? 'percent',
  ...(userConfig.snapshotDir ? { customSnapshotsDir: userConfig.snapshotDir } : {}),
  // Store diff images alongside snapshots for easy review
  customDiffDir: userConfig.snapshotDir ? `${userConfig.snapshotDir}/__diff_output__` : '__image_snapshots__/__diff_output__',
};

const toMatchImageSnapshot = configureToMatchImageSnapshot(options);
expect.extend({ toMatchImageSnapshot });
