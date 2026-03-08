/**
 * Packing Slip PDF Generator
 * Generates a visually branded packing slip PDF from order data using pdf-lib
 */
import { PDFDocument, StandardFonts, rgb, PDFImage } from 'pdf-lib';

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
  logo_url?: string | null;
}

// Brand colors
const ACCENT = rgb(0.13, 0.35, 0.67); // Deep professional blue
const ACCENT_LIGHT = rgb(0.91, 0.94, 0.98); // Light blue bg
const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.15, 0.15, 0.15);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.92, 0.92, 0.92);
const ZEBRA = rgb(0.96, 0.97, 0.98);
const WHITE = rgb(1, 1, 1);

function formatAddress(address: unknown): string[] {
  if (!address || typeof address !== 'object') return ['-'];
  const addr = address as { street?: string; postal_code?: string; city?: string; country?: string };
  const lines: string[] = [];
  if (addr.street) lines.push(addr.street);
  if (addr.postal_code || addr.city) lines.push([addr.postal_code, addr.city].filter(Boolean).join(' '));
  if (addr.country) lines.push(addr.country);
  return lines.length > 0 ? lines : ['-'];
}

async function tryEmbedLogo(doc: PDFDocument, logoUrl: string): Promise<PDFImage | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Detect format from bytes
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return await doc.embedPng(bytes);
    }
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return await doc.embedJpg(bytes);
    }

    // Try by URL extension
    const lower = logoUrl.toLowerCase();
    if (lower.includes('.png')) return await doc.embedPng(bytes);
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return await doc.embedJpg(bytes);

    // Default try PNG then JPG
    try { return await doc.embedPng(bytes); } catch { /* */ }
    try { return await doc.embedJpg(bytes); } catch { /* */ }
    return null;
  } catch {
    return null;
  }
}

export async function generatePackingSlipPdf(
  order: PackingSlipOrder,
  tenant: PackingSlipTenant
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 595 - margin * 2;
  let y = 842;

  // ─── ACCENT BAR (top of page) ───
  page.drawRectangle({ x: 0, y: 842 - 8, width: 595, height: 8, color: ACCENT });
  y = 842 - 8;

  // ─── LOGO + COMPANY INFO ───
  y -= 20;
  let logoEndX = margin;

  // Try to embed logo
  let logoImage: PDFImage | null = null;
  if (tenant.logo_url) {
    logoImage = await tryEmbedLogo(doc, tenant.logo_url);
  }

  if (logoImage) {
    const maxW = 110;
    const maxH = 45;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height, 1);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, { x: margin, y: y - h, width: w, height: h });
    logoEndX = margin + w + 15;
    // Company name next to logo
    page.drawText(tenant.name, { x: logoEndX, y: y - 14, size: 16, font: fontBold, color: DARK });
    const tenantLines = buildTenantLines(tenant);
    let infoY = y - 28;
    for (const line of tenantLines) {
      page.drawText(line, { x: logoEndX, y: infoY, size: 8, font, color: GRAY });
      infoY -= 11;
    }
    y = Math.min(y - 45, infoY) - 10;
  } else {
    // No logo — large company name
    page.drawText(tenant.name, { x: margin, y: y - 16, size: 18, font: fontBold, color: DARK });
    const tenantLines = buildTenantLines(tenant);
    let infoY = y - 32;
    for (const line of tenantLines) {
      page.drawText(line, { x: margin, y: infoY, size: 8, font, color: GRAY });
      infoY -= 11;
    }
    y = infoY - 6;
  }

  // ─── SEPARATOR ───
  page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 1, color: LIGHT_GRAY });
  y -= 25;

  // ─── PAKBON TITLE ───
  page.drawText('PAKBON', { x: margin, y, size: 22, font: fontBold, color: ACCENT });
  // Order number next to title
  const pakbonWidth = fontBold.widthOfTextAtSize('PAKBON', 22);
  page.drawText(`#${order.order_number}`, { x: margin + pakbonWidth + 12, y: y + 2, size: 14, font, color: GRAY });
  y -= 30;

  // ─── TWO-COLUMN INFO BOXES ───
  const boxHeight = 70;
  const boxWidth = (pageWidth - 20) / 2;
  const boxLeftX = margin;
  const boxRightX = margin + boxWidth + 20;

  // Left box: Order info
  page.drawRectangle({ x: boxLeftX, y: y - boxHeight, width: boxWidth, height: boxHeight, color: ACCENT_LIGHT, borderColor: ACCENT_LIGHT, borderWidth: 0 });
  // rounded corners not supported in pdf-lib, use filled rect

  let bY = y - 16;
  page.drawText('Bestelling', { x: boxLeftX + 12, y: bY, size: 9, font: fontBold, color: ACCENT });
  bY -= 16;
  const orderDate = new Date(order.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  page.drawText(`Nummer: ${order.order_number}`, { x: boxLeftX + 12, y: bY, size: 9, font, color: DARK });
  bY -= 13;
  page.drawText(`Datum: ${orderDate}`, { x: boxLeftX + 12, y: bY, size: 9, font, color: DARK });
  bY -= 13;
  page.drawText(`Klant: ${order.customer_name || 'Onbekend'}`, { x: boxLeftX + 12, y: bY, size: 9, font, color: DARK });

  // Right box: Ship to
  page.drawRectangle({ x: boxRightX, y: y - boxHeight, width: boxWidth, height: boxHeight, color: ACCENT_LIGHT, borderColor: ACCENT_LIGHT, borderWidth: 0 });

  bY = y - 16;
  page.drawText('Verzendadres', { x: boxRightX + 12, y: bY, size: 9, font: fontBold, color: ACCENT });
  bY -= 16;
  const shipName = order.customer_name || 'Onbekend';
  page.drawText(shipName, { x: boxRightX + 12, y: bY, size: 9, font: fontBold, color: DARK });
  bY -= 13;
  const shipLines = formatAddress(order.shipping_address);
  for (const line of shipLines) {
    page.drawText(line, { x: boxRightX + 12, y: bY, size: 9, font, color: DARK });
    bY -= 13;
  }

  y -= boxHeight + 25;

  // ─── ITEMS TABLE ───
  const colSku = margin + 8;
  const colDesc = margin + 90;
  const colQty = margin + pageWidth - 50;
  const rowHeight = 20;

  // Table header
  page.drawRectangle({ x: margin, y: y - 2, width: pageWidth, height: 22, color: ACCENT });
  page.drawText('SKU', { x: colSku, y: y + 3, size: 9, font: fontBold, color: WHITE });
  page.drawText('Omschrijving', { x: colDesc, y: y + 3, size: 9, font: fontBold, color: WHITE });
  page.drawText('Aantal', { x: colQty, y: y + 3, size: 9, font: fontBold, color: WHITE });
  y -= 22;

  // Item rows with zebra
  const items = order.order_items || [];
  for (let i = 0; i < items.length; i++) {
    if (y < 90) break;
    const item = items[i];

    // Zebra background
    if (i % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - 4, width: pageWidth, height: rowHeight, color: ZEBRA });
    }

    page.drawText(item.product_sku || '-', { x: colSku, y: y + 2, size: 8.5, font, color: DARK, maxWidth: 75 });
    page.drawText(item.product_name, { x: colDesc, y: y + 2, size: 8.5, font, color: DARK, maxWidth: 320 });
    page.drawText(String(item.quantity), { x: colQty + 12, y: y + 2, size: 9, font: fontBold, color: DARK });
    y -= rowHeight;
  }

  // Bottom line of table
  page.drawLine({ start: { x: margin, y: y + rowHeight - 4 }, end: { x: margin + pageWidth, y: y + rowHeight - 4 }, thickness: 0.5, color: LIGHT_GRAY });

  // ─── TOTALS ───
  y -= 15;
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  page.drawRectangle({ x: margin, y: y - 6, width: pageWidth, height: 24, color: ACCENT_LIGHT });
  page.drawText(`Totaal: ${totalItems} artikel${totalItems !== 1 ? 'en' : ''}`, {
    x: margin + 12, y: y, size: 10, font: fontBold, color: ACCENT,
  });

  // ─── FOOTER ───
  const footerY = 55;
  page.drawLine({ start: { x: margin, y: footerY + 15 }, end: { x: margin + pageWidth, y: footerY + 15 }, thickness: 0.5, color: LIGHT_GRAY });

  page.drawText('Bedankt voor je bestelling!', {
    x: margin, y: footerY, size: 10, font: fontBold, color: ACCENT,
  });

  // Company info footer line
  const footerParts = [tenant.name, tenant.address, [tenant.postal_code, tenant.city].filter(Boolean).join(' '), tenant.country].filter(Boolean);
  page.drawText(footerParts.join('  ·  '), {
    x: margin, y: footerY - 14, size: 7.5, font, color: GRAY,
  });

  // Contact line
  const contactParts = [tenant.phone ? `Tel: ${tenant.phone}` : null, tenant.email, tenant.kvk_number ? `KVK: ${tenant.kvk_number}` : null].filter(Boolean);
  if (contactParts.length > 0) {
    page.drawText(contactParts.join('  ·  '), {
      x: margin, y: footerY - 25, size: 7.5, font, color: GRAY,
    });
  }

  return doc.save();
}

function buildTenantLines(tenant: PackingSlipTenant): string[] {
  const lines: string[] = [];
  if (tenant.address) lines.push(tenant.address);
  const cityLine = [tenant.postal_code, tenant.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (tenant.country) lines.push(tenant.country);
  if (tenant.phone) lines.push(`Tel: ${tenant.phone}`);
  return lines;
}
