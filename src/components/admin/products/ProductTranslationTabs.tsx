import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { TRANSLATION_LANGUAGES, ENTITY_TRANSLATABLE_FIELDS, FIELD_LABELS, type TranslationLanguage, type TranslatableField } from '@/types/translation';
import { toast } from 'sonner';

interface ProductTranslationTabsProps {
  productId: string;
  defaultLocale?: string;
}

const PRODUCT_FIELDS: TranslatableField[] = ENTITY_TRANSLATABLE_FIELDS.product;

export function ProductTranslationTabs({ productId, defaultLocale = 'nl' }: ProductTranslationTabsProps) {
  const { currentTenant } = useTenant();
  const { activeLocales } = useTenantDomains();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Only show translation locales (exclude default)
  const translationLocales = activeLocales.filter(l => l !== defaultLocale);

  const { data: translations = [] } = useQuery({
    queryKey: ['product-translations', tenantId, productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_translations')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('entity_type', 'product')
        .eq('entity_id', productId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!productId,
  });

  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});

  // Initialize local values from translations
  useEffect(() => {
    const values: Record<string, Record<string, string>> = {};
    for (const locale of translationLocales) {
      values[locale] = {};
      for (const field of PRODUCT_FIELDS) {
        const t = translations.find(
          tr => tr.target_language === locale && tr.field_name === field
        );
        values[locale][field] = t?.translated_content || '';
      }
    }
    setLocalValues(values);
  }, [translations, translationLocales.join(',')]);

  const saveTranslation = useMutation({
    mutationFn: async ({ locale, field, value }: { locale: string; field: string; value: string }) => {
      const { error } = await supabase
        .from('content_translations')
        .upsert({
          tenant_id: tenantId!,
          entity_type: 'product',
          entity_id: productId,
          field_name: field,
          source_language: defaultLocale,
          target_language: locale,
          translated_content: value || null,
          is_auto_translated: false,
        }, {
          onConflict: 'tenant_id,entity_type,entity_id,field_name,target_language',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-translations', tenantId, productId] });
    },
  });

  const handleSaveLocale = async (locale: string) => {
    const values = localValues[locale] || {};
    try {
      await Promise.all(
        PRODUCT_FIELDS.map(field =>
          saveTranslation.mutateAsync({ locale, field, value: values[field] || '' })
        )
      );
      toast.success(`Vertalingen voor ${getLocaleLabel(locale)} opgeslagen`);
    } catch {
      toast.error('Fout bij opslaan vertalingen');
    }
  };

  const updateLocalValue = (locale: string, field: string, value: string) => {
    setLocalValues(prev => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
  };

  const getLocaleLabel = (code: string) => {
    const lang = TRANSLATION_LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.label}` : code;
  };

  if (translationLocales.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-4 w-4" />
          Vertalingen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={translationLocales[0]}>
          <TabsList>
            {translationLocales.map(locale => {
              const lang = TRANSLATION_LANGUAGES.find(l => l.code === locale);
              const filledCount = PRODUCT_FIELDS.filter(
                f => localValues[locale]?.[f]
              ).length;
              return (
                <TabsTrigger key={locale} value={locale} className="gap-1">
                  {lang?.flag} {lang?.label}
                  {filledCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs h-5">
                      {filledCount}/{PRODUCT_FIELDS.length}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {translationLocales.map(locale => (
            <TabsContent key={locale} value={locale} className="space-y-4 mt-4">
              {PRODUCT_FIELDS.map(field => (
                <div key={field} className="space-y-1">
                  <Label className="text-sm">{FIELD_LABELS[field]}</Label>
                  {field === 'description' ? (
                    <Textarea
                      value={localValues[locale]?.[field] || ''}
                      onChange={e => updateLocalValue(locale, field, e.target.value)}
                      rows={4}
                      placeholder={`${FIELD_LABELS[field]} in ${getLocaleLabel(locale)}`}
                    />
                  ) : (
                    <Input
                      value={localValues[locale]?.[field] || ''}
                      onChange={e => updateLocalValue(locale, field, e.target.value)}
                      placeholder={`${FIELD_LABELS[field]} in ${getLocaleLabel(locale)}`}
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveLocale(locale)}
                  disabled={saveTranslation.isPending}
                >
                  Vertalingen opslaan
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
