import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportWizard } from '@/components/admin/import/ImportWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';
import { ConnectMarketplaceDialog } from '@/components/admin/marketplace/ConnectMarketplaceDialog';

export default function Import() {
  const navigate = useNavigate();
  const [shopifyOpen, setShopifyOpen] = useState(false);

  const handleComplete = () => {
    navigate('/admin/customers');
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card className="mb-6 border-primary/20">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">Shopify importeren</h2>
            <p className="text-sm text-muted-foreground">
              Verbind je Shopify-winkel om producten, klanten en orders eenmalig te importeren.
            </p>
          </div>
          <Button onClick={() => setShopifyOpen(true)}>Start Shopify import</Button>
        </CardContent>
      </Card>

      <ImportWizard onComplete={handleComplete} />

      {shopifyOpen && (
        <ConnectMarketplaceDialog
          open={shopifyOpen}
          onOpenChange={setShopifyOpen}
          marketplaceType="shopify"
          onSuccess={() => navigate('/admin/orders')}
        />
      )}
    </div>
  );
}
