// PRINT-1 — QR-matrix voor de digitale (HTML) en tekst-weergave (PRT-03).
//
// Bibliotheek: qr.js (MIT) via de diepe import die react-qr-code (al een dependency) ook
// gebruikt; de index van qr.js zet ECC-niveau M (=0) stil om naar H, vandaar de diepe import.
// Op papier genereert de printer de QR zelf (ESC/POS GS ( k, zie escpos.ts).
//
// OPEN PUNT (PRT-03): de POS-detailbeschrijving §6.5 noemt "25x25, type 2, ECC medium" voor een
// url van 38 tekens. Dat past niet: versie 2-M bevat max. 26 bytes in byte-modus (en 38 tekens
// enkel in alfanumerieke modus, die geen kleine letters kent, terwijl de base-62-code van de
// FDM kleine letters bevat). Wij coderen ECC M met de KLEINST mogelijke versie: voor
// "https://www.gs2.be/" + 19 tekens = 38 bytes is dat versie 3 (29×29). Na te vragen bij de FOD.
import ErrorCorrectLevel from 'qr.js/lib/ErrorCorrectLevel';
import QRCode from 'qr.js/lib/QRCode';

export interface QrMatrix { version: number; size: number; modules: boolean[][] }

/** QR met foutcorrectie M en de kleinste versie waarin de data past (byte-modus). */
export function qrMatrix(data: string): QrMatrix {
  if (!data) throw new Error('PRT-03: lege QR-data');
  if (/[^\x20-\x7e]/.test(data)) throw new Error('PRT-03: QR-data moet ASCII zijn (verificationUrl)');
  const qr = new QRCode(-1, ErrorCorrectLevel.M);
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  const modules: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    modules.push(row);
  }
  return { version: qr.typeNumber, size: n, modules };
}

/** Matrix als halve-blok-tekst (2 rijen per regel) met een stille zone van 2 modules. */
export function qrAsBlocks(m: QrMatrix): string[] {
  const q = 2;
  const n = m.size + 2 * q;
  const dark = (r: number, c: number) => {
    const rr = r - q;
    const cc = c - q;
    return rr >= 0 && cc >= 0 && rr < m.size && cc < m.size && m.modules[rr][cc];
  };
  const out: string[] = [];
  for (let r = 0; r < n; r += 2) {
    let line = '';
    for (let c = 0; c < n; c++) {
      const top = dark(r, c);
      const bottom = dark(r + 1, c);
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    out.push(line);
  }
  return out;
}

/** Matrix als SVG (één path), voor het digitale ticket. */
export function qrSvg(m: QrMatrix, pixelsPerModule = 4): string {
  const q = 4;
  const n = m.size + 2 * q;
  let d = '';
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) if (m.modules[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`;
  }
  const px = n * pixelsPerModule;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
