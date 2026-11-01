// Harnas: qr.js ontbreekt in de gedeelde node_modules van de sandbox; de kassa drukt hier geen QR.
const stub = function QRCodeStub() { return { modules: [] }; } as unknown;
export default stub;
