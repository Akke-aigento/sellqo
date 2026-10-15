import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

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
  image_count?: number;
  variants: PrintfulImportPreviewVariant[];
}

export interface PrintfulImportResult {
  sync_product_id: number;
  status: 'imported' | 'skipped_duplicate' | 'reimported_images' | 'failed';
  product_id?: string;
  variant_count?: number;
  image_count?: number;
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
    throw new Error(serverMsg || error.message || i18n.t('admin.printful.toast.call_failed'));
  }
  const payload = data as ({ success?: boolean; error?: string } & T) | null;
  if (!payload || payload.success === false) throw new Error(payload?.error || i18n.t('admin.printful.toast.unknown_error'));
  return payload as T;
}

export function usePrintfulImportPreview(tenantId: string | undefined) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload?: { syncProductIds?: number[] }) =>
      invoke<{ products: PrintfulImportPreviewProduct[] }>('preview-printful-import', {
        tenantId,
        ...(payload?.syncProductIds?.length ? { syncProductIds: payload.syncProductIds } : {}),
      }),
    onError: (err: Error) => toast.error(err.message || t('admin.printful.toast.preview_failed')),
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
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: ApplyPayloadProduct[] | { products: ApplyPayloadProduct[]; reimport?: boolean }) =>
      invoke<{ results: PrintfulImportResult[]; imported: number; skipped: number; reimported?: number; failed: number }>(
        'apply-printful-import',
        Array.isArray(vars)
          ? { tenantId, products: vars }
          : { tenantId, products: vars.products, reimport: vars.reimport === true },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['printful-variant-mappings', tenantId] });
      qc.invalidateQueries({ queryKey: ['printful-tenant-variants', tenantId] });
      if (res.reimported && !res.imported && !res.skipped) {
        if (res.failed) toast.error(t('admin.printful.toast.images_failed'));
        else toast.success(t('admin.printful.toast.images_updated'));
        return;
      }
      const parts = [t('admin.printful.toast.imported', { count: res.imported })];
      if (res.skipped) parts.push(t('admin.printful.toast.skipped', { count: res.skipped }));
      if (res.reimported) parts.push(t('admin.printful.toast.reimported', { count: res.reimported }));
      if (res.failed) parts.push(t('admin.printful.toast.failed_count', { count: res.failed }));
      if (res.failed) toast.error(parts.join(', '));
      else toast.success(parts.join(', '));
    },
    onError: (err: Error) => toast.error(err.message || t('admin.printful.toast.import_failed')),
  });
}
