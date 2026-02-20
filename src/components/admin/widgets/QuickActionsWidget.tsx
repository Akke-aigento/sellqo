import { Link } from 'react-router-dom';
import { Plus, ShoppingCart, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickActionsWidget() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Snelle acties</CardTitle>
        <CardDescription>Veelgebruikte taken</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full justify-start">
          <Link to="/admin/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Nieuw product toevoegen
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link to="/admin/orders">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Bestellingen bekijken
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link to="/admin/categories">
            <Package className="mr-2 h-4 w-4" />
            Categorieën beheren
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
