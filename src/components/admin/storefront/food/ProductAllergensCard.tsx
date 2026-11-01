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
      // ALLERGEEN-VERKLAARD-1: allergens_declared = de allergenen zijn bewust vastgelegd (ook "geen").
      // (types.ts kent de kolom pas na de regeneratie door Lovable: daarom de ruime cast.)
      const { data, error } = await supabase.from('products').select('allergens, dietary, allergens_declared' as 'allergens, dietary').eq('id', productId).single();
      if (error) throw error;
      const row = data as unknown as { allergens: string[] | null; dietary: string[] | null; allergens_declared?: boolean | null };
      return { allergens: row.allergens || [], dietary: row.dietary || [], declared: row.allergens_declared === true };
    },
  });
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [declared, setDeclared] = useState(false);
  useEffect(() => { if (data) { setAllergens(data.allergens); setDietary(data.dietary); setDeclared(data.declared); } }, [data]);

  const save = useMutation({
    mutationFn: async (next: { allergens: string[]; dietary: string[]; allergens_declared: boolean }) => {
      const { error } = await supabase.from('products').update(next as never).eq('id', productId);
      if (error) throw error;
    },
    onError: () => { toast.error(t('admin.storefront.food.save_failed')); if (data) { setAllergens(data.allergens); setDietary(data.dietary); setDeclared(data.declared); } },
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
    // Minstens één allergeen = verklaard (de databank dwingt dat ook af). Haal je het laatste weg, dan
    // is het weer "niet ingevuld" tot je "bevat geen" aanvinkt. Dieetlabels laten de keuze staan.
    const nextDeclared = list === 'allergens' ? nextAllergens.length > 0 : declared;
    setAllergens(nextAllergens); setDietary(nextDietary); setDeclared(nextDeclared);
    save.mutate({ allergens: nextAllergens, dietary: nextDietary, allergens_declared: nextDeclared });
  };
  const setNone = (on: boolean) => {
    if (allergens.length) return;
    setDeclared(on);
    save.mutate({ allergens: [], dietary, allergens_declared: on });
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
            {/* ALLERGEEN-VERKLAARD-1 — "bevat geen" is iets anders dan "niet ingevuld". */}
            <div className="flex items-start gap-2 rounded-md border px-3 py-2">
              <Checkbox id={`al-none-${productId}`} checked={declared && !allergens.length} disabled={allergens.length > 0} onCheckedChange={(v) => setNone(v === true)} className="mt-0.5" />
              <div>
                <Label htmlFor={`al-none-${productId}`} className={allergens.length ? 'font-normal text-muted-foreground' : 'font-normal'}>{t('admin.storefront.food.allergens_none_label')}</Label>
                {allergens.length ? <p className="text-xs text-muted-foreground">{t('admin.storefront.food.allergens_none_disabled')}</p> : null}
              </div>
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
            {!allergens.length && !declared ? <p className="text-xs text-muted-foreground">{t('admin.storefront.food.allergens_none_hint')}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
