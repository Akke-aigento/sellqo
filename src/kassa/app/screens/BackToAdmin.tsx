// KASSA-MOBIEL-1 — "Terug naar beheer" bovenaan koppelen/ontkoppeld (web en SellQo-app, route /kassa). Beheer heeft
// een eigen aanmelding: wie daar aangemeld is, blijft aangemeld; anders toont beheer het aanmeldscherm.
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

export function BackToAdmin() {
  const { t } = useTranslation();
  return (
    <a href="/admin" className="-ml-2 inline-flex h-11 w-fit items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden />{t('kassa.pair.backToAdmin')}
    </a>
  );
}
