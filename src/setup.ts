import { configureToMatchImageSnapshot } from 'jest-image-snapshot';
import type { MatchImageSnapshotOptions } from 'jest-image-snapshot';
import type { IttoolsConfig } from './config';

// Loaded from jest.config.js globals.ittoolsConfig
const userConfig: Partial<IttoolsConfig> = (global as Record<string, unknown>).ittoolsConfig as Partial<IttoolsConfig> ?? {};

const snapshotDir = userConfig.snapshotDir ?? 'snapshots';
const snapdiffDir = `${snapshotDir.replace(/\/[^/]+$/, '')}/snapdiff`;

const options: MatchImageSnapshotOptions = {
  failureThreshold: userConfig.pixelDiffThreshold ?? 0.01,
  failureThresholdType: userConfig.failureThresholdType ?? 'percent',
  customSnapshotsDir: snapshotDir,
  customDiffDir: snapdiffDir,
};

const toMatchImageSnapshot = configureToMatchImageSnapshot(options);
expect.extend({ toMatchImageSnapshot });
