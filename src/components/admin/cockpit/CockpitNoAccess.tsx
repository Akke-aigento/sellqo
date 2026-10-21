import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Staat voor een kaart zonder leesrecht: nooit "€ 0" tonen alsof er geen omzet was. */
export function CockpitNoAccess({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${compact ? '' : 'py-2'}`}>
      <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('admin.cockpit.no_access')}</span>
    </div>
  );
}
