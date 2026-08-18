import { Link2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SocialLinksEditor } from './SocialLinksEditor';

export function SocialMediaHub() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('settings.sections.social')}</h2>
        <p className="text-muted-foreground">
          {t('settings.social.hubSubtitle')}
        </p>
      </div>

      <SocialLinksEditor />

      <Alert>
        <Link2 className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            {t('settings.social.sellQuestion')}
            {t('settings.social.postQuestion')}
          </span>
          <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
            <a href="/admin/connect">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('settings.social.toConnect')}
            </a>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
