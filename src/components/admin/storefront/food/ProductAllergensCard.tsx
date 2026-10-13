// ALLERGEN-1 — allergenen en dieetlabels van één product (horeca-module).
// EU 1169/2011: bij verkoop op afstand moet de klant de allergenen vóór de aankoop zien.
// Bewaart meteen, net als de extra's: los van het productformulier.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ALLERGENS, DIETARY, type AllergenCode, type DietaryCode } from './allergens';

export function ProductAllergensCard({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['product-food-info', productId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('products').select('allergens, dietary').eq('id', productId).single();
      if (error) throw error;
      return { allergens: row.allergens || [], dietary: row.dietary || [] };
    },
  });
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  useEffect(() => { if (data) { setAllergens(data.allergens); setDietary(data.dietary); } }, [data]);

  const save = useMutation({
    mutationFn: async (next: { allergens: string[]; dietary: string[] }) => {
      const { error } = await supabase.from('products').update(next).eq('id', productId);
      if (error) throw error;
    },
    onError: () => { toast.error(t('admin.storefront.food.save_failed')); if (data) { setAllergens(data.allergens); setDietary(data.dietary); } },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggle = (list: 'allergens' | 'dietary', code: AllergenCode | DietaryCode, on: boolean) => {
    const cur = list === 'allergens' ? allergens : dietary;
    const next = on ? [...new Set([...cur, code])] : cur.filter((c) => c !== code);
    // Vegan is ook vegetarisch: dan beide aanzetten.
    const nextDietary = list === 'dietary'
      ? (on && code === 'vegan' && !next.includes('vegetarian') ? [...next, 'vegetarian'] : next)
      : dietary;
    const nextAllergens = list === 'allergens' ? next : allergens;
    setAllergens(nextAllergens); setDietary(nextDietary);
    save.mutate({ allergens: nextAllergens, dietary: nextDietary });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('admin.storefront.food.allergens_title')}
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
        <CardDescription>{t('admin.storefront.food.allergens_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ALLERGENS.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <Checkbox id={`al-${code}`} checked={allergens.includes(code)} onCheckedChange={(v) => toggle('allergens', code, v === true)} />
                  <Label htmlFor={`al-${code}`} className="font-normal">{t(`admin.allergens.${code}`)}</Label>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">{t('admin.storefront.food.dietary_title')}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {DIETARY.map((code) => (
                  <div key={code} className="flex items-center gap-2">
                    <Checkbox id={`di-${code}`} checked={dietary.includes(code)} onCheckedChange={(v) => toggle('dietary', code, v === true)} />
                    <Label htmlFor={`di-${code}`} className="font-normal">{t(`admin.dietary.${code}`)}</Label>
                  </div>
                ))}
              </div>
            </div>
            {!allergens.length ? <p className="text-xs text-muted-foreground">{t('admin.storefront.food.allergens_none_hint')}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
