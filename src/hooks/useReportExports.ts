import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  generateCSV, 
  generateExcel, 
  generateExcelWithEmptyState,
  downloadAsZip,
  generateFilename,
  commonColumns,
  ExportFormat 
} from '@/lib/exportUtils';
import { toast } from 'sonner';

interface DateRange {
  from: Date;
  to: Date;
}

// Hook for invoice exports
export const useInvoiceExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportInvoices = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          orders!inner(customer_name, customer_email),
          customers(first_name, last_name, company_name, email)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('issue_date', dateRange.from.toISOString())
        .lte('issue_date', dateRange.to.toISOString())
        .order('issue_date', { ascending: false });

      if (error) throw error;

      const exportData = data.map(inv => ({
        ...inv,
        customer_name: inv.orders?.customer_name || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim() || inv.customers?.company_name || '',
        customer_email: inv.orders?.customer_email || inv.customers?.email || '',
      }));

      const filename = generateFilename('facturen', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, commonColumns.invoices, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, commonColumns.invoices, filename, 'Facturen');
      }

      toast.success(`${exportData.length} facturen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportInvoices, isExporting };
};

// Hook for bulk PDF download
export const useBulkPdfDownload = () => {
  const { currentTenant } = useTenant();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const downloadInvoicePdfs = async (dateRange: DateRange) => {
    if (!currentTenant) return;
    setIsDownloading(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number, pdf_url')
        .eq('tenant_id', currentTenant.id)
        .gte('issue_date', dateRange.from.toISOString())
        .lte('issue_date', dateRange.to.toISOString())
        .not('pdf_url', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info('Geen facturen gevonden met PDF');
        return;
      }

      const files = data.map(inv => ({
        name: `${inv.invoice_number}.pdf`,
        url: inv.pdf_url!,
      }));

      setProgress({ current: 0, total: files.length });

      const filename = generateFilename('facturen_pdfs', dateRange.from, dateRange.to);
      await downloadAsZip(files, filename, (current, total) => {
        setProgress({ current, total });
      });

      toast.success(`${files.length} PDF's gedownload`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download mislukt');
    } finally {
      setIsDownloading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const downloadInvoiceUbls = async (dateRange: DateRange) => {
    if (!currentTenant) return;
    setIsDownloading(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number, ubl_url')
        .eq('tenant_id', currentTenant.id)
        .gte('issue_date', dateRange.from.toISOString())
        .lte('issue_date', dateRange.to.toISOString())
        .not('ubl_url', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info('Geen facturen gevonden met UBL');
        return;
      }

      const files = data.map(inv => ({
        name: `${inv.invoice_number}.xml`,
        url: inv.ubl_url!,
      }));

      setProgress({ current: 0, total: files.length });

      const filename = generateFilename('facturen_ubl', dateRange.from, dateRange.to);
      await downloadAsZip(files, filename, (current, total) => {
        setProgress({ current, total });
      });

      toast.success(`${files.length} UBL bestanden gedownload`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download mislukt');
    } finally {
      setIsDownloading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return { downloadInvoicePdfs, downloadInvoiceUbls, isDownloading, progress };
};

// Hook for order exports
export const useOrderExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportOrders = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filename = generateFilename('bestellingen', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(data, commonColumns.orders, filename);
      } else if (format === 'xlsx') {
        generateExcel(data, commonColumns.orders, filename, 'Bestellingen');
      }

      toast.success(`${data.length} bestellingen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportOrders, isExporting };
};

// Hook for customer exports
export const useCustomerExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportCustomers = async (format: ExportFormat, customerType?: 'b2b' | 'b2c' | 'all') => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (customerType === 'b2b') {
        query = query.eq('customer_type', 'business');
      } else if (customerType === 'b2c') {
        query = query.eq('customer_type', 'individual');
      }

      const { data, error } = await query;

      if (error) throw error;

      const typeLabel = customerType === 'b2b' ? '_b2b' : customerType === 'b2c' ? '_b2c' : '';
      const filename = generateFilename(`klanten${typeLabel}`);

      if (format === 'csv') {
        generateCSV(data, commonColumns.customers, filename);
      } else if (format === 'xlsx') {
        generateExcel(data, commonColumns.customers, filename, 'Klanten');
      }

      toast.success(`${data.length} klanten geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  const exportTopCustomers = async (dateRange: DateRange, format: ExportFormat, limit: number = 50) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          total,
          customer_id,
          customers(id, first_name, last_name, company_name, email, customer_type, vat_number)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'paid')
        .gte('issue_date', dateRange.from.toISOString())
        .lte('issue_date', dateRange.to.toISOString());

      if (error) throw error;

      // Aggregate by customer
      const customerTotals = new Map<string, { customer: any; total: number; orderCount: number }>();
      
      invoices.forEach(inv => {
        if (!inv.customer_id || !inv.customers) return;
        const existing = customerTotals.get(inv.customer_id);
        if (existing) {
          existing.total += inv.total || 0;
          existing.orderCount += 1;
        } else {
          customerTotals.set(inv.customer_id, {
            customer: inv.customers,
            total: inv.total || 0,
            orderCount: 1,
          });
        }
      });

      const totalRevenue = Array.from(customerTotals.values()).reduce((sum, c) => sum + c.total, 0);

      const topCustomers = Array.from(customerTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
        .map((item, index) => ({
          rank: index + 1,
          customer_name: item.customer.company_name || `${item.customer.first_name || ''} ${item.customer.last_name || ''}`.trim(),
          email: item.customer.email,
          customer_type: item.customer.customer_type,
          vat_number: item.customer.vat_number,
          total_revenue: item.total,
          order_count: item.orderCount,
          percentage_of_total: (item.total / totalRevenue) * 100,
        }));

      const columns = [
        { key: 'rank', header: 'Rang', format: 'number' as const },
        { key: 'customer_name', header: 'Klant' },
        { key: 'email', header: 'Email' },
        { key: 'customer_type', header: 'Type' },
        { key: 'vat_number', header: 'BTW-nummer' },
        { key: 'total_revenue', header: 'Omzet', format: 'currency' as const },
        { key: 'order_count', header: 'Aantal orders', format: 'number' as const },
        { key: 'percentage_of_total', header: '% van totaal', format: 'percentage' as const },
      ];

      const filename = generateFilename('top_klanten', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(topCustomers, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(topCustomers, columns, filename, 'Top Klanten');
      }

      toast.success(`Top ${topCustomers.length} klanten geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCustomers, exportTopCustomers, isExporting };
};

// Hook for product exports
export const useProductExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportProducts = async (format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;

      const exportData = data.map(p => ({
        ...p,
        category_name: p.categories?.name || '',
        vat_rate: (p as any).vat_rate || 21,
      }));

      const filename = generateFilename('producten');

      if (format === 'csv') {
        generateCSV(exportData, commonColumns.products, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, commonColumns.products, filename, 'Producten');
      }

      toast.success(`${data.length} producten geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  const exportLowStock = async (format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('track_inventory', true)
        .order('stock', { ascending: true });

      if (error) throw error;

      // Filter products where stock is below threshold
      const lowStockProducts = data.filter(p => 
        p.stock !== null && 
        p.low_stock_threshold !== null && 
        p.stock <= p.low_stock_threshold
      ).map(p => ({
        ...p,
        category_name: p.categories?.name || '',
        vat_rate: (p as any).vat_rate || 21,
      }));

      const filename = generateFilename('lage_voorraad');

      if (format === 'csv') {
        generateCSV(lowStockProducts, commonColumns.products, filename);
      } else if (format === 'xlsx') {
        generateExcel(lowStockProducts, commonColumns.products, filename, 'Lage Voorraad');
      }

      toast.success(`${lowStockProducts.length} producten met lage voorraad geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportProducts, exportLowStock, isExporting };
};

// Hook for credit note exports
export const useCreditNoteExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportCreditNotes = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          invoices(invoice_number),
          customers(first_name, last_name, company_name, email)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('issue_date', dateRange.from.toISOString())
        .lte('issue_date', dateRange.to.toISOString())
        .order('issue_date', { ascending: false });

      if (error) throw error;

      const exportData = data.map(cn => ({
        ...cn,
        original_invoice_number: cn.invoices?.invoice_number || '',
        customer_name: cn.customers?.company_name || `${cn.customers?.first_name || ''} ${cn.customers?.last_name || ''}`.trim(),
      }));

      const filename = generateFilename('creditnotas', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, commonColumns.creditNotes, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, commonColumns.creditNotes, filename, 'Creditnota\'s');
      }

      toast.success(`${data.length} creditnota's geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCreditNotes, isExporting };
};

// Hook for subscription exports
export const useSubscriptionExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportSubscriptions = async (format: ExportFormat, status?: string) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      let query = supabase
        .from('subscriptions')
        .select(`
          *,
          customers(first_name, last_name, company_name, email)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      const exportData = data.map(sub => ({
        ...sub,
        customer_name: sub.customers?.company_name || `${sub.customers?.first_name || ''} ${sub.customers?.last_name || ''}`.trim(),
        customer_email: sub.customers?.email || '',
      }));

      const statusLabel = status ? `_${status}` : '';
      const filename = generateFilename(`abonnementen${statusLabel}`);

      if (format === 'csv') {
        generateCSV(exportData, commonColumns.subscriptions, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, commonColumns.subscriptions, filename, 'Abonnementen');
      }

      toast.success(`${data.length} abonnementen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportSubscriptions, isExporting };
};

// Hook for aging report
export const useAgingExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportAgingReport = async (format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers(first_name, last_name, company_name, email, phone),
          orders(customer_name, customer_email)
        `)
        .eq('tenant_id', currentTenant.id)
        .in('status', ['sent']);

      if (error) throw error;

      const now = new Date();
      const EM = '—';
      const agingData = (data || []).map(inv => {
        const hasDue = !!inv.due_date;
        const daysOverdue = hasDue
          ? Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let agingBucket: string;
        if (!hasDue) {
          agingBucket = 'Geen vervaldatum';
        } else if (daysOverdue! < 0) {
          agingBucket = 'Nog niet vervallen';
        } else if (daysOverdue! > 90) {
          agingBucket = '90+ dagen';
        } else if (daysOverdue! > 60) {
          agingBucket = '61-90 dagen';
        } else if (daysOverdue! > 30) {
          agingBucket = '31-60 dagen';
        } else {
          agingBucket = '0-30 dagen';
        }

        const customerName =
          inv.customers?.company_name
          || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim()
          || inv.orders?.customer_name
          || inv.customers?.email
          || inv.orders?.customer_email
          || '—';

        return {
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date || inv.created_at,
          due_date: hasDue
            ? new Date(inv.due_date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : EM,
          customer_name: customerName,
          customer_email: inv.customers?.email || inv.orders?.customer_email || '',
          customer_phone: inv.customers?.phone || '',
          total: inv.total,
          days_overdue: hasDue ? Math.max(0, daysOverdue!) : EM,
          aging_bucket: agingBucket,
          status: inv.status,
        };
      });

      // Sort: with due_date first (DESC by days overdue), then without due_date at bottom
      agingData.sort((a, b) => {
        const aHas = a.days_overdue !== EM;
        const bHas = b.days_overdue !== EM;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (!aHas && !bHas) return 0;
        return Number(b.days_overdue) - Number(a.days_overdue);
      });

      // Hide Email + Telefoon columns if both are empty for all rows
      const anyEmail = agingData.some(r => r.customer_email);
      const anyPhone = agingData.some(r => r.customer_phone);

      const columns = [
        { key: 'invoice_number', header: 'Factuurnummer' },
        { key: 'issue_date', header: 'Factuurdatum', format: 'date' as const },
        { key: 'due_date', header: 'Vervaldatum' },
        { key: 'customer_name', header: 'Klant' },
        ...(anyEmail ? [{ key: 'customer_email', header: 'Email' }] : []),
        ...(anyPhone ? [{ key: 'customer_phone', header: 'Telefoon' }] : []),
        { key: 'total', header: 'Bedrag', format: 'currency' as const },
        { key: 'days_overdue', header: 'Dagen over tijd' }, // no format → mixed number/em-dash
        { key: 'aging_bucket', header: 'Categorie' },
        { key: 'status', header: 'Status' },
      ];

      const filename = generateFilename('openstaande_facturen');

      if (format === 'csv') {
        generateCSV(agingData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(agingData, columns, filename, 'Openstaand');
      }

      toast.success(`${agingData.length} openstaande facturen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportAgingReport, isExporting };
};

// Hook for VAT export
export const useVatExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);
  const [isBundling, setIsBundling] = useState(false);

  // Shared binary download via direct fetch (supabase.functions.invoke corrupts binaries).
  const binaryDownload = async (
    fnName: string,
    body: Record<string, unknown>,
    fallbackName: string,
    mimeType: string,
  ) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${fnName} failed: ${response.status} ${errText}`);
    }
    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: mimeType });
    const cd = response.headers.get('content-disposition') ?? '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m?.[1] ?? fallbackName;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Facade — delegates to canonical vat-report-engine edge function.
  const exportVatReport = async (
    dateRange: DateRange & { type?: 'monthly' | 'quarterly' | 'annual' | 'custom' },
    format: ExportFormat
  ) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const toIso = (d: Date) => d.toISOString().split('T')[0];
      const periodType = dateRange.type ?? 'quarterly';

      const slug = (currentTenant.name || 'tenant')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const y = dateRange.from.getFullYear();
      let pCode = `${toIso(dateRange.from)}_to_${toIso(dateRange.to)}`;
      if (periodType === 'quarterly') {
        const q = Math.floor(dateRange.from.getMonth() / 3) + 1;
        pCode = `${y}-Q${q}`;
      } else if (periodType === 'monthly') {
        pCode = `${y}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}`;
      } else if (periodType === 'annual') {
        pCode = `${y}`;
      }

      const baseBody = {
        tenant_id: currentTenant.id,
        period_start: toIso(dateRange.from),
        period_end: toIso(dateRange.to),
        period_type: periodType,
      };

      if (format === 'intervat-xml') {
        await binaryDownload(
          'export-vat-xml',
          baseBody,
          `SellQo_INTERVAT_BTW-aangifte_${slug}_${pCode}.xml`,
          'application/xml',
        );
        toast.success('INTERVAT XML gedownload');
        return;
      }

      if (format === 'odoo-csv') {
        await binaryDownload(
          'export-odoo-csv',
          baseBody,
          `SellQo_Odoo_${slug}_${pCode}.zip`,
          'application/zip',
        );
        toast.success('Odoo CSV-pakket gedownload');
        return;
      }

      // JSON → raw vat-report-engine payload, useful for accountants / audits.
      if (format === 'json') {
        const { data, error } = await supabase.functions.invoke('vat-report-engine', {
          body: { ...baseBody, include_drafts: false, include_audit_trail: true, force_recompute: false },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'vat-report-engine failed');
        const blob = new Blob([JSON.stringify(data.payload, null, 2)], { type: 'application/json' });
        saveAs(blob, `SellQo_BTW-aangifte_${slug}_${pCode}.json`);
        toast.success('BTW-aangifte JSON gedownload');
        return;
      }

      // XLSX → delegate to canonical 9-tab export-vat-xlsx edge function.
      // Use direct fetch + arrayBuffer to preserve binary integrity
      // (supabase.functions.invoke corrupts XLSX by attempting JSON/text decode).
      if (format === 'xlsx') {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/export-vat-xlsx`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: currentTenant.id,
            period_start: toIso(dateRange.from),
            period_end: toIso(dateRange.to),
            period_type: periodType,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Export failed: ${response.status} ${errText}`);
        }

        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        // Fallback filename matching edge fn convention
        const slug = (currentTenant.name || 'tenant')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const y = dateRange.from.getFullYear();
        let periodCode = `${toIso(dateRange.from)}_to_${toIso(dateRange.to)}`;
        if (periodType === 'quarterly') {
          const q = Math.floor(dateRange.from.getMonth() / 3) + 1;
          periodCode = `${y}-Q${q}`;
        } else if (periodType === 'monthly') {
          periodCode = `${y}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}`;
        } else if (periodType === 'annual') {
          periodCode = `${y}`;
        }
        const fallbackName = `SellQo_BTW-aangifte_${slug}_${periodCode}.xlsx`;

        const contentDisposition = response.headers.get('content-disposition') ?? '';
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const filename = filenameMatch?.[1] ?? fallbackName;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('BTW-aangifte (9 tabs) geëxporteerd');
        return;
      }

      // PDF → delegate to export-vat-pdf edge function. Binary fetch to
      // preserve PDF integrity (supabase.functions.invoke corrupts binary).
      if (format === 'pdf') {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/export-vat-pdf`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: currentTenant.id,
            period_start: toIso(dateRange.from),
            period_end: toIso(dateRange.to),
            period_type: periodType,
          }),
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`PDF export failed: ${response.status} ${errText}`);
        }
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: 'application/pdf' });

        const slug = (currentTenant.name || 'tenant')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const y = dateRange.from.getFullYear();
        let pCode = `${toIso(dateRange.from)}_to_${toIso(dateRange.to)}`;
        if (periodType === 'quarterly') {
          const q = Math.floor(dateRange.from.getMonth() / 3) + 1;
          pCode = `${y}-Q${q}`;
        } else if (periodType === 'monthly') {
          pCode = `${y}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}`;
        } else if (periodType === 'annual') {
          pCode = `${y}`;
        }
        const fallbackName = `SellQo_BTW-aangifte_${slug}_${pCode}.pdf`;
        const cd = response.headers.get('content-disposition') ?? '';
        const m = cd.match(/filename="?([^"]+)"?/);
        const filename = m?.[1] ?? fallbackName;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('BTW-aangifte PDF gedownload');
        return;
      }

      // CSV (and any other non-xlsx text format) → use engine payload directly
      const { data, error } = await supabase.functions.invoke('vat-report-engine', {
        body: {
          tenant_id: currentTenant.id,
          period_start: toIso(dateRange.from),
          period_end: toIso(dateRange.to),
          period_type: periodType,
          include_drafts: false,
          include_audit_trail: false,
          force_recompute: false,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'vat-report-engine failed');

      const payload = data.payload as {
        declaration_boxes: Record<string, { amount: number; vat: number; source_invoice_count: number; source_line_count: number }>;
        metadata: { invoice_count: number; credit_note_count: number };
        warnings: string[];
      };

      const boxes = payload.declaration_boxes || {};
      const exportRows = Object.keys(boxes)
        .sort()
        .map(code => ({
          box: code,
          base_amount: boxes[code].amount,
          vat_amount: boxes[code].vat,
          invoice_count: boxes[code].source_invoice_count,
          line_count: boxes[code].source_line_count,
        }));

      const columns = [
        { key: 'box', header: 'Vak' },
        { key: 'base_amount', header: 'Maatstaf', format: 'currency' as const },
        { key: 'vat_amount', header: 'BTW', format: 'currency' as const },
        { key: 'invoice_count', header: '# Facturen', format: 'number' as const },
        { key: 'line_count', header: '# Lijnen', format: 'number' as const },
      ];

      const filename = generateFilename('btw_aangifte', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportRows, columns, filename);
      }

      if (payload.warnings?.length) {
        console.warn('[vat-report-engine] warnings:', payload.warnings);
      }
      toast.success(`BTW-aangifte geëxporteerd (${payload.metadata.invoice_count} facturen)`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  // Facade — delegates to canonical vat-report-engine edge function.
  const exportIcListing = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const toIso = (d: Date) => d.toISOString().split('T')[0];

      if (format === 'intervat-xml') {
        try {
          const slug = (currentTenant.name || 'tenant')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          await binaryDownload(
            'export-ic-listing-xml',
            {
              tenant_id: currentTenant.id,
              period_start: toIso(dateRange.from),
              period_end: toIso(dateRange.to),
              period_type: 'custom',
            },
            `SellQo_INTERVAT_IC-Listing_${slug}.xml`,
            'application/xml',
          );
          toast.success('IC-Listing INTERVAT XML gedownload');
        } finally {
          setIsExporting(false);
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke('vat-report-engine', {
        body: {
          tenant_id: currentTenant.id,
          period_start: toIso(dateRange.from),
          period_end: toIso(dateRange.to),
          period_type: 'custom',
          include_drafts: false,
          include_audit_trail: false,
          force_recompute: false,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'vat-report-engine failed');

      const payload = data.payload as {
        ic_listing: Array<{ vat_number: string; country_code: string; company_name: string; amount: number; type_code: 'L' | 'T' | 'S' }>;
      };

      const icRows = (payload.ic_listing || []).map(entry => ({
        country: entry.country_code,
        vat_number: entry.vat_number,
        company_name: entry.company_name,
        type_code: entry.type_code,
        amount: entry.amount,
      }));

      const columns = [
        { key: 'country', header: 'Landcode' },
        { key: 'vat_number', header: 'BTW-nummer' },
        { key: 'company_name', header: 'Bedrijfsnaam' },
        { key: 'type_code', header: 'Type (L/T/S)' },
        { key: 'amount', header: 'Bedrag', format: 'currency' as const },
      ];

      const filename = generateFilename('ic_listing', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(icRows, columns, filename);
      } else if (format === 'xlsx') {
        generateExcelWithEmptyState(
          icRows,
          columns,
          filename,
          'IC-Listing',
          'Geen IC-leveringen in deze periode',
          'Note: zodra IC-leveringen worden geregistreerd, verschijnen ze hier én in INTERVAT XML',
        );
      } else if (format === 'pdf') {
        // Minimal client-side PDF rendering of IC-Listing using browser print-to-PDF
        // is out of scope; fall back to XLSX for richer formatting.
        generateExcelWithEmptyState(
          icRows, columns, filename, 'IC-Listing',
          'Geen IC-leveringen in deze periode',
          'PDF nog niet ondersteund — XLSX gegenereerd als alternatief',
        );
        toast.info('PDF nog niet ondersteund voor IC-Listing — XLSX gegenereerd');
      } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(payload.ic_listing ?? [], null, 2)], { type: 'application/json' });
        saveAs(blob, `${filename}.json`);
      }

      toast.success(`IC-Listing met ${icRows.length} klanten geëxporteerd`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  const exportQBundle = async (
    dateRange: DateRange & { type?: 'monthly' | 'quarterly' | 'annual' | 'custom' },
  ) => {
    if (!currentTenant) return;
    setIsBundling(true);
    const toastId = toast.loading('Q-Pakket wordt samengesteld… (kan 5-15 sec duren)');
    try {
      const toIso = (d: Date) => d.toISOString().split('T')[0];
      const periodType = dateRange.type ?? 'quarterly';
      const slug = (currentTenant.name || 'tenant')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const y = dateRange.from.getFullYear();
      let pCode = `${toIso(dateRange.from)}_to_${toIso(dateRange.to)}`;
      if (periodType === 'quarterly') {
        const q = Math.floor(dateRange.from.getMonth() / 3) + 1;
        pCode = `${y}-Q${q}`;
      } else if (periodType === 'monthly') {
        pCode = `${y}-${String(dateRange.from.getMonth() + 1).padStart(2, '0')}`;
      } else if (periodType === 'annual') {
        pCode = `${y}`;
      }
      await binaryDownload(
        'export-q-bundle',
        {
          tenant_id: currentTenant.id,
          period_start: toIso(dateRange.from),
          period_end: toIso(dateRange.to),
          period_type: periodType,
        },
        `SellQo_Q-Pakket_${slug}_${pCode}.zip`,
        'application/zip',
      );
      toast.success('Q-Pakket gedownload', { id: toastId });
    } catch (err) {
      console.error('Q-Bundle error:', err);
      toast.error('Q-Pakket samenstellen mislukt', { id: toastId });
    } finally {
      setIsBundling(false);
    }
  };

  return { exportVatReport, exportIcListing, exportQBundle, isExporting, isBundling };
};

// Hook for revenue report
export const useRevenueExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportRevenueReport = async (dateRange: DateRange, format: ExportFormat, granularity: 'day' | 'week' | 'month' = 'month') => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      // Use issue_date (accounting date), not created_at; include both sent and paid
      // invoices so revenue is recognised on issue. End-date is end-of-day inclusive.
      const endInclusive = new Date(dateRange.to);
      endInclusive.setHours(23, 59, 59, 999);
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('issue_date, subtotal, tax_amount, total, status')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['sent', 'paid'])
        .gte('issue_date', dateRange.from.toISOString().slice(0, 10))
        .lte('issue_date', endInclusive.toISOString().slice(0, 10))
        .order('issue_date');

      if (error) throw error;

      // Group by period
      const periodTotals = new Map<string, { revenue: number; vat: number; count: number }>();
      
      invoices.forEach(inv => {
        const date = new Date(inv.issue_date);
        let periodKey: string;
        
        if (granularity === 'day') {
          periodKey = date.toISOString().split('T')[0];
        } else if (granularity === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay() + 1);
          periodKey = weekStart.toISOString().split('T')[0];
        } else {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        const existing = periodTotals.get(periodKey);
        if (existing) {
          existing.revenue += inv.total || 0;
          existing.vat += inv.tax_amount || 0;
          existing.count += 1;
        } else {
          periodTotals.set(periodKey, {
            revenue: inv.total || 0,
            vat: inv.tax_amount || 0,
            count: 1,
          });
        }
      });

      const revenueData = Array.from(periodTotals.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, data]) => ({
          period,
          revenue: data.revenue,
          vat: data.vat,
          net_revenue: data.revenue - data.vat,
          invoice_count: data.count,
          average_order: data.revenue / data.count,
        }));

      const columns = [
        { key: 'period', header: 'Periode' },
        { key: 'revenue', header: 'Bruto omzet', format: 'currency' as const },
        { key: 'vat', header: 'BTW', format: 'currency' as const },
        { key: 'net_revenue', header: 'Netto omzet', format: 'currency' as const },
        { key: 'invoice_count', header: 'Aantal facturen', format: 'number' as const },
        { key: 'average_order', header: 'Gem. orderbedrag', format: 'currency' as const },
      ];

      const filename = generateFilename(`omzet_${granularity}`, dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(revenueData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(revenueData, columns, filename, 'Omzet');
      }

      toast.success('Omzetrapport geëxporteerd');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportRevenueReport, isExporting };
};

// Hook for supplier exports
export const useSupplierExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportSuppliers = async (format: ExportFormat, onlyActive: boolean = false) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      let query = supabase
        .from('suppliers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (onlyActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      const filename = generateFilename(onlyActive ? 'leveranciers_actief' : 'leveranciers');

      if (format === 'csv') {
        generateCSV(data, commonColumns.suppliers, filename);
      } else if (format === 'xlsx') {
        generateExcel(data, commonColumns.suppliers, filename, 'Leveranciers');
      }

      toast.success(`${data.length} leveranciers geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportSuppliers, isExporting };
};

// Hook for purchase order exports
export const usePurchaseOrderExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportPurchaseOrders = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers(name)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('order_date', dateRange.from.toISOString())
        .lte('order_date', dateRange.to.toISOString())
        .order('order_date', { ascending: false });

      if (error) throw error;

      const exportData = (data || []).map(po => ({
        ...po,
        supplier_name: po.suppliers?.name || '',
      }));

      const filename = generateFilename('inkooporders', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, commonColumns.purchaseOrders, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, commonColumns.purchaseOrders, filename, 'Inkooporders');
      }

      toast.success(`${exportData.length} inkooporders geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPurchaseOrders, isExporting };
};

// Hook for supplier document exports
export const useSupplierDocumentExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportSupplierDocuments = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select(`
          *,
          suppliers(name)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('document_date', dateRange.from.toISOString())
        .lte('document_date', dateRange.to.toISOString())
        .order('document_date', { ascending: false });

      if (error) throw error;

      const exportData = (data || []).map(doc => ({
        ...doc,
        supplier_name: doc.suppliers?.name || '',
      }));

      const filename = generateFilename('inkoop_documenten', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, commonColumns.supplierDocuments, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, commonColumns.supplierDocuments, filename, 'Documenten');
      }

      toast.success(`${exportData.length} documenten geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCreditorAging = async (format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select(`
          *,
          suppliers(name, email, phone)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('document_type', 'invoice')
        .in('payment_status', ['pending', 'partial'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const agingData = data.map(doc => {
        const dueDate = doc.due_date ? new Date(doc.due_date) : now;
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let agingBucket = '0-30 dagen';
        if (daysOverdue > 90) agingBucket = '90+ dagen';
        else if (daysOverdue > 60) agingBucket = '61-90 dagen';
        else if (daysOverdue > 30) agingBucket = '31-60 dagen';
        else if (daysOverdue < 0) agingBucket = 'Nog niet vervallen';

        return {
          document_number: doc.document_number,
          supplier_name: doc.suppliers?.name || '',
          supplier_email: doc.suppliers?.email || '',
          document_date: doc.document_date,
          due_date: doc.due_date,
          total_amount: doc.total_amount,
          days_overdue: Math.max(0, daysOverdue),
          aging_bucket: agingBucket,
          payment_status: doc.payment_status,
        };
      });

      const columns = [
        { key: 'document_number', header: 'Documentnummer' },
        { key: 'supplier_name', header: 'Leverancier' },
        { key: 'supplier_email', header: 'Email' },
        { key: 'document_date', header: 'Factuurdatum', format: 'date' as const },
        { key: 'due_date', header: 'Vervaldatum', format: 'date' as const },
        { key: 'total_amount', header: 'Bedrag', format: 'currency' as const },
        { key: 'days_overdue', header: 'Dagen over tijd', format: 'number' as const },
        { key: 'aging_bucket', header: 'Categorie' },
        { key: 'payment_status', header: 'Status' },
      ];

      const filename = generateFilename('openstaande_crediteuren');

      if (format === 'csv') {
        generateCSV(agingData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(agingData, columns, filename, 'Crediteuren');
      }

      toast.success(`${agingData.length} openstaande crediteuren geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportSupplierDocuments, exportCreditorAging, isExporting };
};

// Hook for top suppliers export
export const useTopSuppliersExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportTopSuppliers = async (dateRange: DateRange, format: ExportFormat, limit: number = 50) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data: purchaseOrders, error } = await supabase
        .from('purchase_orders')
        .select(`
          total,
          supplier_id,
          suppliers(id, name, email, contact_person)
        `)
        .eq('tenant_id', currentTenant.id)
        .in('status', ['received', 'partially_received'] as const)
        .gte('order_date', dateRange.from.toISOString())
        .lte('order_date', dateRange.to.toISOString());

      if (error) throw error;

      // Aggregate by supplier
      const supplierTotals = new Map<string, { supplier: any; total: number; orderCount: number }>();
      
      purchaseOrders.forEach(po => {
        if (!po.supplier_id || !po.suppliers) return;
        const existing = supplierTotals.get(po.supplier_id);
        if (existing) {
          existing.total += po.total || 0;
          existing.orderCount += 1;
        } else {
          supplierTotals.set(po.supplier_id, {
            supplier: po.suppliers,
            total: po.total || 0,
            orderCount: 1,
          });
        }
      });

      const totalPurchases = Array.from(supplierTotals.values()).reduce((sum, s) => sum + s.total, 0);

      const topSuppliers = Array.from(supplierTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
        .map((item, index) => ({
          rank: index + 1,
          supplier_name: item.supplier.name,
          contact_person: item.supplier.contact_person,
          email: item.supplier.email,
          total_purchases: item.total,
          order_count: item.orderCount,
          percentage_of_total: totalPurchases > 0 ? (item.total / totalPurchases) * 100 : 0,
        }));

      const columns = [
        { key: 'rank', header: 'Rang', format: 'number' as const },
        { key: 'supplier_name', header: 'Leverancier' },
        { key: 'contact_person', header: 'Contactpersoon' },
        { key: 'email', header: 'Email' },
        { key: 'total_purchases', header: 'Inkoopvolume', format: 'currency' as const },
        { key: 'order_count', header: 'Aantal orders', format: 'number' as const },
        { key: 'percentage_of_total', header: '% van totaal', format: 'percentage' as const },
      ];

      const filename = generateFilename('top_leveranciers', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(topSuppliers, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(topSuppliers, columns, filename, 'Top Leveranciers');
      }

      toast.success(`Top ${topSuppliers.length} leveranciers geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportTopSuppliers, isExporting };
};

// Hook for bulk supplier document download
export const useBulkSupplierDocumentDownload = () => {
  const { currentTenant } = useTenant();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const downloadSupplierDocuments = async (dateRange: DateRange) => {
    if (!currentTenant) return;
    setIsDownloading(true);

    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select('document_number, file_url, suppliers(name)')
        .eq('tenant_id', currentTenant.id)
        .gte('document_date', dateRange.from.toISOString())
        .lte('document_date', dateRange.to.toISOString())
        .not('file_url', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info('Geen documenten gevonden met bestanden');
        return;
      }

      const files = data.map(doc => ({
        name: `${doc.suppliers?.name || 'onbekend'}_${doc.document_number}.pdf`,
        url: doc.file_url!,
      }));

      setProgress({ current: 0, total: files.length });

      const filename = generateFilename('leveranciersdocumenten', dateRange.from, dateRange.to);
      await downloadAsZip(files, filename, (current, total) => {
        setProgress({ current, total });
      });

      toast.success(`${files.length} documenten gedownload`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download mislukt');
    } finally {
      setIsDownloading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return { downloadSupplierDocuments, isDownloading, progress };
};

// Hook for POS session exports
export const usePOSSessionExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportSessions = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('pos_sessions')
        .select(`
          *,
          pos_terminals(name, location_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('opened_at', dateRange.from.toISOString())
        .lte('opened_at', dateRange.to.toISOString())
        .order('opened_at', { ascending: false });

      if (error) throw error;

      const exportData = data.map(session => ({
        terminal_name: session.pos_terminals?.name || '',
        location: session.pos_terminals?.location_name || '',
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        status: session.status,
        opening_cash: session.opening_cash,
        closing_cash: session.closing_cash,
        expected_cash: session.expected_cash,
        cash_difference: session.cash_difference,
        notes: session.notes,
      }));

      const columns = [
        { key: 'terminal_name', header: 'Terminal' },
        { key: 'location', header: 'Locatie' },
        { key: 'opened_at', header: 'Geopend', format: 'datetime' as const },
        { key: 'closed_at', header: 'Gesloten', format: 'datetime' as const },
        { key: 'status', header: 'Status' },
        { key: 'opening_cash', header: 'Startbedrag', format: 'currency' as const },
        { key: 'closing_cash', header: 'Eindbedrag', format: 'currency' as const },
        { key: 'expected_cash', header: 'Verwacht', format: 'currency' as const },
        { key: 'cash_difference', header: 'Verschil', format: 'currency' as const },
        { key: 'notes', header: 'Opmerkingen' },
      ];

      const filename = generateFilename('kassa_sessies', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, columns, filename, 'Kassa Sessies');
      }

      toast.success(`${exportData.length} sessies geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportSessions, isExporting };
};

// Hook for POS transaction exports
export const usePOSTransactionExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportTransactions = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('pos_transactions')
        .select(`
          *,
          pos_terminals(name)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const exportData = data.map(tx => {
        const payments = tx.payments as Array<{ method: string; amount: number }> | null;
        const cashPayment = payments?.find((p: { method: string }) => p.method === 'cash')?.amount || 0;
        const cardPayment = payments?.find((p: { method: string }) => p.method === 'card')?.amount || 0;
        
        return {
          receipt_number: tx.receipt_number,
          terminal_name: tx.pos_terminals?.name || '',
          created_at: tx.created_at,
          status: tx.status,
          subtotal: tx.subtotal,
          discount_total: tx.discount_total,
          tax_total: tx.tax_total,
          total: tx.total,
          cash_payment: cashPayment,
          card_payment: cardPayment,
          card_brand: tx.card_brand,
          card_last4: tx.card_last4,
          items_count: (tx.items as unknown[])?.length || 0,
        };
      });

      const columns = [
        { key: 'receipt_number', header: 'Bonnummer' },
        { key: 'terminal_name', header: 'Terminal' },
        { key: 'created_at', header: 'Datum/Tijd', format: 'datetime' as const },
        { key: 'status', header: 'Status' },
        { key: 'subtotal', header: 'Subtotaal', format: 'currency' as const },
        { key: 'discount_total', header: 'Korting', format: 'currency' as const },
        { key: 'tax_total', header: 'BTW', format: 'currency' as const },
        { key: 'total', header: 'Totaal', format: 'currency' as const },
        { key: 'cash_payment', header: 'Contant', format: 'currency' as const },
        { key: 'card_payment', header: 'PIN/Kaart', format: 'currency' as const },
        { key: 'card_brand', header: 'Kaartmerk' },
        { key: 'card_last4', header: 'Laatste 4' },
        { key: 'items_count', header: 'Aantal items', format: 'number' as const },
      ];

      const filename = generateFilename('kassa_transacties', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, columns, filename, 'Transacties');
      }

      toast.success(`${exportData.length} transacties geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  const exportDailySummary = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('pos_transactions')
        .select(`
          created_at,
          total,
          payments,
          status
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'completed')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (error) throw error;

      // Group by date
      const dailyData = new Map<string, { 
        date: string; 
        transactions: number; 
        total: number; 
        cash: number; 
        card: number 
      }>();

      data.forEach(tx => {
        const date = new Date(tx.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { 
          date, 
          transactions: 0, 
          total: 0, 
          cash: 0, 
          card: 0 
        };

        const payments = tx.payments as Array<{ method: string; amount: number }> | null;
        const cashPayment = payments?.find((p: { method: string }) => p.method === 'cash')?.amount || 0;
        const cardPayment = payments?.find((p: { method: string }) => p.method === 'card')?.amount || 0;

        existing.transactions += 1;
        existing.total += tx.total || 0;
        existing.cash += cashPayment;
        existing.card += cardPayment;

        dailyData.set(date, existing);
      });

      const exportData = Array.from(dailyData.values()).sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      const columns = [
        { key: 'date', header: 'Datum', format: 'date' as const },
        { key: 'transactions', header: 'Transacties', format: 'number' as const },
        { key: 'total', header: 'Totale Omzet', format: 'currency' as const },
        { key: 'cash', header: 'Contant', format: 'currency' as const },
        { key: 'card', header: 'PIN/Kaart', format: 'currency' as const },
      ];

      const filename = generateFilename('kassa_dagoverzicht', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, columns, filename, 'Dagoverzicht');
      }

      toast.success(`${exportData.length} dagen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportTransactions, exportDailySummary, isExporting };
};

// Hook for POS cash movement exports
export const usePOSCashMovementExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportCashMovements = async (dateRange: DateRange, format: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase
        .from('pos_cash_movements')
        .select(`
          *,
          pos_terminals(name),
          pos_sessions(opened_at)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const exportData = data.map(movement => ({
        terminal_name: movement.pos_terminals?.name || '',
        session_date: movement.pos_sessions?.opened_at,
        created_at: movement.created_at,
        movement_type: movement.movement_type === 'in' ? 'Storting' : 'Opname',
        amount: movement.amount,
        reason: movement.reason,
        notes: movement.notes,
      }));

      const columns = [
        { key: 'terminal_name', header: 'Terminal' },
        { key: 'session_date', header: 'Sessiedatum', format: 'date' as const },
        { key: 'created_at', header: 'Datum/Tijd', format: 'datetime' as const },
        { key: 'movement_type', header: 'Type' },
        { key: 'amount', header: 'Bedrag', format: 'currency' as const },
        { key: 'reason', header: 'Reden' },
        { key: 'notes', header: 'Opmerkingen' },
      ];

      const filename = generateFilename('kassa_mutaties', dateRange.from, dateRange.to);

      if (format === 'csv') {
        generateCSV(exportData, columns, filename);
      } else if (format === 'xlsx') {
        generateExcel(exportData, columns, filename, 'Kasmutaties');
      }

      toast.success(`${exportData.length} mutaties geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCashMovements, isExporting };
};
