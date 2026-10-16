#!/usr/bin/env node
/**
 * Skill-pariteitscontrole: `.claude/skills/` tegen de spiegel in `.agents/skills/`.
 *
 * Run: `node scripts/verify-skills-sync.mjs`
 *      `node scripts/verify-skills-sync.mjs --manifest`   (JSON met sha256 per skill)
 *      `node scripts/verify-skills-sync.mjs --compare <bestand.json>`   (workspace-vergelijking)
 *      `node scripts/verify-skills-sync.mjs --compare -`   (zelfde, JSON via stdin)
 *
 * Werkwijze workspace-vergelijking (`--compare`, sinds 16 okt 2026):
 *   1. Een sessie mét Lovable-connector roept
 *      `list_workspace_skills({ workspace_id: '8fa9AQcZxxoglV7BaRsZ' })` aan
 *      (include_markdown is niet nodig: de output bevat per skill `sizeBytes`).
 *   2. Bewaar die JSON-output in een bestand (bv. in de scratchpad) of plak hem via stdin.
 *   3. `node scripts/verify-skills-sync.mjs --compare <bestand>` legt de bytegrootte
 *      van elke workspace-SKILL.md naast die in `.claude/skills/`.
 *   Exit 1 als een repo-skill in de workspace ontbreekt of een andere grootte heeft.
 *   Workspace-skills die niet in de repo staan, geven alleen een melding; de
 *   bewuste uitzondering `nomadix-mobiel` (workspace-breed) wordt stil overgeslagen.
 *   Verschil gevonden: de repo wint, dus `update_workspace_skill` (of
 *   `create_workspace_skill`) met de exacte inhoud van `.claude/skills/<naam>/SKILL.md`.
 *   Let op: gelijke grootte is sterk bewijs, geen sha256. Na een push lees je de
 *   skill dus ook terug (de connector echoot de opgeslagen inhoud).
 *   Geaccepteerde invoer: de volledige list_workspace_skills-output
 *   (`{ skills: [{ name, files: [{ name: 'SKILL.md', sizeBytes }] }] }`), een array
 *   daarvan, of een platte map `{ "<naam>": <bytes> }`.
 *
 * Waarom dit bestaat: dezelfde skill leeft op drie plekken — `.claude/skills/`
 * (de bron), `.agents/skills/` (de spiegel in deze repo) en de workspace-skill
 * aan de Lovable-kant. Niets houdt ze gelijk. Op 10 september 2026 bleek bij het
 * bijwerken van twee skills dat ze al waren gaan afwijken, en bij
 * `sellqo-i18n-verplicht` was het ernstig: de workspace-kopie was 6.296 bytes
 * tegen 11.689 in de repo en miste de complete codemod-motor. Een agent die aan
 * die kant op de skill leunde, kreeg een halve werkwijze zonder dat iets dat
 * meldde.
 *
 * Wat deze check WEL doet: `.claude/skills/` en `.agents/skills/` byte-voor-byte
 * vergelijken. Dat is puur lokaal en draait dus in CI.
 *
 * Wat hij NIET kan: de workspace-kopie ophalen. Die leeft achter de
 * Lovable-connector (een MCP-tool), en een GitHub-runner heeft die niet. Daarom
 * `--manifest`: dat print de sha256 per skill, zodat een sessie mét connector in
 * één stap kan vergelijken met `list_workspace_skills({ include_markdown: true })`.
 * Zie de werkwijze onderaan dit bestand.
 *
 * Exit 0 bij pariteit, exit 1 bij enig verschil.
 *
 * Geen dependencies.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, '.claude', 'skills');
const MIRROR = join(ROOT, '.agents', 'skills');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
};

const manifestMode = process.argv.includes('--manifest');
const compareIdx = process.argv.indexOf('--compare');
const compareArg = compareIdx === -1 ? null : process.argv[compareIdx + 1];

// Bestaan bewust alleen in de workspace; horen niet in deze repo.
const WORKSPACE_ONLY = new Set(['nomadix-mobiel']);

function skillDirs(base) {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(base, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const source = skillDirs(SOURCE);
const mirror = skillDirs(MIRROR);

if (source.length === 0) {
  console.error(`${c.red}Geen skills gevonden in .claude/skills/.${c.reset} Klopt het pad nog?\n`);
  process.exit(1);
}

// --- manifest-modus: alleen de hashes, voor vergelijking met de workspace ----
if (manifestMode) {
  const manifest = {};
  for (const name of source) manifest[name] = sha256(join(SOURCE, name, 'SKILL.md'));
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

// --- compare-modus: workspace-groottes (list_workspace_skills) tegen de repo --
function workspaceSizes(raw) {
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : Array.isArray(data?.skills) ? data.skills : null;
  const sizes = {};
  if (list) {
    for (const s of list) {
      const file = (s.files || []).find((f) => f.name === 'SKILL.md');
      if (typeof s.markdown === 'string') sizes[s.name] = Buffer.byteLength(s.markdown, 'utf8');
      else if (file && typeof file.sizeBytes === 'number') sizes[s.name] = file.sizeBytes;
      else sizes[s.name] = null;
    }
    return sizes;
  }
  if (data && typeof data === 'object') {
    for (const [name, v] of Object.entries(data)) sizes[name] = typeof v === 'number' ? v : null;
    return sizes;
  }
  throw new Error('onbekend JSON-formaat');
}

if (compareIdx !== -1) {
  if (!compareArg) {
    console.error(`${c.red}--compare verwacht een bestand of '-' (stdin).${c.reset}\n`);
    process.exit(1);
  }
  let ws;
  try {
    ws = workspaceSizes(readFileSync(compareArg === '-' ? 0 : compareArg, 'utf8'));
  } catch (e) {
    console.error(`${c.red}Kan de workspace-JSON niet lezen:${c.reset} ${e.message}\n`);
    process.exit(1);
  }
  const diffs = [];
  console.log('');
  console.log(`${c.bold}Workspace-vergelijking${c.reset} ${c.dim}— ${source.length} repo-skills${c.reset}`);
  for (const name of source) {
    const repoSize = readFileSync(join(SOURCE, name, 'SKILL.md')).length;
    if (!(name in ws)) {
      diffs.push(name);
      console.log(`  ${c.red}✗${c.reset} ${c.bold}${name}${c.reset} ontbreekt in de workspace ${c.dim}(repo ${repoSize} bytes)${c.reset}`);
    } else if (ws[name] !== repoSize) {
      diffs.push(name);
      console.log(`  ${c.red}✗${c.reset} ${c.bold}${name}${c.reset} verschilt ${c.dim}(repo ${repoSize}, workspace ${ws[name]} bytes)${c.reset}`);
    } else {
      console.log(`  ${c.green}✓${c.reset} ${name} ${c.dim}(${repoSize} bytes)${c.reset}`);
    }
  }
  for (const name of Object.keys(ws).sort()) {
    if (source.includes(name) || WORKSPACE_ONLY.has(name)) continue;
    console.log(`  ${c.yellow}!${c.reset} ${c.bold}${name}${c.reset} staat alleen in de workspace ${c.dim}(niet in de repo)${c.reset}`);
  }
  console.log('');
  if (diffs.length > 0) {
    console.log(`${c.red}${c.bold}${diffs.length} verschil(len).${c.reset} ${c.dim}De repo wint: update_workspace_skill / create_workspace_skill met de repo-inhoud.${c.reset}\n`);
    process.exit(1);
  }
  console.log(`${c.green}${c.bold}Workspace en repo lopen gelijk (0 verschillen).${c.reset}\n`);
  process.exit(0);
}

const problems = [];

for (const name of source) {
  if (!mirror.includes(name)) {
    problems.push(`${c.bold}${name}${c.reset} staat in .claude/skills maar niet in .agents/skills`);
    continue;
  }
  const a = join(SOURCE, name, 'SKILL.md');
  const b = join(MIRROR, name, 'SKILL.md');
  if (sha256(a) !== sha256(b)) {
    const sizeA = readFileSync(a).length;
    const sizeB = readFileSync(b).length;
    problems.push(
      `${c.bold}${name}${c.reset} verschilt ${c.dim}(bron ${sizeA} bytes, spiegel ${sizeB} bytes)${c.reset}`
    );
  }
}

for (const name of mirror) {
  if (!source.includes(name)) {
    problems.push(`${c.bold}${name}${c.reset} staat in .agents/skills maar niet in .claude/skills`);
  }
}

console.log('');
console.log(
  `${c.bold}Skill-pariteit${c.reset} ${c.dim}— ${source.length} ${
    source.length === 1 ? 'skill' : 'skills'
  } in .claude/skills${c.reset}`
);

if (problems.length > 0) {
  console.log('');
  for (const p of problems) console.log(`  ${c.red}✗${c.reset} ${p}`);
  console.log('');
  console.log(
    `${c.red}${c.bold}De spiegel loopt uit de pas.${c.reset} ${c.dim}.claude/skills is de bron — kopieer die kant op:${c.reset}`
  );
  console.log(`${c.dim}  cp .claude/skills/<naam>/SKILL.md .agents/skills/<naam>/SKILL.md${c.reset}\n`);
  process.exit(1);
}

console.log(`${c.green}${c.bold}Bron en spiegel zijn identiek.${c.reset}\n`);
console.log(
  `${c.yellow}Niet gecontroleerd:${c.reset} de workspace-kopieën aan de Lovable-kant.\n` +
  `${c.dim}Een sessie met connector doet dat zo:\n` +
  `  1. list_workspace_skills({ workspace_id }) en de JSON bewaren in een bestand\n` +
  `  2. node scripts/verify-skills-sync.mjs --compare <bestand>\n` +
  `  Verschilt er een: de repo wint, dus update_workspace_skill met de repo-inhoud.${c.reset}\n`
);
process.exit(0);
