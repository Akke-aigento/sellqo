import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, FileText, Megaphone, LucideIcon } from 'lucide-react';
import type { CommunicationCategory } from '@/types/customerCommunication';

const CATEGORY_ICONS: Record<CommunicationCategory, LucideIcon> = {
  orders: ShoppingCart,
  shipping: Package,
  invoices: FileText,
  marketing: Megaphone,
};

const CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  orders: 'Bestellingen',
  shipping: 'Verzending',
  invoices: 'Facturen & Offertes',
  marketing: 'Winkelwagen & Marketing',
};

interface CommunicationCategoryCardProps {
  category: CommunicationCategory;
  children: React.ReactNode;
}

export function CommunicationCategoryCard({ category, children }: CommunicationCategoryCardProps) {
  const Icon = CATEGORY_ICONS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded-md">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
