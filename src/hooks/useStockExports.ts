import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { generateCSV, generateExcel, generateFilename, ExportFormat } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { format, subDays, differenceInDays } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

// ── Voorraadmutaties ─────────────────────────────────────────────
export const useStockMovementExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportStockMovements = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const [salesRes, purchasesRes] = await Promise.all([
        supabase.from('order_items')
          .select('quantity, product_id, created_at, order_id, products(name, sku)')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase.from('purchase_order_items')
          .select('quantity, product_id, created_at, purchase_order_id, products(name, sku)')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      const rows: any[] = [];

      (salesRes.data || []).forEach((item: any) => {
        rows.push({
          Datum: format(new Date(item.created_at), 'dd-MM-yyyy'),
          Product: item.products?.name || '-',
          SKU: item.products?.sku || '-',
          Type: 'Verkoop',
          Hoeveelheid: -(item.quantity || 0),
          Referentie: item.order_id || '-',
        });
      });

      (purchasesRes.data || []).forEach((item: any) => {
        rows.push({
          Datum: format(new Date(item.created_at), 'dd-MM-yyyy'),
          Product: item.products?.name || '-',
          SKU: item.products?.sku || '-',
          Type: 'Inkoop',
          Hoeveelheid: item.quantity || 0,
          Referentie: item.purchase_order_id || '-',
        });
      });

      rows.sort((a, b) => a.Datum.localeCompare(b.Datum));

      const filename = generateFilename('voorraadmutaties', format_);
      if (format_ === 'csv') generateCSV(rows, filename);
      else generateExcel(rows, filename, 'Voorraadmutaties');

      toast.success(`Voorraadmutaties geëxporteerd (${rows.length} regels)`);
    } catch (e: any) {
      toast.error('Export mislukt: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportStockMovements, isExporting };
};

// ── Dode Voorraad ────────────────────────────────────────────────
export const useDeadStockExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportDeadStock = async (format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, stock, cost_price, track_inventory')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .gt('stock', 0);

      if (error) throw error;

      const cutoff = subDays(new Date(), 90);

      // Get last sale date per product
      const { data: salesData } = await supabase
        .from('order_items')
        .select('product_id, created_at')
        .eq('tenant_id', currentTenant.id)
        .in('product_id', (products || []).map(p => p.id));

      const lastSaleMap: Record<string, string> = {};
      (salesData || []).forEach((s: any) => {
        if (!lastSaleMap[s.product_id] || s.created_at > lastSaleMap[s.product_id]) {
          lastSaleMap[s.product_id] = s.created_at;
        }
      });

      const rows = (products || [])
        .filter(p => {
          const lastSale = lastSaleMap[p.id];
          return !lastSale || new Date(lastSale) < cutoff;
        })
        .map(p => {
          const lastSaleDate = lastSaleMap[p.id] ? new Date(lastSaleMap[p.id]) : null;
          const daysSince = lastSaleDate ? differenceInDays(new Date(), lastSaleDate) : 999;
          return {
            Product: p.name,
            SKU: p.sku || '-',
            Voorraad: p.stock,
            Kostprijs: p.cost_price || 0,
            'Waarde (€)': (p.stock || 0) * (p.cost_price || 0),
            'Laatste verkoop': lastSaleDate ? format(lastSaleDate, 'dd-MM-yyyy') : 'Nooit',
            'Dagen sinds verkoop': daysSince === 999 ? 'N/A' : daysSince,
          };
        })
        .sort((a, b) => (b['Waarde (€)'] as number) - (a['Waarde (€)'] as number));

      const filename = generateFilename('dode-voorraad', format_);
      if (format_ === 'csv') generateCSV(rows, filename);
      else generateExcel(rows, filename, 'Dode Voorraad');

      toast.success(`Dode voorraad geëxporteerd (${rows.length} producten)`);
    } catch (e: any) {
      toast.error('Export mislukt: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportDeadStock, isExporting };
};

// ── Omloopsnelheid ───────────────────────────────────────────────
export const useStockTurnoverExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportStockTurnover = async (dateRange: DateRange, format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, stock, cost_price, track_inventory')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .eq('track_inventory', true);

      if (error) throw error;

      const { data: salesData } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      const salesMap: Record<string, number> = {};
      (salesData || []).forEach((s: any) => {
        salesMap[s.product_id] = (salesMap[s.product_id] || 0) + (s.quantity || 0);
      });

      const periodDays = Math.max(1, differenceInDays(dateRange.to, dateRange.from));

      const rows = (products || []).map(p => {
        const sold = salesMap[p.id] || 0;
        const avgDailySales = sold / periodDays;
        const daysRemaining = avgDailySales > 0 ? Math.round((p.stock || 0) / avgDailySales) : 9999;
        const turnover = (p.stock || 0) > 0 ? +(sold / p.stock).toFixed(2) : 0;

        return {
          Product: p.name,
          SKU: p.sku || '-',
          'Huidige voorraad': p.stock || 0,
          'Verkocht (periode)': sold,
          'Gem. verkoop/dag': +avgDailySales.toFixed(1),
          Omloopsnelheid: turnover,
          'Dagen voorraad resterend': daysRemaining > 9000 ? 'N/A' : daysRemaining,
        };
      }).sort((a, b) => (b['Verkocht (periode)'] as number) - (a['Verkocht (periode)'] as number));

      const filename = generateFilename('omloopsnelheid', format_);
      if (format_ === 'csv') generateCSV(rows, filename);
      else generateExcel(rows, filename, 'Omloopsnelheid');

      toast.success(`Omloopsnelheid geëxporteerd (${rows.length} producten)`);
    } catch (e: any) {
      toast.error('Export mislukt: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportStockTurnover, isExporting };
};

// ── Inkoopadvies ─────────────────────────────────────────────────
export const useReorderAdviceExport = () => {
  const { currentTenant } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const exportReorderAdvice = async (format_: ExportFormat) => {
    if (!currentTenant) return;
    setIsExporting(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, stock, low_stock_threshold, cost_price, track_inventory')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .eq('track_inventory', true);

      if (error) throw error;

      // Sales last 90 days for avg calculation
      const since = subDays(new Date(), 90).toISOString();
      const { data: salesData } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', since);

      const salesMap: Record<string, number> = {};
      (salesData || []).forEach((s: any) => {
        salesMap[s.product_id] = (salesMap[s.product_id] || 0) + (s.quantity || 0);
      });

      const rows = (products || [])
        .map(p => {
          const soldLast90 = salesMap[p.id] || 0;
          const avgPerMonth = +(soldLast90 / 3).toFixed(1);
          const expectedIn30 = Math.round(avgPerMonth);
          const stockIn30 = (p.stock || 0) - expectedIn30;
          const adviceQty = stockIn30 < 0 ? Math.abs(stockIn30) : 0;

          return {
            Product: p.name,
            SKU: p.sku || '-',
            'Huidige voorraad': p.stock || 0,
            'Min. drempel': p.low_stock_threshold || 5,
            'Gem. verkoop/maand': avgPerMonth,
            'Verwacht over 30d': stockIn30,
            'Advies inkoop': adviceQty,
            'Geschatte kost (€)': +(adviceQty * (p.cost_price || 0)).toFixed(2),
          };
        })
        .filter(r => r['Advies inkoop'] > 0 || r['Huidige voorraad'] <= r['Min. drempel'])
        .sort((a, b) => (b['Advies inkoop'] as number) - (a['Advies inkoop'] as number));

      const filename = generateFilename('inkoopadvies', format_);
      if (format_ === 'csv') generateCSV(rows, filename);
      else generateExcel(rows, filename, 'Inkoopadvies');

      toast.success(`Inkoopadvies geëxporteerd (${rows.length} producten)`);
    } catch (e: any) {
      toast.error('Export mislukt: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportReorderAdvice, isExporting };
};
