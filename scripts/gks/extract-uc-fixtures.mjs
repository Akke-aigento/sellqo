#!/usr/bin/env node
// KASSA-0 — zet de officiële GKS 2.0 use cases (FOD Financiën, POS documentation NL/ENG zip,
// map 20260821_tests) om naar testfixtures: één JSON per use case met per stap de GraphQL-
// query, de variabelen en het officiële FDM-antwoord.
//
// Gebruik: node scripts/gks/extract-uc-fixtures.mjs <map met 20260821_tests van NL> [<ENG 20260821_tests>]
// Uitvoer: src/kassa/fiscal/__tests__/uc/fixtures/<set>/<uc>.json
// De bron-zips en PDF's horen NIET in git (docs/gks/source/ staat in .gitignore).
import fs from 'node:fs';
import path from 'node:path';

const [, , nlRoot, engRoot] = process.argv;
if (!nlRoot) { console.error('gebruik: extract-uc-fixtures.mjs <NL 20260821_tests> [<ENG 20260821_tests>]'); process.exit(1); }
const OUT = path.resolve('src/kassa/fiscal/__tests__/uc/fixtures');

const readText = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
const readJson = (f) => { const t = readText(f); try { return JSON.parse(t); } catch (e) { return { __parseError: String(e), __raw: t }; } };
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const ls = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => natural(a.name, b.name));

function stepFrom(dir) {
  const files = ls(dir).filter((e) => e.isFile()).map((e) => e.name);
  const q = files.find((f) => f.endsWith('.graphql'));
  if (!q) return null;
  const varsFile = files.find((f) => /GQL-Variables\.json$/i.test(f));
  const reqFile = files.find((f) => /_Request\.json$/i.test(f));
  const respFile = files.find((f) => /esponse.*\.json$/i.test(f));
  let variables = varsFile ? readJson(path.join(dir, varsFile)) : null;
  if (!variables && reqFile) variables = readJson(path.join(dir, reqFile)).variables ?? null;
  const scenario = files.filter((f) => /scenario.*\.txt$/i.test(f)).map((f) => readText(path.join(dir, f))).join('\n') || null;
  return {
    step: path.basename(dir),
    query: readText(path.join(dir, q)),
    variables,
    response: respFile ? readJson(path.join(dir, respFile)) : null,
    scenario,
  };
}

function collectSteps(dir) {
  const own = stepFrom(dir);
  if (own) return [own];
  return ls(dir).filter((e) => e.isDirectory()).flatMap((e) => collectSteps(path.join(dir, e.name)));
}

function scenarioOf(dir) {
  return ls(dir).filter((e) => e.isFile() && /scenario.*\.txt$/i.test(e.name)).map((e) => readText(path.join(dir, e.name))).join('\n') || null;
}

let count = 0;
function writeUc(set, uc, scenario, steps) {
  const dir = path.join(OUT, set);
  fs.mkdirSync(dir, { recursive: true });
  const safe = uc.replace(/[^A-Za-z0-9_.-]+/g, '_');
  fs.writeFileSync(path.join(dir, `${safe}.json`), JSON.stringify({ set, uc, scenario, steps }, null, 1) + '\n');
  count++;
}

function extractSet(root, setDir, setName, opts = {}) {
  const base = path.join(root, setDir);
  if (!fs.existsSync(base)) { console.warn('ontbreekt:', base); return; }
  if (opts.singleUc) {
    const steps = collectSteps(base);
    writeUc(setName, opts.singleUc, scenarioOf(base), steps);
    return;
  }
  for (const e of ls(base).filter((x) => x.isDirectory())) {
    const d = path.join(base, e.name);
    const steps = collectSteps(d);
    if (steps.length) writeUc(setName, e.name, scenarioOf(d), steps);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
extractSet(nlRoot, '20260821_UC_BasicSet_POS_FDM_1.8', 'basic');
extractSet(nlRoot, '20260821_UC_AdvancedSet_POS_FDM_1.6', 'advanced');
extractSet(nlRoot, '20260821_UC_Report', 'reports-nl', { singleUc: 'REPORTS_NL' });
if (engRoot) extractSet(engRoot, '20260821_UC_Reports_1.3', 'reports-eng', { singleUc: 'REPORTS_ENG' });
console.log(`${count} use cases → ${path.relative(process.cwd(), OUT)}`);
