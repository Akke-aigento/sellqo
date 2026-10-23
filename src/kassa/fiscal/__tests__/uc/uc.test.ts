// KASSA-0 — de officiële GKS 2.0 use cases als geautomatiseerde tests (eisenmatrix FDM-01,
// FDM-09, TX-*, TBL-*, PAY-*, RPT-*). Zie harness.ts voor wat A/B/C/D precies toetsen.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFixtures } from './harness';
import { KNOWN } from './known';
import { keyOf, runUc, type StepResult } from './run';
import { scopeOf } from './scope';

const fixtures = loadFixtures();
const collected: StepResult[] = [];

describe('GKS 2.0 officiële use cases', () => {
  it('alle 4 sets zijn ingeladen', () => {
    const sets = new Set(fixtures.map((f) => f.set));
    expect([...sets].sort()).toEqual(['advanced', 'basic', 'reports-eng', 'reports-nl']);
    expect(fixtures.length).toBeGreaterThanOrEqual(80);
  });

  it.each(fixtures.map((f) => [`${f.set}/${f.uc}`, f] as const))('%s', async (_n, fx) => {
    const results = await runUc(fx);
    collected.push(...results);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const known = KNOWN[keyOf(r).replace(/\/(schema|rebuild|simulator|report)$/, '/$1')];
      if (known?.skip) continue;
      if (known) {
        expect(r.ok, `${keyOf(r)} zou moeten afwijken: ${known.reason}`).toBe(false);
        expect(r.diffs ?? [r.detail], keyOf(r)).toEqual(known.diffs);
        continue;
      }
      expect(r.ok, `${keyOf(r)} :: ${r.detail}`).toBe(true);
    }
  });

  it('elke bekende afwijking komt nog voor', () => {
    const keys = new Set(collected.map(keyOf));
    for (const k of Object.keys(KNOWN)) expect(keys.has(k), k).toBe(true);
  });

  it('dekkingsrapport (GKS_WRITE_COVERAGE=1 schrijft docs/gks/uc-coverage.md)', () => {
    if (process.env.GKS_WRITE_COVERAGE !== '1') return;
    const byUc = new Map<string, StepResult[]>();
    for (const r of collected) {
      const k = `${r.set}/${r.uc}`;
      byUc.set(k, [...(byUc.get(k) ?? []), r]);
    }
    const count = (c: string) => {
      const xs = collected.filter((r) => r.check === c);
      const strict = xs.filter((r) => r.ok).length;
      const withKnown = xs.filter((r) => r.ok || KNOWN[keyOf(r)]).length;
      return strict === withKnown ? `${strict}/${xs.length}` : `${strict}/${xs.length} exact, ${withKnown}/${xs.length} op gedocumenteerde afwijkingen in de officiële data na`;
    };
    const lines = [
      '# GKS 2.0 — dekking officiële use cases',
      '',
      'Gegenereerd door `GKS_WRITE_COVERAGE=1 npx vitest run src/kassa/fiscal/__tests__/uc` (KASSA-0).',
      'Bron: FOD Financiën, POS documentation NL/ENG, map 20260821_tests (BasicSet 1.8, AdvancedSet 1.6, Reports NL + ENG 1.3).',
      '',
      '**A** schema (officieel bericht valideert tegen ons schema) · **B** herbouw (onze builders maken hetzelfde bericht, afgeleide bedragen zelf berekend) · **C** simulator (eventlabel, operatie en btw gelijk aan het officiële FDM-antwoord; nooit handtekeningen) · **D** rapport (X/Z uit ons logboek gelijk aan het officiële rapport).',
      '',
      `Totaal: A ${count('schema')} · B ${count('rebuild')} · C ${count('simulator')} · D ${count('report')} `,
      '',
      '| Use case | Scope v1 | Stappen | A | B | C | D | Opmerking |',
      '|---|---|---|---|---|---|---|---|',
    ];
    for (const [k, rs] of byUc) {
      const c = (x: string) => {
        const xs = rs.filter((r) => r.check === x);
        if (!xs.length) return '–';
        const ok = xs.filter((r) => r.ok || KNOWN[keyOf(r)]).length;
        return ok === xs.length ? (xs.some((r) => KNOWN[keyOf(r)]) ? '✓*' : '✓') : `✗ ${ok}/${xs.length}`;
      };
      const notes = [...new Set(rs.filter((r) => KNOWN[keyOf(r)]).map((r) => KNOWN[keyOf(r)].reason))].join(' ');
      const uc = k.split('/')[1];
      lines.push(`| ${k} | ${scopeOf(uc)} | ${new Set(rs.map((r) => r.step)).size} | ${c('schema')} | ${c('rebuild')} | ${c('simulator')} | ${c('report')} | ${notes} |`);
    }
    lines.push('', '✓* = geslaagd op de gedocumenteerde afwijking in de officiële data na (src/kassa/fiscal/__tests__/uc/known.ts).', '');
    const out = path.resolve(__dirname, '../../../../../docs/gks/uc-coverage.md');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, lines.join('\n'));
  });
});
