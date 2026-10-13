// FOOD-2 — keukenbon in de kassa: soort, tijdstip, naam en telefoon. Compact, want het
// staat onder het winkelmandje.
import { useState } from 'react';
import { ChefHat, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { KitchenOrderInput, KitchenService } from '@/components/admin/kitchen/kitchenOrder';

const SERVICES: { value: KitchenService; label: string }[] = [
  { value: 'eat_in', label: 'Ter plaatse' }, { value: 'pickup', label: 'Meenemen' }, { value: 'local_delivery', label: 'Levering' },
];
const OFFSETS = [0, 15, 30, 45, 60];

const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }) : '');
function atToday(hhmm: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date(); d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() < Date.now() - 3600_000) d.setDate(d.getDate() + 1); // na middernacht bedoeld
  return d.toISOString();
}

export function POSKitchenPanel({ value, onChange }: { value: KitchenOrderInput; onChange: (v: KitchenOrderInput) => void }) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<KitchenOrderInput>) => onChange({ ...value, ...patch });
  const offsetActive = (m: number) => (m === 0 ? value.requested_time === null : false);
  return (
    <div className="space-y-2 rounded-lg border p-2.5">
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Naar de keuken</span>
        {value.ticket_id ? <span className="rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">telefonische bestelling</span> : null}
        <Switch className="ml-auto" checked={value.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Naar de keuken" />
      </div>
      {value.enabled ? (
        <>
          <div className="grid grid-cols-3 gap-1">
            {SERVICES.map((s) => (
              <button key={s.value} type="button" onClick={() => set({ service_type: s.value })}
                className={cn('rounded-md border px-2 py-1.5 text-xs font-semibold', value.service_type === s.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {s.label}
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
            <Input type="time" aria-label="Tijdstip" value={timeOf(value.requested_time)} onChange={(e) => set({ requested_time: e.target.value ? atToday(e.target.value) : null })}
              className={cn('h-7 w-[6.5rem] text-xs', value.requested_time && 'border-primary')} />
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
            {value.customer_label || value.customer_phone ? `${value.customer_label} ${value.customer_phone}`.trim() : 'Naam, telefoon, opmerking'}
          </button>
          {open ? (
            <div className="grid gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Input placeholder={value.service_type === 'eat_in' ? 'Tafel of naam' : 'Naam'} value={value.customer_label} onChange={(e) => set({ customer_label: e.target.value })} className="h-8 text-sm" />
                <Input placeholder="Telefoon" inputMode="tel" value={value.customer_phone} onChange={(e) => set({ customer_phone: e.target.value })} className="h-8 text-sm" />
              </div>
              <Input placeholder={value.service_type === 'local_delivery' ? 'Adres en opmerking' : 'Opmerking (bv. zonder ui)'} value={value.note} onChange={(e) => set({ note: e.target.value })} className="h-8 text-sm" />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
