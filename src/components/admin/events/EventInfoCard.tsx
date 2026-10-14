// EVENT-WORKSPACE-1 — het event zelf: naam, foto, beschrijving en zichtbaarheid in de
// winkel. Geldt voor alle datums van dit event (het is het ticketproduct eronder).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useUpdateEventProduct, type EventProduct } from '@/hooks/useEventWorkspace';

export function EventInfoCard({ eventId, product, dateCount }: { eventId: string; product: EventProduct; dateCount: number }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.workspace.${x}`, o);
  const update = useUpdateEventProduct(eventId);
  const { uploadImage, uploading } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const image = product.featured_image ?? product.images[0] ?? null;
  useEffect(() => { setName(product.name); setDescription(product.description ?? ''); }, [product]);
  const dirty = name.trim() !== product.name || description !== (product.description ?? '');

  const save = async (patch: Parameters<typeof update.mutateAsync>[0]['patch']) => {
    try { await update.mutateAsync({ id: product.id, patch }); toast.success(k('saved')); }
    catch (e) { toast.error(k('save_failed'), { description: e instanceof Error ? e.message : undefined }); }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const url = await uploadImage(f);
    if (url) await save({ images: [url, ...product.images.filter((u) => u !== url)], featured_image: url });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />{k('event_title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{k('event_hint', { count: dateCount })}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="shrink-0">
            {image ? (
              <div className="relative h-32 w-full overflow-hidden rounded-lg sm:w-44">
                <img src={image} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => void save({ images: product.images.filter((u) => u !== image), featured_image: null })}
                  aria-label={k('photo_remove')} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X className="h-4 w-4" /></button>
                <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white">{k('photo_change')}</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-primary/50 sm:w-44">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}{k('photo_add')}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5"><Label>{k('name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{k('description')}</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {dirty && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setName(product.name); setDescription(product.description ?? ''); }}>{t('common.cancel', 'Annuleren')}</Button>
                <Button size="sm" disabled={name.trim().length < 2 || update.isPending} onClick={() => void save({ name: name.trim(), description: description.trim() || null })}>
                  {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('save')}
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            {product.hide_from_storefront ? <EyeOff className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <Eye className="mt-0.5 h-4 w-4 text-emerald-600" />}
            <div>
              <p className="text-sm font-medium">{product.hide_from_storefront ? k('hidden') : k('visible')}</p>
              <p className="text-xs text-muted-foreground">{product.hide_from_storefront ? k('hidden_hint') : k('visible_hint')}</p>
            </div>
          </div>
          <Switch checked={!product.hide_from_storefront} disabled={update.isPending}
            onCheckedChange={(on) => void save({ hide_from_storefront: !on })} aria-label={k('visible')} />
        </div>
      </CardContent>
    </Card>
  );
}
