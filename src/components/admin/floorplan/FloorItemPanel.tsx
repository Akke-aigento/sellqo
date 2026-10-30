// ZAAL-H1 — eigenschappen van de gekozen tafel of het gekozen decorstuk: label, soort,
// vorm, stoelen, maat, draaien, ruimte, dupliceren, verwijderen en (tafels) de QR-code.
// Gebruikt naast het canvas (desktop) en in een venster (gsm). Elke wijziging wordt
// meteen bewaard; tekst- en getalvelden bij het verlaten van het veld of Enter.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Download, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GRID_LIMITS, isValidLabel, MARKER_KINDS, normRotation, TABLE_KINDS, TABLE_SHAPES } from '@/lib/floorplan';
import type { FloorArea, FloorMarker, FloorTableRow, MarkerKind, TableKind, TableShape } from '@/lib/floorplan';

function NumberField({ id, label, value, min, max, onCommit }: { id: string; label: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.max(min, Math.min(max, Math.round(Number(v))));
    if (!Number.isFinite(n)) { setV(String(value)); return; }
    setV(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
    </div>
  );
}

interface Common {
  areas: FloorArea[];
  onRotate: (deg: number) => void;
  onDelete: () => void;
}

export interface TablePanelProps extends Common {
  table: FloorTableRow;
  /** Labels van andere actieve tafels in dezelfde ruimte (dubbel = fout van de databank). */
  onPatch: (patch: Partial<FloorTableRow>) => void;
  onDuplicate: () => void;
  onRenewToken: () => void;
  onDownloadQr: () => void;
}

export function TablePanel({ table, areas, onPatch, onRotate, onDelete, onDuplicate, onRenewToken, onDownloadQr }: TablePanelProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(table.label);
  const [confirm, setConfirm] = useState<'delete' | 'renew' | null>(null);
  useEffect(() => setLabel(table.label), [table.label, table.id]);
  const labelOk = isValidLabel(label);
  const commitLabel = () => {
    const v = label.trim();
    if (!isValidLabel(v)) { setLabel(table.label); return; }
    if (v !== table.label) onPatch({ label: v });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor={`fl-label-${table.id}`} className="text-xs">{t('admin.floorPlan.field_label')}</Label>
        <Input id={`fl-label-${table.id}`} value={label} maxLength={GRID_LIMITS.labelMax} aria-invalid={!labelOk}
          onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }} />
        {!labelOk ? <p className="text-xs text-destructive">{t('admin.floorPlan.label_invalid')}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('admin.floorPlan.field_kind')}</Label>
          <Select value={table.kind} onValueChange={(v) => onPatch({ kind: v as TableKind })}>
            <SelectTrigger aria-label={t('admin.floorPlan.field_kind')}><SelectValue /></SelectTrigger>
            <SelectContent>{TABLE_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`admin.floorPlan.kind_${k}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('admin.floorPlan.field_shape')}</Label>
          <Select value={table.shape} onValueChange={(v) => onPatch({ shape: v as TableShape })}>
            <SelectTrigger aria-label={t('admin.floorPlan.field_shape')}><SelectValue /></SelectTrigger>
            <SelectContent>{TABLE_SHAPES.map((s) => <SelectItem key={s} value={s}>{t(`admin.floorPlan.shape_${s}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <NumberField id={`fl-seats-${table.id}`} label={t('admin.floorPlan.field_seats')} value={table.seats} min={0} max={GRID_LIMITS.seatsMax} onCommit={(n) => onPatch({ seats: n })} />
        <div className="space-y-1">
          <Label className="text-xs">{t('admin.floorPlan.field_area')}</Label>
          <Select value={table.area_id} onValueChange={(v) => onPatch({ area_id: v })}>
            <SelectTrigger aria-label={t('admin.floorPlan.field_area')}><SelectValue /></SelectTrigger>
            <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <NumberField id={`fl-w-${table.id}`} label={t('admin.floorPlan.field_width')} value={table.w} min={1} max={GRID_LIMITS.tableMaxSize} onCommit={(n) => onPatch({ w: n })} />
        <NumberField id={`fl-h-${table.id}`} label={t('admin.floorPlan.field_height')} value={table.h} min={1} max={GRID_LIMITS.tableMaxSize} onCommit={(n) => onPatch({ h: n })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onRotate(45)}><RotateCw className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.rotate', { deg: normRotation(table.rotation + 45) })}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDuplicate}><Copy className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.duplicate')}</Button>
        <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setConfirm('delete')}><Trash2 className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.delete')}</Button>
      </div>
      {/* VASTE-KLANT-1: een vaste klant heeft geen tafel met een sticker. */}
      {table.kind === 'regular' ? <p className="rounded-md border p-3 text-xs text-muted-foreground">{t('admin.floorPlan.regular_help')}</p> : (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">{t('admin.floorPlan.qr_title')}</p>
        <p className="text-xs text-muted-foreground">{t('admin.floorPlan.qr_help')}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onDownloadQr}><Download className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.qr_download_one')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirm('renew')}><RefreshCw className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.qr_renew')}</Button>
        </div>
      </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'renew' ? t('admin.floorPlan.qr_renew_title', { label: table.label }) : t('admin.floorPlan.delete_table_title', { label: table.label })}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === 'renew' ? t('admin.floorPlan.qr_renew_text') : t('admin.floorPlan.delete_table_text')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm === 'renew') onRenewToken(); else onDelete(); setConfirm(null); }}>
              {confirm === 'renew' ? t('admin.floorPlan.qr_renew_confirm') : t('admin.floorPlan.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export interface MarkerPanelProps extends Common {
  marker: FloorMarker;
  onPatch: (patch: Partial<FloorMarker>) => void;
}

export function MarkerPanel({ marker, areas, onPatch, onRotate, onDelete }: MarkerPanelProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(marker.label ?? '');
  useEffect(() => setLabel(marker.label ?? ''), [marker.label, marker.id]);
  const commitLabel = () => { const v = label.trim().slice(0, 40); if (v !== (marker.label ?? '')) onPatch({ label: v || null }); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('admin.floorPlan.field_kind')}</Label>
          <Select value={marker.kind} onValueChange={(v) => onPatch({ kind: v as MarkerKind })}>
            <SelectTrigger aria-label={t('admin.floorPlan.field_kind')}><SelectValue /></SelectTrigger>
            <SelectContent>{MARKER_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`admin.floorPlan.marker_${k}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('admin.floorPlan.field_area')}</Label>
          <Select value={marker.area_id} onValueChange={(v) => onPatch({ area_id: v })}>
            <SelectTrigger aria-label={t('admin.floorPlan.field_area')}><SelectValue /></SelectTrigger>
            <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={`fm-label-${marker.id}`} className="text-xs">{t('admin.floorPlan.field_text')}</Label>
          <Input id={`fm-label-${marker.id}`} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); }} />
        </div>
        <NumberField id={`fm-w-${marker.id}`} label={t('admin.floorPlan.field_width')} value={marker.w} min={1} max={GRID_LIMITS.maxW} onCommit={(n) => onPatch({ w: n })} />
        <NumberField id={`fm-h-${marker.id}`} label={t('admin.floorPlan.field_height')} value={marker.h} min={1} max={GRID_LIMITS.maxH} onCommit={(n) => onPatch({ h: n })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onRotate(90)}><RotateCw className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.rotate', { deg: normRotation(marker.rotation + 90) })}</Button>
        <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={onDelete}><Trash2 className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.delete')}</Button>
      </div>
    </div>
  );
}
