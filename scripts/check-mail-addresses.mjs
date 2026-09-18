#!/usr/bin/env node
// MAIL-SENDER-1 — grep-guard op mailadressen van sellqo.app.
//
// Op de root sellqo.app bestaat (na de Migadu-opruiming) alleen info@sellqo.app.
// Winkels versturen en ontvangen op <prefix>@mail.sellqo.app (Resend); auth-mail
// loopt via het domein auth.sellqo.app (Lovable Managed). Elk ander
// …@sellqo.app-adres in de code is een adres dat niet meer bestaat: mail die
// daarheen gaat verdwijnt, en een From daarop valt door DMARC.
//
// Toegestaan: info@sellqo.app, <iets>@mail.sellqo.app, en auth.sellqo.app als
// kaal domein (zonder local part). Draait in CI (.github/workflows/ci.yml) en
// lokaal met `npm run check:mail`.

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['supabase/functions', 'src'];
const SKIP = new Set(['src/integrations/supabase/types.ts']);
const EXT = /\.(ts|tsx|js|jsx|mjs|json|html|md)$/;
// Een local part direct gevolgd door @sellqo.app (dus niet @mail. of @auth.).
const ADDRESS = /[A-Za-z0-9._%+${}-]+@sellqo\.app\b/g;
const ALLOWED = new Set(['info@sellqo.app']);

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

const violations = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const rel = file.split(path.sep).join('/');
    if (SKIP.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const match of line.matchAll(ADDRESS)) {
        if (!ALLOWED.has(match[0].toLowerCase())) {
          violations.push(`${rel}:${i + 1}  ${match[0]}`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`\x1b[31m\x1b[1mcheck-mail-addresses\x1b[0m — ${violations.length} niet-toegestaan(e) @sellqo.app-adres(sen):\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nToegestaan: info@sellqo.app, <prefix>@mail.sellqo.app, en auth.sellqo.app als domein. Zie docs/email-architecture.md.');
  process.exit(1);
}
console.log('\x1b[32m\x1b[1mcheck-mail-addresses\x1b[0m — alleen toegestane sellqo.app-adressen.');
