import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateFloorQrPdf, qrPath } from './floorQrPdf';

describe('QR-stickers als PDF', () => {
  it('QR-pad: vierkante matrix met donkere modules', () => {
    const { d, size } = qrPath('https://belgaleiro.sellqo.shop/menu?t=a1b2c3d4e5f6a1b2c3d4e5f6');
    expect(size).toBeGreaterThanOrEqual(21);
    expect(d.startsWith('M')).toBe(true);
  });

  it('12 per A4: 13 tafels = 2 bladen', async () => {
    const stickers = Array.from({ length: 13 }, (_, i) => ({
      label: i < 5 ? `Blauw ${i + 1}` : `B${i - 4}`,
      area: 'Belgaleiro',
      url: `https://belgaleiro.sellqo.shop/menu?t=${(i + 1).toString(16).padStart(24, '0')}`,
    }));
    const bytes = await generateFloorQrPdf(stickers, { storeName: 'Café Belgaleiro', callToAction: 'Scan en bestel aan tafel' });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    // Lokaal nakijken (bv. QR uitlezen): FLOOR_QR_OUT=/pad/naar.pdf npx vitest run …
    if (process.env.FLOOR_QR_OUT) writeFileSync(process.env.FLOOR_QR_OUT, bytes);
  });

  it('crasht niet op tekens buiten WinAnsi', async () => {
    const bytes = await generateFloorQrPdf([{ label: 'Т1', area: 'Тераса ☀', url: 'https://x.sellqo.shop/menu?t=' + 'a'.repeat(24) }], { storeName: 'Кафе', callToAction: 'Scan' });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
