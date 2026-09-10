import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

/**
 * Landing voor Universal Links (iOS) en App Links (Android) op /app/*.
 *
 * Voor nu bewust een placeholder: hij zorgt dat een deep link niet meer op de
 * 404 valt, en logt welk pad binnenkwam. De concrete afhandeling van
 * betaal- en OAuth-retours komt in een latere batch — daarom hier geen enkele
 * aanname over Stripe- of OAuth-specifieke queryparameters.
 *
 * Geen PublicPageLayout: dit scherm verschijnt in de native app, waar
 * marketing-chrome met menubalk en footer niet thuishoort.
 */
export default function AppDeepLinkHandler() {
  const { t } = useTranslation();
  const location = useLocation();
  const incomingPath = `${location.pathname}${location.search}`;

  useEffect(() => {
    console.info('[deeplink] binnengekomen pad:', incomingPath);
  }, [incomingPath]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h1 className="text-lg font-semibold text-foreground">
        {t('public.deepLink.title')}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t('public.deepLink.description')}
      </p>
    </div>
  );
}
