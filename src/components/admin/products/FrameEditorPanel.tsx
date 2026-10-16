// EDITOR-2 (16-10-2026) — gratis bewerken in de browser: formaat, uitsnede, draaien,
// achtergrond. Vertrekt van de fotostandaard van de winkel; alles is bij te sturen.
// Het resultaat wordt een nieuw bestand: het origineel blijft bewaard in de bibliotheek.

import { useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import { useMediaSettings } from '@/hooks/useMediaSettings';
import { uploadProcessedImage } from '@/hooks/useStandardizePhotos';
import {
  ASPECT_PRESETS, fetchImageBlob, renderStandardized, targetSize,
  type FrameAdjust, type PhotoStandardSettings, type StandardizedImage,
} from '@/lib/photoStandard';
import { CHECKER_STYLE } from './PhotoStandardCard';

const ROTATIONS: FrameAdjust['rotate'][] = [0, 90, 180, 270];

export function FrameEditorPanel({
  imageUrl,
  productName,
  onApplied,
}: {
  imageUrl: string;
  productName?: string;
  onApplied: (newUrl: string) => void;
}) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { settings } = useMediaSettings();
  const [frame, setFrame] = useState<PhotoStandardSettings>({ ...settings, enabled: true });
  const [adj, setAdj] = useState<Required<FrameAdjust>>({ rotate: 0, zoom: 1, offsetX: 0, offsetY: 0 });
  const [source, setSource] = useState<Blob | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<StandardizedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const k = (key: string) => t(`admin.products.photoEditor.${key}`);

  useEffect(() => { setFrame({ ...settings, enabled: true }); }, [settings]);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setLoadError(false);
    fetchImageBlob(imageUrl)
      .then((b) => { if (!cancelled) setSource(b); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [imageUrl]);

  // Voorbeeld op ware grootte renderen: dat is meteen het resultaat dat we opladen.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let made: string | null = null;
    const timer = setTimeout(async () => {
      try {
        const out = await renderStandardized(source, frame, adj);
        made = out.previewUrl;
        if (!cancelled) setResult(out);
      } catch {
        if (!cancelled) setResult(null);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); if (made) URL.revokeObjectURL(made); };
  }, [source, frame, adj]);

  const apply = async () => {
    if (!result || !currentTenant?.id) return;
    setSaving(true);
    try {
      const url = await uploadProcessedImage(currentTenant.id, result.blob, {
        contentType: result.contentType, width: result.width, height: result.height, title: productName, prefix: 'edit',
      });
      onApplied(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const size = targetSize(frame);
  const set = (patch: Partial<PhotoStandardSettings>) => setFrame((f) => ({ ...f, ...patch }));
  const rotate = (dir: 1 | -1) => setAdj((a) => {
    const i = ROTATIONS.indexOf(a.rotate);
    return { ...a, rotate: ROTATIONS[(i + dir + 4) % 4] as Required<FrameAdjust>['rotate'] };
  });

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-2">
        <div
          className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted"
          style={{ aspectRatio: `${frame.aspect_w} / ${frame.aspect_h}`, ...(frame.background === 'transparent' ? CHECKER_STYLE : {}) }}
        >
          {loadError ? (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{k('load_error')}</div>
          ) : result ? (
            <img src={result.previewUrl} alt={k('preview')} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground tabular-nums">{size.width} × {size.height} px</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t('admin.products.photoStandard.aspect')}</Label>
          <Select value={`${frame.aspect_w}:${frame.aspect_h}`} onValueChange={(v) => { const [w, h] = v.split(':').map(Number); set({ aspect_w: w, aspect_h: h }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECT_PRESETS.map((a) => (
                <SelectItem key={`${a.w}:${a.h}`} value={`${a.w}:${a.h}`}>{a.w}:{a.h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('admin.products.photoStandard.background')}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={['auto', '#ffffff', '#000000', 'transparent'].includes(frame.background) ? frame.background : 'custom'}
              onValueChange={(v) => set({ background: v === 'custom' ? '#f5f5f5' : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('admin.products.photoStandard.bg_auto')}</SelectItem>
                <SelectItem value="#ffffff">{t('admin.products.photoStandard.bg_white')}</SelectItem>
                <SelectItem value="#000000">{t('admin.products.photoStandard.bg_black')}</SelectItem>
                <SelectItem value="transparent">{t('admin.products.photoStandard.bg_transparent')}</SelectItem>
                <SelectItem value="custom">{t('admin.products.photoStandard.bg_custom')}</SelectItem>
              </SelectContent>
            </Select>
            {!['auto', '#ffffff', '#000000', 'transparent'].includes(frame.background) && (
              <Input type="color" aria-label={t('admin.products.photoStandard.bg_custom')} className="h-9 w-14 shrink-0 p-1" value={frame.background} onChange={(e) => set({ background: e.target.value })} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fe-trim">{t('admin.products.photoStandard.auto_trim')}</Label>
          <Switch id="fe-trim" checked={frame.auto_trim} onCheckedChange={(v) => set({ auto_trim: v })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('admin.products.photoStandard.margin')}</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{frame.margin_pct}%</span>
          </div>
          <Slider min={0} max={20} step={1} value={[frame.margin_pct]} onValueChange={([v]) => set({ margin_pct: v })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{k('zoom')}</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(adj.zoom * 100)}%</span>
          </div>
          <Slider min={50} max={200} step={1} value={[Math.round(adj.zoom * 100)]} onValueChange={([v]) => setAdj((a) => ({ ...a, zoom: v / 100 }))} />
        </div>

        <div className="space-y-2">
          <Label>{k('position')}</Label>
          <Slider min={-40} max={40} step={1} value={[adj.offsetX]} onValueChange={([v]) => setAdj((a) => ({ ...a, offsetX: v }))} aria-label={k('horizontal')} />
          <Slider min={-40} max={40} step={1} value={[adj.offsetY]} onValueChange={([v]) => setAdj((a) => ({ ...a, offsetY: v }))} aria-label={k('vertical')} />
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => rotate(-1)} aria-label={k('rotate_left')}><RotateCcw className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => rotate(1)} aria-label={k('rotate_right')}><RotateCw className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setAdj({ rotate: 0, zoom: 1, offsetX: 0, offsetY: 0 }); setFrame({ ...settings, enabled: true }); }}>
            {k('reset')}
          </Button>
        </div>

        <Button type="button" className="w-full" onClick={apply} disabled={!result || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          {k('apply')}
        </Button>
        <p className="text-xs text-muted-foreground">{k('apply_hint')}</p>
      </div>
    </div>
  );
}
