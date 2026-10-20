import { useTranslation } from 'react-i18next';
import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useEmailLogoState } from '@/hooks/useEmailLogoBackfill';
import type { EmailLogoState } from '@/lib/emailLogo';
import type { LogoTarget } from '@/hooks/useLogoUpload';

interface EmailLogoFromCurrentButtonProps {
  /** Enkel tonen bij het logo dat de mail nu gebruikt (themalogo gaat voor op bedrijfslogo). */
  target: LogoTarget;
  /** Het logo dat dit scherm nu toont; wijkt het af van het opgeslagen logo (nog niet bewaard), dan geen knop. */
  shownLogoUrl?: string | null;
  onCreate: (state: EmailLogoState) => void;
  busy: boolean;
}

/**
 * MAIL-UX-1 — "Mailversie maken van je huidige logo". Alleen zichtbaar als het nut heeft: er is
 * een logo, er is nog geen mailversie van precies dát logo, en je mag het winkelprofiel wijzigen.
 */
export function EmailLogoFromCurrentButton({ target, shownLogoUrl, onCreate, busy }: EmailLogoFromCurrentButtonProps) {
  const { t } = useTranslation();
  const canWrite = useCan('write', 'settings_general');
  const { data: state } = useEmailLogoState();
  if (!canWrite || !state?.needsVariant || state.target !== target) return null;
  if (shownLogoUrl !== undefined && (shownLogoUrl ?? '').trim() !== state.currentLogo) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">{t('settings.emailLogo.fromCurrentHint')}</p>
      <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => onCreate(state)}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
        {t('settings.emailLogo.fromCurrentButton')}
      </Button>
    </div>
  );
}
