// SOCIAL-4 — "Tekst in beeld aanpassen": de tekstvakken van een beeldrecept wijzigen met een
// live voorbeeld, het beeld in de browser opnieuw tekenen, het resultaat tonen en pas dan
// bewaren. Zo ziet de gebruiker exact de JPEG die online gaat, in elke browser.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { applySlots, editableImageIndexes, parseRecipe, rasterizeRecipe, readSlots, type ImageRecipe } from '@/lib/social/imageRecipe';
import type { PlannerPost } from '@/hooks/useSocialPlanner';

const PREVIEW_WIDTH = 280;

interface Props {
  post: PlannerPost | null;
  onClose: () => void;
  onSave: (input: { post: PlannerPost; index: number; jpeg: Blob; recipe: ImageRecipe }) => Promise<void>;
}

export function SocialImageTextEditor({ post, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const indexes = useMemo(() => (post ? editableImageIndexes(post) : []), [post]);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'edit' | 'rendering' | 'result' | 'saving'>('edit');
  const [result, setResult] = useState<{ blob: Blob; url: string; recipe: ImageRecipe } | null>(null);
  const lastUrl = useRef<string | null>(null);

  const imageIndex = indexes[index] ?? indexes[0] ?? 0;
  const recipe = useMemo(
    () => (post ? parseRecipe((post.image_recipes ?? [])[imageIndex]) : null),
    [post, imageIndex],
  );
  const slots = useMemo(() => (recipe ? readSlots(recipe.html) : []), [recipe]);

  useEffect(() => {
    setValues(Object.fromEntries(slots.map((s) => [s.key, s.value])));
    setPhase('edit');
    setResult(null);
  }, [slots]);

  useEffect(() => {
    setIndex(0);
  }, [post?.id]);

  useEffect(() => () => {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
  }, []);

  const previewHtml = useMemo(() => (recipe ? applySlots(recipe.html, values) : ''), [recipe, values]);
  const changed = slots.some((s) => (values[s.key] ?? '') !== s.value);
  const scale = recipe ? PREVIEW_WIDTH / recipe.width : 1;

  const render = async () => {
    if (!recipe) return;
    setPhase('rendering');
    try {
      const html = applySlots(recipe.html, values);
      const blob = await rasterizeRecipe(html, recipe.width, recipe.height);
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      const url = URL.createObjectURL(blob);
      lastUrl.current = url;
      setResult({ blob, url, recipe: { ...recipe, html } });
      setPhase('result');
    } catch (err) {
      toast.error(t('admin.socialPlanner.imageText.renderFailed', { message: (err as Error).message }));
      setPhase('edit');
    }
  };

  const save = async () => {
    if (!post || !result) return;
    setPhase('saving');
    try {
      await onSave({ post, index: imageIndex, jpeg: result.blob, recipe: result.recipe });
      toast.success(t('admin.socialPlanner.imageText.saved'));
      onClose();
    } catch (err) {
      toast.error(t('admin.socialPlanner.toast.error', { message: (err as Error)?.message ?? '' }));
      setPhase('result');
    }
  };

  const footer = phase === 'result' || phase === 'saving' ? (
    <div className="flex w-full gap-2 sm:justify-end">
      <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setPhase('edit')} disabled={phase === 'saving'}>
        {t('admin.socialPlanner.imageText.back')}
      </Button>
      <Button className="flex-1 sm:flex-none" onClick={save} disabled={phase === 'saving'}>
        {phase === 'saving' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        {t('admin.socialPlanner.imageText.save')}
      </Button>
    </div>
  ) : (
    <div className="flex w-full gap-2 sm:justify-end">
      <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button className="flex-1 sm:flex-none" onClick={render} disabled={!changed || phase === 'rendering'}>
        {phase === 'rendering' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        {phase === 'rendering' ? t('admin.socialPlanner.imageText.rendering') : t('admin.socialPlanner.imageText.next')}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={!!post}
      onOpenChange={(open) => !open && onClose()}
      maxWidth="2xl"
      title={phase === 'result' || phase === 'saving' ? t('admin.socialPlanner.imageText.resultTitle') : t('admin.socialPlanner.imageText.title')}
      footer={footer}
    >
      {!recipe ? null : phase === 'result' || phase === 'saving' ? (
        <div className="space-y-3">
          <img
            src={result?.url}
            alt=""
            className="mx-auto w-full max-w-[320px] rounded-md border"
          />
          <p className="text-xs text-muted-foreground text-center">{t('admin.socialPlanner.imageText.resultHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="shrink-0 mx-auto">
            <div
              className="relative overflow-hidden rounded-md border bg-muted"
              style={{ width: PREVIEW_WIDTH, height: Math.round(recipe.height * scale) }}
            >
              <iframe
                title={t('admin.socialPlanner.imageText.preview')}
                sandbox=""
                srcDoc={previewHtml}
                className="absolute left-0 top-0 border-0 pointer-events-none"
                style={{ width: recipe.width, height: recipe.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            {indexes.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {indexes.map((imgIdx, i) => (
                  <Button
                    key={imgIdx}
                    size="sm"
                    variant={i === index ? 'default' : 'outline'}
                    onClick={() => setIndex(i)}
                  >
                    {t('admin.socialPlanner.imageText.image', { n: imgIdx + 1 })}
                  </Button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.imageText.hint')}</p>
            {slots.map((slot) => {
              const value = values[slot.key] ?? '';
              const id = `slot-${slot.key}`;
              return (
                <div key={slot.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor={id}>{slot.label}</Label>
                    {slot.max && (
                      <span className={cn('text-xs text-muted-foreground tabular-nums', value.length >= slot.max && 'text-amber-700 dark:text-amber-300')}>
                        {value.length} / {slot.max}
                      </span>
                    )}
                  </div>
                  {slot.multiline ? (
                    <Textarea
                      id={id}
                      rows={2}
                      value={value}
                      maxLength={slot.max ?? undefined}
                      onChange={(e) => setValues((v) => ({ ...v, [slot.key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={id}
                      value={value}
                      maxLength={slot.max ?? undefined}
                      onChange={(e) => setValues((v) => ({ ...v, [slot.key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
