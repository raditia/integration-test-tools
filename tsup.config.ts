import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    setup: 'src/setup.ts',
    'setup-visual-test': 'src/setup-visual-test.ts',
    'bin/ittools': 'src/bin/ittools.ts',
    'merge-coverage': 'src/merge-coverage.ts',
  },
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'node18',
});
