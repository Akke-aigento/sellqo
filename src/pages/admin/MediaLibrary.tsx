// MARKETING-2 — de mediabibliotheek als eigen plek onder Marketing. Was de tab "Assets" in de
// AI Content Hub; sinds MEDIA-1 staan hier alle foto's van de winkel (producten, AI, social).

import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { MediaAssetsLibrary } from '@/components/admin/marketing/MediaAssetsLibrary';

export default function MediaLibrary() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.mediaLibrary.title')} description={t('admin.mediaLibrary.description')} />
      <MediaAssetsLibrary />
    </div>
  );
}
