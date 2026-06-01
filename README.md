# integration-test-tools

Installable npm package providing visual regression testing infrastructure and coverage utilities for Jest-based projects.

## Features

- Jest preset that wires [`jest-image-snapshot`](https://github.com/americanexpress/jest-image-snapshot) with zero boilerplate
- Configurable pixel diff threshold, snapshot directory, and failure type
- CLI to merge Istanbul JSON coverage reports from multiple packages into one combined report
- Designed to pair with [`playwright-chromium-image`](https://github.com/raditia/playwright-chromium-image) for consistent CI rendering

## Install

```bash
pnpm add -D integration-test-tools
```

## Setup

### 1. Jest config

```js
// jest.config.js
module.exports = {
  preset: 'integration-test-tools',
  globals: {
    ittoolsConfig: {
      pixelDiffThreshold: 0.01,       // 1% — default
      failureThresholdType: 'percent', // 'percent' | 'pixel'
      snapshotDir: '__image_snapshots__',
    },
  },
};
```

### 2. CLI config (for `merge-coverage`)

```js
// ittools.config.js
const { defineConfig } = require('integration-test-tools');

module.exports = defineConfig({
  pixelDiffThreshold: 0.01,
  coverageReports: [
    './packages/foo/coverage/coverage-final.json',
    './packages/bar/coverage/coverage-final.json',
  ],
});
```

## Writing visual tests

Tests use Playwright to screenshot a running app, then compare against a stored baseline PNG.

```ts
// MyPage.visual.test.ts
import { chromium } from 'playwright';

let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

it('renders search result page', async () => {
  const page = await browser.newPage();
  await page.goto('http://localhost:2900/en-us/bus-and-shuttle/search?from=CGK&to=SBY&date=2026-06-01');
  await page.waitForLoadState('networkidle');

  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot).toMatchImageSnapshot();
});
```

### Updating baselines

```bash
npx ittools update-snapshots
# prints the exact jest command to run
```

Or directly:

```bash
jest --updateSnapshot --testPathPattern="\.visual\.test"
```

## Coverage merge

Merge coverage reports from multiple packages after `jest --coverage`:

```bash
npx ittools merge-coverage \
  packages/foo/coverage/coverage-final.json \
  packages/bar/coverage/coverage-final.json
```

Output written to `coverage-merged/` with `lcov`, `html`, and `text-summary` formats.

Paths can also come from `ittools.config.js → coverageReports`:

```bash
npx ittools merge-coverage
```

## Config reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pixelDiffThreshold` | `number` | `0.01` | Max allowed diff (1% of pixels) |
| `failureThresholdType` | `'percent' \| 'pixel'` | `'percent'` | How threshold is measured |
| `snapshotDir` | `string` | `'__image_snapshots__'` | Where baseline PNGs are stored |
| `coverageReports` | `string[]` | `[]` | Paths to Istanbul JSON files for merge |

## Git LFS

Baseline PNGs can grow fast. Track them with Git LFS before committing the first snapshot:

```bash
git lfs install
git lfs track "**/__image_snapshots__/*.png"
git add .gitattributes
```

## CI example

```yaml
jobs:
  visual-regression:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/raditia/playwright-chromium-image:latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true             # pull LFS baseline PNGs
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @traveloka/webgtr-desktop dev &
      - run: npx wait-on http://localhost:2900
      - run: pnpm test:visual
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: snapshot-diffs
          path: '**/__image_snapshots__/__diff_output__'
```
