// THEME-SCHEMA-1 — formulieren uit het themaschema van de standaardshop
// (https://<slug>.sellqo.shop/theme/schema.json). Een nieuwe instelling of sectie
// in het schema verschijnt hier vanzelf; er hoeft niets in de admin bij.
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { schemaDefaults, type SchemaBlocks, type SchemaField } from './schemaTypes';
import { useTranslation } from 'react-i18next';

type Values = Record<string, unknown>;

// Pictogramnamen als i18n-key (admin.storefront.schema.icon.<naam>).
const ICONS_WITH_LABEL = ['truck', 'return', 'shield', 'star', 'heart', 'leaf', 'clock', 'gift', 'chat', 'euro', 'check', 'map'];

function Field({ f, value, onChange, idPrefix, icons }: {
  f: SchemaField; value: unknown; onChange: (v: unknown) => void; idPrefix: string; icons?: string[];
}) {
  const { t } = useTranslation();
  const id = `${idPrefix}-${f.key}`;
  const v = value === undefined || value === null ? f.default : value;
  switch (f.type) {
    case 'info':
      return (
        <p className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f.label}
        </p>
      );
    case 'toggle':
      return (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id} className="font-normal">{f.label}</Label>
          <Switch id={id} checked={v === true} onCheckedChange={onChange} />
        </div>
      );
    case 'select':
    case 'icon': {
      const opts = f.type === 'icon'
        ? (icons || []).map((i) => ({ value: i, label: ICONS_WITH_LABEL.includes(i) ? t(`admin.storefront.schema.icon.${i}`) : i }))
        : f.options || [];
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Select value={String(v ?? '')} onValueChange={onChange}>
            <SelectTrigger id={id} className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    }
    case 'range': {
      const n = Number(v ?? f.min ?? 0);
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label htmlFor={id}>{f.label}</Label><span className="text-xs text-muted-foreground">{n}{f.unit || ''}</span></div>
          <Slider id={id} min={f.min ?? 0} max={f.max ?? 100} step={f.step ?? 1} value={[n]} onValueChange={([x]) => onChange(x)} />
        </div>
      );
    }
    case 'color':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <div className="flex items-center gap-2">
            <input type="color" aria-label={f.label} value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : '#000000'}
              onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded border bg-transparent p-0" />
            <Input id={id} value={String(v ?? '')} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)} className="h-9 font-mono text-sm" />
          </div>
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Textarea id={id} rows={3} value={String(v ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
          {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
        </div>
      );
    default: {
      const s = String(v ?? '');
      const bad = !!f.pattern && s !== '' && !new RegExp(f.pattern).test(s);
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{f.label}</Label>
          <Input id={id} value={s} placeholder={f.placeholder} aria-invalid={bad} onChange={(e) => onChange(e.target.value)}
            className={bad ? 'border-destructive' : undefined} />
          {bad ? <p className="text-xs text-destructive">{t('admin.storefront.schema.schemaForm.dit_ziet_er_niet_uit_als')}</p>
            : f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
        </div>
      );
    }
  }
}

export function SchemaForm({ fields, values, onChange, idPrefix = 'sf', icons }: {
  fields: SchemaField[]; values: Values; onChange: (next: Values) => void; idPrefix?: string; icons?: string[];
}) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        if (f.showIf) {
          const cur = values[f.showIf.key] ?? fields.find((x) => x.key === f.showIf!.key)?.default;
          if (cur !== f.showIf.equals) return null;
        }
        return <Field key={f.key} f={f} value={values[f.key]} idPrefix={idPrefix} icons={icons} onChange={(v) => onChange({ ...values, [f.key]: v })} />;
      })}
    </div>
  );
}

export function BlocksEditor({ blocks, items, onChange, icons }: {
  blocks: SchemaBlocks; items: Record<string, unknown>[]; onChange: (next: Record<string, unknown>[]) => void; icons?: string[];
}) {
  const { t } = useTranslation();
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{blocks.label} {i + 1}</span>
            <div className="flex gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('admin.storefront.food.addonGroupsManager.omhoog')}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={t('admin.storefront.food.addonGroupsManager.omlaag')}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('common.delete')}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <SchemaForm fields={blocks.fields} values={it} icons={icons} idPrefix={`${blocks.key}-${i}`}
            onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
        </div>
      ))}
      {!blocks.max || items.length < blocks.max ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange([...items, schemaDefaults(blocks.fields)])}>
          <Plus className="mr-1.5 h-4 w-4" />{blocks.label} toevoegen
        </Button>
      ) : null}
    </div>
  );
}
