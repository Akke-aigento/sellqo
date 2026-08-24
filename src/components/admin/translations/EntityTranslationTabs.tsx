import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Languages, Sparkles, Loader2, Lock, Unlock, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ReadOnlyBadge } from '@/components/permissions/ReadOnlyBadge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { useTranslations } from '@/hooks/useTranslations';
import { useCan } from '@/hooks/useCan';
import {
  TRANSLATION_LANGUAGES,
  ENTITY_TRANSLATABLE_FIELDS,
  FIELD_LABELS,
  type TranslationLanguage,
  type TranslatableField,
  type TranslatableEntityType,
} from '@/types/translation';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface EntityTranslationTabsProps {
  entityType: 'product' | 'category';
  entityId: string;
  fields?: TranslatableField[];
  defaultLocale?: TranslationLanguage;
}

/**
 * Generic per-entity translation editor for products and categories.
 * Per field: source (NL) reference, target textarea/input, AI translate,
 * lock toggle. Read-only when the user lacks `write` on content_translations.
 */
export function EntityTranslationTabs({
  entityType,
  entityId,
  fields,
  defaultLocale = 'nl',
}: EntityTranslationTabsProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { activeLocales } = useTenantDomains();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const canWrite = useCan('write', 'content_translations');

  const entityFields = fields ?? ENTITY_TRANSLATABLE_FIELDS[entityType];
  const translationLocales = activeLocales.filter(l => l !== defaultLocale);

  const { useEntityTranslations, translateEntity } = useTranslations();
  const { data: translations = [], refetch: refetchTranslations } = useEntityTranslations(
    entityType,
    entityId,
  );

  // Fetch entity source content — read from base table columns that mirror
  // TranslatableField names. For categories, meta_* are language-scoped
  // columns (meta_title_nl etc.) so we map those explicitly.
  const { data: sourceEntity } = useQuery({
    queryKey: ['entity-source', entityType, entityId, defaultLocale],
    queryFn: async () => {
      if (!entityId) return null;
      if (entityType === 'product') {
        const { data, error } = await supabase
          .from('products')
          .select('name, description, short_description, meta_title, meta_description')
          .eq('id', entityId)
          .maybeSingle();
        if (error) throw error;
        return (data || {}) as Record<string, string | null>;
      }
      const metaTitleCol = `meta_title_${defaultLocale}`;
      const metaDescCol = `meta_description_${defaultLocale}`;
      const { data, error } = await (supabase as any)
        .from('categories')
        .select(`name, description, meta_title, meta_description, ${metaTitleCol}, ${metaDescCol}`)
        .eq('id', entityId)
        .maybeSingle();
      if (error) throw error;
      const row = (data || {}) as Record<string, string | null>;
      return {
        name: row.name ?? null,
        description: row.description ?? null,
        meta_title: row[metaTitleCol] ?? row.meta_title ?? null,
        meta_description: row[metaDescCol] ?? row.meta_description ?? null,
      };
    },
    enabled: !!entityId,
  });

  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [savingLocale, setSavingLocale] = useState<string | null>(null);

  useEffect(() => {
    const values: Record<string, Record<string, string>> = {};
    for (const locale of translationLocales) {
      values[locale] = {};
      for (const field of entityFields) {
        const t = translations.find(
          (tr: any) => tr.target_language === locale && tr.field_name === field,
        );
        values[locale][field] = t?.translated_content || '';
      }
    }
    setLocalValues(values);
  }, [translations, translationLocales.join(','), entityFields.join(',')]);

  const findTranslation = (locale: string, field: string) =>
    translations.find((t: any) => t.target_language === locale && t.field_name === field);

  const upsertMany = async (
    locale: string,
    entries: Array<{ field: string; value: string }>,
  ) => {
    if (!tenantId) return;
    const { data: session } = await supabase.auth.getSession();
    const rows = entries.map(({ field, value }) => ({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      field_name: field,
      source_language: defaultLocale,
      target_language: locale,
      translated_content: value || null,
      source_content: (sourceEntity as any)?.[field] ?? null,
      is_auto_translated: false,
      translated_at: new Date().toISOString(),
      translated_by: session?.session?.user?.id ?? null,
    }));
    const { error } = await supabase
      .from('content_translations')
      .upsert(rows, {
        onConflict: 'tenant_id,entity_type,entity_id,field_name,target_language',
      });
    if (error) throw error;
  };

  const handleSaveLocale = async (locale: string) => {
    if (!canWrite) return;
    const values = localValues[locale] || {};
    // Skip empty fields when there's no existing row (avoid empty inserts).
    // Existing rows may be cleared explicitly.
    const entries = entityFields
      .map(f => ({ field: f, value: values[f] || '' }))
      .filter(({ field, value }) => {
        if (value.trim().length > 0) return true;
        return !!findTranslation(locale, field);
      });
    if (entries.length === 0) {
      toast.info('Geen wijzigingen om op te slaan');
      return;
    }
    setSavingLocale(locale);
    try {
      await upsertMany(locale, entries);
      await refetchTranslations();
      queryClient.invalidateQueries({ queryKey: ['pending-translations'] });
      queryClient.invalidateQueries({ queryKey: ['translation-stats'] });
      toast.success(t('admin.translations.entityTranslationTabs.vertalingen_opgeslagen'));
    } catch (err: any) {
      toast.error('Fout bij opslaan vertalingen', { description: err?.message });
    } finally {
      setSavingLocale(null);
    }
  };

  const handleAITranslate = async (locale: TranslationLanguage, field: TranslatableField) => {
    if (!canWrite || !tenantId) return;
    const key = `${locale}:${field}`;
    setFieldLoading(prev => ({ ...prev, [key]: true }));
    try {
      const response = await supabase.functions.invoke('ai-translate-content', {
        body: {
          tenantId,
          entityType,
          entityId,
          entityTypes: [entityType],
          entityIds: [entityId],
          targetLanguages: [locale],
          fields: [field],
          mode: 'all',
        },
      });
      if (response.error) throw response.error;
      await refetchTranslations();
      queryClient.invalidateQueries({ queryKey: ['pending-translations'] });
      queryClient.invalidateQueries({ queryKey: ['translation-stats'] });
      toast.success('Veld vertaald');
    } catch (err: any) {
      const status = err?.context?.status;
      if (status === 402) {
        toast.error('Onvoldoende AI credits');
      } else {
        toast.error('Fout bij AI-vertaling', { description: err?.message });
      }
    } finally {
      setFieldLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleToggleLock = async (translationId: string, current: boolean) => {
    if (!canWrite) return;
    const { error } = await supabase
      .from('content_translations')
      .update({ is_locked: !current })
      .eq('id', translationId);
    if (error) {
      toast.error('Kon slot niet omschakelen');
      return;
    }
    await refetchTranslations();
    toast.success(!current ? t('admin.translations.entityTranslationTabs.vertaling_vergrendeld') : t('admin.translations.entityTranslationTabs.vertaling_ontgrendeld'));
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

  if (translationLocales.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-4 w-4" />
          Vertalingen
          {!canWrite && <ReadOnlyBadge resource="content_translations" className="ml-2" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={translationLocales[0]}>
          <TabsList>
            {translationLocales.map(locale => {
              const lang = TRANSLATION_LANGUAGES.find(l => l.code === locale);
              const filledCount = entityFields.filter(f => localValues[locale]?.[f]).length;
              return (
                <TabsTrigger key={locale} value={locale} className="gap-1">
                  {lang?.flag} {lang?.label}
                  {filledCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs h-5">
                      {filledCount}/{entityFields.length}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {translationLocales.map(locale => (
            <TabsContent key={locale} value={locale} className="space-y-4 mt-4">
              {entityFields.map(field => {
                const key = `${locale}:${field}`;
                const existing = findTranslation(locale, field);
                const isLocked = !!existing?.is_locked;
                const isBusy = !!fieldLoading[key];
                const sourceValue = (sourceEntity as any)?.[field] ?? '';
                const isLongField = field === 'description' || field === 'short_description' || field === 'meta_description';
                return (
                  <div key={field} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm flex items-center gap-2">
                        {FIELD_LABELS[field]}
                        {isLocked && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="h-3 w-3" />
                            {t('admin.translations.entityTranslationTabs.vergrendeld')}
                          </Badge>
                        )}
                      </Label>
                      <div className="flex items-center gap-1">
                        {existing && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleLock(existing.id, isLocked)}
                                  disabled={!canWrite}
                                  aria-label={isLocked ? t('admin.translations.entityTranslationTabs.ontgrendelen') : t('admin.translations.entityTranslationTabs.vergrendelen')}
                                >
                                  {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isLocked
                                  ? t('admin.translations.entityTranslationTabs.ontgrendelen_ai_mag_deze_vertaling_overschrijven') : t('admin.translations.entityTranslationTabs.vergrendelen_wordt_niet_overschreven_door_ai')}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAITranslate(locale as TranslationLanguage, field as TranslatableField)}
                          disabled={!canWrite || isBusy || isLocked || !sourceValue}
                        >
                          {isBusy ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                          )}
                          AI vertaal
                        </Button>
                      </div>
                    </div>
                    {sourceValue && (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 border">
                        <span className="font-medium mr-1">{defaultLocale.toUpperCase()}:</span>
                        <span className="line-clamp-3 whitespace-pre-wrap">{String(sourceValue)}</span>
                      </p>
                    )}
                    {isLongField ? (
                      <Textarea
                        value={localValues[locale]?.[field] || ''}
                        onChange={e => updateLocalValue(locale, field, e.target.value)}
                        rows={4}
                        readOnly={!canWrite}
                        disabled={!canWrite}
                        placeholder={`${FIELD_LABELS[field]} in ${getLocaleLabel(locale)}`}
                      />
                    ) : (
                      <Input
                        value={localValues[locale]?.[field] || ''}
                        onChange={e => updateLocalValue(locale, field, e.target.value)}
                        readOnly={!canWrite}
                        disabled={!canWrite}
                        placeholder={`${FIELD_LABELS[field]} in ${getLocaleLabel(locale)}`}
                      />
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveLocale(locale)}
                  disabled={!canWrite || savingLocale === locale}
                >
                  {savingLocale === locale && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
