import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrintfulImportPreviewVariant {
  sync_variant_id: number;
  name: string;
  title: string;
  sku: string | null;
  retail_price: number | null;
  attribute_values: Record<string, string>;
  preview_image_url: string | null;
  already_mapped: boolean;
  sku_in_use: boolean;
}

export interface PrintfulImportPreviewProduct {
  sync_product_id: number;
  name: string;
  thumbnail_url: string | null;
  duplicate: boolean;
  variants: PrintfulImportPreviewVariant[];
}

export interface PrintfulImportResult {
  sync_product_id: number;
  status: 'imported' | 'skipped_duplicate' | 'failed';
  product_id?: string;
  variant_count?: number;
  error?: string;
}

// Mirrors usePrintfulConnection's invoke(): functions.invoke hides the readable
// server message on non-2xx, so we unwrap it ourselves.
async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let serverMsg: string | null = null;
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string } | null>; response?: Response } }).context;
      if (ctx?.json) serverMsg = (await ctx.json())?.error ?? null;
      else if (ctx?.response) {
        const txt = await ctx.response.clone().text();
        try { serverMsg = (JSON.parse(txt) as { error?: string })?.error ?? null; }
        catch { serverMsg = txt || null; }
      }
    } catch { /* fall back on error.message */ }
    throw new Error(serverMsg || error.message || 'Aanroep mislukt');
  }
  const payload = data as ({ success?: boolean; error?: string } & T) | null;
  if (!payload || payload.success === false) throw new Error(payload?.error || 'Onbekende fout');
  return payload as T;
}

export function usePrintfulImportPreview(tenantId: string | undefined) {
  return useMutation({
    mutationFn: (payload?: { syncProductIds?: number[] }) =>
      invoke<{ products: PrintfulImportPreviewProduct[] }>('preview-printful-import', {
        tenantId,
        ...(payload?.syncProductIds?.length ? { syncProductIds: payload.syncProductIds } : {}),
      }),
    onError: (err: Error) => toast.error(err.message || 'Preview ophalen mislukt'),
  });
}

export interface ApplyPayloadProduct {
  sync_product_id: number;
  name: string;
  price?: number | null;
  featured_source_url?: string | null;
  variants: Array<{
    sync_variant_id: number;
    title: string;
    attribute_values: Record<string, string>;
    sku: string | null;
    price: number | null;
    preview_image_url: string | null;
  }>;
}

export function usePrintfulImportApply(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (products: ApplyPayloadProduct[]) =>
      invoke<{ results: PrintfulImportResult[]; imported: number; skipped: number; failed: number }>(
        'apply-printful-import',
        { tenantId, products },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['printful-variant-mappings', tenantId] });
      qc.invalidateQueries({ queryKey: ['printful-tenant-variants', tenantId] });
      const parts = [`${res.imported} geïmporteerd`];
      if (res.skipped) parts.push(`${res.skipped} overgeslagen`);
      if (res.failed) parts.push(`${res.failed} mislukt`);
      if (res.failed) toast.error(parts.join(', '));
      else toast.success(parts.join(', '));
    },
    onError: (err: Error) => toast.error(err.message || 'Importeren mislukt'),
  });
}
