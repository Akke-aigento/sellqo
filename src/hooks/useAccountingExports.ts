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

// ── Grootboekjournaal (General Ledger) ───────────────────────────
export const useGeneralLedgerExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportGeneralLedger = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [invoicesRes, supplierDocsRes, posRes] = await Promise.all([
        supabase.from('invoices')
          .select('invoice_number, created_at, subtotal, tax_amount, total, paid_at, customers(company_name, first_name, last_name)')
          .eq('tenant_id', currentTenant.id).eq('status', 'paid')
          .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString())
          .order('created_at'),
        supabase.from('supplier_documents')
          .select('document_number, document_date, amount, tax_amount, total_amount, suppliers(name)')
          .eq('tenant_id', currentTenant.id).eq('document_type', 'invoice').eq('payment_status', 'paid')
          .gte('document_date', dateRange.from.toISOString()).lte('document_date', dateRange.to.toISOString())
          .order('document_date'),
        supabase.from('pos_transactions')
          .select('receipt_number, created_at, subtotal, tax_total, total')
          .eq('tenant_id', currentTenant.id).eq('status', 'completed')
          .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString())
          .order('created_at'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (supplierDocsRes.error) throw supplierDocsRes.error;
      if (posRes.error) throw posRes.error;

      const rows: any[] = [];
      let bookingNr = 1;

      // Verkoopfacturen: Debet 400000 (Klanten) / Credit 700000 (Omzet) + 451000 (BTW)
      invoicesRes.data.forEach(inv => {
        const custName = inv.customers?.company_name || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim() || 'Onbekend';
        const desc = `Factuur ${inv.invoice_number} - ${custName}`;
        rows.push({ date: inv.paid_at || inv.created_at, booking_nr: bookingNr, description: desc, account: '400000', account_name: 'Handelsvorderingen', debit: inv.total, credit: 0, vat_code: '', counter_account: '700000' });
        rows.push({ date: inv.paid_at || inv.created_at, booking_nr: bookingNr, description: desc, account: '700000', account_name: 'Omzet', debit: 0, credit: inv.subtotal || 0, vat_code: '21', counter_account: '400000' });
        if ((inv.tax_amount || 0) > 0) {
          rows.push({ date: inv.paid_at || inv.created_at, booking_nr: bookingNr, description: desc, account: '451000', account_name: 'Te betalen BTW', debit: 0, credit: inv.tax_amount, vat_code: '', counter_account: '400000' });
        }
        bookingNr++;
      });

      // Inkoopfacturen: Debet 604000 (Inkoop) + 411000 (BTW aftrekbaar) / Credit 440000 (Leveranciers)
      supplierDocsRes.data.forEach(doc => {
        const supplierName = doc.suppliers?.name || 'Onbekend';
        const desc = `Inkoop ${doc.document_number || 'z.n.'} - ${supplierName}`;
        rows.push({ date: doc.document_date, booking_nr: bookingNr, description: desc, account: '604000', account_name: 'Aankoop handelsgoederen', debit: doc.amount || 0, credit: 0, vat_code: '21', counter_account: '440000' });
        if ((doc.tax_amount || 0) > 0) {
          rows.push({ date: doc.document_date, booking_nr: bookingNr, description: desc, account: '411000', account_name: 'Terug te vorderen BTW', debit: doc.tax_amount || 0, credit: 0, vat_code: '', counter_account: '440000' });
        }
        rows.push({ date: doc.document_date, booking_nr: bookingNr, description: desc, account: '440000', account_name: 'Leveranciers', debit: 0, credit: doc.total_amount || 0, vat_code: '', counter_account: '604000' });
        bookingNr++;
      });

      // POS transacties: Debet 570000 (Kassa) / Credit 700000 (Omzet) + 451000 (BTW)
      posRes.data.forEach(tx => {
        const desc = `POS ${tx.receipt_number || ''}`;
        rows.push({ date: tx.created_at, booking_nr: bookingNr, description: desc, account: '570000', account_name: 'Kassa', debit: tx.total || 0, credit: 0, vat_code: '', counter_account: '700000' });
        rows.push({ date: tx.created_at, booking_nr: bookingNr, description: desc, account: '700000', account_name: 'Omzet', debit: 0, credit: tx.subtotal || 0, vat_code: '21', counter_account: '570000' });
        if ((tx.tax_total || 0) > 0) {
          rows.push({ date: tx.created_at, booking_nr: bookingNr, description: desc, account: '451000', account_name: 'Te betalen BTW', debit: 0, credit: tx.tax_total, vat_code: '', counter_account: '570000' });
        }
        bookingNr++;
      });

      rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const columns = [
        { key: 'date', header: 'Datum', format: 'date' as const },
        { key: 'booking_nr', header: 'Boekingsnr', format: 'number' as const },
        { key: 'description', header: 'Omschrijving' },
        { key: 'account', header: 'Grootboekrekening' },
        { key: 'account_name', header: 'Rekeningnaam' },
        { key: 'debit', header: 'Debet', format: 'currency' as const },
        { key: 'credit', header: 'Credit', format: 'currency' as const },
        { key: 'vat_code', header: 'BTW-code' },
        { key: 'counter_account', header: 'Tegenrekening' },
      ];

      const filename = generateFilename('grootboekjournaal', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Grootboekjournaal');

      toast.success(`${rows.length} journaalposten geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportGeneralLedger, isExporting };
};

// ── Debiteuren Subledger ─────────────────────────────────────────
export const useDebtorBalanceExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportDebtorBalance = async (format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [invoicesRes, creditNotesRes] = await Promise.all([
        supabase.from('invoices')
          .select('invoice_number, created_at, total, status, paid_at, customer_id, customers(company_name, first_name, last_name, email)')
          .eq('tenant_id', currentTenant.id).in('status', ['sent', 'paid']),
        supabase.from('credit_notes')
          .select('credit_note_number, total, customer_id, status')
          .eq('tenant_id', currentTenant.id).neq('status', 'draft'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (creditNotesRes.error) throw creditNotesRes.error;

      const now = new Date();
      const customerMap = new Map<string, {
        name: string; email: string; invoiced: number; paid: number; credited: number;
        bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number;
      }>();

      invoicesRes.data.forEach(inv => {
        const custId = inv.customer_id || 'unknown';
        const custName = inv.customers?.company_name || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim() || 'Onbekend';
        const existing = customerMap.get(custId) || { name: custName, email: inv.customers?.email || '', invoiced: 0, paid: 0, credited: 0, bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 };
        existing.invoiced += inv.total || 0;
        if (inv.status === 'paid') {
          existing.paid += inv.total || 0;
        } else {
          const daysDiff = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 30) existing.bucket_0_30 += inv.total || 0;
          else if (daysDiff <= 60) existing.bucket_31_60 += inv.total || 0;
          else if (daysDiff <= 90) existing.bucket_61_90 += inv.total || 0;
          else existing.bucket_90_plus += inv.total || 0;
        }
        customerMap.set(custId, existing);
      });

      creditNotesRes.data?.forEach(cn => {
        const custId = cn.customer_id || 'unknown';
        const existing = customerMap.get(custId);
        if (existing) existing.credited += cn.total || 0;
      });

      const rows = Array.from(customerMap.values()).map(c => ({
        ...c,
        open_balance: c.invoiced - c.paid - c.credited,
      })).filter(c => Math.abs(c.open_balance) > 0.01)
        .sort((a, b) => b.open_balance - a.open_balance);

      const totals = rows.reduce((acc, r) => ({
        name: 'TOTAAL', email: '', invoiced: acc.invoiced + r.invoiced, paid: acc.paid + r.paid, credited: acc.credited + r.credited,
        bucket_0_30: acc.bucket_0_30 + r.bucket_0_30, bucket_31_60: acc.bucket_31_60 + r.bucket_31_60,
        bucket_61_90: acc.bucket_61_90 + r.bucket_61_90, bucket_90_plus: acc.bucket_90_plus + r.bucket_90_plus,
        open_balance: acc.open_balance + r.open_balance,
      }), { name: 'TOTAAL', email: '', invoiced: 0, paid: 0, credited: 0, bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0, open_balance: 0 });
      rows.push(totals);

      const columns = [
        { key: 'name', header: 'Klant' },
        { key: 'email', header: 'Email' },
        { key: 'invoiced', header: 'Gefactureerd', format: 'currency' as const },
        { key: 'paid', header: 'Betaald', format: 'currency' as const },
        { key: 'credited', header: 'Gecrediteerd', format: 'currency' as const },
        { key: 'open_balance', header: 'Openstaand Saldo', format: 'currency' as const },
        { key: 'bucket_0_30', header: '0-30 dagen', format: 'currency' as const },
        { key: 'bucket_31_60', header: '31-60 dagen', format: 'currency' as const },
        { key: 'bucket_61_90', header: '61-90 dagen', format: 'currency' as const },
        { key: 'bucket_90_plus', header: '90+ dagen', format: 'currency' as const },
      ];

      const filename = generateFilename('debiteuren_saldo');
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Debiteuren');

      toast.success(`${rows.length - 1} klanten met openstaand saldo`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportDebtorBalance, isExporting };
};

// ── Crediteuren Subledger ────────────────────────────────────────
export const useCreditorBalanceExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportCreditorBalance = async (format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select('document_number, document_date, amount, tax_amount, total_amount, payment_status, paid_amount, supplier_id, suppliers(name)')
        .eq('tenant_id', currentTenant.id).eq('document_type', 'invoice');

      if (error) throw error;

      const now = new Date();
      const supplierMap = new Map<string, {
        name: string; invoiced: number; paid: number;
        bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number;
      }>();

      data.forEach(doc => {
        const suppId = doc.supplier_id;
        const suppName = doc.suppliers?.name || 'Onbekend';
        const existing = supplierMap.get(suppId) || { name: suppName, invoiced: 0, paid: 0, bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0 };
        existing.invoiced += doc.total_amount || 0;
        existing.paid += doc.paid_amount || 0;
        if (doc.payment_status !== 'paid') {
          const open = (doc.total_amount || 0) - (doc.paid_amount || 0);
          const daysDiff = Math.floor((now.getTime() - new Date(doc.document_date).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 30) existing.bucket_0_30 += open;
          else if (daysDiff <= 60) existing.bucket_31_60 += open;
          else if (daysDiff <= 90) existing.bucket_61_90 += open;
          else existing.bucket_90_plus += open;
        }
        supplierMap.set(suppId, existing);
      });

      const rows = Array.from(supplierMap.values()).map(s => ({
        ...s, open_balance: s.invoiced - s.paid,
      })).filter(s => Math.abs(s.open_balance) > 0.01)
        .sort((a, b) => b.open_balance - a.open_balance);

      const totals = rows.reduce((acc, r) => ({
        name: 'TOTAAL', invoiced: acc.invoiced + r.invoiced, paid: acc.paid + r.paid,
        bucket_0_30: acc.bucket_0_30 + r.bucket_0_30, bucket_31_60: acc.bucket_31_60 + r.bucket_31_60,
        bucket_61_90: acc.bucket_61_90 + r.bucket_61_90, bucket_90_plus: acc.bucket_90_plus + r.bucket_90_plus,
        open_balance: acc.open_balance + r.open_balance,
      }), { name: 'TOTAAL', invoiced: 0, paid: 0, bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0, open_balance: 0 });
      rows.push(totals);

      const columns = [
        { key: 'name', header: 'Leverancier' },
        { key: 'invoiced', header: 'Gefactureerd', format: 'currency' as const },
        { key: 'paid', header: 'Betaald', format: 'currency' as const },
        { key: 'open_balance', header: 'Openstaand Saldo', format: 'currency' as const },
        { key: 'bucket_0_30', header: '0-30 dagen', format: 'currency' as const },
        { key: 'bucket_31_60', header: '31-60 dagen', format: 'currency' as const },
        { key: 'bucket_61_90', header: '61-90 dagen', format: 'currency' as const },
        { key: 'bucket_90_plus', header: '90+ dagen', format: 'currency' as const },
      ];

      const filename = generateFilename('crediteuren_saldo');
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Crediteuren');

      toast.success(`${rows.length - 1} leveranciers met openstaand saldo`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCreditorBalance, isExporting };
};

// ── Belgische Jaarlijkse Klantenlisting ──────────────────────────
export const useBelgianCustomerListingExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportBelgianCustomerListing = async (year: number, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const yearStart = new Date(year, 0, 1).toISOString();
      const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString();

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('subtotal, tax_amount, total, customer_id, customers(company_name, vat_number, billing_country)')
        .eq('tenant_id', currentTenant.id).eq('status', 'paid')
        .gte('created_at', yearStart).lte('created_at', yearEnd);

      if (error) throw error;

      const customerMap = new Map<string, { vat_number: string; company_name: string; revenue_ex_vat: number; vat_amount: number; invoice_count: number }>();

      invoices.forEach(inv => {
        const vatNr = inv.customers?.vat_number;
        if (!vatNr) return; // Only B2B with VAT number
        const existing = customerMap.get(vatNr) || { vat_number: vatNr, company_name: inv.customers?.company_name || '', revenue_ex_vat: 0, vat_amount: 0, invoice_count: 0 };
        existing.revenue_ex_vat += inv.subtotal || 0;
        existing.vat_amount += inv.tax_amount || 0;
        existing.invoice_count += 1;
        customerMap.set(vatNr, existing);
      });

      // Only customers with revenue >= €250 (Belgian threshold)
      const rows = Array.from(customerMap.values())
        .filter(c => c.revenue_ex_vat >= 250)
        .sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)
        .map((c, i) => ({ volgnummer: i + 1, ...c, total_incl_vat: c.revenue_ex_vat + c.vat_amount }));

      const totalRow = {
        volgnummer: 'TOTAAL' as any,
        vat_number: '', company_name: '',
        revenue_ex_vat: rows.reduce((s, r) => s + r.revenue_ex_vat, 0),
        vat_amount: rows.reduce((s, r) => s + r.vat_amount, 0),
        invoice_count: rows.reduce((s, r) => s + r.invoice_count, 0),
        total_incl_vat: rows.reduce((s, r) => s + r.total_incl_vat, 0),
      };
      rows.push(totalRow as any);

      const columns = [
        { key: 'volgnummer', header: 'Volgnr.' },
        { key: 'vat_number', header: 'BTW-nummer Klant' },
        { key: 'company_name', header: 'Bedrijfsnaam' },
        { key: 'revenue_ex_vat', header: 'Omzet (ex BTW)', format: 'currency' as const },
        { key: 'vat_amount', header: 'BTW Bedrag', format: 'currency' as const },
        { key: 'total_incl_vat', header: 'Totaal (incl BTW)', format: 'currency' as const },
        { key: 'invoice_count', header: 'Aantal Facturen', format: 'number' as const },
      ];

      const filename = generateFilename(`klantenlisting_${year}`);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, `Klantenlisting ${year}`);

      toast.success(`Klantenlisting ${year}: ${rows.length - 1} B2B klanten`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportBelgianCustomerListing, isExporting };
};

// ── Dagboek Verkopen ─────────────────────────────────────────────
export const useSalesJournalExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportSalesJournal = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number, created_at, subtotal, tax_amount, total, status, paid_at, ogm_reference, customers(company_name, first_name, last_name, vat_number)')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString())
        .order('created_at');

      if (error) throw error;

      const rows = data.map((inv, i) => ({
        volgnummer: i + 1,
        date: inv.created_at,
        invoice_number: inv.invoice_number,
        customer: inv.customers?.company_name || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim() || 'Onbekend',
        vat_number: inv.customers?.vat_number || '',
        subtotal: inv.subtotal || 0,
        vat: inv.tax_amount || 0,
        total: inv.total || 0,
        status: inv.status === 'paid' ? 'Betaald' : inv.status === 'sent' ? 'Verzonden' : inv.status === 'draft' ? 'Concept' : inv.status,
        paid_at: inv.paid_at,
        ogm: inv.ogm_reference || '',
      }));

      const columns = [
        { key: 'volgnummer', header: 'Nr.', format: 'number' as const },
        { key: 'date', header: 'Factuurdatum', format: 'date' as const },
        { key: 'invoice_number', header: 'Factuurnummer' },
        { key: 'customer', header: 'Klant' },
        { key: 'vat_number', header: 'BTW-nr Klant' },
        { key: 'subtotal', header: 'Maatstaf (ex BTW)', format: 'currency' as const },
        { key: 'vat', header: 'BTW', format: 'currency' as const },
        { key: 'total', header: 'Totaal (incl BTW)', format: 'currency' as const },
        { key: 'status', header: 'Status' },
        { key: 'paid_at', header: 'Betaaldatum', format: 'date' as const },
        { key: 'ogm', header: 'OGM' },
      ];

      const filename = generateFilename('dagboek_verkopen', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Dagboek Verkopen');

      toast.success(`${rows.length} verkoopfacturen geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportSalesJournal, isExporting };
};

// ── Dagboek Aankopen ─────────────────────────────────────────────
export const usePurchaseJournalExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportPurchaseJournal = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select('document_number, document_date, document_type, amount, tax_amount, total_amount, payment_status, paid_at, due_date, suppliers(name, vat_number)')
        .eq('tenant_id', currentTenant.id)
        .gte('document_date', dateRange.from.toISOString()).lte('document_date', dateRange.to.toISOString())
        .order('document_date');

      if (error) throw error;

      const typeLabels: Record<string, string> = { invoice: 'Factuur', quote: 'Offerte', delivery_note: 'Pakbon', credit_note: 'Creditnota', contract: 'Contract', other: 'Overig' };
      const statusLabels: Record<string, string> = { pending: 'Openstaand', partial: 'Deels betaald', paid: 'Betaald', overdue: 'Achterstallig', cancelled: 'Geannuleerd' };

      const rows = data.map((doc, i) => ({
        volgnummer: i + 1,
        date: doc.document_date,
        document_number: doc.document_number || '',
        type: typeLabels[doc.document_type] || doc.document_type,
        supplier: doc.suppliers?.name || 'Onbekend',
        vat_number: doc.suppliers?.vat_number || '',
        subtotal: doc.amount || 0,
        vat: doc.tax_amount || 0,
        total: doc.total_amount || 0,
        due_date: doc.due_date,
        status: statusLabels[doc.payment_status] || doc.payment_status,
        paid_at: doc.paid_at,
      }));

      const columns = [
        { key: 'volgnummer', header: 'Nr.', format: 'number' as const },
        { key: 'date', header: 'Documentdatum', format: 'date' as const },
        { key: 'document_number', header: 'Documentnr.' },
        { key: 'type', header: 'Type' },
        { key: 'supplier', header: 'Leverancier' },
        { key: 'vat_number', header: 'BTW-nr Leverancier' },
        { key: 'subtotal', header: 'Netto (ex BTW)', format: 'currency' as const },
        { key: 'vat', header: 'BTW', format: 'currency' as const },
        { key: 'total', header: 'Totaal (incl BTW)', format: 'currency' as const },
        { key: 'due_date', header: 'Vervaldatum', format: 'date' as const },
        { key: 'status', header: 'Betaalstatus' },
        { key: 'paid_at', header: 'Betaaldatum', format: 'date' as const },
      ];

      const filename = generateFilename('dagboek_aankopen', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Dagboek Aankopen');

      toast.success(`${rows.length} inkoopdocumenten geëxporteerd`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPurchaseJournal, isExporting };
};

// ── Cashflow Overzicht ───────────────────────────────────────────
export const useCashflowExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportCashflow = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [invoicesRes, supplierDocsRes, posRes] = await Promise.all([
        supabase.from('invoices')
          .select('paid_at, total')
          .eq('tenant_id', currentTenant.id).eq('status', 'paid')
          .gte('paid_at', dateRange.from.toISOString()).lte('paid_at', dateRange.to.toISOString()),
        supabase.from('supplier_documents')
          .select('paid_at, total_amount')
          .eq('tenant_id', currentTenant.id).eq('payment_status', 'paid')
          .gte('paid_at', dateRange.from.toISOString()).lte('paid_at', dateRange.to.toISOString()),
        supabase.from('pos_transactions')
          .select('created_at, total')
          .eq('tenant_id', currentTenant.id).eq('status', 'completed')
          .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString()),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (supplierDocsRes.error) throw supplierDocsRes.error;
      if (posRes.error) throw posRes.error;

      // Group by week
      const weekMap = new Map<string, { week: string; incoming: number; outgoing: number; invoice_income: number; pos_income: number }>();

      const getWeekKey = (dateStr: string) => {
        const d = new Date(dateStr);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
        return format(weekStart, 'yyyy-MM-dd');
      };

      invoicesRes.data.forEach(inv => {
        if (!inv.paid_at) return;
        const key = getWeekKey(inv.paid_at);
        const e = weekMap.get(key) || { week: key, incoming: 0, outgoing: 0, invoice_income: 0, pos_income: 0 };
        e.incoming += inv.total || 0;
        e.invoice_income += inv.total || 0;
        weekMap.set(key, e);
      });

      posRes.data.forEach(tx => {
        const key = getWeekKey(tx.created_at);
        const e = weekMap.get(key) || { week: key, incoming: 0, outgoing: 0, invoice_income: 0, pos_income: 0 };
        e.incoming += tx.total || 0;
        e.pos_income += tx.total || 0;
        weekMap.set(key, e);
      });

      supplierDocsRes.data.forEach(doc => {
        if (!doc.paid_at) return;
        const key = getWeekKey(doc.paid_at);
        const e = weekMap.get(key) || { week: key, incoming: 0, outgoing: 0, invoice_income: 0, pos_income: 0 };
        e.outgoing += doc.total_amount || 0;
        weekMap.set(key, e);
      });

      let runningBalance = 0;
      const rows = Array.from(weekMap.values())
        .sort((a, b) => a.week.localeCompare(b.week))
        .map(w => {
          const netCashflow = w.incoming - w.outgoing;
          runningBalance += netCashflow;
          return { ...w, net_cashflow: netCashflow, running_balance: runningBalance };
        });

      const columns = [
        { key: 'week', header: 'Week (start)', format: 'date' as const },
        { key: 'invoice_income', header: 'Factuurbetalingen', format: 'currency' as const },
        { key: 'pos_income', header: 'POS Omzet', format: 'currency' as const },
        { key: 'incoming', header: 'Totaal Inkomend', format: 'currency' as const },
        { key: 'outgoing', header: 'Totaal Uitgaand', format: 'currency' as const },
        { key: 'net_cashflow', header: 'Netto Cashflow', format: 'currency' as const },
        { key: 'running_balance', header: 'Cumulatief Saldo', format: 'currency' as const },
      ];

      const filename = generateFilename('cashflow', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Cashflow');

      toast.success(`Cashflow overzicht: ${rows.length} weken`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCashflow, isExporting };
};

// ── Export naar Boekhoudpakket (Exact/Octopus CSV) ───────────────
export const useAccountingSoftwareExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportForAccountingSoftware = async (dateRange: DateRange, softwareType: 'exact' | 'octopus') => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [invoicesRes, supplierDocsRes] = await Promise.all([
        supabase.from('invoices')
          .select('invoice_number, created_at, subtotal, tax_amount, total, paid_at, customers(company_name, first_name, last_name, vat_number)')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString()).lte('created_at', dateRange.to.toISOString())
          .order('created_at'),
        supabase.from('supplier_documents')
          .select('document_number, document_date, amount, tax_amount, total_amount, suppliers(name, vat_number)')
          .eq('tenant_id', currentTenant.id).eq('document_type', 'invoice')
          .gte('document_date', dateRange.from.toISOString()).lte('document_date', dateRange.to.toISOString())
          .order('document_date'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (supplierDocsRes.error) throw supplierDocsRes.error;

      if (softwareType === 'exact') {
        // Exact Online CSV format
        const rows = [
          ...invoicesRes.data.map(inv => ({
            Dagboek: 'VK', Datum: format(new Date(inv.created_at), 'dd/MM/yyyy'),
            Boekstuknummer: inv.invoice_number,
            Relatienaam: inv.customers?.company_name || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim(),
            BTWNummer: inv.customers?.vat_number || '',
            Grootboekrekening: '700000', Omschrijving: `Factuur ${inv.invoice_number}`,
            BedragExcl: inv.subtotal || 0, BTWBedrag: inv.tax_amount || 0, BedragIncl: inv.total || 0, BTWCode: '1',
          })),
          ...supplierDocsRes.data.map(doc => ({
            Dagboek: 'IK', Datum: format(new Date(doc.document_date), 'dd/MM/yyyy'),
            Boekstuknummer: doc.document_number || '',
            Relatienaam: doc.suppliers?.name || '',
            BTWNummer: doc.suppliers?.vat_number || '',
            Grootboekrekening: '604000', Omschrijving: `Inkoop ${doc.document_number || ''}`,
            BedragExcl: doc.amount || 0, BTWBedrag: doc.tax_amount || 0, BedragIncl: doc.total_amount || 0, BTWCode: '1',
          })),
        ];

        const columns = [
          { key: 'Dagboek', header: 'Dagboek' },
          { key: 'Datum', header: 'Datum' },
          { key: 'Boekstuknummer', header: 'Boekstuknummer' },
          { key: 'Relatienaam', header: 'Relatienaam' },
          { key: 'BTWNummer', header: 'BTW-nummer' },
          { key: 'Grootboekrekening', header: 'Grootboekrekening' },
          { key: 'Omschrijving', header: 'Omschrijving' },
          { key: 'BedragExcl', header: 'Bedrag excl. BTW', format: 'currency' as const },
          { key: 'BTWBedrag', header: 'BTW bedrag', format: 'currency' as const },
          { key: 'BedragIncl', header: 'Bedrag incl. BTW', format: 'currency' as const },
          { key: 'BTWCode', header: 'BTW-code' },
        ];

        generateCSV(rows, columns, generateFilename('exact_import', dateRange.from, dateRange.to));
      } else {
        // Octopus CSV format
        const rows = [
          ...invoicesRes.data.map(inv => ({
            Type: 'V', Documentnr: inv.invoice_number,
            Datum: format(new Date(inv.created_at), 'dd/MM/yyyy'),
            Relatie: inv.customers?.company_name || `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`.trim(),
            BTWNr: inv.customers?.vat_number || '',
            Rekening: '700000', BedragExcl: inv.subtotal || 0,
            BTW: inv.tax_amount || 0, Totaal: inv.total || 0, BTWRooster: '03',
          })),
          ...supplierDocsRes.data.map(doc => ({
            Type: 'A', Documentnr: doc.document_number || '',
            Datum: format(new Date(doc.document_date), 'dd/MM/yyyy'),
            Relatie: doc.suppliers?.name || '',
            BTWNr: doc.suppliers?.vat_number || '',
            Rekening: '604000', BedragExcl: doc.amount || 0,
            BTW: doc.tax_amount || 0, Totaal: doc.total_amount || 0, BTWRooster: '81',
          })),
        ];

        const columns = [
          { key: 'Type', header: 'Type (V/A)' },
          { key: 'Documentnr', header: 'Documentnr.' },
          { key: 'Datum', header: 'Datum' },
          { key: 'Relatie', header: 'Relatie' },
          { key: 'BTWNr', header: 'BTW-nummer' },
          { key: 'Rekening', header: 'Rekening' },
          { key: 'BedragExcl', header: 'Bedrag excl.', format: 'currency' as const },
          { key: 'BTW', header: 'BTW', format: 'currency' as const },
          { key: 'Totaal', header: 'Totaal', format: 'currency' as const },
          { key: 'BTWRooster', header: 'BTW-rooster' },
        ];

        generateCSV(rows, columns, generateFilename('octopus_import', dateRange.from, dateRange.to));
      }

      toast.success(`${softwareType === 'exact' ? 'Exact' : 'Octopus'} importbestand aangemaakt`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export mislukt');
    } finally {
      setIsExporting(false);
    }
  };

  return { exportForAccountingSoftware, isExporting };
};
