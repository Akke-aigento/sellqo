// HORECA-CHANNELS-1 — waar dit gerecht te bestellen is, en "op voor vandaag" (horeca).
// Eén kaart voor webshop, QR-menu en kassa: wat hier uit staat, kan daar niet besteld worden
// (de storefront-api en de kassa dwingen het af). Bewaart meteen, los van het productformulier.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { isSoldOutNow, useSoldOutToday } from './useSoldOutToday';

export const CHANNELS = ['online', 'table', 'menu', 'pos'] as const;
export type ProductChannel = (typeof CHANNELS)[number];

export function ProductChannelsCard({ productId }: { productId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const key = ['product-channels', productId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('products').select('channels, sold_out_until').eq('id', productId).single();
      if (error) throw error;
      const r = row as unknown as { channels: string[] | null; sold_out_until: string | null };
      return { channels: r.channels ?? [...CHANNELS], soldOutUntil: r.sold_out_until };
    },
  });
  const [channels, setChannels] = useState<string[]>([...CHANNELS]);
  useEffect(() => { if (data) setChannels(data.channels); }, [data]);
  const soldOut = useSoldOutToday();

  const save = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase.from('products').update({ channels: next } as never).eq('id', productId);
      if (error) throw error;
    },
    onError: () => { toast.error(t('admin.storefront.food.save_failed')); if (data) setChannels(data.channels); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggle = (c: ProductChannel, on: boolean) => {
    let next = on ? [...new Set([...channels, c])] : channels.filter((x) => x !== c);
    // Aan tafel bestelbaar = ook zichtbaar op de kaart.
    if (c === 'table' && on && !next.includes('menu')) next = [...next, 'menu'];
    if (c === 'menu' && !on) next = next.filter((x) => x !== 'table');
    const ordered = CHANNELS.filter((x) => next.includes(x));
    setChannels(ordered);
    save.mutate(ordered);
  };

  const isOut = isSoldOutNow(data?.soldOutUntil);
  const until = data?.soldOutUntil
    ? new Intl.DateTimeFormat(i18n.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(data.soldOutUntil))
    : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('admin.storefront.food.channels_title')}
          {save.isPending || soldOut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
        <CardDescription>{t('admin.storefront.food.channels_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {CHANNELS.map((c) => (
                <div key={c} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <Label htmlFor={`ch-${c}`} className="font-medium">{t(`admin.storefront.food.channel_${c}`)}</Label>
                    <p className="text-xs text-muted-foreground">{t(`admin.storefront.food.channel_${c}_desc`)}</p>
                  </div>
                  <Switch id={`ch-${c}`} checked={channels.includes(c)} onCheckedChange={(v) => toggle(c, v)} />
                </div>
              ))}
            </div>
            {channels.length === 0 ? <p className="text-xs text-destructive">{t('admin.storefront.food.channels_none')}</p> : null}
            <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-3">
              <div>
                <Label htmlFor="sold-out-today" className="font-medium">{t('admin.storefront.food.sold_out_title')}</Label>
                <p className="text-xs text-muted-foreground">
                  {isOut ? t('admin.storefront.food.sold_out_until', { until }) : t('admin.storefront.food.sold_out_desc')}
                </p>
              </div>
              <Switch id="sold-out-today" checked={isOut} disabled={soldOut.isPending}
                onCheckedChange={(v) => soldOut.mutate({ productId, soldOut: v })} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
