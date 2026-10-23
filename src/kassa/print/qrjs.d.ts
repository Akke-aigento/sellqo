// PRINT-1 — types voor de diepe imports van qr.js (MIT, staat in node_modules via react-qr-code,
// dat precies deze twee bestanden ook zo importeert). Enkel wat print/qr.ts gebruikt.
declare module 'qr.js/lib/QRCode' {
  class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    typeNumber: number;
    modules: (boolean | null)[][];
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }
  export = QRCode;
}
declare module 'qr.js/lib/ErrorCorrectLevel' {
  const ErrorCorrectLevel: { L: number; M: number; Q: number; H: number };
  export = ErrorCorrectLevel;
}
