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

`setupVisualTest()` handles browser launch/teardown — no boilerplate per file.

```ts
// MyPage.visual.test.ts
import { setupVisualTest } from 'integration-test-tools';

const { screenshot } = setupVisualTest();

it('renders bus search result page', async () => {
  const image = await screenshot('/en-us/bus-and-shuttle/search?from=CGK&to=SBY&date=2026-06-01');
  expect(image).toMatchImageSnapshot();
});

it('renders train search result page', async () => {
  const image = await screenshot('/en-us/kereta-api/search?from=GMR&to=BD&date=2026-06-01');
  expect(image).toMatchImageSnapshot();
});
```

`baseUrl` defaults to `http://localhost:2900` (from `ittoolsConfig.baseUrl` in jest.config.js). Pass a path — the helper prepends the base.

### Override base URL per file

```ts
const { screenshot } = setupVisualTest({ baseUrl: 'http://localhost:3000' });
```

### Interact before screenshot

Use the `steps` array with built-in action helpers — no `page` exposure needed:

```ts
import { setupVisualTest, waitFor, click, pause, waitForResponse } from 'integration-test-tools';

const { screenshot } = setupVisualTest();

it('renders with AC filter applied', async () => {
  const image = await screenshot('/en-us/bus-and-shuttle/search', {
    steps: [
      waitFor('[data-testid="filter-ac"]'),
      click('[data-testid="filter-ac"]'),
      waitForResponse('**/search**'),
      pause(300),
    ],
  });
  expect(image).toMatchImageSnapshot();
});
```

| Helper | Signature | Description |
|--------|-----------|-------------|
| `waitFor` | `(selector, timeout?)` | Wait for element to appear in DOM |
| `click` | `(selector)` | Click element |
| `pause` | `(ms)` | Wait fixed milliseconds |
| `waitForResponse` | `(urlPattern)` | Wait for network response matching string or RegExp |

For interactions beyond these, use the `beforeScreenshot` escape hatch:

```ts
it('...', async () => {
  const image = await screenshot('/path', {
    beforeScreenshot: async (page) => {
      // full Playwright Page API available here
    },
  });
});
```

### Screenshot options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fullPage` | `boolean` | `true` | Capture full scrollable page |
| `waitUntil` | `'load' \| 'domcontentloaded' \| 'networkidle'` | `'networkidle'` | Navigation wait condition |
| `viewport` | `{ width, height }` | `{ width: 1280, height: 900 }` | Browser viewport |
| `beforeScreenshot` | `(page: Page) => Promise<void>` | — | Hook to interact before capture |

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
| `baseUrl` | `string` | `'http://localhost:2900'` | Base URL for `setupVisualTest()` |

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
