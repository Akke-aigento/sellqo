/**
 * Packing Slip PDF Generator
 * Generates a packing slip PDF from order data using pdf-lib
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface PackingSlipOrder {
  order_number: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string;
  shipping_address: unknown;
  order_items?: {
    product_name: string;
    product_sku: string | null;
    quantity: number;
  }[];
}

interface PackingSlipTenant {
  name: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  kvk_number?: string | null;
}

function formatAddress(address: unknown): string[] {
  if (!address || typeof address !== 'object') return ['-'];
  const addr = address as { street?: string; postal_code?: string; city?: string; country?: string };
  const lines: string[] = [];
  if (addr.street) lines.push(addr.street);
  if (addr.postal_code || addr.city) lines.push([addr.postal_code, addr.city].filter(Boolean).join(' '));
  if (addr.country) lines.push(addr.country);
  return lines.length > 0 ? lines : ['-'];
}

export async function generatePackingSlipPdf(
  order: PackingSlipOrder,
  tenant: PackingSlipTenant
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const margin = 50;
  const pageWidth = 595 - margin * 2;
  let y = 792;

  // --- Header ---
  page.drawText(tenant.name, { x: margin, y, size: 18, font: fontBold, color: black });
  y -= 16;
  const tenantAddr = [tenant.address, [tenant.postal_code, tenant.city].filter(Boolean).join(' '), tenant.country].filter(Boolean);
  for (const line of tenantAddr) {
    page.drawText(line!, { x: margin, y, size: 9, font, color: gray });
    y -= 12;
  }
  if (tenant.phone) {
    page.drawText(`Tel: ${tenant.phone}`, { x: margin, y, size: 9, font, color: gray });
    y -= 12;
  }

  // --- Title ---
  y -= 10;
  page.drawText('PAKBON', { x: margin, y, size: 22, font: fontBold, color: black });
  y -= 28;

  // --- Order info + Ship to ---
  const colLeft = margin;
  const colRight = margin + 280;

  // Left: Order info
  const orderDate = new Date(order.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  page.drawText('Bestelnummer:', { x: colLeft, y, size: 9, font: fontBold, color: black });
  page.drawText(order.order_number, { x: colLeft + 90, y, size: 9, font, color: black });
  page.drawText('Verzendadres:', { x: colRight, y, size: 9, font: fontBold, color: black });
  y -= 14;
  page.drawText('Datum:', { x: colLeft, y, size: 9, font: fontBold, color: black });
  page.drawText(orderDate, { x: colLeft + 90, y, size: 9, font, color: black });

  // Right: Ship to
  const shipName = order.customer_name || 'Onbekend';
  page.drawText(shipName, { x: colRight + 85, y: y + 14, size: 9, font: fontBold, color: black });
  const shipLines = formatAddress(order.shipping_address);
  let shipY = y;
  for (const line of shipLines) {
    page.drawText(line, { x: colRight + 85, y: shipY, size: 9, font, color: black });
    shipY -= 12;
  }

  y -= 14;
  y = Math.min(y, shipY) - 20;

  // --- Items table ---
  // Header row
  page.drawRectangle({ x: margin, y: y - 2, width: pageWidth, height: 18, color: lightGray });
  const colSku = margin + 5;
  const colDesc = margin + 100;
  const colQty = margin + pageWidth - 60;

  page.drawText('SKU', { x: colSku, y: y + 2, size: 9, font: fontBold, color: black });
  page.drawText('Omschrijving', { x: colDesc, y: y + 2, size: 9, font: fontBold, color: black });
  page.drawText('Aantal', { x: colQty, y: y + 2, size: 9, font: fontBold, color: black });
  y -= 20;

  // Item rows
  const items = order.order_items || [];
  for (const item of items) {
    if (y < 80) break; // safety
    page.drawText(item.product_sku || '-', { x: colSku, y, size: 9, font, color: black, maxWidth: 90 });
    page.drawText(item.product_name, { x: colDesc, y, size: 9, font, color: black, maxWidth: 300 });
    page.drawText(String(item.quantity), { x: colQty + 15, y, size: 9, font, color: black });
    y -= 16;
    // light divider
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: margin + pageWidth, y: y + 6 }, thickness: 0.5, color: lightGray });
  }

  // --- Footer ---
  y -= 30;
  if (y > 100) {
    page.drawText('Totaal artikelen: ' + items.reduce((s, i) => s + i.quantity, 0), {
      x: margin, y, size: 10, font: fontBold, color: black,
    });
  }

  // Bottom note
  page.drawText('Bedankt voor je bestelling!', {
    x: margin, y: 50, size: 9, font, color: gray,
  });

  return doc.save();
}
