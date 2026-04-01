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

interface ProductAdsSectionProps {
  productId: string;
  tenantId: string;
  productEan?: string;
}

export function ProductAdsSection({ productId, tenantId, productEan }: ProductAdsSectionProps) {
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
        <CardContent className="py-8 text-center text-muted-foreground">Laden...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle>Advertenties</CardTitle>
        </div>
        <CardDescription>Beheer op welke kanalen dit product wordt geadverteerd</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bol.com channel */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <span className="font-medium">Bol.com</span>
              <Badge variant={isAdvertised ? 'default' : 'secondary'} className="text-xs">
                {isAdvertised ? 'Actief' : 'Inactief'}
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
                <Label>Min. voorraad voor ads</Label>
                <Input
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  onBlur={() => save({ min_stock_for_ads: minStock })}
                />
                <p className="text-xs text-muted-foreground">
                  Ads worden automatisch gepauzeerd als voorraad hieronder komt
                </p>
              </div>
              <div className="space-y-2">
                <Label>Channel Ref (EAN)</Label>
                <Input
                  value={channelRef}
                  onChange={(e) => setChannelRef(e.target.value)}
                  onBlur={() => save({ channel_product_ref: channelRef })}
                  placeholder="EAN / barcode"
                />
                <p className="text-xs text-muted-foreground">
                  Wordt automatisch ingevuld vanuit productgegevens
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
                <Badge variant="secondary" className="text-xs">Binnenkort</Badge>
              </div>
              <Switch disabled checked={false} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
