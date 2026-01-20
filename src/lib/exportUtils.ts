import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface ExportColumn {
  key: string;
  header: string;
  format?: 'currency' | 'date' | 'datetime' | 'number' | 'percentage';
}

// Format currency for Dutch locale
export const formatCurrencyValue = (value: number): string => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Format date for Dutch locale
export const formatDateValue = (date: string | Date): string => {
  if (!date) return '';
  return format(new Date(date), 'dd-MM-yyyy', { locale: nl });
};

// Format datetime for Dutch locale
export const formatDateTimeValue = (date: string | Date): string => {
  if (!date) return '';
  return format(new Date(date), 'dd-MM-yyyy HH:mm', { locale: nl });
};

// Format percentage
export const formatPercentageValue = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

// Apply formatting based on column type
const formatValue = (value: any, formatType?: ExportColumn['format']): string => {
  if (value === null || value === undefined) return '';
  
  switch (formatType) {
    case 'currency':
      return formatCurrencyValue(Number(value));
    case 'date':
      return formatDateValue(value);
    case 'datetime':
      return formatDateTimeValue(value);
    case 'number':
      return Number(value).toLocaleString('nl-NL');
    case 'percentage':
      return formatPercentageValue(Number(value));
    default:
      return String(value);
  }
};

// Generate CSV with UTF-8 BOM for Excel compatibility
export const generateCSV = <T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void => {
  const BOM = '\uFEFF';
  const separator = ';'; // Use semicolon for Dutch Excel compatibility
  
  // Headers
  const headers = columns.map(col => `"${col.header}"`).join(separator);
  
  // Rows
  const rows = data.map(item => 
    columns.map(col => {
      const value = formatValue(item[col.key], col.format);
      // Escape quotes and wrap in quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(separator)
  );
  
  const csvContent = BOM + [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}.csv`);
};

// Generate Excel file with formatting
export const generateExcel = <T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Data'
): void => {
  // Prepare data with headers
  const headers = columns.map(col => col.header);
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      // Keep numbers as numbers for Excel
      if (col.format === 'currency' || col.format === 'number' || col.format === 'percentage') {
        return Number(value) || 0;
      }
      if (col.format === 'date' || col.format === 'datetime') {
        return value ? new Date(value) : '';
      }
      return value ?? '';
    })
  );
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  // Set column widths
  const colWidths = columns.map(col => ({ wch: Math.max(col.header.length, 15) }));
  worksheet['!cols'] = colWidths;
  
  // Apply number formats
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (!cell) continue;
      
      const col = columns[C];
      if (col.format === 'currency') {
        cell.z = '€ #,##0.00';
      } else if (col.format === 'percentage') {
        cell.z = '0.00%';
      } else if (col.format === 'date') {
        cell.z = 'dd-mm-yyyy';
      } else if (col.format === 'datetime') {
        cell.z = 'dd-mm-yyyy hh:mm';
      }
    }
  }
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Generate Excel with multiple sheets
export const generateExcelMultiSheet = (
  sheets: Array<{
    name: string;
    data: Record<string, any>[];
    columns: ExportColumn[];
  }>,
  filename: string
): void => {
  const workbook = XLSX.utils.book_new();
  
  sheets.forEach(sheet => {
    const headers = sheet.columns.map(col => col.header);
    const rows = sheet.data.map(item => 
      sheet.columns.map(col => {
        const value = item[col.key];
        if (col.format === 'currency' || col.format === 'number' || col.format === 'percentage') {
          return Number(value) || 0;
        }
        if (col.format === 'date' || col.format === 'datetime') {
          return value ? new Date(value) : '';
        }
        return value ?? '';
      })
    );
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = sheet.columns.map(col => ({ wch: Math.max(col.header.length, 15) }));
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31)); // Sheet names max 31 chars
  });
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Download files as ZIP
export const downloadAsZip = async (
  files: Array<{ name: string; url: string }>,
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  const zip = new JSZip();
  
  let completed = 0;
  const total = files.length;
  
  // Download all files and add to zip
  await Promise.all(
    files.map(async (file) => {
      try {
        const response = await fetch(file.url);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(file.name, blob);
        }
      } catch (error) {
        console.error(`Failed to download ${file.name}:`, error);
      } finally {
        completed++;
        onProgress?.(completed, total);
      }
    })
  );
  
  // Generate and download ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${zipFilename}.zip`);
};

// Generate filename with date range
export const generateFilename = (
  baseName: string,
  startDate?: Date,
  endDate?: Date
): string => {
  const datePart = startDate && endDate
    ? `_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`
    : `_${format(new Date(), 'yyyyMMdd')}`;
  
  return `${baseName}${datePart}`;
};

// Common column definitions for reports
export const commonColumns = {
  invoices: [
    { key: 'invoice_number', header: 'Factuurnummer' },
    { key: 'issue_date', header: 'Factuurdatum', format: 'date' as const },
    { key: 'due_date', header: 'Vervaldatum', format: 'date' as const },
    { key: 'customer_name', header: 'Klant' },
    { key: 'customer_email', header: 'Email' },
    { key: 'subtotal', header: 'Subtotaal', format: 'currency' as const },
    { key: 'tax_amount', header: 'BTW', format: 'currency' as const },
    { key: 'total', header: 'Totaal', format: 'currency' as const },
    { key: 'status', header: 'Status' },
    { key: 'payment_status', header: 'Betaalstatus' },
  ],
  
  orders: [
    { key: 'order_number', header: 'Ordernummer' },
    { key: 'created_at', header: 'Orderdatum', format: 'datetime' as const },
    { key: 'customer_name', header: 'Klant' },
    { key: 'customer_email', header: 'Email' },
    { key: 'subtotal', header: 'Subtotaal', format: 'currency' as const },
    { key: 'shipping_cost', header: 'Verzendkosten', format: 'currency' as const },
    { key: 'tax_amount', header: 'BTW', format: 'currency' as const },
    { key: 'total', header: 'Totaal', format: 'currency' as const },
    { key: 'status', header: 'Status' },
    { key: 'payment_status', header: 'Betaalstatus' },
  ],
  
  customers: [
    { key: 'first_name', header: 'Voornaam' },
    { key: 'last_name', header: 'Achternaam' },
    { key: 'company_name', header: 'Bedrijfsnaam' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Telefoon' },
    { key: 'customer_type', header: 'Type' },
    { key: 'vat_number', header: 'BTW-nummer' },
    { key: 'billing_street', header: 'Adres' },
    { key: 'billing_postal_code', header: 'Postcode' },
    { key: 'billing_city', header: 'Plaats' },
    { key: 'billing_country', header: 'Land' },
    { key: 'total_orders', header: 'Aantal orders', format: 'number' as const },
    { key: 'total_spent', header: 'Totaal besteed', format: 'currency' as const },
    { key: 'created_at', header: 'Klant sinds', format: 'date' as const },
  ],
  
  products: [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Productnaam' },
    { key: 'category_name', header: 'Categorie' },
    { key: 'price', header: 'Prijs', format: 'currency' as const },
    { key: 'cost_price', header: 'Kostprijs', format: 'currency' as const },
    { key: 'stock', header: 'Voorraad', format: 'number' as const },
    { key: 'low_stock_threshold', header: 'Min. voorraad', format: 'number' as const },
    { key: 'vat_rate', header: 'BTW %', format: 'percentage' as const },
    { key: 'is_active', header: 'Actief' },
  ],
  
  creditNotes: [
    { key: 'credit_note_number', header: 'Creditnotanummer' },
    { key: 'issue_date', header: 'Datum', format: 'date' as const },
    { key: 'original_invoice_number', header: 'Originele factuur' },
    { key: 'customer_name', header: 'Klant' },
    { key: 'reason', header: 'Reden' },
    { key: 'subtotal', header: 'Subtotaal', format: 'currency' as const },
    { key: 'tax_amount', header: 'BTW', format: 'currency' as const },
    { key: 'total', header: 'Totaal', format: 'currency' as const },
    { key: 'status', header: 'Status' },
  ],
  
  subscriptions: [
    { key: 'name', header: 'Naam' },
    { key: 'customer_name', header: 'Klant' },
    { key: 'customer_email', header: 'Email' },
    { key: 'amount', header: 'Bedrag', format: 'currency' as const },
    { key: 'interval', header: 'Interval' },
    { key: 'status', header: 'Status' },
    { key: 'start_date', header: 'Startdatum', format: 'date' as const },
    { key: 'next_billing_date', header: 'Volgende facturatie', format: 'date' as const },
    { key: 'created_at', header: 'Aangemaakt', format: 'date' as const },
  ],
};
