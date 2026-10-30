// PHOTO-ORDER-1 — productfoto's herschikken. Positie 1 is altijd de hoofdfoto: storefront-api
// zet featured_image vooraan en volgt daarna de volgorde van `images`, dus deze volgorde is
// meteen de volgorde op elke webshop (ook de custom frontends, zonder contractwijziging).
// Slepen werkt met muis, touch (korte druk) en toetsenbord; de pijltjes zijn de terugval
// op touch en altijd zichtbaar, want hover bestaat niet op een telefoon.
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, Download, GripVertical, Star, Wand2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  images: string[];
  readOnly?: boolean;
  onReorder: (next: string[]) => void;
  onMakeFeatured: (url: string) => void;
  onEdit: (url: string) => void;
  onDownload: (url: string, index: number) => void;
  onRemove: (url: string) => void;
}

function Tile({
  url, index, count, readOnly, onMove, onMakeFeatured, onEdit, onDownload, onRemove,
}: {
  url: string; index: number; count: number; readOnly?: boolean;
  onMove: (from: number, to: number) => void;
} & Omit<Props, 'images' | 'onReorder'>) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: url, disabled: readOnly });
  const featured = index === 0;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative group aspect-square rounded-lg overflow-hidden border-2 bg-muted',
        featured ? 'border-primary' : 'border-transparent',
        isDragging && 'z-10 opacity-80 shadow-lg',
      )}
    >
      <img src={url} alt={t('admin.productForm.product_nummer', { number: index + 1 })} className="w-full h-full object-cover" draggable={false} />

      {!readOnly && (
        <>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="absolute top-2 right-2 rounded-md bg-background/90 p-1.5 shadow cursor-grab active:cursor-grabbing touch-none"
            aria-label={t('admin.productForm.photo_order.drag')}
            title={t('admin.productForm.photo_order.drag')}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-end justify-between gap-1">
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={index === 0}
                onClick={() => onMove(index, index - 1)} aria-label={t('admin.productForm.photo_order.move_left')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={index === count - 1}
                onClick={() => onMove(index, index + 1)} aria-label={t('admin.productForm.photo_order.move_right')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={featured}
                onClick={() => onMakeFeatured(url)} title={t('admin.productForm.maak_hoofdafbeelding')} aria-label={t('admin.productForm.maak_hoofdafbeelding')}>
                <Star className={cn('h-4 w-4', featured && 'fill-amber-500 text-amber-500')} />
              </Button>
              <Button type="button" size="icon" variant="secondary" className="h-7 w-7"
                onClick={() => onEdit(url)} title={t('admin.productForm.ai_bewerken')} aria-label={t('admin.productForm.ai_bewerken')}>
                <Wand2 className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="secondary" className="h-7 w-7"
                onClick={() => onDownload(url, index)} title={t('admin.marketing.mediaAssetsLibrary.downloaden')} aria-label={t('admin.marketing.mediaAssetsLibrary.downloaden')}>
                <Download className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="destructive" className="h-7 w-7"
                onClick={() => onRemove(url)} title={t('common.delete')} aria-label={t('common.delete')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {featured && (
        <div className="absolute top-2 left-2">
          <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">{t('admin.products.productPhotosManager.hoofd')}</span>
        </div>
      )}
    </div>
  );
}

export function SortableProductImages({ images, readOnly, onReorder, ...actions }: Props) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    onReorder(arrayMove(images, from, to));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(images.indexOf(String(e.active.id)), images.indexOf(String(e.over.id)));
  };
  if (images.length === 0) return null;
  return (
    <div className="space-y-2">
      {!readOnly && images.length > 1 && (
        <p className="text-xs text-muted-foreground">{t('admin.productForm.photo_order.hint')}</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={images} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {images.map((url, index) => (
              <Tile key={url} url={url} index={index} count={images.length} readOnly={readOnly} onMove={move} {...actions} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
