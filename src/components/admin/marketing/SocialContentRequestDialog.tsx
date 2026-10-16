// MEDIA-3 — "Maak een post met dit beeld": een verzoek naar de contentpijplijn, vanuit de
// mediabibliotheek. Alles wordt beslist in de RPC request_social_content (rol, pijplijn,
// limieten, credits); hier kiest de gebruiker soort, datum, taal en opmerking en ziet hij de kost.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { useRequestSocialContent } from '@/hooks/useSocialPipeline';
import { useAICredits } from '@/hooks/useAICredits';
import {
  SOCIAL_CONTENT_KINDS, contentRequestCost, isValidWantedFor, socialRpcErrorCode, socialRpcErrorKey,
  type SocialContentKind,
} from '@/lib/socialContent';

interface Props {
  /** media_assets-id's; leeg = dialoog dicht. */
  assetIds: string[];
  /** Kleine voorbeeldjes (zelfde volgorde), enkel voor de weergave. */
  previews: { id: string; url: string; title: string }[];
  onClose: () => void;
  onDone?: () => void;
}

const KIND_KEYS: Record<SocialContentKind, string> = {
  post: 'admin.socialContent.kind.post',
  story: 'admin.socialContent.kind.story',
  reel: 'admin.socialContent.kind.reel',
};

export function SocialContentRequestDialog({ assetIds, previews, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const request = useRequestSocialContent();
  const { credits, isUnlimited } = useAICredits();
  const [kind, setKind] = useState<SocialContentKind>('post');
  const [language, setLanguage] = useState<string>('auto');
  const [wantedFor, setWantedFor] = useState('');
  const [note, setNote] = useState('');

  const open = assetIds.length > 0;
  useEffect(() => {
    if (!open) return;
    setKind('post');
    setLanguage('auto');
    setWantedFor('');
    setNote('');
  }, [open]);

  const cost = contentRequestCost(kind);
  const available = credits?.available ?? 0;
  const tooFew = !isUnlimited && available < cost;
  const dateOk = isValidWantedFor(wantedFor);

  const submit = async () => {
    try {
      const res = await request.mutateAsync({
        mediaAssetIds: assetIds,
        kind,
        language: language === 'auto' ? null : language,
        wantedFor: wantedFor || null,
        note,
      });
      toast.success(t('admin.socialContent.requested'), {
        description: res?.credits_charged
          ? t('admin.socialContent.charged', { count: res.credits_charged })
          : t('admin.socialContent.chargedNone'),
      });
      onDone?.();
      onClose();
    } catch (err) {
      const code = socialRpcErrorCode(err);
      toast.error(code === 'unknown'
        ? t('admin.socialContent.errors.unknown_with', { message: (err as Error)?.message ?? '' })
        : t(socialRpcErrorKey(code)));
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !o && !request.isPending && onClose()}
      title={t('admin.socialContent.title', { count: assetIds.length })}
      description={t('admin.socialContent.description')}
      footer={
        <div className="flex w-full gap-2 sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose} disabled={request.isPending}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={submit} disabled={request.isPending || !dateOk || tooFew}>
            {request.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t('admin.socialContent.submit')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {previews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previews.map((p) => (
              <img key={p.id} src={p.url} alt={p.title} className="h-16 w-16 shrink-0 rounded object-cover bg-muted" />
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="social-request-kind">{t('admin.socialContent.kindLabel')}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SocialContentKind)}>
              <SelectTrigger id="social-request-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOCIAL_CONTENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{t(KIND_KEYS[k])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social-request-language">{t('admin.socialContent.languageLabel')}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="social-request-language"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('admin.socialContent.languageAuto')}</SelectItem>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="social-request-date">{t('admin.socialContent.dateLabel')}</Label>
          <Input id="social-request-date" type="date" value={wantedFor} onChange={(e) => setWantedFor(e.target.value)} />
          <p className={dateOk ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
            {dateOk ? t('admin.socialContent.dateHint') : t('admin.socialContent.dateInvalid')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="social-request-note">{t('admin.socialContent.noteLabel')}</Label>
          <Textarea
            id="social-request-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('admin.socialContent.notePlaceholder')}
            className="text-sm"
          />
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <p className="font-medium">{t('admin.socialContent.cost', { count: cost })}</p>
          {isUnlimited ? (
            <p className="text-muted-foreground">{t('admin.socialContent.costExempt')}</p>
          ) : (
            <p className={tooFew ? 'text-destructive' : 'text-muted-foreground'}>
              {tooFew ? t('admin.socialContent.errors.insufficient_credits') : t('admin.socialContent.available', { count: available })}
            </p>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
