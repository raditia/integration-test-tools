import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { IttoolsConfig } from './config';

// --- Step types ---

type WaitForSelectorStep = { type: 'waitForSelector'; selector: string; timeout?: number };
type ClickStep = { type: 'click'; selector: string };
type PauseStep = { type: 'pause'; ms: number };
type WaitForResponseStep = { type: 'waitForResponse'; urlPattern: string | RegExp };

export type Step = WaitForSelectorStep | ClickStep | PauseStep | WaitForResponseStep;

export const waitFor = (selector: string, timeout?: number): WaitForSelectorStep =>
  ({ type: 'waitForSelector', selector, timeout });

export const click = (selector: string): ClickStep =>
  ({ type: 'click', selector });

export const pause = (ms: number): PauseStep =>
  ({ type: 'pause', ms });

export const waitForResponse = (urlPattern: string | RegExp): WaitForResponseStep =>
  ({ type: 'waitForResponse', urlPattern });

async function runStep(page: Page, step: Step): Promise<void> {
  switch (step.type) {
    case 'waitForSelector':
      await page.waitForSelector(step.selector, step.timeout ? { timeout: step.timeout } : undefined);
      break;
    case 'click':
      await page.click(step.selector);
      break;
    case 'pause':
      await page.waitForTimeout(step.ms);
      break;
    case 'waitForResponse':
      await page.waitForResponse(step.urlPattern);
      break;
  }
}

// --- Screenshot options ---

export interface ScreenshotOptions {
  fullPage?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  viewport?: { width: number; height: number };
  steps?: Step[];
  /** Escape hatch for interactions not covered by steps. */
  beforeScreenshot?: (page: Page) => Promise<void>;
}

export interface VisualTestHelpers {
  screenshot: (path: string, options?: ScreenshotOptions) => Promise<Buffer>;
}

// --- Setup ---

export function setupVisualTest(overrides: { baseUrl?: string } = {}): VisualTestHelpers {
  let browser: Browser;

  const globalConfig: Partial<IttoolsConfig> =
    (global as Record<string, unknown>).ittoolsConfig as Partial<IttoolsConfig> ?? {};

  const baseUrl = overrides.baseUrl ?? globalConfig.baseUrl ?? 'http://localhost:2900';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  async function screenshot(path: string, options: ScreenshotOptions = {}): Promise<Buffer> {
    const {
      fullPage = true,
      waitUntil = 'networkidle',
      viewport = { width: 1280, height: 900 },
      steps = [],
      beforeScreenshot,
    } = options;

    const page = await browser.newPage({ viewport });
    try {
      await page.goto(`${baseUrl}${path}`, { waitUntil });
      for (const step of steps) await runStep(page, step);
      if (beforeScreenshot) await beforeScreenshot(page);
      return await page.screenshot({ fullPage });
    } finally {
      await page.close();
    }
  }

  return { screenshot };
}
