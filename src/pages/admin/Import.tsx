import { useNavigate } from 'react-router-dom';
import { ImportWizard } from '@/components/admin/import/ImportWizard';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

export default function Import() {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/admin/customers');
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card className="mb-6 border-primary/20">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="font-semibold text-lg">Vanuit Shopify overstappen?</h2>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>
                Exporteer in je Shopify-admin je producten, klanten en bestellingen als CSV
                (Producten → Exporteren, Klanten → Exporteren, Bestellingen → Exporteren).
              </li>
              <li>Upload die bestanden in de wizard hieronder.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <ImportWizard onComplete={handleComplete} />
    </div>
  );
}
