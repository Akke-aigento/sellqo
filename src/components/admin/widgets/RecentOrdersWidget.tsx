import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function RecentOrdersWidget() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recente bestellingen</CardTitle>
          <CardDescription>Laatste 5 bestellingen</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/orders">
            Alles bekijken
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nog geen bestellingen
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Bestellingen verschijnen hier zodra ze binnenkomen
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
