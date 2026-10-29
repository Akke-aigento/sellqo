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
  cacheDir: '/tmp/harness-vite-cache',
  logLevel: 'warn',
});
