// ZAAL-H1 — vensters van de zaalplan-editor: ruimte toevoegen/aanpassen en een sjabloon
// plaatsen (rij barkrukken, terras, rij tafels).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import { DEFAULT_GRID, GRID_LIMITS, TEMPLATE_DEFAULTS, TEMPLATE_IDS } from '@/lib/floorplan';
import type { TemplateId, TemplateInput } from '@/lib/floorplan';

export interface AreaDraft { name: string; grid_w: number; grid_h: number }

export function AreaDialog({ open, onOpenChange, initial, onSave, busy }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = nieuwe ruimte. */
  initial: AreaDraft | null;
  onSave: (d: AreaDraft) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [w, setW] = useState(String(DEFAULT_GRID.w));
  const [h, setH] = useState(String(DEFAULT_GRID.h));
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setW(String(initial?.grid_w ?? DEFAULT_GRID.w));
    setH(String(initial?.grid_h ?? DEFAULT_GRID.h));
  }, [open, initial]);
  const gw = Math.round(Number(w));
  const gh = Math.round(Number(h));
  const valid = name.trim().length > 0 && name.trim().length <= 40
    && gw >= GRID_LIMITS.minW && gw <= GRID_LIMITS.maxW && gh >= GRID_LIMITS.minH && gh <= GRID_LIMITS.maxH;
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      maxWidth="md"
      title={initial ? t('admin.floorPlan.area_edit_title') : t('admin.floorPlan.area_new_title')}
      description={t('admin.floorPlan.area_dialog_desc')}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="button" disabled={!valid || busy} onClick={() => onSave({ name: name.trim(), grid_w: gw, grid_h: gh })}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fa-name">{t('admin.floorPlan.area_name')}</Label>
          <Input id="fa-name" value={name} maxLength={40} placeholder={t('admin.floorPlan.area_name_placeholder')} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fa-w">{t('admin.floorPlan.area_grid_w')}</Label>
            <Input id="fa-w" inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fa-h">{t('admin.floorPlan.area_grid_h')}</Label>
            <Input id="fa-h" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('admin.floorPlan.area_grid_help', { minW: GRID_LIMITS.minW, maxW: GRID_LIMITS.maxW, minH: GRID_LIMITS.minH, maxH: GRID_LIMITS.maxH })}</p>
      </div>
    </ResponsiveDialog>
  );
}

export function TemplateDialog({ open, onOpenChange, onPlace, busy }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPlace: (input: TemplateInput) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [id, setId] = useState<TemplateId>('bar_row');
  const [count, setCount] = useState(String(TEMPLATE_DEFAULTS.bar_row.count));
  const [prefix, setPrefix] = useState(TEMPLATE_DEFAULTS.bar_row.prefix);
  const [columns, setColumns] = useState('4');
  const pick = (next: TemplateId) => {
    setId(next);
    setCount(String(TEMPLATE_DEFAULTS[next].count));
    setPrefix(TEMPLATE_DEFAULTS[next].prefix);
    setColumns(String(TEMPLATE_DEFAULTS[next].columns ?? 4));
  };
  const n = Math.round(Number(count));
  const valid = n >= 1 && n <= 40 && /^[A-Za-z0-9 _./-]{0,10}$/.test(prefix) && (prefix === '' || /^[A-Za-z0-9]/.test(prefix));
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      maxWidth="lg"
      title={t('admin.floorPlan.template_title')}
      description={t('admin.floorPlan.template_desc')}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="button" disabled={!valid || busy} onClick={() => onPlace({ id, count: n, prefix, columns: Math.max(1, Math.round(Number(columns)) || 4) })}>{t('admin.floorPlan.template_place')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {TEMPLATE_IDS.map((tid) => (
            <button key={tid} type="button" onClick={() => pick(tid)} aria-pressed={id === tid}
              className={cn('rounded-lg border-2 p-3 text-left', id === tid ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
              <span className="block font-medium">{t(`admin.floorPlan.template_${tid}`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`admin.floorPlan.template_${tid}_text`)}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ft-count">{t('admin.floorPlan.template_count')}</Label>
            <Input id="ft-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ft-prefix">{t('admin.floorPlan.template_prefix')}</Label>
            <Input id="ft-prefix" value={prefix} maxLength={10} onChange={(e) => setPrefix(e.target.value)} />
          </div>
          {id === 'terrace' ? (
            <div className="space-y-1.5">
              <Label htmlFor="ft-cols">{t('admin.floorPlan.template_columns')}</Label>
              <Input id="ft-cols" inputMode="numeric" value={columns} onChange={(e) => setColumns(e.target.value)} />
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t('admin.floorPlan.template_example', { first: `${prefix}1`, last: `${prefix}${n > 0 ? n : 1}` })}</p>
      </div>
    </ResponsiveDialog>
  );
}
