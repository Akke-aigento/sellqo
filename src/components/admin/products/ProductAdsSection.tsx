import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface ProductAdsSectionProps {
  productId: string;
  tenantId: string;
  productEan?: string;
}

export function ProductAdsSection({ productId, tenantId, productEan }: ProductAdsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: mapping, isLoading } = useQuery({
    queryKey: ['ads-product-channel-map', productId, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_product_channel_map')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', tenantId)
        .eq('channel', 'bolcom')
        .maybeSingle();
      return data;
    },
  });

  const [isAdvertised, setIsAdvertised] = useState(false);
  const [minStock, setMinStock] = useState(1);
  const [channelRef, setChannelRef] = useState('');

  useEffect(() => {
    if (mapping) {
      setIsAdvertised(mapping.is_advertised ?? false);
      setMinStock(mapping.min_stock_for_ads ?? 1);
      setChannelRef(mapping.channel_product_ref || productEan || '');
    } else {
      setChannelRef(productEan || '');
    }
  }, [mapping, productEan]);

  const upsertMutation = useMutation({
    mutationFn: async (values: { is_advertised: boolean; min_stock_for_ads: number; channel_product_ref: string }) => {
      const { error } = await supabase
        .from('ads_product_channel_map')
        .upsert({
          tenant_id: tenantId,
          product_id: productId,
          channel: 'bolcom',
          is_advertised: values.is_advertised,
          min_stock_for_ads: values.min_stock_for_ads,
          channel_product_ref: values.channel_product_ref || null,
        }, { onConflict: 'tenant_id,product_id,channel' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-product-channel-map', productId, tenantId] });
      toast.success('Advertentie-instellingen opgeslagen');
    },
    onError: () => toast.error('Opslaan mislukt'),
  });

  const save = (overrides: Partial<{ is_advertised: boolean; min_stock_for_ads: number; channel_product_ref: string }> = {}) => {
    upsertMutation.mutate({
      is_advertised: overrides.is_advertised ?? isAdvertised,
      min_stock_for_ads: overrides.min_stock_for_ads ?? minStock,
      channel_product_ref: overrides.channel_product_ref ?? channelRef,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t('common.loading')}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle>{t('admin.products.productAdsSection.advertenties')}</CardTitle>
        </div>
        <CardDescription>{t('admin.products.productAdsSection.beheer_op_welke_kanalen_dit_product')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bol.com channel */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <span className="font-medium">Bol.com</span>
              <Badge variant={isAdvertised ? 'default' : 'secondary'} className="text-xs">
                {isAdvertised ? t('admin.marketing.aBTestingPanel.actief') : t('admin.products.inactief')}
              </Badge>
            </div>
            <Switch
              checked={isAdvertised}
              onCheckedChange={(checked) => {
                setIsAdvertised(checked);
                save({ is_advertised: checked });
              }}
            />
          </div>

          {isAdvertised && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>{t('admin.products.productAdsSection.min_voorraad_voor_ads')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  onBlur={() => save({ min_stock_for_ads: minStock })}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.products.productAdsSection.ads_worden_automatisch_gepauzeerd_als_voorraad')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.products.productAdsSection.channel_ref_ean')}</Label>
                <Input
                  value={channelRef}
                  onChange={(e) => setChannelRef(e.target.value)}
                  onBlur={() => save({ channel_product_ref: channelRef })}
                  placeholder={t('admin.products.productAdsSection.ean_barcode')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.products.productAdsSection.wordt_automatisch_ingevuld_vanuit_productgegevens')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Future channels */}
        {['Amazon', 'Google Ads', 'Meta'].map((ch) => (
          <div key={ch} className="border rounded-lg p-4 opacity-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{ch === 'Amazon' ? '📦' : ch === 'Google Ads' ? '🔍' : '📱'}</span>
                <span className="font-medium">{ch}</span>
                <Badge variant="secondary" className="text-xs">{t('admin.ads.platformConnections.binnenkort')}</Badge>
              </div>
              <Switch disabled checked={false} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
