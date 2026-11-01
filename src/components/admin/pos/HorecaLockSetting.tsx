// KASSA-UX-6 — Kassa › Personeel: na hoeveel minuten zonder aanraking SellQo Kassa terug op het
// PIN-scherm valt (horeca_pay_settings.kassa_lock_minutes; 0 = nooit). De kassa leest dit bij het
// openen (useKassaLockMinutes). Bewaart meteen bij een keuze: één waarde, geen formulier.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LOCK_MINUTES, normalizeLockMinutes } from '@/kassa/app/horeca/kassaUx';

export function HorecaLockSetting() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [saving, setSaving] = useState<number | null>(null);
  const { data: current, isLoading } = useQuery({
    queryKey: ['horeca-lock-minutes', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('horeca_pay_settings' as never).select('kassa_lock_minutes').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      return normalizeLockMinutes((data as { kassa_lock_minutes?: number } | null)?.kassa_lock_minutes ?? 2);
    },
  });

  const pick = async (m: number) => {
    if (!tenantId || m === current || saving !== null) return;
    setSaving(m);
    const { error } = await supabase.from('horeca_pay_settings' as never).upsert(
      { tenant_id: tenantId, kassa_lock_minutes: m, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never,
      { onConflict: 'tenant_id' },
    );
    setSaving(null);
    if (error) { toast.error(t('admin.horecaPay.save_failed', { reason: error.message })); return; }
    toast.success(t('admin.horecaPay.saved'));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['horeca-lock-minutes', tenantId] }),
      qc.invalidateQueries({ queryKey: ['kassa-lock-minutes', tenantId] }),
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.kassaLock.title')}</CardTitle>
        <CardDescription>{t('admin.kassaLock.desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label={t('admin.kassaLock.title')}>
            {LOCK_MINUTES.map((m) => (
              <button key={m} type="button" onClick={() => void pick(m)} aria-pressed={current === m} disabled={saving !== null}
                className={cn('flex h-11 items-center justify-center gap-1.5 rounded-lg border-2 text-sm font-medium', current === m ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
                {saving === m ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {m === 0 ? t('admin.kassaLock.never') : t('admin.kassaLock.minutes', { count: m })}
              </button>
            ))}
          </div>
        )}
        {current === 0 ? <p className="mt-2 text-xs text-muted-foreground">{t('admin.kassaLock.never_hint')}</p> : null}
      </CardContent>
    </Card>
  );
}
