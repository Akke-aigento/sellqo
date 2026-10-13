// FOOD-4 — keukenbon afdrukken op een bonprinter (80 mm) via de printer van het toestel.
// Een verborgen iframe in plaats van een pop-up: werkt ook voor automatisch afdrukken
// (geen pop-upblokkering). Volledig stil afdrukken kan met Chrome in kioskmodus
// (--kiosk-printing); anders toont de browser het printvenster.
import type { KitchenCard } from './kitchenModel';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Teksten op de bon, vertaald door de aanroeper (de taal van de keuken-UI). */
export interface TicketLabels {
  lang: string;
  service: Record<'pickup' | 'local_delivery' | 'eat_in', string>;
  order: string; asap: string; paid: string; toPay: string;
  source: (card: KitchenCard) => string;
  who: (card: KitchenCard) => string;
  toPayAmount: (amount: string) => string;
  footer: (ordered: string, printed: string) => string;
}

export function ticketHtml(card: KitchenCard, storeName: string, L: TicketLabels): string {
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(L.lang, { hour: '2-digit', minute: '2-digit' });
  const when = card.requestedTime ? hhmm(card.requestedTime) : L.asap;
  const items = card.items.map((it) => `
    <div class="it"><b>${it.quantity}x</b> ${esc(it.name)}</div>
    ${it.detail ? `<div class="sub">${esc(it.detail)}</div>` : ''}
    ${it.addons.map((a) => `<div class="sub">+ ${esc(a)}</div>`).join('')}`).join('');
  const pay = card.paid ? L.paid : card.total != null ? L.toPayAmount(`EUR ${card.total.toFixed(2).replace('.', ',')}`) : L.toPay;
  const who = L.who(card);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(L.order)}</title><style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: ui-monospace, Menlo, Consolas, monospace; width: 72mm; margin: 0; color: #000; font-size: 12pt; }
    .c { text-align: center; } .big { font-size: 20pt; font-weight: 800; } .mid { font-size: 14pt; font-weight: 700; }
    .it { font-size: 14pt; margin-top: 2mm; } .sub { padding-left: 6mm; font-size: 11pt; }
    hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; } .note { border: 1px solid #000; padding: 1.5mm; margin-top: 2mm; font-weight: 700; }
  </style></head><body>
    <div class="c">${esc(storeName)}</div>
    <div class="c big">${esc(card.service ? L.service[card.service] : L.order)} ${esc(when)}</div>
    <div class="c mid">${esc(L.source(card))}</div>
    ${who || card.phone ? `<div class="c">${esc([who, card.phone].filter(Boolean).join(' · '))}</div>` : ''}
    ${card.address ? `<div class="c">${esc(card.address)}</div>` : ''}
    <hr>${items}
    ${card.note ? `<div class="note">${esc(card.note)}</div>` : ''}
    <hr><div class="c mid">${pay}</div>
    <div class="c" style="font-size:9pt">${esc(L.footer(hhmm(card.createdAt), hhmm(new Date().toISOString())))}</div>
  </body></html>`;
}

export function printTicket(card: KitchenCard, storeName: string, labels: TicketLabels) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) { frame.remove(); return; }
  doc.open(); doc.write(ticketHtml(card, storeName, labels)); doc.close();
  setTimeout(() => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* geen printer */ }
    setTimeout(() => frame.remove(), 60_000);
  }, 150);
}
