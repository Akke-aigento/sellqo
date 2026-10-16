// SOCIAL-4b — "Taal veranderen": caption en tekst in de beelden vertalen, nakijken, de beelden
// opnieuw tekenen (SOCIAL-4) en pas na "Bewaren" opslaan.
//
// - Post/story met recepten: alles hier, meteen (vertaling via social-translate-post).
// - Beeld zonder recept: enkel de caption; de tekst in dat beeld blijft zoals hij is (gemeld).
// - Reel van de contentpijplijn: de tekst zit in de video, dus "Opnieuw maken" in die taal.

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { applySlots, parseRecipe, rasterizeRecipe, readSlots, type ImageRecipe, type RecipeSlot } from '@/lib/social/imageRecipe';
import type { PlannerPost } from '@/hooks/useSocialPlanner';
import { regenerateCost } from '@/lib/socialContent';

interface RecipeImage {
  index: number;
  recipe: ImageRecipe;
  slots: RecipeSlot[];
}

export interface TranslationResult {
  post: PlannerPost;
  language: string;
  caption: string;
  images: { index: number; jpeg: Blob; recipe: ImageRecipe }[];
}

interface Props {
  post: PlannerPost | null;
  tenantId: string | undefined;
  onClose: () => void;
  onSave: (result: TranslationResult) => Promise<void>;
  /** Reel van de pijplijn: vraag een nieuwe versie in deze taal. */
  onRegenerateInLanguage: (post: PlannerPost, language: string) => Promise<void>;
  /** SOCIAL-SEC-1: mag deze post via "Opnieuw maken" (pijplijn aan, juiste status)? */
  regenerateAllowed: boolean;
}

export function SocialTranslateDialog({ post, tenantId, onClose, onSave, onRegenerateInLanguage, regenerateAllowed }: Props) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState('');
  const [step, setStep] = useState<'choose' | 'edit' | 'result'>('choose');
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState<{ index: number; jpeg: Blob; url: string; recipe: ImageRecipe }[]>([]);

  const isReel = post?.media_type === 'reel';
  const recipeImages: RecipeImage[] = useMemo(() => {
    if (!post || isReel) return [];
    const recipes = post.image_recipes ?? [];
    return (post.image_urls ?? []).flatMap((_, index) => {
      const recipe = parseRecipe(recipes[index]);
      if (!recipe) return [];
      const slots = readSlots(recipe.html);
      return slots.length ? [{ index, recipe, slots }] : [];
    });
  }, [post, isReel]);
  const imagesWithoutRecipe = post && !isReel ? (post.image_urls ?? []).length - recipeImages.length : 0;
  const reelViaRegenerate = isReel && regenerateAllowed;
  const languages = SUPPORTED_LANGUAGES.filter((l) => l.code !== post?.language);

  useEffect(() => {
    setStep('choose');
    setBusy(false);
    setLanguage('');
    setRendered((prev) => {
      prev.forEach((r) => URL.revokeObjectURL(r.url));
      return [];
    });
  }, [post?.id]);

  const fail = (err: unknown) => toast.error(t('admin.socialPlanner.toast.error', { message: (err as Error)?.message ?? '' }));

  const translate = async () => {
    if (!post || !language) return;
    setBusy(true);
    try {
      if (reelViaRegenerate) {
        await onRegenerateInLanguage(post, language);
        toast.success(t('admin.socialPlanner.toast.regenerateRequested'));
        onClose();
        return;
      }
      const texts: Record<string, { text: string; max?: number }> = {};
      if (post.post_text?.trim()) texts.caption = { text: post.post_text, max: 2200 };
      for (const img of recipeImages) {
        for (const s of img.slots) {
          if (s.value.trim()) texts[`${img.index}:${s.key}`] = { text: s.value, max: s.max ?? undefined };
        }
      }
      const { data, error } = await supabase.functions.invoke('social-translate-post', {
        body: { tenantId, postId: post.id, targetLanguage: language, texts },
      });
      if (error || !data?.translations) throw new Error(data?.error ?? error?.message ?? 'Vertalen mislukt');
      const tr = data.translations as Record<string, string>;
      setCaption(tr.caption ?? post.post_text ?? '');
      const next: Record<string, string> = {};
      for (const img of recipeImages) {
        for (const s of img.slots) next[`${img.index}:${s.key}`] = tr[`${img.index}:${s.key}`] ?? s.value;
      }
      setValues(next);
      setStep('edit');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const renderAll = async () => {
    setBusy(true);
    try {
      const out: { index: number; jpeg: Blob; url: string; recipe: ImageRecipe }[] = [];
      for (const img of recipeImages) {
        const own = Object.fromEntries(img.slots.map((s) => [s.key, values[`${img.index}:${s.key}`] ?? s.value]));
        const html = applySlots(img.recipe.html, own);
        const jpeg = await rasterizeRecipe(html, img.recipe.width, img.recipe.height);
        out.push({ index: img.index, jpeg, url: URL.createObjectURL(jpeg), recipe: { ...img.recipe, html } });
      }
      setRendered((prev) => {
        prev.forEach((r) => URL.revokeObjectURL(r.url));
        return out;
      });
      setStep('result');
    } catch (err) {
      toast.error(t('admin.socialPlanner.imageText.renderFailed', { message: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!post) return;
    setBusy(true);
    try {
      await onSave({ post, language, caption, images: rendered.map(({ index, jpeg, recipe }) => ({ index, jpeg, recipe })) });
      toast.success(t('admin.socialPlanner.translate.saved'));
      onClose();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const languageLabel = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label ?? language;
  const working = busy;

  const footer = (
    <div className="flex w-full gap-2 sm:justify-end">
      {step === 'result' ? (
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setStep('edit')} disabled={working}>
          {t('admin.socialPlanner.imageText.back')}
        </Button>
      ) : (
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose} disabled={working}>
          {t('common.cancel')}
        </Button>
      )}
      {step === 'choose' ? (
        <Button className="flex-1 sm:flex-none" onClick={translate} disabled={!language || working}>
          {working && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {reelViaRegenerate ? t('admin.socialPlanner.regenerate.confirm') : t('admin.socialPlanner.translate.translate')}
        </Button>
      ) : step === 'edit' ? (
        <Button className="flex-1 sm:flex-none" onClick={recipeImages.length ? renderAll : () => setStep('result')} disabled={working}>
          {working && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {t('admin.socialPlanner.imageText.next')}
        </Button>
      ) : (
        <Button className="flex-1 sm:flex-none" onClick={save} disabled={working}>
          {working && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {t('admin.socialPlanner.imageText.save')}
        </Button>
      )}
    </div>
  );

  return (
    <ResponsiveDialog
      open={!!post}
      onOpenChange={(open) => !open && !working && onClose()}
      title={t('admin.socialPlanner.translate.title')}
      footer={footer}
      maxWidth="2xl"
    >
      {post && step === 'choose' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="social-translate-language">{t('admin.socialPlanner.translate.to')}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="social-translate-language">
                <SelectValue placeholder={t('admin.socialPlanner.translate.choose')} />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {reelViaRegenerate
              ? `${t('admin.socialPlanner.translate.reelInfo')} ${t('admin.socialContent.cost', { count: regenerateCost(post.media_type) })}`
              : isReel
                ? t('admin.socialPlanner.translate.reelCaptionOnly')
                : t('admin.socialPlanner.translate.info')}
          </p>
          {imagesWithoutRecipe > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('admin.socialPlanner.translate.noRecipe', { count: imagesWithoutRecipe })}
            </p>
          )}
        </div>
      )}

      {post && step === 'edit' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('admin.socialPlanner.translate.review', { language: languageLabel })}</p>
          <div className="space-y-2">
            <Label htmlFor="social-translate-caption">{t('admin.socialPlanner.caption')}</Label>
            <Textarea id="social-translate-caption" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} className="text-sm" />
          </div>
          {recipeImages.map((img) => (
            <div key={img.index} className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">{t('admin.socialPlanner.imageText.image', { n: img.index + 1 })}</p>
              {img.slots.map((s) => {
                const key = `${img.index}:${s.key}`;
                const value = values[key] ?? '';
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor={`tr-${key}`}>{s.label}</Label>
                      {s.max && <span className="text-xs text-muted-foreground tabular-nums">{value.length} / {s.max}</span>}
                    </div>
                    {s.multiline ? (
                      <Textarea id={`tr-${key}`} rows={2} value={value} maxLength={s.max ?? undefined}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
                    ) : (
                      <Input id={`tr-${key}`} value={value} maxLength={s.max ?? undefined}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {post && step === 'result' && (
        <div className="space-y-4">
          {rendered.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {rendered.map((r) => (
                <img key={r.index} src={r.url} alt="" className="w-full rounded-md border" />
              ))}
            </div>
          )}
          <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">{caption}</div>
          <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.translate.resultHint')}</p>
        </div>
      )}
    </ResponsiveDialog>
  );
}
