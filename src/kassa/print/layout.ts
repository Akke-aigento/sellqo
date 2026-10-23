// PRINT-1 — TicketDoc → regels met vaste breedte (32/42/48 kolommen). Gedeeld door de tekst-,
// ESC/POS- en HTML-weergave, zodat alle drie exact dezelfde inhoud en volgorde tonen.
import type { Block, TicketDoc } from './types';

export type PaperWidth = 32 | 42 | 48;
export const PAPER_WIDTHS: PaperWidth[] = [32, 42, 48];

export type Line =
  | { kind: 'text'; text: string; bold?: boolean; big?: boolean }
  | { kind: 'qr'; data: string };

/** Woordterugloop; te lange woorden (bv. shortSignature) worden hard gebroken. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > width) {
      if (cur) { out.push(cur); cur = ''; }
      out.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!w) continue;
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function align(text: string, width: number, how: 'left' | 'center' | 'right' = 'left'): string {
  if (text.length >= width) return text;
  if (how === 'right') return text.padStart(width);
  if (how === 'center') return ' '.repeat(Math.floor((width - text.length) / 2)) + text;
  return text;
}

function kv(left: string, right: string, width: number): string[] {
  if (!right) return wrap(left, width);
  if (left.length + 1 + right.length <= width) return [left + ' '.repeat(width - left.length - right.length) + right];
  return [...wrap(left, width), align(right, width, 'right')];
}

function item(b: Extract<Block, { t: 'item' }>, width: number): string[] {
  const indent = b.indent ? '  ' : '';
  const qw = Math.max(width <= 32 ? 4 : 5, b.qty.length + 1);
  const aw = b.amount !== null ? Math.max(9, b.amount.length) : 0;
  const vw = b.vat !== null ? Math.max(2, b.vat.length) + 1 : 0;
  const nw = Math.max(8, width - indent.length - qw - (aw ? aw + 1 : 0) - vw);
  const names = wrap(b.name, nw);
  return names.map((n, i) => {
    const q = i === 0 ? b.qty.padEnd(qw) : ' '.repeat(qw);
    const lastLine = i === names.length - 1;
    const amt = aw ? ' ' + (lastLine ? (b.amount as string) : '').padStart(aw) : '';
    const vat = vw ? ' ' + (lastLine ? (b.vat as string) : '').padEnd(vw - 1) : '';
    return (indent + q + n.padEnd(nw) + amt + vat).replace(/\s+$/, '');
  });
}

function table(b: Extract<Block, { t: 'table' }>, width: number): string[] {
  const cols = b.head.length;
  const w = b.head.map((h, i) => Math.max(h.length, ...b.rows.map((r) => (r[i] ?? '').length)));
  const total = w.reduce((a, x) => a + x, 0) + (cols - 1) * 2;
  if (total <= width) {
    // Extra ruimte gaat naar de bedragkolommen.
    const extra = width - total;
    const per = Math.floor(extra / Math.max(1, cols - 2));
    const ww = w.map((x, i) => (i >= 2 ? x + per : x));
    const fmt = (r: string[]) => r.map((c, i) => (i === 0 ? (c ?? '').padEnd(ww[i]) : (c ?? '').padStart(ww[i]))).join('  ').replace(/\s+$/, '');
    return [fmt(b.head), ...b.rows.map(fmt)];
  }
  // Te smal: per rij gestapeld (zelfde inhoud, andere schikking).
  const out: string[] = [];
  for (const r of b.rows) {
    out.push(`${r[0]} ${r[1]}`.trim());
    for (let i = 2; i < cols; i++) out.push(...kv(`  ${b.head[i]}`, r[i] ?? '', width));
  }
  return out;
}

/** TicketDoc → regels. Breedte 32 (58 mm), 42 (80 mm Star) of 48 (80 mm Epson). */
export function layout(doc: TicketDoc, width: PaperWidth): Line[] {
  if (!PAPER_WIDTHS.includes(width)) throw new Error(`breedte ${width} niet ondersteund (32/42/48)`);
  const out: Line[] = [];
  const push = (texts: string[], style: { bold?: boolean; big?: boolean } = {}) => {
    for (const t of texts) out.push({ kind: 'text', text: t, ...style });
  };
  for (const b of doc.blocks) {
    switch (b.t) {
      case 'title': push(wrap(b.text, width).map((t) => align(t, width, 'center')), { bold: true, big: !!b.big }); break;
      case 'text': push(wrap(b.text, width).map((t) => align(t, width, b.align)), { bold: !!b.bold }); break;
      case 'kv': push(kv(b.left, b.right, width), { bold: !!b.bold }); break;
      case 'item': push(item(b, width)); break;
      case 'table': push(table(b, width)); break;
      case 'rule': push(['-'.repeat(width)]); break;
      case 'blank': push(['']); break;
      case 'qr': out.push({ kind: 'qr', data: b.data }); break;
    }
  }
  return out;
}
