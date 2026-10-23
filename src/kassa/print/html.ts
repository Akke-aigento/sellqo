// PRINT-1 — TicketDoc als HTML voor het digitale ticket (scherm, mail, pdf). Inline stijl,
// geen externe bronnen. QR als inline SVG én de url als link (pos_detail 6.5: bij een digitale
// afdruk wordt de url als link vermeld). Zelfde regels als op papier (layout.ts).
import { layout, type PaperWidth } from './layout';
import { qrMatrix, qrSvg } from './qr';
import type { TicketDoc } from './types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderHtml(doc: TicketDoc, width: PaperWidth = 42): string {
  const lines: string[] = [];
  for (const l of layout(doc, width)) {
    if (l.kind === 'qr') {
      const href = esc(l.data);
      lines.push(`<div style="text-align:center;margin:8px 0">${qrSvg(qrMatrix(l.data))}<br><a href="${href}" style="color:#000;font-size:12px;word-break:break-all">${href}</a></div>`);
      continue;
    }
    const style = [l.bold ? 'font-weight:700' : '', l.big ? 'font-size:1.35em;line-height:1.3' : ''].filter(Boolean).join(';');
    const text = esc(l.text) || '&nbsp;';
    lines.push(style ? `<div style="${style}">${text}</div>` : `<div>${text}</div>`);
  }
  return `<!-- SellQo Kassa ticket (${doc.kind}) -->
<div lang="${doc.language.toLowerCase()}" style="background:#fff;color:#000;font-family:'DejaVu Sans Mono',Menlo,Consolas,monospace;font-size:13px;line-height:1.35;white-space:pre;width:${width}ch;max-width:100%;overflow-x:auto;padding:12px;border:1px solid #ddd">
${lines.join('\n')}
</div>`;
}
