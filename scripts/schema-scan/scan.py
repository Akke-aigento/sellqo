#!/usr/bin/env python3
"""
SCHEMA-FIX (13-10-2026) — code tegen het LIVE databankschema leggen.

Waarom: Supabase-queries op een kolom die niet bestaat falen volledig en geven
`data: null`. In de code ziet dat eruit als "niets gevonden". Zo vond deze scan
in één nacht: een onboardingstap die altijd faalde, een klant-orderdetail dat
altijd "Order not found" gaf, bol-orders die nooit op 'shipped' kwamen, enz.
tsc vangt dit niet (types.ts loopt achter of de query is `as any`).

Gebruik:
  1. Live kolommen ophalen (connector query_database, of psql) en opslaan als cols.json:
       select json_object_agg(table_name, cols) from (
         select table_name, json_agg(column_name order by column_name) cols
         from information_schema.columns where table_schema='public' group by table_name) t;
     (alleen het object zelf in het bestand, dus {"tabel": ["kol", ...], ...})
  2. python3 scripts/schema-scan/scan.py cols.json src supabase/functions

Drie controles (heuristiek, geen parser — vals alarm bij strings is mogelijk):
  - select : kolommen in .from('t').select('…'), ook binnen geneste relaties
  - write  : sleutels in .insert/.update/.upsert({…}) en filters (.eq/.order/…)
  - table  : .from('t') op een tabel die niet bestaat (storage-buckets uitgezonderd)
"""
import json, os, re, sys

cols = json.load(open(sys.argv[1]))
roots = sys.argv[2:] or ['src', 'supabase/functions']
BUCKETS = {'ai-images','credit-notes','digital-products','invoices','marketing-assets','message-attachments',
           'peppol-archive','product-images','shipping-labels','supplier-documents','tenant-assets','tenant-logos'}

FROM = re.compile(r"""(?<!storage)\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)""")
SELECT = re.compile(r"""\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)\s*\.select\(\s*(['"`])(.*?)\2""", re.S)
FILT = re.compile(r"""\.(eq|neq|gt|gte|lt|lte|in|is|like|ilike|order|contains)\(\s*['"]([a-z_0-9]+)['"]""")
WRITE = re.compile(r"""\.(update|insert|upsert)\(\s*\{""")

def files():
    for root in roots:
        for dp, _, fn in os.walk(root):
            if 'node_modules' in dp: continue
            for f in fn:
                if f.endswith(('.ts', '.tsx')) and '.test.' not in f:
                    yield os.path.join(dp, f)

def split_select(sel, rel=None, out=None):
    out = [] if out is None else out
    i, tok = 0, ''
    while i < len(sel):
        ch = sel[i]
        if ch == '(':
            d, j = 1, i + 1
            while j < len(sel) and d:
                d += {'(': 1, ')': -1}.get(sel[j], 0); j += 1
            name = tok.strip().split(':')[-1].strip().split('!')[0].strip()
            split_select(sel[i + 1:j - 1], name, out); tok = ''; i = j; continue
        if ch == ',': out.append((rel, tok.strip())); tok = ''
        else: tok += ch
        i += 1
    if tok.strip(): out.append((rel, tok.strip()))
    return out

def colname(c):
    c = c.split(':')[-1].strip().split('::')[0].split('->')[0].strip()
    return c if re.fullmatch(r'[a-z_][a-z_0-9]*', c) else None

hits = set()
for p in files():
    s = open(p, errors='ignore').read()
    for m in FROM.finditer(s):
        t = m.group(1)
        if t not in cols and t not in BUCKETS: hits.add(('table', p, t, '-'))
    for m in SELECT.finditer(s):
        t, sel = m.group(1), m.group(3)
        if t not in cols or '${' in sel: continue
        for rel, c in split_select(sel):
            tbl = t if rel is None else rel
            c = colname(c)
            if not c or c == '*' or c in cols or tbl not in cols: continue
            if c not in cols[tbl]: hits.add(('select', p, tbl, c))
    for m in FROM.finditer(s):
        t = m.group(1)
        if t not in cols: continue
        end = s.find(';', m.end()); chain = s[m.end(): end if end > 0 else m.end() + 800][:1500]
        nx = FROM.search(chain)
        if nx: chain = chain[:nx.start()]
        for fm in FILT.finditer(chain):
            if fm.group(2) not in cols[t]: hits.add(('filter', p, t, fm.group(2)))
        wm = WRITE.search(chain)
        if wm:
            i, d, buf = wm.end(), 1, ''
            while i < len(chain) and d:
                ch = chain[i]
                if ch in '{[(': d += 1
                elif ch in '}])': d -= 1
                if d == 1: buf += ch
                i += 1
            buf = re.sub(r"(['\"`])(?:\\.|(?!\1).)*?\1", "''", buf, flags=re.S)  # strings eruit
            buf = re.sub(r"\?[^:,{}]*:", "?", buf)  # ternaries (a ? b : c) zijn geen sleutels
            for k in re.findall(r"(?:^|[,{\s])([a-z_][a-z_0-9]*)\s*:", buf):
                if k not in cols[t]: hits.add(('write', p, t, k))

for kind, p, t, c in sorted(hits, key=lambda h: (h[0], h[1])):
    print(f'{kind:7} {p}  {t}.{c}')
print(f'\n{len(hits)} vondst(en). Elke vondst eerst natrekken: strings in de code geven soms vals alarm.')
