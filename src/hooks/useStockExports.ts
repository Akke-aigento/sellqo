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
      const [salesRes, purchasesRes, productsRes] = await Promise.all([
        supabase.from('order_items' as any)
          .select('quantity, product_id, product_name, product_sku, created_at, order_id')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase.from('purchase_order_items' as any)
          .select('quantity, product_id, created_at, purchase_order_id')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase.from('products')
          .select('id, name, sku')
          .eq('tenant_id', currentTenant.id),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      const rows: Record<string, any>[] = [];

      (salesRes.data || []).forEach((item: any) => {
        rows.push({
          datum: item.created_at,
          product: item.products?.name || '-',
          sku: item.products?.sku || '-',
          type: 'Verkoop',
          hoeveelheid: -(item.quantity || 0),
          referentie: item.order_id || '-',
        });
      });

      (purchasesRes.data || []).forEach((item: any) => {
        rows.push({
          datum: item.created_at,
          product: item.products?.name || '-',
          sku: item.products?.sku || '-',
          type: 'Inkoop',
          hoeveelheid: item.quantity || 0,
          referentie: item.purchase_order_id || '-',
        });
      });

      rows.sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

      const columns = [
        { key: 'datum', header: 'Datum', format: 'date' as const },
        { key: 'product', header: 'Product' },
        { key: 'sku', header: 'SKU' },
        { key: 'type', header: 'Type' },
        { key: 'hoeveelheid', header: 'Hoeveelheid', format: 'number' as const },
        { key: 'referentie', header: 'Referentie' },
      ];

      const filename = generateFilename('voorraadmutaties', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Voorraadmutaties');

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
          const lastSaleDate = lastSaleMap[p.id] || null;
          const daysSince = lastSaleDate ? differenceInDays(new Date(), new Date(lastSaleDate)) : 999;
          return {
            product: p.name,
            sku: p.sku || '-',
            voorraad: p.stock,
            kostprijs: p.cost_price || 0,
            waarde: (p.stock || 0) * (p.cost_price || 0),
            laatste_verkoop: lastSaleDate || '',
            dagen_sinds: daysSince === 999 ? 9999 : daysSince,
          };
        })
        .sort((a, b) => b.waarde - a.waarde);

      const columns = [
        { key: 'product', header: 'Product' },
        { key: 'sku', header: 'SKU' },
        { key: 'voorraad', header: 'Voorraad', format: 'number' as const },
        { key: 'kostprijs', header: 'Kostprijs', format: 'currency' as const },
        { key: 'waarde', header: 'Waarde (€)', format: 'currency' as const },
        { key: 'laatste_verkoop', header: 'Laatste verkoop', format: 'date' as const },
        { key: 'dagen_sinds', header: 'Dagen sinds verkoop', format: 'number' as const },
      ];

      const filename = generateFilename('dode_voorraad');
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Dode Voorraad');

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
          product: p.name,
          sku: p.sku || '-',
          voorraad: p.stock || 0,
          verkocht: sold,
          gem_per_dag: +avgDailySales.toFixed(1),
          omloopsnelheid: turnover,
          dagen_resterend: daysRemaining,
        };
      }).sort((a, b) => b.verkocht - a.verkocht);

      const columns = [
        { key: 'product', header: 'Product' },
        { key: 'sku', header: 'SKU' },
        { key: 'voorraad', header: 'Huidige voorraad', format: 'number' as const },
        { key: 'verkocht', header: 'Verkocht (periode)', format: 'number' as const },
        { key: 'gem_per_dag', header: 'Gem. verkoop/dag', format: 'number' as const },
        { key: 'omloopsnelheid', header: 'Omloopsnelheid', format: 'number' as const },
        { key: 'dagen_resterend', header: 'Dagen voorraad resterend', format: 'number' as const },
      ];

      const filename = generateFilename('omloopsnelheid', dateRange.from, dateRange.to);
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Omloopsnelheid');

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
            product: p.name,
            sku: p.sku || '-',
            voorraad: p.stock || 0,
            drempel: p.low_stock_threshold || 5,
            gem_per_maand: avgPerMonth,
            verwacht_30d: stockIn30,
            advies: adviceQty,
            geschatte_kost: +(adviceQty * (p.cost_price || 0)).toFixed(2),
          };
        })
        .filter(r => r.advies > 0 || r.voorraad <= r.drempel)
        .sort((a, b) => b.advies - a.advies);

      const columns = [
        { key: 'product', header: 'Product' },
        { key: 'sku', header: 'SKU' },
        { key: 'voorraad', header: 'Huidige voorraad', format: 'number' as const },
        { key: 'drempel', header: 'Min. drempel', format: 'number' as const },
        { key: 'gem_per_maand', header: 'Gem. verkoop/maand', format: 'number' as const },
        { key: 'verwacht_30d', header: 'Verwacht over 30d', format: 'number' as const },
        { key: 'advies', header: 'Advies inkoop', format: 'number' as const },
        { key: 'geschatte_kost', header: 'Geschatte kost (€)', format: 'currency' as const },
      ];

      const filename = generateFilename('inkoopadvies');
      if (format_ === 'csv') generateCSV(rows, columns, filename);
      else generateExcel(rows, columns, filename, 'Inkoopadvies');

      toast.success(`Inkoopadvies geëxporteerd (${rows.length} producten)`);
    } catch (e: any) {
      toast.error('Export mislukt: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportReorderAdvice, isExporting };
};
