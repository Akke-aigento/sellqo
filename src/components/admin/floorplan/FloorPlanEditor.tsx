// ZAAL-H1 — zaalplan beheren (tab "Zaalplan" onder Bestellen): ruimtes, tafels met naam,
// vorm en stoelen, decor, sjablonen en QR-stickers per tafel.
// Desktop: canvas met slepen (raster-snap), pijltjestoetsen en een eigenschappenpaneel.
// Gsm: lijst per ruimte; bewerken in een venster (slepen op een klein scherm is gepruts).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowRight, LayoutTemplate, Loader2, Pencil, Plus, Printer, Shapes, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/hooks/useTenant';
import { useFloorPlan, useFloorPlanMutations } from '@/hooks/useFloorPlan';
import {
  clampToArea, compareLabels, defaultMarker, defaultTable, duplicateLabel, duplicateLabels, findFreeSpot,
  floorErrorKey, MARKER_KINDS, nextLabel, normRotation, overlappingIds, placeTemplate, TABLE_KINDS, tableQrUrl,
} from '@/lib/floorplan';
import type { FloorMarker, FloorTableRow, MarkerKind, TableKind, TemplateInput } from '@/lib/floorplan';
import { downloadPdf, generateFloorQrPdf } from '@/utils/floorQrPdf';
import { FloorCanvas } from './FloorCanvas';
import { MarkerPanel, TablePanel } from './FloorItemPanel';
import { AreaDialog, TemplateDialog, type AreaDraft } from './FloorDialogs';

type Selection = { kind: 'table' | 'marker'; id: string } | null;

export function FloorPlanEditor() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { currentTenant } = useTenant();
  const slug = currentTenant?.slug || '';
  const { data, isLoading } = useFloorPlan();
  const m = useFloorPlanMutations();

  const [areaId, setAreaId] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [areaDialog, setAreaDialog] = useState<'new' | 'edit' | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteArea, setDeleteArea] = useState(false);
  const [printing, setPrinting] = useState(false);

  const areas = useMemo(() => data?.areas ?? [], [data]);
  const area = areas.find((a) => a.id === areaId) ?? areas[0] ?? null;
  const tables = useMemo(() => (data?.tables ?? []).filter((x) => x.area_id === area?.id), [data, area]);
  const markers = useMemo(() => (data?.markers ?? []).filter((x) => x.area_id === area?.id), [data, area]);
  const allTables = useMemo(() => data?.tables ?? [], [data]);
  const overlap = useMemo(() => overlappingIds([...tables, ...markers.filter((x) => x.kind !== 'text')]), [tables, markers]);
  const dupLabels = useMemo(() => duplicateLabels(allTables.map((x) => x.label)), [allTables]);
  const warnIds = useMemo(() => new Set([...overlap, ...tables.filter((x) => dupLabels.has(x.label.toLowerCase())).map((x) => x.id)]), [overlap, tables, dupLabels]);

  const selTable = sel?.kind === 'table' ? allTables.find((x) => x.id === sel.id) ?? null : null;
  const selMarker = sel?.kind === 'marker' ? (data?.markers ?? []).find((x) => x.id === sel.id) ?? null : null;

  const fail = (e: unknown) => { const k = floorErrorKey(e); toast.error(t(k.key, { reason: k.reason })); };
  const run = <A,>(mut: { mutateAsync: (a: A) => Promise<unknown> }, arg: A, ok?: string) =>
    mut.mutateAsync(arg).then(() => { if (ok) toast.success(ok); }).catch(fail);

  // ── Ruimtes ──
  const saveArea = async (d: AreaDraft) => {
    try {
      if (areaDialog === 'edit' && area) {
        await m.updateArea.mutateAsync({ id: area.id, patch: d });
      } else {
        const id = await m.createArea.mutateAsync({ ...d, sort: areas.length ? Math.max(...areas.map((a) => a.sort)) + 1 : 0 });
        setAreaId(id);
      }
      setAreaDialog(null);
    } catch (e) { fail(e); }
  };
  const moveArea = async (dir: -1 | 1) => {
    if (!area) return;
    const i = areas.findIndex((a) => a.id === area.id);
    const other = areas[i + dir];
    if (!other) return;
    // Volgorde opnieuw 0..n, met de twee omgewisseld.
    const order = [...areas];
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    try {
      for (const [idx, a] of order.entries()) if (a.sort !== idx) await m.updateArea.mutateAsync({ id: a.id, patch: { sort: idx } });
    } catch (e) { fail(e); }
  };

  // ── Toevoegen ──
  const occupied = [...tables, ...markers];
  const addTable = (kind: TableKind) => {
    if (!area) return;
    const base = defaultTable(kind);
    const spot = findFreeSpot(area, occupied, base.w, base.h);
    if (!spot) { toast.error(t('admin.floorPlan.no_space')); return; }
    const prefix = kind === 'bar_seat' ? 'B' : kind === 'standing' ? 'S' : kind === 'regular' ? t('admin.floorPlan.regular_prefix') : '';
    const label = nextLabel(allTables.filter((x) => x.area_id === area.id).map((x) => x.label), prefix);
    m.insertItems.mutateAsync({ areaId: area.id, tables: [{ ...base, label, x: spot.x, y: spot.y, rotation: 0 }] })
      .then((ids) => { if (ids[0]) setSel({ kind: 'table', id: ids[0] }); })
      .catch(fail);
  };
  const addMarker = (kind: MarkerKind) => {
    if (!area) return;
    const base = defaultMarker(kind);
    const spot = findFreeSpot(area, occupied, Math.min(base.w, area.grid_w), base.h) ?? { x: 0, y: 0 };
    run(m.insertItems, { areaId: area.id, markers: [{ ...base, w: Math.min(base.w, area.grid_w), label: kind === 'text' ? t('admin.floorPlan.marker_text') : null, x: spot.x, y: spot.y, rotation: 0 }] });
  };
  const placeTpl = (input: TemplateInput) => {
    if (!area) return;
    const placed = placeTemplate(input, area, allTables.filter((x) => x.area_id === area.id), occupied);
    if (!placed) { toast.error(t('admin.floorPlan.no_space')); return; }
    m.insertItems.mutateAsync({ areaId: area.id, tables: placed.tables, markers: placed.markers })
      .then(() => { setTemplateOpen(false); toast.success(t('admin.floorPlan.template_placed', { count: placed.tables.length })); })
      .catch(fail);
  };

  // ── Bewerken ──
  const patchTable = (tb: FloorTableRow, patch: Partial<FloorTableRow>) => {
    const target = patch.area_id ? areas.find((a) => a.id === patch.area_id) ?? area : area;
    let next: Partial<FloorTableRow> = patch;
    if (target && (patch.w !== undefined || patch.h !== undefined || patch.rotation !== undefined || patch.area_id)) {
      const c = clampToArea({ ...tb, ...patch }, target);
      next = { ...patch, x: c.x, y: c.y, w: c.w, h: c.h };
    }
    if (patch.area_id && patch.area_id !== tb.area_id) {
      // Andere ruimte: het label moet daar vrij zijn, en de tafel mee naar die ruimte.
      const taken = allTables.filter((x) => x.area_id === patch.area_id).map((x) => x.label.toLowerCase());
      if (taken.includes((patch.label ?? tb.label).toLowerCase())) { toast.error(t('admin.floorPlan.error_label_taken')); return; }
      setAreaId(patch.area_id);
    }
    run(m.updateTable, { id: tb.id, patch: next });
  };
  const patchMarker = (mk: FloorMarker, patch: Partial<FloorMarker>) => {
    const target = patch.area_id ? areas.find((a) => a.id === patch.area_id) ?? area : area;
    let next: Partial<FloorMarker> = patch;
    if (target && (patch.w !== undefined || patch.h !== undefined || patch.rotation !== undefined || patch.area_id)) {
      const c = clampToArea({ ...mk, ...patch }, target);
      next = { ...patch, x: c.x, y: c.y, w: c.w, h: c.h };
    }
    if (patch.area_id) setAreaId(patch.area_id);
    run(m.updateMarker, { id: mk.id, patch: next });
  };
  const duplicate = (tb: FloorTableRow) => {
    if (!area) return;
    const spot = findFreeSpot(area, occupied, tb.w, tb.h, { x: tb.x, y: tb.y });
    if (!spot) { toast.error(t('admin.floorPlan.no_space')); return; }
    const label = duplicateLabel(allTables.filter((x) => x.area_id === tb.area_id).map((x) => x.label), tb.label);
    m.insertItems.mutateAsync({ areaId: tb.area_id, tables: [{ label, kind: tb.kind, shape: tb.shape, seats: tb.seats, w: tb.w, h: tb.h, rotation: tb.rotation, x: spot.x, y: spot.y }] })
      .then((ids) => { if (ids[0]) setSel({ kind: 'table', id: ids[0] }); })
      .catch(fail);
  };
  const removeTable = (tb: FloorTableRow) => { setSel(null); run(m.deactivateTable, tb.id, t('admin.floorPlan.table_deleted', { label: tb.label })); };
  const removeMarker = (mk: FloorMarker) => { setSel(null); run(m.deleteMarker, mk.id); };
  const onMove = (kind: 'table' | 'marker', id: string, pos: { x: number; y: number }) => {
    if (kind === 'table') run(m.updateTable, { id, patch: pos });
    else run(m.updateMarker, { id, patch: pos });
  };
  // Pijltjestoetsen verschuiven de selectie één cel (ook handig zonder muis).
  const onKey = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !area || (!selTable && !selMarker)) return;
    if ((e.target as HTMLElement).closest('input, textarea, [role="combobox"]')) return;
    e.preventDefault();
    const item = (selTable ?? selMarker)!;
    const c = clampToArea({ ...item, x: item.x + d[0], y: item.y + d[1] }, area);
    if (c.x !== item.x || c.y !== item.y) onMove(selTable ? 'table' : 'marker', item.id, { x: c.x, y: c.y });
  };

  // ── QR ──
  const printQr = async (list: FloorTableRow[]) => {
    if (!slug || list.length === 0) return;
    setPrinting(true);
    try {
      const areaName = new Map(areas.map((a) => [a.id, a.name]));
      const sorted = [...list].sort((a, b) => (areas.findIndex((x) => x.id === a.area_id) - areas.findIndex((x) => x.id === b.area_id)) || compareLabels(a.label, b.label));
      const bytes = await generateFloorQrPdf(
        sorted.map((x) => ({ label: x.label, area: areaName.get(x.area_id) ?? '', url: tableQrUrl(slug, x.qr_token) })),
        { storeName: currentTenant?.name || slug, callToAction: t('admin.floorPlan.qr_sticker_cta') },
      );
      downloadPdf(bytes, list.length === 1 ? `qr-${list[0].label.replace(/[^\w-]+/g, '_')}.pdf` : `qr-${slug}.pdf`);
    } catch (e) {
      toast.error(t('admin.floorPlan.qr_pdf_failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      setPrinting(false);
    }
  };
  const renew = (tb: FloorTableRow) => run(m.renewToken, tb.id, t('admin.floorPlan.qr_renewed', { label: tb.label }));

  if (isLoading) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;

  const panel = selTable ? (
    <TablePanel key={selTable.id} table={selTable} areas={areas}
      onPatch={(p) => patchTable(selTable, p)}
      onRotate={(deg) => patchTable(selTable, { rotation: normRotation(selTable.rotation + deg) })}
      onDelete={() => removeTable(selTable)}
      onDuplicate={() => duplicate(selTable)}
      onRenewToken={() => renew(selTable)}
      onDownloadQr={() => void printQr([selTable])} />
  ) : selMarker ? (
    <MarkerPanel key={selMarker.id} marker={selMarker} areas={areas}
      onPatch={(p) => patchMarker(selMarker, p)}
      onRotate={(deg) => patchMarker(selMarker, { rotation: normRotation(selMarker.rotation + deg) })}
      onDelete={() => removeMarker(selMarker)} />
  ) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.floorPlan.title')}</CardTitle>
          <CardDescription>{t('admin.floorPlan.description')}</CardDescription>
        </CardHeader>
        {areas.length === 0 ? (
          <CardContent>
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">{t('admin.floorPlan.empty')}</p>
              <Button type="button" onClick={() => setAreaDialog('new')}><Plus className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.first_area')}</Button>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            {/* Ruimtes: tabs bovenaan, met beheer ernaast. */}
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label={t('admin.floorPlan.areas')} className="flex max-w-full gap-1 overflow-x-auto">
                {areas.map((a) => (
                  <button key={a.id} type="button" role="tab" aria-selected={a.id === area?.id} onClick={() => { setAreaId(a.id); setSel(null); }}
                    className={cn('whitespace-nowrap rounded-full border px-3 py-1 text-sm', a.id === area?.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                    {a.name}<span className="ml-1.5 text-xs opacity-70">{(data?.tables ?? []).filter((x) => x.area_id === a.id).length}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label={t('admin.floorPlan.area_move_left')} disabled={!area || areas[0]?.id === area.id} onClick={() => void moveArea(-1)}><ArrowLeft className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('admin.floorPlan.area_move_right')} disabled={!area || areas[areas.length - 1]?.id === area.id} onClick={() => void moveArea(1)}><ArrowRight className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('admin.floorPlan.area_edit_title')} onClick={() => setAreaDialog('edit')}><Pencil className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('admin.floorPlan.area_delete')} onClick={() => setDeleteArea(true)}><Trash2 className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAreaDialog('new')}><Plus className="mr-1 h-4 w-4" />{t('admin.floorPlan.area_add')}</Button>
              </div>
            </div>

            {/* Gereedschap */}
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="sm"><Plus className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.add_table')}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {TABLE_KINDS.map((k) => <DropdownMenuItem key={k} onSelect={() => addTable(k)}>{t(`admin.floorPlan.kind_${k}`)}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline"><Shapes className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.add_marker')}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {MARKER_KINDS.map((k) => <DropdownMenuItem key={k} onSelect={() => addMarker(k)}>{t(`admin.floorPlan.marker_${k}`)}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="sm" variant="outline" onClick={() => setTemplateOpen(true)}><LayoutTemplate className="mr-1.5 h-4 w-4" />{t('admin.floorPlan.templates')}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" disabled={printing || allTables.length === 0}>
                    {printing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}{t('admin.floorPlan.qr_print')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem disabled={tables.length === 0} onSelect={() => void printQr(tables.filter((x) => x.kind !== 'regular'))}>{t('admin.floorPlan.qr_print_area', { area: area?.name ?? '', count: tables.filter((x) => x.kind !== 'regular').length })}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void printQr(allTables.filter((x) => x.kind !== 'regular'))}>{t('admin.floorPlan.qr_print_all', { count: allTables.filter((x) => x.kind !== 'regular').length })}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {overlap.size > 0 || dupLabels.size > 0 ? (
              <div className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-0.5">
                  {overlap.size > 0 ? <p>{t('admin.floorPlan.warn_overlap', { count: overlap.size })}</p> : null}
                  {dupLabels.size > 0 ? <p>{t('admin.floorPlan.warn_duplicate_labels', { labels: [...dupLabels].join(', ').toUpperCase() })}</p> : null}
                </div>
              </div>
            ) : null}

            {area && !isMobile ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_300px]" onKeyDown={onKey}>
                <FloorCanvas
                  area={area}
                  tables={tables}
                  markers={markers}
                  selectedId={sel?.id ?? null}
                  warnIds={warnIds}
                  onTableClick={(tb) => setSel({ kind: 'table', id: tb.id })}
                  onMarkerClick={(mk) => setSel({ kind: 'marker', id: mk.id })}
                  onMove={onMove}
                  onBackgroundClick={() => setSel(null)}
                />
                <div className="rounded-md border p-4">
                  {panel ?? <p className="text-sm text-muted-foreground">{t('admin.floorPlan.select_hint')}</p>}
                </div>
              </div>
            ) : null}

            {area && isMobile ? (
              <div className="space-y-3">
                {tables.length === 0 && markers.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.floorPlan.area_empty')}</p> : null}
                <ul className="divide-y rounded-md border">
                  {[...tables].sort((a, b) => compareLabels(a.label, b.label)).map((tb) => (
                    <li key={tb.id}>
                      <button type="button" onClick={() => setSel({ kind: 'table', id: tb.id })} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50">
                        <span className="flex items-center gap-2">
                          <span className={cn('flex h-8 min-w-8 items-center justify-center border-2 px-1 text-xs font-semibold', tb.shape === 'round' ? 'rounded-full' : 'rounded-md', warnIds.has(tb.id) ? 'border-red-600' : 'border-slate-500')}>{tb.label}</span>
                          <span className="text-sm">{t(`admin.floorPlan.kind_${tb.kind}`)}</span>
                        </span>
                        <span className="text-sm text-muted-foreground">{t('admin.floorPlan.seats_count', { count: tb.seats })}</span>
                      </button>
                    </li>
                  ))}
                  {markers.map((mk) => (
                    <li key={mk.id}>
                      <button type="button" onClick={() => setSel({ kind: 'marker', id: mk.id })} className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm text-muted-foreground hover:bg-muted/50">
                        <span>{t(`admin.floorPlan.marker_${mk.kind}`)}{mk.label ? ` · ${mk.label}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{t('admin.floorPlan.mobile_hint')}</p>
                <ResponsiveDialog open={!!panel} onOpenChange={(o) => { if (!o) setSel(null); }}
                  title={selTable ? selTable.label : selMarker ? t(`admin.floorPlan.marker_${selMarker.kind}`) : ''}
                  maxWidth="md">
                  {panel}
                </ResponsiveDialog>
              </div>
            ) : null}
          </CardContent>
        )}
      </Card>

      <AreaDialog
        open={areaDialog !== null}
        onOpenChange={(o) => { if (!o) setAreaDialog(null); }}
        initial={areaDialog === 'edit' && area ? { name: area.name, grid_w: area.grid_w, grid_h: area.grid_h } : null}
        onSave={(d) => void saveArea(d)}
        busy={m.createArea.isPending || m.updateArea.isPending}
      />
      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} onPlace={placeTpl} busy={m.insertItems.isPending} />
      <AlertDialog open={deleteArea} onOpenChange={setDeleteArea}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.floorPlan.area_delete_title', { name: area?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.floorPlan.area_delete_text', { count: tables.length })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (area) { setSel(null); setAreaId(null); run(m.deactivateArea, area.id); } }}>{t('admin.floorPlan.area_delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
