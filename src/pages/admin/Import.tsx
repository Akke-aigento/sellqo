import { useNavigate } from 'react-router-dom';
import { ImportWizard } from '@/components/admin/import/ImportWizard';

export default function Import() {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/admin/customers');
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <ImportWizard onComplete={handleComplete} />
    </div>
  );
}
