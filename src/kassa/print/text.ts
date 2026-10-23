// PRINT-1 — TicketDoc als platte tekst met vaste breedte (32/42/48 kolommen).
// Gebruikt voor: voorbeeld op scherm, tests, Star CloudPRNT text/plain (enkel keuken/bar, zie
// queue.ts: een tekstprinter kan geen QR, dus geen kasticket) en de mail-bijlage.
import { layout, type PaperWidth } from './layout';
import { qrAsBlocks, qrMatrix } from './qr';
import type { TicketDoc } from './types';

export interface TextOptions {
  /** 'url' = de verificationUrl als tekstregel; 'blocks' = QR als halve-blok-tekens + url. */
  qr?: 'url' | 'blocks';
}

export function renderText(doc: TicketDoc, width: PaperWidth, opts: TextOptions = {}): string {
  const out: string[] = [];
  for (const l of layout(doc, width)) {
    if (l.kind === 'text') { out.push(l.text); continue; }
    if (opts.qr === 'blocks') {
      for (const row of qrAsBlocks(qrMatrix(l.data))) {
        out.push(' '.repeat(Math.max(0, Math.floor((width - row.length) / 2))) + row);
      }
    }
    // pos_detail 6.5: bij een digitale afdruk wordt de url als link vermeld.
    out.push(...(l.data.length <= width ? [' '.repeat(Math.floor((width - l.data.length) / 2)) + l.data] : [l.data]));
  }
  return out.join('\n') + '\n';
}
