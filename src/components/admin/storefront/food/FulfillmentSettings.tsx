// FOOD-1 — afhalen en leveren voor de standaardshop: afhaal- en levermethodes (met
// leverzone en minimumbedrag) en tijdsloten per weekdag. Afhalen/leveren zijn gewone
// verzendmethodes met een soort; gewone verzendmethodes blijven in Instellingen > Verzending.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, ChefHat, Clock, Loader2, Mail, Plus, Store, Trash2 } from 'lucide-react';
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

interface Method {
  id?: string; name: string; price: number; free_above: number | null; is_active: boolean;
  fulfillment_type: ServiceType; postal_codes: string[] | null; min_order_amount: number | null; description: string | null;
}
interface Settings {
  slots_enabled: boolean; slot_minutes: number; prep_minutes: number; days_ahead: number;
  max_orders_per_slot: number | null; hours: Hours; pay_on_pickup: boolean; notify_ready: boolean;
}
const DEFAULT_SETTINGS: Settings = { slots_enabled: false, slot_minutes: 15, prep_minutes: 20, days_ahead: 0, max_orders_per_slot: null, hours: emptyHours(), pay_on_pickup: false, notify_ready: true };
const TYPE_LABEL: Record<ServiceType, string> = { pickup: 'Afhalen', local_delivery: 'Levering' };

function MethodRow({ m, onChange, onRemove }: { m: Method; onChange: (m: Method) => void; onRemove: () => void }) {
  const delivery = m.fulfillment_type === 'local_delivery';
  // Eigen tekst bijhouden, anders verdwijnt een getypte komma meteen.
  const [zone, setZone] = useState((m.postal_codes || []).join(', '));
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {delivery ? <Bike className="h-4 w-4 text-muted-foreground" /> : <Store className="h-4 w-4 text-muted-foreground" />}
        <Input value={m.name} onChange={(e) => onChange({ ...m, name: e.target.value })} className="h-9" aria-label="Naam" />
        <div className="flex items-center gap-2 pl-2">
          <Switch checked={m.is_active} onCheckedChange={(v) => onChange({ ...m, is_active: v })} aria-label="Actief" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} aria-label="Verwijderen"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Kost (€)</Label>
          <DecimalInput value={m.price ?? 0} onChange={(v) => onChange({ ...m, price: v ?? 0 })} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label>Gratis vanaf (€)</Label>
          <DecimalInput placeholder="nooit" value={m.free_above} onChange={(v) => onChange({ ...m, free_above: v })} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label>Minimumbedrag (€)</Label>
          <DecimalInput placeholder="geen" value={m.min_order_amount} onChange={(v) => onChange({ ...m, min_order_amount: v })} className="h-9" />
        </div>
      </div>
      {delivery ? (
        <div className="space-y-1.5">
          <Label>Postcodes waar je levert</Label>
          <Input placeholder="bv. 3000, 3001, 3010 of 30* (leeg = overal)" value={zone}
            onChange={(e) => { setZone(e.target.value); onChange({ ...m, postal_codes: e.target.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean) }); }} className="h-9" />
          <p className="text-xs text-muted-foreground">Een sterretje betekent "begint met": 30* = alle postcodes die met 30 beginnen.</p>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label>Uitleg voor de klant (optioneel)</Label>
        <Input placeholder={delivery ? 'bv. Levering binnen 45 minuten' : 'bv. Kerkstraat 1, Leuven'} value={m.description || ''} onChange={(e) => onChange({ ...m, description: e.target.value || null })} className="h-9" />
      </div>
    </div>
  );
}

function HoursEditor({ hours, type, onChange }: { hours: Hours; type: ServiceType; onChange: (h: Hours) => void }) {
  const week = hours[type];
  const setDay = (d: string, ranges: [string, string][]) => onChange({ ...hours, [type]: { ...week, [d]: ranges } });
  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const ranges = week[key] || [];
        const open = ranges.length > 0;
        return (
          <div key={key} className="flex flex-wrap items-center gap-2 border-b py-2 last:border-0">
            <span className="w-24 text-sm font-medium">{label}</span>
            <Switch checked={open} onCheckedChange={(v) => setDay(key, v ? [['17:00', '22:00']] : [])} aria-label={`${label} open`} />
            {open ? ranges.map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <Input type="time" value={r[0]} onChange={(e) => setDay(key, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="h-8 w-[6.5rem]" aria-label="Van" />
                <span className="text-muted-foreground">–</span>
                <Input type="time" value={r[1]} onChange={(e) => setDay(key, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="h-8 w-[6.5rem]" aria-label="Tot" />
                {i > 0 ? <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDay(key, ranges.filter((_, j) => j !== i))} aria-label="Blok verwijderen"><Trash2 className="h-3.5 w-3.5" /></Button> : null}
              </span>
            )) : <span className="text-sm text-muted-foreground">Gesloten</span>}
            {open && ranges.length < 2 ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDay(key, [...ranges, ['17:00', '22:00']])}>
                <Plus className="mr-1 h-3 w-3" />2e blok
              </Button>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => {
        const mon = week['1'] || [];
        onChange({ ...hours, [type]: Object.fromEntries(DAYS.map(({ key }) => [key, key === '1' || (week[key] || []).length ? mon : []])) });
      }}>Uren van maandag kopiëren naar alle open dagen</Button>
    </div>
  );
}

export function FulfillmentSettings() {
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
    } : DEFAULT_SETTINGS);
  }, [data]);

  const addMethod = (type: ServiceType) => setMethods((ms) => [...ms, {
    name: type === 'pickup' ? 'Afhalen' : 'Levering aan huis', price: type === 'pickup' ? 0 : 2.5, free_above: null, is_active: true,
    fulfillment_type: type, postal_codes: type === 'local_delivery' ? [] : null, min_order_amount: type === 'local_delivery' ? 15 : null, description: null,
  }]);

  const save = async () => {
    if (!tenantId) return;
    if (methods.some((m) => !m.name.trim())) { toast.error('Elke methode heeft een naam nodig'); return; }
    const badRange = (['pickup', 'local_delivery'] as ServiceType[]).some((t) => Object.values(settings.hours[t]).some((rs) => rs.some(([a, b]) => !a || !b || b <= a)));
    if (settings.slots_enabled && badRange) { toast.error('Controleer je uren: het einde moet na het begin liggen'); return; }
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
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('Afhalen en leveren opgeslagen');
      await qc.invalidateQueries({ queryKey: ['fulfillment', tenantId] });
      await qc.invalidateQueries({ queryKey: ['shipping-methods'] });
    } catch (e) {
      toast.error(`Opslaan lukte niet: ${e instanceof Error ? e.message : 'onbekende fout'}`);
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
            <CardTitle>Afhalen en leveren</CardTitle>
            <Button asChild variant="outline" size="sm"><Link to="/admin/keuken"><ChefHat className="mr-1.5 h-4 w-4" />Keukenscherm</Link></Button>
          </div>
          <CardDescription>Voor restaurants, frituren, bakkers en traiteurs. Je klanten kiezen bij het afrekenen of ze afhalen of laten leveren. Verzenden met de post stel je in bij Instellingen › Verzending.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methods.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen afhaal- of levermethode. Voeg er een toe.</p> : null}
          {methods.map((m, i) => (
            <MethodRow key={m.id || `new-${i}`} m={m}
              onChange={(next) => setMethods((ms) => ms.map((x, j) => (j === i ? next : x)))}
              onRemove={() => { if (m.id) setRemoved((r) => [...r, m.id!]); setMethods((ms) => ms.filter((_, j) => j !== i)); }} />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addMethod('pickup')}><Store className="mr-1.5 h-4 w-4" />Afhalen toevoegen</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addMethod('local_delivery')}><Bike className="mr-1.5 h-4 w-4" />Levering toevoegen</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" />Betalen bij afhalen of levering</CardTitle>
              <CardDescription>Je klant betaalt contant of met de bankkaart aan de toog of aan de deur. De bestelling komt meteen binnen, gemarkeerd als "nog te betalen".</CardDescription>
            </div>
            <Switch checked={settings.pay_on_pickup} onCheckedChange={(v) => setSettings((s) => ({ ...s, pay_on_pickup: v }))} aria-label="Betalen bij afhalen aan" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Klant verwittigen</CardTitle>
              <CardDescription>Je klant krijgt een mail zodra de keuken een afhaalbestelling op "Klaar" zet of een levering op "Meegegeven".</CardDescription>
            </div>
            <Switch checked={settings.notify_ready} onCheckedChange={(v) => setSettings((s) => ({ ...s, notify_ready: v }))} aria-label="Klant verwittigen aan" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Tijdsloten</CardTitle>
              <CardDescription>Laat klanten een afhaal- of levertijd kiezen. Zonder tijdsloten bestellen ze "zo snel mogelijk".</CardDescription>
            </div>
            <Switch checked={settings.slots_enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, slots_enabled: v }))} aria-label="Tijdsloten aan" />
          </div>
        </CardHeader>
        {settings.slots_enabled ? (
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Slot van</Label>
                <Select value={String(settings.slot_minutes)} onValueChange={(v) => setSettings((s) => ({ ...s, slot_minutes: Number(v) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 15, 20, 30, 60].map((n) => <SelectItem key={n} value={String(n)}>{n} minuten</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bereidingstijd</Label>
                <Select value={String(settings.prep_minutes)} onValueChange={(v) => setSettings((s) => ({ ...s, prep_minutes: Number(v) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 10, 15, 20, 30, 45, 60, 90, 120].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? 'Geen' : `${n} minuten`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vooruit bestellen</Label>
                <Select value={String(settings.days_ahead)} onValueChange={(v) => setSettings((s) => ({ ...s, days_ahead: Number(v) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3, 7, 14].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? 'Alleen vandaag' : n === 1 ? 'Tot morgen' : `${n} dagen vooruit`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max. bestellingen per slot</Label>
                <Input inputMode="numeric" placeholder="onbeperkt" value={settings.max_orders_per_slot == null ? '' : String(settings.max_orders_per_slot)}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); setSettings((s) => ({ ...s, max_orders_per_slot: Number.isFinite(n) && n > 0 ? n : null })); }} className="h-9" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="inline-flex rounded-md border p-0.5">
                {(['pickup', 'local_delivery'] as ServiceType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setHoursTab(t)}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${hoursTab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    Uren {TYPE_LABEL[t].toLowerCase()}
                  </button>
                ))}
              </div>
              <HoursEditor hours={settings.hours} type={hoursTab} onChange={(h) => setSettings((s) => ({ ...s, hours: h }))} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Opslaan</Button>
      </div>
    </div>
  );
}
