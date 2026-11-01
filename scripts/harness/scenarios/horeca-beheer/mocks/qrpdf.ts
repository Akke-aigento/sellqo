// qr.js staat niet in de gedeelde node_modules van de sandbox; de PDF is hier niet nodig.
export function qrPath() { return { d: '', size: 0 }; }
export async function generateFloorQrPdf() { return new Uint8Array(); }
export function downloadPdf() {}
