import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ImportWizard } from '@/components/admin/import/ImportWizard';

export default function Import() {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/admin/customers');
  };

  return (
    <AdminLayout>
      <div className="container mx-auto py-6 px-4">
        <ImportWizard onComplete={handleComplete} />
      </div>
    </AdminLayout>
  );
}
