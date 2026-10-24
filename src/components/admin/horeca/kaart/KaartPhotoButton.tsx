// KAART-2 — "Foto van je kaart": foto kiezen of nemen → verkleinen in de browser → de AI leest
// namen, prijzen en kopjes → het voorbeeld van KaartImportDialog. Kost KAART_PHOTO_CREDITS per
// foto (enkel als het lezen lukt); niets wordt aangemaakt zonder "Toevoegen".
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAICredits } from '@/hooks/useAICredits';
import { isBillingExempt } from '../../../../../supabase/functions/_shared/billingExempt';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditPurchaseDialog } from '@/components/admin/marketing/CreditPurchaseDialog';
import { KAART_PHOTO_CREDITS, type KaartPhotoItem } from '../../../../../supabase/functions/_shared/kaartPhoto';
import { priceToInput } from './parseKaart';
import type { PreviewRow } from './KaartImportDialog';

const MAX_SIDE = 2000;

/** Foto verkleinen tot max. 2000 px en als jpeg (±0,5–1,5 MB) doorsturen. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function KaartPhotoButton({ onRows }: { onRows: (rows: Omit<PreviewRow, 'key' | 'include'>[]) => void }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const { credits, refetch } = useAICredits();
  // Zoals de server: enkel een vrijgestelde zaak is gratis (een platform-admin op een gewone
  // zaak betaalt wel; useAICredits.isUnlimited telt die ook mee).
  const isUnlimited = isBillingExempt(currentTenant);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [buy, setBuy] = useState(false);
  const available = credits?.available ?? 0;
  const enough = isUnlimited || available >= KAART_PHOTO_CREDITS;

  const read = async () => {
    if (!file || !currentTenant?.id) return;
    setBusy(true);
    try {
      const image = await shrink(file);
      const { data, error } = await supabase.functions.invoke('ai-kaart-photo', { body: { tenantId: currentTenant.id, image, language: i18n.language.slice(0, 2) } });
      // Bij een fout zit de reden in de body van de response (FunctionsHttpError.context).
      let code = (data as { code?: string } | null)?.code;
      if (error) {
        const ctx = (error as { context?: Response }).context;
        try { code = ((await ctx?.json()) as { code?: string } | undefined)?.code ?? code; } catch { /* geen json */ }
      }
      const items = (data as { items?: KaartPhotoItem[] } | null)?.items;
      if (error || !items) {
        if (code === 'no_credits') setBuy(true);
        toast.error(t(`admin.kaart.photo.error.${code && ['no_credits', 'empty', 'bad_image', 'rate_limited', 'billing'].includes(code) ? code : 'ai_failed'}`));
        return;
      }
      setFile(null);
      onRows(items.map((it) => ({ name: it.name, price: it.price ? priceToInput(it.price, i18n.language) : '', category: it.category ?? '' })));
      toast.success(t('admin.kaart.photo.found', { count: items.length }));
    } catch {
      toast.error(t('admin.kaart.photo.error.bad_image'));
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => input.current?.click()}><Camera className="mr-2 h-4 w-4" />{t('admin.kaart.photo.button')}</Button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); }} />
      <Dialog open={!!file} onOpenChange={(o) => { if (!o && !busy) setFile(null); }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.kaart.photo.title')}</DialogTitle>
            <DialogDescription>{t('admin.kaart.photo.intro')}</DialogDescription>
          </DialogHeader>
          {file ? <p className="truncate text-sm text-muted-foreground">{file.name}</p> : null}
          <p className="text-sm">
            {isUnlimited ? t('admin.kaart.photo.costFree') : t('admin.kaart.photo.cost', { credits: KAART_PHOTO_CREDITS, available })}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            {!enough ? <Button variant="outline" onClick={() => setBuy(true)}>{t('admin.kaart.photo.buy')}</Button> : null}
            <Button onClick={() => void read()} disabled={busy || !enough}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('admin.kaart.photo.reading')}</> : t('admin.kaart.photo.read')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreditPurchaseDialog open={buy} onOpenChange={setBuy} />
    </>
  );
}
