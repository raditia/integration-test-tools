import * as path from 'path';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { IttoolsConfig } from './config';

export interface GotoOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ScreenshotOverride {
  /** Override the auto-derived snapshot name. */
  name?: string;
  /** Per-screenshot pixel diff threshold. Overrides global ittoolsConfig.pixelDiffThreshold. */
  threshold?: number;
  /** How threshold is measured. Overrides global ittoolsConfig.failureThresholdType. */
  thresholdType?: 'percent' | 'pixel';
}

export interface VisualTestHelpers {
  /** Full Playwright Page object — use Playwright API directly. Available after beforeAll. */
  page: Page;
  /** Resolved base URL (protocol + host + port). Compose full URLs: `${baseUrl}/your/path`. */
  baseUrl: string;
  /** Capture current page state, auto-name from test path, compare against baseline. */
  screenshot: (options?: ScreenshotOverride) => Promise<void>;
}

function deriveSnapshotPath(snapshotsBase: string): { dir: string; identifier: string } {
  const { currentTestName = 'snapshot', testPath = '' } = expect.getState();

  const suiteDir = path.basename(path.dirname(testPath));

  const identifier = currentTestName
    .replace(/\s*>\s*/g, '--')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return {
    dir: path.join(snapshotsBase, suiteDir),
    identifier,
  };
}

/**
 * Resolves the base URL from environment variables.
 * ITTOOLS_BASE_HOST defaults to 'localhost' — set to 'host.docker.internal' when running
 * tests inside Docker locally so the container can reach the host app server.
 * ITTOOLS_BASE_PORT defaults to '2900'.
 * ITTOOLS_BASE_URL overrides both (full URL, e.g. 'https://staging.example.com').
 */
function resolveBaseUrl(): string {
  if (process.env.ITTOOLS_BASE_URL) return process.env.ITTOOLS_BASE_URL;
  const host = process.env.ITTOOLS_BASE_HOST ?? 'localhost';
  const port = process.env.ITTOOLS_BASE_PORT ?? '2900';
  return `http://${host}:${port}`;
}

export function setupVisualTest(overrides: { baseUrl?: string } = {}): VisualTestHelpers {
  let browser: Browser;
  let _page: Page | null = null;

  const globalConfig: Partial<IttoolsConfig> =
    (global as Record<string, unknown>).ittoolsConfig as Partial<IttoolsConfig> ?? {};

  const baseUrl = overrides.baseUrl ?? globalConfig.baseUrl ?? resolveBaseUrl();
  const snapshotsBase = globalConfig.snapshotDir ?? 'snapshots';
  const snapdiffBase = path.join(path.dirname(snapshotsBase), 'snapdiff');

  beforeAll(async () => {
    browser = await chromium.launch();
    _page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  });

  afterAll(async () => {
    await _page?.close();
    await browser.close();
  });

  const helpers: VisualTestHelpers = {
    get page(): Page {
      if (!_page) throw new Error('[ittools] page accessed before beforeAll — ensure setupVisualTest() is called inside describe()');
      return _page;
    },

    baseUrl,

    async screenshot(options = {}) {
      if (!_page) throw new Error('[ittools] screenshot() called before beforeAll');
      const { dir, identifier } = deriveSnapshotPath(snapshotsBase);
      const image = await _page.screenshot({ fullPage: true });
      expect(image).toMatchImageSnapshot({
        customSnapshotsDir: dir,
        customSnapshotIdentifier: options.name ?? identifier,
        customDiffDir: path.join(snapdiffBase, path.basename(dir)),
        failureThreshold: options.threshold ?? globalConfig.pixelDiffThreshold ?? 0.01,
        failureThresholdType: options.thresholdType ?? globalConfig.failureThresholdType ?? 'percent',
      });
    },
  };

  return helpers;
}
