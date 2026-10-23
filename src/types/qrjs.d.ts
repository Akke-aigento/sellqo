// ZAAL-H1 — types voor qr.js (de QR-motor onder react-qr-code, staat al in bun.lock).
// Enkel gebruikt om een QR als vectorpad in een PDF te tekenen (src/utils/floorQrPdf.ts).
declare module 'qr.js/lib/QRCode' {
  export default class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    addData(data: string): void;
    make(): void;
    modules: boolean[][];
  }
}
declare module 'qr.js/lib/ErrorCorrectLevel' {
  const levels: { L: number; M: number; Q: number; H: number };
  export default levels;
}
