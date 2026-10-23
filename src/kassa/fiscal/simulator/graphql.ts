// KASSA-0 — minimale GraphQL-lezer voor de simulator: genoeg om de officiële use-case-
// queries te begrijpen (aliassen, argumenten, fragmenten, __typename) en het antwoord tot
// de gevraagde velden te beperken, zoals een echte GraphQL-server doet.

export interface Field { alias: string; name: string; args: Record<string, ArgValue>; selection: Selection[] | null }
export type Selection = { kind: 'field'; field: Field } | { kind: 'spread'; name: string };
export type ArgValue = { kind: 'var'; name: string } | { kind: 'lit'; value: string | number | boolean | null };
export interface Operation { type: 'query' | 'mutation'; selection: Selection[] }
export interface Doc { operations: Operation[]; fragments: Map<string, Selection[]> }

type Tok = { t: 'name' | 'punct' | 'str' | 'num'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/[\s,\uFEFF]/.test(c)) { i++; continue; }
    if (src.startsWith('...', i)) { out.push({ t: 'punct', v: '...' }); i += 3; continue; }
    if ('{}():$!=@[]'.includes(c)) { out.push({ t: 'punct', v: c }); i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== '"') { if (src[j] === '\\') j++; s += src[j]; j++; }
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
    if (m) { out.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    const n = /^[_A-Za-z][_0-9A-Za-z]*/.exec(src.slice(i));
    if (n) { out.push({ t: 'name', v: n[0] }); i += n[0].length; continue; }
    throw new Error(`GraphQL: onverwacht teken '${c}'`);
  }
  return out;
}

export function parseDocument(src: string): Doc {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (v: string) => { const t = next(); if (!t || t.v !== v) throw new Error(`GraphQL: '${v}' verwacht, kreeg '${t?.v}'`); };
  const skipBalanced = (open: string, close: string) => {
    expect(open);
    let depth = 1;
    while (depth > 0) { const t = next(); if (!t) throw new Error('GraphQL: onvolledig'); if (t.v === open) depth++; else if (t.v === close) depth--; }
  };
  const parseValue = (): ArgValue => {
    const t = next();
    if (t.v === '$') return { kind: 'var', name: next().v };
    if (t.t === 'num') return { kind: 'lit', value: Number(t.v) };
    if (t.t === 'str') return { kind: 'lit', value: t.v };
    if (t.v === 'true' || t.v === 'false') return { kind: 'lit', value: t.v === 'true' };
    if (t.v === 'null') return { kind: 'lit', value: null };
    if (t.v === '{' || t.v === '[') { p--; skipBalanced(t.v, t.v === '{' ? '}' : ']'); return { kind: 'lit', value: null }; }
    return { kind: 'lit', value: t.v }; // enum
  };
  const parseSelection = (): Selection[] => {
    expect('{');
    const sel: Selection[] = [];
    while (peek() && peek().v !== '}') {
      if (peek().v === '...') {
        next();
        if (peek().v === 'on') throw new Error('GraphQL: inline fragments niet ondersteund');
        sel.push({ kind: 'spread', name: next().v });
        continue;
      }
      let name = next().v;
      let alias = name;
      if (peek()?.v === ':') { next(); alias = name; name = next().v; }
      const args: Record<string, ArgValue> = {};
      if (peek()?.v === '(') {
        next();
        while (peek().v !== ')') { const an = next().v; expect(':'); args[an] = parseValue(); }
        next();
      }
      while (peek()?.v === '@') { next(); next(); if (peek()?.v === '(') skipBalanced('(', ')'); }
      const selection = peek()?.v === '{' ? parseSelection() : null;
      sel.push({ kind: 'field', field: { alias, name, args, selection } });
    }
    expect('}');
    return sel;
  };
  const doc: Doc = { operations: [], fragments: new Map() };
  while (p < toks.length) {
    const t = peek();
    if (t.v === '{') { doc.operations.push({ type: 'query', selection: parseSelection() }); continue; }
    if (t.v === 'query' || t.v === 'mutation') {
      next();
      if (peek().t === 'name') next();
      if (peek().v === '(') skipBalanced('(', ')');
      doc.operations.push({ type: t.v as 'query' | 'mutation', selection: parseSelection() });
      continue;
    }
    if (t.v === 'fragment') {
      next();
      const name = next().v;
      expect('on');
      next();
      doc.fragments.set(name, parseSelection());
      continue;
    }
    throw new Error(`GraphQL: onverwacht '${t.v}'`);
  }
  return doc;
}

/** Fragmenten uitvouwen tot een platte lijst velden. */
export function fieldsOf(sel: Selection[], frags: Map<string, Selection[]>): Field[] {
  const out: Field[] = [];
  for (const s of sel) {
    if (s.kind === 'field') out.push(s.field);
    else {
      const f = frags.get(s.name);
      if (!f) throw new Error(`GraphQL: onbekend fragment ${s.name}`);
      out.push(...fieldsOf(f, frags));
    }
  }
  return out;
}

const CHILD_TYPE: Record<string, string> = {
  fdmRef: 'FdmReference', vatCalc: 'VatCalcItem', warnings: 'MessageItem', informations: 'MessageItem', errors: 'MessageItem',
  locations: 'LocationItem', extensions: 'ExtensionItem', data: 'DataItem', device: 'Device',
};

/** Beperk een waarde tot de gevraagde velden (incl. __typename). */
export function project(value: unknown, sel: Selection[] | null, typeName: string, frags: Map<string, Selection[]>): unknown {
  if (value === null || value === undefined) return null;
  if (!sel) return value;
  if (Array.isArray(value)) return value.map((v) => project(v, sel, typeName, frags));
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fieldsOf(sel, frags)) {
    if (f.name === '__typename') { out[f.alias] = typeName; continue; }
    const v = obj[f.name];
    out[f.alias] = f.selection ? project(v, f.selection, CHILD_TYPE[f.name] ?? 'Object', frags) : (v === undefined ? null : v);
  }
  return out;
}
