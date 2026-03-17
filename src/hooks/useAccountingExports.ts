import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { 
  generateCSV, 
  generateExcel, 
  generateExcelMultiSheet,
  generateFilename,
  ExportFormat 
} from '@/lib/exportUtils';
import { toast } from 'sonner';
import { format, startOfQuarter, endOfQuarter, differenceInMinutes } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

// ── Winst & Verlies ──────────────────────────────────────────────
export const useProfitLossExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportProfitLoss = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [invoicesRes, supplierDocsRes, ordersRes] = await Promise.all([
        supabase.from('invoices')
          .select('created_at, subtotal, tax_amount, total')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'paid')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase.from('supplier_documents')
          .select('document_date, amount, tax_amount, total_amount')
          .eq('tenant_id', currentTenant.id)
          .eq('document_type', 'invoice')
          .eq('payment_status', 'paid')
          .gte('document_date', dateRange.from.toISOString())
          .lte('document_date', dateRange.to.toISOString()),
        supabase.from('orders')
          .select('created_at, shipping_cost')
          .eq('tenant_id', currentTenant.id)
          .eq('payment_status', 'paid')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (supplierDocsRes.error) throw supplierDocsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const monthlyData = new Map<string, {
        period: string; revenue: number; revenue_ex_vat: number; vat_collected: number;
        cost_of_goods: number; cost_vat: number; shipping_costs: number;
      }>();

      invoicesRes.data.forEach(inv => {
        const key = format(new Date(inv.created_at), 'yyyy-MM');
        const existing = monthlyData.get(key) || { period: key, revenue: 0, revenue_ex_vat: 0, vat_collected: 0, cost_of_goods: 0, cost_vat: 0, shipping_costs: 0 };
        existing.revenue += inv.total || 0;
        existing.revenue_ex_vat += inv.subtotal || 0;
        existing.vat_collected += inv.tax_amount || 0;
        monthlyData.set(key, existing);
      });

      supplierDocsRes.data.forEach(doc => {
        const key = format(new Date(doc.document_date), 'yyyy-MM');
        const existing = monthlyData.get(key) || { period: key, revenue: 0, revenue_ex_vat: 0, vat_collected: 0, cost_of_goods: 0, cost_vat: 0, shipping_costs: 0 };
        existing.cost_of_goods += doc.amount || 0;
        existing.cost_vat += doc.tax_amount || 0;
        monthlyData.set(key, existing);
      });

      ordersRes.data.forEach(order => {
        const key = format(new Date(order.created_at), 'yyyy-MM');
        const existing = monthlyData.get(key) || { period: key, revenue: 0, revenue_ex_vat: 0, vat_collected: 0, cost_of_goods: 0, cost_vat: 0, shipping_costs: 0 };
        existing.shipping_costs += order.shipping_cost || 0;
        monthlyData.set(key, existing);
      });

      const rows = Array.from(monthlyData.values())
        .sort((a, b) => a.period.localeCompare(b.period))
        .map(m => ({
          ...m,
          gross_margin: m.revenue_ex_vat - m.cost_of_goods,
          gross_margin_pct: m.revenue_ex_vat > 0 ? ((m.revenue_ex_vat - m.cost_of_goods) / m.revenue_ex_vat) * 100 : 0,
          operating_result: m.revenue_ex_vat - m.cost_of_goods - m.shipping_costs,
          vat_balance: m.vat_collected - m.cost_vat,
        }));

      // Add totals row
      const totals = rows.reduce((acc, r) => ({
        period: 'TOTAAL', revenue: acc.revenue + r.revenue, revenue_ex_vat: acc.revenue_ex_vat + r.revenue_ex_vat,
        vat_collected: acc.vat_collected + r.vat_collected, cost_of_goods: acc.cost_of_goods + r.cost_of_goods,
        cost_vat: acc.cost_vat + r.cost_vat, shipping_costs: acc.shipping_costs + r.shipping_costs,
        gross_margin: acc.gross_margin + r.gross_margin, gross_margin_pct: 0,
        operating_result: acc.operating_result + r.operating_result, vat_balance: acc.vat_balance + r.vat_balance,
      }), { period: 'TOTAAL', revenue: 0, revenue_ex_vat: 0, vat_collected: 0, cost_of_goods: 0, cost_vat: 0, shipping_costs: 0, gross_margin: 0, gross_margin_pct: 0, operating_result: 0, vat_balance: 0 });
      totals.gross_margin_pct = totals.revenue_ex_vat > 0 ? (totals.gross_margin / totals.revenue_ex_vat) * 100 : 0;
      rows.push(totals);

      const columns = [
        { key: 'period', header: 'Periode' },
        { key: 'revenue', header: 'Bruto Omzet (incl BTW)', format: 'currency' as const },
        { key: 'revenue_ex_vat', header: 'Netto Omzet', format: 'currency' as const },
        { key: 'vat_collected', header: 'BTW Ontvangen', format: 'currency' as const },
        { key: 'cost_of_goods', header: 'Inkoop (ex BTW)', format: 'currency' as const },
        { key: 'cost_vat', header: 'BTW Betaald', format: 'currency' as const },
        { key: 'gross_margin', header: 'Bruto Marge', format: 'currency' as const },
        { key: 'gross_margin_pct', header: 'Marge %', format: 'percentage' as const },
        { key: 'shipping_costs', header: 'Verzendkosten', format: 'currency' as const },
        { key: 'operating_result', header: 'Bedrijfsresultaat', format: 'currency' as const },
        { key: 'vat_balance', header: 'BTW Saldo (af te dragen)', format: 'currency' as const },
      ];

      const filename = generateFilename('winst_verlies', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Winst & Verlies');

      toast.success('Winst & Verlies rapport geëxporteerd');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportProfitLoss, isExporting };
};

// ── Omzet per BTW-tarief ─────────────────────────────────────────
export const useVatBreakdownExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportVatBreakdown = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, subtotal, tax_amount, total, vat_rate, sales_channel')
        .eq('tenant_id', currentTenant.id)
        .eq('payment_status', 'paid')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (error) throw error;

      const vatBuckets = new Map<number, { rate: number; base: number; vat: number; count: number }>();
      
      orders.forEach(o => {
        const rate = o.vat_rate ?? 21;
        const existing = vatBuckets.get(rate) || { rate, base: 0, vat: 0, count: 0 };
        existing.base += o.subtotal || 0;
        existing.vat += o.tax_amount || 0;
        existing.count += 1;
        vatBuckets.set(rate, existing);
      });

      const rows = Array.from(vatBuckets.values())
        .sort((a, b) => b.rate - a.rate)
        .map(r => ({
          vat_rate: r.rate,
          base_amount: r.base,
          vat_amount: r.vat,
          total_amount: r.base + r.vat,
          order_count: r.count,
        }));

      const totalRow = {
        vat_rate: 'TOTAAL' as any,
        base_amount: rows.reduce((s, r) => s + r.base_amount, 0),
        vat_amount: rows.reduce((s, r) => s + r.vat_amount, 0),
        total_amount: rows.reduce((s, r) => s + r.total_amount, 0),
        order_count: rows.reduce((s, r) => s + r.order_count, 0),
      };
      rows.push(totalRow);

      const columns = [
        { key: 'vat_rate', header: 'BTW Tarief (%)' },
        { key: 'base_amount', header: 'Maatstaf (ex BTW)', format: 'currency' as const },
        { key: 'vat_amount', header: 'BTW Bedrag', format: 'currency' as const },
        { key: 'total_amount', header: 'Totaal (incl BTW)', format: 'currency' as const },
        { key: 'order_count', header: 'Aantal Orders', format: 'number' as const },
      ];

      const filename = generateFilename('omzet_per_btw_tarief', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'BTW Uitsplitsing');

      toast.success('BTW-uitsplitsing geëxporteerd');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportVatBreakdown, isExporting };
};

// ── Omzet per Verkoopkanaal ──────────────────────────────────────
export const useChannelRevenueExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportChannelRevenue = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('sales_channel, subtotal, tax_amount, total')
        .eq('tenant_id', currentTenant.id)
        .eq('payment_status', 'paid')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (error) throw error;

      const channelMap = new Map<string, { channel: string; revenue: number; vat: number; count: number }>();
      const channelLabels: Record<string, string> = {
        webshop: 'Webshop', pos: 'Kassa (POS)', bol_com: 'Bol.com', amazon: 'Amazon', sellqo_webshop: 'Sellqo Webshop',
      };

      orders.forEach(o => {
        const ch = o.sales_channel || 'webshop';
        const existing = channelMap.get(ch) || { channel: ch, revenue: 0, vat: 0, count: 0 };
        existing.revenue += o.total || 0;
        existing.vat += o.tax_amount || 0;
        existing.count += 1;
        channelMap.set(ch, existing);
      });

      const totalRevenue = Array.from(channelMap.values()).reduce((s, c) => s + c.revenue, 0);

      const rows = Array.from(channelMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map(c => ({
          channel: channelLabels[c.channel] || c.channel,
          order_count: c.count,
          revenue: c.revenue,
          vat: c.vat,
          net_revenue: c.revenue - c.vat,
          avg_order: c.count > 0 ? c.revenue / c.count : 0,
          pct_of_total: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
        }));

      const columns = [
        { key: 'channel', header: 'Verkoopkanaal' },
        { key: 'order_count', header: 'Aantal Orders', format: 'number' as const },
        { key: 'revenue', header: 'Bruto Omzet', format: 'currency' as const },
        { key: 'vat', header: 'BTW', format: 'currency' as const },
        { key: 'net_revenue', header: 'Netto Omzet', format: 'currency' as const },
        { key: 'avg_order', header: 'Gem. Orderbedrag', format: 'currency' as const },
        { key: 'pct_of_total', header: '% van Totaal', format: 'percentage' as const },
      ];

      const filename = generateFilename('omzet_per_kanaal', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Per Kanaal');

      toast.success('Omzet per kanaal geëxporteerd');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportChannelRevenue, isExporting };
};

// ── Betalingsoverzicht ───────────────────────────────────────────
export const usePaymentReconciliationExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportPaymentReconciliation = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      // Get paid orders
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('order_number, created_at, total, sales_channel, customer_name, customer_email')
        .eq('tenant_id', currentTenant.id)
        .eq('payment_status', 'paid')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });
      if (oErr) throw oErr;

      // Get paid invoices  
      const { data: invoices, error: iErr } = await supabase
        .from('invoices')
        .select('invoice_number, created_at, total, paid_at, ogm_reference')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'paid')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });
      if (iErr) throw iErr;

      // Get POS transactions
      const { data: posTx, error: pErr } = await supabase
        .from('pos_transactions')
        .select('receipt_number, created_at, total, payments, card_brand, card_last4')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'completed')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;

      const rows: any[] = [];

      invoices.forEach(inv => {
        rows.push({
          date: inv.paid_at || inv.created_at,
          reference: inv.invoice_number,
          type: 'Factuur',
          payment_method: 'Bankoverschrijving',
          ogm: inv.ogm_reference || '',
          amount: inv.total,
          source: 'Facturatie',
        });
      });

      posTx.forEach(tx => {
        const payments = tx.payments as Array<{ method: string; amount: number }> | null;
        const method = payments?.[0]?.method || 'Onbekend';
        const methodLabel = method === 'cash' ? 'Contant' : method === 'card' ? `PIN${tx.card_brand ? ' ' + tx.card_brand : ''}${tx.card_last4 ? ' ****' + tx.card_last4 : ''}` : method;
        rows.push({
          date: tx.created_at,
          reference: tx.receipt_number,
          type: 'Kassabon',
          payment_method: methodLabel,
          ogm: '',
          amount: tx.total,
          source: 'Kassa (POS)',
        });
      });

      rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const columns = [
        { key: 'date', header: 'Datum', format: 'datetime' as const },
        { key: 'reference', header: 'Referentie' },
        { key: 'type', header: 'Type' },
        { key: 'payment_method', header: 'Betaalmethode' },
        { key: 'ogm', header: 'OGM/Mededeling' },
        { key: 'amount', header: 'Bedrag', format: 'currency' as const },
        { key: 'source', header: 'Bron' },
      ];

      const filename = generateFilename('betalingsoverzicht', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Betalingen');

      toast.success(`${rows.length} betalingen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPaymentReconciliation, isExporting };
};

// ── Marge-analyse per Product ────────────────────────────────────
export const useProductMarginExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportProductMargin = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [itemsRes, productsRes] = await Promise.all([
        supabase.from('order_items')
          .select('product_id, product_name, product_sku, quantity, unit_price, total_price, orders!inner(tenant_id, payment_status, created_at)')
          .eq('orders.tenant_id', currentTenant.id)
          .eq('orders.payment_status', 'paid')
          .gte('orders.created_at', dateRange.from.toISOString())
          .lte('orders.created_at', dateRange.to.toISOString()),
        supabase.from('products')
          .select('id, name, sku, price, cost_price')
          .eq('tenant_id', currentTenant.id),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (productsRes.error) throw productsRes.error;

      const costMap = new Map(productsRes.data.map(p => [p.id, p.cost_price || 0]));
      const productStats = new Map<string, { name: string; sku: string; sell_price: number; cost_price: number; qty: number; revenue: number; cost_total: number }>();

      itemsRes.data.forEach(item => {
        const key = item.product_id || item.product_name;
        const existing = productStats.get(key) || {
          name: item.product_name, sku: item.product_sku || '', sell_price: item.unit_price,
          cost_price: costMap.get(item.product_id || '') || 0, qty: 0, revenue: 0, cost_total: 0,
        };
        existing.qty += item.quantity;
        existing.revenue += item.total_price;
        existing.cost_total += (costMap.get(item.product_id || '') || 0) * item.quantity;
        productStats.set(key, existing);
      });

      const rows = Array.from(productStats.values())
        .map(p => ({
          product_name: p.name, sku: p.sku, sell_price: p.sell_price, cost_price: p.cost_price,
          margin_abs: p.sell_price - p.cost_price,
          margin_pct: p.sell_price > 0 ? ((p.sell_price - p.cost_price) / p.sell_price) * 100 : 0,
          qty_sold: p.qty, total_revenue: p.revenue, total_cost: p.cost_total,
          total_margin: p.revenue - p.cost_total,
        }))
        .sort((a, b) => b.margin_pct - a.margin_pct);

      const columns = [
        { key: 'product_name', header: 'Product' },
        { key: 'sku', header: 'SKU' },
        { key: 'sell_price', header: 'Verkoopprijs', format: 'currency' as const },
        { key: 'cost_price', header: 'Kostprijs', format: 'currency' as const },
        { key: 'margin_abs', header: 'Marge (€)', format: 'currency' as const },
        { key: 'margin_pct', header: 'Marge (%)', format: 'percentage' as const },
        { key: 'qty_sold', header: 'Aantal Verkocht', format: 'number' as const },
        { key: 'total_revenue', header: 'Totale Omzet', format: 'currency' as const },
        { key: 'total_cost', header: 'Totale Inkoop', format: 'currency' as const },
        { key: 'total_margin', header: 'Totale Marge', format: 'currency' as const },
      ];

      const filename = generateFilename('marge_analyse', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Marge Analyse');

      toast.success(`${rows.length} producten geanalyseerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportProductMargin, isExporting };
};

// ── Voorraadwaardering ───────────────────────────────────────────
export const useInventoryValuationExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportInventoryValuation = async (format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('name, sku, stock, cost_price, price, track_inventory, is_active')
        .eq('tenant_id', currentTenant.id)
        .eq('track_inventory', true)
        .order('name');

      if (error) throw error;

      const rows = data.map(p => ({
        sku: p.sku || '',
        name: p.name,
        stock: p.stock ?? 0,
        cost_price: p.cost_price ?? 0,
        sell_price: p.price,
        stock_value: (p.stock ?? 0) * (p.cost_price ?? 0),
        potential_revenue: (p.stock ?? 0) * p.price,
        is_active: p.is_active ? 'Ja' : 'Nee',
      }));

      const totalValue = rows.reduce((s, r) => s + r.stock_value, 0);
      const totalPotential = rows.reduce((s, r) => s + r.potential_revenue, 0);
      const totalStock = rows.reduce((s, r) => s + r.stock, 0);

      rows.push({
        sku: '', name: 'TOTAAL', stock: totalStock, cost_price: 0,
        sell_price: 0, stock_value: totalValue, potential_revenue: totalPotential, is_active: '',
      });

      const columns = [
        { key: 'sku', header: 'SKU' },
        { key: 'name', header: 'Product' },
        { key: 'stock', header: 'Voorraad', format: 'number' as const },
        { key: 'cost_price', header: 'Kostprijs', format: 'currency' as const },
        { key: 'sell_price', header: 'Verkoopprijs', format: 'currency' as const },
        { key: 'stock_value', header: 'Voorraadwaarde', format: 'currency' as const },
        { key: 'potential_revenue', header: 'Potentiële Omzet', format: 'currency' as const },
        { key: 'is_active', header: 'Actief' },
      ];

      const filename = generateFilename('voorraadwaardering');
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Voorraadwaardering');

      toast.success('Voorraadwaardering geëxporteerd');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportInventoryValuation, isExporting };
};

// ── Verrijkte POS Sessies ────────────────────────────────────────
export const useEnrichedPOSSessionExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportEnrichedSessions = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [sessionsRes, txRes, cashiersRes] = await Promise.all([
        supabase.from('pos_sessions')
          .select('*, pos_terminals(name, location_name)')
          .eq('tenant_id', currentTenant.id)
          .gte('opened_at', dateRange.from.toISOString())
          .lte('opened_at', dateRange.to.toISOString())
          .order('opened_at', { ascending: false }),
        supabase.from('pos_transactions')
          .select('session_id, total, status, payments')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'completed')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase.from('pos_cashiers')
          .select('id, display_name')
          .eq('tenant_id', currentTenant.id),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (txRes.error) throw txRes.error;

      // Group transactions by session
      const sessionTxMap = new Map<string, { count: number; revenue: number; cash: number; card: number }>();
      txRes.data.forEach(tx => {
        if (!tx.session_id) return;
        const existing = sessionTxMap.get(tx.session_id) || { count: 0, revenue: 0, cash: 0, card: 0 };
        existing.count += 1;
        existing.revenue += tx.total || 0;
        const payments = tx.payments as Array<{ method: string; amount: number }> | null;
        existing.cash += payments?.find(p => p.method === 'cash')?.amount || 0;
        existing.card += payments?.find(p => p.method === 'card')?.amount || 0;
        sessionTxMap.set(tx.session_id, existing);
      });

      const cashierMap = new Map((cashiersRes.data || []).map(c => [c.id, c.display_name]));

      const rows = sessionsRes.data.map(s => {
        const txData = sessionTxMap.get(s.id) || { count: 0, revenue: 0, cash: 0, card: 0 };
        const durationMin = s.closed_at ? differenceInMinutes(new Date(s.closed_at), new Date(s.opened_at)) : null;
        const durationLabel = durationMin !== null ? `${Math.floor(durationMin / 60)}u ${durationMin % 60}m` : 'Nog open';

        return {
          terminal_name: s.pos_terminals?.name || '',
          location: s.pos_terminals?.location_name || '',
          cashier: cashierMap.get(s.opened_by) || s.opened_by || '',
          opened_at: s.opened_at,
          closed_at: s.closed_at,
          duration: durationLabel,
          status: s.status,
          transaction_count: txData.count,
          total_revenue: txData.revenue,
          cash_revenue: txData.cash,
          card_revenue: txData.card,
          opening_cash: s.opening_cash,
          closing_cash: s.closing_cash,
          expected_cash: s.expected_cash,
          cash_difference: s.cash_difference,
        };
      });

      const columns = [
        { key: 'terminal_name', header: 'Terminal' },
        { key: 'location', header: 'Locatie' },
        { key: 'cashier', header: 'Medewerker' },
        { key: 'opened_at', header: 'Geopend', format: 'datetime' as const },
        { key: 'closed_at', header: 'Gesloten', format: 'datetime' as const },
        { key: 'duration', header: 'Duur' },
        { key: 'transaction_count', header: 'Transacties', format: 'number' as const },
        { key: 'total_revenue', header: 'Omzet', format: 'currency' as const },
        { key: 'cash_revenue', header: 'Contant', format: 'currency' as const },
        { key: 'card_revenue', header: 'PIN/Kaart', format: 'currency' as const },
        { key: 'opening_cash', header: 'Startbedrag', format: 'currency' as const },
        { key: 'closing_cash', header: 'Eindbedrag', format: 'currency' as const },
        { key: 'expected_cash', header: 'Verwacht', format: 'currency' as const },
        { key: 'cash_difference', header: 'Verschil', format: 'currency' as const },
        { key: 'status', header: 'Status' },
      ];

      const filename = generateFilename('kassa_sessies_detail', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Sessies Detail');

      toast.success(`${rows.length} sessies geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportEnrichedSessions, isExporting };
};

// ── Jaarafsluiting Pakket ────────────────────────────────────────
export const useYearEndExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportYearEndPackage = async (dateRange: DateRange) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      // Fetch all data in parallel
      const [invoicesRes, supplierDocsRes, ordersRes, productsRes, customersRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('tenant_id', currentTenant.id).eq('status', 'paid')
          .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString()),
        supabase.from('supplier_documents').select('*, suppliers(name)').eq('tenant_id', currentTenant.id)
          .gte('document_date', dateRange.from.toISOString()).lte('document_date', dateRange.to.toISOString()),
        supabase.from('orders').select('*').eq('tenant_id', currentTenant.id).eq('payment_status', 'paid')
          .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString()),
        supabase.from('products').select('name, sku, stock, cost_price, price').eq('tenant_id', currentTenant.id).eq('track_inventory', true),
        supabase.from('customers').select('*').eq('tenant_id', currentTenant.id),
      ]);

      // Sheet 1: P&L Summary
      const monthlyPL = new Map<string, { period: string; revenue: number; costs: number; shipping: number }>();
      invoicesRes.data?.forEach(inv => {
        const key = format(new Date(inv.created_at), 'yyyy-MM');
        const e = monthlyPL.get(key) || { period: key, revenue: 0, costs: 0, shipping: 0 };
        e.revenue += inv.subtotal || 0;
        monthlyPL.set(key, e);
      });
      supplierDocsRes.data?.forEach(doc => {
        const key = format(new Date(doc.document_date), 'yyyy-MM');
        const e = monthlyPL.get(key) || { period: key, revenue: 0, costs: 0, shipping: 0 };
        e.costs += doc.amount || 0;
        monthlyPL.set(key, e);
      });
      ordersRes.data?.forEach(o => {
        const key = format(new Date(o.created_at), 'yyyy-MM');
        const e = monthlyPL.get(key) || { period: key, revenue: 0, costs: 0, shipping: 0 };
        e.shipping += o.shipping_cost || 0;
        monthlyPL.set(key, e);
      });
      const plRows = Array.from(monthlyPL.values()).sort((a, b) => a.period.localeCompare(b.period)).map(m => ({
        ...m, gross_margin: m.revenue - m.costs, result: m.revenue - m.costs - m.shipping,
      }));

      // Sheet 2: VAT per quarter
      const quarterVat = new Map<string, { quarter: string; revenue: number; vat_out: number; costs: number; vat_in: number }>();
      invoicesRes.data?.forEach(inv => {
        const d = new Date(inv.created_at);
        const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
        const e = quarterVat.get(q) || { quarter: q, revenue: 0, vat_out: 0, costs: 0, vat_in: 0 };
        e.revenue += inv.subtotal || 0;
        e.vat_out += inv.tax_amount || 0;
        quarterVat.set(q, e);
      });
      supplierDocsRes.data?.forEach(doc => {
        const d = new Date(doc.document_date);
        const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
        const e = quarterVat.get(q) || { quarter: q, revenue: 0, vat_out: 0, costs: 0, vat_in: 0 };
        e.costs += doc.amount || 0;
        e.vat_in += doc.tax_amount || 0;
        quarterVat.set(q, e);
      });
      const vatRows = Array.from(quarterVat.values()).sort((a, b) => a.quarter.localeCompare(b.quarter)).map(v => ({
        ...v, vat_balance: v.vat_out - v.vat_in,
      }));

      // Sheet 3: Inventory valuation
      const invRows = (productsRes.data || []).map(p => ({
        sku: p.sku || '', name: p.name, stock: p.stock ?? 0,
        cost_price: p.cost_price ?? 0, value: (p.stock ?? 0) * (p.cost_price ?? 0),
      }));

      // Sheet 4: Customer base
      const custRows = (customersRes.data || []).map(c => ({
        name: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email, type: c.customer_type, vat_number: c.vat_number,
        total_orders: c.total_orders, total_spent: c.total_spent,
      }));

      generateExcelMultiSheet([
        { name: 'Winst & Verlies', data: plRows, columns: [
          { key: 'period', header: 'Periode' }, { key: 'revenue', header: 'Omzet (ex BTW)', format: 'currency' as const },
          { key: 'costs', header: 'Inkoop', format: 'currency' as const }, { key: 'gross_margin', header: 'Bruto Marge', format: 'currency' as const },
          { key: 'shipping', header: 'Verzendkosten', format: 'currency' as const }, { key: 'result', header: 'Resultaat', format: 'currency' as const },
        ]},
        { name: 'BTW per Kwartaal', data: vatRows, columns: [
          { key: 'quarter', header: 'Kwartaal' }, { key: 'revenue', header: 'Omzet (ex BTW)', format: 'currency' as const },
          { key: 'vat_out', header: 'BTW Ontvangen', format: 'currency' as const }, { key: 'costs', header: 'Inkoop (ex BTW)', format: 'currency' as const },
          { key: 'vat_in', header: 'BTW Betaald', format: 'currency' as const }, { key: 'vat_balance', header: 'Af te dragen', format: 'currency' as const },
        ]},
        { name: 'Voorraadwaardering', data: invRows, columns: [
          { key: 'sku', header: 'SKU' }, { key: 'name', header: 'Product' },
          { key: 'stock', header: 'Voorraad', format: 'number' as const }, { key: 'cost_price', header: 'Kostprijs', format: 'currency' as const },
          { key: 'value', header: 'Waarde', format: 'currency' as const },
        ]},
        { name: 'Klantenbestand', data: custRows, columns: [
          { key: 'name', header: 'Klant' }, { key: 'email', header: 'Email' }, { key: 'type', header: 'Type' },
          { key: 'vat_number', header: 'BTW-nummer' }, { key: 'total_orders', header: 'Orders', format: 'number' as const },
          { key: 'total_spent', header: 'Besteed', format: 'currency' as const },
        ]},
      ], generateFilename('jaarafsluiting', dateRange.from, dateRange.to));

      toast.success('Jaarafsluiting pakket geëxporteerd');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportYearEndPackage, isExporting };
};

// ── BTW Kwartaal Pakket ──────────────────────────────────────────
export const useQuarterlyVatExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportQuarterlyVat = async () => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const now = new Date();
      const qStart = startOfQuarter(now);
      const qEnd = endOfQuarter(now);
      const qLabel = `Q${Math.ceil((now.getMonth() + 1) / 3)}_${now.getFullYear()}`;

      const [invoicesRes, supplierDocsRes, posRes] = await Promise.all([
        supabase.from('invoices').select('*, customers(company_name, vat_number, billing_country)')
          .eq('tenant_id', currentTenant.id).eq('status', 'paid')
          .gte('created_at', qStart.toISOString()).lte('created_at', qEnd.toISOString()),
        supabase.from('supplier_documents').select('*, suppliers(name)')
          .eq('tenant_id', currentTenant.id).eq('document_type', 'invoice')
          .gte('document_date', qStart.toISOString()).lte('document_date', qEnd.toISOString()),
        supabase.from('pos_transactions').select('total, tax_total, payments, created_at')
          .eq('tenant_id', currentTenant.id).eq('status', 'completed')
          .gte('created_at', qStart.toISOString()).lte('created_at', qEnd.toISOString()),
      ]);

      // Sheet 1: BTW Overview
      let totalVatOut = 0, totalVatIn = 0, totalRevenue = 0, totalCosts = 0;
      invoicesRes.data?.forEach(i => { totalVatOut += i.tax_amount || 0; totalRevenue += i.subtotal || 0; });
      supplierDocsRes.data?.forEach(d => { totalVatIn += d.tax_amount || 0; totalCosts += d.amount || 0; });
      const posVat = posRes.data?.reduce((s, t) => s + (t.tax_total || 0), 0) || 0;
      const posRev = posRes.data?.reduce((s, t) => s + (t.total || 0), 0) || 0;

      const overviewData = [
        { category: 'Facturatie - Omzet', ex_vat: totalRevenue, vat: totalVatOut },
        { category: 'Kassa - Omzet', ex_vat: posRev - posVat, vat: posVat },
        { category: 'Totaal Uitgaand', ex_vat: totalRevenue + (posRev - posVat), vat: totalVatOut + posVat },
        { category: 'Inkoop', ex_vat: totalCosts, vat: totalVatIn },
        { category: 'BTW Saldo (af te dragen)', ex_vat: 0, vat: (totalVatOut + posVat) - totalVatIn },
      ];

      // Sheet 2: IC-listing
      const euCountries = ['NL', 'DE', 'FR', 'LU', 'AT', 'IT', 'ES', 'PT', 'IE', 'FI', 'SE', 'DK', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'EE', 'LV', 'LT', 'CY', 'MT', 'GR'];
      const icMap = new Map<string, { vat_number: string; company: string; country: string; amount: number }>();
      invoicesRes.data?.forEach(inv => {
        const vn = inv.customers?.vat_number;
        const co = inv.customers?.billing_country?.toUpperCase();
        if (vn && euCountries.includes(co) && co !== 'BE') {
          const e = icMap.get(vn) || { vat_number: vn, company: inv.customers?.company_name || '', country: co, amount: 0 };
          e.amount += inv.subtotal || 0;
          icMap.set(vn, e);
        }
      });

      // Sheet 3: Payment overview
      const paymentRows: any[] = [];
      invoicesRes.data?.forEach(i => paymentRows.push({ date: i.created_at, ref: i.invoice_number, amount: i.total, type: 'Factuur' }));
      posRes.data?.forEach(t => paymentRows.push({ date: t.created_at, ref: 'POS', amount: t.total, type: 'Kassa' }));
      supplierDocsRes.data?.forEach(d => paymentRows.push({ date: d.document_date, ref: d.document_number, amount: -(d.total_amount || 0), type: 'Inkoop' }));
      paymentRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      generateExcelMultiSheet([
        { name: 'BTW Overzicht', data: overviewData, columns: [
          { key: 'category', header: 'Categorie' }, { key: 'ex_vat', header: 'Bedrag (ex BTW)', format: 'currency' as const },
          { key: 'vat', header: 'BTW', format: 'currency' as const },
        ]},
        { name: 'IC-Listing', data: Array.from(icMap.values()), columns: [
          { key: 'vat_number', header: 'BTW-nummer' }, { key: 'company', header: 'Bedrijf' },
          { key: 'country', header: 'Land' }, { key: 'amount', header: 'Bedrag', format: 'currency' as const },
        ]},
        { name: 'Betalingen', data: paymentRows, columns: [
          { key: 'date', header: 'Datum', format: 'date' as const }, { key: 'ref', header: 'Referentie' },
          { key: 'type', header: 'Type' }, { key: 'amount', header: 'Bedrag', format: 'currency' as const },
        ]},
      ], `btw_kwartaal_${qLabel}`);

      toast.success(`BTW kwartaalpakket ${qLabel} geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportQuarterlyVat, isExporting };
};
