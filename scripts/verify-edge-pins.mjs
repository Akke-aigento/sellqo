#!/usr/bin/env node
// EDGE-PIN-1 — guard op vaste versies van supabase-js in de edge functions.
//
// Op 15-10-2026 faalde élke edge-deploy: `https://esm.sh/@supabase/supabase-js@2`
// resolvede naar een verse release (2.118.0) die esm.sh nog niet volledig gebouwd
// had ("Module not found auth-js@2.118.0"). Een import zonder volledige x.y.z-versie
// laat de deploy afhangen van wat esm.sh op dat moment toevallig serveert.
//
// Regel: elke supabase-js-import onder supabase/functions (esm.sh, npm:, jsr:, cdn)
// heeft een volledige x.y.z-versie. Anders exit 1.
//
// Daarnaast een lijst (geen fout) van andere remote imports (esm.sh, npm:, jsr:,
// deno.land) zonder volledige x.y.z-versie: kandidaten om later ook te pinnen.
//
// Draait in CI (.github/workflows/ci.yml) en lokaal met `npm run check:edge-pins`.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'supabase/functions';
const EXT = /\.(ts|tsx|js|jsx|mjs|json)$/;
// Alle string-literals; daarna filteren op remote specifiers.
const STRING = /(['"`])((?:https?:\/\/|npm:|jsr:)[^'"`\s]+)\1/g;
const FULL = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walk(p);
    } else if (EXT.test(entry.name)) {
      yield p;
    }
  }
}

// Haalt { name, version } uit een specifier, of null als het geen pakket-import is.
function parse(spec) {
  let rest;
  if (spec.startsWith('npm:') || spec.startsWith('jsr:')) {
    rest = spec.slice(4);
  } else {
    const m = spec.match(/^https?:\/\/(esm\.sh|cdn\.jsdelivr\.net\/npm|cdn\.skypack\.dev|unpkg\.com|deno\.land\/x|deno\.land)\/(.*)$/);
    if (!m) return null;
    rest = m[2];
  }
  rest = rest.replace(/^\/+/, '').split('?')[0];
  // @scope/naam@versie/pad  of  naam@versie/pad
  const m = rest.match(/^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]*))?/);
  if (!m) return null;
  return { name: m[1], version: m[2] ?? '' };
}

const errors = [];
const warnings = [];
const pinned = new Map();

for (const file of walk(ROOT)) {
  const rel = file.split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    for (const match of line.matchAll(STRING)) {
      const spec = match[2];
      const isSupabase = spec.includes('@supabase/supabase-js');
      const pkg = parse(spec);
      if (!pkg) continue;
      // Alleen echte imports tellen; URL's als data (bv. api-endpoints) negeren.
      const isImport = /\bfrom\s*$|\bimport\s*\(?\s*$|^\s*"[^"]+"\s*:\s*$/.test(line.slice(0, match.index)) ||
        /^\s*import\s/.test(line) || rel.endsWith('.json');
      if (!isImport && !isSupabase) continue;
      const ok = FULL.test(pkg.version);
      if (isSupabase) {
        if (ok) pinned.set(pkg.version, (pinned.get(pkg.version) ?? 0) + 1);
        else errors.push(`${rel}:${i + 1}  ${spec}`);
      } else if (!ok) {
        warnings.push(`${rel}:${i + 1}  ${spec}`);
      }
    }
  });
}

if (warnings.length > 0) {
  console.warn(`\x1b[33m\x1b[1mverify-edge-pins\x1b[0m — ${warnings.length} andere remote import(s) zonder volledige x.y.z-versie (geen fout, wel pinnen):\n`);
  for (const w of warnings) console.warn(`  ${w}`);
  console.warn('');
}

if (errors.length > 0) {
  console.error(`\x1b[31m\x1b[1mverify-edge-pins\x1b[0m — ${errors.length} supabase-js-import(s) zonder volledige x.y.z-versie:\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('\nPin op een vaste versie (bv. https://esm.sh/@supabase/supabase-js@2.57.2). Zie EDGE-PIN-1 in docs/role-audit.md.');
  process.exit(1);
}

const summary = [...pinned.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} (${n})`).join(', ');
console.log(`\x1b[32m\x1b[1mverify-edge-pins\x1b[0m — alle supabase-js-imports gepind: ${summary}.`);
