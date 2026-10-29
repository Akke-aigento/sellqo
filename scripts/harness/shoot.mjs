// Harnas — start vite voor één scenario en maakt screenshots op 390 en 1280 px. Zie README.md.
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [scenario, ...flags] = process.argv.slice(2);
if (!scenario) { console.error('Gebruik: node scripts/harness/shoot.mjs <scenario> [--serve]'); process.exit(2); }
process.env.HARNESS_SCENARIO = scenario;
const port = Number(process.env.HARNESS_PORT ?? 5199);

const server = await createServer({ configFile: path.join(here, 'vite.config.ts') });
await server.listen();
const url = `http://localhost:${port}/`;
if (flags.includes('--serve')) { console.log(`Harnas ${scenario} op ${url} (Ctrl+C om te stoppen)`); await new Promise(() => {}); }

const pwPath = process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright/index.mjs';
const { chromium } = await import(fs.existsSync(pwPath) ? pathToFileURL(pwPath).href : 'playwright');
const stepsFile = path.join(here, 'scenarios', scenario, 'steps.mjs');
const steps = fs.existsSync(stepsFile) ? await import(pathToFileURL(stepsFile).href) : {};
const out = '/tmp/harness'; fs.mkdirSync(out, { recursive: true });

const errors = []; const shots = [];
const browser = await chromium.launch();
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 } });
    page.on('pageerror', (e) => errors.push(`[${width}] ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width}] ${m.text()}`); });
    await page.addInitScript((setup) => { window.__harness = setup; }, steps.setup ?? {});
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const shot = async (name) => { const f = `${out}/${scenario}-${width}${name ? `-${name}` : ''}.png`; await page.screenshot({ path: f, fullPage: true }); shots.push(f); };
    await shot('');
    if (steps.run) await steps.run(page, { width, shot, log: (...a) => console.log(`[${width}]`, ...a) });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(shots.join('\n'));
if (errors.length) { console.error('Fouten:\n' + errors.join('\n')); process.exit(1); }
