import { useState } from 'react';
import { ArrowLeft, ArrowRight, Images, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MediaLibraryPickerDialog } from './MediaLibraryPickerDialog';
import { PermissionGate } from '@/components/PermissionGate';
import { useTranslation } from 'react-i18next';

interface VariantExtraImagesDialogProps {
  variantTitle: string;
  images: string[];
  onChange: (images: string[]) => void;
}

/**
 * VARIANT-GALLERY-1 — extra foto's per variant.
 * `image_url` blijft de hoofdfoto; deze lijst zijn de aanvullende beelden.
 */
export function VariantExtraImagesDialog({ variantTitle, images, onChange }: VariantExtraImagesDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (url: string) => onChange(images.filter(u => u !== url));

  return (
    <PermissionGate action="write" resource="products">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        title={t('admin.products.variantExtraImagesDialog.extra_foto_s')}
        onClick={() => setOpen(true)}
      >
        <Images className="h-4 w-4" />
        {images.length > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] leading-none rounded-full bg-primary text-primary-foreground px-1 py-0.5">
            {images.length}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Extra foto's — {variantTitle}</DialogTitle>
            <DialogDescription>
              {t('admin.products.variantExtraImagesDialog.aanvullende_beelden_voor_deze_variant_in')}
            </DialogDescription>
          </DialogHeader>

          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('admin.products.variantExtraImagesDialog.nog_geen_extra_foto_s_voor')}</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {images.map((url, idx) => (
                <div key={`${url}-${idx}`} className="flex items-center gap-2 border rounded-lg p-2">
                  <img src={url} alt="" className="h-12 w-12 rounded object-cover border shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{url.split('/').pop()}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === images.length - 1} onClick={() => move(idx, 1)}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(url)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
              {t('admin.products.variantExtraImagesDialog.kies_uit_bibliotheek')}
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaLibraryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingUrls={images}
        uploadFolder="products"
        onSelect={(urls) => onChange([...images, ...urls])}
      />
    </PermissionGate>
  );
}