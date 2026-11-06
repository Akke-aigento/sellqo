// QR-PRINT-1 — de menu-QR's en de allergenenkaart worden een echte PDF (geen afdrukvenster).
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateMenuQrPdf, hexColor } from './menuQrPdf';
import { generateAllergenChartPdf } from './allergenChartPdf';

const base = { url: 'https://demo-bar.sellqo.shop/menu', storeName: 'Café De Wissel', heading: 'Scan & bekijk de kaart', sub: 'Bestel aan tafel · betaal wanneer het past' };

async function pages(bytes: Uint8Array) {
  if (process.env.QR_PDF_OUT) {
    const fs = await import('node:fs');
    fs.writeFileSync(`${process.env.QR_PDF_OUT}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.pdf`, bytes);
  }
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('generateMenuQrPdf', () => {
  it('affiche: één A4', async () => {
    expect(await pages(await generateMenuQrPdf({ ...base, layout: 'poster', accent: '#c0392b' }))).toBe(1);
  });
  it('tafelkaartjes: 4 per A4', async () => {
    const tables = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(await pages(await generateMenuQrPdf({ ...base, layout: 'tables', tables, tableLabel: (n) => `Tafel ${n}` }))).toBe(3);
  });
  it('stickers: één A4', async () => {
    expect(await pages(await generateMenuQrPdf({ ...base, layout: 'stickers', accent: 'geen-kleur' }))).toBe(1);
  });
  it('een logo dat niet laadt geeft gewoon de zaaknaam (geen fout)', async () => {
    expect(await pages(await generateMenuQrPdf({ ...base, layout: 'poster', logoUrl: 'http://127.0.0.1:9/bestaat-niet.png' }))).toBe(1);
  });
  it('tekens buiten WinAnsi breken de PDF niet', async () => {
    expect(await pages(await generateMenuQrPdf({ ...base, layout: 'poster', heading: 'Меню · 🍺 Café', storeName: 'Кафе' }))).toBe(1);
  });
  it('hexColor', () => {
    expect(hexColor('#fff')).toEqual(hexColor('#ffffff'));
    expect(hexColor('rood')).toEqual(hexColor('#000000'));
  });
});

describe('generateAllergenChartPdf', () => {
  it('lange kaart loopt over meerdere pagina\'s met de kop opnieuw', async () => {
    const allergens = ['Gluten', 'Schaaldieren', 'Eieren', 'Vis', 'Pinda', 'Soja', 'Melk', 'Noten', 'Selder', 'Mosterd', 'Sesam', 'Sulfiet', 'Lupine', 'Weekdieren'];
    const rows = Array.from({ length: 60 }, (_, i) => ({ name: `Gerecht ${i + 1}`, marks: allergens.map((_, j) => (i + j) % 5 === 0), note: i === 3 ? 'niet ingevuld' : undefined }));
    const bytes = await generateAllergenChartPdf({ title: 'Allergenenkaart — Café De Wissel', subtitle: 'Bijgewerkt op 6 november 2026', footer: 'Vraag bij twijfel altijd aan de bediening.', allergens, groups: [{ title: 'Van de tap', rows: rows.slice(0, 30) }, { title: 'Keuken', rows: rows.slice(30) }] });
    expect(await pages(bytes)).toBeGreaterThan(1);
  });
});
