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
}

export interface VisualTestHelpers {
  goto: (path: string, options?: GotoOptions) => Promise<void>;
  screenshot: (options?: ScreenshotOverride) => Promise<void>;
  click: (selector: string) => Promise<void>;
  waitFor: (selector: string, timeout?: number) => Promise<void>;
  pause: (ms: number) => Promise<void>;
  waitForResponse: (urlPattern: string | RegExp) => Promise<void>;
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

export function setupVisualTest(overrides: { baseUrl?: string } = {}): VisualTestHelpers {
  let browser: Browser;
  let page: Page;

  const globalConfig: Partial<IttoolsConfig> =
    (global as Record<string, unknown>).ittoolsConfig as Partial<IttoolsConfig> ?? {};

  const baseUrl = overrides.baseUrl ?? globalConfig.baseUrl ?? 'http://localhost:2900';
  const snapshotsBase = globalConfig.snapshotDir ?? 'snapshots';

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
    async goto(urlPath, options = {}) {
      await page.goto(`${baseUrl}${urlPath}`, {
        waitUntil: options.waitUntil ?? 'networkidle',
      });
    },

    async screenshot(options = {}) {
      const { dir, identifier } = deriveSnapshotPath(snapshotsBase);
      const image = await page.screenshot({ fullPage: true });
      expect(image).toMatchImageSnapshot({
        customSnapshotsDir: dir,
        customSnapshotIdentifier: options.name ?? identifier,
        customDiffDir: path.join(dir, '__diff__'),
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

    async type(selector, text) {
      await page.fill(selector, text);
    },
  };
}
