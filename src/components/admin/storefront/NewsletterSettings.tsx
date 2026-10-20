import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MailCheck, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * MAIL-CLEAN-1 — Instellingen → E-mailinschrijving (vroeger "Nieuwsbrief", ?section=newsletter).
 *
 * Enkel uitleg en de weg naar de echte plekken. Weg: providerkeuze, testknop, tellers, de
 * schakelaar voor double opt-in (staat altijd aan) en de welkomstmail-editor (die mail staat
 * sinds deze batch als stap 1 in Marketing → Automatiseringen → Welkomstreeks).
 * Leest en schrijft tenant_newsletter_config niet meer, dus ook bereikbaar voor de marketingrol.
 */
export function NewsletterSettings() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="h-5 w-5" />
          {t('settings.emailSignup.title')}
        </CardTitle>
        <CardDescription>{t('settings.emailSignup.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">{t('settings.emailSignup.double_optin_title')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.emailSignup.double_optin_body')}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/admin/marketing?tab=subscribers"
            className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <Users className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="font-medium flex items-center gap-1">
                {t('settings.emailSignup.subscribers_title')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="text-xs text-muted-foreground">{t('settings.emailSignup.subscribers_path')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.emailSignup.subscribers_body')}</p>
            </div>
          </Link>
          <Link
            to="/admin/marketing?tab=automations&trigger=welcome_series"
            className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <MailCheck className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="font-medium flex items-center gap-1">
                {t('settings.emailSignup.welcome_title')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="text-xs text-muted-foreground">{t('settings.emailSignup.welcome_path')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.emailSignup.welcome_body')}</p>
            </div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
