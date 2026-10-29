// ZAAL-H1 — één ruimte van het zaalplan op een raster. Gedeeld door de editor (slepen,
// selecteren) en het alleen-lezen FloorPlanView (TAFEL-1: live zaalplan met status).
// Alles in rastereenheden; de celgrootte volgt uit de beschikbare breedte.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { clampToArea, dragTo, fitCell, normRotation } from '@/lib/floorplan';
import type { FloorArea, FloorMarker, FloorTable, TableStatus } from '@/lib/floorplan';
import { useElementWidth } from '@/hooks/useElementWidth';

export interface FloorCanvasProps {
  area: FloorArea;
  tables: FloorTable[];
  markers: FloorMarker[];
  status?: Record<string, TableStatus | undefined>;
  /** TAFEL-1: korte extra regel per tafel (bedrag, minuten sinds laatste ronde). */
  badges?: Record<string, string | undefined>;
  selectedId?: string | null;
  /** Ids met een waarschuwing (overlap, dubbel label): rode rand. */
  warnIds?: Set<string>;
  onTableClick?: (table: FloorTable) => void;
  onMarkerClick?: (marker: FloorMarker) => void;
  /** Bewerken: slepen met raster-snap. Zonder deze prop is het plan alleen-lezen. */
  onMove?: (kind: 'table' | 'marker', id: string, pos: { x: number; y: number }) => void;
  /** Klik op een lege plek (selectie wissen). */
  onBackgroundClick?: () => void;
  /** Maximale hoogte in px (bv. kassascherm); standaard enkel de breedte. */
  maxHeight?: number;
  className?: string;
}

// KASSA-UX-1: dezelfde kleuren als de lijstweergave van de kassa (groen bezet, blauw rekening
// gevraagd, amber QR-bestelling). Enkel de kassa geeft een status mee; de editor niet.
const STATUS_CLASS: Record<TableStatus, string> = {
  free: 'border-slate-400 bg-background text-foreground',
  occupied: 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  bill: 'border-blue-600 bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-50',
  attention: 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50',
  reserved: 'border-violet-600 bg-violet-50 text-violet-950 dark:bg-violet-950 dark:text-violet-50',
};

const MARKER_CLASS: Record<FloorMarker['kind'], string> = {
  bar: 'bg-stone-500/80 text-white border-stone-700',
  wall: 'bg-slate-700 text-white border-slate-800',
  door: 'border-dashed border-slate-500 bg-transparent text-muted-foreground',
  plant: 'rounded-full bg-green-600/70 border-green-800 text-white',
  text: 'border-transparent bg-transparent text-muted-foreground',
};

interface Drag { kind: 'table' | 'marker'; id: string; startX: number; startY: number; px: number; py: number; moved: boolean }

export function FloorCanvas(props: FloorCanvasProps) {
  const { area, tables, markers, status, badges, selectedId, warnIds, onTableClick, onMarkerClick, onMove, onBackgroundClick, maxHeight, className } = props;
  const { t } = useTranslation();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const cell = fitCell(area, width || 640, maxHeight);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const startDrag = (e: React.PointerEvent, kind: 'table' | 'marker', item: { id: string; x: number; y: number }) => {
    if (!onMove || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ kind, id: item.id, startX: item.x, startY: item.y, px: e.clientX, py: e.clientY, moved: false });
  };
  const moveDrag = (e: React.PointerEvent, item: FloorTable | FloorMarker) => {
    if (!drag || drag.id !== item.id) return;
    const dx = e.clientX - drag.px;
    const dy = e.clientY - drag.py;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    const pos = clampToArea({ ...item, ...dragTo({ x: drag.startX, y: drag.startY }, dx, dy, cell) }, area);
    setDrag({ ...drag, moved: true });
    setPreview({ id: item.id, x: pos.x, y: pos.y });
  };
  const endDrag = () => {
    if (drag?.moved && preview && onMove && (preview.x !== drag.startX || preview.y !== drag.startY)) {
      onMove(drag.kind, drag.id, { x: preview.x, y: preview.y });
    }
    suppressClick.current = !!drag?.moved;
    setDrag(null);
    setPreview(null);
  };
  const pos = (item: { id: string; x: number; y: number }) => (preview?.id === item.id ? preview : item);

  const box = (item: { x: number; y: number; w: number; h: number; rotation: number }) => ({
    left: item.x * cell, top: item.y * cell, width: item.w * cell, height: item.h * cell,
    transform: normRotation(item.rotation) ? `rotate(${normRotation(item.rotation)}deg)` : undefined,
  });
  const fontSize = Math.max(9, Math.min(16, cell * 0.55));

  return (
    <div ref={wrapRef} className={cn('w-full overflow-x-auto', className)}>
      <div
        role="group"
        aria-label={area.name}
        className="relative rounded-md border bg-card"
        style={{
          width: area.grid_w * cell, height: area.grid_h * cell,
          backgroundImage: 'linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px)',
          backgroundSize: `${cell}px ${cell}px`,
          touchAction: onMove ? 'none' : undefined,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }}
      >
        {markers.map((m) => {
          const p = pos(m);
          return (
            <div
              key={m.id}
              data-testid="floor-marker"
              className={cn('absolute flex select-none items-center justify-center overflow-hidden border text-center leading-tight',
                MARKER_CLASS[m.kind], m.kind !== 'plant' && 'rounded-sm',
                (onMove || onMarkerClick) && 'cursor-pointer',
                selectedId === m.id && 'ring-2 ring-primary ring-offset-1')}
              style={{ ...box({ ...m, ...p }), fontSize: fontSize * 0.8 }}
              onPointerDown={(e) => startDrag(e, 'marker', m)}
              onPointerMove={(e) => moveDrag(e, m)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onMarkerClick?.(m); }}
            >
              {m.label || (m.kind === 'text' ? '' : t(`admin.floorPlan.marker_${m.kind}`))}
            </div>
          );
        })}
        {tables.map((tb) => {
          const p = pos(tb);
          const st = status?.[tb.id];
          const interactive = !!(onMove || onTableClick);
          const Tag = interactive ? 'button' : 'div';
          return (
            <Tag
              key={tb.id}
              {...(interactive ? { type: 'button' as const } : {})}
              data-testid="floor-table"
              data-status={st || undefined}
              aria-label={st ? t('admin.floorPlan.table_aria_status', { label: tb.label, status: t(`admin.floorPlan.status_${st}`) }) : t('admin.floorPlan.table_aria', { label: tb.label, seats: tb.seats })}
              aria-pressed={selectedId ? selectedId === tb.id : undefined}
              className={cn('absolute flex select-none items-center justify-center border-2 font-semibold shadow-sm',
                tb.shape === 'round' ? 'rounded-full' : 'rounded-md',
                st ? STATUS_CLASS[st] : 'border-slate-500 bg-background text-foreground',
                tb.kind === 'standing' && !st && 'border-dashed',
                interactive && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                drag?.id === tb.id && 'opacity-80 shadow-lg',
                warnIds?.has(tb.id) && 'border-red-600',
                selectedId === tb.id && 'ring-2 ring-primary ring-offset-1')}
              style={{ ...box({ ...tb, ...p }), fontSize }}
              onPointerDown={(e: React.PointerEvent) => startDrag(e, 'table', tb)}
              onPointerMove={(e: React.PointerEvent) => moveDrag(e, tb)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onTableClick?.(tb); }}
            >
              {/* Label blijft rechtop, ook als de tafel gedraaid is. */}
              <span className="pointer-events-none flex min-w-0 flex-col items-center px-0.5 leading-tight" style={{ transform: normRotation(tb.rotation) ? `rotate(${-normRotation(tb.rotation)}deg)` : undefined }}>
                <span className="max-w-full truncate">{tb.label}</span>
                {badges?.[tb.id] ? <span className="max-w-full truncate text-[0.7em] font-normal">{badges[tb.id]}</span> : null}
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
