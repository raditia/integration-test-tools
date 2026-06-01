# integration-test-tools

Installable npm package providing visual regression testing infrastructure and coverage utilities for Jest-based projects.

## Features

- Jest preset that wires [`jest-image-snapshot`](https://github.com/americanexpress/jest-image-snapshot) with zero boilerplate
- Configurable pixel diff threshold, snapshot directory, and failure type
- CLI to merge Istanbul JSON coverage reports from multiple packages into one combined report
- Designed to pair with [`playwright-docker`](https://github.com/raditia/playwright-docker) for consistent CI rendering

## Install

```bash
pnpm add -D integration-test-tools
```

## Setup

Run once after installing:

```bash
npx ittools init
```

This checks your project root and creates any missing pieces:

| File | Purpose |
|------|---------|
| `integration-test-tools.config.js` | All config in one place |
| `jest.visual.config.js` | Jest config that reads from the above |

And adds these scripts to `package.json`:

```json
{
  "integration-test:base": "ittools run",
  "integration-test:updateSnapshot": "ittools run --updateSnapshot"
}
```

Safe to re-run — skips anything that already exists.

### Config reference (`integration-test-tools.config.js`)

```js
/** @type {import('integration-test-tools').IttoolsConfig} */
module.exports = {
  headless: true,                              // false = open browser window
  retries: 0,                                  // retry count per failed test
  testMatch: ['**/*.visual.test.ts'],          // glob patterns to include
  testPathIgnorePatterns: ['**/node_modules/**'], // glob patterns to ignore
  pixelDiffThreshold: 0.01,                   // 1% pixel diff allowed
  failureThresholdType: 'percent',             // 'percent' | 'pixel'
  snapshotDir: 'snapshots',                    // baseline PNG root dir
  baseUrl: 'http://localhost:2900',            // app server base URL
  coverageReports: [],                         // paths for merge-coverage CLI
};
```

## Writing visual tests

Tests are organized in `describe` blocks. The page loads once in `beforeAll` and **state persists** across all tests — each test continues from where the last left off, mirroring real user behavior.

```ts
// test/test-suites-1/BusSearchFilter.visual.test.ts
import { setupVisualTest } from 'integration-test-tools';

describe('Bus Search - Filter', () => {
  const { page, baseUrl, screenshot } = setupVisualTest();

  beforeAll(async () => {
    await page.goto(`${baseUrl}/en-us/bus-and-shuttle/search?from=CGK&to=SBY&date=2026-06-01`);
    await page.waitForLoadState('networkidle');
  });

  it('shows initial results', async () => {
    await screenshot();
    // → snapshots/test-suites-1/bus-search-filter--shows-initial-results.png
  });

  it('opens filter popup on click', async () => {
    await page.click('[data-testid="filter-btn"]');
    await screenshot();
    // → snapshots/test-suites-1/bus-search-filter--opens-filter-popup-on-click.png
  });

  it('shows AC filtered results', async () => {
    await page.waitForSelector('[data-testid="filter-ac"]');
    await page.click('[data-testid="filter-ac"]');
    await page.click('[data-testid="apply-filter"]');
    await page.waitForResponse('**/search**');
    await screenshot();
    // → snapshots/test-suites-1/bus-search-filter--shows-ac-filtered-results.png
  });
});
```

`screenshot()` auto-derives the snapshot name from the test file directory + describe/test names. No `expect()` needed in test body.

### Snapshot naming

Given test at `test/test-suites-1/BusSearchFilter.visual.test.ts`:

```
describe('Bus Search - Filter')
  it('opens filter popup on click')
  
→ snapshots/test-suites-1/bus-search-filter--opens-filter-popup-on-click.png
```

Pattern: `{snapshotDir}/{suite-folder-name}/{describe-name}--{test-name}.png`

### Override snapshot name

```ts
await screenshot({ name: 'my-custom-name' });
```

### Headed mode (debug)

By default Chromium runs headless. Set `ITTOOLS_HEADLESS=false` to open a visible browser window. Optionally slow down actions with `ITTOOLS_SLOW_MO` (milliseconds between actions).

```bash
# run with visible browser, 500ms between actions
ITTOOLS_HEADLESS=false ITTOOLS_SLOW_MO=500 pnpm test:visual
```

**Without Docker (local machine)** — works out of the box on macOS and Windows.

**With Docker** — the container has no display. You need an X11 server on the host and forward the display into the container.

#### macOS — XQuartz

1. Install: `brew install --cask xquartz` then log out and back in
2. Open XQuartz → Preferences → Security → check **Allow connections from network clients**
3. In a terminal: `xhost +` *(allows any host — fine for local dev)*
4. Run Docker with display forwarded:

```bash
docker run --rm \
  -e DISPLAY=host.docker.internal:0 \
  -e ITTOOLS_HEADLESS=false \
  -e ITTOOLS_BASE_HOST=host.docker.internal \
  ghcr.io/raditia/playwright-docker:latest \
  pnpm integration-test:base
```

> **Security note:** `xhost +` removes all X access controls. Any process on your local network can connect to your display. Revert after testing with `xhost -`.

#### Windows — MobaXterm

1. Install [MobaXterm](https://mobaxterm.mobatek.net) — X server starts automatically
2. In MobaXterm: Settings → X11 → set **X11 remote access** to `full`
3. Run Docker with display forwarded:

```bash
docker run --rm \
  -e DISPLAY=host.docker.internal:0.0 \
  -e ITTOOLS_HEADLESS=false \
  -e ITTOOLS_BASE_HOST=host.docker.internal \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/raditia/playwright-docker:latest \
  pnpm integration-test:base
```

> **Security note:** Setting X11 remote access to `full` in MobaXterm allows any host. Revert to `warn` or `rejected` after testing.

> CI always runs headless — `ITTOOLS_HEADLESS` is not set in CI workflows.

### Base URL resolution

`baseUrl` is resolved in this priority order:

1. `setupVisualTest({ baseUrl: '...' })` — inline override
2. `ittoolsConfig.baseUrl` in jest.config.js
3. `ITTOOLS_BASE_URL` env var — full URL override (e.g. staging environment)
4. `ITTOOLS_BASE_HOST` + `ITTOOLS_BASE_PORT` — composed: `http://${host}:${port}`
5. Default: `http://localhost:2900`

**Running tests inside Docker locally** — `localhost` inside the container points to the container, not the host. Use `host.docker.internal` instead:

```bash
# macOS / Windows Docker Desktop
docker run --rm \
  -e ITTOOLS_BASE_HOST=host.docker.internal \
  ghcr.io/raditia/playwright-docker:latest \
  pnpm test:visual

# Linux — host.docker.internal not automatic, requires --add-host flag
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e ITTOOLS_BASE_HOST=host.docker.internal \
  ghcr.io/raditia/playwright-docker:latest \
  pnpm test:visual
```

**CI (GitHub Actions `container:`)** — app server runs in the same container, `localhost` works. No env override needed.

### What `setupVisualTest()` returns

| Property | Type | Description |
|----------|------|-------------|
| `page` | `Page` | Full [Playwright Page](https://playwright.dev/docs/api/class-page) object. Use Playwright API directly. Available after `beforeAll`. |
| `baseUrl` | `string` | Resolved base URL — compose full URLs: `` `${baseUrl}/your/path` `` |
| `screenshot` | `(options?) => Promise<void>` | Capture current page, auto-name from test path, compare against baseline |

All interactions (`click`, `waitForSelector`, `waitForLoadState`, `keyboard`, `locator`, etc.) use `page` directly — no wrappers.

### Snapshot folder structure

```
test/
  snapshots/          ← baselines (committed to git via LFS)
    test-suites-1/
      bus-search-filter--shows-initial-results.png
  snapdiff/           ← pixel diffs on failure (gitignored, for local review)
    test-suites-1/
      bus-search-filter--shows-initial-results.png
```

`snapdiff/` is auto-derived as a sibling of `snapshots/`. Add it to `.gitignore` — it's for local diff review only, not committed.

### Updating baselines

When a snapshot differs from the baseline, the test fails and the diff image is written to `snapdiff/`. Two ways to update:

**Option 1 — delete and regenerate a single baseline:**
```bash
rm test/snapshots/test-suites-1/bus-search-filter--shows-initial-results.png
jest --testPathPattern="BusSearchFilter"
```

**Option 2 — update all changed snapshots at once:**
```bash
jest --updateSnapshot --testPathPattern="\.visual\.test"
```

**Via CLI helper (prints the command with hints):**
```bash
npx ittools update-snapshots
# or for a specific suite:
npx ittools update-snapshots "test-suites-1"
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
| `snapshotDir` | `string` | `'snapshots'` | Root dir for baseline PNGs |
| `coverageReports` | `string[]` | `[]` | Paths to Istanbul JSON files for merge |
| `baseUrl` | `string` | `'http://localhost:2900'` | Base URL for `setupVisualTest()` |

## Git LFS

Baseline PNGs can grow fast. Track them with Git LFS before committing the first snapshot:

```bash
git lfs install
git lfs track "**/snapshots/**/*.png"
git add .gitattributes
```

## CI example

```yaml
jobs:
  visual-regression:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/raditia/playwright-docker:latest
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
          path: '**/snapdiff/**'
```
