// FOOD-1 — afhalen en leveren voor de standaardshop: afhaal- en levermethodes (met
// leverzone en minimumbedrag) en tijdsloten per weekdag. Afhalen/leveren zijn gewone
// verzendmethodes met een soort; gewone verzendmethodes blijven in Instellingen > Verzending.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, CalendarOff, ChefHat, Clock, Loader2, Mail, Plus, Store, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Json } from '@/integrations/supabase/types';
import { DecimalInput } from './DecimalInput';
import { DAYS, emptyHours, parseHours, type Hours, type ServiceType } from './fulfillmentHours';
import { useTranslation } from 'react-i18next';

interface Method {
  id?: string; name: string; price: number; free_above: number | null; is_active: boolean;
  fulfillment_type: ServiceType; postal_codes: string[] | null; min_order_amount: number | null; description: string | null;
}
interface Settings {
  slots_enabled: boolean; slot_minutes: number; prep_minutes: number; days_ahead: number;
  max_orders_per_slot: number | null; hours: Hours; pay_on_pickup: boolean; notify_ready: boolean;
  /** PAUSE-1: sluitingsdagen (YYYY-MM-DD). */
  closed_dates: string[];
}
const DEFAULT_SETTINGS: Settings = { slots_enabled: false, slot_minutes: 15, prep_minutes: 20, days_ahead: 0, max_orders_per_slot: null, hours: emptyHours(), pay_on_pickup: false, notify_ready: true, closed_dates: [] };
// Labels als i18n-key; de sleutel is de enum-waarde.
const HOURS_TAB_KEY: Record<ServiceType, string> = { pickup: 'admin.storefront.food.hours_pickup', local_delivery: 'admin.storefront.food.hours_delivery' };

function MethodRow({ m, onChange, onRemove }: { m: Method; onChange: (m: Method) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const delivery = m.fulfillment_type === 'local_delivery';
  // Eigen tekst bijhouden, anders verdwijnt een getypte komma meteen.
  const [zone, setZone] = useState((m.postal_codes || []).join(', '));
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {delivery ? <Bike className="h-4 w-4 text-muted-foreground" /> : <Store className="h-4 w-4 text-muted-foreground" />}
        <Input value={m.name} onChange={(e) => onChange({ ...m, name: e.target.value })} className="h-9" aria-label={t('common.name')} />
        <div className="flex items-center gap-2 pl-2">
          <Switch checked={m.is_active} onCheckedChange={(v) => onChange({ ...m, is_active: v })} aria-label={t('admin.marketing.aBTestingPanel.actief')} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>{t('admin.storefront.food.fulfillmentSettings.kost')}</Label>
          <DecimalInput value={m.price ?? 0} onChange={(v) => onChange({ ...m, price: v ?? 0 })} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label>{t('admin.storefront.food.fulfillmentSettings.gratis_vanaf')}</Label>
          <DecimalInput placeholder={t('admin.storefront.food.never')} value={m.free_above} onChange={(v) => onChange({ ...m, free_above: v })} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label>{t('admin.storefront.food.fulfillmentSettings.minimumbedrag')}</Label>
          <DecimalInput placeholder={t('admin.storefront.food.none_lower')} value={m.min_order_amount} onChange={(v) => onChange({ ...m, min_order_amount: v })} className="h-9" />
        </div>
      </div>
      {delivery ? (
        <div className="space-y-1.5">
          <Label>{t('admin.storefront.food.fulfillmentSettings.postcodes_waar_je_levert')}</Label>
          <Input placeholder={t('admin.storefront.food.fulfillmentSettings.bv_3000_3001_3010_of_30')} value={zone}
            onChange={(e) => { setZone(e.target.value); onChange({ ...m, postal_codes: e.target.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean) }); }} className="h-9" />
          <p className="text-xs text-muted-foreground">{t('admin.storefront.food.fulfillmentSettings.een_sterretje_betekent_begint_met_30')}</p>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label>{t('admin.storefront.food.fulfillmentSettings.uitleg_voor_de_klant_optioneel')}</Label>
        <Input placeholder={delivery ? t('admin.storefront.food.fulfillmentSettings.bv_levering_binnen_45_minuten') : t('admin.storefront.food.fulfillmentSettings.bv_kerkstraat_1_leuven')} value={m.description || ''} onChange={(e) => onChange({ ...m, description: e.target.value || null })} className="h-9" />
      </div>
    </div>
  );
}

function HoursEditor({ hours, type, onChange }: { hours: Hours; type: ServiceType; onChange: (h: Hours) => void }) {
  const { t } = useTranslation();
  const week = hours[type];
  const setDay = (d: string, ranges: [string, string][]) => onChange({ ...hours, [type]: { ...week, [d]: ranges } });
  return (
    <div className="space-y-2">
      {DAYS.map(({ key, labelKey }) => {
        const label = t(labelKey);
        const ranges = week[key] || [];
        const open = ranges.length > 0;
        return (
          <div key={key} className="flex flex-wrap items-center gap-2 border-b py-2 last:border-0">
            <span className="w-24 text-sm font-medium">{label}</span>
            <Switch checked={open} onCheckedChange={(v) => setDay(key, v ? [['17:00', '22:00']] : [])} aria-label={t('admin.storefront.food.day_open', { day: label })} />
            {open ? ranges.map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <Input type="time" value={r[0]} onChange={(e) => setDay(key, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="h-8 w-[6.5rem]" aria-label={t('admin.storefront.food.fulfillmentSettings.van')} />
                <span className="text-muted-foreground">–</span>
                <Input type="time" value={r[1]} onChange={(e) => setDay(key, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="h-8 w-[6.5rem]" aria-label={t('admin.storefront.food.fulfillmentSettings.tot')} />
                {i > 0 ? <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDay(key, ranges.filter((_, j) => j !== i))} aria-label={t('admin.storefront.food.fulfillmentSettings.blok_verwijderen')}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
              </span>
            )) : <span className="text-sm text-muted-foreground">{t('admin.storefront.food.fulfillmentSettings.gesloten')}</span>}
            {open && ranges.length < 2 ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDay(key, [...ranges, ['17:00', '22:00']])}>
                <Plus className="mr-1 h-3 w-3" />{t('admin.storefront.food.fulfillmentSettings.2e_blok')}
              </Button>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => {
        const mon = week['1'] || [];
        onChange({ ...hours, [type]: Object.fromEntries(DAYS.map(({ key }) => [key, key === '1' || (week[key] || []).length ? mon : []])) });
      }}>{t('admin.storefront.food.fulfillmentSettings.uren_van_maandag_kopieren_naar_alle')}</Button>
    </div>
  );
}

function ClosedDatesCard({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState('');
  const today = new Date().toLocaleDateString('sv-SE'); // lokale datum als YYYY-MM-DD
  const upcoming = [...value].filter((d) => d >= today).sort();
  const add = () => { if (/^\d{4}-\d{2}-\d{2}$/.test(draft) && !value.includes(draft)) onChange([...value.filter((d) => d >= today), draft].sort()); setDraft(''); };
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5" />{t('admin.storefront.food.closed_title')}</CardTitle>
        <CardDescription>{t('admin.storefront.food.closed_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" min={today} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 w-auto" aria-label={t('admin.storefront.food.closed_date')} />
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft}><Plus className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.closed_add')}</Button>
        </div>
        {upcoming.length ? (
          <ul className="flex flex-wrap gap-2">
            {upcoming.map((d) => (
              <li key={d} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                {fmt(d)}
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onChange(value.filter((x) => x !== d))} aria-label={t('common.delete')}><X className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t('admin.storefront.food.closed_none')}</p>}
      </CardContent>
    </Card>
  );
}

export function FulfillmentSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [methods, setMethods] = useState<Method[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hoursTab, setHoursTab] = useState<ServiceType>('pickup');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fulfillment', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [m, s] = await Promise.all([
        supabase.from('shipping_methods').select('id, name, price, free_above, is_active, fulfillment_type, postal_codes, min_order_amount, description')
          .eq('tenant_id', tenantId!).in('fulfillment_type', ['pickup', 'local_delivery']).order('sort_order', { ascending: true }),
        supabase.from('fulfillment_settings').select('*').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      if (m.error) throw m.error;
      if (s.error) throw s.error;
      return { methods: (m.data || []) as Method[], settings: s.data };
    },
  });

  useEffect(() => {
    if (!data) return;
    setMethods(data.methods);
    setRemoved([]);
    setSettings(data.settings ? {
      slots_enabled: data.settings.slots_enabled, slot_minutes: data.settings.slot_minutes, prep_minutes: data.settings.prep_minutes,
      days_ahead: data.settings.days_ahead, max_orders_per_slot: data.settings.max_orders_per_slot, hours: parseHours(data.settings.hours),
      pay_on_pickup: !!data.settings.pay_on_pickup,
      notify_ready: data.settings.notify_ready !== false,
      closed_dates: data.settings.closed_dates || [],
    } : DEFAULT_SETTINGS);
  }, [data]);

  const addMethod = (type: ServiceType) => setMethods((ms) => [...ms, {
    name: type === 'pickup' ? t('admin.orderDetail.serviceAfhalen') : t('admin.storefront.food.fulfillmentSettings.levering_aan_huis'), price: type === 'pickup' ? 0 : 2.5, free_above: null, is_active: true,
    fulfillment_type: type, postal_codes: type === 'local_delivery' ? [] : null, min_order_amount: type === 'local_delivery' ? 15 : null, description: null,
  }]);

  const save = async () => {
    if (!tenantId) return;
    if (methods.some((m) => !m.name.trim())) { toast.error(t('admin.storefront.food.method_name_required')); return; }
    const badRange = (['pickup', 'local_delivery'] as ServiceType[]).some((t) => Object.values(settings.hours[t]).some((rs) => rs.some(([a, b]) => !a || !b || b <= a)));
    if (settings.slots_enabled && badRange) { toast.error(t('admin.storefront.food.hours_end_before_start')); return; }
    setSaving(true);
    try {
      for (const id of removed) {
        const { error } = await supabase.from('shipping_methods').delete().eq('id', id).eq('tenant_id', tenantId);
        // Al gebruikt in bestellingen (foreign key): dan uitzetten in plaats van verwijderen.
        if (error?.code === '23503') {
          const { error: e2 } = await supabase.from('shipping_methods').update({ is_active: false }).eq('id', id).eq('tenant_id', tenantId);
          if (e2) throw e2;
        } else if (error) throw error;
      }
      for (const m of methods) {
        const row = {
          tenant_id: tenantId, name: m.name.trim(), price: m.price || 0, free_above: m.free_above, is_active: m.is_active,
          fulfillment_type: m.fulfillment_type, postal_codes: m.fulfillment_type === 'local_delivery' && m.postal_codes?.length ? m.postal_codes : null,
          min_order_amount: m.min_order_amount, description: m.description,
        };
        const { error } = m.id
          ? await supabase.from('shipping_methods').update(row).eq('id', m.id).eq('tenant_id', tenantId)
          : await supabase.from('shipping_methods').insert(row);
        if (error) throw error;
      }
      const { error } = await supabase.from('fulfillment_settings').upsert({
        tenant_id: tenantId, slots_enabled: settings.slots_enabled, slot_minutes: settings.slot_minutes, prep_minutes: settings.prep_minutes,
        days_ahead: settings.days_ahead, max_orders_per_slot: settings.max_orders_per_slot, hours: settings.hours as unknown as Json,
        pay_on_pickup: settings.pay_on_pickup,
        notify_ready: settings.notify_ready,
        closed_dates: settings.closed_dates,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(t('admin.storefront.food.fulfillment_saved'));
      await qc.invalidateQueries({ queryKey: ['fulfillment', tenantId] });
      await qc.invalidateQueries({ queryKey: ['shipping-methods'] });
    } catch (e) {
      toast.error(t('admin.storefront.food.save_failed_reason', { reason: e instanceof Error ? e.message : t('admin.storefront.food.unknown_error') }));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle>{t('admin.storefront.food.fulfillmentSettings.afhalen_en_leveren')}</CardTitle>
            <Button asChild variant="outline" size="sm"><Link to="/admin/keuken"><ChefHat className="mr-1.5 h-4 w-4" />{t('admin.orderingHub.keukenscherm')}</Link></Button>
          </div>
          <CardDescription>{t('admin.storefront.food.fulfillmentSettings.voor_restaurants_frituren_bakkers_en_traiteurs')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methods.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.storefront.food.fulfillmentSettings.nog_geen_afhaal_of_levermethode_voeg')}</p> : null}
          {methods.map((m, i) => (
            <MethodRow key={m.id || `new-${i}`} m={m}
              onChange={(next) => setMethods((ms) => ms.map((x, j) => (j === i ? next : x)))}
              onRemove={() => { if (m.id) setRemoved((r) => [...r, m.id!]); setMethods((ms) => ms.filter((_, j) => j !== i)); }} />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addMethod('pickup')}><Store className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.fulfillmentSettings.afhalen_toevoegen')}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addMethod('local_delivery')}><Bike className="mr-1.5 h-4 w-4" />{t('admin.storefront.food.fulfillmentSettings.levering_toevoegen')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" />{t('admin.storefront.food.fulfillmentSettings.betalen_bij_afhalen_of_levering')}</CardTitle>
              <CardDescription>{t('admin.storefront.food.fulfillmentSettings.je_klant_betaalt_contant_of_met')}</CardDescription>
            </div>
            <Switch checked={settings.pay_on_pickup} onCheckedChange={(v) => setSettings((s) => ({ ...s, pay_on_pickup: v }))} aria-label={t('admin.storefront.food.fulfillmentSettings.betalen_bij_afhalen_aan')} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />{t('admin.storefront.food.fulfillmentSettings.klant_verwittigen')}</CardTitle>
              <CardDescription>{t('admin.storefront.food.fulfillmentSettings.je_klant_krijgt_een_mail_zodra')}</CardDescription>
            </div>
            <Switch checked={settings.notify_ready} onCheckedChange={(v) => setSettings((s) => ({ ...s, notify_ready: v }))} aria-label={t('admin.storefront.food.fulfillmentSettings.klant_verwittigen_aan')} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />{t('admin.orderingHub.tijdsloten')}</CardTitle>
              <CardDescription>{t('admin.storefront.food.fulfillmentSettings.laat_klanten_een_afhaal_of_levertijd')}</CardDescription>
            </div>
            <Switch checked={settings.slots_enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, slots_enabled: v }))} aria-label={t('admin.storefront.food.fulfillmentSettings.tijdsloten_aan')} />
          </div>
        </CardHeader>
        {settings.slots_enabled ? (
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{t('admin.storefront.food.fulfillmentSettings.slot_van')}</Label>
                <Select value={String(settings.slot_minutes)} onValueChange={(v) => setSettings((s) => ({ ...s, slot_minutes: Number(v) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 15, 20, 30, 60].map((n) => <SelectItem key={n} value={String(n)}>{n} minuten</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('admin.storefront.food.fulfillmentSettings.bereidingstijd')}</Label>
                <Select value={String(settings.prep_minutes)} onValueChange={(v) => setSettings((s) => ({ ...s, prep_minutes: Number(v) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 10, 15, 20, 30, 45, 60, 90, 120].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? t('admin.storefront.food.none') : t('admin.storefront.food.n_minutes', { count: n })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('admin.storefront.food.fulfillmentSettings.vooruit_bestellen')}</Label>
                <Select value={String(settings.days_ahead)} onValueChange={(v) => setSettings((s) => ({ ...s, days_ahead: Number(v) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3, 7, 14].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? t('admin.storefront.food.today_only') : n === 1 ? t('admin.storefront.food.until_tomorrow') : t('admin.storefront.food.n_days_ahead', { count: n })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('admin.storefront.food.fulfillmentSettings.max_bestellingen_per_slot')}</Label>
                <Input inputMode="numeric" placeholder={t('admin.storefront.food.unlimited')} value={settings.max_orders_per_slot == null ? '' : String(settings.max_orders_per_slot)}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); setSettings((s) => ({ ...s, max_orders_per_slot: Number.isFinite(n) && n > 0 ? n : null })); }} className="h-9" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="inline-flex rounded-md border p-0.5">
                {(['pickup', 'local_delivery'] as ServiceType[]).map((st) => (
                  <button key={st} type="button" onClick={() => setHoursTab(st)}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${hoursTab === st ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {t(HOURS_TAB_KEY[st])}
                  </button>
                ))}
              </div>
              <HoursEditor hours={settings.hours} type={hoursTab} onChange={(h) => setSettings((s) => ({ ...s, hours: h }))} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* PAUSE-1 — sluitingsdagen: geen afhaal- of levertijden, "zo snel mogelijk" kan niet. */}
      <ClosedDatesCard value={settings.closed_dates} onChange={(closed_dates) => setSettings((s) => ({ ...s, closed_dates }))} />

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('common.save')}</Button>
      </div>
    </div>
  );
}
