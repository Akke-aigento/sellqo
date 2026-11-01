// Harnas — zie scripts/harness/README.md. Het scenario komt uit HARNESS_SCENARIO.
import { defineConfig, type Alias } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'node:fs';
import path from 'node:path';

const scenario = process.env.HARNESS_SCENARIO ?? '';
const dir = path.resolve(__dirname, 'scenarios', scenario);
if (!scenario || !fs.existsSync(dir)) throw new Error(`Onbekend scenario: "${scenario}"`);

const raw = JSON.parse(fs.readFileSync(path.join(dir, 'aliases.json'), 'utf8')) as Record<string, string>;
const aliases: Alias[] = Object.entries(raw).map(([find, file]) => ({
  find: find.length > 2 && find.startsWith('/') && find.endsWith('/') ? new RegExp(find.slice(1, -1)) : find,
  replacement: path.join(dir, file),
}));

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: [
    { find: 'harness-scenario', replacement: path.join(dir, 'main.tsx') },
    ...aliases,
    { find: '@', replacement: path.resolve(__dirname, '../../src') },
  ] },
  server: { port: Number(process.env.HARNESS_PORT ?? 5199), strictPort: true },
  // Eigen cache per worktree mogelijk (HARNESS_CACHE_DIR): parallelle runs in andere worktrees
  // her-optimaliseren anders elkaars deps ("Failed to fetch dynamically imported module").
  cacheDir: process.env.HARNESS_CACHE_DIR ?? '/tmp/harness-vite-cache',
  logLevel: 'warn',
});
