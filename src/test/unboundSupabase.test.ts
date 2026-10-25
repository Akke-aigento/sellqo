// Een methode van de Supabase-client los in een variabele zetten (`const rpc = supabase.rpc`)
// verliest `this`: elke aanroep faalt live met "Cannot read properties of undefined (reading 'rest')".
// Mocks in tests en previews merken dat niet. Gebruik `supabase.rpc.bind(supabase)` of roep rechtstreeks aan.
// Incident: KAART-1 t/m KAART-3 (24-25 okt 2026), snel toevoegen/slepen/maat faalden live.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('Supabase-client', () => {
  it('geen losgekoppelde methodes (const x = supabase.rpc / .from / .functions.invoke zonder bind)', () => {
    const bad = /=\s*\(?\s*supabase(\.(rpc|from|channel|functions\.invoke|storage\.from))\s*(\)|as\b|;)/;
    const hits = files('src').flatMap((f) =>
      readFileSync(f, 'utf8').split('\n').map((l, i) => (bad.test(l) ? `${f}:${i + 1}: ${l.trim()}` : null)).filter(Boolean),
    );
    expect(hits).toEqual([]);
  });
});
