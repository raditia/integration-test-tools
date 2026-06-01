import { createCoverageMap } from 'istanbul-lib-coverage';
import { createContext } from 'istanbul-lib-report';
import { create } from 'istanbul-reports';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

type ReportType = 'lcov' | 'html' | 'text-summary' | 'json';

export async function mergeCoverage(
  inputs: string[],
  outputDir = 'coverage-merged',
  formats: ReportType[] = ['lcov', 'html', 'text-summary']
): Promise<void> {
  const map = createCoverageMap({});

  for (const input of inputs) {
    const filePath = resolve(input);
    if (!existsSync(filePath)) {
      console.warn(`[ittools] Coverage file not found, skipping: ${filePath}`);
      continue;
    }
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    map.merge(data);
  }

  const context = createContext({ coverageMap: map, dir: outputDir });

  for (const format of formats) {
    const report = create(format);
    report.execute(context);
  }

  console.log(`[ittools] Coverage merged → ${outputDir}/`);
}
