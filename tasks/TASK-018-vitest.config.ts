// Local fallback for restricted Windows runners: no child process for TS transforms.
import { defineConfig } from 'vitest/config';
import ts from 'typescript';

export default defineConfig({
  root: 'server',
  resolve: { preserveSymlinks: true },
  esbuild: false,
  plugins: [{
    name: 'task-018-typescript',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) return;
      // Preserve runtime NODE_ENV changes without Vite's esbuild define pass.
      return ts.transpileModule(code.replaceAll('process.env.NODE_ENV', "process.env['NODE_ENV']"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText;
    },
  }],
  test: { pool: 'threads' },
});
