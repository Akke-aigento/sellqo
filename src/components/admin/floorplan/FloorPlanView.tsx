// ZAAL-H1 — het zaalplan, alleen-lezen. Bedoeld voor hergebruik door TAFEL-1 (live
// zaalplan aan de kassa: welke tafel is bezet, wie wil afrekenen). Geen data-ophaling:
// alles komt via props, zodat het overal inzetbaar en testbaar is.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { FloorArea, FloorMarker, FloorTable, TableStatus } from '@/lib/floorplan';
import { FloorCanvas } from './FloorCanvas';

export interface FloorPlanViewProps {
  areas: FloorArea[];
  tables: FloorTable[];
  markers: FloorMarker[];
  /** Optionele status per tafel-id (kleur + voorleestekst). */
  status?: Record<string, TableStatus | undefined>;
  /** TAFEL-1: extra regel per tafel (bedrag · minuten). */
  badges?: Record<string, string | undefined>;
  onTableClick?: (table: FloorTable) => void;
  /** Welke ruimte eerst open staat (standaard de eerste). */
  initialAreaId?: string;
  maxHeight?: number;
  className?: string;
}

export function FloorPlanView({ areas, tables, markers, status, badges, onTableClick, initialAreaId, maxHeight, className }: FloorPlanViewProps) {
  const { t } = useTranslation();
  const sorted = useMemo(() => [...areas].filter((a) => a.is_active).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)), [areas]);
  const [picked, setPicked] = useState<string | undefined>(initialAreaId);
  const area = sorted.find((a) => a.id === picked) ?? sorted[0];

  if (!area) {
    return <p className={cn('rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground', className)}>{t('admin.floorPlan.view_empty')}</p>;
  }
  const inArea = <T extends { area_id: string }>(xs: T[]) => xs.filter((x) => x.area_id === area.id);

  return (
    <div className={cn('space-y-3', className)}>
      {sorted.length > 1 ? (
        <div role="tablist" aria-label={t('admin.floorPlan.areas')} className="flex gap-1 overflow-x-auto">
          {sorted.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === area.id} onClick={() => setPicked(a.id)}
              className={cn('whitespace-nowrap rounded-full border px-3 py-1 text-sm', a.id === area.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {a.name}
            </button>
          ))}
        </div>
      ) : null}
      <FloorCanvas
        area={area}
        tables={inArea(tables).filter((x) => x.is_active)}
        markers={inArea(markers)}
        status={status}
        badges={badges}
        onTableClick={onTableClick}
        maxHeight={maxHeight}
      />
    </div>
  );
}
