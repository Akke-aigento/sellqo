import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface StockReportRow {
  key: string;
  product_id: string;
  variant_id: string | null;
  sku: string | null;
  name: string;
  variant_title: string | null;
  category_ids: string[];
  stock: number;
  raw_stock: number;
  negative: boolean;
  cost_price: number;
  sales_price: number;
  stock_value: number;
  sales_value: number;
}

export interface StockReportResult {
  rows: StockReportRow[];
  isReconstruction: boolean;
  usedPoApproximation: boolean;
}

/** End-of-day 23:59:59.999 Europe/Brussels for the given calendar date, as ISO/UTC. */
export function brusselsEndOfDayISO(date: Date): string {
  const guess = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
  const wall = new Date(`${guess.toLocaleString('sv-SE', { timeZone: 'Europe/Brussels' }).replace(' ', 'T')}Z`);
  const offset = wall.getTime() - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const RECEIVED_STATUSES = new Set(['received', 'partially_received']);

export function useStockReport(date: Date) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

  return useQuery<StockReportResult>({
    queryKey: ['stock-report', tenantId, dateKey],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return { rows: [], isReconstruction: false, usedPoApproximation: false };

      const reconstruction = !isToday(date);
      const cutoff = brusselsEndOfDayISO(date);

      const [productsRes, variantsRes, junctionRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, price, cost_price, stock, track_inventory, category_id')
          .eq('tenant_id', tenantId),
        supabase
          .from('product_variants')
          .select('id, product_id, sku, title, price, cost_price, stock, track_inventory, is_active')
          .eq('tenant_id', tenantId),
        supabase
          .from('product_categories')
          .select('product_id, category_id'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variantsRes.error) throw variantsRes.error;

      const products = productsRes.data ?? [];
      const variants = variantsRes.data ?? [];

      const categoryMap = new Map<string, Set<string>>();
      for (const p of products) {
        const set = new Set<string>();
        if (p.category_id) set.add(p.category_id);
        categoryMap.set(p.id, set);
      }
      for (const j of junctionRes.data ?? []) {
        const set = categoryMap.get(j.product_id);
        if (set && j.category_id) set.add(j.category_id);
      }

      // Reconstruction deltas
      const soldProduct = new Map<string, number>();
      const soldVariant = new Map<string, number>();
      const receivedProduct = new Map<string, number>();
      let usedPoApproximation = false;

      if (reconstruction) {
        const [itemsRes, poRes] = await Promise.all([
          supabase
            .from('order_items')
            .select('product_id, variant_id, quantity, orders!inner(tenant_id, status, created_at)')
            .eq('orders.tenant_id', tenantId)
            .gt('orders.created_at', cutoff)
            .neq('orders.status', 'cancelled'),
          supabase
            .from('purchase_order_items')
            .select('product_id, quantity_received, purchase_orders!inner(tenant_id, status, received_at, updated_at)')
            .eq('purchase_orders.tenant_id', tenantId),
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (poRes.error) throw poRes.error;

        for (const it of (itemsRes.data ?? []) as any[]) {
          const qty = Number(it.quantity) || 0;
          if (it.variant_id) {
            soldVariant.set(it.variant_id, (soldVariant.get(it.variant_id) ?? 0) + qty);
          } else if (it.product_id) {
            soldProduct.set(it.product_id, (soldProduct.get(it.product_id) ?? 0) + qty);
          }
        }

        for (const line of (poRes.data ?? []) as any[]) {
          const po = line.purchase_orders;
          if (!po || !line.product_id) continue;
          const qty = Number(line.quantity_received) || 0;
          if (qty <= 0) continue;
          let counts = false;
          if (po.received_at) {
            counts = po.received_at > cutoff;
          } else if (RECEIVED_STATUSES.has(po.status ?? '') && po.updated_at > cutoff) {
            counts = true;
            usedPoApproximation = true;
          }
          if (counts) {
            receivedProduct.set(line.product_id, (receivedProduct.get(line.product_id) ?? 0) + qty);
          }
        }
      }

      const variantsByProduct = new Map<string, typeof variants>();
      for (const v of variants) {
        const list = variantsByProduct.get(v.product_id) ?? [];
        list.push(v);
        variantsByProduct.set(v.product_id, list);
      }

      const rows: StockReportRow[] = [];

      const buildRow = (
        key: string,
        product: (typeof products)[number],
        variant: (typeof variants)[number] | null,
        current: number,
        sold: number,
        received: number,
      ): StockReportRow => {
        const raw = current + sold - received;
        const stock = Math.max(0, raw);
        const cost = Number((variant?.cost_price ?? product.cost_price) ?? 0) || 0;
        const price = Number((variant?.price ?? product.price) ?? 0) || 0;
        return {
          key,
          product_id: product.id,
          variant_id: variant?.id ?? null,
          sku: variant?.sku ?? product.sku ?? null,
          name: product.name,
          variant_title: variant?.title ?? null,
          category_ids: Array.from(categoryMap.get(product.id) ?? []),
          stock,
          raw_stock: raw,
          negative: raw < 0,
          cost_price: cost,
          sales_price: price,
          stock_value: stock * cost,
          sales_value: stock * price,
        };
      };

      for (const p of products) {
        const pv = (variantsByProduct.get(p.id) ?? []).filter((v) => v.track_inventory);
        if (pv.length > 0) {
          for (const v of pv) {
            rows.push(
              buildRow(
                `v-${v.id}`,
                p,
                v,
                Number(v.stock) || 0,
                soldVariant.get(v.id) ?? 0,
                0,
              ),
            );
          }
          continue;
        }
        if (p.track_inventory) {
          rows.push(
            buildRow(
              `p-${p.id}`,
              p,
              null,
              Number(p.stock) || 0,
              soldProduct.get(p.id) ?? 0,
              receivedProduct.get(p.id) ?? 0,
            ),
          );
        }
      }

      rows.sort((a, b) => a.name.localeCompare(b.name) || (a.variant_title ?? '').localeCompare(b.variant_title ?? ''));

      return { rows, isReconstruction: reconstruction, usedPoApproximation };
    },
  });
}
