import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { IttoolsConfig } from './config';

export interface ScreenshotOptions {
  fullPage?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  viewport?: { width: number; height: number };
  beforeScreenshot?: (page: Page) => Promise<void>;
}

export interface VisualTestHelpers {
  screenshot: (path: string, options?: ScreenshotOptions) => Promise<Buffer>;
}

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
      beforeScreenshot,
    } = options;

    const page = await browser.newPage({ viewport });
    try {
      await page.goto(`${baseUrl}${path}`, { waitUntil });
      if (beforeScreenshot) await beforeScreenshot(page);
      return await page.screenshot({ fullPage });
    } finally {
      await page.close();
    }
  }

  return { screenshot };
}
