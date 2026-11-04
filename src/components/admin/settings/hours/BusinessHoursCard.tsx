// UREN-1 — Instellingen › Bedrijf › Openingsuren: de enige plek waar een zaak haar uren en
// uitzonderlijke sluitingsdagen invult. Je website toont ze; afhalen, leveren en online reserveren
// nemen ze standaard over (daar kies je "Zelfde als openingsuren" of "Eigen uren").
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Clock, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/hooks/useTenant';
import { useCan } from '@/hooks/useCan';
import { businessHoursKey, useBusinessHours } from '@/hooks/useBusinessHours';
import { EMPTY_HOURS, MAX_REASON, saveBusinessHours, todayYmd, validateHours, type BusinessHours } from '@/lib/businessHours';
import { WeekHoursEditor } from './WeekHoursEditor';
import { closureLabel } from './dayNames';

export function BusinessHoursCard() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const canWrite = useCan('write', 'settings_general');
  const qc = useQueryClient();
  const { data, isLoading } = useBusinessHours();
  const [hours, setHours] = useState<BusinessHours>(EMPTY_HOURS);
  const [initial, setInitial] = useState<string>(JSON.stringify(EMPTY_HOURS));
  const [draft, setDraft] = useState({ from: '', to: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const next = data ?? EMPTY_HOURS;
    setHours(next);
    setInitial(JSON.stringify(next));
  }, [data]);
  // Links vanuit afhalen/leveren en reservaties landen hier (#openingsuren).
  useEffect(() => {
    if (location.hash === '#openingsuren' && !isLoading) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, isLoading]);

  const today = todayYmd(hours.timezone);
  const upcoming = hours.closures.filter((c) => c.to >= today);
  const dirty = JSON.stringify(hours) !== initial;
  const error = validateHours(hours);
  const draftOk = /^\d{4}-\d{2}-\d{2}$/.test(draft.from) && (!draft.to || draft.to >= draft.from);

  const addClosure = () => {
    if (!draftOk) return;
    const c = { from: draft.from, to: draft.to || draft.from, reason: draft.reason.trim() ? draft.reason.trim().slice(0, MAX_REASON) : null };
    setHours((h) => ({ ...h, closures: [...h.closures, c].sort((a, b) => a.from.localeCompare(b.from)) }));
    setDraft({ from: '', to: '', reason: '' });
  };

  const save = async () => {
    if (!tenantId || error) return;
    setSaving(true);
    try {
      const ok = await saveBusinessHours(tenantId, hours);
      if (!ok) { toast.error(t('common.saveNoPermission')); return; }
      toast.success(t('settings.businessHours.saved'));
      await qc.invalidateQueries({ queryKey: businessHoursKey(tenantId) });
    } catch (e) {
      toast.error(t('settings.businessHours.save_failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="openingsuren" ref={ref} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Clock className="h-6 w-6 text-primary" aria-hidden /></div>
          <div>
            <CardTitle>{t('settings.businessHours.title')}</CardTitle>
            <CardDescription>{t('settings.businessHours.intro')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={t('common.loading')} /></div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('settings.businessHours.week_title')}</p>
              <p className="text-xs text-muted-foreground">{t('settings.businessHours.week_hint')}</p>
              <WeekHoursEditor week={hours.week} disabled={!canWrite} onChange={(week) => setHours((h) => ({ ...h, week }))} />
            </div>

            <div className="space-y-3 border-t pt-5">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><CalendarOff className="h-4 w-4" aria-hidden />{t('settings.businessHours.closures_title')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.businessHours.closures_hint')}</p>
              </div>
              {upcoming.length ? (
                <ul className="flex flex-wrap gap-2">
                  {upcoming.map((c) => (
                    <li key={`${c.from}-${c.to}-${c.reason ?? ''}`} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                      <span>{closureLabel(i18n.language, c.from, c.to)}{c.reason ? <span className="text-muted-foreground"> · {c.reason}</span> : null}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={!canWrite} aria-label={t('common.delete')}
                        onClick={() => setHours((h) => ({ ...h, closures: h.closures.filter((x) => x !== c) }))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">{t('settings.businessHours.closures_none')}</p>}
              {canWrite ? (
                <div className="grid gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label htmlFor="closure-from" className="text-xs">{t('settings.businessHours.closure_from')}</Label>
                    <Input id="closure-from" type="date" min={today} value={draft.from} className="h-9"
                      onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value, to: d.to && d.to < e.target.value ? '' : d.to }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="closure-to" className="text-xs">{t('settings.businessHours.closure_to')}</Label>
                    <Input id="closure-to" type="date" min={draft.from || today} value={draft.to} className="h-9"
                      onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="closure-reason" className="text-xs">{t('settings.businessHours.closure_reason')}</Label>
                    <Input id="closure-reason" maxLength={MAX_REASON} value={draft.reason} placeholder={t('settings.businessHours.closure_reason_placeholder')} className="h-9"
                      onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-9" disabled={!draftOk} onClick={addClosure}>
                    <Plus className="mr-1.5 h-4 w-4" />{t('settings.businessHours.closure_add')}
                  </Button>
                </div>
              ) : null}
            </div>

            {error ? <p role="alert" className="text-sm text-destructive">{t(`settings.businessHours.error_${error}`)}</p> : null}
            {canWrite ? (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                {dirty ? <span className="text-xs text-muted-foreground">{t('settings.businessHours.unsaved')}</span> : null}
                <Button onClick={save} disabled={saving || !dirty || !!error}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('settings.businessHours.save')}
                </Button>
              </div>
            ) : <p className="text-xs text-muted-foreground">{t('settings.businessHours.read_only')}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
