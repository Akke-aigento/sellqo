// PHOTO-STD-1 (16-10-2026) — instellingen van de fotostandaard, met live voorbeeld.

import { useEffect, useMemo, useState } from 'react';
import { Frame, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMediaSettings } from '@/hooks/useMediaSettings';
import { ASPECT_PRESETS, CHECKER_STYLE, fetchImageBlob, renderStandardized, targetSize, type PhotoStandardSettings } from '@/lib/photoStandard';

const WIDTHS = [1000, 1200, 1600, 2000];
const BG_PRESETS = ['auto', '#ffffff', '#000000', 'transparent'] as const;



export function PhotoStandardCard({ sampleUrl }: { sampleUrl?: string }) {
  const { t } = useTranslation();
  const { settings, save, isLoading } = useMediaSettings();
  const [draft, setDraft] = useState<PhotoStandardSettings>(settings);
  const [sample, setSample] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);

  // Voorbeeldfoto één keer ophalen.
  useEffect(() => {
    if (!sampleUrl) return;
    let cancelled = false;
    fetchImageBlob(sampleUrl).then((b) => { if (!cancelled) setSample(b); }).catch(() => setSample(null));
    return () => { cancelled = true; };
  }, [sampleUrl]);

  // Voorbeeld opnieuw renderen bij elke wijziging (licht vertraagd).
  useEffect(() => {
    if (!sample) return;
    let cancelled = false;
    let made: string | null = null;
    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const out = await renderStandardized(sample, { ...draft, target_width: 600 });
        made = out.previewUrl;
        if (!cancelled) setPreview(out.previewUrl);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); if (made) URL.revokeObjectURL(made); };
  }, [sample, draft]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  const set = (patch: Partial<PhotoStandardSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const size = targetSize(draft);
  const bgMode = (BG_PRESETS as readonly string[]).includes(draft.background) ? draft.background : 'custom';
  const k = (key: string) => t(`admin.products.photoStandard.${key}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Frame className="h-5 w-5" />
          {k('title')}
        </CardTitle>
        <CardDescription>{k('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ps-enabled">{k('enabled')}</Label>
                <p className="text-xs text-muted-foreground">{k('enabled_hint')}</p>
              </div>
              <Switch id="ps-enabled" checked={draft.enabled} onCheckedChange={(v) => set({ enabled: v })} disabled={isLoading} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{k('aspect')}</Label>
                <Select value={`${draft.aspect_w}:${draft.aspect_h}`} onValueChange={(v) => { const [w, h] = v.split(':').map(Number); set({ aspect_w: w, aspect_h: h }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASPECT_PRESETS.map((a) => (
                      <SelectItem key={`${a.w}:${a.h}`} value={`${a.w}:${a.h}`}>
                        {a.w}:{a.h} · {t(`admin.products.photoStandard.aspect_${a.w}_${a.h}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{k('width')}</Label>
                <Select value={String(draft.target_width)} onValueChange={(v) => set({ target_width: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WIDTHS.map((w) => (
                      <SelectItem key={w} value={String(w)}>{w} × {Math.round((w * draft.aspect_h) / draft.aspect_w)} px</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{k('background')}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={bgMode} onValueChange={(v) => set({ background: v === 'custom' ? '#f5f5f5' : v })}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{k('bg_auto')}</SelectItem>
                    <SelectItem value="#ffffff">{k('bg_white')}</SelectItem>
                    <SelectItem value="#000000">{k('bg_black')}</SelectItem>
                    <SelectItem value="transparent">{k('bg_transparent')}</SelectItem>
                    <SelectItem value="custom">{k('bg_custom')}</SelectItem>
                  </SelectContent>
                </Select>
                {bgMode === 'custom' && (
                  <Input type="color" aria-label={k('bg_custom')} className="h-9 w-14 p-1" value={draft.background} onChange={(e) => set({ background: e.target.value })} />
                )}
              </div>
              {bgMode === 'auto' && <p className="text-xs text-muted-foreground">{k('bg_auto_hint')}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{k('margin')}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{draft.margin_pct}%</span>
              </div>
              <Slider min={0} max={20} step={1} value={[draft.margin_pct]} onValueChange={([v]) => set({ margin_pct: v })} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ps-trim">{k('auto_trim')}</Label>
                <p className="text-xs text-muted-foreground">{k('auto_trim_hint')}</p>
              </div>
              <Switch id="ps-trim" checked={draft.auto_trim} onCheckedChange={(v) => set({ auto_trim: v })} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ps-upload">{k('apply_on_upload')}</Label>
                <p className="text-xs text-muted-foreground">{k('apply_on_upload_hint')}</p>
              </div>
              <Switch id="ps-upload" checked={draft.apply_on_upload} onCheckedChange={(v) => set({ apply_on_upload: v })} />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save.mutate(draft)} disabled={!dirty || save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
              {dirty && <Button variant="ghost" onClick={() => setDraft(settings)}>{t('common.cancel')}</Button>}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{k('preview')} · {size.width} × {size.height}</p>
            <div
              className={`relative w-full overflow-hidden rounded-md border ${draft.background === 'transparent' ? '' : 'bg-muted'}`}
              style={{ aspectRatio: `${draft.aspect_w} / ${draft.aspect_h}`, ...(draft.background === 'transparent' ? CHECKER_STYLE : {}) }}
            >
              {preview ? (
                <img src={preview} alt={k('preview')} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  {sampleUrl ? <Loader2 className="h-5 w-5 animate-spin" /> : k('no_sample')}
                </div>
              )}
              {rendering && preview && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {sampleUrl && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{k('original')}</p>
                <img src={sampleUrl} alt={k('original')} className="max-h-28 rounded border object-contain" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
