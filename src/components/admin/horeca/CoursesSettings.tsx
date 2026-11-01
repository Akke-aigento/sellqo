// GANGEN-1 — Bestellen › Posten: gangen aan tafel aan/uit (standaard uit) en de standaardgang per categorie.
// Bewaart in horeca_pay_settings (courses_enabled, course_by_category); SellQo Kassa leest het bij het openen
// (useKassaCourseSettings). Niet ingesteld: wat naar de bar gaat = geen gang, de rest = hoofdgerecht.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { COURSES, normalizeCourseSettings, type CourseSettings } from '@/kassa/app/horeca/courses';

const AUTO = 'auto';

export function CoursesSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['horeca-course-settings', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from('horeca_pay_settings' as never).select('courses_enabled, course_by_category').eq('tenant_id' as never, tenantId as never).maybeSingle(),
        supabase.from('categories').select('id, name').eq('tenant_id', tenantId!).eq('is_active', true).order('sort_order'),
      ]);
      if (s.error) throw s.error;
      if (c.error) throw c.error;
      return {
        settings: normalizeCourseSettings(s.data as { courses_enabled?: boolean; course_by_category?: unknown } | null),
        categories: (c.data ?? []) as { id: string; name: string }[],
      };
    },
  });

  const save = async (next: CourseSettings) => {
    if (!tenantId || saving) return;
    setSaving(true);
    const { error } = await supabase.from('horeca_pay_settings' as never).upsert(
      { tenant_id: tenantId, courses_enabled: next.enabled, course_by_category: next.byCategory, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never,
      { onConflict: 'tenant_id' },
    );
    setSaving(false);
    if (error) { toast.error(t('admin.horecaPay.save_failed', { reason: error.message })); return; }
    toast.success(t('admin.courses.saved'));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['horeca-course-settings', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-course-settings', tenantId] }),
    ]);
  };

  const s = data?.settings;
  const setCategory = (id: string, v: string) => {
    if (!s) return;
    const byCategory = { ...s.byCategory };
    if (v === AUTO) delete byCategory[id]; else byCategory[id] = Number(v);
    void save({ ...s, byCategory });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.courses.settings_title')}</CardTitle>
        <CardDescription>{t('admin.courses.settings_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !s ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('admin.courses.enabled')}</span>
              <span className="flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <Switch checked={s.enabled} disabled={saving} onCheckedChange={(v) => void save({ ...s, enabled: v })} aria-label={t('admin.courses.enabled')} />
              </span>
            </label>
            {s.enabled ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{t('admin.courses.category_title')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.courses.category_hint')}</p>
                {data.categories.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.courses.no_categories')}</p> : (
                  <ul className="divide-y rounded-md border">
                    {data.categories.map((c) => {
                      const v = s.byCategory[c.id];
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 truncate text-sm">{c.name}</span>
                          <select value={v === undefined ? AUTO : String(v)} disabled={saving} onChange={(e) => setCategory(c.id, e.target.value)}
                            aria-label={t('admin.courses.category_for', { name: c.name })} className="h-11 max-w-[11rem] rounded-md border bg-background px-2 text-sm">
                            <option value={AUTO}>{t('admin.courses.opt_auto')}</option>
                            <option value="0">{t('admin.courses.none')}</option>
                            {COURSES.map((n) => <option key={n} value={String(n)}>{t(`admin.courses.c${n}`)}</option>)}
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
