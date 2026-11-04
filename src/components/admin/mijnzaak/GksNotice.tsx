// HORECA-ZIJBALK-1 — eerlijke GKS-uitleg (zie CLAUDE.md §9): geen belofte, geen datum.
// HORECA-INSTELLINGEN-1: losgetrokken uit Instellingen › Horeca, zodat Mijn zaak dezelfde tekst toont.
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function GksNotice() {
  const { t } = useTranslation();
  return (
    <Alert className="border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50 [&>svg]:text-amber-600">
      <ShieldAlert className="h-4 w-4" aria-hidden />
      <AlertTitle>{t('settings.horecaHub.gks_title')}</AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>{t('settings.horecaHub.gks_body')}</p>
        <p>{t('settings.horecaHub.gks_rule')}</p>
        <p>{t('settings.horecaHub.gks_doubt')}</p>
      </AlertDescription>
    </Alert>
  );
}
