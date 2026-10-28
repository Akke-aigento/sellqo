#!/usr/bin/env node
// CI-LOCAL-1 — draai de stappen van .github/workflows/ci.yml lokaal, vóór een push.
//
// Aanleiding (REKENING-ONLINE-1, 28-10-2026): de push brak in CI op "Meldingsbronnen",
// een node-check die lokaal niet gedraaid was. Dit script leest de stappen uit ci.yml
// zelf (geen eigen lijst die kan verouderen) en voert ze na elkaar uit.
//
// Gebruik:
//   npm run ci:local            snelle checks (node-scripts, vitest, deno als die er is)
//   npm run ci:local -- --full  ook tsc (5–10 min) en de productiebuild
//
// Overgeslagen: setup/installatie. Deno-stappen draaien met `deno` uit PATH of $DENO_BIN;
// zonder deno worden ze gemeld als overgeslagen (niet als groen).

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const full = process.argv.includes('--full');
const yml = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

// Stappen = "- name: X" gevolgd door "run: cmd" of "run: |" met een ingesprongen blok.
const steps = [];
const lines = yml.split('\n');
let cur = null;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const name = l.match(/^\s*- name:\s*(.+)$/);
  if (name) { cur = { name: name[1].trim(), env: {} }; steps.push(cur); continue; }
  if (!cur) continue;
  const env = l.match(/^\s{10,}([A-Z_]+):\s*"?([^"]*)"?\s*$/);
  if (env && !cur.run) { cur.env[env[1]] = env[2]; continue; }
  const run = l.match(/^(\s*)run:\s*(.*)$/);
  if (!run) continue;
  if (run[2].trim() === '|') {
    const indent = run[1].length + 2;
    const block = [];
    while (i + 1 < lines.length && (lines[i + 1].trim() === '' || lines[i + 1].search(/\S/) >= indent)) {
      i++;
      if (lines[i].trim()) block.push(lines[i].slice(indent));
    }
    cur.run = block.join('\n');
  } else {
    cur.run = run[2].trim();
  }
}

const denoBin = process.env.DENO_BIN || (spawnSync('sh', ['-c', 'command -v deno']).stdout.toString().trim() || null);
const results = [];
for (const s of steps.filter(x => x.run)) {
  let cmd = s.run;
  if (/^(bun|npm|pnpm) (install|ci)\b/.test(cmd)) continue;
  if (!full && (/\btsc\b/.test(cmd) || /npm run build/.test(cmd))) { results.push([s.name, 'skip (--full)']); continue; }
  if (/\bdeno\b/.test(cmd)) {
    if (!denoBin) { results.push([s.name, 'skip (geen deno)']); continue; }
    cmd = cmd.replace(/(^|\s|\n)deno /g, `$1${denoBin} `);
  }
  process.stdout.write(`\n▶ ${s.name}\n`);
  const r = spawnSync('bash', ['-e', '-c', cmd], { stdio: 'inherit', env: { ...process.env, ...s.env } });
  results.push([s.name, r.status === 0 ? 'ok' : `FAIL (exit ${r.status})`]);
}

console.log('\n── ci:local ──');
for (const [n, r] of results) console.log(`${r.startsWith('FAIL') ? '✗' : r === 'ok' ? '✓' : '·'} ${n}: ${r}`);
process.exit(results.some(([, r]) => r.startsWith('FAIL')) ? 1 : 0);
