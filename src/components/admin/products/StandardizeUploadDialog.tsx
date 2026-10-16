// PHOTO-STD-1 (16-10-2026) — voorbeeld bij uploaden: per foto "standaard" of "origineel".
// Lukt het omzetten van een foto niet (bv. HEIC dat de browser niet kan lezen), dan valt
// die foto automatisch terug op het origineel.

import { useEffect, useRef, useState } from 'react';
import { Loader2, Scissors } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { renderStandardized, targetSize, type PhotoStandardSettings, type StandardizedImage } from '@/lib/photoStandard';
import { CHECKER_STYLE } from './PhotoStandardCard';

interface Item {
  file: File;
  originalUrl: string;
  result: StandardizedImage | null;
  status: 'busy' | 'ok' | 'failed';
  useStandard: boolean;
}

/** Bestandsnaam met de extensie van het nieuwe type. */
function renamed(name: string, contentType: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '') || 'foto';
  return `${base}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
}

export function StandardizeUploadDialog({
  open,
  files,
  settings,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  files: File[];
  settings: PhotoStandardSettings;
  onConfirm: (files: File[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const previews = useRef<string[]>([]);
  const k = (key: string, o?: Record<string, unknown>) => t(`admin.products.photoStandard.${key}`, o);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const initial = files.map((file) => ({ file, originalUrl: URL.createObjectURL(file), result: null, status: 'busy' as const, useStandard: true }));
    setItems(initial);
    (async () => {
      for (let i = 0; i < files.length; i++) {
        try {
          const result = await renderStandardized(files[i], settings);
          if (cancelled) { URL.revokeObjectURL(result.previewUrl); return; }
          previews.current.push(result.previewUrl);
          setItems((prev) => prev.map((it, j) => (j === i ? { ...it, result, status: 'ok' } : it)));
        } catch {
          if (cancelled) return;
          setItems((prev) => prev.map((it, j) => (j === i ? { ...it, status: 'failed', useStandard: false } : it)));
        }
      }
    })();
    return () => {
      cancelled = true;
      initial.forEach((it) => URL.revokeObjectURL(it.originalUrl));
      previews.current.forEach((u) => URL.revokeObjectURL(u));
      previews.current = [];
    };
  }, [open, files, settings]);

  const busy = items.some((it) => it.status === 'busy');
  const size = targetSize(settings);
  const transparent = settings.background === 'transparent';

  const confirm = () => {
    onConfirm(items.map((it) =>
      it.useStandard && it.result
        ? new File([it.result.blob], renamed(it.file.name, it.result.contentType), { type: it.result.contentType })
        : it.file));
  };

  const setAll = (useStandard: boolean) =>
    setItems((prev) => prev.map((it) => ({ ...it, useStandard: useStandard && it.status === 'ok' })));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scissors className="h-5 w-5" />{k('upload_title')}</DialogTitle>
          <DialogDescription>{k('upload_description', { aspect: `${settings.aspect_w}:${settings.aspect_h}`, width: size.width, height: size.height })}</DialogDescription>
        </DialogHeader>

        {items.length > 1 && (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAll(true)}>{k('all_standard')}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAll(false)}>{k('all_original')}</Button>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-[200px] max-h-[60vh] -mx-2 px-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border p-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {(['standard', 'original'] as const).map((which) => {
                    const active = which === 'standard' ? it.useStandard : !it.useStandard;
                    const disabled = which === 'standard' && it.status !== 'ok';
                    return (
                      <button
                        type="button"
                        key={which}
                        disabled={disabled}
                        onClick={() => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, useStandard: which === 'standard' } : x)))}
                        className={cn('rounded-md border-2 p-1 text-left transition-colors', active ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30', disabled && 'opacity-50 cursor-not-allowed')}
                      >
                        <div
                          className="relative w-full overflow-hidden rounded bg-muted"
                          style={{ aspectRatio: `${settings.aspect_w} / ${settings.aspect_h}`, ...(which === 'standard' && transparent ? CHECKER_STYLE : {}) }}
                        >
                          {which === 'standard' ? (
                            it.status === 'busy' ? (
                              <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                            ) : it.result ? (
                              <img src={it.result.previewUrl} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">{k('render_failed')}</div>
                            )
                          ) : (
                            <img src={it.originalUrl} alt="" className="h-full w-full object-contain" />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] font-medium">{which === 'standard' ? k('standard') : k('original')}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{it.file.name}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="button" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {k('upload_confirm', { count: items.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
