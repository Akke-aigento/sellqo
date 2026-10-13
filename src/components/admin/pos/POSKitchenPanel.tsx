// FOOD-2 — keukenbon in de kassa: soort, tijdstip, naam en telefoon. Compact, want het
// staat onder het winkelmandje.
import { useState } from 'react';
import { ChefHat, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { KitchenOrderInput, KitchenService } from '@/components/admin/kitchen/kitchenOrder';
import { useTranslation } from 'react-i18next';

const SERVICES: { value: KitchenService; labelKey: string }[] = [
  { value: 'eat_in', labelKey: 'admin.kitchen.svc_eat_in' }, { value: 'pickup', labelKey: 'admin.pos.pOSKitchenPanel.takeaway' }, { value: 'local_delivery', labelKey: 'admin.kitchen.svc_delivery' },
];
const OFFSETS = [0, 15, 30, 45, 60];

// Waarde voor <input type="time">: altijd HH:MM (24 u), los van de UI-taal.
const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
function atToday(hhmm: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date(); d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() < Date.now() - 3600_000) d.setDate(d.getDate() + 1); // na middernacht bedoeld
  return d.toISOString();
}

export function POSKitchenPanel({ value, onChange }: { value: KitchenOrderInput; onChange: (v: KitchenOrderInput) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<KitchenOrderInput>) => onChange({ ...value, ...patch });
  const offsetActive = (m: number) => (m === 0 ? value.requested_time === null : false);
  return (
    <div className="space-y-2 rounded-lg border p-2.5">
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{t('admin.pos.pOSKitchenPanel.naar_de_keuken')}</span>
        {value.ticket_id ? <span className="rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">{t('admin.pos.pOSKitchenPanel.telefonische_bestelling')}</span> : null}
        <Switch className="ml-auto" checked={value.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label={t('admin.pos.pOSKitchenPanel.naar_de_keuken_2')} />
      </div>
      {value.enabled ? (
        <>
          <div className="grid grid-cols-3 gap-1">
            {SERVICES.map((s) => (
              <button key={s.value} type="button" onClick={() => set({ service_type: s.value })}
                className={cn('rounded-md border px-2 py-1.5 text-xs font-semibold', value.service_type === s.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {t(s.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {OFFSETS.map((m) => (
              <button key={m} type="button"
                onClick={() => set({ requested_time: m === 0 ? null : new Date(Date.now() + m * 60_000).toISOString() })}
                className={cn('rounded-md border px-2 py-1 text-xs font-semibold', offsetActive(m) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {m === 0 ? 'Nu' : `+${m}`}
              </button>
            ))}
            <Input type="time" aria-label={t('admin.pos.pOSKitchenPanel.tijdstip')} value={timeOf(value.requested_time)} onChange={(e) => set({ requested_time: e.target.value ? atToday(e.target.value) : null })}
              className={cn('h-7 w-[6.5rem] text-xs', value.requested_time && 'border-primary')} />
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
            {value.customer_label || value.customer_phone ? `${value.customer_label} ${value.customer_phone}`.trim() : t('admin.pos.pOSKitchenPanel.name_phone_note')}
          </button>
          {open ? (
            <div className="grid gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Input placeholder={value.service_type === 'eat_in' ? t('admin.pos.pOSKitchenPanel.tafel_of_naam') : t('common.name')} value={value.customer_label} onChange={(e) => set({ customer_label: e.target.value })} className="h-8 text-sm" />
                <Input placeholder={t('common.phone')} inputMode="tel" value={value.customer_phone} onChange={(e) => set({ customer_phone: e.target.value })} className="h-8 text-sm" />
              </div>
              <Input placeholder={value.service_type === 'local_delivery' ? t('admin.pos.pOSKitchenPanel.adres_en_opmerking') : t('admin.pos.pOSKitchenPanel.opmerking_bv_zonder_ui')} value={value.note} onChange={(e) => set({ note: e.target.value })} className="h-8 text-sm" />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
