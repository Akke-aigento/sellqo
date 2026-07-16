import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ImportWizard } from '@/components/admin/import/ImportWizard';

export default function Import() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleComplete = () => {
    navigate('/admin/customers');
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('import.page_title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('import.page_subtitle')}</p>
      </div>
      <ImportWizard onComplete={handleComplete} />
    </div>
  );
}
