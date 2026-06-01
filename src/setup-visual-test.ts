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
  /** Resolved base URL (protocol + host + port). Compose full URLs with this: `${baseUrl}/your/path`. */
  baseUrl: string;
  goto: (url: string, options?: GotoOptions) => Promise<void>;
  screenshot: (options?: ScreenshotOverride) => Promise<void>;
  click: (selector: string) => Promise<void>;
  waitFor: (selector: string, timeout?: number) => Promise<void>;
  pause: (ms: number) => Promise<void>;
  waitForResponse: (urlPattern: string | RegExp) => Promise<void>;
  waitForNetworkIdle: (timeout?: number) => Promise<void>;
  type: (selector: string, text: string) => Promise<void>;
}

function deriveSnapshotPath(snapshotsBase: string): { dir: string; identifier: string } {
  const { currentTestName = 'snapshot', testPath = '' } = expect.getState();

  // test/test-suites-1/Foo.visual.test.ts → test-suites-1
  const suiteDir = path.basename(path.dirname(testPath));

  // 'Suite Name > test case name' → 'suite-name--test-case-name'
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
  let page: Page;

  const globalConfig: Partial<IttoolsConfig> =
    (global as Record<string, unknown>).ittoolsConfig as Partial<IttoolsConfig> ?? {};

  const baseUrl = overrides.baseUrl ?? globalConfig.baseUrl ?? resolveBaseUrl();
  const snapshotsBase = globalConfig.snapshotDir ?? 'snapshots';
  // snapdiff sits alongside snapshots/ — e.g. 'test/snapshots' → 'test/snapdiff'
  const snapdiffBase = path.join(path.dirname(snapshotsBase), 'snapdiff');

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  return {
    baseUrl,

    async goto(url, options = {}) {
      await page.goto(url, {
        waitUntil: options.waitUntil ?? 'networkidle',
      });
    },

    async screenshot(options = {}) {
      const { dir, identifier } = deriveSnapshotPath(snapshotsBase);
      const image = await page.screenshot({ fullPage: true });
      expect(image).toMatchImageSnapshot({
        customSnapshotsDir: dir,
        customSnapshotIdentifier: options.name ?? identifier,
        customDiffDir: path.join(snapdiffBase, path.basename(dir)),
        failureThreshold: options.threshold ?? globalConfig.pixelDiffThreshold ?? 0.01,
        failureThresholdType: options.thresholdType ?? globalConfig.failureThresholdType ?? 'percent',
      });
    },

    async click(selector) {
      await page.click(selector);
    },

    async waitFor(selector, timeout) {
      await page.waitForSelector(selector, timeout ? { timeout } : undefined);
    },

    async pause(ms) {
      await page.waitForTimeout(ms);
    },

    async waitForResponse(urlPattern) {
      await page.waitForResponse(urlPattern);
    },

    async waitForNetworkIdle(timeout) {
      await page.waitForLoadState('networkidle', timeout ? { timeout } : undefined);
    },

    async type(selector, text) {
      await page.fill(selector, text);
    },
  };
}
